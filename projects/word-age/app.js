/* Word Age — UI. Two modes: homepage (has #q + WORD_AGE data) and word page
 * (has window.WORD_PAGE baked in at build time; no dataset shipped). */
(function () {
  "use strict";
  var Lib = window.WordAgeLib;
  if (!Lib) return;
  var doc = document;
  function $(s, el) { return (el || doc).querySelector(s); }
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SITE = doc.documentElement.getAttribute("data-site") || "https://wordage.fyi";
  var KEY = "wordage.v1";

  /* ---------- year odometer: digits roll from blur to rest, 450ms ---------- */
  function renderYear(el, display) {
    if (!el) return;
    el.textContent = "";
    el.setAttribute("aria-label", display);
    var hasDigit = /\d/.test(display);
    el.classList.toggle("words", !hasDigit);
    if (!hasDigit || reduced) { el.textContent = display; return; }
    var m = display.match(/^(\D*)([\s\S]*)$/), pre = m[1], rest = m[2];
    var wrap = doc.createElement("span");
    wrap.className = "od-blur";
    wrap.setAttribute("aria-hidden", "true");
    if (pre.replace(/\s/g, "")) {
      var p = doc.createElement("span");
      p.className = "pre"; p.textContent = pre.trim();
      wrap.appendChild(p);
    }
    var cols = [];
    for (var i = 0; i < rest.length; i++) {
      var ch = rest.charAt(i);
      if (/\d/.test(ch)) {
        var od = doc.createElement("span"); od.className = "od";
        var col = doc.createElement("span"); col.className = "od-col";
        for (var d = 0; d <= 9; d++) {
          var s = doc.createElement("span"); s.textContent = String(d); col.appendChild(s);
        }
        od.appendChild(col); wrap.appendChild(od);
        cols.push({ od: od, col: col, digit: +ch, order: cols.length });
      } else {
        var t = doc.createElement("span"); t.textContent = ch; wrap.appendChild(t);
      }
    }
    el.appendChild(wrap);
    cols.forEach(function (c) {
      var target = "translateY(-" + (c.digit * 10) + "%)";
      c.col.style.transform = "translateY(0)";
      c.col.style.transitionDelay = (c.order * 40) + "ms";
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          c.col.style.transform = target;
          wrap.classList.add("done");
        });
      });
    });
    // settle: swap the roller for plain text (clean copy/paste + selection)
    setTimeout(function () {
      if (!el.contains(wrap)) return;
      cols.forEach(function (c) { c.od.textContent = String(c.digit); });
      wrap.removeAttribute("aria-hidden");
    }, 450 + cols.length * 40 + 120);
  }

  /* ---------- share card: canvas birth certificate, 1080x1350 ---------- */
  function wrapText(x, text, cx, y, maxW, lh) {
    var words = text.split(" "), line = "";
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (x.measureText(test).width > maxW && line) {
        x.fillText(line, cx, y); y += lh; line = words[i];
      } else line = test;
    }
    if (line) { x.fillText(line, cx, y); y += lh; }
    return y;
  }
  function drawCard(e, line) {
    var W = 1080, H = 1350, c = doc.createElement("canvas");
    c.width = W; c.height = H;
    var x = c.getContext("2d");
    x.fillStyle = "#f7f2e7"; x.fillRect(0, 0, W, H);
    [[0, 0], [W, 0], [0, H], [W, H]].forEach(function (pt) {
      var g = x.createRadialGradient(pt[0], pt[1], 0, pt[0], pt[1], 460);
      g.addColorStop(0, "rgba(23,19,14,.06)"); g.addColorStop(1, "rgba(23,19,14,0)");
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    });
    x.strokeStyle = "#17130e"; x.lineWidth = 6; x.strokeRect(40, 40, W - 80, H - 80);
    x.strokeStyle = "#8e2f22"; x.lineWidth = 2; x.strokeRect(58, 58, W - 116, H - 116);
    x.textAlign = "center"; x.textBaseline = "alphabetic";
    try { x.letterSpacing = "10px"; } catch (_) {}
    x.fillStyle = "#17130e";
    x.font = "34px Georgia, serif";
    x.fillText("C E R T I F I C A T E  O F  B I R T H", W / 2, 148);
    x.fillStyle = "rgba(23,19,14,.62)";
    x.font = "24px Georgia, serif";
    x.fillText("T H E  W O R D  A G E  A R C H I V E", W / 2, 192);
    try { x.letterSpacing = "0px"; } catch (_) {}
    x.strokeStyle = "rgba(23,19,14,.3)"; x.lineWidth = 1;
    x.beginPath(); x.moveTo(140, 228); x.lineTo(W - 140, 228); x.stroke();
    // headword, fitted
    var size = 190;
    do { x.font = "italic 700 " + size + "px Georgia, serif"; size -= 6; }
    while (x.measureText(e.w).width > W - 220 && size > 40);
    x.fillStyle = "#17130e";
    x.fillText(e.w, W / 2, 460);
    x.font = "700 78px Georgia, serif";
    x.fillText("b. " + e.d, W / 2, 590);
    x.fillStyle = "rgba(23,19,14,.62)";
    x.font = "italic 40px Georgia, serif";
    x.fillText("≈ " + Lib.ageOf(e.y) + " years old", W / 2, 652);
    x.strokeStyle = "rgba(23,19,14,.3)";
    x.beginPath(); x.moveTo(140, 706); x.lineTo(W - 140, 706); x.stroke();
    x.fillStyle = "rgba(23,19,14,.62)";
    x.font = "28px Georgia, serif";
    x.fillText("AT BIRTH IT MEANT", W / 2, 768);
    x.fillStyle = "#17130e";
    x.font = "italic 46px Georgia, serif";
    var y2 = wrapText(x, "“" + e.orig + "”", W / 2, 830, W - 240, 58);
    x.font = "36px Georgia, serif";
    var cap = line.charAt(0).toUpperCase() + line.slice(1) + ".";
    y2 = wrapText(x, cap, W / 2, y2 + 34, W - 240, 48);
    // verdict stamp
    var stampY = Math.max(y2 + 46, 1080);
    x.save();
    x.translate(W / 2, stampY); x.rotate(-3 * Math.PI / 180);
    x.font = "700 40px Georgia, serif";
    var label = Lib.verdictLabel(e.v).toUpperCase();
    var tw = x.measureText(label).width;
    x.strokeStyle = "#8e2f22"; x.lineWidth = 3;
    x.strokeRect(-tw / 2 - 34, -44, tw + 68, 76);
    x.lineWidth = 1;
    x.strokeRect(-tw / 2 - 26, -36, tw + 52, 60);
    x.fillStyle = "#8e2f22";
    x.fillText(label, 0, 8);
    x.restore();
    x.strokeStyle = "rgba(23,19,14,.3)";
    x.beginPath(); x.moveTo(140, 1210); x.lineTo(W - 140, 1210); x.stroke();
    x.fillStyle = "rgba(23,19,14,.62)";
    x.font = "26px Georgia, serif";
    x.fillText(SITE.replace(/^https?:\/\//, "").toUpperCase() + "  ·  LOOK UP YOUR OWN WORD", W / 2, 1262);
    return c;
  }

  function copyText(text, toastEl) {
    function done() {
      if (!toastEl) return;
      toastEl.textContent = "Copied to clipboard.";
      toastEl.classList.add("show");
      setTimeout(function () { toastEl.classList.remove("show"); }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = doc.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      doc.body.appendChild(ta); ta.select();
      try { doc.execCommand("copy"); } catch (_) {}
      doc.body.removeChild(ta); done();
    }
  }
  function saveCard(entry, line) {
    var c = drawCard(entry, line);
    var a = doc.createElement("a");
    a.download = "word-age-" + entry.w + ".png";
    a.href = c.toDataURL("image/png");
    doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
  }

  /* ================= word page mode ================= */
  var PAGE = window.WORD_PAGE;
  if (PAGE) {
    renderYear($("#year"), PAGE.d);
    var t1 = $("#toast");
    var b1 = $("#save-card"), b2 = $("#copy-text");
    if (b1) b1.addEventListener("click", function () { saveCard(PAGE, PAGE.line); });
    if (b2) b2.addEventListener("click", function () {
      copyText(Lib.shareText(PAGE, PAGE.line, SITE), t1);
    });
    var pf = $("#pagesearch");
    if (pf) pf.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var q = Lib.normalize($("#pq").value);
      if (q) location.href = "../index.html?q=" + encodeURIComponent(q);
    });
    window.WordAgeApp = {
      renderCard: function () { return drawCard(PAGE, PAGE.line).toDataURL("image/png"); },
      shareText: function () { return Lib.shareText(PAGE, PAGE.line, SITE); }
    };
    return;
  }

  /* ================= homepage mode ================= */
  var DATA = window.WORD_AGE;
  var input = $("#q");
  if (!DATA || !input) return;
  var WORDS = DATA.WORDS, ANCHORS = DATA.ANCHORS;
  var state = { current: null, sel: -1, matches: [] };

  function loadStore() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (!s || s.v !== 1 || !Array.isArray(s.recent)) throw new Error("bad");
      s.recent = s.recent.filter(function (x) { return typeof x === "string"; }).slice(0, 6);
      return s;
    } catch (_) { return { v: 1, recent: [] }; }
  }
  function saveStore(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} }

  var sugg = $("#sugg"), result = $("#result"), notfound = $("#notfound");

  function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function hideSugg() { sugg.hidden = true; sugg.innerHTML = ""; state.sel = -1; state.matches = []; }

  function renderSugg(list) {
    if (!list.length) { hideSugg(); return; }
    state.matches = list; state.sel = -1;
    sugg.innerHTML = list.map(function (e, i) {
      return '<li role="option" id="opt-' + i + '" data-w="' + e.w + '"><span>' + esc(e.w) + '</span><span class="y">' + esc(e.d) + "</span></li>";
    }).join("");
    sugg.hidden = false;
  }

  function showEntry(e, push) {
    state.current = e;
    hideSugg();
    notfound.hidden = true;
    $("#r-word").textContent = e.w;
    $("#r-stamp").textContent = Lib.verdictLabel(e.v);
    renderYear($("#r-year"), e.d);
    $("#r-age").textContent = "≈ " + Lib.ageOf(e.y) + " years old";
    $("#r-orig").textContent = "“" + e.orig + "”";
    $("#r-shift").textContent = e.shift;
    var line = Lib.anchorLine(e.w, e.y, ANCHORS);
    $("#r-persp").innerHTML = "That makes <em>" + esc(e.w) + "</em> <strong>" + esc(line) + "</strong>.";
    $("#r-perma").setAttribute("href", "words/" + e.w + ".html");
    $("#r-related").innerHTML = Lib.related(e, WORDS).map(function (r) {
      return '<li><a href="words/' + r.w + '.html">' + esc(r.w) + '</a><span class="y">' + esc(r.d) + "</span></li>";
    }).join("");
    result.hidden = false;
    if (push !== false) {
      try { history.replaceState(null, "", "#" + e.w); } catch (_) {}
      var s = loadStore();
      s.recent = [e.w].concat(s.recent.filter(function (w) { return w !== e.w; })).slice(0, 6);
      saveStore(s);
      renderRecent();
    }
    result.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
  }

  function showNotFound(q) {
    result.hidden = true;
    hideSugg();
    $("#nf-q").textContent = q;
    $("#nf-sugg").innerHTML = Lib.suggest(q, WORDS, 3).map(function (e) {
      return '<button class="chip" data-w="' + e.w + '">' + esc(e.w) + "</button>";
    }).join("");
    notfound.hidden = false;
  }

  function lookup(q) {
    q = Lib.normalize(q);
    if (!q) return;
    var e = Lib.findExact(q, WORDS);
    if (e) showEntry(e); else showNotFound(q);
  }

  input.addEventListener("input", function () {
    var q = Lib.normalize(input.value);
    notfound.hidden = true;
    if (!q) { hideSugg(); return; }
    renderSugg(Lib.prefixMatches(q, WORDS, 8));
  });
  input.addEventListener("keydown", function (ev) {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      if (!state.matches.length) return;
      ev.preventDefault();
      state.sel = ev.key === "ArrowDown"
        ? (state.sel + 1) % state.matches.length
        : (state.sel - 1 + state.matches.length) % state.matches.length;
      var lis = sugg.children;
      for (var i = 0; i < lis.length; i++) lis[i].setAttribute("aria-selected", i === state.sel ? "true" : "false");
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      if (state.sel >= 0 && state.matches[state.sel]) { input.value = state.matches[state.sel].w; showEntry(state.matches[state.sel]); }
      else lookup(input.value);
    } else if (ev.key === "Escape") hideSugg();
  });
  sugg.addEventListener("click", function (ev) {
    var li = ev.target.closest("li[data-w]");
    if (!li) return;
    input.value = li.getAttribute("data-w");
    lookup(li.getAttribute("data-w"));
  });
  doc.addEventListener("click", function (ev) {
    if (!ev.target.closest(".lookup")) hideSugg();
  });
  doc.addEventListener("click", function (ev) {
    var chip = ev.target.closest(".chip[data-w]");
    if (chip) { input.value = chip.getAttribute("data-w"); lookup(chip.getAttribute("data-w")); }
  });

  $("#save-card").addEventListener("click", function () {
    if (state.current) saveCard(state.current, Lib.anchorLine(state.current.w, state.current.y, ANCHORS));
  });
  $("#copy-text").addEventListener("click", function () {
    if (!state.current) return;
    copyText(Lib.shareText(state.current, Lib.anchorLine(state.current.w, state.current.y, ANCHORS), SITE), $("#toast"));
  });
  var rnd = $("#random");
  if (rnd) rnd.addEventListener("click", function (ev) {
    ev.preventDefault();
    var e = WORDS[Math.floor(Math.random() * WORDS.length)];
    input.value = e.w; showEntry(e);
  });

  function renderRecent() {
    var host = $("#recent"); if (!host) return;
    var s = loadStore();
    var known = s.recent.filter(function (w) { return Lib.findExact(w, WORDS); });
    if (!known.length) { host.hidden = true; return; }
    host.hidden = false;
    $("#recent-chips").innerHTML = known.map(function (w) {
      return '<button class="chip" data-w="' + w + '">' + esc(w) + "</button>";
    }).join("");
  }

  // word of the day
  (function () {
    var e = WORDS[Lib.wotdIndex(WORDS.length)];
    var el = $("#wotd-word");
    if (!el) return;
    el.innerHTML = '<a href="words/' + e.w + '.html">' + esc(e.w) + "</a>";
    $("#wotd-meta").textContent = e.d + " · then: “" + e.orig + "”";
    var today = new Date();
    $("#wotd-date").textContent = today.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  })();

  renderRecent();

  // deep links: ?q=word or #word
  (function () {
    var q = "";
    var m = location.search.match(/[?&]q=([^&]+)/);
    if (m) q = decodeURIComponent(m[1]);
    else if (location.hash.length > 1) q = location.hash.slice(1);
    if (q) { input.value = Lib.normalize(q); lookup(q); }
  })();

  window.WordAgeApp = {
    lookup: lookup,
    renderCard: function () {
      if (!state.current) return "";
      return drawCard(state.current, Lib.anchorLine(state.current.w, state.current.y, ANCHORS)).toDataURL("image/png");
    },
    shareText: function () {
      if (!state.current) return "";
      return Lib.shareText(state.current, Lib.anchorLine(state.current.w, state.current.y, ANCHORS), SITE);
    }
  };
})();
