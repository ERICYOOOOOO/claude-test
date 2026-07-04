/* 体内时钟 Body Clock — 共享核心（H5 / 微信小游戏 / 抖音小游戏 / Node 单测共用）
 *
 * UMD：浏览器 <script> 挂 window.BodyClockCore；小游戏与 Node 走 module.exports。
 * 这里只放纯函数：种子→目标时长、误差→称号、连胜、分享文本、状态归一化、指针角度。
 * 不碰 DOM，不碰 wx./tt.，不碰 localStorage —— 平台差异全部留给外层。
 *
 * 微信/抖音目录无法 require 包外文件，wechat-minigame/shared/core.js 是本文件的
 * 逐字节副本（test/core.mjs 会校验一致性；改动后运行:
 *   cp shared/core.js wechat-minigame/shared/core.js ）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BodyClockCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = 1;

  /* ---------- 日期与期号 -------------------------------------------------
   * 以用户本地日期为准（与 Wordle 同一口径）：每个时区各自过零点换题。
   * dayIndex = 本地日期的"天序号"；EPOCH_DAY 对应 2026-06-17（第 1 期）。
   */
  var EPOCH_DAY = 20621;

  function localDayIndex(dateLike) {
    var d = dateLike instanceof Date ? dateLike : new Date(dateLike);
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  }

  function issueNumber(dayIndex) {
    return dayIndex - EPOCH_DAY + 1;
  }

  /* ---------- 确定性随机（mulberry32） ---------------------------------- */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 每日目标时长 -----------------------------------------------
   * 3.00–12.00 秒，两位小数（即厘秒粒度，targetMs 必为 10 的倍数）。
   * 同一天全球同题；跨天必变（由种子决定，碰撞概率 1/901 可接受）。
   */
  var TARGET_MIN_MS = 3000;
  var TARGET_MAX_MS = 12000;

  function targetMsForDay(dayIndex) {
    var r = mulberry32(((dayIndex | 0) ^ 0x5f356495) >>> 0);
    r(); r(); // 丢弃前两个输出，去掉低位种子相关性
    var cs = 300 + Math.floor(r() * 901); // 300–1200 厘秒
    return cs * 10;
  }

  /* ---------- 误差 → 称号 ------------------------------------------------ */
  var TIERS = [
    { id: 'atomic',    name: '原子钟', mark: '⚛️', maxMs: 10 },
    { id: 'cesium',    name: '铯钟',   mark: '🛰️', maxMs: 30 },
    { id: 'quartz',    name: '石英表', mark: '⌚', maxMs: 80 },
    { id: 'mechanical',name: '机械表', mark: '⚙️', maxMs: 200 },
    { id: 'hourglass', name: '沙漏',   mark: '⏳', maxMs: 500 },
    { id: 'sundial',   name: '日晷',   mark: '🌞', maxMs: Infinity }
  ];

  function gradeError(errMs) {
    var e = Math.abs(errMs);
    for (var i = 0; i < TIERS.length; i++) {
      if (e <= TIERS[i].maxMs) return TIERS[i];
    }
    return TIERS[TIERS.length - 1];
  }

  /* ---------- 判定 -------------------------------------------------------
   * heldMs：按住时长（performance.now 差值）。signedMs>0 = 数多了。
   */
  function judge(targetMs, heldMs) {
    var signedMs = Math.round(heldMs - targetMs);
    var errMs = Math.abs(signedMs);
    return { signedMs: signedMs, errMs: errMs, tier: gradeError(errMs) };
  }

  /* ---------- 连胜 -------------------------------------------------------
   * "守时" = 当日最好误差 ≤ STREAK_KEEP_MS。漏一天或超标即断。
   * 用逐日回溯而非增量计数：对补看广告改成绩、多端同步都天然自洽。
   */
  var STREAK_KEEP_MS = 200;

  function isKeptDay(rec) {
    return !!rec && rec.done === true &&
      typeof rec.bestErrMs === 'number' && rec.bestErrMs <= STREAK_KEEP_MS;
  }

  function computeStreak(days, todayIndex) {
    var d = todayIndex;
    var today = days ? days[d] : null;
    if (!isKeptDay(today)) {
      if (today && today.done) return 0; // 今天已结算但超标 → 已断
      d = todayIndex - 1;                // 今天还没打完，从昨天起算
    }
    var n = 0;
    while (days && isKeptDay(days[d])) {
      n++; d--;
      if (n > 3650) break; // 理论上限保险丝
    }
    return n;
  }

  /* ---------- 格式化 ------------------------------------------------------ */
  function formatSec(ms, digits) {
    if (digits == null) digits = 2;
    return (ms / 1000).toFixed(digits);
  }

  // 误差统一显示为秒的三位小数（0.038s），比"38ms"更有仪器感，也和分享卡一致。
  function formatErrSec(errMs) {
    return formatSec(errMs, 3) + 's';
  }

  /* ---------- 分享 -------------------------------------------------------- */
  function attemptSquare(errMs) {
    if (errMs <= 80) return '🟩';
    if (errMs <= 200) return '🟨';
    return '🟥';
  }

  function squares(attempts) {
    var s = '';
    for (var i = 0; i < attempts.length; i++) s += attemptSquare(attempts[i].errMs);
    return s;
  }

  /* opts: { issueNo, targetMs, bestErrMs, attempts:[{errMs}], star, streak, domain } */
  function shareText(opts) {
    var tier = gradeError(opts.bestErrMs);
    var head = '体内时钟 #' + opts.issueNo +
      ' · 目标 ' + formatSec(opts.targetMs) + 's' +
      ' · 误差 ' + formatErrSec(opts.bestErrMs) +
      ' ' + tier.mark + ' ' + tier.name + (opts.star ? '★' : '');
    var lines = [head, squares(opts.attempts || [])];
    var tail = [];
    if (opts.streak > 1) tail.push('守时连胜 ' + opts.streak + ' 天');
    if (opts.domain) tail.push(opts.domain);
    if (tail.length) lines.push(tail.join(' · '));
    return lines.join('\n');
  }

  /* ---------- 指针角度 -----------------------------------------------------
   * 松开后朱红秒针回摆指向误差：0ms 指正上方，±500ms 封顶 ±90°。
   * H5 CSS、分享 PNG、微信 Canvas 三处共用，保证三端表针读数一致。
   */
  function errAngleDeg(signedMs) {
    var x = signedMs / 500;
    if (x > 1) x = 1;
    if (x < -1) x = -1;
    return x * 90;
  }

  /* ---------- 持久化状态归一化 ---------------------------------------------
   * 输入任何垃圾（null / 字符串 / 半截对象），输出保证可用的状态。
   * days 只保留最近 400 天，防止 localStorage 无限膨胀。
   */
  var DAILY_ATTEMPTS = 3;
  var MIN_HOLD_MS = 200; // 短于此视为误触，不消耗机会

  function defaultState() {
    return {
      v: VERSION,
      days: {},
      settings: { distortion: false, distortionUnlocked: false, sound: true }
    };
  }

  function sanitizeAttempt(a) {
    if (!a || typeof a !== 'object') return null;
    var err = Number(a.errMs);
    var held = Number(a.heldMs);
    if (!isFinite(err) || err < 0 || err > 3600000) return null;
    return {
      heldMs: isFinite(held) && held >= 0 ? Math.round(held) : 0,
      errMs: Math.round(err),
      signedMs: isFinite(Number(a.signedMs)) ? Math.round(Number(a.signedMs)) : 0,
      star: a.star === true
    };
  }

  function normalizeState(raw, todayIndex) {
    var st = defaultState();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return st;
    if (raw.settings && typeof raw.settings === 'object') {
      st.settings.distortion = raw.settings.distortion === true;
      st.settings.distortionUnlocked = raw.settings.distortionUnlocked === true;
      st.settings.sound = raw.settings.sound !== false;
    }
    if (raw.days && typeof raw.days === 'object' && !Array.isArray(raw.days)) {
      for (var k in raw.days) {
        if (!Object.prototype.hasOwnProperty.call(raw.days, k)) continue;
        var idx = parseInt(k, 10);
        if (!isFinite(idx) || idx < EPOCH_DAY - 1 || idx > EPOCH_DAY + 36500) continue;
        if (typeof todayIndex === 'number' && idx < todayIndex - 400) continue;
        var rec = raw.days[k];
        if (!rec || typeof rec !== 'object') continue;
        var attempts = [];
        if (Array.isArray(rec.attempts)) {
          for (var i = 0; i < rec.attempts.length && attempts.length < 8; i++) {
            var a = sanitizeAttempt(rec.attempts[i]);
            if (a) attempts.push(a);
          }
        }
        var best = null;
        for (var j = 0; j < attempts.length; j++) {
          if (best === null || attempts[j].errMs < best) best = attempts[j].errMs;
        }
        st.days[idx] = {
          attempts: attempts,
          extra: isFinite(Number(rec.extra)) ? Math.max(0, Math.min(3, Math.round(Number(rec.extra)))) : 0,
          done: rec.done === true && attempts.length > 0,
          bestErrMs: best
        };
      }
    }
    return st;
  }

  /* 当日最好成绩（含 star 标记：最好那次是否开着干扰模式打出） */
  function bestOf(attempts) {
    var best = null;
    for (var i = 0; i < attempts.length; i++) {
      if (best === null || attempts[i].errMs < best.errMs) best = attempts[i];
    }
    return best;
  }

  return {
    VERSION: VERSION,
    EPOCH_DAY: EPOCH_DAY,
    TIERS: TIERS,
    TARGET_MIN_MS: TARGET_MIN_MS,
    TARGET_MAX_MS: TARGET_MAX_MS,
    STREAK_KEEP_MS: STREAK_KEEP_MS,
    DAILY_ATTEMPTS: DAILY_ATTEMPTS,
    MIN_HOLD_MS: MIN_HOLD_MS,
    localDayIndex: localDayIndex,
    issueNumber: issueNumber,
    mulberry32: mulberry32,
    targetMsForDay: targetMsForDay,
    gradeError: gradeError,
    judge: judge,
    computeStreak: computeStreak,
    formatSec: formatSec,
    formatErrSec: formatErrSec,
    attemptSquare: attemptSquare,
    squares: squares,
    shareText: shareText,
    errAngleDeg: errAngleDeg,
    defaultState: defaultState,
    normalizeState: normalizeState,
    bestOf: bestOf
  };
});
