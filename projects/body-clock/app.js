/* 体内时钟 Body Clock — H5 主逻辑
 * 判定/称号/种子/连胜全部来自 shared/core.js（与微信/抖音小游戏共用）。
 * 本文件只做：DOM、按住/松开采样、动效、持久化、分享卡、激励视频占位。
 */
(function () {
  'use strict';

  var core = window.BodyClockCore;
  var DOMAIN = 'bodyclock.fun'; // 上线时换成真实域名（分享卡回流位）
  var LS_KEY = 'bodyclock.v1';

  var $ = function (id) { return document.getElementById(id); };

  /* ================= 时钟（可注入，供测试跨天换题） ================= */
  function nowMs() {
    return window.__BC_NOW__ != null ? Number(window.__BC_NOW__) : Date.now();
  }

  /* ================= 持久化（容忍垃圾数据） ================= */
  function loadState() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { raw = null; }
    return core.normalizeState(raw, core.localDayIndex(nowMs()));
  }
  function saveState() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* 隐私模式等：静默降级为内存态 */ }
  }

  var state = loadState();

  /* ================= 运行时 ================= */
  var mode = 'daily';            // daily | practice
  var phase = 'idle';            // idle | holding | reveal | summary
  var dayIndex = core.localDayIndex(nowMs());
  var practiceTargetMs = rollPracticeTarget();
  var practiceCount = 0;
  var holdT0 = 0;
  var holdSource = null;         // 'pointer' | 'key'
  var holdPointerId = null;
  var holdTimeout = null;        // 超时保险丝（core.MAX_HOLD_MS）
  var lastResult = null;         // 最近一次 reveal 的 judge 结果
  var adSlot = null;             // 当前激励视频占位槽
  var distortionTimer = null;
  var countdownTimer = null;
  var toastTimer = null;

  function todayRec() {
    var rec = state.days[dayIndex];
    if (!rec) {
      rec = { attempts: [], extra: 0, done: false, bestErrMs: null };
      state.days[dayIndex] = rec;
    }
    return rec;
  }
  function allowedAttempts(rec) { return core.DAILY_ATTEMPTS + (rec.extra || 0); }
  function canPlayDaily() { var r = todayRec(); return r.attempts.length < allowedAttempts(r); }
  function currentTargetMs() {
    return mode === 'daily' ? core.targetMsForDay(dayIndex) : practiceTargetMs;
  }
  function rollPracticeTarget() {
    return (300 + Math.floor(Math.random() * 901)) * 10; // 练习目标不必确定性
  }
  function distortionOn() {
    return state.settings.distortion === true && state.settings.distortionUnlocked === true;
  }

  /* ================= DOM 引用 ================= */
  var el = {
    issueNo: $('issue-no'), issueDate: $('issue-date'),
    streakLine: $('streak-line'), streakN: $('streak-n'),
    tabDaily: $('tab-daily'), tabPractice: $('tab-practice'),
    targetSec: $('target-sec'), distortionFlag: $('distortion-flag'),
    attemptsRow: $('attempts-row'),
    dial: $('dial'), needle: $('needle'), ticks: $('ticks'),
    dialWord: $('dial-word'), dialHint: $('dial-hint'),
    resultPanel: $('result-panel'),
    rAttemptLabel: $('result-attempt-label'), rModeLabel: $('result-mode-label'),
    rTarget: $('r-target'), rHeld: $('r-held'), rErr: $('r-err'), rDir: $('r-dir'),
    rTierMark: $('r-tier-mark'), rTier: $('r-tier'), rStar: $('r-star'),
    btnNext: $('btn-next'),
    summaryPanel: $('summary-panel'),
    sIssue: $('s-issue'), sErr: $('s-err'), sTierMark: $('s-tier-mark'),
    sTier: $('s-tier'), sStar: $('s-star'), sSquares: $('s-squares'), sStreak: $('s-streak'),
    btnCopy: $('btn-copy'), btnPng: $('btn-png'),
    btnAdRetry: $('btn-ad-retry'), btnAdDistortion: $('btn-ad-distortion'),
    countdown: $('countdown'),
    settingsModal: $('settings-modal'), btnSettings: $('btn-settings'),
    btnSettingsClose: $('btn-settings-close'),
    toggleDistortion: $('toggle-distortion'), toggleSound: $('toggle-sound'),
    adModal: $('ad-modal'), adDesc: $('ad-desc'),
    btnAdMock: $('btn-ad-mock'), btnAdClose: $('btn-ad-close'),
    toast: $('toast')
  };

  /* ================= 表盘刻度 ================= */
  (function buildTicks() {
    var ns = 'http://www.w3.org/2000/svg';
    for (var i = 0; i < 60; i++) {
      var major = i % 5 === 0;
      var a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      var r1 = major ? 100 : 105, r2 = 110;
      var line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', (120 + Math.cos(a) * r1).toFixed(2));
      line.setAttribute('y1', (120 + Math.sin(a) * r1).toFixed(2));
      line.setAttribute('x2', (120 + Math.cos(a) * r2).toFixed(2));
      line.setAttribute('y2', (120 + Math.sin(a) * r2).toFixed(2));
      if (major) line.setAttribute('class', 'major');
      el.ticks.appendChild(line);
    }
  })();

  /* ================= 触觉 / 声音 ================= */
  function vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  }
  var audioCtx = null;
  function ensureAudio() {
    if (audioCtx || state.settings.sound === false) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    } catch (e) { audioCtx = null; }
  }
  function blip(freq, durMs, gain) {
    if (!audioCtx || state.settings.sound === false) return;
    try {
      var t = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + durMs / 1000);
      osc.connect(g); g.connect(audioCtx.destination);
      osc.start(t); osc.stop(t + durMs / 1000 + 0.02);
    } catch (e) {}
  }
  /* 干扰模式：不规则轻响 —— 间隔 380–1400ms 随机，音高随机，专治默数 */
  function scheduleDistortionTick() {
    if (phase !== 'holding' || !distortionOn()) return;
    blip(420 + Math.random() * 1300, 46, 0.028);
    distortionTimer = setTimeout(scheduleDistortionTick, 380 + Math.random() * 1020);
  }
  function stopDistortion() {
    if (distortionTimer) { clearTimeout(distortionTimer); distortionTimer = null; }
  }

  /* ================= 提示 ================= */
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, 2200);
  }

  /* ================= 渲染 ================= */
  function fmtDate(ms) {
    var d = new Date(ms);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function renderHeader() {
    el.issueNo.textContent = core.issueNumber(dayIndex);
    el.issueDate.textContent = fmtDate(nowMs());
    var streak = core.computeStreak(state.days, dayIndex);
    el.streakLine.hidden = streak <= 0;
    el.streakN.textContent = streak;
  }

  function renderTarget() {
    el.targetSec.textContent = core.formatSec(currentTargetMs());
    el.distortionFlag.hidden = !distortionOn();
  }

  var ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', '＋', '＋', '＋'];
  function renderAttempts() {
    var row = el.attemptsRow;
    row.textContent = '';
    if (mode === 'practice') {
      row.hidden = true;
      return;
    }
    row.hidden = false;
    var rec = todayRec();
    var total = allowedAttempts(rec);
    for (var i = 0; i < total; i++) {
      var cell = document.createElement('div');
      cell.className = 'att';
      var a = rec.attempts[i];
      var idx = document.createElement('span');
      idx.textContent = ROMAN[i] || '＋';
      var val = document.createElement('b');
      val.className = 'num';
      if (a) {
        val.textContent = core.formatSec(a.errMs, 3) + (a.star ? '★' : '');
        var sq = core.attemptSquare(a.errMs);
        cell.classList.add(sq === '🟩' ? 'g' : sq === '🟨' ? 'y' : 'r');
      } else {
        val.textContent = '—';
      }
      cell.appendChild(idx); cell.appendChild(val);
      row.appendChild(cell);
    }
  }

  function renderHint() {
    if (mode === 'practice') {
      el.dialHint.textContent = '练习 · 不限次 · 不计入正式成绩';
    } else if (!canPlayDaily()) {
      el.dialHint.textContent = '今日三次已用完 · 明天换题';
    } else {
      var rec = todayRec();
      el.dialHint.textContent = rec.attempts.length === 0
        ? '按住表盘，心里数到目标秒数，松开'
        : '还剩 ' + (allowedAttempts(rec) - rec.attempts.length) + ' 次 · 取最好成绩';
    }
  }

  function setNeedle(deg) {
    el.needle.style.transform = 'rotate(' + deg + 'deg)';
  }

  function updateDialWord() {
    el.dialWord.textContent = phase === 'holding' ? '……'
      : (mode === 'daily' && !canPlayDaily()) ? '已锁定'
      : '按住';
  }

  function scrollIntoViewSoft(node) {
    try {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      node.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    } catch (e) {}
  }

  function setPhase(p) {
    phase = p;
    el.resultPanel.hidden = p !== 'reveal';
    el.summaryPanel.hidden = p !== 'summary';
    el.dial.classList.toggle('holding', p === 'holding');
    el.dial.classList.toggle('distort', p === 'holding' && distortionOn());
    updateDialWord();
    if (p !== 'summary' && countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  }

  function renderAll() {
    renderHeader();
    renderTarget();
    renderAttempts();
    renderHint();
    updateDialWord();
    el.tabDaily.classList.toggle('active', mode === 'daily');
    el.tabDaily.setAttribute('aria-selected', mode === 'daily');
    el.tabPractice.classList.toggle('active', mode === 'practice');
    el.tabPractice.setAttribute('aria-selected', mode === 'practice');
    el.toggleDistortion.setAttribute('aria-checked', String(distortionOn()));
    el.toggleSound.setAttribute('aria-checked', String(state.settings.sound !== false));
  }

  /* ================= 按住 / 松开 ================= */
  function startHold(source) {
    if (phase === 'holding') return;
    if (mode === 'daily' && !canPlayDaily()) {
      showSummary();
      toast('今天打完了 · 想继续去练习模式');
      return;
    }
    if (phase === 'summary' || phase === 'reveal') {
      // 从结果态直接再按：允许（练习/还有机会时），先收面板
    }
    ensureAudio();
    holdSource = source;
    holdT0 = performance.now();
    // 超时保险丝：目标最长 12s，按住超过 60s 只可能是挂机/指针卡死，主动作废
    if (holdTimeout) clearTimeout(holdTimeout);
    holdTimeout = setTimeout(function () {
      cancelHold('按了 60 秒 · 这次不算');
    }, core.MAX_HOLD_MS + 500);
    setPhase('holding');
    setNeedle(0); // 按住时秒针隐藏（CSS opacity），归零待回摆
    vibrate(15);
    blip(2100, 18, 0.04);
    stopDistortion();
    if (distortionOn()) distortionTimer = setTimeout(scheduleDistortionTick, 500 + Math.random() * 700);
  }

  function cancelHold(msg) {
    if (phase !== 'holding') return;
    stopDistortion();
    if (holdTimeout) { clearTimeout(holdTimeout); holdTimeout = null; }
    holdPointerId = null; holdSource = null;
    setPhase('idle');
    renderHint();
    if (msg) toast(msg);
  }

  function endHold() {
    if (phase !== 'holding') return;
    var heldMs = performance.now() - holdT0;
    stopDistortion();
    if (holdTimeout) { clearTimeout(holdTimeout); holdTimeout = null; }
    holdPointerId = null; holdSource = null;
    vibrate(30);
    blip(1300, 26, 0.04);
    if (heldMs < core.MIN_HOLD_MS) {
      setPhase('idle');
      renderHint();
      toast('太短了 · 不计入');
      return;
    }
    if (heldMs > core.MAX_HOLD_MS) {
      setPhase('idle');
      renderHint();
      toast('按了 60 秒 · 这次不算');
      return;
    }
    resolveAttempt(heldMs);
  }

  function resolveAttempt(heldMs) {
    var targetMs = currentTargetMs();
    var res = core.judge(targetMs, heldMs);
    lastResult = res;
    var star = distortionOn();
    var attemptNo;

    if (mode === 'daily') {
      var rec = todayRec();
      rec.attempts.push({
        heldMs: Math.round(heldMs), errMs: res.errMs, signedMs: res.signedMs, star: star
      });
      rec.bestErrMs = core.bestOf(rec.attempts).errMs;
      if (rec.attempts.length >= core.DAILY_ATTEMPTS) rec.done = true;
      attemptNo = rec.attempts.length;
      saveState();
    } else {
      practiceCount++;
      attemptNo = practiceCount;
    }
    showReveal(res, heldMs, star, attemptNo);
  }

  function showReveal(res, heldMs, star, attemptNo) {
    // 秒针回摆指向误差（提前=左，拖后=右，±0.5s 封顶 ±90°）
    setNeedle(core.errAngleDeg(res.signedMs));

    el.rAttemptLabel.textContent = (mode === 'daily' ? '第 ' + attemptNo + ' 次' : '练习 · 第 ' + attemptNo + ' 次');
    el.rModeLabel.textContent = star ? '干扰模式 ★' : '';
    el.rTarget.textContent = core.formatSec(currentTargetMs()) + 's';
    el.rHeld.textContent = core.formatSec(heldMs, 3) + 's';
    el.rErr.textContent = core.formatSec(res.errMs, 3);
    el.rDir.textContent = res.signedMs === 0 ? '分毫不差'
      : res.signedMs < 0 ? '数快了 · 提前 ' + res.errMs + ' 毫秒'
      : '数慢了 · 拖后 ' + res.errMs + ' 毫秒';
    el.rTierMark.textContent = res.tier.mark + ' ';
    el.rTier.textContent = res.tier.name;
    el.rStar.hidden = !star;

    if (mode === 'daily') {
      el.btnNext.textContent = canPlayDaily()
        ? '下一次 · 还剩 ' + (allowedAttempts(todayRec()) - todayRec().attempts.length) + ' 次'
        : '查看结算';
    } else {
      el.btnNext.textContent = '再来 · 换个目标';
    }

    renderAttempts();
    renderHeader();
    renderHint(); // 表盘下提示与剩余次数同步（否则揭晓后仍显示旧文案）
    // 重启入场动画（表针回摆式）
    el.resultPanel.classList.remove('reveal');
    void el.resultPanel.offsetWidth;
    el.resultPanel.classList.add('reveal');
    setPhase('reveal');
    scrollIntoViewSoft(el.resultPanel); // 揭晓瞬间必须在视野内
  }

  /* ================= 当日结算 ================= */
  function showSummary() {
    var rec = todayRec();
    if (rec.attempts.length === 0) { setPhase('idle'); return; }
    var best = core.bestOf(rec.attempts);
    var tier = core.gradeError(best.errMs);
    el.sIssue.textContent = '#' + core.issueNumber(dayIndex);
    el.sErr.textContent = core.formatSec(best.errMs, 3);
    el.sTierMark.textContent = tier.mark + ' ';
    el.sTier.textContent = tier.name;
    el.sStar.hidden = !best.star;
    el.sSquares.textContent = core.squares(rec.attempts);
    var streak = core.computeStreak(state.days, dayIndex);
    el.sStreak.textContent = best.errMs <= core.STREAK_KEEP_MS
      ? '守时 ✓ · 连胜 ' + streak + ' 天'
      : '超 0.2s · 未守时，连胜清零';
    setNeedle(core.errAngleDeg(best.signedMs || 0));

    // 激励视频挂点按钮状态：加时每天限 1 次；解锁只需一次
    el.btnAdRetry.hidden = (rec.extra || 0) >= 1;
    el.btnAdDistortion.hidden = state.settings.distortionUnlocked === true;

    renderHint(); // 已锁定态下提示词同步为「今日三次已用完」
    setPhase('summary');
    startCountdown();
    scrollIntoViewSoft(el.summaryPanel);
  }

  function startCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    var tick = function () {
      var now = nowMs();
      var tz = new Date(now).getTimezoneOffset() * 60000;
      var nextMidnight = (core.localDayIndex(now) + 1) * 86400000 + tz;
      var left = Math.max(0, nextMidnight - now);
      var s = Math.floor(left / 1000);
      var p = function (n) { return (n < 10 ? '0' : '') + n; };
      el.countdown.textContent = p(Math.floor(s / 3600)) + ':' + p(Math.floor(s / 60) % 60) + ':' + p(s % 60);
      if (left <= 0) checkDay();
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  /* ================= 分享 ================= */
  function buildShareText() {
    var rec = todayRec();
    var best = core.bestOf(rec.attempts);
    if (!best) return '';
    return core.shareText({
      issueNo: core.issueNumber(dayIndex),
      targetMs: core.targetMsForDay(dayIndex),
      bestErrMs: best.errMs,
      attempts: rec.attempts,
      star: best.star,
      streak: core.computeStreak(state.days, dayIndex),
      domain: DOMAIN
    });
  }

  function copyShareText() {
    var txt = buildShareText();
    if (!txt) return;
    var done = function () { toast('战报已复制 · 去群里落座'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () { legacyCopy(txt); done(); });
    } else { legacyCopy(txt); done(); }
  }
  function legacyCopy(txt) {
    try {
      var ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) {}
  }

  /* 分享 PNG：表盘意象 + 巨大误差数字 + 称号 + 期号 + 域名（1000×1250） */
  function buildShareCanvas() {
    var rec = todayRec();
    var best = core.bestOf(rec.attempts);
    var c = document.createElement('canvas');
    c.width = 1000; c.height = 1250;
    var ctx = c.getContext('2d');
    var FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    ctx.fillStyle = '#2b2d31';
    ctx.fillRect(0, 0, 1000, 1250);

    // 头部
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 44px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText('体内时钟', 64, 96);
    ctx.fillStyle = '#94969c';
    ctx.font = '400 24px ' + FONT;
    ctx.fillText('B O D Y   C L O C K', 64, 132);
    ctx.textAlign = 'right';
    ctx.font = '400 28px ' + FONT;
    ctx.fillText('第 ' + core.issueNumber(dayIndex) + ' 期 · ' + fmtDate(nowMs()), 936, 100);

    // 表盘
    var cx = 500, cy = 470, R = 285;
    ctx.fillStyle = '#e9e7e2';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2b2d31'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, R - 6, 0, Math.PI * 2); ctx.stroke();
    for (var i = 0; i < 60; i++) {
      var major = i % 5 === 0;
      var a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      var r1 = major ? R - 40 : R - 26, r2 = R - 14;
      ctx.strokeStyle = major ? 'rgba(43,45,49,0.85)' : 'rgba(43,45,49,0.35)';
      ctx.lineWidth = major ? 5 : 2.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    // 朱红秒针指向误差
    var deg = core.errAngleDeg(best ? (best.signedMs || 0) : 0);
    var rad = (deg - 90) * Math.PI / 180;
    ctx.strokeStyle = '#c8372d'; ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(rad) * 60, cy - Math.sin(rad) * 60);
    ctx.lineTo(cx + Math.cos(rad) * (R - 52), cy + Math.sin(rad) * (R - 52));
    ctx.stroke();
    ctx.fillStyle = '#2b2d31';
    ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e9e7e2';
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    // 表盘内目标
    ctx.fillStyle = '#5b5e64';
    ctx.font = '400 30px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('目标 ' + core.formatSec(core.targetMsForDay(dayIndex)) + 's', cx, cy + 120);

    // 巨大误差数字
    ctx.fillStyle = '#94969c';
    ctx.font = '400 26px ' + FONT;
    ctx.fillText('误 差  D E V I A T I O N', 500, 850);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 168px ' + FONT;
    var errStr = best ? core.formatSec(best.errMs, 3) : '-';
    var errW = ctx.measureText(errStr).width;
    ctx.fillText(errStr, 480, 1000);
    ctx.fillStyle = '#94969c';
    ctx.font = '400 44px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText('s', 480 + errW / 2 + 18, 1000);

    // 称号
    var tier = core.gradeError(best ? best.errMs : 99999);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e9e7e2';
    ctx.font = '700 56px ' + FONT;
    ctx.fillText(tier.name + (best && best.star ? ' ★' : ''), 500, 1088);

    // 三次尝试小方格
    var sq = rec.attempts;
    var w = 44, gap = 16, x0 = 500 - (sq.length * w + (sq.length - 1) * gap) / 2;
    for (var j = 0; j < sq.length; j++) {
      var e = sq[j].errMs;
      ctx.fillStyle = e <= 80 ? '#3f7350' : e <= 200 ? '#a8811f' : '#b23a2e';
      ctx.fillRect(x0 + j * (w + gap), 1118, w, w);
    }

    // 底部域名
    ctx.fillStyle = '#94969c';
    ctx.font = '400 28px ' + FONT;
    ctx.fillText(DOMAIN, 500, 1216);
    return c;
  }

  function savePng() {
    try {
      var c = buildShareCanvas();
      var a = document.createElement('a');
      a.download = 'bodyclock-' + core.issueNumber(dayIndex) + '.png';
      a.href = c.toDataURL('image/png');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast('图片已生成');
    } catch (e) {
      toast('生成失败 · 请截屏分享');
    }
  }

  /* ================= 激励视频（占位） =================
   * slot: 'retry'      —— 再来一次机会（今日 +1 次，每天限 1 次）
   *       'distortion' —— 解锁干扰模式，★ 成绩从此可用
   * 正式接入（对照 wechat-minigame/adapter.js 的 createRewardedVideo）：
   *   微信小游戏  wx.createRewardedVideoAd({ adUnitId: '...' })
   *               ad.onClose(res => { if (res && res.isEnded) grantReward(slot) })
   *   抖音小游戏  tt.createRewardedVideoAd({ adUnitId: '...' })，API 同构
   *   Web (H5)    Google H5 Games Ads: adBreak({ type: 'reward', ... })
   * 占位行为：弹说明浮层，「模拟看完」等价 isEnded === true。看完才发奖，中途关闭不发。
   */
  function showRewardedAd(slot) {
    adSlot = slot;
    el.adDesc.textContent = slot === 'retry'
      ? '看完一条视频，今天多一次机会（每天限一次）。'
      : '看完一条视频，永久解锁干扰模式。开着它打出的成绩带 ★。';
    el.adModal.hidden = false;
    el.btnAdMock.focus();
  }
  function grantReward(slot) {
    if (slot === 'retry') {
      var rec = todayRec();
      rec.extra = (rec.extra || 0) + 1;
      saveState();
      renderAll();
      setPhase('idle');
      toast('多一次机会 · 稳住');
    } else if (slot === 'distortion') {
      state.settings.distortionUnlocked = true;
      state.settings.distortion = true;
      saveState();
      renderAll();
      toast('干扰模式已解锁 · 已开启');
      if (phase === 'summary') showSummary();
    }
  }

  /* ================= 跨天检测 ================= */
  function checkDay() {
    var nd = core.localDayIndex(nowMs());
    if (nd === dayIndex) return;
    cancelHold('跨零点了 · 这次不算'); // 非按住态下 cancelHold 是空操作，无副作用
    dayIndex = nd;
    state = core.normalizeState(state, dayIndex); // 顺手剪掉过期记录
    saveState();
    lastResult = null;
    setNeedle(0);
    renderAll();
    if (mode === 'daily' && !canPlayDaily()) showSummary();
    else setPhase('idle');
  }

  /* ================= 事件绑定 ================= */
  el.dial.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (phase === 'holding') return;
    holdPointerId = e.pointerId;
    try { el.dial.setPointerCapture(e.pointerId); } catch (err) {}
    startHold('pointer');
  });
  el.dial.addEventListener('pointerup', function (e) {
    if (holdSource !== 'pointer' || e.pointerId !== holdPointerId) return;
    e.preventDefault();
    endHold();
  });
  el.dial.addEventListener('pointercancel', function () {
    if (holdSource === 'pointer') cancelHold('中断了 · 这次不算');
  });
  el.dial.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  el.dial.addEventListener('keydown', function (e) {
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    e.preventDefault();
    if (e.repeat || phase === 'holding') return;
    startHold('key');
  });
  el.dial.addEventListener('keyup', function (e) {
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    if (holdSource === 'key') endHold();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && phase === 'holding') cancelHold('切走了 · 这次不算');
    if (!document.hidden) checkDay();
  });

  el.btnNext.addEventListener('click', function () {
    if (mode === 'daily') {
      if (canPlayDaily()) { setPhase('idle'); renderHint(); }
      else showSummary();
    } else {
      practiceTargetMs = rollPracticeTarget();
      renderTarget();
      setPhase('idle');
      renderHint();
    }
  });

  function switchMode(m) {
    if (mode === m || phase === 'holding') return;
    mode = m;
    lastResult = null;
    setNeedle(0);
    renderAll();
    if (m === 'daily' && !canPlayDaily()) showSummary();
    else setPhase('idle');
  }
  el.tabDaily.addEventListener('click', function () { switchMode('daily'); });
  el.tabPractice.addEventListener('click', function () { switchMode('practice'); });

  el.btnCopy.addEventListener('click', copyShareText);
  el.btnPng.addEventListener('click', savePng);
  el.btnAdRetry.addEventListener('click', function () { showRewardedAd('retry'); });
  el.btnAdDistortion.addEventListener('click', function () { showRewardedAd('distortion'); });
  el.btnAdMock.addEventListener('click', function () {
    el.adModal.hidden = true;
    grantReward(adSlot);
    adSlot = null;
  });
  el.btnAdClose.addEventListener('click', function () { el.adModal.hidden = true; adSlot = null; });

  el.btnSettings.addEventListener('click', function () { el.settingsModal.hidden = false; });
  el.btnSettingsClose.addEventListener('click', function () { el.settingsModal.hidden = true; });
  [el.settingsModal, el.adModal].forEach(function (m) {
    m.addEventListener('click', function (e) { if (e.target === m) m.hidden = true; });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { el.settingsModal.hidden = true; el.adModal.hidden = true; }
  });

  el.toggleDistortion.addEventListener('click', function () {
    if (!state.settings.distortionUnlocked) {
      el.settingsModal.hidden = true;
      showRewardedAd('distortion');
      return;
    }
    state.settings.distortion = !state.settings.distortion;
    saveState();
    renderAll();
  });
  el.toggleSound.addEventListener('click', function () {
    state.settings.sound = state.settings.sound === false;
    saveState();
    renderAll();
  });

  setInterval(checkDay, 30000);

  /* ================= 测试钩子 ================= */
  window.__bc = {
    version: core.VERSION,
    state: function () {
      var rec = todayRec();
      return {
        mode: mode, phase: phase, dayIndex: dayIndex,
        issueNo: core.issueNumber(dayIndex),
        targetMs: currentTargetMs(),
        attempts: rec.attempts.slice(),
        attemptCount: rec.attempts.length,
        allowed: allowedAttempts(rec),
        done: rec.done,
        bestErrMs: rec.bestErrMs,
        streak: core.computeStreak(state.days, dayIndex),
        distortion: distortionOn(),
        lastErrMs: lastResult ? lastResult.errMs : null,
        lastTier: lastResult ? lastResult.tier.name : null
      };
    },
    setNow: function (ms) { window.__BC_NOW__ = ms; checkDay(); renderHeader(); },
    shareText: buildShareText,
    sharePngDataUrl: function () { return buildShareCanvas().toDataURL('image/png'); }
  };

  /* ================= 启动 ================= */
  renderAll();
  if (mode === 'daily' && !canPlayDaily()) showSummary();
})();
