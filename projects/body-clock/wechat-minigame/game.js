/* 体内时钟 Body Clock — 微信/抖音小游戏入口（Canvas 版核心循环）
 *
 * 判定/称号/种子/连胜全部来自 shared/core.js（与 H5 版共用同一份逻辑，
 * 该文件是 ../shared/core.js 的逐字节副本，test/core.mjs 校验一致性）。
 * 平台 API（震动/广告/分享/存储）一律经 adapter.js，本文件不直接碰 wx./tt.。
 *
 * 循环：idle（表盘+目标）→ holding（按住，无计时，脉动）→ reveal（误差+称号）
 *      → 3 次用完 → summary（结算+分享+激励视频挂点）
 */
'use strict';

var core = require('./shared/core.js');
var adapter = require('./adapter.js');

/* ---------------- 广告位 ID：流量主开通后在平台后台创建并替换 ---------------- */
var AD_UNIT_RETRY = 'adunit-xxxxxxxxxxxxxxxx';      // 挂点 1：再来一次机会
var AD_UNIT_DISTORTION = 'adunit-yyyyyyyyyyyyyyyy'; // 挂点 2：解锁干扰模式 ★

var LS_KEY = 'bodyclock.v1';

/* ---------------- 画布 ---------------- */
var canvas = adapter.createCanvas();
var sys = adapter.getSystemInfo();
var DPR = Math.min(sys.pixelRatio || 2, 3);
var W = sys.windowWidth, H = sys.windowHeight;
canvas.width = W * DPR;
canvas.height = H * DPR;
var ctx = canvas.getContext('2d');
ctx.scale(DPR, DPR);

var COLOR = {
  steel: '#2b2d31', face: '#e9e7e2', ink: '#2b2d31',
  inkSoft: '#5b5e64', light: '#d8d9db', lightSoft: '#94969c',
  red: '#c8372d', g: '#3f7350', y: '#a8811f', r: '#b23a2e'
};
var FONT = 'sans-serif';

/* ---------------- 状态 ---------------- */
var state = core.normalizeState(loadRaw(), core.localDayIndex(Date.now()));
var dayIndex = core.localDayIndex(Date.now());
var phase = 'idle'; // idle | holding | reveal | summary
var holdT0 = 0;
var lastResult = null;
var lastHeldMs = 0;
var needleDeg = 0;        // 当前渲染的针角
var needleTarget = 0;     // 目标针角（帧循环里弹簧逼近，形成"回摆"）
var needleVel = 0;

function loadRaw() {
  var raw = adapter.getStorage(LS_KEY);
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch (e) { return null; } }
  return raw || null;
}
function save() { adapter.setStorage(LS_KEY, JSON.stringify(state)); }

function todayRec() {
  if (!state.days[dayIndex]) state.days[dayIndex] = { attempts: [], extra: 0, done: false, bestErrMs: null };
  return state.days[dayIndex];
}
function allowed(rec) { return core.DAILY_ATTEMPTS + (rec.extra || 0); }
function canPlay() { var r = todayRec(); return r.attempts.length < allowed(r); }
function targetMs() { return core.targetMsForDay(dayIndex); }
function distortionOn() { return state.settings.distortion && state.settings.distortionUnlocked; }

/* ---------------- 跨天（onShow 回前台时检查） ---------------- */
function checkDay() {
  var nd = core.localDayIndex(Date.now());
  if (nd === dayIndex) return;
  dayIndex = nd;
  state = core.normalizeState(state, dayIndex);
  save();
  phase = canPlay() ? 'idle' : 'summary';
  lastResult = null;
  needleTarget = 0;
}
adapter.onShow(checkDay);

/* ---------------- 触摸：按住 / 松开 ---------------- */
adapter.onTouchStart(function (e) {
  var t = (e.touches && e.touches[0]) || null;
  if (phase === 'holding') return;
  if (phase === 'summary') { handleSummaryTap(t); return; }
  if (phase === 'reveal') { handleRevealTap(); return; }
  if (!canPlay()) { phase = 'summary'; return; }
  holdT0 = Date.now();
  phase = 'holding';
  needleTarget = 0; needleDeg = 0; needleVel = 0;
  adapter.vibrateLight();
});

adapter.onTouchEnd(function () {
  if (phase !== 'holding') return;
  var heldMs = Date.now() - holdT0;
  adapter.vibrateLight();
  if (heldMs < core.MIN_HOLD_MS) { phase = 'idle'; return; } // 误触不消耗机会
  if (heldMs > core.MAX_HOLD_MS) { phase = 'idle'; return; } // 超时（挂机/切后台卡触摸）作废不消耗
  var res = core.judge(targetMs(), heldMs);
  var rec = todayRec();
  rec.attempts.push({ heldMs: heldMs, errMs: res.errMs, signedMs: res.signedMs, star: distortionOn() });
  rec.bestErrMs = core.bestOf(rec.attempts).errMs;
  if (rec.attempts.length >= core.DAILY_ATTEMPTS) rec.done = true;
  save();
  lastResult = res;
  lastHeldMs = heldMs;
  needleTarget = core.errAngleDeg(res.signedMs); // 秒针回摆指向误差
  phase = 'reveal';
});

adapter.onTouchCancel(function () {
  if (phase === 'holding') phase = 'idle';
});

function handleRevealTap() {
  phase = canPlay() ? 'idle' : 'summary';
  if (phase === 'summary') setupShare();
}

/* summary 屏三个按钮的简易命中区（自上而下：分享 / 加一次 / 解锁干扰） */
function handleSummaryTap(t) {
  if (!t) return;
  var y = t.clientY;
  var base = H * 0.62;
  if (y > base && y < base + 56) doShare();
  else if (y > base + 68 && y < base + 124) adRetry();
  else if (y > base + 136 && y < base + 192) adDistortion();
}

/* ---------------- 分享 ---------------- */
function shareTitle() {
  var rec = todayRec();
  var best = core.bestOf(rec.attempts);
  if (!best) return '体内时钟 · 你的身体几点了？';
  var tier = core.gradeError(best.errMs);
  return '体内时钟 #' + core.issueNumber(dayIndex) + ' 误差 ' + core.formatErrSec(best.errMs) +
    ' ' + tier.name + (best.star ? '★' : '') + '，你能比我准吗';
}
function setupShare() {
  adapter.showShareMenu();
  adapter.onShareAppMessage(function () {
    return { title: shareTitle() /* , imageUrl: 离屏 canvas 战报图 toTempFilePathSync() */ };
  });
}
function doShare() {
  adapter.shareAppMessage({ title: shareTitle() });
}

/* ---------------- 激励视频挂点（经 adapter，正式 adUnitId 后台创建） ---------------- */
var adRetryInstance = null;
function adRetry() {
  var rec = todayRec();
  if ((rec.extra || 0) >= 1) return; // 每天限 1 次
  if (!adRetryInstance) {
    adRetryInstance = adapter.createRewardedVideo(AD_UNIT_RETRY, function () {
      rec.extra = (rec.extra || 0) + 1;
      save();
      phase = 'idle';
    }, function () { /* 无广告可播：静默，按钮下次仍可点 */ });
  }
  adRetryInstance.show();
}
var adDistortionInstance = null;
function adDistortion() {
  if (state.settings.distortionUnlocked) return;
  if (!adDistortionInstance) {
    adDistortionInstance = adapter.createRewardedVideo(AD_UNIT_DISTORTION, function () {
      state.settings.distortionUnlocked = true;
      state.settings.distortion = true;
      save();
    }, function () {});
  }
  adDistortionInstance.show();
}

/* ---------------- 渲染 ---------------- */
function drawDial(cx, cy, R, holding) {
  ctx.fillStyle = COLOR.face;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = COLOR.ink; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, R - 3, 0, Math.PI * 2); ctx.stroke();
  for (var i = 0; i < 60; i++) {
    var major = i % 5 === 0;
    var a = (i / 60) * Math.PI * 2 - Math.PI / 2;
    var r1 = major ? R - 20 : R - 13, r2 = R - 7;
    ctx.strokeStyle = major ? 'rgba(43,45,49,0.8)' : 'rgba(43,45,49,0.35)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }
  if (holding) {
    // 呼吸感脉动环（按住期间唯一的动态元素，不显示任何计时）
    var breathe = 0.16 + 0.28 * (0.5 + 0.5 * Math.sin(Date.now() / 900));
    ctx.strokeStyle = 'rgba(200,55,45,' + breathe.toFixed(3) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.82, 0, Math.PI * 2); ctx.stroke();
  } else {
    // 朱红秒针（按住时隐藏，松开回摆指向误差）
    var rad = (needleDeg - 90) * Math.PI / 180;
    ctx.strokeStyle = COLOR.red; ctx.lineCap = 'round'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(rad) * R * 0.2, cy - Math.sin(rad) * R * 0.2);
    ctx.lineTo(cx + Math.cos(rad) * (R - 26), cy + Math.sin(rad) * (R - 26));
    ctx.stroke();
  }
  ctx.fillStyle = COLOR.ink;
  ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
}

function text(str, x, y, size, color, weight, align) {
  ctx.fillStyle = color;
  ctx.font = (weight || 400) + ' ' + size + 'px ' + FONT;
  ctx.textAlign = align || 'center';
  ctx.fillText(str, x, y);
}

function render() {
  ctx.fillStyle = COLOR.steel;
  ctx.fillRect(0, 0, W, H);

  text('体内时钟', W / 2, 52, 20, '#ffffff', 700);
  text('第 ' + core.issueNumber(dayIndex) + ' 期 · BODY CLOCK', W / 2, 76, 11, COLOR.lightSoft);
  var streak = core.computeStreak(state.days, dayIndex);
  if (streak > 0) text('守时连胜 ' + streak + ' 天', W / 2, 96, 11, COLOR.lightSoft);

  var cx = W / 2, cy = H * 0.42, R = Math.min(W * 0.36, 140);

  if (phase === 'idle' || phase === 'holding') {
    text('目标 ' + core.formatSec(targetMs()) + ' s', cx, cy - R - 28, 28, '#ffffff', 700);
    drawDial(cx, cy, R, phase === 'holding');
    text(phase === 'holding' ? '……' : '按 住', cx, cy + R * 0.55, 13, COLOR.inkSoft);
    var rec = todayRec();
    text(phase === 'holding' ? '心里数，到点松开'
      : '第 ' + (rec.attempts.length + 1) + ' / ' + allowed(rec) + ' 次 · 松开见分晓',
      cx, cy + R + 36, 12, COLOR.lightSoft);
    if (distortionOn()) text('干扰模式 ★', cx, cy + R + 58, 11, COLOR.red);
  } else if (phase === 'reveal' && lastResult) {
    drawDial(cx, cy - 20, R * 0.85, false);
    text('目标 ' + core.formatSec(targetMs()) + 's · 你按了 ' + core.formatSec(lastHeldMs, 3) + 's',
      cx, cy + R * 0.85 + 24, 13, COLOR.lightSoft);
    text(core.formatSec(lastResult.errMs, 3) + ' s', cx, cy + R * 0.85 + 82, 44, '#ffffff', 700);
    text(lastResult.tier.name + (distortionOn() ? ' ★' : ''), cx, cy + R * 0.85 + 118, 22, COLOR.face, 700);
    text(lastResult.signedMs < 0 ? '数快了' : lastResult.signedMs > 0 ? '数慢了' : '分毫不差',
      cx, cy + R * 0.85 + 142, 12, COLOR.lightSoft);
    text(canPlay() ? '点一下 · 下一次' : '点一下 · 看结算', cx, H - 48, 13, COLOR.lightSoft);
  } else if (phase === 'summary') {
    var rec2 = todayRec();
    var best = core.bestOf(rec2.attempts);
    if (!best) { phase = 'idle'; return; }
    var tier = core.gradeError(best.errMs);
    drawDial(cx, H * 0.3, R * 0.8, false);
    text(core.formatSec(best.errMs, 3) + ' s', cx, H * 0.3 + R * 0.8 + 64, 40, '#ffffff', 700);
    text(tier.name + (best.star ? ' ★' : ''), cx, H * 0.3 + R * 0.8 + 98, 20, COLOR.face, 700);
    // 三次迷你格
    var n = rec2.attempts.length, sqw = 18, gap = 8;
    var x0 = cx - (n * sqw + (n - 1) * gap) / 2;
    for (var i = 0; i < n; i++) {
      var e = rec2.attempts[i].errMs;
      ctx.fillStyle = e <= 80 ? COLOR.g : e <= 200 ? COLOR.y : COLOR.r;
      ctx.fillRect(x0 + i * (sqw + gap), H * 0.3 + R * 0.8 + 112, sqw, sqw);
    }
    // 按钮区（命中区见 handleSummaryTap）
    var base = H * 0.62;
    button('分享战报', base);
    if ((rec2.extra || 0) < 1) button('▶ 看视频 · 再来一次机会', base + 68);
    if (!state.settings.distortionUnlocked) button('▶ 看视频 · 解锁干扰模式 ★', base + 136);
    text('明天换题 · 把连胜守住', cx, H - 32, 11, COLOR.lightSoft);
  }
}

function button(label, y) {
  ctx.strokeStyle = COLOR.light; ctx.lineWidth = 1;
  ctx.strokeRect(W * 0.14, y, W * 0.72, 48);
  text(label, W / 2, y + 30, 14, COLOR.light);
}

/* ---------------- 帧循环（秒针弹簧回摆） ---------------- */
function tick() {
  // 超时保险丝：切后台丢 touchend 等场景下，按住超过 MAX_HOLD_MS 自动作废
  if (phase === 'holding' && Date.now() - holdT0 > core.MAX_HOLD_MS) phase = 'idle';
  // 简易弹簧：让秒针带一点过冲地摆到误差角，与 H5 的 CSS spring 手感一致
  var k = 0.12, damp = 0.82;
  needleVel = (needleVel + (needleTarget - needleDeg) * k) * damp;
  needleDeg += needleVel;
  render();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
setupShare();
