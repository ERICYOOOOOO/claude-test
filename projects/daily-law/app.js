/* 每日一法 · 主逻辑
 * 纯客户端。每日种子以用户本地日期为准（与 Wordle 一致）：
 *   seed = floor((now - tzOffset) / 86400000)
 * 同一天全球同页；dateOverride（MM-DD）命中当天该轨优先生效。
 */
'use strict';

(function () {
  var DOMAIN = 'meiriyifa.app';
  var STORE_KEY = 'dailylaw.v1';
  var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  function $(sel) { return document.querySelector(sel); }
  function two(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- 时间 ---------- */
  function nowMs() {
    return (typeof window.__FAKE_NOW__ === 'number') ? window.__FAKE_NOW__ : Date.now();
  }
  /* offset：0 今天，-1 昨天 */
  function dayInfo(offset) {
    var base = new Date(nowMs());
    var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + (offset || 0), 12, 0, 0);
    var seed = Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
    return { date: d, seed: seed, mmdd: two(d.getMonth() + 1) + '-' + two(d.getDate()) };
  }

  /* ---------- 选条 ---------- */
  var POOLS = {};
  LAW_TRACKS.forEach(function (t) {
    POOLS[t.id] = LAWS.filter(function (e) { return e.track === t.id; });
  });
  function trackName(id) {
    for (var i = 0; i < LAW_TRACKS.length; i++) if (LAW_TRACKS[i].id === id) return LAW_TRACKS[i].name;
    return id;
  }
  function trackSalt(id) {
    var s = 0;
    for (var i = 0; i < id.length; i++) s = (s * 31 + id.charCodeAt(i)) % 9973;
    return s;
  }
  function pick(trackId, info) {
    var pool = POOLS[trackId] || [];
    if (!pool.length) return null;
    for (var i = 0; i < pool.length; i++) {
      if (pool[i].dateOverride === info.mmdd) return pool[i];
    }
    var idx = ((info.seed + trackSalt(trackId)) % pool.length + pool.length) % pool.length;
    /* 相邻两天不重复（覆盖日两侧，单步前后看，确定性不变）：
       1) 明天是本轨覆盖日且覆盖条恰为今天的轮转位 → 顺延一位（idx+1）；
       2) 昨天是本轨覆盖日且覆盖条恰为今天的轮转位 → 改用昨天被跳过的那条（idx-1）。 */
    if (pool.length > 1) {
      var t = new Date(info.date.getFullYear(), info.date.getMonth(), info.date.getDate() + 1);
      var tmmdd = two(t.getMonth() + 1) + '-' + two(t.getDate());
      var y = new Date(info.date.getFullYear(), info.date.getMonth(), info.date.getDate() - 1);
      var ymmdd = two(y.getMonth() + 1) + '-' + two(y.getDate());
      if (pool[idx].dateOverride === tmmdd) idx = (idx + 1) % pool.length;
      else if (pool[idx].dateOverride === ymmdd) idx = (idx - 1 + pool.length) % pool.length;
    }
    return pool[idx];
  }
  function entryKey(e) { return e.track + '|' + e.source; }
  function findByKey(key) {
    for (var i = 0; i < LAWS.length; i++) if (entryKey(LAWS[i]) === key) return LAWS[i];
    return null;
  }

  /* ---------- 持久化（容忍损坏数据） ---------- */
  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return { v: 1, favs: [] };
      var d = JSON.parse(raw);
      if (!d || d.v !== 1 || !Array.isArray(d.favs)) return { v: 1, favs: [] };
      d.favs = d.favs.filter(function (k) { return typeof k === 'string' && findByKey(k); });
      return d;
    } catch (e) { return { v: 1, favs: [] }; }
  }
  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, favs: state.favs })); } catch (e) { /* 忽略 */ }
  }

  /* ---------- 状态 ---------- */
  var state = {
    track: 'cn',
    mode: 'today',           /* 'today' | 'yesterday' */
    favs: loadStore().favs
  };

  function currentInfo() { return dayInfo(state.mode === 'yesterday' ? -1 : 0); }
  function currentEntry() { return pick(state.track, currentInfo()); }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('show');
      toastTimer = setTimeout(function () { el.hidden = true; }, 250);
    }, 1600);
  }

  /* ---------- 渲染 ---------- */
  function renderTabs() {
    var nav = $('#trackTabs');
    nav.innerHTML = '';
    LAW_TRACKS.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.dataset.track = t.id;
      b.textContent = t.name;
      b.setAttribute('aria-selected', t.id === state.track ? 'true' : 'false');
      b.addEventListener('click', function () {
        if (state.track === t.id) return;
        state.track = t.id;
        nav.querySelectorAll('button').forEach(function (x) {
          x.setAttribute('aria-selected', x.dataset.track === state.track ? 'true' : 'false');
        });
        flipTo(renderLeaf);
      });
      nav.appendChild(b);
    });
  }

  function renderLeaf() {
    var info = currentInfo();
    var e = currentEntry();
    if (!e) return;
    var d = info.date;
    $('#ymLine').textContent = d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
    $('#dateNum').textContent = d.getDate();
    $('#weekday').textContent = WEEKDAYS[d.getDay()];
    $('#lawText').textContent = e.text;
    $('#sourceLine').textContent = '——' + e.source + '（' + e.enact + '）';
    var origin = $('#originLine');
    if (e.origLang && e.origName) {
      origin.hidden = false;
      origin.textContent = '原文：' + e.origName + ' · ' + e.origLang;
    } else {
      origin.hidden = true;
      origin.textContent = '';
    }
    $('#noteText').textContent = e.note;
    $('#dayTag').hidden = state.mode !== 'yesterday';
    $('#btnYesterday').textContent = state.mode === 'yesterday' ? '回到今天' : '看昨日';
    var fav = $('#btnFav');
    var on = state.favs.indexOf(entryKey(e)) !== -1;
    fav.setAttribute('aria-pressed', on ? 'true' : 'false');
    fav.textContent = on ? '已收藏' : '收藏';
  }

  /* 翻日历切换：240ms 纵向翻页；reduced-motion 时 CSS 自动降级为淡入淡出 */
  var flipTimer = null;
  var pendingSwap = null;
  function flipTo(mutate) {
    var leaf = $('#leaf');
    if (flipTimer) {           /* 快速连点：立刻结算上一次 */
      clearTimeout(flipTimer);
      flipTimer = null;
      if (pendingSwap) { pendingSwap(); pendingSwap = null; }
    }
    pendingSwap = mutate;
    leaf.classList.remove('flip-in');
    leaf.classList.add('flip-out');
    flipTimer = setTimeout(function () {
      flipTimer = null;
      if (pendingSwap) { pendingSwap(); pendingSwap = null; }
      leaf.classList.remove('flip-out');
      leaf.classList.add('flip-in');
      setTimeout(function () { leaf.classList.remove('flip-in'); }, 260);
    }, 120);
  }

  /* ---------- 收藏 ---------- */
  function toggleFav() {
    var e = currentEntry();
    if (!e) return;
    var key = entryKey(e);
    var i = state.favs.indexOf(key);
    if (i === -1) { state.favs.push(key); toast('已收藏'); }
    else { state.favs.splice(i, 1); toast('已取消收藏'); }
    saveStore();
    renderLeaf();
    renderFavs();
  }

  function renderFavs() {
    var list = $('#favsList');
    var empty = $('#favsEmpty');
    var count = $('#favsCount');
    list.innerHTML = '';
    empty.hidden = state.favs.length > 0;
    count.hidden = state.favs.length === 0;
    count.textContent = state.favs.length ? String(state.favs.length) : '';
    state.favs.forEach(function (key) {
      var e = findByKey(key);
      if (!e) return;
      var li = document.createElement('li');
      var txt = document.createElement('span');
      txt.className = 'fav-text';
      var excerpt = e.text.length > 42 ? e.text.slice(0, 42) + '……' : e.text;
      txt.textContent = excerpt;
      var src = document.createElement('span');
      src.className = 'fav-src';
      src.textContent = trackName(e.track) + ' · ' + e.source;
      txt.appendChild(src);
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'fav-remove';
      rm.textContent = '移除';
      rm.setAttribute('aria-label', '移除收藏：' + e.source);
      rm.addEventListener('click', function () {
        var i = state.favs.indexOf(key);
        if (i !== -1) { state.favs.splice(i, 1); saveStore(); renderLeaf(); renderFavs(); }
      });
      li.appendChild(txt);
      li.appendChild(rm);
      list.appendChild(li);
    });
  }

  /* ---------- 复制引用 ---------- */
  function buildCopyText() {
    var info = currentInfo();
    var e = currentEntry();
    var d = info.date;
    var lines = [
      '【每日一法】' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · ' + trackName(e.track),
      '「' + e.text + '」',
      '——' + e.source + '（' + e.enact + '）'
    ];
    if (e.origLang && e.origName) lines.push('原文：' + e.origName + '（' + e.origLang + '）');
    lines.push(DOMAIN);
    return lines.join('\n');
  }

  function copyText(t) {
    API.lastCopiedText = t;
    var done = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(function () {}, function () {});
        done = true;
      }
    } catch (e) { /* 继续走降级 */ }
    if (!done) {
      try {
        var ta = document.createElement('textarea');
        ta.value = t;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        done = true;
      } catch (e2) { /* 忽略 */ }
    }
    toast(done ? '已复制' : '复制失败，请长按选择文本');
    return t;
  }

  /* ---------- 分享卡（canvas 单向历） ---------- */
  var SERIF = 'Georgia, "Times New Roman", "Songti SC", "Noto Serif CJK SC", SimSun, serif';
  function font(px, bold) { return (bold ? '700 ' : '400 ') + px + 'px ' + SERIF; }

  function wrapChars(ctx, text, maxW) {
    var lines = [];
    var line = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var probe = line + ch;
      if (ctx.measureText(probe).width > maxW && line) {
        lines.push(line);
        line = ch;
      } else {
        line = probe;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCard() {
    var info = currentInfo();
    var e = currentEntry();
    var d = info.date;
    var canvas = $('#shareCanvas');
    var W = canvas.width, H = canvas.height;
    var ctx = canvas.getContext('2d');
    var PAPER = '#faf7f0', INK = '#1c1a17', SOFT = '#57524a', SEAL = '#b02e24';

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    /* 边框：外粗内细 */
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeRect(22, 22, W - 44, H - 44);
    ctx.lineWidth = 1;
    ctx.strokeRect(34, 34, W - 68, H - 68);

    /* 顶部朱砂装订条 */
    ctx.fillStyle = SEAL;
    ctx.fillRect(34, 34, W - 68, 8);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    /* 眉题 */
    ctx.fillStyle = SOFT;
    ctx.font = font(24);
    ctx.fillText('每 日 一 法 · ' + trackName(e.track), W / 2, 108);

    /* 大日期 */
    ctx.fillStyle = INK;
    ctx.font = font(210);
    ctx.fillText(String(d.getDate()), W / 2, 330);

    ctx.fillStyle = SOFT;
    ctx.font = font(26);
    ctx.fillText(d.getFullYear() + '年' + (d.getMonth() + 1) + '月 · ' + WEEKDAYS[d.getDay()], W / 2, 388);

    /* 分隔短线 + 朱砂点 */
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 30, 430);
    ctx.lineTo(W / 2 + 30, 430);
    ctx.stroke();
    ctx.fillStyle = SEAL;
    ctx.fillRect(W / 2 + 36, 427, 6, 6);

    /* 条文：自适应字号，行距 1.9 */
    var maxW = W - 140;
    var top = 480, bottom = 950;
    var fs = 40, lines;
    while (fs >= 22) {
      ctx.font = font(fs);
      lines = wrapChars(ctx, e.text, maxW);
      if (lines.length * fs * 1.9 <= bottom - top) break;
      fs -= 2;
    }
    ctx.fillStyle = INK;
    ctx.font = font(fs);
    var lh = fs * 1.9;
    var blockH = lines.length * lh;
    var y = top + Math.max(0, (bottom - top - blockH) / 2) + lh * 0.7;
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], W / 2, y);
      y += lh;
    }

    /* 出处 */
    ctx.fillStyle = SOFT;
    ctx.font = font(22);
    var srcLines = wrapChars(ctx, '——' + e.source + '（' + e.enact + '）', maxW);
    var sy = 990;
    for (var j = 0; j < srcLines.length; j++) {
      ctx.fillText(srcLines[j], W / 2, sy);
      sy += 34;
    }

    /* 朱砂印章 */
    ctx.save();
    ctx.translate(W / 2, 1092);
    ctx.rotate(-0.035);
    ctx.fillStyle = SEAL;
    roundRectPath(ctx, -46, -46, 92, 92, 8);
    ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.font = font(34, true);
    ctx.fillText('每日', 0, -8);
    ctx.fillText('一法', 0, 30);
    ctx.restore();

    /* 域名 */
    ctx.fillStyle = SOFT;
    ctx.font = font(20);
    ctx.fillText(DOMAIN, W / 2, 1166);

    var url = '';
    try { url = canvas.toDataURL('image/png'); } catch (err) { url = ''; }
    API.lastCardDataURL = url;
    return url;
  }

  function openShare() {
    var url = drawCard();
    var a = $('#btnDownload');
    if (url) a.href = url;
    var d = currentInfo().date;
    a.download = 'meiriyifa-' + d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) + '.png';
    $('#shareModal').hidden = false;
  }
  function closeShare() { $('#shareModal').hidden = true; }

  /* ---------- 事件 ---------- */
  function bind() {
    $('#btnYesterday').addEventListener('click', function () {
      state.mode = state.mode === 'yesterday' ? 'today' : 'yesterday';
      flipTo(renderLeaf);
    });
    $('#btnFav').addEventListener('click', toggleFav);
    $('#btnCopy').addEventListener('click', function () { copyText(buildCopyText()); });
    $('#btnShare').addEventListener('click', openShare);
    $('#btnCopyCard').addEventListener('click', function () { copyText(buildCopyText()); });
    $('#btnCloseModal').addEventListener('click', closeShare);
    $('#shareModal').addEventListener('click', function (ev) {
      if (ev.target === $('#shareModal')) closeShare();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !$('#shareModal').hidden) closeShare();
    });
    $('#btnFavsPanel').addEventListener('click', function () {
      var p = $('#favsPanel');
      p.hidden = !p.hidden;
      this.setAttribute('aria-expanded', p.hidden ? 'false' : 'true');
    });
  }

  /* ---------- 调试/测试钩子 ---------- */
  var API = {
    lastCopiedText: null,
    lastCardDataURL: null,
    getEntry: function (trackId, offset) { return pick(trackId || state.track, dayInfo(offset || 0)); },
    getState: function () { return { track: state.track, mode: state.mode, favs: state.favs.slice() }; },
    getCopyText: buildCopyText,
    buildCard: drawCard,
    rerender: function () { renderTabs(); renderLeaf(); renderFavs(); }
  };
  window.__dailylaw = API;

  /* ---------- 启动 ---------- */
  renderTabs();
  renderLeaf();
  renderFavs();
  bind();
})();
