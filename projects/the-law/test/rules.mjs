/* 今日之律 — 规则库/终审引擎单元测试（node 直接跑，无浏览器）
 * 运行：node projects/the-law/test/rules.mjs
 *
 * 覆盖：
 *  1. 规则库规模 ≥36、三档齐备
 *  2. 全部模板 × 全部参数：全域(8000)遍历，正例负例各 ≥10%
 *  3. 今日起 380 天（含 376 天后）：每日种子恒能选出合法规则（循环取模）、
 *     终审 8 题可生成、4 正 4 负、互异、值域合法、标签与判定器一致
 *  4. 终审确定性：同种子两次生成逐位相同
 *  5. verdict 边界、分享文本格式
 * （localStorage 垃圾、连点提交等 DOM 边界在 test/smoke.mjs 中覆盖）
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app.js');
const L = require(APP);

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error('  FAIL: ' + msg); }
}

/* ---------- 1. 规则库规模 ---------- */
ok(Array.isArray(L.RULES) && L.RULES.length >= 36, `规则模板 ≥36（实际 ${L.RULES.length}）`);
for (const tier of [1, 2, 3]) {
  const n = L.RULES.filter(r => r.tier === tier).length;
  ok(n >= 10, `难度 ${tier} 档模板 ≥10（实际 ${n}）`);
}
const ids = new Set(L.RULES.map(r => r.id));
ok(ids.size === L.RULES.length, '模板 id 无重复');

/* ---------- 2. 全域密度：正例负例各 ≥10% ---------- */
const DOMAIN = [];
for (let a = L.MIN; a <= L.MAX; a++)
  for (let b = L.MIN; b <= L.MAX; b++)
    for (let c = L.MIN; c <= L.MAX; c++) DOMAIN.push([a, b, c]);
ok(DOMAIN.length === 8000, '域大小 = 8000');

let combos = 0;
for (const r of L.RULES) {
  ok(Array.isArray(r.params) && r.params.length >= 1, `${r.id} 有参数域`);
  for (const p of r.params) {
    combos++;
    let pos = 0;
    for (const t of DOMAIN) if (r.pred(t, p)) pos++;
    const lo = DOMAIN.length * 0.10, hi = DOMAIN.length * 0.90;
    ok(pos >= lo && pos <= hi,
      `${r.id} ${JSON.stringify(p)} 密度越界：正例 ${pos}/8000 (${(pos / 80).toFixed(1)}%)`);
    const d = r.desc(p);
    ok(typeof d === 'string' && d.length > 0, `${r.id} ${JSON.stringify(p)} 描述非空`);
  }
}
console.log(`密度检查：${combos} 个（模板×参数）实例全域遍历完成`);

/* ---------- 3. 每日种子 + 终审生成：今日起 380 天 ---------- */
const today = L.localDayIndex();
const SPAN = 380; /* 覆盖"376 天后"边界 */
let nearMissTotal = 0, examDays = 0;
for (let day = today; day < today + SPAN; day++) {
  const rule = L.dailyRule(day);
  ok(rule && rule.tpl && L.RULES.includes(rule.tpl), `day ${day} 选出合法模板`);
  ok(rule.tier === L.TIER_BY_WEEKDAY[L.weekdayOf(day)], `day ${day} 难度档符合星期曲线`);
  ok(rule.tpl.tier === rule.tier, `day ${day} 模板档位一致`);
  ok(typeof rule.text === 'string' && rule.text.length > 0, `day ${day} 法则文本非空`);

  let exam;
  try { exam = L.buildExam(day); }
  catch (e) { ok(false, `day ${day} 终审生成抛错：${e.message}`); continue; }
  examDays++;
  const items = exam.items;
  ok(items.length === 8, `day ${day} 终审 8 题`);
  const keys = new Set(items.map(i => i.t.join(',')));
  ok(keys.size === 8, `day ${day} 终审 8 题互异`);
  ok(!keys.has(L.HINT_KEY), `day ${day} 示例样本(2,4,6)不进终审`);
  let posN = 0;
  for (const it of items) {
    ok(it.t.length === 3 && it.t.every(x => Number.isInteger(x) && x >= L.MIN && x <= L.MAX),
      `day ${day} 题面值域合法：${it.t}`);
    ok(it.label === rule.pred(it.t), `day ${day} 标签与判定器一致：${it.t}`);
    ok(exam.rule.pred(it.t) === it.label, `day ${day} 标签与 exam 自带判定器一致`);
    if (it.label) posN++;
  }
  ok(posN === 4, `day ${day} 正负例各半（正例 ${posN}）`);
  /* 近失覆盖度统计：负例与某正例仅一个分量不同 */
  const posSet = items.filter(i => i.label).map(i => i.t);
  for (const it of items) {
    if (it.label) continue;
    if (posSet.some(pt => pt.filter((v, i) => v !== it.t[i]).length === 1)) nearMissTotal++;
  }
}
console.log(`终审生成：${examDays}/${SPAN} 天全部成功；近失负例 ${nearMissTotal}/${SPAN * 4}（覆盖易混边界）`);
ok(nearMissTotal >= SPAN, `近失负例占比足够（${nearMissTotal} ≥ ${SPAN}）`);

/* ---------- 4. 确定性 ---------- */
for (const day of [today, today + 1, today + 100, today + 376]) {
  const a = JSON.stringify(L.buildExam(day).items);
  const b = JSON.stringify(L.buildExam(day).items);
  ok(a === b, `day ${day} 同种子两次生成逐位相同`);
  const r1 = L.dailyRule(day), r2 = L.dailyRule(day);
  ok(r1.tpl.id === r2.tpl.id && JSON.stringify(r1.param) === JSON.stringify(r2.param),
    `day ${day} 规则选择确定性`);
}

/* 远期/负方向种子也不崩（循环取模） */
for (const day of [0, 1, 12345, today + 3760, today - 10000]) {
  try {
    const r = L.dailyRule(day);
    ok(!!r.tpl, `极端 day ${day} 仍能选出规则`);
    ok(L.buildExam(day).items.length === 8, `极端 day ${day} 终审可生成`);
  } catch (e) {
    ok(false, `极端 day ${day} 抛错：${e.message}`);
  }
}

/* ---------- 5. verdict 边界与分享文本 ---------- */
ok(L.verdictOf(8) === 'CRACKED' && L.verdictOf(7) === 'CRACKED', 'verdict: 7/8 与 8/8 → CRACKED');
ok(L.verdictOf(6) === 'PARTIAL' && L.verdictOf(5) === 'PARTIAL', 'verdict: 5–6 → PARTIAL');
ok(L.verdictOf(4) === 'FAILED' && L.verdictOf(0) === 'FAILED', 'verdict: ≤4 → FAILED');

const traj = [true, false, true, true, false, true, true, true, true, false, true, false];
const st = L.shareText(142, traj, 8, false);
ok(st.includes('THE LAW #142'), '分享文本含期号');
ok(st.includes('12 次实验 · 终审 8/8'), '分享文本含战绩');
const lines = st.split('\n');
ok(lines[1] === '🟩🟥🟩🟩🟥🟩🟩🟩🟩🟥' && lines[2] === '🟩🟥', '轨迹按 10 枚换行、顺序正确');
ok(!/\d · \d/.test(st), '分享文本零剧透（无样本数值）');
const st0 = L.shareText(7, [], 5, false);
ok(st0.split('\n').length === 3 && st0.includes('0 次实验'), '0 次实验省略轨迹行');

/* ---------- 汇总 ---------- */
console.log(`\nrules.mjs: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
console.log('ALL RULES TESTS PASSED');
