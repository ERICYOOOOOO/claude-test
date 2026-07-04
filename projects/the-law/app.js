/* 今日之律 The Law — 每日归纳推理谜题
 * 纯静态零依赖。引擎部分为纯函数，node 可直接 require 做单元测试。
 */
'use strict';

/* ================= 引擎 ================= */

var MIN = 1, MAX = 20;
var LAUNCH_DAY = 20497;              /* 第 1 期 = 2026-02-13（本地日序号） */
var SITE_HOST = 'thelaw.day';        /* 部署时替换为真实域名（见 DEPLOY.md） */
var EXAM_SIZE = 8, EXAM_POS = 4;
var HINT_KEY = '2,4,6';              /* 示例提示样本，不进终审题面 */

function mulberry32(a) {
  a = a >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashDay(day, salt) {
  var h = (day ^ salt) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

var PRIMES = new Set([2, 3, 5, 7, 11, 13, 17, 19]);
var SQUARES = new Set([1, 4, 9, 16]);
var SUM_PRIMES = (function () {
  var s = new Set();
  for (var n = 2; n <= 60; n++) {
    var p = true;
    for (var i = 2; i * i <= n; i++) if (n % i === 0) { p = false; break; }
    if (p) s.add(n);
  }
  return s;
})();

function srt(t) { return t.slice().sort(function (a, b) { return a - b; }); }
function sum3(t) { return t[0] + t[1] + t[2]; }

var ZH_POS = ['一', '二', '三'];
var ZH_PAR = ['偶', '奇'];

/* 规则库：39 个参数化模板，tier 1 最易 / 3 最难。
 * 红线：每个（模板×参数）实例在 8000 个三元组域内正例率 ∈ [10%, 90%]
 * （test/rules.mjs 全域遍历断言）。 */
var RULES = [
  /* ---- 一档 ---- */
  { id: 'inc', tier: 1, params: [{}],
    desc: function () { return '三个数严格递增（a < b < c）'; },
    pred: function (t) { return t[0] < t[1] && t[1] < t[2]; } },
  { id: 'dec', tier: 1, params: [{}],
    desc: function () { return '三个数严格递减（a > b > c）'; },
    pred: function (t) { return t[0] > t[1] && t[1] > t[2]; } },
  { id: 'sum-parity', tier: 1, params: [{ par: 0 }, { par: 1 }],
    desc: function (p) { return '三数之和是' + ZH_PAR[p.par] + '数'; },
    pred: function (t, p) { return sum3(t) % 2 === p.par; } },
  { id: 'all-parity', tier: 1, params: [{ par: 0 }, { par: 1 }],
    desc: function (p) { return '三个数全是' + ZH_PAR[p.par] + '数'; },
    pred: function (t, p) { return t.every(function (x) { return x % 2 === p.par; }); } },
  { id: 'all-le', tier: 1, params: [{ k: 10 }, { k: 12 }, { k: 14 }, { k: 16 }],
    desc: function (p) { return '每个数都不超过 ' + p.k; },
    pred: function (t, p) { return t.every(function (x) { return x <= p.k; }); } },
  { id: 'all-ge', tier: 1, params: [{ k: 5 }, { k: 7 }, { k: 9 }, { k: 11 }],
    desc: function (p) { return '每个数都不小于 ' + p.k; },
    pred: function (t, p) { return t.every(function (x) { return x >= p.k; }); } },
  { id: 'nondec', tier: 1, params: [{}],
    desc: function () { return '从左到右不减（a ≤ b ≤ c）'; },
    pred: function (t) { return t[0] <= t[1] && t[1] <= t[2]; } },
  { id: 'noninc', tier: 1, params: [{}],
    desc: function () { return '从左到右不增（a ≥ b ≥ c）'; },
    pred: function (t) { return t[0] >= t[1] && t[1] >= t[2]; } },
  { id: 'sum-ge', tier: 1, params: [{ k: 27 }, { k: 32 }, { k: 37 }],
    desc: function (p) { return '三数之和不小于 ' + p.k; },
    pred: function (t, p) { return sum3(t) >= p.k; } },
  { id: 'sum-le', tier: 1, params: [{ k: 26 }, { k: 31 }, { k: 36 }],
    desc: function (p) { return '三数之和不超过 ' + p.k; },
    pred: function (t, p) { return sum3(t) <= p.k; } },
  { id: 'last-max', tier: 1, params: [{}],
    desc: function () { return 'c 是唯一的最大值（c > a 且 c > b）'; },
    pred: function (t) { return t[2] > t[0] && t[2] > t[1]; } },
  { id: 'first-min', tier: 1, params: [{}],
    desc: function () { return 'a 是唯一的最小值（a < b 且 a < c）'; },
    pred: function (t) { return t[0] < t[1] && t[0] < t[2]; } },
  { id: 'pos-parity', tier: 1,
    params: [{ pos: 0, par: 0 }, { pos: 1, par: 0 }, { pos: 2, par: 0 },
             { pos: 0, par: 1 }, { pos: 1, par: 1 }, { pos: 2, par: 1 }],
    desc: function (p) { return '第' + ZH_POS[p.pos] + '个数是' + ZH_PAR[p.par] + '数'; },
    pred: function (t, p) { return t[p.pos] % 2 === p.par; } },

  /* ---- 二档 ---- */
  { id: 'has-prime', tier: 2, params: [{ mode: 1 }, { mode: 0 }],
    desc: function (p) { return p.mode ? '至少含一个质数' : '三个数中没有质数'; },
    pred: function (t, p) {
      var has = t.some(function (x) { return PRIMES.has(x); });
      return p.mode ? has : !has;
    } },
  { id: 'two-equal', tier: 2, params: [{}],
    desc: function () { return '恰好有两个数相等'; },
    pred: function (t) {
      var eq = (t[0] === t[1]) + (t[1] === t[2]) + (t[0] === t[2]);
      return eq === 1;
    } },
  { id: 'distinct', tier: 2, params: [{}],
    desc: function () { return '三个数互不相同'; },
    pred: function (t) { return t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2]; } },
  { id: 'range-le', tier: 2, params: [{ k: 5 }, { k: 6 }, { k: 8 }, { k: 10 }],
    desc: function (p) { return '极差（最大 − 最小）不超过 ' + p.k; },
    pred: function (t, p) { return Math.max(t[0], t[1], t[2]) - Math.min(t[0], t[1], t[2]) <= p.k; } },
  { id: 'range-ge', tier: 2, params: [{ k: 8 }, { k: 10 }, { k: 12 }],
    desc: function (p) { return '极差（最大 − 最小）不小于 ' + p.k; },
    pred: function (t, p) { return Math.max(t[0], t[1], t[2]) - Math.min(t[0], t[1], t[2]) >= p.k; } },
  { id: 'sum-mod', tier: 2, params: [{ m: 3 }, { m: 4 }, { m: 5 }],
    desc: function (p) { return '三数之和是 ' + p.m + ' 的倍数'; },
    pred: function (t, p) { return sum3(t) % p.m === 0; } },
  { id: 'mid-extreme', tier: 2, params: [{ mode: 'max' }, { mode: 'min' }],
    desc: function (p) { return p.mode === 'max' ? 'b 是唯一的最大值' : 'b 是唯一的最小值'; },
    pred: function (t, p) {
      return p.mode === 'max' ? (t[1] > t[0] && t[1] > t[2]) : (t[1] < t[0] && t[1] < t[2]);
    } },
  { id: 'some-equal', tier: 2, params: [{}],
    desc: function () { return '至少有两个数相等'; },
    pred: function (t) { return t[0] === t[1] || t[1] === t[2] || t[0] === t[2]; } },
  { id: 'has-k', tier: 2, params: [{ k: 5 }, { k: 7 }, { k: 10 }, { k: 13 }, { k: 17 }],
    desc: function (p) { return '至少有一个数等于 ' + p.k; },
    pred: function (t, p) { return t.indexOf(p.k) !== -1; } },
  { id: 'ab-c', tier: 2, params: [{ mode: 'gt' }, { mode: 'le' }],
    desc: function (p) { return p.mode === 'gt' ? '前两数之和大于第三数（a + b > c）' : '前两数之和不超过第三数（a + b ≤ c）'; },
    pred: function (t, p) { return p.mode === 'gt' ? t[0] + t[1] > t[2] : t[0] + t[1] <= t[2]; } },
  { id: 'prod-parity', tier: 2, params: [{ par: 0 }, { par: 1 }],
    desc: function (p) { return '三数之积是' + ZH_PAR[p.par] + '数'; },
    pred: function (t, p) { return (t[0] * t[1] * t[2]) % 2 === p.par; } },
  { id: 'adj-gap', tier: 2, params: [{ k: 2 }, { k: 3 }, { k: 4 }, { k: 5 }],
    desc: function (p) { return '相邻两数（a 与 b、b 与 c）都至少相差 ' + p.k; },
    pred: function (t, p) { return Math.abs(t[0] - t[1]) >= p.k && Math.abs(t[1] - t[2]) >= p.k; } },
  { id: 'count-even', tier: 2, params: [{ k: 1 }, { k: 2 }],
    desc: function (p) { return '恰有 ' + p.k + ' 个偶数'; },
    pred: function (t, p) { return t.filter(function (x) { return x % 2 === 0; }).length === p.k; } },

  /* ---- 三档 ---- */
  { id: 'triangle', tier: 3, params: [{ mode: 1 }, { mode: 0 }],
    desc: function (p) { return p.mode ? '三个数能构成三角形（任两数之和大于第三数）' : '三个数不能构成三角形'; },
    pred: function (t, p) {
      var s = srt(t);
      var can = s[0] + s[1] > s[2];
      return p.mode ? can : !can;
    } },
  { id: 'sum-prime', tier: 3, params: [{}],
    desc: function () { return '三数之和是质数'; },
    pred: function (t) { return SUM_PRIMES.has(sum3(t)); } },
  { id: 'has-square', tier: 3, params: [{ mode: 1 }, { mode: 0 }],
    desc: function (p) { return p.mode ? '至少含一个完全平方数（1、4、9、16）' : '不含任何完全平方数（1、4、9、16）'; },
    pred: function (t, p) {
      var has = t.some(function (x) { return SQUARES.has(x); });
      return p.mode ? has : !has;
    } },
  { id: 'ends-parity', tier: 3, params: [{ mode: 1 }, { mode: 0 }],
    desc: function (p) { return p.mode ? 'a 与 c 的奇偶性相同' : 'a 与 c 的奇偶性不同'; },
    pred: function (t, p) { return (t[0] % 2 === t[2] % 2) === !!p.mode; } },
  { id: 'median-ge', tier: 3, params: [{ k: 9 }, { k: 11 }, { k: 13 }],
    desc: function (p) { return '三数的中位数不小于 ' + p.k; },
    pred: function (t, p) { return srt(t)[1] >= p.k; } },
  { id: 'count-big', tier: 3, params: [{ k: 1 }, { k: 2 }],
    desc: function (p) { return '恰有 ' + p.k + ' 个数不小于 11'; },
    pred: function (t, p) { return t.filter(function (x) { return x >= 11; }).length === p.k; } },
  { id: 'prod-mod', tier: 3, params: [{ m: 3 }, { m: 4 }, { m: 5 }],
    desc: function (p) { return '三数之积是 ' + p.m + ' 的倍数'; },
    pred: function (t, p) { return (t[0] * t[1] * t[2]) % p.m === 0; } },
  { id: 'mono-any', tier: 3, params: [{}],
    desc: function () { return '三个数严格单调（递增或递减都算）'; },
    pred: function (t) { return (t[0] < t[1] && t[1] < t[2]) || (t[0] > t[1] && t[1] > t[2]); } },
  { id: 'mid-mean', tier: 3, params: [{ mode: 'lt' }, { mode: 'gt' }],
    desc: function (p) { return p.mode === 'lt' ? 'b 严格小于 a、c 的平均值' : 'b 严格大于 a、c 的平均值'; },
    pred: function (t, p) { return p.mode === 'lt' ? t[0] + t[2] > 2 * t[1] : t[0] + t[2] < 2 * t[1]; } },
  { id: 'peak-valley', tier: 3, params: [{}],
    desc: function () { return 'b 是严格的峰或谷（比两边都大，或比两边都小）'; },
    pred: function (t) { return (t[1] > t[0] && t[1] > t[2]) || (t[1] < t[0] && t[1] < t[2]); } },
  { id: 'between', tier: 3, params: [{}],
    desc: function () { return 'c 严格介于 a 和 b 之间'; },
    pred: function (t) {
      var lo = Math.min(t[0], t[1]), hi = Math.max(t[0], t[1]);
      return t[2] > lo && t[2] < hi;
    } },
  { id: 'max2min', tier: 3, params: [{ f: 2 }, { f: 3 }],
    desc: function (p) { return '最大值不超过最小值的 ' + p.f + ' 倍'; },
    pred: function (t, p) { return Math.max(t[0], t[1], t[2]) <= p.f * Math.min(t[0], t[1], t[2]); } },
  { id: 'near-ap', tier: 3, params: [{ d: 2 }, { d: 3 }, { d: 4 }],
    desc: function (p) { return '中间数接近两端的平均值（|2b − a − c| ≤ ' + p.d + '）'; },
    pred: function (t, p) { return Math.abs(2 * t[1] - t[0] - t[2]) <= p.d; } }
];

/* 难度曲线：索引 0=周日。周一最易，周六最难（地狱日）。 */
var TIER_BY_WEEKDAY = [2, 1, 1, 2, 2, 2, 3];

function localDayIndex(now) {
  var d = now || new Date();
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}
function issueOf(day) { return day - LAUNCH_DAY + 1; }
function weekdayOf(day) { return ((day % 7) + 7 + 4) % 7; }
function tierOf(day) { return TIER_BY_WEEKDAY[weekdayOf(day)]; }

/* 每日规则选择：循环取模保证任意日序号（含 376 天后）恒能选出合法规则。 */
function dailyRule(day) {
  var rng = mulberry32(hashDay(day, 0x1A2A4F));
  var tier = tierOf(day);
  var pool = RULES.filter(function (r) { return r.tier === tier; });
  var tpl = pool[Math.floor(rng() * pool.length) % pool.length];
  var param = tpl.params[Math.floor(rng() * tpl.params.length) % tpl.params.length];
  return {
    day: day, issue: issueOf(day), tier: tier, tpl: tpl, param: param,
    text: tpl.desc(param),
    pred: function (t) { return !!tpl.pred(t, param); }
  };
}

/* 终审出题：种子确定性，4 正 + 4 负，负例优先近失变体（覆盖易混边界）。
 * 判定标签与 dailyRule().pred 同源。 */
function buildExam(day) {
  var rule = dailyRule(day);
  var rng = mulberry32(hashDay(day, 0x5EED8));
  var seen = new Set([HINT_KEY]);
  var rnd1 = function () { return MIN + Math.floor(rng() * (MAX - MIN + 1)); };
  var scan = function (wantPos) {
    for (var a = MIN; a <= MAX; a++) for (var b = MIN; b <= MAX; b++) for (var c = MIN; c <= MAX; c++) {
      var t = [a, b, c];
      if (seen.has(t.join(','))) continue;
      if (rule.pred(t) === wantPos) return t;
    }
    throw new Error('exam-gen-exhausted');
  };

  var pos = [], neg = [], guard = 0, t, key;
  while (pos.length < EXAM_POS) {
    t = ++guard > 4000 ? scan(true) : [rnd1(), rnd1(), rnd1()];
    key = t.join(',');
    if (seen.has(key) || !rule.pred(t)) continue;
    seen.add(key); pos.push(t);
  }
  guard = 0;
  var DELTAS = [-2, -1, 1, 2];
  while (neg.length < EXAM_SIZE - EXAM_POS) {
    guard++;
    if (guard <= 60) {           /* 近失变体：改动正例的一个分量 */
      var base = pos[Math.floor(rng() * pos.length)];
      var i = Math.floor(rng() * 3);
      var d = DELTAS[Math.floor(rng() * DELTAS.length)];
      t = base.slice();
      t[i] = Math.min(MAX, Math.max(MIN, t[i] + d));
    } else if (guard <= 4000) {
      t = [rnd1(), rnd1(), rnd1()];
    } else {
      t = scan(false);
    }
    key = t.join(',');
    if (seen.has(key) || rule.pred(t)) continue;
    seen.add(key); neg.push(t);
  }

  var items = pos.map(function (x) { return { t: x, label: true }; })
    .concat(neg.map(function (x) { return { t: x, label: false }; }));
  for (var j = items.length - 1; j > 0; j--) {
    var k2 = Math.floor(rng() * (j + 1));
    var tmp = items[j]; items[j] = items[k2]; items[k2] = tmp;
  }
  return { rule: rule, items: items };
}

function verdictOf(correct) {
  return correct >= 7 ? 'CRACKED' : correct >= 5 ? 'PARTIAL' : 'FAILED';
}
var VERDICT_ZH = { CRACKED: '破解成功', PARTIAL: '部分破译', FAILED: '未破解' };

function shareText(issue, traj, correct, practice) {
  var lines = ['THE LAW #' + issue + (practice ? '（练习）' : '')];
  for (var i = 0; i < traj.length; i += 10) {
    lines.push(traj.slice(i, i + 10).map(function (ok) { return ok ? '🟩' : '🟥'; }).join(''));
  }
  lines.push(traj.length + ' 次实验 · 终审 ' + correct + '/8 ⚖️');
  lines.push(SITE_HOST);
  return lines.join('\n');
}

function pad4(n) { return String(n).padStart(4, '0'); }
function pad2(n) { return String(n).padStart(2, '0'); }
function dateOfDay(day) {
  var dt = new Date(day * 86400000 + 43200000);
  return dt.getUTCFullYear() + ' · ' + pad2(dt.getUTCMonth() + 1) + ' · ' + pad2(dt.getUTCDate());
}
function dateOfDayShort(day) {
  var dt = new Date(day * 86400000 + 43200000);
  return dt.getUTCFullYear() + '-' + pad2(dt.getUTCMonth() + 1) + '-' + pad2(dt.getUTCDate());
}

/* node 单元测试出口 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RULES: RULES, TIER_BY_WEEKDAY: TIER_BY_WEEKDAY,
    MIN: MIN, MAX: MAX, LAUNCH_DAY: LAUNCH_DAY, HINT_KEY: HINT_KEY,
    mulberry32: mulberry32, hashDay: hashDay,
    localDayIndex: localDayIndex, issueOf: issueOf, weekdayOf: weekdayOf, tierOf: tierOf,
    dailyRule: dailyRule, buildExam: buildExam,
    verdictOf: verdictOf, shareText: shareText
  };
}

/* ================= 存储 ================= */

var LS_KEY = 'thelaw.v1';

function defaultStore() {
  return { v: 1, streak: 0, best: 0, lastCracked: -1, history: {}, today: null };
}
function intOr(v, dflt) { return Number.isFinite(v) ? Math.floor(v) : dflt; }

function sanitizeTriple(t) {
  if (!Array.isArray(t) || t.length !== 3) return null;
  var out = [];
  for (var i = 0; i < 3; i++) {
    var x = intOr(t[i], NaN);
    if (!(x >= MIN && x <= MAX)) return null;
    out.push(x);
  }
  return out;
}

function sanitizeToday(o) {
  if (!o || typeof o !== 'object') return null;
  var issue = intOr(o.issue, NaN), day = intOr(o.day, NaN);
  if (!Number.isFinite(issue) || !Number.isFinite(day)) return null;
  var phase = (o.phase === 'exam' || o.phase === 'done') ? o.phase : 'lab';
  var exps = [];
  if (Array.isArray(o.exps)) {
    for (var i = 0; i < o.exps.length && i < 500; i++) {
      var e = o.exps[i];
      var t = e && sanitizeTriple(e.t);
      if (t) exps.push({ t: t, ok: !!e.ok });
    }
  }
  var answers = [];
  if (Array.isArray(o.answers)) {
    for (var j = 0; j < o.answers.length && j < EXAM_SIZE; j++) answers.push(!!o.answers[j]);
  }
  if (phase === 'lab') answers = [];
  return { issue: issue, day: day, phase: phase, exps: exps, answers: answers };
}

function loadStore() {
  var s = defaultStore();
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (!raw) return s;
    var o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || o.v !== 1) return s;
    s.streak = Math.max(0, intOr(o.streak, 0));
    s.best = Math.max(0, intOr(o.best, 0));
    s.lastCracked = intOr(o.lastCracked, -1);
    if (o.history && typeof o.history === 'object' && !Array.isArray(o.history)) {
      Object.keys(o.history).slice(0, 4000).forEach(function (k) {
        var h = o.history[k];
        if (!h || typeof h !== 'object') return;
        var n = intOr(h.n, NaN), c = intOr(h.k, NaN);
        if (!(n >= 0) || !(c >= 0 && c <= EXAM_SIZE)) return;
        s.history[k] = {
          n: n, k: c,
          verdict: VERDICT_ZH[h.verdict] ? h.verdict : verdictOf(c),
          traj: (typeof h.traj === 'string' && /^[01]*$/.test(h.traj)) ? h.traj.slice(0, 500) : '',
          practice: !!h.practice
        };
      });
    }
    s.today = sanitizeToday(o.today);
    return s;
  } catch (e) {
    return defaultStore();
  }
}
function saveStore(store) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch (e) { /* 存不进就算了 */ }
}

/* ================= UI ================= */

function initUI() {
  var $ = function (id) { return document.getElementById(id); };
  var REDUCED = false;
  try { REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var store = loadStore();
  var realDay = localDayIndex();
  var realIssue = issueOf(realDay);

  /* 跨日：丢弃过期未完成卷宗 */
  if (store.today && store.today.issue !== realIssue) { store.today = null; saveStore(store); }
  if (!store.today) {
    store.today = { issue: realIssue, day: realDay, phase: 'lab', exps: [], answers: [] };
    saveStore(store);
  }

  /* session：当前正在玩的卷宗（今日=持久，练习=内存） */
  var session = null;
  var exam = null;           /* buildExam 结果缓存 */
  var lastSubmitAt = 0;
  var examLocked = false;
  var countdownTimer = null;

  var els = {
    streakBox: $('streakBox'), newDayBar: $('newDayBar'), reloadBtn: $('reloadBtn'),
    practiceBar: $('practiceBar'), practiceLabel: $('practiceLabel'), exitPracticeBtn: $('exitPracticeBtn'),
    fileNo: $('fileNo'), fileDate: $('fileDate'), fileDiff: $('fileDiff'), lawText: $('lawText'),
    labSec: $('labSec'), examSec: $('examSec'), resultSec: $('resultSec'), archiveSec: $('archiveSec'),
    submitBtn: $('submitBtn'), finalBtn: $('finalBtn'), hint: $('hint'), benchNote: $('benchNote'),
    bench: $('bench'),
    confirmBox: $('confirmBox'), confirmZero: $('confirmZero'), confirmGo: $('confirmGo'), confirmBack: $('confirmBack'),
    ledgerBody: $('ledgerBody'), ledgerEmpty: $('ledgerEmpty'),
    qNum: $('qNum'), examDots: $('examDots'), examCard: $('examCard'),
    examTriple: $('examTriple'), examStampSlot: $('examStampSlot'),
    voteOk: $('voteOk'), voteNo: $('voteNo'), examFeedback: $('examFeedback'),
    bigStamp: $('bigStamp'), verdictSub: $('verdictSub'), lawReveal: $('lawReveal'),
    resultStats: $('resultStats'), shareTextEl: $('shareTextEl'),
    copyBtn: $('copyBtn'), pngBtn: $('pngBtn'), shareNote: $('shareNote'), shareCanvas: $('shareCanvas'),
    countdown: $('countdown'), archiveBtn: $('archiveBtn'),
    archiveList: $('archiveList'), archiveBack: $('archiveBack'),
    sheet: document.querySelector('.sheet'),
    nums: [$('num0'), $('num1'), $('num2')]
  };

  /* ---------- 小工具 ---------- */

  function stampEl(ok, big) {
    var s = document.createElement('span');
    s.className = 'stamp ' + (ok ? 'ok' : 'no') + (big ? ' big' : '');
    s.textContent = ok ? '✓ 合法' : '✗ 非法';
    s.style.setProperty('--rot', (Math.random() * 6 - 3).toFixed(2) + 'deg');
    return s;
  }
  function shakePaper() {
    if (REDUCED || !els.sheet) return;
    els.sheet.classList.remove('shake');
    void els.sheet.offsetWidth;
    els.sheet.classList.add('shake');
  }
  function show(sec) {
    [els.labSec, els.examSec, els.resultSec, els.archiveSec].forEach(function (x) {
      if (x) x.hidden = (x !== sec);
    });
    var dossierVisible = (sec !== els.archiveSec);
    $('dossierHead').hidden = !dossierVisible;
  }
  function note(el, msg) {
    el.textContent = msg;
    if (msg) {
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.textContent = ''; }, 3200);
    }
  }
  function trajOf(sess) { return sess.exps.map(function (e) { return e.ok; }); }
  function correctOf(sess) {
    var c = 0;
    for (var i = 0; i < sess.answers.length && i < exam.items.length; i++) {
      if (sess.answers[i] === exam.items[i].label) c++;
    }
    return c;
  }
  function persist() { if (session === store.today) saveStore(store); }

  /* ---------- 抬头 ---------- */

  function renderHead() {
    var rule = exam.rule;
    els.fileNo.textContent = '№ ' + pad4(session.issue);
    els.fileDate.textContent = dateOfDay(session.day);
    var dots = '';
    for (var i = 1; i <= 3; i++) dots += i <= rule.tier ? '●' : '○';
    els.fileDiff.textContent = dots;
    els.fileDiff.setAttribute('aria-label', '难度 ' + rule.tier + ' / 3');
    els.streakBox.textContent = '连胜 ' + store.streak;
    if (session.phase === 'done') {
      els.lawText.textContent = rule.text;
      els.lawText.classList.remove('redacted');
    } else {
      els.lawText.textContent = '████████████████';
      els.lawText.classList.add('redacted');
    }
    var isPractice = session !== store.today;
    els.practiceBar.hidden = !isPractice;
    if (isPractice) {
      els.practiceLabel.textContent = '练习 · 卷宗 № ' + pad4(session.issue) + ' · 不计连胜';
    }
  }

  /* ---------- 实验台 ---------- */

  function readTriple() {
    var t = [];
    for (var i = 0; i < 3; i++) {
      var v = parseInt(els.nums[i].value, 10);
      if (!Number.isFinite(v)) v = MIN;
      v = Math.min(MAX, Math.max(MIN, v));
      els.nums[i].value = v;
      t.push(v);
    }
    return t;
  }

  function renderLedger() {
    els.ledgerBody.textContent = '';
    els.ledgerEmpty.hidden = session.exps.length > 0;
    for (var i = session.exps.length - 1; i >= 0; i--) {
      els.ledgerBody.appendChild(ledgerRow(i, session.exps[i], false));
    }
    els.hint.hidden = session.exps.length > 0;
  }

  function ledgerRow(idx, e, animate) {
    var tr = document.createElement('tr');
    if (animate && !REDUCED) tr.className = 'fresh';
    var td1 = document.createElement('td');
    td1.className = 'mono';
    td1.textContent = pad2(idx + 1);
    var td2 = document.createElement('td');
    td2.className = 'mono sample';
    td2.textContent = e.t[0] + ' · ' + e.t[1] + ' · ' + e.t[2];
    var td3 = document.createElement('td');
    td3.appendChild(stampEl(e.ok, false));
    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
    return tr;
  }

  function submitExperiment() {
    if (session.phase !== 'lab') return;
    var now = Date.now();
    if (now - lastSubmitAt < 250) return;   /* 连点节流 */
    lastSubmitAt = now;
    var t = readTriple();
    var key = t.join(',');
    for (var i = 0; i < session.exps.length; i++) {
      if (session.exps[i].t.join(',') === key) {
        note(els.benchNote, '这组已实验过（№ ' + pad2(i + 1) + '），不再计次。');
        return;
      }
    }
    var ok = exam.rule.pred(t);
    session.exps.push({ t: t, ok: ok });
    persist();
    els.hint.hidden = true;
    els.ledgerEmpty.hidden = true;
    els.ledgerBody.insertBefore(ledgerRow(session.exps.length - 1, session.exps[session.exps.length - 1], true), els.ledgerBody.firstChild);
    shakePaper();
  }

  function stepNum(idx, d) {
    var v = parseInt(els.nums[idx].value, 10);
    if (!Number.isFinite(v)) v = MIN;
    v = Math.min(MAX, Math.max(MIN, v + d));
    els.nums[idx].value = v;
  }

  /* ---------- 终审 ---------- */

  function openConfirm() {
    if (session.phase !== 'lab') return;
    els.confirmBox.hidden = false;
    els.confirmZero.hidden = session.exps.length > 0;
    els.bench.hidden = true;
    els.confirmGo.focus();
  }
  function closeConfirm() {
    els.confirmBox.hidden = true;
    els.bench.hidden = false;
    els.finalBtn.focus();
  }
  function startExam() {
    session.phase = 'exam';
    session.answers = [];
    persist();
    els.confirmBox.hidden = true;
    els.bench.hidden = false;
    renderPhase();
  }

  function renderExamDots() {
    els.examDots.textContent = '';
    for (var i = 0; i < EXAM_SIZE; i++) {
      var d = document.createElement('span');
      d.className = 'dot-q';
      if (i < session.answers.length) {
        d.className += session.answers[i] === exam.items[i].label ? ' right' : ' wrong';
      } else if (i === session.answers.length) {
        d.className += ' current';
      }
      els.examDots.appendChild(d);
    }
  }

  function renderExamQuestion() {
    var idx = session.answers.length;
    if (idx >= EXAM_SIZE) { settle(); return; }
    examLocked = false;
    var it = exam.items[idx];
    els.qNum.textContent = idx + 1;
    els.examTriple.textContent = it.t[0] + ' · ' + it.t[1] + ' · ' + it.t[2];
    els.examStampSlot.textContent = '';
    els.examFeedback.textContent = '';
    els.voteOk.disabled = false;
    els.voteNo.disabled = false;
    renderExamDots();
    if (!REDUCED) {
      els.examCard.classList.remove('slide-in');
      void els.examCard.offsetWidth;
      els.examCard.classList.add('slide-in');
    }
  }

  function answerExam(guess) {
    if (session.phase !== 'exam' || examLocked) return;
    var idx = session.answers.length;
    if (idx >= EXAM_SIZE) return;
    examLocked = true;
    els.voteOk.disabled = true;
    els.voteNo.disabled = true;
    var it = exam.items[idx];
    session.answers.push(guess);
    persist();
    els.examStampSlot.appendChild(stampEl(it.label, true));
    shakePaper();
    var right = guess === it.label;
    els.examFeedback.textContent = right ? '判对。' : '判错。';
    els.examFeedback.className = 'exam-feedback ' + (right ? 'good' : 'bad');
    renderExamDots();
    var sess = session;   /* 换题窗口内若退出练习（session 切换），该定时器作废 */
    setTimeout(function () {
      if (session !== sess || session.phase !== 'exam') return;
      if (session.answers.length >= EXAM_SIZE) {
        session.phase = 'done';
        settleOnce();
        persist();
        renderPhase();
      } else {
        renderExamQuestion();
      }
    }, REDUCED ? 200 : 800);
  }

  /* ---------- 结案 ---------- */

  function settleOnce() {
    var issueKey = String(session.issue);
    var correct = correctOf(session);
    var isPractice = session !== store.today;
    var entry = {
      n: session.exps.length, k: correct,
      verdict: verdictOf(correct),
      traj: trajOf(session).map(function (b) { return b ? '1' : '0'; }).join(''),
      practice: isPractice
    };
    if (!isPractice) {
      var cracked = correct >= 7;
      if (cracked) {
        store.streak = (store.lastCracked === session.issue - 1) ? store.streak + 1 : 1;
        store.lastCracked = session.issue;
      } else {
        store.streak = 0;
      }
      store.best = Math.max(store.best, store.streak);
      store.history[issueKey] = entry;
    } else if (!store.history[issueKey] || store.history[issueKey].practice) {
      store.history[issueKey] = entry;
    }
    saveStore(store);
  }

  function settle() { /* 兜底：answers 已满但 phase 未翻转（异常恢复路径） */
    if (session.phase !== 'done') {
      session.phase = 'done';
      settleOnce();
      persist();
    }
    renderPhase();
  }

  function renderResult() {
    var correct = correctOf(session);
    var v = verdictOf(correct);
    var isPractice = session !== store.today;
    els.bigStamp.textContent = v;
    els.bigStamp.className = 'big-stamp ' + v.toLowerCase();
    els.bigStamp.style.setProperty('--rot', (Math.random() * 6 - 11).toFixed(2) + 'deg');
    els.verdictSub.textContent = correct === 8 ? '完美破解' : VERDICT_ZH[v];
    els.lawReveal.textContent = exam.rule.text;
    els.resultStats.textContent = session.exps.length + ' 次实验 · 终审 ' + correct + '/8';
    var txt = shareText(session.issue, trajOf(session), correct, isPractice);
    els.shareTextEl.textContent = txt;
    els.countdown.hidden = isPractice;
    drawShareCard(els.shareCanvas, {
      issue: session.issue, traj: trajOf(session), correct: correct,
      verdict: v, perfect: correct === 8, dateStr: dateOfDay(session.day)
    });
    if (!isPractice) startCountdown();
  }

  function startCountdown() {
    clearInterval(countdownTimer);
    var tick = function () {
      var now = new Date();
      var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
      var ms = next - now;
      if (ms <= 0) { checkNewDay(); return; }
      var h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
      els.countdown.textContent = '距下一期 ' + pad2(h) + ':' + pad2(m) + ':' + pad2(s);
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  /* ---------- 分享 ---------- */

  function copyShare() {
    var txt = els.shareTextEl.textContent;
    var done = function () { note(els.shareNote, '已复制。去晒。'); };
    var fail = function () { note(els.shareNote, '复制失败——手动选中上面的文本吧。'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () { legacyCopy(txt) ? done() : fail(); });
    } else {
      legacyCopy(txt) ? done() : fail();
    }
  }
  function legacyCopy(txt) {
    try {
      var ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }
  function savePng() {
    try {
      els.shareCanvas.toBlob(function (blob) {
        if (!blob) { note(els.shareNote, '导出失败。'); return; }
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'the-law-' + session.issue + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
        note(els.shareNote, '图卡已保存。');
      }, 'image/png');
    } catch (e) { note(els.shareNote, '导出失败。'); }
  }

  var STAMP_COLOR = { CRACKED: '#1e6e46', PARTIAL: '#1a2a4f', FAILED: '#b3282d' };

  function drawShareCard(cv, data) {
    var W = 700, H = 920, S = 2;
    cv.width = W * S; cv.height = H * S;
    var ctx = cv.getContext('2d');
    ctx.scale(S, S);
    var INK = '#1a2a4f', PAPER = '#f4f1e8';
    /* 纸面 + 噪点 */
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    var rng = mulberry32(hashDay(data.issue, 0x9A9E7));
    ctx.fillStyle = 'rgba(26,42,79,0.055)';
    for (var i = 0; i < 900; i++) {
      ctx.fillRect(rng() * W, rng() * H, rng() < 0.5 ? 1 : 2, 1);
    }
    /* 双线边框 + 页边红线 */
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, W - 32, H - 32);
    ctx.lineWidth = 1;
    ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.strokeStyle = 'rgba(179,40,45,0.45)';
    ctx.beginPath(); ctx.moveTo(64, 24); ctx.lineTo(64, H - 24); ctx.stroke();
    /* 抬头 */
    ctx.fillStyle = INK;
    ctx.font = '700 44px Georgia, "Songti SC", "Noto Serif CJK SC", serif';
    ctx.fillText('今日之律', 84, 96);
    ctx.font = '700 19px Georgia, serif';
    ctx.fillText('T H E   L A W', 86, 126);
    ctx.font = '16px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('№ ' + pad4(data.issue), W - 56, 88);
    ctx.fillText(data.dateStr, W - 56, 112);
    ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(26,42,79,0.35)';
    ctx.beginPath(); ctx.moveTo(84, 152); ctx.lineTo(W - 56, 152); ctx.stroke();
    /* 实验轨迹格 */
    ctx.font = '14px Georgia, "Songti SC", serif';
    ctx.fillStyle = 'rgba(26,42,79,0.65)';
    ctx.fillText('实 验 轨 迹', 84, 186);
    var n = data.traj.length;
    var gridTop = 204, gridLeft = 84;
    var gridBottom = gridTop + 60;
    if (n === 0) {
      ctx.fillStyle = INK;
      ctx.font = '18px Georgia, "Songti SC", serif';
      ctx.fillText('未做任何实验，直接终审。', gridLeft, gridTop + 30);
    } else {
      var rows = Math.ceil(n / 10);
      var cell = Math.max(14, Math.min(44, Math.floor(380 / rows) - 6));
      var gap = Math.max(4, Math.floor(cell / 6));
      for (var q = 0; q < n; q++) {
        var cx = gridLeft + (q % 10) * (cell + gap);
        var cy = gridTop + Math.floor(q / 10) * (cell + gap);
        ctx.fillStyle = data.traj[q] ? '#1e6e46' : '#b3282d';
        ctx.fillRect(cx, cy, cell, cell);
        ctx.fillStyle = PAPER;
        ctx.font = '700 ' + Math.floor(cell * 0.62) + 'px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText(data.traj[q] ? '✓' : '✗', cx + cell / 2, cy + cell * 0.72);
        ctx.textAlign = 'left';
      }
      gridBottom = gridTop + rows * (cell + gap);
    }
    /* 判决大戳：在轨迹区与战绩行之间取平衡位，轨迹短时不留大片空白 */
    var stampY = Math.min(660, Math.round((gridBottom + 750) / 2));
    ctx.save();
    ctx.translate(W / 2, stampY);
    ctx.rotate(-8 * Math.PI / 180);
    var col = STAMP_COLOR[data.verdict] || INK;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.92;
    ctx.lineWidth = 4;
    ctx.strokeRect(-190, -58, 380, 116);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-181, -49, 362, 98);
    ctx.font = '700 58px Georgia, serif';
    ctx.textAlign = 'center';
    if (data.perfect) {
      ctx.fillText(data.verdict, 0, 6);
      ctx.font = '700 19px Georgia, "Songti SC", serif';
      ctx.fillText('完 美 破 解', 0, 36);
    } else {
      ctx.fillText(data.verdict, 0, 20);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    /* 战绩行 + 域名 */
    ctx.fillStyle = INK;
    ctx.font = '24px "Courier New", monospace';
    ctx.fillText(n + ' 次实验 · 终审 ' + data.correct + '/8', W / 2, 790);
    ctx.strokeStyle = 'rgba(26,42,79,0.35)';
    ctx.beginPath(); ctx.moveTo(84, 830); ctx.lineTo(W - 56, 830); ctx.stroke();
    ctx.font = '18px "Courier New", monospace';
    ctx.fillStyle = 'rgba(26,42,79,0.8)';
    ctx.fillText(SITE_HOST, W / 2, 866);
    ctx.textAlign = 'left';
  }

  /* ---------- 档案 ---------- */

  function renderArchive() {
    els.archiveList.textContent = '';
    var todayIssue = issueOf(localDayIndex());
    if (todayIssue <= 1) {
      var li0 = document.createElement('li');
      li0.className = 'archive-empty';
      li0.textContent = '还没有往期。明天就有了。';
      els.archiveList.appendChild(li0);
      return;
    }
    for (var iss = todayIssue - 1; iss >= 1; iss--) {
      els.archiveList.appendChild(archiveRow(iss));
    }
  }
  function archiveRow(iss) {
    var li = document.createElement('li');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'archive-item';
    var h = store.history[String(iss)];
    var status = h ? (VERDICT_ZH[h.verdict] + ' ' + h.k + '/8') : '未挑战';
    var day = LAUNCH_DAY + iss - 1;
    var no = document.createElement('span'); no.className = 'mono'; no.textContent = '№ ' + pad4(iss);
    var dt = document.createElement('span'); dt.className = 'mono dim'; dt.textContent = dateOfDayShort(day);
    var st = document.createElement('span'); st.className = 'arch-status' + (h && h.k >= 7 ? ' good' : ''); st.textContent = status;
    btn.appendChild(no); btn.appendChild(dt); btn.appendChild(st);
    btn.addEventListener('click', function () { startPractice(iss); });
    li.appendChild(btn);
    return li;
  }
  function startPractice(iss) {
    var day = LAUNCH_DAY + iss - 1;
    session = { issue: iss, day: day, phase: 'lab', exps: [], answers: [] };
    exam = buildExam(day);
    resetBenchInputs();
    renderAll();
  }
  function exitPractice() {
    session = store.today;
    exam = buildExam(session.day);
    resetBenchInputs();
    renderAll();
  }
  function resetBenchInputs() {
    els.nums[0].value = 2; els.nums[1].value = 4; els.nums[2].value = 6;
    els.benchNote.textContent = '';
    els.confirmBox.hidden = true;
    els.bench.hidden = false;
    lastSubmitAt = 0;
  }

  /* ---------- 换日 ---------- */

  function checkNewDay() {
    if (localDayIndex() !== realDay) els.newDayBar.hidden = false;
  }

  /* ---------- 总渲染 ---------- */

  function renderPhase() {
    renderHead();
    if (session.phase === 'lab') {
      show(els.labSec);
      renderLedger();
    } else if (session.phase === 'exam') {
      show(els.examSec);
      renderExamQuestion();
    } else {
      show(els.resultSec);
      renderResult();
    }
  }
  function renderAll() { renderPhase(); }

  /* ---------- 事件 ---------- */

  els.submitBtn.addEventListener('click', submitExperiment);
  els.finalBtn.addEventListener('click', openConfirm);
  els.confirmGo.addEventListener('click', startExam);
  els.confirmBack.addEventListener('click', closeConfirm);
  els.voteOk.addEventListener('click', function () { answerExam(true); });
  els.voteNo.addEventListener('click', function () { answerExam(false); });
  els.copyBtn.addEventListener('click', copyShare);
  els.pngBtn.addEventListener('click', savePng);
  els.archiveBtn.addEventListener('click', function () { show(els.archiveSec); renderArchive(); });
  els.archiveBack.addEventListener('click', function () { renderPhase(); });
  els.exitPracticeBtn.addEventListener('click', exitPractice);
  els.reloadBtn.addEventListener('click', function () { location.reload(); });

  Array.prototype.forEach.call(document.querySelectorAll('.step'), function (b) {
    b.addEventListener('click', function () {
      stepNum(parseInt(b.getAttribute('data-idx'), 10), parseInt(b.getAttribute('data-d'), 10));
    });
  });
  els.nums.forEach(function (inp, idx) {
    inp.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); submitExperiment(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); stepNum(idx, 1); }
      else if (ev.key === 'ArrowDown') { ev.preventDefault(); stepNum(idx, -1); }
    });
    inp.addEventListener('blur', function () { readTriple(); });
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) checkNewDay();
  });
  setInterval(checkNewDay, 30000);

  /* ---------- 启动 ---------- */

  session = store.today;
  exam = buildExam(session.day);
  renderAll();

  /* 测试钩子 */
  window.__thelaw = {
    RULES: RULES, dailyRule: dailyRule, buildExam: buildExam,
    localDayIndex: localDayIndex, issueOf: issueOf, weekdayOf: weekdayOf,
    verdictOf: verdictOf, shareText: shareText, LAUNCH_DAY: LAUNCH_DAY,
    getStore: function () { return store; },
    getSession: function () { return session; },
    getExam: function () { return exam; }
  };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
}
