/* 每日一人 · 主逻辑
 * 纯客户端，零依赖。每日种子以用户本地日期为准（与 Wordle 同规），
 * 人物由固定种子洗牌后的序列确定性选取，全球同一天同一人。 */
(function () {
  "use strict";

  var PEOPLE = window.DP_PEOPLE;
  var QUESTIONS = window.DP_QUESTIONS;
  var CATS = window.DP_CATS;

  var SITE_URL = "meiri-yiren.pages.dev"; // 上线后替换为正式域名（DEPLOY.md）
  var STORE_KEY = "dailyperson.v1";
  var EPOCH0 = Math.floor(Date.UTC(2026, 6, 4) / 86400000); // 第 1 期：2026-07-04
  var FIELD_LABEL = {
    politics: "政治·军事", science: "科学", literature: "文学", art: "艺术",
    performing: "演艺", sports: "体育", thought: "思想", exploration: "探险"
  };

  /* ---------- 工具 ---------- */

  function $(id) { return document.getElementById(id); }

  function todayDayNum() {
    return Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 固定种子洗牌 → 全球一致的人物排期
  var PERM = (function () {
    var idx = PEOPLE.map(function (_, i) { return i; });
    var rnd = mulberry32(1129);
    for (var i = idx.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    return idx;
  })();

  function personForIssue(issue) {
    var n = PEOPLE.length;
    return PEOPLE[PERM[(((issue - 1) % n) + n) % n]];
  }

  function issueForDay(dayNum) { return dayNum - EPOCH0 + 1; }

  function fmtYear(y) { return y < 0 ? "前" + (-y) : String(y); }

  function fmtYears(p) {
    return fmtYear(p.born) + "–" + (p.died === null ? "" : fmtYear(p.died));
  }

  function fmtDate(dayNum) {
    var d = new Date(dayNum * 86400000);
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") +
      "-" + String(d.getUTCDate()).padStart(2, "0");
  }

  function tierName(count, win) {
    if (!win) return "未破解";
    if (count <= 5) return "神探";
    if (count <= 8) return "老练";
    if (count <= 12) return "稳健";
    if (count <= 17) return "执着";
    return "通读全卷";
  }

  /* ---------- 存储（容忍损坏数据） ---------- */

  function defaultState() {
    return { v: 1, days: {}, practice: {}, streak: 0, lastWinDay: null, best: null, wins: 0 };
  }

  function loadState() {
    var s;
    try {
      s = JSON.parse(localStorage.getItem(STORE_KEY));
    } catch (e) { s = null; }
    if (!s || typeof s !== "object" || s.v !== 1 ||
        typeof s.days !== "object" || s.days === null ||
        typeof s.practice !== "object" || s.practice === null) {
      return defaultState();
    }
    if (typeof s.streak !== "number" || !isFinite(s.streak)) s.streak = 0;
    if (typeof s.wins !== "number" || !isFinite(s.wins)) s.wins = 0;
    if (typeof s.best !== "number") s.best = null;
    if (typeof s.lastWinDay !== "number") s.lastWinDay = null;
    return s;
  }

  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 私密模式/超额：忽略 */ }
  }

  var state = loadState();

  /* ---------- 人名索引与模糊匹配 ---------- */

  function normName(s) {
    return String(s).toLowerCase().replace(/[\s.·・‧\-'’()（）]/g, "");
  }

  var NAME_INDEX = (function () {
    var map = new Map();
    PEOPLE.forEach(function (p) {
      [p.name].concat(p.aliases).forEach(function (raw) {
        map.set(normName(raw), { p: p, label: raw });
      });
    });
    return map;
  })();

  function levenshtein(a, b, cap) {
    if (Math.abs(a.length - b.length) > cap) return cap + 1;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      var rowMin = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > cap) return cap + 1;
      var t = prev; prev = cur; cur = t;
    }
    return prev[b.length];
  }

  // 编辑距离容错：拉丁名 4-7 字符容 1 错、8+ 容 2 错；中文 3 字以上容 1 错
  function resolveGuess(text) {
    var n = normName(text);
    if (!n) return null;
    var exact = NAME_INDEX.get(n);
    if (exact) return exact.p;
    var ascii = /^[\x00-\x7f]+$/.test(n);
    var cap = ascii ? (n.length >= 8 ? 2 : (n.length >= 4 ? 1 : 0)) : (n.length >= 3 ? 1 : 0);
    if (cap === 0) return null;
    var best = null, bestD = cap + 1;
    NAME_INDEX.forEach(function (v, key) {
      var d = levenshtein(n, key, cap);
      if (d < bestD) { bestD = d; best = v.p; }
    });
    return bestD <= cap ? best : null;
  }

  function suggest(text) {
    var n = normName(text);
    if (!n) return [];
    var seen = new Set(), out = [];
    NAME_INDEX.forEach(function (v, key) {
      if (out.length >= 6) return;
      if (key.indexOf(n) >= 0 && !seen.has(v.p.id)) {
        seen.add(v.p.id);
        out.push(v);
      }
    });
    return out;
  }

  /* ---------- 会话 ---------- */

  var bootDay = todayDayNum();
  var session = null; // { issue, person, practice, rec:{asked:[],done,win,gaveUp} }

  function recForToday() {
    var key = String(bootDay);
    if (!state.days[key] || typeof state.days[key] !== "object" || !Array.isArray(state.days[key].asked)) {
      state.days[key] = { asked: [], done: false, win: false, gaveUp: false };
    }
    return state.days[key];
  }

  function startToday() {
    var issue = issueForDay(bootDay);
    session = { issue: issue, person: personForIssue(issue), practice: false, rec: recForToday() };
    enterSession();
  }

  function startPractice(issue) {
    session = {
      issue: issue, person: personForIssue(issue), practice: true,
      rec: { asked: [], done: false, win: false, gaveUp: false }
    };
    enterSession();
  }

  function enterSession() {
    $("issue-no").textContent = "第 " + session.issue + " 期";
    $("date-line").textContent = fmtDate(EPOCH0 + session.issue - 1);
    $("practice-banner").hidden = !session.practice;
    if (session.practice) {
      $("practice-banner").textContent = "练习 · 第 " + session.issue + " 期 —— 不计连胜，不改纪录";
    }
    $("guess-input").value = "";
    feedback("", "");
    renderTabs();
    renderQuestions();
    renderLog();
    if (session.rec.done) { showReveal(); } else { showView("game"); }
  }

  /* ---------- 视图 ---------- */

  function showView(name) {
    $("view-game").hidden = name !== "game";
    $("view-reveal").hidden = name !== "reveal";
    $("view-archive").hidden = name !== "archive";
  }

  var activeCat = CATS[0].key;

  function askedQuestionIds() {
    var set = new Set();
    session.rec.asked.forEach(function (e) { if (e.t === "q") set.add(e.id); });
    return set;
  }

  function renderTabs() {
    var tabs = $("cat-tabs");
    tabs.innerHTML = "";
    var asked = askedQuestionIds();
    CATS.forEach(function (c) {
      var total = 0, left = 0;
      QUESTIONS.forEach(function (q) {
        if (q.cat === c.key) { total++; if (!asked.has(q.id)) left++; }
      });
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cat-tab";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(c.key === activeCat));
      b.innerHTML = c.label + ' <span class="cat-count">' + left + "/" + total + "</span>";
      b.addEventListener("click", function () {
        activeCat = c.key;
        renderTabs();
        renderQuestions();
      });
      tabs.appendChild(b);
    });
  }

  function renderQuestions() {
    var list = $("question-list");
    list.innerHTML = "";
    var askedMap = {};
    session.rec.asked.forEach(function (e) { if (e.t === "q") askedMap[e.id] = e.a; });
    QUESTIONS.forEach(function (q) {
      if (q.cat !== activeCat) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "q-item";
      b.dataset.qid = q.id;
      var label = document.createElement("span");
      label.textContent = q.text;
      b.appendChild(label);
      if (q.id in askedMap) {
        b.disabled = true;
        var m = document.createElement("span");
        m.className = "q-mark " + (askedMap[q.id] ? "yes" : "no");
        m.textContent = askedMap[q.id] ? "是" : "否";
        b.appendChild(m);
      } else {
        b.addEventListener("click", function () { askQuestion(q); });
      }
      list.appendChild(b);
    });
  }

  function traceOf(rec) {
    return rec.asked.map(function (e) {
      if (e.t === "q") return e.a ? "🟦" : "🟥";
      return e.hit ? "🎯" : "🟥";
    }).join("");
  }

  function renderLog() {
    var log = $("log");
    log.innerHTML = "";
    session.rec.asked.forEach(function (e, i) {
      var li = document.createElement("li");
      var no = document.createElement("span");
      no.className = "log-no";
      no.textContent = String(i + 1) + ".";
      var body = document.createElement("span");
      var ans = document.createElement("span");
      if (e.t === "q") {
        var q = QUESTIONS.find(function (x) { return x.id === e.id; });
        body.textContent = q ? q.text : e.id;
        ans.className = "log-ans " + (e.a ? "yes" : "no");
        ans.textContent = e.a ? "是" : "否";
      } else {
        body.textContent = "猜「" + e.name + "」";
        ans.className = "log-ans " + (e.hit ? "yes" : "no");
        ans.textContent = e.hit ? "猜中" : "不是TA";
      }
      li.appendChild(no); li.appendChild(body); li.appendChild(ans);
      log.appendChild(li);
    });
    $("log-empty").hidden = session.rec.asked.length > 0;
    $("trace-line").textContent = traceOf(session.rec);
    $("q-count").textContent = "已问 " + session.rec.asked.length + " 题";
    $("btn-surrender").hidden = session.rec.asked.length < 8 || session.rec.done;
    renderStreakLine();
  }

  function renderStreakLine() {
    $("streak-line").textContent = state.streak > 0 ? "连胜 " + state.streak + " 天" : "";
  }

  /* ---------- 落章与播报 ---------- */

  var live = document.createElement("div");
  live.className = "visually-hidden";
  live.setAttribute("aria-live", "polite");
  document.body.appendChild(live);

  var stampTimer = null;
  function stamp(kind, text) {
    var el = $("stamp");
    el.className = "stamp " + kind;
    el.textContent = text;
    el.hidden = false;
    // 重新触发动画
    void el.offsetWidth;
    el.classList.add("show");
    if (stampTimer) clearTimeout(stampTimer);
    stampTimer = setTimeout(function () { el.hidden = true; el.classList.remove("show"); }, 720);
  }

  function feedback(text, cls) {
    var el = $("guess-feedback");
    el.textContent = text;
    el.className = "guess-feedback" + (cls ? " " + cls : "");
  }

  /* ---------- 游戏动作 ---------- */

  function askQuestion(q) {
    if (session.rec.done) return;
    var a = q.ans(session.person);
    session.rec.asked.push({ t: "q", id: q.id, a: a });
    persistSession();
    stamp(a ? "yes" : "no", a ? "是" : "否");
    live.textContent = q.text + " " + (a ? "是" : "否");
    renderTabs();
    renderQuestions();
    renderLog();
  }

  function submitGuess(text) {
    if (session.rec.done) return;
    var t = String(text || "").trim();
    if (!t) return;
    var p = resolveGuess(t);
    hideSuggestions();
    if (!p) {
      feedback("辞典里查无此人，换个写法试试（未计次）。", "");
      return;
    }
    if (p.id === session.person.id) {
      session.rec.asked.push({ t: "g", name: p.name, hit: true });
      session.rec.done = true;
      session.rec.win = true;
      onFinish(true);
      stamp("hit", "猜中");
      live.textContent = "猜中了，答案是" + p.name;
      renderLog();
      setTimeout(showReveal, 760);
    } else {
      session.rec.asked.push({ t: "g", name: p.name, hit: false });
      persistSession();
      stamp("no", "否");
      feedback("不是 " + p.name + "。已计一次。", "nope");
      $("guess-input").value = "";
      renderLog();
    }
  }

  function surrender() {
    if (session.rec.done) return;
    session.rec.done = true;
    session.rec.win = false;
    session.rec.gaveUp = true;
    onFinish(false);
    showReveal();
  }

  function onFinish(win) {
    var count = session.rec.asked.length;
    if (session.practice) {
      state.practice[String(session.issue)] = { win: win, count: count };
    } else {
      if (win) {
        state.wins++;
        state.streak = (state.lastWinDay === bootDay - 1) ? state.streak + 1 : 1;
        state.lastWinDay = bootDay;
        if (state.best === null || count < state.best) state.best = count;
      } else {
        state.streak = 0;
      }
    }
    persistSession();
  }

  function persistSession() {
    if (!session.practice) state.days[String(bootDay)] = session.rec;
    saveState();
  }

  /* ---------- 揭晓页 ---------- */

  function showReveal() {
    var p = session.person;
    var rec = session.rec;
    $("crest-char").textContent = p.name.charAt(0);
    $("entry-issue").textContent = "每日一人 · 第 " + session.issue + " 期" + (session.practice ? " · 练习" : "");
    $("entry-name").textContent = p.name;
    $("entry-years").textContent = fmtYears(p) + (p.died === null ? "（在世）" : "");
    $("entry-meta").textContent = p.country + " · " + (FIELD_LABEL[p.field] || p.field);
    $("entry-bio").textContent = p.bio;
    $("entry-epitaph").textContent = p.epitaph;

    var count = rec.asked.length;
    var tier = tierName(count, rec.win);
    $("result-line").innerHTML = rec.win
      ? count + ' 问破解 · <span class="tier">' + tier + "</span>"
      : '翻了答案 · <span class="tier">未破解</span>';
    $("result-trace").textContent = traceOf(rec);

    var stats = [];
    if (!session.practice) {
      if (state.streak > 0) stats.push("连胜 " + state.streak + " 天");
      if (state.best !== null) stats.push("最佳 " + state.best + " 问");
      if (state.wins > 0) stats.push("共破解 " + state.wins + " 期");
    } else {
      stats.push("练习模式 · 不计连胜");
    }
    $("stats-line").textContent = stats.join(" · ");
    $("share-feedback").textContent = "";
    $("countdown").hidden = session.practice;
    showView("reveal");
    startCountdown();
  }

  /* ---------- 分享 ---------- */

  function shareText() {
    var rec = session.rec;
    var lines = [
      "每日一人 #" + session.issue,
      traceOf(rec) || "—",
      (rec.win ? rec.asked.length + " 问破解 · " + tierName(rec.asked.length, true) : "未破解，明天再战"),
      SITE_URL
    ];
    return lines.join("\n");
  }

  function copyShare() {
    var text = shareText();
    var done = function () { $("share-feedback").textContent = "已复制，去粘贴吧。"; };
    var fail = function () { $("share-feedback").textContent = "复制没成功，手动选中下面的轨迹也行。"; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text) ? done() : fail(); });
    } else {
      legacyCopy(text) ? done() : fail();
    }
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  /* 分享图：纹章 + 期号 + 问数 + 轨迹格 + 域名。不出现人名，零剧透。 */
  function drawShareCard() {
    var c = $("share-canvas");
    var ctx = c.getContext("2d");
    var W = c.width, H = c.height;
    var rec = session.rec;
    var PAPER = "#f5efe3", INK = "#221b12", RED = "#b23a2b", BLUE = "#2c4a72";

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    // 纸面横纹
    ctx.strokeStyle = "rgba(90,74,48,0.05)";
    ctx.lineWidth = 2;
    for (var y = 60; y < H; y += 44) {
      ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(W - 60, y); ctx.stroke();
    }
    // 双线框
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6; ctx.strokeRect(40, 40, W - 80, H - 80);
    ctx.lineWidth = 2; ctx.strokeRect(56, 56, W - 112, H - 112);

    // 品牌纹章（「人」字印）
    ctx.save();
    ctx.translate(W / 2, 240);
    ctx.rotate(-0.035);
    ctx.strokeStyle = RED; ctx.lineWidth = 8;
    ctx.strokeRect(-90, -90, 180, 180);
    ctx.lineWidth = 3;
    ctx.strokeRect(-76, -76, 152, 152);
    ctx.fillStyle = RED;
    ctx.font = "700 120px Georgia, 'Songti SC', SimSun, serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("人", 0, 12);
    ctx.restore();

    ctx.fillStyle = INK;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.font = "700 84px Georgia, 'Songti SC', SimSun, serif";
    ctx.fillText("每日一人", W / 2, 480);
    ctx.fillStyle = RED;
    ctx.font = "700 52px Georgia, 'Songti SC', SimSun, serif";
    ctx.fillText("第 " + session.issue + " 期", W / 2, 560);

    // 轨迹格
    var cells = rec.asked.map(function (e) {
      if (e.t === "q") return e.a ? "yes" : "no";
      return e.hit ? "hit" : "no";
    });
    var per = 8, size = 84, gap = 18;
    var rows = Math.max(1, Math.ceil(cells.length / per));
    var gridTop = 640;
    for (var i = 0; i < cells.length; i++) {
      var row = Math.floor(i / per);
      var inRow = (row === rows - 1) ? (cells.length - row * per) : per;
      var rowW = inRow * size + (inRow - 1) * gap;
      var x = (W - rowW) / 2 + (i % per) * (size + gap);
      var yy = gridTop + row * (size + gap);
      var kind = cells[i];
      if (kind === "hit") {
        ctx.strokeStyle = RED; ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(x + size / 2, yy + size / 2, size / 2 - 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = RED;
        ctx.beginPath();
        ctx.arc(x + size / 2, yy + size / 2, size / 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = kind === "yes" ? BLUE : RED;
        ctx.fillRect(x, yy, size, size);
      }
    }

    var afterGrid = gridTop + rows * (size + gap) + 90;
    ctx.fillStyle = INK;
    ctx.font = "700 64px Georgia, 'Songti SC', SimSun, serif";
    ctx.fillText(rec.win ? rec.asked.length + " 问破解 · " + tierName(rec.asked.length, true) : "未破解 · 明日再战",
      W / 2, afterGrid);
    ctx.fillStyle = "#5c5140";
    ctx.font = "36px Georgia, 'Songti SC', SimSun, serif";
    ctx.fillText("蓝＝是 · 红＝否 · 圈＝猜中", W / 2, afterGrid + 64);

    ctx.fillStyle = INK;
    ctx.font = "40px Georgia, 'Songti SC', SimSun, serif";
    ctx.fillText(SITE_URL, W / 2, H - 96);
    return c;
  }

  function savePng() {
    try {
      var c = drawShareCard();
      var a = document.createElement("a");
      a.href = c.toDataURL("image/png");
      a.download = "meiri-yiren-" + session.issue + ".png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      $("share-feedback").textContent = "图片已生成，看下载目录。";
    } catch (e) {
      $("share-feedback").textContent = "这台设备不给存图，试试截屏。";
    }
  }

  /* ---------- 倒计时与跨午夜 ---------- */

  var countdownTimer = null;
  function startCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    if (session.practice) return;
    var el = $("countdown");
    function tick() {
      var now = Date.now() - new Date().getTimezoneOffset() * 60000;
      var msLeft = (bootDay + 1) * 86400000 - now;
      if (msLeft <= 0) { el.textContent = "新的一期已经就绪，刷新翻页。"; return; }
      var h = Math.floor(msLeft / 3600000);
      var m = Math.floor((msLeft % 3600000) / 60000);
      var s = Math.floor((msLeft % 60000) / 1000);
      el.textContent = "下一位人物 " + String(h).padStart(2, "0") + ":" +
        String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + " 后揭榜";
    }
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  setInterval(function () {
    if (todayDayNum() !== bootDay) $("day-rollover").hidden = false;
  }, 30000);

  /* ---------- 档案 ---------- */

  function renderArchive() {
    var listEl = $("archive-list");
    listEl.innerHTML = "";
    var todayIssue = issueForDay(bootDay);
    var first = Math.max(1, todayIssue - 90);
    if (todayIssue <= 1) {
      var liEmpty = document.createElement("li");
      liEmpty.className = "archive-empty";
      liEmpty.textContent = "今天是第一期，档案还是空的。明天见。";
      listEl.appendChild(liEmpty);
      return;
    }
    for (var iss = todayIssue - 1; iss >= first; iss--) {
      (function (issue) {
        var li = document.createElement("li");
        var b = document.createElement("button");
        b.type = "button";
        var pr = state.practice[String(issue)];
        var stateText = pr ? (pr.win ? "已破解 · " + pr.count + " 问" : "翻过答案") : "未练习";
        b.innerHTML = '<span class="arch-issue">第 ' + issue + ' 期</span>' +
          "<span>" + fmtDate(EPOCH0 + issue - 1) + "</span>" +
          '<span class="arch-state">' + stateText + "</span>";
        b.addEventListener("click", function () { startPractice(issue); });
        li.appendChild(b);
        listEl.appendChild(li);
      })(iss);
    }
  }

  /* ---------- 建议列表 ---------- */

  function hideSuggestions() {
    $("suggestions").hidden = true;
    $("suggestions").innerHTML = "";
  }

  function renderSuggestions() {
    var items = suggest($("guess-input").value);
    var ul = $("suggestions");
    ul.innerHTML = "";
    if (!items.length || session.rec.done) { ul.hidden = true; return; }
    items.forEach(function (v) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.innerHTML = v.p.name +
        (v.label !== v.p.name ? ' <span class="sugg-alias">' + v.label + "</span>" : "");
      b.addEventListener("click", function () {
        $("guess-input").value = v.p.name;
        submitGuess(v.p.name);
      });
      li.appendChild(b);
      ul.appendChild(li);
    });
    ul.hidden = false;
  }

  /* ---------- 事件绑定 ---------- */

  $("guess-form").addEventListener("submit", function (e) {
    e.preventDefault();
    submitGuess($("guess-input").value);
  });
  $("guess-input").addEventListener("input", renderSuggestions);
  $("guess-input").addEventListener("blur", function () {
    setTimeout(hideSuggestions, 200); // 允许点击建议
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") hideSuggestions();
  });

  $("btn-help").addEventListener("click", function () {
    var panel = $("help-panel");
    panel.hidden = !panel.hidden;
    this.setAttribute("aria-expanded", String(!panel.hidden));
  });
  $("btn-surrender").addEventListener("click", surrender);
  $("btn-copy").addEventListener("click", copyShare);
  $("btn-png").addEventListener("click", savePng);
  $("btn-archive").addEventListener("click", function () { renderArchive(); showView("archive"); });
  $("btn-to-archive").addEventListener("click", function () { renderArchive(); showView("archive"); });
  $("btn-back-today").addEventListener("click", startToday);
  $("btn-reload").addEventListener("click", function () { location.reload(); });

  /* ---------- 启动 ---------- */

  startToday();

  // 供测试与调试（客户端游戏本无秘密，见 PLAYBOOK「防剧透的边界」）
  window.__dp = {
    get session() { return session; },
    get state() { return state; },
    person: function () { return session.person; },
    issue: function () { return session.issue; },
    dayNum: function () { return bootDay; },
    shareText: shareText,
    drawShareCard: drawShareCard
  };
})();
