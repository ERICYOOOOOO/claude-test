/* At Your Age — client engine.
   Zero dependencies. Everything runs locally; nothing is sent anywhere. */
"use strict";

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var DATA = AYA_MILESTONES;
  var DOMAIN = AYA_DOMAIN;
  var LS_KEY = "aya:v1";
  var DAYS_PER_YEAR = 365.2425;
  var NEAR_DAYS = 150; // |delta| below this counts as "exactly your age"
  var REDUCED = false;
  try {
    REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) { /* older engines */ }

  /* ------------------------------------------------------------- storage */
  function loadStore() {
    var fallback = { v: 1, birth: null, seen: { roast: [], heal: [] } };
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return fallback;
      var s = JSON.parse(raw);
      if (!s || typeof s !== "object" || s.v !== 1) return fallback;
      if (!s.seen || typeof s.seen !== "object") s.seen = {};
      if (!Array.isArray(s.seen.roast)) s.seen.roast = [];
      if (!Array.isArray(s.seen.heal)) s.seen.heal = [];
      if (typeof s.birth !== "string") s.birth = null;
      return s;
    } catch (e) {
      return fallback;
    }
  }
  function saveStore() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch (e) { /* full/blocked */ }
  }
  var store = loadStore();

  /* ---------------------------------------------------------- date logic */
  function todayParts() {
    var n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
  }

  // Returns {err: "..."} or {y, m, d, iso}
  function validateBirth(ys, ms, ds) {
    var y = parseInt(ys, 10), m = parseInt(ms, 10), d = parseInt(ds, 10);
    if (!/^\d{1,4}$/.test(String(ys).trim()) || isNaN(y) || isNaN(m) || isNaN(d)) {
      return { err: "Three numbers, please — year, month, day." };
    }
    if (y < 1900) {
      return { err: "This machine calibrates back to 1900. If you were really born before that, you've outlasted everyone in here — congratulations." };
    }
    if (m < 1 || m > 12 || d < 1 || d > 31) {
      return { err: "That date doesn't exist. Check the month against the day." };
    }
    var probe = new Date(Date.UTC(y, m - 1, d));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
      return { err: "That date doesn't exist. Check the month against the day." };
    }
    var t = todayParts();
    if (Date.UTC(y, m - 1, d) > Date.UTC(t.y, t.m - 1, t.d)) {
      return { err: "You appear not to have been born yet. Come back once that's sorted." };
    }
    // Under-13: the ledger is not for children. Kind, no roasting minors.
    var age = t.y - y - ((t.m < m || (t.m === m && t.d < d)) ? 1 : 0);
    if (age < 13) {
      return { err: "This machine starts measuring at 13. Until then you're not behind — everyone in here is simply older than you." };
    }
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return { y: y, m: m, d: d, iso: y + "-" + pad(m) + "-" + pad(d) };
  }

  // Exact age: full years + days since last birthday + total days lived.
  // UTC arithmetic → leap-year safe, DST-proof. Feb 29 birthdays roll to
  // Mar 1 in common years (standard convention).
  function ageParts(b) {
    var t = todayParts();
    var bu = Date.UTC(b.y, b.m - 1, b.d);
    var tu = Date.UTC(t.y, t.m - 1, t.d);
    var totalDays = Math.round((tu - bu) / 864e5);
    var years = t.y - b.y;
    var anniv = Date.UTC(t.y, b.m - 1, b.d);
    if (anniv > tu) {
      years -= 1;
      anniv = Date.UTC(t.y - 1, b.m - 1, b.d);
    }
    var days = Math.round((tu - anniv) / 864e5);
    return { years: years, days: days, totalDays: totalDays };
  }

  /* ------------------------------------------------------- seeded picking */
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Local-date day number (Wordle-style): same seed for a user all day.
  var daySeed = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5);

  function milestoneDays(m) {
    return m.ageDays || Math.round(m.age * DAYS_PER_YEAR);
  }

  // Deterministic order per (day, birthday, mode); most relevant hits first.
  function orderFor(mode, birthIso, userDays) {
    var arr = DATA.filter(function (m) { return m.mode === mode; });
    var rng = mulberry32((daySeed ^ hashStr(birthIso) ^ hashStr(mode)) >>> 0);
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    var hit = [], miss = [];
    arr.forEach(function (m) {
      var rel = mode === "roast" ? milestoneDays(m) <= userDays
                                 : milestoneDays(m) >= userDays;
      (rel ? hit : miss).push(m);
    });
    return hit.concat(miss);
  }

  /* ------------------------------------------------------------ the words */
  function pron(p) {
    return p === "she" ? { he: "she", his: "her", him: "her" }
                       : { he: "he", his: "his", him: "him" };
  }
  function formatSpan(days) {
    days = Math.round(Math.abs(days));
    var y = Math.floor(days / DAYS_PER_YEAR);
    var d = Math.round(days - y * DAYS_PER_YEAR);
    if (d >= 365) { y += 1; d = 0; }
    if (y === 0) return d === 1 ? "1 day" : d + " days";
    var ys = y === 1 ? "1 year" : y + " years";
    if (d === 0) return ys;
    return ys + " and " + (d === 1 ? "1 day" : d + " days");
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // Template engine. delta > 0 → user is older than the milestone age.
  function verdictFor(m, user) {
    var delta = user.totalDays - milestoneDays(m);
    var span = formatSpan(delta);
    var P = pron(m.p);
    var S = m.short, A = m.age, E = m.event;
    var pool;

    if (m.mode === "roast") {
      if (m.death) {
        pool = delta > 0 ? [
          "By your exact age, " + S + " had been dead for " + span + ".",
          "You have now outlived " + S + " by " + span + ". The bar was right there."
        ] : [
          S + " was dead by " + A + ". You have " + span + " left on " + P.his + " clock."
        ];
      } else if (Math.abs(delta) <= NEAR_DAYS) {
        pool = [
          S + " was your age — almost to the day — when " + P.he + " " + E + ".",
          "At exactly the age you are now, " + S + " " + E + "."
        ];
      } else if (delta > 0) {
        pool = [
          S + " " + E + " at " + A + ". That's " + span + " younger than you are right now.",
          "At " + A + ", " + S + " " + E + ". You've had " + span + " longer to get around to it.",
          S + " " + E + " at " + A + " — " + span + " ago, by your calendar."
        ];
      } else {
        pool = [
          S + " " + E + " at " + A + ". You have " + span + " to do something comparable. The clock is running.",
          "In " + span + ", you'll be as old as " + S + " was when " + P.he + " " + E + ". Just saying."
        ];
      }
    } else {
      if (Math.abs(delta) <= NEAR_DAYS) {
        pool = [
          S + " was exactly your age when " + P.he + " " + E + ". Not too late — on time.",
          "At the age you are today, " + S + " " + E + ". This is apparently the moment."
        ];
      } else if (delta < 0 && m.future) {
        pool = [
          "At your age, " + S + " wouldn't " + m.future + " for another " + span + ".",
          "You could idle for " + span + " and still be on " + S + "'s schedule — " + P.he + " didn't " + m.future + " until " + A + "."
        ];
      } else if (delta < 0) {
        pool = [
          S + " " + E + " at " + A + ". You have " + span + " before you're even there.",
          "By " + S + "'s calendar you're " + span + " early. " + cap(P.he) + " " + E + " at " + A + ".",
          "There is time. " + S + " " + E + " at " + A + " — that's " + span + " from where you're standing."
        ];
      } else {
        pool = [
          S + " " + E + " at " + A + ". You're " + span + " past that, and " + P.he + " was only getting started.",
          "Late by whose clock? " + S + " was " + A + " when " + P.he + " " + E + "."
        ];
      }
    }
    return pool[(hashStr(m.id) + daySeed) % pool.length];
  }

  /* ------------------------------------------------------------- app state */
  var user = null;       // ageParts result
  var birth = null;      // validated birth {y,m,d,iso}
  var mode = "roast";
  var orders = { roast: [], heal: [] };
  var idx = { roast: 0, heal: 0 };
  var current = null;

  function pick(mo) {
    var order = orders[mo];
    if (!order.length) return null;
    if (store.seen[mo].length >= order.length) store.seen[mo] = [];
    var seen = {};
    store.seen[mo].forEach(function (id) { seen[id] = true; });
    var n = order.length, i = idx[mo], tries = 0;
    while (tries < n && seen[order[i % n].id]) { i++; tries++; }
    idx[mo] = i % n;
    var m = order[idx[mo]];
    if (store.seen[mo].indexOf(m.id) === -1) store.seen[mo].push(m.id);
    saveStore();
    return m;
  }

  /* -------------------------------------------------------------- render */
  function slugify(name) {
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function thousands(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function renderAge() {
    $("ageNum").textContent = String(user.years);
    var dayWord = user.days === 1 ? "day" : "days";
    $("ageSub").innerHTML =
      "years and " + user.days + " " + dayWord +
      ' <span class="dim">&middot; ' + thousands(user.totalDays) + " days on the clock</span>";
    $("bLabel").textContent = birth.iso;
  }

  function renderMilestone(m, animate) {
    current = m;
    var apply = function () {
      $("verdict").textContent = verdictFor(m, user);
      $("metaText").textContent = m.person + " · " + m.category + " · " + m.year + " ·";
      $("personLink").href = "people/" + slugify(m.person) + ".html";
    };
    var v = $("verdict");
    if (!animate || REDUCED) { apply(); return; }
    v.classList.remove("in");
    v.classList.add("out");
    window.setTimeout(function () {
      apply();
      v.classList.remove("out");
      v.classList.add("in");
      window.setTimeout(function () { v.classList.remove("in"); }, 120);
    }, 90);
  }

  function setMode(mo, animate) {
    mode = mo;
    document.body.setAttribute("data-mode", mo);
    var f = $("flip");
    f.setAttribute("aria-pressed", mo === "heal" ? "true" : "false");
    f.setAttribute("aria-label", mo === "heal"
      ? "Mode: heal. Activate to switch to roast mode."
      : "Mode: roast. Activate to switch to heal mode.");
    renderMilestone(pick(mo), animate);
  }

  function showResult() {
    user = ageParts(birth);
    orders.roast = orderFor("roast", birth.iso, user.totalDays);
    orders.heal = orderFor("heal", birth.iso, user.totalDays);
    idx.roast = 0; idx.heal = 0;
    $("gate").hidden = true;
    $("result").hidden = false;
    renderAge();
    setMode(mode, false);
  }

  function showGate() {
    $("result").hidden = true;
    $("gate").hidden = false;
    if (birth) {
      $("year").value = birth.y;
      $("month").value = birth.m;
      $("day").value = birth.d;
    }
    $("year").focus();
  }

  function showError(msg) {
    var el = $("err");
    el.textContent = msg;
    el.hidden = false;
  }

  /* ---------------------------------------------------------- share text */
  function shareText() {
    if (!current || !user) return "";
    return verdictFor(current, user) + "\n" +
      "Me: " + user.years + " years, " + user.days + " days. " +
      (mode === "roast" ? "ROAST" : "HEAL") + " mode — https://" + DOMAIN;
  }

  /* ---------------------------------------------------------- share card */
  var CARD_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  function wrapText(ctx, text, maxWidth) {
    var words = text.split(" ");
    var lines = [], line = "";
    words.forEach(function (w) {
      var probe = line ? line + " " + w : w;
      if (ctx.measureText(probe).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = probe;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function drawCard() {
    var W = 1080, H = 1350, M = 84; // portrait 4:5, swiss margins
    var accent = mode === "roast" ? "#e0332b" : "#2e7d4f";
    var canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#111111";
    ctx.textBaseline = "alphabetic";

    // masthead
    ctx.font = "800 36px " + CARD_FONT;
    try { ctx.letterSpacing = "6px"; } catch (e) { /* older canvas */ }
    ctx.fillText("AT YOUR AGE", M, M + 26);
    try { ctx.letterSpacing = "0px"; } catch (e) { /* noop */ }

    // mode chip, top right
    var chipW = 216, chipH = 64;
    ctx.fillStyle = accent;
    ctx.fillRect(W - M - chipW, M - 20, chipW, chipH);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 34px " + CARD_FONT;
    var label = mode === "roast" ? "ROAST" : "HEAL";
    ctx.fillText(label, W - M - chipW + (chipW - ctx.measureText(label).width) / 2, M + 24);

    // the number
    ctx.fillStyle = "#111111";
    var numSize = 480;
    ctx.font = "800 " + numSize + "px " + CARD_FONT;
    var numText = String(user.years);
    while (ctx.measureText(numText).width > W - 2 * M && numSize > 120) {
      numSize -= 20;
      ctx.font = "800 " + numSize + "px " + CARD_FONT;
    }
    var numBase = 620;
    ctx.fillText(numText, M - 8, numBase);

    ctx.font = "700 40px " + CARD_FONT;
    try { ctx.letterSpacing = "5px"; } catch (e) { /* noop */ }
    var dayWord = user.days === 1 ? "DAY" : "DAYS";
    ctx.fillText("YEARS AND " + user.days + " " + dayWord, M, numBase + 76);
    try { ctx.letterSpacing = "0px"; } catch (e) { /* noop */ }

    // accent band
    ctx.fillStyle = accent;
    ctx.fillRect(M, numBase + 122, W - 2 * M, 22);

    // verdict
    ctx.fillStyle = "#111111";
    ctx.font = "650 54px " + CARD_FONT;
    var lines = wrapText(ctx, verdictFor(current, user), W - 2 * M);
    var y = numBase + 226;
    lines.slice(0, 6).forEach(function (ln) {
      ctx.fillText(ln, M, y);
      y += 70;
    });

    // footer
    ctx.font = "700 34px " + CARD_FONT;
    ctx.fillText(DOMAIN, M, H - M + 10);
    ctx.font = "600 26px " + CARD_FONT;
    var tag = "flip it. " + (mode === "roast" ? "heal mode exists." : "roast mode exists.");
    ctx.fillStyle = "#777777";
    ctx.fillText(tag, W - M - ctx.measureText(tag).width, H - M + 10);

    return canvas;
  }

  /* ------------------------------------------------------------- actions */
  function flashLabel(btn, text) {
    var old = btn.textContent;
    btn.textContent = text;
    btn.disabled = true;
    window.setTimeout(function () {
      btn.textContent = old;
      btn.disabled = false;
    }, 1200);
  }

  function copyShareText() {
    var text = shareText();
    var done = function () { flashLabel($("copy"), "Copied"); };
    var fallback = function () {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done();
      } catch (e) { flashLabel($("copy"), "Select & copy"); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  function savePNG() {
    try {
      var url = drawCard().toDataURL("image/png");
      var a = document.createElement("a");
      a.href = url;
      a.download = "at-your-age-" + user.years + "-" + mode + ".png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      flashLabel($("save"), "Saved");
    } catch (e) {
      flashLabel($("save"), "Try again");
    }
  }

  /* ---------------------------------------------------------------- init */
  function submit(ev) {
    if (ev) ev.preventDefault();
    $("err").hidden = true;
    var v = validateBirth($("year").value, $("month").value, $("day").value);
    if (v.err) { showError(v.err); return; }
    birth = v;
    store.birth = v.iso;
    saveStore();
    showResult();
  }

  // auto-advance Y → M → D as the user types
  [["year", 4, "month"], ["month", 2, "day"], ["day", 2, null]].forEach(function (cfg) {
    var el = $(cfg[0]);
    el.addEventListener("input", function () {
      el.value = el.value.replace(/[^\d]/g, "").slice(0, cfg[1]);
      if (cfg[2] && el.value.length >= cfg[1]) $(cfg[2]).focus();
    });
  });

  $("birthForm").addEventListener("submit", submit);
  $("flip").addEventListener("click", function () {
    setMode(mode === "roast" ? "heal" : "roast", true);
  });
  $("another").addEventListener("click", function () {
    idx[mode] += 1;
    renderMilestone(pick(mode), true);
  });
  $("copy").addEventListener("click", copyShareText);
  $("save").addEventListener("click", savePNG);
  $("editBirth").addEventListener("click", showGate);

  $("count").textContent = String(DATA.length);

  // returning visitor: restore birthday, land straight on the verdict
  if (store.birth) {
    var parts = store.birth.split("-");
    var v0 = validateBirth(parts[0], parts[1], parts[2]);
    if (!v0.err) {
      birth = v0;
      showResult();
    }
  }

  // test hook — also handy in the console
  window.AYA = {
    shareText: shareText,
    cardDataURL: function () { return drawCard().toDataURL("image/png"); },
    getMode: function () { return mode; },
    getCurrent: function () { return current; },
    dataCount: DATA.length,
    // pure functions exposed for the QA harness (test/qa-extra.mjs)
    verdictFor: verdictFor,
    formatSpan: formatSpan,
    ageParts: ageParts,
    validateBirth: validateBirth
  };
})();
