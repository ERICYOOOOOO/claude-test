/* Overlap — app.js
 * Two cities, one day: how much of it do you actually share?
 *
 * All time-zone math goes through Intl.DateTimeFormat({ timeZone }) — real IANA
 * conversion, DST handled by the platform, never a hand-written offset.
 * The day is modelled as 96 samples (one per 15 minutes) over the next 24 hours;
 * each sample is a real instant converted into each person's local wall clock.
 *
 * The pure core (everything before the UI section) is exposed on
 * globalThis.Overlap so test/tz.mjs can import this file under Node directly.
 */
(function () {
  "use strict";

  /* ======================================================== core: time math */

  var MIN15 = 15 * 60 * 1000;
  var SAMPLES = 96; /* 24h of 15-minute steps */

  var fmtCache = {};
  function zoneFmt(tz) {
    var f = fmtCache[tz];
    if (!f) {
      f = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hourCycle: "h23",
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
      fmtCache[tz] = f;
    }
    return f;
  }

  var DOWS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  /* Wall-clock parts of an absolute instant, seen from a zone. */
  function localParts(date, tz) {
    var parts = {};
    var list = zoneFmt(tz).formatToParts(date);
    for (var i = 0; i < list.length; i++) parts[list[i].type] = list[i].value;
    var hh = +parts.hour;
    var mm = +parts.minute;
    return {
      y: +parts.year,
      mo: +parts.month,
      d: +parts.day,
      hh: hh,
      mm: mm,
      dow: DOWS[parts.weekday],
      minutes: hh * 60 + mm
    };
  }

  /* UTC offset in minutes at a given instant (derived from Intl, so DST-correct). */
  function zoneOffsetMinutes(date, tz) {
    var p = localParts(date, tz);
    var asUTC = Date.UTC(p.y, p.mo - 1, p.d, p.hh, p.mm);
    var t = Math.floor(date.getTime() / 60000) * 60000;
    return Math.round((asUTC - t) / 60000);
  }

  function defaultSched() {
    return {
      sleepStart: 23 * 60,
      sleepEnd: 7 * 60,
      busyStart: 9 * 60,
      busyEnd: 18 * 60,
      busyDays: [1, 2, 3, 4, 5]
    };
  }

  /* Is minute-of-day m inside [start, end)? Wraps midnight; start === end = empty. */
  function inSpan(m, start, end) {
    if (start === end) return false;
    if (start < end) return m >= start && m < end;
    return m >= start || m < end;
  }

  /* State of one person at local wall-clock parts p: "sleep" | "busy" | "free".
   * Sleep wins over busy. A busy span that wraps past midnight belongs to the
   * weekday it STARTED on (a Friday 22:00–02:00 shift is still Friday's). */
  function stateAt(p, sched) {
    if (inSpan(p.minutes, sched.sleepStart, sched.sleepEnd)) return "sleep";
    var bs = sched.busyStart;
    var be = sched.busyEnd;
    if (bs !== be) {
      var busy = false;
      if (bs < be) {
        busy = p.minutes >= bs && p.minutes < be && sched.busyDays.indexOf(p.dow) >= 0;
      } else if (p.minutes >= bs) {
        busy = sched.busyDays.indexOf(p.dow) >= 0;
      } else if (p.minutes < be) {
        busy = sched.busyDays.indexOf((p.dow + 6) % 7) >= 0;
      }
      if (busy) return "busy";
    }
    return "free";
  }

  /* Merge consecutive samples with the same state into segments. */
  function mergeRuns(samples, key) {
    var segs = [];
    var cur = null;
    for (var i = 0; i < samples.length; i++) {
      var st = samples[i][key];
      if (cur && cur.state === st) cur.i1 = i;
      else {
        if (cur) segs.push(cur);
        cur = { state: st, i0: i, i1: i };
      }
    }
    if (cur) segs.push(cur);
    return segs;
  }

  /* The heart: sample the next 24h and intersect both people's free time. */
  function computeDay(startMs, tzA, tzB, schedA, schedB) {
    var t0 = Math.floor(startMs / MIN15) * MIN15;
    var samples = [];
    for (var i = 0; i < SAMPLES; i++) {
      var d = new Date(t0 + i * MIN15);
      var pa = localParts(d, tzA);
      var pb = localParts(d, tzB);
      var sa = stateAt(pa, schedA);
      var sb = stateAt(pb, schedB);
      samples.push({ t: t0 + i * MIN15, pa: pa, pb: pb, sa: sa, sb: sb, both: sa === "free" && sb === "free" });
    }
    var windows = [];
    var cur = null;
    for (i = 0; i < SAMPLES; i++) {
      if (samples[i].both) {
        if (cur) cur.i1 = i;
        else cur = { i0: i, i1: i };
      } else if (cur) {
        windows.push(cur);
        cur = null;
      }
    }
    if (cur) windows.push(cur);
    for (i = 0; i < windows.length; i++) {
      var w = windows[i];
      w.start = t0 + w.i0 * MIN15;
      w.end = t0 + (w.i1 + 1) * MIN15;
      w.minutes = (w.i1 - w.i0 + 1) * 15;
      w.openAtStart = w.i0 === 0;
      w.cutAtEnd = w.i1 === SAMPLES - 1;
    }
    var overlapMinutes = 0;
    for (i = 0; i < windows.length; i++) overlapMinutes += windows[i].minutes;
    return {
      t0: t0,
      samples: samples,
      windows: windows,
      overlapMinutes: overlapMinutes,
      segsA: mergeRuns(samples, "sa"),
      segsB: mergeRuns(samples, "sb")
    };
  }

  /* ====================================================== core: the words */

  function fmtDur(min) {
    if (min <= 0) return "0m";
    var h = Math.floor(min / 60);
    var m = min % 60;
    if (h && m) return h + "h " + m + "m";
    if (h) return h + "h";
    return m + "m";
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function fmtHM(p) {
    return pad2(p.hh) + ":" + pad2(p.mm);
  }

  /* Emotional register, one line per band. Dry on purpose. */
  function tierFor(min) {
    if (min <= 0) return { id: "zero", line: "No shared free hour in the next day. One of you bends, or the calendar wins." };
    if (min < 60) return { id: "thin", line: "Less than an hour. If it matters, you’ll both be standing in it." };
    if (min < 180) return { id: "enough", line: "2 hours is enough if you both show up." };
    if (min < 360) return { id: "solid", line: "That’s real time. People in the same city use less of it." };
    return { id: "wide", line: "Most of your waking day is shared. Distance is doing less damage than it claims." };
  }

  /* Window naming: bucket each side's local hour at the window midpoint into
   * M(orning 5–12) D(aytime 12–18) E(vening 18–21) N(ight 21–5), then look up.
   * Night starts at 21 on purpose: a window that peaks at 21:30 is goodnight
   * territory, not dinner. */
  function bucketGroup(h) {
    if (h >= 5 && h < 12) return "M";
    if (h >= 12 && h < 18) return "D";
    if (h >= 18 && h < 21) return "E";
    return "N";
  }

  var PAIR_NAMES = {
    MM: "morning coffee together",
    DD: "the long afternoon",
    EE: "the dinner window",
    NN: "the goodnight window",
    MD: "your coffee, their lunch",
    DM: "your lunch, their coffee",
    ME: "your morning, their evening",
    EM: "your evening, their morning",
    MN: "your sunrise, their midnight",
    NM: "your midnight, their sunrise",
    DE: "your afternoon, their evening",
    ED: "your evening, their afternoon",
    DN: "your daylight, their small hours",
    ND: "their daylight, your small hours",
    EN: "your dinner, their small hours",
    NE: "their dinner, your small hours"
  };

  function windowName(win, tzA, tzB) {
    var mid = new Date((win.start + win.end) / 2);
    var ga = bucketGroup(localParts(mid, tzA).hh);
    var gb = bucketGroup(localParts(mid, tzB).hh);
    return PAIR_NAMES[ga + gb] || "the shared window";
  }

  /* ======================================================== core: search */

  function fold(s) {
    return s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  /* Rank: exact name > name prefix > alias/zh prefix > substring > country. */
  function searchCities(q, limit) {
    q = (q || "").trim();
    if (!q) return [];
    limit = limit || 8;
    var fq = fold(q);
    var scored = [];
    var cities = globalThis.CITIES || [];
    for (var i = 0; i < cities.length; i++) {
      var c = cities[i];
      var best = -1;
      var name = fold(c.n);
      if (name === fq) best = 0;
      else if (name.indexOf(fq) === 0) best = 1;
      else if (name.indexOf(fq) >= 0) best = 4;
      var hay = [c.h].concat(c.a || []);
      for (var j = 0; j < hay.length; j++) {
        if (!hay[j]) continue;
        var al = fold(hay[j]);
        var s = -1;
        if (al === fq) s = 1;
        else if (al.indexOf(fq) === 0) s = 2;
        else if (al.indexOf(fq) >= 0) s = 4;
        if (s >= 0 && (best < 0 || s < best)) best = s;
      }
      if (best < 0 && fold(c.c).indexOf(fq) === 0) best = 6;
      if (best >= 0) scored.push([best, i, c]);
    }
    scored.sort(function (x, y) {
      return x[0] - y[0] || x[2].n.localeCompare(y[2].n);
    });
    var out = [];
    for (i = 0; i < scored.length && out.length < limit; i++) out.push(scored[i][2]);
    return out;
  }

  function cityById(id) {
    var cities = globalThis.CITIES || [];
    for (var i = 0; i < cities.length; i++) if (cities[i].id === id) return cities[i];
    return null;
  }

  function pairKey(idA, idB) {
    return "overlap:v1:meter:" + [idA, idB].sort().join("~");
  }

  /* Wall-clock difference (B relative to A) as a spoken line. */
  function offsetLine(now, a, b) {
    var diff = zoneOffsetMinutes(now, b.z) - zoneOffsetMinutes(now, a.z);
    if (diff === 0) return "Same clock, different streets.";
    return b.n + " runs " + fmtDur(Math.abs(diff)) + " " + (diff > 0 ? "ahead" : "behind") + ".";
  }

  /* ====================================================== expose for tests */

  globalThis.Overlap = {
    MIN15: MIN15,
    localParts: localParts,
    zoneOffsetMinutes: zoneOffsetMinutes,
    defaultSched: defaultSched,
    inSpan: inSpan,
    stateAt: stateAt,
    computeDay: computeDay,
    fmtDur: fmtDur,
    tierFor: tierFor,
    windowName: windowName,
    bucketGroup: bucketGroup,
    PAIR_NAMES: PAIR_NAMES,
    searchCities: searchCities,
    cityById: cityById,
    pairKey: pairKey,
    offsetLine: offsetLine
  };

  /* ============================================================== UI layer */

  if (typeof document === "undefined") return; /* Node (test/tz.mjs) stops here */

  var $ = function (id) {
    return document.getElementById(id);
  };

  var COLORS = {
    bg: "#0e1526",
    ink: "#e9e2cf",
    dim: "#8b93a7",
    amber: "#e8b45f",
    amberSoft: "#c99a52",
    busy: "#3d3157",
    sleep: "#0a101f",
    sleepEdge: "#1d2742",
    glow: "#ffe9b8",
    warm: "#fff3d6"
  };

  var KEY_LAST = "overlap:v1:last";

  var S = {
    a: null,
    b: null,
    schedA: defaultSched(),
    schedB: defaultSched(),
    day: null,
    meter: { v: 1, ms: 0, met: null },
    meterKey: null,
    lastTickMs: Date.now(),
    lastSaveMs: 0,
    active: { A: -1, B: -1 } /* highlighted option per combobox */
  };

  /* ------------------------------------------------------------ storage */

  function loadJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var v = JSON.parse(raw);
      return v && typeof v === "object" ? v : null;
    } catch (e) {
      return null;
    }
  }

  function saveJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      /* storage may be unavailable (private mode) — the page still works */
    }
  }

  function validSched(s) {
    if (!s || typeof s !== "object") return null;
    var keys = ["sleepStart", "sleepEnd", "busyStart", "busyEnd"];
    var out = defaultSched();
    for (var i = 0; i < keys.length; i++) {
      var v = s[keys[i]];
      if (typeof v !== "number" || !isFinite(v) || v < 0 || v > 1439) return null;
      out[keys[i]] = Math.round(v);
    }
    if (!Array.isArray(s.busyDays)) return null;
    out.busyDays = s.busyDays.filter(function (d) {
      return typeof d === "number" && d >= 0 && d <= 6;
    });
    return out;
  }

  function loadMeter(key) {
    var raw = loadJSON(key);
    var m = { v: 1, ms: 0, met: null };
    /* ms is real time this page has watched — it cannot exceed the time the
     * product has existed. Anything bigger (or negative, or non-numeric) is
     * corrupt storage and resets to 0 rather than poisoning the keepsake. */
    var msCap = Date.now() - Date.UTC(2024, 0, 1);
    if (raw && typeof raw.ms === "number" && isFinite(raw.ms) && raw.ms >= 0 && raw.ms <= msCap) m.ms = raw.ms;
    var met = raw && raw.met;
    if (typeof met === "string" && /^\d{4}-\d{2}-\d{2}$/.test(met) && !isNaN(Date.parse(met)) && Date.parse(met) <= Date.now()) m.met = met;
    return m;
  }

  function saveMeter() {
    if (S.meterKey) saveJSON(S.meterKey, S.meter);
  }

  function saveLast() {
    saveJSON(KEY_LAST, {
      a: S.a ? S.a.id : null,
      b: S.b ? S.b.id : null,
      schedA: S.schedA,
      schedB: S.schedB
    });
  }

  /* --------------------------------------------------------------- combo */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function renderList(side, results) {
    var ul = $("list" + side);
    if (!results.length) {
      ul.innerHTML = "";
      ul.hidden = true;
      $("city" + side).setAttribute("aria-expanded", "false");
      S.active[side] = -1;
      return;
    }
    var html = "";
    for (var i = 0; i < results.length; i++) {
      var c = results[i];
      html +=
        '<li id="opt' + side + i + '" role="option" data-id="' + esc(c.id) + '"' +
        (i === S.active[side] ? ' class="active" aria-selected="true"' : ' aria-selected="false"') +
        ">" +
        '<span class="opt-name">' + esc(c.n) + "</span>" +
        '<span class="opt-zh">' + esc(c.h) + "</span>" +
        '<span class="opt-country">' + esc(c.c) + "</span>" +
        "</li>";
    }
    ul.innerHTML = html;
    ul.hidden = false;
    $("city" + side).setAttribute("aria-expanded", "true");
  }

  function closeList(side) {
    renderList(side, []);
  }

  function chooseCity(side, city) {
    if (side === "A") S.a = city;
    else S.b = city;
    var input = $("city" + side);
    input.value = city.n;
    closeList(side);
    saveLast();
    writeHash();
    refreshPair();
  }

  function bindCombo(side) {
    var input = $("city" + side);
    var ul = $("list" + side);

    input.addEventListener("input", function () {
      S.active[side] = -1;
      renderList(side, searchCities(input.value, 8));
    });
    input.addEventListener("focus", function () {
      input.select();
      if (input.value.trim()) renderList(side, searchCities(input.value, 8));
    });
    input.addEventListener("keydown", function (e) {
      var opts = ul.querySelectorAll("li");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!opts.length) {
          renderList(side, searchCities(input.value, 8));
          opts = ul.querySelectorAll("li");
          if (!opts.length) return;
        }
        var n = opts.length;
        S.active[side] = e.key === "ArrowDown" ? (S.active[side] + 1) % n : (S.active[side] - 1 + n) % n;
        for (var i = 0; i < n; i++) {
          opts[i].classList.toggle("active", i === S.active[side]);
          opts[i].setAttribute("aria-selected", i === S.active[side] ? "true" : "false");
        }
        input.setAttribute("aria-activedescendant", "opt" + side + S.active[side]);
      } else if (e.key === "Enter") {
        var pick = S.active[side] >= 0 ? opts[S.active[side]] : opts[0];
        if (pick) {
          e.preventDefault();
          var c = cityById(pick.getAttribute("data-id"));
          if (c) chooseCity(side, c);
        }
      } else if (e.key === "Escape") {
        closeList(side);
      }
    });
    ul.addEventListener("mousedown", function (e) {
      var li = e.target.closest("li");
      if (!li) return;
      e.preventDefault();
      var c = cityById(li.getAttribute("data-id"));
      if (c) chooseCity(side, c);
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest("#combo" + side)) closeList(side);
    });
  }

  /* ------------------------------------------------------------ schedule */

  function minsFromTime(v, fallback) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(v || "");
    if (!m) return fallback;
    var mins = +m[1] * 60 + +m[2];
    return mins >= 0 && mins < 1440 ? mins : fallback;
  }

  function timeFromMins(m) {
    return pad2(Math.floor(m / 60)) + ":" + pad2(m % 60);
  }

  var BUSYDAY_SETS = {
    weekdays: [1, 2, 3, 4, 5],
    everyday: [0, 1, 2, 3, 4, 5, 6],
    weekends: [0, 6],
    never: []
  };

  function busyDaysName(days) {
    var s = days.slice().sort().join(",");
    for (var k in BUSYDAY_SETS) if (BUSYDAY_SETS[k].join(",") === s) return k;
    return "weekdays";
  }

  function bindSched(side) {
    var sched = side === "A" ? "schedA" : "schedB";
    var ids = ["sleepStart", "sleepEnd", "busyStart", "busyEnd"];
    ids.forEach(function (k) {
      var el = $(k + side);
      el.addEventListener("change", function () {
        S[sched][k] = minsFromTime(el.value, S[sched][k]);
        el.value = timeFromMins(S[sched][k]);
        saveLast();
        refreshPair();
      });
    });
    $("busyDays" + side).addEventListener("change", function () {
      S[sched].busyDays = (BUSYDAY_SETS[$("busyDays" + side).value] || BUSYDAY_SETS.weekdays).slice();
      saveLast();
      refreshPair();
    });
  }

  function pushSchedToInputs(side) {
    var sc = side === "A" ? S.schedA : S.schedB;
    $("sleepStart" + side).value = timeFromMins(sc.sleepStart);
    $("sleepEnd" + side).value = timeFromMins(sc.sleepEnd);
    $("busyStart" + side).value = timeFromMins(sc.busyStart);
    $("busyEnd" + side).value = timeFromMins(sc.busyEnd);
    $("busyDays" + side).value = busyDaysName(sc.busyDays);
  }

  /* ----------------------------------------------------------------- hash */

  function writeHash() {
    if (!S.a || !S.b) return;
    var h = "#" + S.a.id + "/" + S.b.id;
    try {
      history.replaceState(null, "", h);
    } catch (e) {
      location.hash = h;
    }
  }

  function readHash() {
    var m = /^#([a-z0-9-]+)\/([a-z0-9-]+)$/.exec(location.hash || "");
    if (!m) return null;
    var a = cityById(m[1]);
    var b = cityById(m[2]);
    return a && b ? { a: a, b: b } : null;
  }

  /* ------------------------------------------------------------ rendering */

  function refreshPair() {
    if (!S.a || !S.b) {
      $("result").hidden = true;
      $("empty").hidden = false;
      return;
    }
    var key = pairKey(S.a.id, S.b.id);
    if (key !== S.meterKey) {
      S.meterKey = key;
      S.meter = loadMeter(key);
      $("metDate").value = S.meter.met || "";
    }
    recompute();
    $("empty").hidden = true;
    var res = $("result");
    if (res.hidden) {
      res.hidden = false;
      res.classList.remove("enter");
      void res.offsetWidth; /* restart the entrance animation */
      res.classList.add("enter");
    }
  }

  function recompute() {
    if (!S.a || !S.b) return;
    S.day = computeDay(Date.now(), S.a.z, S.b.z, S.schedA, S.schedB);
    renderVerdict();
    renderBand();
    renderWindows();
    renderTick(true);
  }

  function renderVerdict() {
    var min = S.day.overlapMinutes;
    $("verdictNum").textContent = fmtDur(min);
    var t = tierFor(min);
    $("tierLine").textContent = t.line;
    $("offsetLine").textContent = offsetLine(new Date(), S.a, S.b);
  }

  /* The dual-track band. Geometry lives here; colors live in style.css. */
  function renderBand() {
    var day = S.day;
    var X0 = 46;
    var X1 = 996;
    var W = X1 - X0;
    var seg, x, w, i;

    function sx(idx) {
      return X0 + (idx / SAMPLES) * W;
    }

    var out = ['<svg viewBox="0 0 1000 150" role="img" aria-label="24-hour timeline for both of you" preserveAspectRatio="xMidYMid meet">'];

    /* track labels */
    out.push('<text class="band-side" x="38" y="47" text-anchor="end">YOU</text>');
    out.push('<text class="band-side" x="38" y="87" text-anchor="end">THEM</text>');

    /* base tracks */
    var tracks = [
      { segs: day.segsA, y: 31 },
      { segs: day.segsB, y: 71 }
    ];
    for (var tI = 0; tI < tracks.length; tI++) {
      for (i = 0; i < tracks[tI].segs.length; i++) {
        seg = tracks[tI].segs[i];
        x = sx(seg.i0);
        w = sx(seg.i1 + 1) - x;
        out.push('<rect class="seg seg-' + seg.state + '" x="' + x.toFixed(1) + '" y="' + tracks[tI].y + '" width="' + w.toFixed(1) + '" height="24" rx="3"/>');
      }
    }

    /* overlap glow spans both tracks */
    for (i = 0; i < day.windows.length; i++) {
      var win = day.windows[i];
      x = sx(win.i0);
      w = sx(win.i1 + 1) - x;
      out.push('<rect class="ovl" x="' + x.toFixed(1) + '" y="27" width="' + w.toFixed(1) + '" height="72" rx="4"/>');
      if (w > 58) {
        out.push('<text class="ovl-label" x="' + (x + w / 2).toFixed(1) + '" y="63" text-anchor="middle">' + fmtDur(win.minutes) + "</text>");
      }
    }

    /* hour ticks: your local hours on top, their matching local time below */
    for (i = 0; i < SAMPLES; i++) {
      var s = day.samples[i];
      if (s.pa.minutes % 180 === 0) {
        x = sx(i);
        if (x - X0 > 26 && X1 - x > 14) {
          out.push('<line class="tick" x1="' + x.toFixed(1) + '" y1="24" x2="' + x.toFixed(1) + '" y2="102"/>');
          out.push('<text class="tickt" x="' + x.toFixed(1) + '" y="16" text-anchor="middle">' + fmtHM(s.pa) + "</text>");
          out.push('<text class="tickt tickb" x="' + x.toFixed(1) + '" y="118" text-anchor="middle">' + fmtHM(s.pb) + "</text>");
        }
      }
    }

    /* now marker */
    out.push('<line class="nowline" x1="' + X0 + '" y1="22" x2="' + X0 + '" y2="104"/>');
    out.push('<text class="nowt" x="' + X0 + '" y="16" text-anchor="start">now</text>');
    out.push('<text class="legend" x="' + X0 + '" y="140">awake &amp; free</text>');
    out.push('<rect class="seg seg-free" x="' + (X0 - 14) + '" y="132" width="10" height="10" rx="2"/>');
    out.push('<text class="legend" x="' + (X0 + 118) + '" y="140">busy</text>');
    out.push('<rect class="seg seg-busy" x="' + (X0 + 104) + '" y="132" width="10" height="10" rx="2"/>');
    out.push('<text class="legend" x="' + (X0 + 196) + '" y="140">asleep</text>');
    out.push('<rect class="seg seg-sleep" x="' + (X0 + 182) + '" y="132" width="10" height="10" rx="2"/>');
    out.push('<text class="legend legend-r" x="' + X1 + '" y="140" text-anchor="end">the glow is both of you</text>');

    out.push("</svg>");
    $("bandBox").innerHTML = out.join("");
  }

  function longestWindow(day) {
    var best = null;
    for (var i = 0; i < day.windows.length; i++) {
      if (!best || day.windows[i].minutes > best.minutes) best = day.windows[i];
    }
    return best;
  }

  function winTimes(win) {
    var s = new Date(win.start);
    var e = new Date(win.end);
    return {
      a: fmtHM(localParts(s, S.a.z)) + "–" + fmtHM(localParts(e, S.a.z)),
      b: fmtHM(localParts(s, S.b.z)) + "–" + fmtHM(localParts(e, S.b.z))
    };
  }

  function renderWindows() {
    var day = S.day;
    var box = $("windowsBox");
    if (!day.windows.length) {
      box.innerHTML = '<p class="no-win">Nothing lines up in the next 24 hours. Nudge a sleep or busy block — fifteen minutes is a start.</p>';
      return;
    }
    /* the hero window leads; the smaller ones follow in day order */
    var main = longestWindow(day);
    var tm = winTimes(main);
    var html =
      '<div class="win main"><div class="win-name">“' + esc(windowName(main, S.a.z, S.b.z)) + '”</div>' +
      '<div class="win-times">' + tm.a + " for you · " + tm.b + " for them · " + fmtDur(main.minutes) + "</div></div>";
    for (var i = 0; i < day.windows.length; i++) {
      var w = day.windows[i];
      if (w === main) continue;
      var t = winTimes(w);
      html += '<div class="win">' + t.a + " you · " + t.b + " them · " + fmtDur(w.minutes) + "</div>";
    }
    box.innerHTML = html;
  }

  /* ------------------------------------------------------ ticking clock */

  function fmtCountdown(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    return (h ? h + "h " : "") + (h || m ? m + "m " : "") + pad2(sec) + "s";
  }

  function bothFreeAt(now) {
    return (
      stateAt(localParts(now, S.a.z), S.schedA) === "free" &&
      stateAt(localParts(now, S.b.z), S.schedB) === "free"
    );
  }

  function renderTick(force) {
    if (!S.a || !S.b || !S.day) return;
    var now = Date.now();
    var d = new Date(now);

    /* live local clocks under each picker */
    $("metaA").textContent = S.a.c + " · " + fmtHM(localParts(d, S.a.z));
    $("metaB").textContent = S.b.c + " · " + fmtHM(localParts(d, S.b.z));

    /* re-sample when we cross a 15-minute boundary */
    if (!force && Math.floor(now / MIN15) !== Math.floor(S.day.t0 / MIN15)) {
      recompute();
      return;
    }

    /* countdown */
    var cd = $("countdown");
    var open = null;
    var next = null;
    for (var i = 0; i < S.day.windows.length; i++) {
      var w = S.day.windows[i];
      if (now >= w.start && now < w.end) open = w;
      else if (w.start > now && (!next || w.start < next.start)) next = w;
    }
    if (open) {
      cd.innerHTML = 'the window is open — closes in <b>' + fmtCountdown(open.end - now) + "</b>";
      cd.classList.add("open");
    } else if (next) {
      cd.innerHTML = 'next window opens in <b>' + fmtCountdown(next.start - now) + "</b>";
      cd.classList.remove("open");
    } else {
      cd.textContent = "no shared window in the next 24 hours";
      cd.classList.remove("open");
    }

    /* odometer: accrue real elapsed time while both are free */
    var delta = now - S.lastTickMs;
    S.lastTickMs = now;
    if (delta > 0 && delta < 120000 && bothFreeAt(d)) {
      S.meter.ms += delta;
      if (now - S.lastSaveMs > 20000) {
        S.lastSaveMs = now;
        saveMeter();
      }
    }
    renderMeter();
  }

  function meterTotalMs() {
    var backfill = 0;
    if (S.meter.met && S.day) {
      var days = Math.floor((Date.now() - Date.parse(S.meter.met)) / 86400000);
      if (days > 0) backfill = days * S.day.overlapMinutes * 60000;
    }
    return backfill + S.meter.ms;
  }

  function renderMeter() {
    var total = meterTotalMs();
    var totalMin = Math.floor(total / 60000);
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    $("meterNum").textContent = h.toLocaleString("en-US");
    $("meterMin").textContent = pad2(m);
    var live = bothFreeAt(new Date());
    $("meterDot").classList.toggle("on", live);
    $("meterSub").textContent = live
      ? "counting — you’re both awake and free right now"
      : S.meter.met
        ? "estimated since " + S.meter.met + ", plus time this page has watched"
        : "counts while this page is open · add your date below to backfill";
  }

  /* ---------------------------------------------------------- share card */

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fitText(ctx, text, font, maxPx, maxW) {
    var size = maxPx;
    do {
      ctx.font = font.replace("{s}", size + "px");
      if (ctx.measureText(text).width <= maxW) break;
      size -= 4;
    } while (size > 18);
    return size;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  var SERIF = 'Georgia, "Times New Roman", "Songti SC", serif';
  var SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';

  function renderShareCard() {
    var cv = $("shareCanvas");
    var W = 1080;
    var H = 1350;
    cv.width = W;
    cv.height = H;
    var ctx = cv.getContext("2d");
    var M = 84;
    var d = new Date();

    /* night sky */
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    var vg = ctx.createRadialGradient(W / 2, 360, 120, W / 2, 700, 1200);
    vg.addColorStop(0, "rgba(30,42,72,0.55)");
    vg.addColorStop(1, "rgba(8,12,24,0)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    var rnd = mulberry32(20240214);
    for (var i = 0; i < 130; i++) {
      var sxr = rnd() * W;
      var syr = rnd() * H;
      var rr = 0.4 + rnd() * 1.1;
      ctx.globalAlpha = 0.06 + rnd() * 0.38;
      ctx.fillStyle = "#dfe6f4";
      ctx.beginPath();
      ctx.arc(sxr, syr, rr, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* wordmark */
    ctx.fillStyle = COLORS.amber;
    ctx.font = "600 26px " + SANS;
    try {
      ctx.letterSpacing = "10px";
    } catch (e) { /* older canvas */ }
    ctx.fillText("O V E R L A P", M, 118);
    try {
      ctx.letterSpacing = "0px";
    } catch (e) { /* noop */ }

    /* cities + local times */
    var cityLine = S.a.n + "  ↔  " + S.b.n;
    var cs = fitText(ctx, cityLine, "italic {s}px " + SERIF, 54, W - 2 * M);
    ctx.font = "italic " + cs + "px " + SERIF;
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(cityLine, M, 208);
    ctx.font = "26px " + SANS;
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(fmtHM(localParts(d, S.a.z)) + " in " + S.a.n + " · " + fmtHM(localParts(d, S.b.z)) + " in " + S.b.n, M, 254);

    /* the number */
    var dur = fmtDur(S.day.overlapMinutes);
    var ds = fitText(ctx, dur, "{s}px " + SERIF, 190, W - 2 * M - 40);
    ctx.font = ds + "px " + SERIF;
    ctx.shadowColor = "rgba(240,183,95,0.55)";
    ctx.shadowBlur = 60;
    ctx.fillStyle = COLORS.warm;
    ctx.fillText(dur, M, 470);
    ctx.shadowBlur = 0;
    ctx.font = "32px " + SANS;
    ctx.fillStyle = COLORS.dim;
    ctx.fillText("a day, awake and free — together", M, 528);

    /* dual-track band */
    var bx = M;
    var bw = W - 2 * M;
    var yA = 640;
    var yB = 700;
    var hT = 42;
    function px(idx) {
      return bx + (idx / SAMPLES) * bw;
    }
    var tracks = [
      { segs: S.day.segsA, y: yA },
      { segs: S.day.segsB, y: yB }
    ];
    for (var tI = 0; tI < 2; tI++) {
      for (i = 0; i < tracks[tI].segs.length; i++) {
        var seg = tracks[tI].segs[i];
        var x = px(seg.i0);
        var w = px(seg.i1 + 1) - x;
        ctx.fillStyle = seg.state === "free" ? COLORS.amberSoft : seg.state === "busy" ? COLORS.busy : COLORS.sleep;
        roundRect(ctx, x + 1, tracks[tI].y, Math.max(2, w - 2), hT, 5);
        ctx.fill();
        if (seg.state === "sleep") {
          ctx.strokeStyle = COLORS.sleepEdge;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }
    /* overlap glow: a translucent wash + hairline, same restraint as the page —
     * the tracks must stay readable underneath it */
    for (i = 0; i < S.day.windows.length; i++) {
      var win = S.day.windows[i];
      var wx = px(win.i0);
      var ww = px(win.i1 + 1) - wx;
      roundRect(ctx, wx + 1, yA - 7, Math.max(3, ww - 2), yB + hT - yA + 14, 7);
      ctx.shadowColor = "rgba(255,233,184,0.55)";
      ctx.shadowBlur = 22;
      ctx.fillStyle = "rgba(255,236,192,0.26)";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = COLORS.glow;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.font = "22px " + SANS;
    ctx.fillStyle = COLORS.dim;
    ctx.fillText("you", bx, yA - 16);
    ctx.fillText("them", bx, yB + hT + 34);

    /* longest window */
    var main = longestWindow(S.day);
    var line3;
    if (main) {
      var t = winTimes(main);
      line3 = "“" + windowName(main, S.a.z, S.b.z) + "” · " + t.a + " / " + t.b;
    } else {
      line3 = "no shared window today — someone’s clock has to bend";
    }
    var ls = fitText(ctx, line3, "italic {s}px " + SERIF, 36, W - 2 * M);
    ctx.font = "italic " + ls + "px " + SERIF;
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(line3, M, 880);

    /* date stamp — a keepsake should know its own day */
    ctx.font = "24px " + SANS;
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }), M, 936);

    /* odometer */
    var totalH = Math.floor(meterTotalMs() / 3600000);
    if (totalH > 0) {
      ctx.font = "600 34px " + SANS;
      ctx.fillStyle = COLORS.amber;
      ctx.fillText(totalH.toLocaleString("en-US") + " hours awake together" + (S.meter.met ? " since " + S.meter.met : ""), M, 1010);
    }

    /* footer */
    ctx.strokeStyle = "rgba(139,147,167,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(M, 1246);
    ctx.lineTo(W - M, 1246);
    ctx.stroke();
    ctx.font = "600 24px " + SANS;
    ctx.fillStyle = COLORS.amber;
    ctx.fillText("overlap.love", M, 1296);
    ctx.font = "24px " + SANS;
    ctx.fillStyle = COLORS.dim;
    ctx.textAlign = "right";
    ctx.fillText("how much of the day is actually yours?", W - M, 1296);
    ctx.textAlign = "left";
    return cv;
  }

  function buildShareText() {
    var d = new Date();
    var lines = ["We overlap for " + fmtDur(S.day.overlapMinutes) + " a day."];
    lines.push(S.a.n + " " + fmtHM(localParts(d, S.a.z)) + " ↔ " + S.b.n + " " + fmtHM(localParts(d, S.b.z)));
    var main = longestWindow(S.day);
    if (main) {
      var t = winTimes(main);
      lines.push("Longest window: “" + windowName(main, S.a.z, S.b.z) + "” — " + t.a + " for me, " + t.b + " for them");
    }
    var totalH = Math.floor(meterTotalMs() / 3600000);
    if (totalH > 0) lines.push(totalH.toLocaleString("en-US") + " hours awake together and counting");
    lines.push("overlap.love");
    return lines.join("\n");
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.classList.remove("show");
    }, 1800);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          toast("Copied.");
        },
        function () {
          fallbackCopy(text);
        }
      );
    } else fallbackCopy(text);
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      toast("Copied.");
    } catch (e) {
      toast("Copy failed — select it yourself, sorry.");
    }
    document.body.removeChild(ta);
  }

  /* ----------------------------------------------------------------- init */

  function init() {
    bindCombo("A");
    bindCombo("B");
    bindSched("A");
    bindSched("B");

    /* restore settings, hash wins over storage for the pair */
    var last = loadJSON(KEY_LAST);
    if (last) {
      var sa = validSched(last.schedA);
      var sb = validSched(last.schedB);
      if (sa) S.schedA = sa;
      if (sb) S.schedB = sb;
      if (typeof last.a === "string") S.a = cityById(last.a);
      if (typeof last.b === "string") S.b = cityById(last.b);
    }
    var fromHash = readHash();
    if (fromHash) {
      S.a = fromHash.a;
      S.b = fromHash.b;
    }
    pushSchedToInputs("A");
    pushSchedToInputs("B");
    if (S.a) $("cityA").value = S.a.n;
    if (S.b) $("cityB").value = S.b.n;

    $("swapBtn").addEventListener("click", function () {
      var c = S.a;
      S.a = S.b;
      S.b = c;
      var sc = S.schedA;
      S.schedA = S.schedB;
      S.schedB = sc;
      $("cityA").value = S.a ? S.a.n : "";
      $("cityB").value = S.b ? S.b.n : "";
      pushSchedToInputs("A");
      pushSchedToInputs("B");
      saveLast();
      writeHash();
      refreshPair();
    });

    $("metDate").addEventListener("change", function () {
      var v = $("metDate").value;
      S.meter.met = /^\d{4}-\d{2}-\d{2}$/.test(v) && Date.parse(v) <= Date.now() ? v : null;
      if (!S.meter.met) $("metDate").value = "";
      saveMeter();
      renderMeter();
    });

    var resetArmed = false;
    $("meterReset").addEventListener("click", function () {
      if (!resetArmed) {
        resetArmed = true;
        $("meterReset").textContent = "sure? this zeroes it";
        setTimeout(function () {
          resetArmed = false;
          $("meterReset").textContent = "reset counter";
        }, 3000);
        return;
      }
      resetArmed = false;
      $("meterReset").textContent = "reset counter";
      S.meter = { v: 1, ms: 0, met: null };
      $("metDate").value = "";
      saveMeter();
      renderMeter();
    });

    $("btnSaveCard").addEventListener("click", function () {
      if (!S.day) return;
      var cv = renderShareCard();
      var url = cv.toDataURL("image/png");
      $("cardPreview").src = url;
      $("cardPreviewBox").hidden = false;
      var a = document.createElement("a");
      a.href = url;
      a.download = "overlap-" + S.a.id + "-" + S.b.id + ".png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast("Card saved.");
    });

    $("btnCopyText").addEventListener("click", function () {
      if (!S.day) return;
      copyText(buildShareText());
    });

    window.addEventListener("hashchange", function () {
      var pair = readHash();
      if (pair) {
        S.a = pair.a;
        S.b = pair.b;
        $("cityA").value = S.a.n;
        $("cityB").value = S.b.n;
        saveLast();
        refreshPair();
      }
    });

    window.addEventListener("pagehide", saveMeter);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") saveMeter();
      else S.lastTickMs = Date.now(); /* don't back-credit throttled background time */
    });

    refreshPair();
    setInterval(function () {
      renderTick(false);
    }, 1000);

    /* expose UI hooks for the smoke test */
    globalThis.Overlap.ui = {
      renderShareCard: renderShareCard,
      buildShareText: buildShareText,
      state: S
    };
  }

  init();
})();
