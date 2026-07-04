/* Word Age — shared pure logic (browser + Node build/tests). No DOM here. */
"use strict";
var WordAgeLib = (function () {

  function hashStr(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h;
  }

  /* Pick the most dramatic anchor for a word-year.
   * - word predates anchor  -> prefer famous AND ancient anchors
   *   ("older than the printing press") : score = fame * (2100 - anchor.y)
   * - word postdates anchor -> prefer famous AND recent anchors
   *   ("younger than sliced bread")     : score = fame * (anchor.y - 500)
   * - same year -> jackpot ("exactly as old as ...")
   * - a gap under 15 years reads flat -> score * 0.4
   * Deterministic variety: hash of the word picks among the top 3 (60/30/10). */
  function pickAnchor(word, year, anchors) {
    var scored = anchors.map(function (a) {
      var s;
      if (a.y === year) s = 1e9;
      else if (a.y > year) s = a.f * (2100 - a.y);
      else s = a.f * (a.y - 500);
      if (a.y !== year && Math.abs(a.y - year) < 15) s *= 0.4;
      return { a: a, s: s };
    }).sort(function (p, q) { return q.s - p.s; });
    var h = hashStr(word) % 10;
    var idx = h < 6 ? 0 : (h < 9 ? 1 : 2);
    return scored[Math.min(idx, scored.length - 1)].a;
  }

  function anchorLine(word, year, anchors) {
    var a = pickAnchor(word, year, anchors);
    if (a.y === year) return "exactly as old as " + a.n + " (" + a.d + ")";
    var diff = Math.abs(a.y - year);
    var rel = year < a.y ? "older" : "younger";
    return rel + " than " + a.n + " (" + a.d + ") by " + diff + (diff === 1 ? " year" : " years");
  }

  function ageOf(year, nowYear) {
    return (nowYear || new Date().getFullYear()) - year;
  }

  function verdictLabel(v) {
    return v === "older" ? "Older than you think" : "Younger than you think";
  }

  /* Word of the Day: local-date seed (same convention as Wordle-style dailies). */
  function wotdIndex(count, nowMs) {
    var t = nowMs === undefined ? Date.now() : nowMs;
    var tzOffset = new Date(t).getTimezoneOffset() * 60000;
    var seed = Math.floor((t - tzOffset) / 86400000);
    return ((seed % count) + count) % count;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var prev = new Array(n + 1), cur = new Array(n + 1), i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[n];
  }

  function normalize(q) {
    return String(q || "").toLowerCase().replace(/[^a-z-]/g, "").slice(0, 32);
  }

  function findExact(q, words) {
    q = normalize(q);
    for (var i = 0; i < words.length; i++) if (words[i].w === q) return words[i];
    return null;
  }

  /* Live-typing matches: prefixes first, then substrings. */
  function prefixMatches(q, words, limit) {
    q = normalize(q);
    if (!q) return [];
    var pre = [], sub = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i].w;
      if (w.indexOf(q) === 0) pre.push(words[i]);
      else if (w.indexOf(q) > 0) sub.push(words[i]);
    }
    pre.sort(function (a, b) { return a.w < b.w ? -1 : 1; });
    sub.sort(function (a, b) { return a.w < b.w ? -1 : 1; });
    return pre.concat(sub).slice(0, limit || 8);
  }

  /* Nearest 3 by edit distance, for the not-found state. */
  function suggest(q, words, n) {
    q = normalize(q);
    return words
      .map(function (w) { return { w: w, dist: levenshtein(q, w.w) }; })
      .sort(function (a, b) { return a.dist - b.dist || (a.w.w < b.w.w ? -1 : 1); })
      .slice(0, n || 3)
      .map(function (x) { return x.w; });
  }

  /* 4 deterministic related words: 2 nearest by year, 1 same first letter,
   * 1 same verdict picked by hash. Stable across builds -> stable SEO links. */
  function related(entry, words) {
    var others = words.filter(function (w) { return w.w !== entry.w; });
    var used = {}, picks = [];
    function take(w) { if (w && !used[w.w] && picks.length < 4) { used[w.w] = 1; picks.push(w); } }
    var byYear = others.slice().sort(function (a, b) {
      return Math.abs(a.y - entry.y) - Math.abs(b.y - entry.y) || (a.w < b.w ? -1 : 1);
    });
    take(byYear[0]); take(byYear[1]);
    var sameLetter = others.filter(function (w) { return w.w.charAt(0) === entry.w.charAt(0) && !used[w.w]; })
      .sort(function (a, b) { return Math.abs(a.y - entry.y) - Math.abs(b.y - entry.y) || (a.w < b.w ? -1 : 1); });
    take(sameLetter[0]);
    var sameV = others.filter(function (w) { return w.v === entry.v && !used[w.w]; });
    if (sameV.length) take(sameV[hashStr(entry.w) % sameV.length]);
    for (var i = 2; picks.length < 4 && i < byYear.length; i++) take(byYear[i]);
    return picks;
  }

  /* Plain-text share block. Zero spoilers beyond the word itself; ends with a
   * return link. `line` is the precomputed anchor line, `site` the origin. */
  function shareText(entry, line, site, nowYear) {
    var age = ageOf(entry.y, nowYear);
    return "WORD AGE — " + entry.w + "\n" +
      "b. " + entry.d + " (≈ " + age + " years old)\n" +
      "Then: “" + entry.orig + "”\n" +
      line.charAt(0).toUpperCase() + line.slice(1) + ".\n" +
      verdictLabel(entry.v) + ".\n" +
      site + "/words/" + entry.w + ".html";
  }

  return {
    hashStr: hashStr,
    pickAnchor: pickAnchor,
    anchorLine: anchorLine,
    ageOf: ageOf,
    verdictLabel: verdictLabel,
    wotdIndex: wotdIndex,
    levenshtein: levenshtein,
    normalize: normalize,
    findExact: findExact,
    prefixMatches: prefixMatches,
    suggest: suggest,
    related: related,
    shareText: shareText
  };
})();
if (typeof module !== "undefined" && module.exports) { module.exports = WordAgeLib; }
