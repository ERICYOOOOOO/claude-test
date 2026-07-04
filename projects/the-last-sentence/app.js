// ---------------------------------------------------------------------------
// The Last Sentence — frontend.
// Talks to server.mjs over SSE (/events) + POST /say. If there is no server
// (file:// or a static-only deploy), it falls back to a self-contained demo.
// All sentence text arrives HTML-escaped from the server; we decode it and
// only ever insert it with textContent, so nothing is ever parsed as HTML.
// ---------------------------------------------------------------------------
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const ui = {
    sentence: $('sentence'), box: $('sentence-box'), timer: $('timer'),
    seq: $('seq'), deadCount: $('dead-count'),
    form: $('say-form'), input: $('input'), chars: $('chars'),
    submit: $('submit'), feedback: $('feedback'),
    mine: $('mine'), mineText: $('mine-text'), mineCopy: $('mine-copy'),
    graves: $('graves'), gyCount: $('gy-count'), gyMore: $('gy-more'), gyEmpty: $('gy-empty'),
    sentinel: $('gy-sentinel'), connDot: $('conn-dot'), connLabel: $('conn-label'),
    demoBanner: $('demo-banner'),
  };

  const MAX_CHARS = 120;
  const COOLDOWN_MS = 10_000;
  const CHUNK = 40; // graves rendered per scroll step
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HTTP = location.protocol === 'http:' || location.protocol === 'https:';
  const SITE_URL = HTTP ? location.origin : 'https://thelastsentence.example';

  // --- state ------------------------------------------------------------------
  let current = null;     // { text (escaped), seq, bornAt (server clock) }
  let total = 0;          // current.seq === total
  let graves = [];        // newest first
  let renderedCount = 0;  // how many graves are in the DOM
  let clockOffset = 0;    // serverNow - Date.now()
  let cooldownUntil = 0;
  let cooldownTick = null;
  let typeTimer = null;
  let demo = false;
  let gotFirstState = false;
  let lastMine = null;    // grave of my most recently dead sentence

  // --- text helpers --------------------------------------------------------------
  // Server escapes exactly these five; decode then always use textContent.
  const DEC = [['&lt;', '<'], ['&gt;', '>'], ['&quot;', '"'], ['&#39;', "'"], ['&amp;', '&']];
  const decode = (t) => DEC.reduce((s, [a, b]) => s.split(a).join(b), String(t));
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const escapeHtml = (t) => t.replace(/[&<>"']/g, (c) => ESC[c]);

  const fmtSeq = (n) => '#' + Number(n).toLocaleString('en-US');
  const fmtInt = (n) => Number(n).toLocaleString('en-US');

  // "0.812s" · "12.041s" · "4m 12.882s" · "1h 04m 09.115s" · "2d 01h 33m 07.000s"
  function fmtDur(ms) {
    ms = Math.max(0, Math.floor(ms));
    const frac = String(ms % 1000).padStart(3, '0');
    let s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600); s %= 3600;
    const m = Math.floor(s / 60); s %= 60;
    let out = '';
    if (d) out += d + 'd ';
    if (d || h) out += (d ? String(h).padStart(2, '0') : h) + 'h ';
    if (d || h || m) out += (d || h ? String(m).padStart(2, '0') : m) + 'm ';
    out += (d || h || m ? String(s).padStart(2, '0') : s) + '.' + frac + 's';
    return out;
  }

  // --- my sentences (localStorage, corruption-tolerant) ------------------------------
  const LS_KEY = 'tls.v1.mine';
  let mySeqs;
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    mySeqs = new Set(Array.isArray(raw) ? raw.filter(Number.isFinite).slice(-80) : []);
  } catch { mySeqs = new Set(); }
  function rememberMine(seq) {
    mySeqs.add(seq);
    try { localStorage.setItem(LS_KEY, JSON.stringify([...mySeqs].slice(-80))); } catch { /* full/blocked */ }
  }

  // --- the living sentence -----------------------------------------------------------
  function setSentence(escaped, animate) {
    if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
    ui.sentence.classList.remove('typing');
    const raw = decode(escaped);
    const chars = [...raw];
    ui.sentence.classList.toggle('long', chars.length > 72);
    if (!animate || REDUCED) { ui.sentence.textContent = raw; return; }
    // typewriter: reveal code points at a pace that lands the whole line ~1s
    ui.sentence.classList.add('typing');
    ui.sentence.textContent = '';
    const step = Math.min(36, Math.max(14, Math.floor(900 / chars.length)));
    let i = 0;
    typeTimer = setInterval(() => {
      i += 1;
      ui.sentence.textContent = chars.slice(0, i).join('');
      if (i >= chars.length) {
        clearInterval(typeTimer); typeTimer = null;
        ui.sentence.classList.remove('typing');
      }
    }, step);
  }

  // The overwritten sentence falls out of the frame — 400ms, accelerating.
  function dropOld(escaped) {
    if (REDUCED) return;
    const ghost = document.createElement('p');
    ghost.className = 'sentence dying' + (ui.sentence.classList.contains('long') ? ' long' : '');
    ghost.dir = 'auto';
    ghost.textContent = decode(escaped);
    ghost.setAttribute('aria-hidden', 'true');
    ui.box.appendChild(ghost);
    setTimeout(() => ghost.remove(), 450);
  }

  // --- timer: the heartbeat of the page --------------------------------------------
  function tickTimer() {
    if (current) {
      ui.timer.textContent = fmtDur(Date.now() + clockOffset - current.bornAt);
    }
    requestAnimationFrame(tickTimer);
  }
  requestAnimationFrame(tickTimer);

  // --- graveyard -------------------------------------------------------------------
  function graveLi(g) {
    const li = document.createElement('li');
    li.className = 'grave' + (mySeqs.has(g.seq) ? ' mine-grave' : '');
    const row = document.createElement('div');
    row.className = 'g-row';
    const seq = document.createElement('span');
    seq.textContent = fmtSeq(g.seq);
    const life = document.createElement('span');
    life.className = 'g-life';
    life.textContent = 'survived ' + fmtDur(g.survivedMs);
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'g-copy';
    copy.textContent = 'copy';
    copy.setAttribute('aria-label', 'copy epitaph for sentence ' + fmtSeq(g.seq));
    copy.addEventListener('click', () => copyText(epitaph(g), copy));
    row.append(seq, life, copy);
    const text = document.createElement('p');
    text.className = 'g-text';
    text.dir = 'auto'; // RTL sentences keep their base direction
    text.textContent = decode(g.text);
    li.append(row, text);
    return li;
  }

  function epitaph(g) {
    const dur = fmtDur(g.survivedMs);
    return mySeqs.has(g.seq)
      ? `my sentence survived ${dur} as ${fmtSeq(g.seq)} on the last sentence — ${SITE_URL}`
      : `"${decode(g.text)}" survived ${dur} as ${fmtSeq(g.seq)} on the last sentence — ${SITE_URL}`;
  }

  function renderMoreGraves() {
    const frag = document.createDocumentFragment();
    const end = Math.min(graves.length, renderedCount + CHUNK);
    for (let i = renderedCount; i < end; i++) frag.appendChild(graveLi(graves[i]));
    renderedCount = end;
    ui.graves.appendChild(frag);
    ui.gyMore.hidden = !(renderedCount >= graves.length && total - 1 > graves.length);
  }

  function renderGraveyard() {
    ui.graves.textContent = '';
    renderedCount = 0;
    renderMoreGraves();
    ui.gyEmpty.hidden = graves.length > 0;
  }

  new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && renderedCount < graves.length) renderMoreGraves();
  }, { rootMargin: '600px' }).observe(ui.sentinel);

  // --- counters -----------------------------------------------------------------------
  function renderCounts() {
    ui.seq.textContent = fmtSeq(current.seq);
    ui.deadCount.textContent = fmtInt(total - 1);
    ui.gyCount.textContent = fmtInt(total - 1) + ' buried here';
  }

  function renderAll(animate) {
    setSentence(current.text, animate);
    renderCounts();
    renderGraveyard();
  }

  // --- overwrite event (the core of the product) -----------------------------------------
  function applyOverwrite(d) {
    if (current && d.current.seq <= current.seq) return; // replay / duplicate
    if (typeof d.now === 'number') clockOffset = d.now - Date.now();
    dropOld(d.grave.text);
    graves.unshift(d.grave);
    current = d.current;
    total = d.total;
    const li = graveLi(d.grave);
    li.classList.add('fresh');
    ui.graves.prepend(li);
    ui.gyEmpty.hidden = true;
    renderedCount += 1;
    renderCounts();
    setSentence(current.text, true);
    if (mySeqs.has(d.grave.seq)) showMyDeath(d.grave);
    if (mySeqs.has(current.seq)) setFeedback(`yours is ${fmtSeq(current.seq)} — alive right now.`);
  }

  function showMyDeath(g) {
    lastMine = g;
    ui.mineText.textContent = '';
    ui.mineText.append('yours is dead. it survived ');
    const b = document.createElement('b');
    b.textContent = fmtDur(g.survivedMs);
    ui.mineText.append(b, ` as ${fmtSeq(g.seq)}.`);
    ui.mine.hidden = false;
    if (mySeqs.has(current?.seq)) return;
    setFeedback('');
  }
  ui.mineCopy.addEventListener('click', () => { if (lastMine) copyText(epitaph(lastMine), ui.mineCopy); });

  // --- clipboard --------------------------------------------------------------------------
  function copyText(text, btn) {
    window.__lastCopy = text; // also used by the smoke test
    const done = (ok) => {
      if (!btn) return;
      const orig = btn.textContent;
      btn.textContent = ok ? 'copied' : 'copy failed';
      setTimeout(() => { btn.textContent = orig; }, 1200);
    };
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        done(ok);
      } catch { done(false); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => done(true), fallback);
    } else fallback();
  }

  // --- feedback + cooldown -------------------------------------------------------------------
  function setFeedback(msg, isError) {
    ui.feedback.textContent = msg;
    ui.feedback.classList.toggle('err', !!isError);
  }

  function startCooldown(ms) {
    cooldownUntil = Date.now() + ms;
    ui.submit.disabled = true;
    if (cooldownTick) clearInterval(cooldownTick);
    const step = () => {
      const left = cooldownUntil - Date.now();
      if (left <= 0) {
        clearInterval(cooldownTick); cooldownTick = null;
        ui.submit.disabled = false;
        ui.submit.textContent = 'overwrite';
        return;
      }
      ui.submit.textContent = `wait ${Math.ceil(left / 1000)}s`;
    };
    step();
    cooldownTick = setInterval(step, 100);
  }

  function reject(msg) {
    setFeedback(msg, true);
    ui.input.classList.remove('reject');
    void ui.input.offsetWidth; // restart the shake
    ui.input.classList.add('reject');
  }

  // --- char counter ------------------------------------------------------------------------------
  function updateChars() {
    const n = [...ui.input.value].length;
    const left = MAX_CHARS - n;
    ui.chars.textContent = String(left);
    ui.chars.classList.toggle('low', left < 15);
  }
  ui.input.addEventListener('input', () => {
    ui.input.classList.remove('reject');
    if ([...ui.input.value].length > MAX_CHARS) ui.input.value = [...ui.input.value].slice(0, MAX_CHARS).join('');
    updateChars();
  });

  // --- submit ---------------------------------------------------------------------------------------
  ui.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = ui.input.value.replace(/\s+/g, ' ').trim();
    if (!text) return reject('say something first.');
    if (Date.now() < cooldownUntil) return; // button is disabled anyway
    if (demo) return demoSay(text);
    ui.submit.disabled = true;
    try {
      const res = await fetch('/say', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        rememberMine(d.seq);
        ui.input.value = '';
        updateChars();
        setFeedback(`yours is ${fmtSeq(d.seq)} — alive right now.`);
        startCooldown(d.cooldownMs || COOLDOWN_MS);
      } else if (res.status === 429) {
        startCooldown(d.retryAfterMs || COOLDOWN_MS);
        setFeedback('too soon. the world gets one sentence from you every 10 seconds.', true);
      } else if (d.error === 'empty') {
        ui.submit.disabled = false; reject('say something first.');
      } else if (d.error === 'too_long') {
        ui.submit.disabled = false; reject('120 characters. brevity is survival.');
      } else {
        ui.submit.disabled = false; reject('the world refused that. try again.');
      }
    } catch {
      ui.submit.disabled = false;
      reject('could not reach the world. still trying.');
    }
  });

  // --- connection status -------------------------------------------------------------------------------
  function setConn(mode) {
    ui.connDot.className = 'dot' + (mode === 'live' ? ' live' : mode === 'lost' ? ' lost' : '');
    ui.connLabel.textContent = mode === 'live' ? 'live'
      : mode === 'lost' ? 'reconnecting' : mode === 'demo' ? 'offline demo' : 'connecting';
  }

  // --- live wire (SSE) ----------------------------------------------------------------------------------
  function connect() {
    const es = new EventSource('/events');
    es.addEventListener('state', (e) => {
      const d = JSON.parse(e.data);
      gotFirstState = true;
      clockOffset = d.now - Date.now();
      const isResync = current !== null;
      const changed = !current || current.seq !== d.current.seq;
      current = d.current;
      total = d.total;
      graves = d.graves;
      renderAll(isResync && changed);
      setConn('live');
    });
    es.addEventListener('overwrite', (e) => applyOverwrite(JSON.parse(e.data)));
    es.onerror = () => { if (gotFirstState) setConn('lost'); }; // EventSource retries itself
    // If nothing ever arrives (static hosting, no backend), become the demo.
    setTimeout(async () => {
      if (gotFirstState) return;
      let real = false;
      try {
        const r = await fetch('/', { method: 'HEAD' });
        real = r.headers.get('x-app') === 'last-sentence';
      } catch { /* unreachable */ }
      if (!real) { es.close(); enterDemo(); }
    }, 3500);
  }

  // --- demo mode (file:// or static-only hosting) ------------------------------------------------------------
  // A local, self-contained imitation: 12 preset graves, local overwrites only.
  const DEMO_BAD = /\b(?:fuck|shit|cunt|bitch|asshole|dick|cock|pussy|nigger|nigga|faggot|fag|retard|whore|slut|kike|spic|chink|tranny)(?:s|es|ed|er|ers|ing)?\b/gi;
  function enterDemo() {
    demo = true;
    ui.demoBanner.hidden = false;
    setConn('demo');
    const now = Date.now();
    const seed = [
      ['we were here and then we were not', 8_064_213],
      ['someone in Lagos is reading this right now', 411_902],
      ['i typed this instead of sleeping', 93_407],
      ['the ocean does not know your name', 1_202_119],
      ['hello from a train between two cities', 682_004],
      ['do not write your ex\'s name here', 12_886],
      ['my father would have liked this place', 3_704_551],
      ['nine milliseconds is still a lifetime', 9],
      ['the cursor blinks whether you type or not', 227_361],
      ['this sentence cost me nothing and you everything', 54_209],
      ['in the end none of us survived either', 1_940_030],
      ['first.', 312],
    ];
    let seq = 8391;
    let died = now - 47_000;
    graves = [];
    for (const [text, life] of seed) {
      graves.unshift({ text: escapeHtml(text), seq, bornAt: died - life, diedAt: died, survivedMs: life });
      seq += 1;
      died -= life + 1000;
    }
    total = 8403;
    current = { text: escapeHtml('the quietest hour is when sentences live longest'), seq: total, bornAt: now - 47_000 };
    clockOffset = 0;
    renderAll(false);
  }

  function demoSay(text) {
    const now = Date.now();
    const clean = escapeHtml(text.replace(DEMO_BAD, '▓▓'));
    const grave = {
      text: current.text, seq: current.seq, bornAt: current.bornAt,
      diedAt: now, survivedMs: now - current.bornAt,
    };
    rememberMine(total + 1);
    ui.input.value = '';
    updateChars();
    setFeedback(`yours is ${fmtSeq(total + 1)} — alive right now (in this demo).`);
    startCooldown(COOLDOWN_MS);
    applyOverwrite({ grave, current: { text: clean, seq: total + 1, bornAt: now }, total: total + 1, now });
  }

  // --- boot --------------------------------------------------------------------------------------------------
  updateChars();
  if (HTTP) { setConn('connecting'); connect(); } else enterDemo();

  // tiny debug/testing handle (read-only)
  window.__tls = {
    get state() {
      return {
        demo, total, currentSeq: current && current.seq,
        gravesHeld: graves.length, gravesRendered: renderedCount,
        coolingDown: Date.now() < cooldownUntil,
      };
    },
  };
})();
