/* Flatline — 每日镇定监护
   纯静态零依赖。数值唯一事实源见 PLAYBOOK.md §3。 */
'use strict';
(function () {

  // ---------------------------------------------------------------- utils
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const $ = (id) => document.getElementById(id);

  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  function fmtDate(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  // ---------------------------------------------------------------- config
  const DOMAIN = 'flatline.day';
  const EPOCH_DAY = 20635;            // 2026-07-01 => #1
  const TOTAL = 14;
  const PHASES = [
    { name: 'P1 平稳', tapDur: 3000, holdLen: 1500, waitDur: 2600, gap: 500, shake: 0,   distract: 0 },
    { name: 'P2 施压', tapDur: 2600, holdLen: 1300, waitDur: 2400, gap: 420, shake: 1.6, distract: 1 },
    { name: 'P3 暴走', tapDur: 2100, holdLen: 1100, waitDur: 2000, gap: 320, shake: 3,   distract: 3 },
  ];
  const phaseOf = (i) => (i < 5 ? 0 : i < 10 ? 1 : 2);
  const REDUCED = typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  function todayIdx() {
    return Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  }

  // ---------------------------------------------------------------- storage
  const KEY = 'flatline.v1';
  const intOr = (v, d) => (Number.isFinite(v) ? Math.round(v) : d);
  function defaultStore() {
    return { v: 1, sound: true, streak: 0, bestStreak: 0, bestCalm: 0, lastDay: null, lastResult: null, history: [] };
  }
  function validResult(r) {
    return !!r && typeof r === 'object' && Number.isInteger(r.day) &&
      Number.isFinite(r.calm) && typeof r.status === 'string' && Array.isArray(r.scores) &&
      typeof r.date === 'string' &&
      (r.status !== 'CODEBLUE' || Number.isInteger(r.failBeat)); // 防损坏档案把 undefined 画上分享卡
  }
  function loadStore() {
    const d = defaultStore();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return d;
      const o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return d;
      d.sound = o.sound !== false;
      d.streak = intOr(o.streak, 0);
      d.bestStreak = intOr(o.bestStreak, 0);
      d.bestCalm = intOr(o.bestCalm, 0);
      d.lastDay = Number.isInteger(o.lastDay) ? o.lastDay : null;
      d.lastResult = validResult(o.lastResult) ? o.lastResult : null;
      d.history = Array.isArray(o.history) ? o.history.filter(validResult).slice(-30) : [];
      return d;
    } catch (e) { return defaultStore(); }
  }
  function saveStore() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 存不了就算了 */ }
  }
  let store = loadStore();

  // ---------------------------------------------------------------- beat defs
  function genDefs(seed) {
    const rnd = mulberry32((seed >>> 0) ^ 0x9e3779b9);
    const g1 = shuffle(['TAP', 'TAP', 'HOLD', rnd() < 0.3 ? 'WAIT' : 'TAP'], rnd);
    if (g1[0] === 'WAIT') {                       // 拍2 不许是 WAIT
      const j = g1.findIndex((t) => t !== 'WAIT');
      const t = g1[0]; g1[0] = g1[j]; g1[j] = t;
    }
    const g2 = shuffle(['WAIT', 'WAIT', 'HOLD', 'TAP', 'TAP'], rnd);
    const g3 = shuffle(['WAIT', 'HOLD', 'TAP', 'TAP'], rnd);
    const types = ['TAP'].concat(g1, g2, g3);
    const FAKES = ['点!!', 'TAP!', 'NOW', '快!'];
    return types.map((t, i) => {
      const ph = phaseOf(i), P = PHASES[ph];
      const def = { i: i, type: t, phase: ph, gap: P.gap };
      if (t === 'TAP') {
        def.dur = i === 0 ? 4200 : P.tapDur;
        def.frac = i === 0 ? 0.62 : 0.58 + rnd() * 0.16;
      } else if (t === 'HOLD') {
        def.hold = P.holdLen + Math.round((rnd() * 2 - 1) * 100);
      } else {
        def.dur = P.waitDur;
        def.fake = FAKES[Math.floor(rnd() * FAKES.length)];
      }
      return def;
    });
  }

  // ---------------------------------------------------------------- scoring (PLAYBOOK §3.3)
  function scoreTap(b) {
    let base;
    if (b.pressAt == null) base = 4;
    else {
      const err = Math.abs(b.pressAt - b.targetAt);
      base = err <= 70 ? 100 : Math.max(6, Math.round(100 - (err - 70) * 0.21));
    }
    return clamp(base - 12 * Math.min(4, b.extra), 0, 100);
  }
  function scoreHold(b) {
    if (b.pressAt == null) return 5;
    let p = 0;
    p += Math.min(35, Math.max(0, (b.pressAt - b.cueAt) - 450) * 0.08);
    const errR = b.releasedAt != null ? Math.abs(b.releasedAt - b.releaseTargetAt) : 700;
    p += Math.min(55, Math.max(0, errR - 120) * 0.15);
    if (b.releasedAt != null && b.releasedAt < b.releaseTargetAt - 350) p += 10;
    p += 15 * Math.min(2, b.jitter) + 12 * Math.min(2, b.pre);
    return clamp(Math.round(100 - p), 0, 100);
  }
  function scoreWait(b) {
    return b.presses === 0 ? 100 : Math.max(0, 8 - 4 * (b.presses - 1));
  }
  function verdictFor(b, score) {
    if (b.def.type === 'WAIT') return b.presses === 0 ? '忍住了' : '上当';
    if (score >= 85) return b.def.i === 0 ? '就是这样' : '稳';
    if (score >= 60) return '微颤';
    if (score >= 30) return '手抖';
    return '失控';
  }

  // ---------------------------------------------------------------- audio (WebAudio 合成)
  const SND = {
    ctx: null, master: null, enabled: store.sound !== false,
    ensure() {
      if (!this.ctx) {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.5;
          this.master.connect(this.ctx.destination);
        } catch (e) { this.ctx = null; }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    },
    ok() { return this.enabled && this.ctx; },
    tone(freq, dur, type, gain, at, slideTo) {
      if (!this.ok()) return;
      try {
        const t0 = this.ctx.currentTime + (at || 0);
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, t0);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(this.master);
        o.start(t0); o.stop(t0 + dur + 0.05);
      } catch (e) { /* 声音失败不致命 */ }
    },
    heartbeat(loud) {
      const g = loud ? 0.28 : 0.22;
      this.tone(62, 0.09, 'sine', g, 0, 40);
      this.tone(54, 0.09, 'sine', g * 0.8, 0.12, 38);
    },
    hit(perfect) {
      this.tone(880, 0.06, 'square', 0.07);
      if (perfect) this.tone(1320, 0.05, 'square', 0.05, 0.05);
    },
    err() { this.tone(110, 0.16, 'sawtooth', 0.09); },
    trap() { this.tone(96, 0.22, 'sawtooth', 0.12); this.tone(72, 0.2, 'square', 0.08, 0.05); },
    alarm() { for (let k = 0; k < 3; k++) this.tone(740, 0.6, 'square', 0.06, k * 0.75); },
    rest() { this.tone(660, 0.12, 'sine', 0.1); this.tone(880, 0.12, 'sine', 0.1, 0.14); },
  };

  // ---------------------------------------------------------------- ECG live renderer
  const ECG = {
    cv: null, ctx: null, w: 0, h: 0, dpr: 1,
    x: 0, lastY: null, lastT: 0, mode: 'run', tension: 0.12,
    bpm: 62, nextPulseAt: 0, impulses: [],
    init(cv) {
      this.cv = cv; this.ctx = cv.getContext('2d');
      this.resize();
      this.lastT = performance.now();
      this.nextPulseAt = this.lastT + 400;
    },
    resize() {
      const r = this.cv.getBoundingClientRect();
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.w = Math.max(1, Math.round(r.width));
      this.h = Math.max(1, Math.round(r.height));
      this.cv.width = this.w * this.dpr;
      this.cv.height = this.h * this.dpr;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.ctx.clearRect(0, 0, this.w, this.h);
      this.x = 0; this.lastY = null;
    },
    push(kind, amp, red) {
      this.impulses.push({ t0: performance.now(), kind: kind, amp: amp || 1, red: !!red });
    },
    shape(imp, dt) {
      const A = this.h * 0.30 * imp.amp;
      if (imp.kind === 'qrs') {
        if (dt < 36) return A * 0.10 * Math.sin(Math.PI * dt / 36);
        if (dt < 96) return -A * Math.sin(Math.PI * (dt - 36) / 60);
        if (dt < 150) return A * 0.28 * Math.sin(Math.PI * (dt - 96) / 54);
        if (dt >= 190 && dt < 330) return -A * 0.16 * Math.sin(Math.PI * (dt - 190) / 140);
        return 0;
      }
      if (imp.kind === 'spike') {
        if (dt < 60) return -A * 1.4 * (dt / 60);
        if (dt < 140) return -A * 1.4 * (1 - (dt - 60) / 80);
        if (dt < 200) return A * 0.5 * Math.sin(Math.PI * (dt - 140) / 60);
        return 0;
      }
      // blip
      if (dt < 90) return -A * 0.35 * Math.sin(Math.PI * dt / 90);
      return 0;
    },
    sample(t) {
      const base = this.h * 0.62;
      if (this.mode === 'flat') {
        return { y: base + (Math.random() - 0.5) * 0.6, red: false };
      }
      let y = base + (Math.random() - 0.5) * (1 + this.tension * this.h * 0.05);
      let red = false;
      for (let i = 0; i < this.impulses.length; i++) {
        const imp = this.impulses[i];
        const dt = t - imp.t0;
        if (dt >= 0 && dt < 400) {
          y += this.shape(imp, dt);
          if (imp.red && dt < 220) red = true;
        }
      }
      return { y: clamp(y, 3, this.h - 3), red: red };
    },
    draw(now) {
      const ctx = this.ctx;
      let dt = now - this.lastT;
      this.lastT = now;
      if (dt <= 0) return;
      // 磷光余晖：整体淡出
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalCompositeOperation = 'source-over';
      // 扫描头前方的擦除带：根治低透明度残影（destination-out 取整会卡住）
      const gap = 26;
      ctx.clearRect(this.x + 3, 0, gap, this.h);
      if (this.x + 3 + gap > this.w) ctx.clearRect(0, 0, this.x + 3 + gap - this.w, this.h);
      if (this.mode === 'run' && this.bpm > 0) {
        if (this.nextPulseAt < now - 1500) this.nextPulseAt = now + 300; // 长暂停后重新对齐
        while (now >= this.nextPulseAt) {
          this.impulses.push({ t0: this.nextPulseAt, kind: 'qrs', amp: 1, red: false });
          this.nextPulseAt += 60000 / this.bpm;
        }
      }
      // 清理过期脉冲
      this.impulses = this.impulses.filter((imp) => now - imp.t0 < 500);
      if (dt > 120) { // 后台切回：跳笔不连线
        this.x = (this.x + (dt * this.w) / 7000) % this.w;
        this.lastY = null;
        return;
      }
      const speed = this.w / 7000; // 全屏 7s
      const steps = clamp(Math.ceil(dt / 4), 1, 14);
      let px = this.x, py = this.lastY, pt = now - dt;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let s = 1; s <= steps; s++) {
        const t = pt + (dt * s) / steps;
        let nx = this.x + speed * (t - (now - dt));
        const smp = this.sample(t);
        if (nx >= this.w) { nx -= this.w; px = nx; py = smp.y; continue; }
        if (py != null) {
          ctx.strokeStyle = smp.red ? '#ff3b4e' : '#2fff9e';
          ctx.shadowColor = ctx.strokeStyle;
          ctx.shadowBlur = 7;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(nx, smp.y);
          ctx.stroke();
        }
        px = nx; py = smp.y;
      }
      ctx.shadowBlur = 0;
      this.x = px; this.lastY = py;
    },
  };

  // ---------------------------------------------------------------- 结果波形（结算屏 / 分享图共用）
  function drawWave(ctx, W, H, scores, seed, opt) {
    opt = opt || {};
    const padX = opt.padX != null ? opt.padX : 8;
    const base = H * 0.60;
    const slotW = (W - padX * 2) / TOTAL;
    const lw = opt.lineWidth || 2;
    for (let i = 0; i < TOTAL; i++) {
      const s = i < scores.length ? scores[i] : null;
      const x0 = padX + i * slotW;
      const rr = mulberry32((seed >>> 0) * 31 + i * 7 + 1);
      let pts;
      let crashed = false;
      if (s == null) {
        pts = [[1, 0]];
      } else {
        crashed = s < 30;
        const amp = (100 - s) / 100;
        const peak = crashed ? (0.42 + 0.10 * rr()) * H : (0.07 + 0.32 * amp) * H;
        if (crashed) {
          pts = [[0.10, 0], [0.20, -0.14], [0.32, 1], [0.42, -0.34], [0.52, 0.62],
                 [0.60, -0.2], [0.70, 0.3], [0.80, -0.08], [1, 0]].map((p) => [p[0], p[1] * peak]);
        } else {
          pts = [[0.18, 0], [0.30, -0.10], [0.42, 1], [0.52, -0.26], [0.60, 0]];
          if (s < 85) {
            pts.push([0.68, 0.30 * amp], [0.74, -0.22 * amp], [0.80, 0.12 * amp]);
          } else {
            pts.push([0.76, 0.14]); // T 波
          }
          pts.push([0.90, 0.04 * (rr() - 0.5)], [1, 0]);
          pts = pts.map((p) => [p[0], p[1] * peak]);
        }
      }
      ctx.strokeStyle = crashed ? '#ff3b4e' : (s == null ? 'rgba(47,255,158,0.5)' : '#2fff9e');
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = opt.glow != null ? opt.glow : 10;
      ctx.lineWidth = lw;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, base);
      for (let k = 0; k < pts.length; k++) {
        ctx.lineTo(x0 + pts[k][0] * slotW, clamp(base - pts[k][1], lw, H - lw));
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  // ---------------------------------------------------------------- 分享
  function waveEmoji(scores) {
    const out = [];
    for (let i = 0; i < TOTAL; i++) {
      const s = i < scores.length ? scores[i] : null;
      if (s == null || s >= 85) out.push('▁');
      else if (s >= 70) out.push('▂');
      else if (s >= 55) out.push('▃');
      else if (s >= 40) out.push('▄');
      else if (s >= 30) out.push('▆');
      else out.push('█');
    }
    return out.join('');
  }
  function statusLabel(res) {
    if (res.status === 'MASTER') return '🫀 FLATLINE MASTER';
    if (res.status === 'CODEBLUE') return '⚠ CODE BLUE · 第' + res.failBeat + '拍';
    return '🫀 RESTING';
  }
  function buildShareText(res) {
    const head = res.mode === 'practice' ? 'Flatline 练习' : 'Flatline #' + res.issue;
    return head + '\n' + waveEmoji(res.scores) + '\n' +
      '镇定指数 ' + res.calm + '/100 · ' + statusLabel(res) + '\n' + DOMAIN;
  }

  function drawStampIcon(ctx, x, y, size, kind) {
    ctx.save();
    ctx.lineWidth = size * 0.11;
    ctx.lineJoin = 'round';
    if (kind === 'warn') { // ⚠ 三角
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.5);
      ctx.lineTo(x + size * 0.55, y + size * 0.45);
      ctx.lineTo(x - size * 0.55, y + size * 0.45);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.16);
      ctx.lineTo(x, y + size * 0.12);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y + size * 0.28, size * 0.055, 0, Math.PI * 2);
      ctx.fill();
    } else { // 🫀 心
      ctx.beginPath();
      const s = size * 0.5;
      ctx.moveTo(x, y + s * 0.85);
      ctx.bezierCurveTo(x - s * 1.3, y - s * 0.1, x - s * 0.62, y - s * 0.95, x, y - s * 0.28);
      ctx.bezierCurveTo(x + s * 0.62, y - s * 0.95, x + s * 1.3, y - s * 0.1, x, y + s * 0.85);
      ctx.fill();
    }
    ctx.restore();
  }

  function buildShareCanvas(res) {
    const W = 1200, H = 630;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const MONO = 'ui-monospace, Menlo, Consolas, monospace';
    const green = '#2fff9e', red = '#ff3b4e', dim = 'rgba(191,232,210,0.5)';
    ctx.fillStyle = '#05080a';
    ctx.fillRect(0, 0, W, H);
    // 网格
    ctx.strokeStyle = 'rgba(47,255,158,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 30) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
    // 头部
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = green;
    ctx.font = '700 42px ' + MONO;
    try { ctx.letterSpacing = '14px'; } catch (e) { /* 老浏览器 */ }
    ctx.fillText('FLATLINE', 64, 96);
    try { ctx.letterSpacing = '0px'; } catch (e) { /* noop */ }
    ctx.fillStyle = dim;
    ctx.font = '24px ' + MONO;
    const headTag = res.mode === 'practice' ? '练习 · ' + res.date : '#' + res.issue + ' · ' + res.date;
    ctx.fillText(headTag, 64, 132);
    // 状态戳（右上，-4° 描边章）
    const isBlue = res.status === 'CODEBLUE';
    const isMaster = res.status === 'MASTER';
    const stampColor = isBlue ? red : (isMaster ? '#ffb454' : green);
    const stampText = isBlue ? 'CODE BLUE · 第' + res.failBeat + '拍' : (isMaster ? 'FLATLINE MASTER' : 'RESTING');
    ctx.save();
    ctx.font = '700 30px ' + MONO;
    const tw = ctx.measureText(stampText).width;
    const bw = tw + 96, bh = 66;
    ctx.translate(W - 72 - bw / 2, 96);
    ctx.rotate(-4 * Math.PI / 180);
    ctx.strokeStyle = stampColor;
    ctx.fillStyle = stampColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
    drawStampIcon(ctx, -bw / 2 + 36, 0, 30, isBlue ? 'warn' : 'heart');
    ctx.textBaseline = 'middle';
    ctx.fillText(stampText, -bw / 2 + 66, 2);
    ctx.restore();
    // 中央波形
    ctx.save();
    ctx.translate(60, 180);
    drawWave(ctx, W - 120, 260, res.scores, res.seed, { padX: 6, lineWidth: 4, glow: 18 });
    // 崩拍标注
    if (isBlue && res.failBeat >= 1) {
      const slotW = (W - 120 - 12) / TOTAL;
      const x = 6 + (res.failBeat - 0.5) * slotW;
      ctx.fillStyle = red;
      ctx.font = '700 22px ' + MONO;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('▼ 第' + res.failBeat + '拍', x, 24);
    }
    ctx.restore();
    // 底部
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = dim;
    ctx.font = '22px ' + MONO;
    ctx.fillText('镇定指数', 64, 512);
    ctx.fillStyle = isBlue ? red : green;
    ctx.font = '700 88px ' + MONO;
    ctx.fillText(String(res.calm), 64, 590);
    const nw = ctx.measureText(String(res.calm)).width;
    ctx.fillStyle = dim;
    ctx.font = '30px ' + MONO;
    ctx.fillText('/100', 70 + nw, 590);
    ctx.textAlign = 'right';
    ctx.font = '26px ' + MONO;
    ctx.fillText(DOMAIN, W - 64, 582);
    ctx.textAlign = 'left';
    // 扫描线
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    return cv;
  }

  // ---------------------------------------------------------------- DOM refs
  const el = {
    monitor: $('monitor'), stage: $('stage'),
    issueTag: $('issueTag'), beatCounter: $('beatCounter'), muteBtn: $('muteBtn'),
    bpmVal: $('bpmVal'), spo2Val: $('spo2Val'), calmVal: $('calmVal'),
    scrStart: $('scrStart'), scrGame: $('scrGame'), scrResult: $('scrResult'),
    startDate: $('startDate'), startIssue: $('startIssue'), streakLine: $('streakLine'),
    startFresh: $('startFresh'), startDone: $('startDone'), miniWave: $('miniWave'),
    doneStamp: $('doneStamp'), doneCalm: $('doneCalm'),
    cueTap: $('cueTap'), tapZone: $('tapZone'), tapTarget: $('tapTarget'), tapCursor: $('tapCursor'),
    cueHold: $('cueHold'), holdLabel: $('holdLabel'), holdFill: $('holdFill'),
    cueWait: $('cueWait'), waitFake: $('waitFake'),
    verdict: $('verdict'), hint: $('hint'), distractLayer: $('distractLayer'),
    resultHead: $('resultHead'), resultWave: $('resultWave'), stamp: $('stamp'),
    calmIndex: $('calmIndex'), resultSub: $('resultSub'),
    copyBtn: $('copyBtn'), pngBtn: $('pngBtn'), practiceBtn: $('practiceBtn'),
    copyBtn2: $('copyBtn2'), pngBtn2: $('pngBtn2'), practiceBtn2: $('practiceBtn2'),
    countdown: $('countdown'), countdown2: $('countdown2'), countdownRow: $('countdownRow'),
    phaseLabel: $('phaseLabel'), flash: $('flash'),
  };

  // ---------------------------------------------------------------- game state
  const S = {
    screen: 'start',
    game: null,          // {mode, seed, day, issue, defs, idx, scores, beat, gapUntil, locked, status, failBeat}
    lastResult: null,    // 本次会话最近一局（daily 或 practice）
    stripW: 0,
  };

  function issueOf(day) { return day - EPOCH_DAY + 1; }

  function setScreen(name) {
    S.screen = name;
    el.scrStart.hidden = name !== 'start';
    el.scrGame.hidden = name !== 'game';
    el.scrResult.hidden = name !== 'result';
  }

  function flashFx(cls) {
    if (REDUCED) return;
    el.flash.className = 'flash';
    void el.flash.offsetWidth;
    el.flash.className = 'flash ' + cls;
  }

  function showVerdict(text, tier) {
    el.verdict.textContent = text;
    el.verdict.className = 'verdict' + (tier === 'bad' ? ' bad' : tier === 'mid' ? ' mid' : '');
    void el.verdict.offsetWidth;
    el.verdict.classList.add('show');
  }

  // ---------------------------------------------------------------- run control
  function startRun(mode) {
    const day = todayIdx();
    const seed = mode === 'daily' ? day : (day * 131 + Math.floor(Math.random() * 1e6) + 7);
    S.game = {
      mode: mode, seed: seed, day: day,
      issue: issueOf(day),
      defs: genDefs(seed),
      idx: -1, scores: [], beat: null,
      gapUntil: performance.now() + 700, // 开机过场
      locked: false, status: null, failBeat: null,
    };
    el.issueTag.textContent = mode === 'daily' ? '#' + S.game.issue : '练习';
    el.beatCounter.textContent = '开始监护';
    el.calmVal.textContent = '--';
    ECG.mode = 'run'; ECG.bpm = 62; ECG.tension = 0.12;
    setBpm(62);
    setScreen('game');
    flashFx('boot');
    hideCues();
    el.verdict.className = 'verdict';
    el.verdict.textContent = '';
  }

  function hideCues() {
    el.cueTap.hidden = true;
    el.cueHold.hidden = true;
    el.cueWait.hidden = true;
    el.hint.hidden = true;
  }

  function startBeat(i) {
    const g = S.game;
    const def = g.defs[i];
    const now = performance.now();
    g.idx = i;
    const b = {
      def: def, t0: now,
      pressAt: null, extra: 0,
      cueAt: now + 300, releaseTargetAt: null, releasedAt: null, jitter: 0, pre: 0,
      presses: 0, endAt: null, released: false,
    };
    if (def.type === 'TAP') {
      b.targetAt = now + def.dur * def.frac;
      b.endAt = now + def.dur;
    } else if (def.type === 'HOLD') {
      b.endAt = null; // 动态
    } else {
      b.endAt = now + def.dur;
    }
    g.beat = b;
    el.beatCounter.textContent = '拍 ' + (i + 1) + '/' + TOTAL;
    el.phaseLabel.textContent = PHASES[def.phase].name;
    el.verdict.classList.remove('show'); // 上一拍判定词随新拍开始消失
    ECG.tension = [0.12, 0.35, 0.6][def.phase];
    hideCues();
    if (def.type === 'TAP') {
      el.cueTap.hidden = false;
      S.stripW = el.cueTap.querySelector('.tap-strip').getBoundingClientRect().width;
      el.tapTarget.style.left = (def.frac * 100) + '%';
      const zonePct = clamp((70 / def.dur) * 2 * 100, 1.6, 8);
      el.tapZone.style.left = (def.frac * 100) + '%';
      el.tapZone.style.width = zonePct + '%';
      el.tapCursor.style.transform = 'translateX(0px)';
      if (def.i === 0) el.hint.hidden = false;
    } else if (def.type === 'HOLD') {
      el.cueHold.hidden = false;
      el.holdLabel.textContent = '·';
      el.holdLabel.className = 'hold-label';
      el.holdFill.className = 'hold-fill';
      el.holdFill.style.transform = 'scaleX(0)';
    } else {
      el.cueWait.hidden = false;
      el.waitFake.textContent = def.fake;
      el.waitFake.className = 'wait-fake' + (REDUCED ? '' : ' pulse');
    }
    SND.heartbeat(def.phase === 2);
    spawnDistractors(def);
  }

  function spawnDistractors(def) {
    if (REDUCED) return;
    const n = PHASES[def.phase].distract;
    if (!n) return;
    const POOL = ['▲87', '!!', '◄◄', 'TAP', '62→', '?!', '△!'];
    const span = def.type === 'HOLD' ? 2200 : def.dur - 300;
    for (let k = 0; k < n; k++) {
      const delay = 200 + Math.random() * Math.max(300, span - 500);
      setTimeout(() => {
        if (S.screen !== 'game' || !S.game || S.game.beat === null || S.game.beat.def !== def) return;
        const d = document.createElement('span');
        d.className = 'distract' + (Math.random() < 0.35 ? ' red' : '');
        d.textContent = POOL[Math.floor(Math.random() * POOL.length)];
        d.style.left = (8 + Math.random() * 80) + '%';
        d.style.top = (12 + Math.random() * 72) + '%';
        el.distractLayer.appendChild(d);
        setTimeout(() => d.remove(), 520);
      }, delay);
    }
  }

  // ---------------------------------------------------------------- input
  const downSources = new Set();
  function isUI(e) {
    return !!(e.target && e.target.closest && e.target.closest('button, a'));
  }
  function down(src) {
    if (downSources.size === 0) handlePressStart(performance.now());
    downSources.add(src);
  }
  function up(src) {
    if (!downSources.has(src)) return;
    downSources.delete(src);
    if (downSources.size === 0) handlePressEnd(performance.now());
  }

  function handlePressStart(now) {
    if (S.screen === 'start') {
      if (el.startDone.hidden) startRun('daily');
      return;
    }
    if (S.screen !== 'game') return;
    const g = S.game;
    if (!g || g.locked) return;
    const b = g.beat;
    if (!b || g.gapUntil) { ECG.push('blip', 0.4); return; }
    const t = b.def.type;
    if (t === 'TAP') {
      if (b.pressAt == null) {
        b.pressAt = now;
        const err = Math.abs(now - b.targetAt);
        const good = err <= 150;
        ECG.push(good ? 'blip' : 'spike', good ? 0.8 : 1, false);
        if (good) SND.hit(err <= 70); else SND.err();
      } else {
        b.extra++;
        ECG.push('spike', 0.7, false);
        SND.err();
      }
    } else if (t === 'HOLD') {
      if (now < b.cueAt) {
        b.pre++;
        ECG.push('spike', 0.6, false);
        SND.err();
      } else if (b.pressAt == null) {
        b.pressAt = now;
        b.releaseTargetAt = now + b.def.hold;
        b.endAt = b.releaseTargetAt + 700;
        el.holdLabel.textContent = '保持';
        ECG.push('blip', 0.7);
        SND.hit(false);
      } else if (b.releasedAt != null) {
        b.jitter++;
        ECG.push('spike', 0.8, false);
        SND.err();
      }
    } else { // WAIT
      b.presses++;
      ECG.push('spike', 1.6, true);
      flashFx('red');
      SND.trap();
    }
  }

  function handlePressEnd(now) {
    if (S.screen !== 'game') return;
    const g = S.game;
    if (!g || g.locked) return;
    const b = g.beat;
    if (!b || b.def.type !== 'HOLD') return;
    if (b.pressAt != null && b.releasedAt == null) {
      b.releasedAt = now;
      const errR = Math.abs(now - b.releaseTargetAt);
      const good = errR <= 200;
      el.holdLabel.textContent = good ? '稳' : '…';
      ECG.push(good ? 'blip' : 'spike', good ? 0.8 : 1);
      if (good) SND.hit(errR <= 120); else SND.err();
      b.endAt = now + 350;
    }
  }

  // ---------------------------------------------------------------- beat end / finish
  function endBeat(now) {
    const g = S.game;
    const b = g.beat;
    let score;
    if (b.def.type === 'TAP') score = scoreTap(b);
    else if (b.def.type === 'HOLD') score = scoreHold(b);
    else score = scoreWait(b);
    g.scores.push(score);
    g.beat = null;
    hideCues();
    const v = verdictFor(b, score);
    showVerdict(v, score < 30 ? 'bad' : score < 85 ? 'mid' : 'ok');
    if (score < 30) { ECG.push('spike', 1.8, true); flashFx('red'); }
    // vitals
    const recent = g.scores.slice(-3);
    const inst = recent.reduce((a, s) => a + (100 - s) / 100, 0) / recent.length;
    setBpm(Math.round(62 + 34 * inst + b.def.phase * 3));
    el.spo2Val.textContent = String(98 - Math.floor(inst * 6));
    const avg = Math.round(g.scores.reduce((a, s) => a + s, 0) / g.scores.length);
    el.calmVal.textContent = String(avg);
    // CODE BLUE：连续 3 拍 < 30
    const n = g.scores.length;
    if (n >= 3 && g.scores[n - 1] < 30 && g.scores[n - 2] < 30 && g.scores[n - 3] < 30) {
      return codeBlue(g.idx + 1);
    }
    if (g.idx === TOTAL - 1) return finishRun();
    g.gapUntil = now + b.def.gap;
  }

  function setBpm(v) {
    ECG.bpm = v > 0 ? v : 0;
    el.bpmVal.textContent = v > 0 ? String(v) : '---';
    el.bpmVal.parentElement.classList.toggle('alert', v >= 104 || v <= 0);
  }

  function codeBlue(failBeat) {
    const g = S.game;
    g.locked = true;
    g.status = 'CODEBLUE';
    g.failBeat = failBeat;
    setBpm(0);
    SND.alarm();
    flashFx('blue-pulse');
    ECG.push('spike', 2, true);
    setTimeout(() => { ECG.mode = 'flat'; }, 450);
    setTimeout(() => finalize(), 1700);
  }

  function finishRun() {
    const g = S.game;
    g.locked = true;
    g.status = g.scores.every((s) => s >= 85) ? 'MASTER' : 'RESTING';
    SND.rest();
    setTimeout(() => finalize(), 900);
  }

  function finalize() {
    const g = S.game;
    const calm = Math.round(g.scores.reduce((a, s) => a + s, 0) / Math.max(1, g.scores.length));
    const res = {
      mode: g.mode, day: g.day, issue: g.issue, seed: g.seed,
      date: fmtDate(new Date()),
      calm: calm, status: g.status, failBeat: g.failBeat,
      scores: g.scores.slice(),
    };
    S.lastResult = res;
    if (g.mode === 'daily') {
      const prevOK = store.lastDay === g.day - 1 && store.lastResult && store.lastResult.status !== 'CODEBLUE';
      if (g.status === 'CODEBLUE') store.streak = 0;
      else store.streak = prevOK ? store.streak + 1 : 1;
      store.bestStreak = Math.max(store.bestStreak, store.streak);
      store.bestCalm = Math.max(store.bestCalm, calm);
      store.lastDay = g.day;
      store.lastResult = res;
      store.history.push(res);
      store.history = store.history.slice(-30);
      saveStore();
    }
    showResult(res);
  }

  // ---------------------------------------------------------------- result screen
  function drawResultCanvas(res) {
    const cv = el.resultWave;
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    drawWave(ctx, r.width, r.height, res.scores, res.seed, { padX: 10 });
  }

  function showResult(res) {
    setScreen('result');
    el.beatCounter.textContent = '监护结束';   // 顶栏不再停留在"拍 N/14"
    el.phaseLabel.textContent = 'REPORT';      // 底栏结束游戏中阶段标签
    el.resultHead.textContent = (res.mode === 'practice' ? '练习局' : '#' + res.issue) +
      ' · ' + res.date + ' · 监护结束';
    drawResultCanvas(res);
    const isBlue = res.status === 'CODEBLUE';
    const isMaster = res.status === 'MASTER';
    el.stamp.textContent = isBlue ? 'CODE BLUE · 第' + res.failBeat + '拍'
      : isMaster ? 'FLATLINE MASTER' : 'RESTING';
    el.stamp.className = 'stamp' + (isBlue ? ' blue' : isMaster ? ' master' : '');
    setTimeout(() => el.stamp.classList.add('on'), 300);
    el.calmIndex.textContent = String(res.calm);
    el.calmIndex.parentElement.classList.toggle('blue', isBlue);
    if (res.mode === 'practice') {
      el.resultSub.textContent = '练习局 · 不入档案。';
    } else if (isBlue) {
      el.resultSub.textContent = '记录已存档。明天的第' + res.failBeat + '拍在等你。';
    } else if (isMaster) {
      el.resultSub.textContent = '全程平线。这不常见。连稳 ' + store.streak + ' 天。';
    } else {
      el.resultSub.textContent = '窦性心律。连稳 ' + store.streak + ' 天。';
    }
    el.countdownRow.hidden = res.mode === 'practice';
    if (isBlue) { ECG.mode = 'flat'; } else { ECG.mode = 'run'; setBpm(62); ECG.tension = 0.12; }
    el.copyBtn.textContent = '复制战报';
  }

  // ---------------------------------------------------------------- share actions
  let lastShareText = '';
  function doCopy(btn) {
    const res = S.lastResult || store.lastResult;
    if (!res) return;
    const text = buildShareText(res);
    lastShareText = text;
    const done = () => { btn.textContent = '已复制'; setTimeout(() => { btn.textContent = '复制战报'; }, 1600); };
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        done();
      } catch (e) { btn.textContent = '复制失败'; }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
  }
  function doPng() {
    const res = S.lastResult || store.lastResult;
    if (!res) return;
    try {
      const cv = buildShareCanvas(res);
      const a = document.createElement('a');
      a.href = cv.toDataURL('image/png');
      a.download = 'flatline-' + (res.mode === 'practice' ? 'practice' : res.issue) + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) { /* 导出失败静默 */ }
  }

  // ---------------------------------------------------------------- start screen
  function renderStart() {
    const day = todayIdx();
    const d = new Date();
    el.startDate.textContent = fmtDate(d) + ' · 周' + '日一二三四五六'[d.getDay()];
    el.startIssue.textContent = '#' + issueOf(day);
    el.issueTag.textContent = '#' + issueOf(day);
    el.beatCounter.textContent = '待机';
    el.phaseLabel.textContent = 'IDLE';
    // 漏一天连胜即断（lastDay 不是今天也不是昨天 → 不再展示已死的连胜）
    const streakAlive = store.lastDay === day || store.lastDay === day - 1;
    if (streakAlive && store.streak > 0) {
      el.streakLine.hidden = false;
      el.streakLine.textContent = '已连稳 ' + store.streak + ' 天 · 最佳 ' + store.bestStreak;
    } else el.streakLine.hidden = true;
    const played = store.lastDay === day && validResult(store.lastResult);
    el.startFresh.hidden = played;
    el.startDone.hidden = !played;
    if (played) {
      const res = store.lastResult;
      const isBlue = res.status === 'CODEBLUE';
      el.doneStamp.textContent = isBlue ? '⚠ CODE BLUE · 第' + res.failBeat + '拍'
        : res.status === 'MASTER' ? '🫀 FLATLINE MASTER' : '🫀 RESTING';
      el.doneStamp.className = 'done-stamp' + (isBlue ? ' blue' : '');
      el.doneCalm.textContent = '镇定指数 ' + res.calm + '/100 · 今日已完成';
      const cv = el.miniWave;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rct = cv.getBoundingClientRect();
      const w = Math.round(rct.width) || 320;
      cv.width = w * dpr; cv.height = 72 * dpr;
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, 72);
      drawWave(ctx, w, 72, res.scores, res.seed, { padX: 4, glow: 6 });
    }
    setScreen('start');
  }

  // ---------------------------------------------------------------- countdown
  let cdDay = todayIdx();
  function tickCountdown() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    let s = Math.max(0, Math.floor((next - now) / 1000));
    const t = pad2(Math.floor(s / 3600)) + ':' + pad2(Math.floor((s % 3600) / 60)) + ':' + pad2(s % 60);
    el.countdown.textContent = t;
    el.countdown2.textContent = t;
    const day = todayIdx();
    if (day !== cdDay) {              // 跨午夜：待机中的开始屏自动换到新一期
      cdDay = day;
      if (S.screen === 'start') renderStart();
    }
  }

  // ---------------------------------------------------------------- main loop
  let shakeT = 0;
  function frame(now) {
    ECG.draw(now);
    const g = S.game;
    if (S.screen === 'game' && g && !g.locked) {
      if (g.gapUntil != null) {
        if (now >= g.gapUntil) {
          g.gapUntil = null;
          startBeat(g.idx + 1);
        }
      } else if (g.beat) {
        updateBeat(now, g.beat);
      }
      // 摇晃
      const ph = g.beat ? g.beat.def.phase : (g.idx >= 0 ? phaseOf(g.idx) : 0);
      const amp = REDUCED ? 0 : PHASES[ph].shake;
      if (amp > 0) {
        shakeT = now / 1000;
        const f = ph === 2 ? 9 : 6;
        el.monitor.style.transform =
          'translate(' + (Math.sin(shakeT * f * 6.283) * amp).toFixed(1) + 'px,' +
          (Math.cos(shakeT * f * 4.9) * amp * 0.7).toFixed(1) + 'px)';
      } else if (el.monitor.style.transform) {
        el.monitor.style.transform = '';
      }
    } else if (el.monitor.style.transform) {
      el.monitor.style.transform = '';
    }
    requestAnimationFrame(frame);
  }

  function updateBeat(now, b) {
    const t = b.def.type;
    if (t === 'TAP') {
      const prog = clamp((now - b.t0) / b.def.dur, 0, 1);
      el.tapCursor.style.transform = 'translateX(' + (prog * S.stripW).toFixed(1) + 'px)';
      if (now >= b.endAt) endBeat(now);
    } else if (t === 'HOLD') {
      if (b.pressAt == null) {
        if (now >= b.cueAt && el.holdLabel.textContent === '·') {
          el.holdLabel.textContent = '按住';
        }
        if (now > b.cueAt + 1600) endBeat(now); // 没按：miss
      } else {
        const p = clamp((now - b.pressAt) / b.def.hold, 0, 1);
        el.holdFill.style.transform = 'scaleX(' + p.toFixed(3) + ')';
        if (p >= 1 && b.releasedAt == null) {
          el.holdFill.className = 'hold-fill full';
          el.holdLabel.textContent = '放！';
          el.holdLabel.className = 'hold-label go';
        }
        if (now >= b.endAt) endBeat(now);
      }
    } else {
      if (now >= b.endAt) endBeat(now);
    }
  }

  // ---------------------------------------------------------------- wiring
  document.addEventListener('pointerdown', (e) => {
    SND.ensure();
    if (isUI(e)) return;
    down('p' + e.pointerId);
  });
  document.addEventListener('pointerup', (e) => up('p' + e.pointerId));
  document.addEventListener('pointercancel', (e) => up('p' + e.pointerId));
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    if (isUI(e)) return;
    e.preventDefault();
    SND.ensure();
    down('key');
  });
  document.addEventListener('keyup', (e) => {
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    up('key');
  });
  window.addEventListener('blur', () => {
    if (downSources.size > 0) { downSources.clear(); handlePressEnd(performance.now()); }
  });

  el.muteBtn.addEventListener('click', () => {
    SND.enabled = !SND.enabled;
    store.sound = SND.enabled;
    saveStore();
    el.muteBtn.setAttribute('aria-pressed', String(SND.enabled));
    if (SND.enabled) SND.ensure();
  });
  el.copyBtn.addEventListener('click', () => doCopy(el.copyBtn));
  el.copyBtn2.addEventListener('click', () => doCopy(el.copyBtn2));
  el.pngBtn.addEventListener('click', doPng);
  el.pngBtn2.addEventListener('click', doPng);
  el.practiceBtn.addEventListener('click', () => startRun('practice'));
  el.practiceBtn2.addEventListener('click', () => startRun('practice'));

  window.addEventListener('resize', () => {
    ECG.resize();
    if (S.screen === 'game' && S.game && S.game.beat && S.game.beat.def.type === 'TAP') {
      S.stripW = el.cueTap.querySelector('.tap-strip').getBoundingClientRect().width;
    }
    if (S.screen === 'result' && S.lastResult) drawResultCanvas(S.lastResult);
    if (S.screen === 'start' && !el.startDone.hidden) renderStart(); // 迷你波形重绘
  });

  // ---------------------------------------------------------------- test hook（冒烟测试用，不影响玩法）
  window.__flatline = {
    version: 1,
    state() {
      const g = S.game;
      const now = performance.now();
      let cue = null;
      if (g && g.beat && !g.gapUntil) {
        const b = g.beat;
        cue = { type: b.def.type, beat: g.idx + 1 };
        if (b.def.type === 'TAP') {
          cue.pressed = b.pressAt != null;
          cue.pressInMs = b.targetAt - now;
        } else if (b.def.type === 'HOLD') {
          cue.cueShown = now >= b.cueAt;
          cue.pressed = b.pressAt != null;
          cue.released = b.releasedAt != null;
          cue.releaseInMs = b.releaseTargetAt != null ? b.releaseTargetAt - now : null;
        }
      }
      return {
        screen: S.screen,
        mode: g ? g.mode : null,
        issue: g ? g.issue : issueOf(todayIdx()),
        beatIndex: g ? g.idx + 1 : 0,
        total: TOTAL,
        inGap: !!(g && g.gapUntil != null),
        locked: !!(g && g.locked),
        status: g ? g.status : null,
        scores: g ? g.scores.slice() : [],
        cue: cue,
        playedToday: store.lastDay === todayIdx() && validResult(store.lastResult),
      };
    },
    shareText() {
      const res = S.lastResult || store.lastResult;
      return res ? buildShareText(res) : '';
    },
    lastCopied() { return lastShareText; },
    defsPreview() { // 只读：当日拍序指纹（类型+参数），供确定性/换题测试
      return genDefs(todayIdx()).map((d) =>
        d.type + (d.type === 'TAP' ? '@' + d.frac.toFixed(3) : d.type === 'HOLD' ? '@' + d.hold : '')
      ).join(' ');
    },
    exportPNG() {
      const res = S.lastResult || store.lastResult;
      return res ? buildShareCanvas(res).toDataURL('image/png') : '';
    },
  };

  // ---------------------------------------------------------------- boot
  el.muteBtn.setAttribute('aria-pressed', String(SND.enabled));
  ECG.init($('ecg'));
  renderStart();
  tickCountdown();
  setInterval(tickCountdown, 1000);
  requestAnimationFrame(frame);
})();
