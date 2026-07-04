/* 每日一人 · 数据一致性测试（纯 node，无浏览器）
 * 运行：node projects/daily-person/test/data.mjs
 * 断言：属性齐全合法 / 无重名 / 别名索引无冲突 /
 *       每人对全部问题都有确定布尔答案 / 生卒年合理 / 题库结构合法。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// people.js / questions.js 是浏览器经典脚本（写入 globalThis），直接求值加载
(0, eval)(fs.readFileSync(path.join(ROOT, "people.js"), "utf8"));
(0, eval)(fs.readFileSync(path.join(ROOT, "questions.js"), "utf8"));

const PEOPLE = globalThis.DP_PEOPLE;
const QUESTIONS = globalThis.DP_QUESTIONS;
const CATS = globalThis.DP_CATS;

let failures = 0;
function ok(cond, msg) {
  if (cond) { console.log("  ok:", msg); return; }
  failures++;
  console.error("  FAIL:", msg);
}
function quiet(cond, msg) { // 逐人断言：只在失败时输出
  if (cond) return true;
  failures++;
  console.error("  FAIL:", msg);
  return false;
}

const THIS_YEAR = new Date().getFullYear();
const BOOL_KEYS = ["chinese", "head", "monarch", "nobel", "military", "musical",
  "inventor", "painter", "poet", "actor", "singer", "religious", "violentDeath",
  "imprisoned", "revolutionary", "banknote", "olympic", "posthumous", "emigrated"];
const REGIONS = ["asia", "europe", "namerica", "samerica", "africa", "oceania"];
const FIELDS = ["politics", "science", "literature", "art", "performing",
  "sports", "thought", "exploration"];

console.log("库结构");
ok(Array.isArray(PEOPLE) && PEOPLE.length >= 100, `人物 >= 100（实际 ${PEOPLE.length}）`);
ok(Array.isArray(QUESTIONS) && QUESTIONS.length >= 44, `问题 >= 44（实际 ${QUESTIONS.length}）`);
ok(CATS.length === 5, "问题分类共 5 类");
for (const c of CATS) {
  const n = QUESTIONS.filter((q) => q.cat === c.key).length;
  ok(n >= 8, `分类「${c.label}」问题数 >= 8（实际 ${n}）`);
}

console.log("人物字段合法性（逐人，仅失败时输出）");
let fieldFailures = 0;
for (const p of PEOPLE) {
  const tag = p && p.id ? p.id : JSON.stringify(p).slice(0, 40);
  let good = true;
  good &= quiet(typeof p.id === "string" && /^[a-z0-9]+$/.test(p.id), `${tag}: id 为小写字母数字`);
  good &= quiet(typeof p.name === "string" && p.name.length >= 2, `${tag}: name 合法`);
  good &= quiet(Array.isArray(p.aliases) && p.aliases.length >= 1, `${tag}: 至少一个别名`);
  good &= quiet(p.aliases.every((a) => typeof a === "string" && a.trim().length > 0), `${tag}: 别名均为非空字符串`);
  good &= quiet(p.aliases.some((a) => /[a-z]/i.test(a) && a.replace(/[^a-z]/gi, "").length >= 4), `${tag}: 有一个 >=4 字母的拉丁别名（供模糊测试）`);
  good &= quiet(p.gender === "m" || p.gender === "f", `${tag}: gender 为 m/f`);
  good &= quiet(Number.isInteger(p.born) && p.born > -3000 && p.born <= THIS_YEAR, `${tag}: born 合理（${p.born}）`);
  good &= quiet(p.died === null || Number.isInteger(p.died), `${tag}: died 为整数或 null`);
  if (p.died !== null) {
    good &= quiet(p.died > p.born, `${tag}: 卒年(${p.died}) > 生年(${p.born})`);
    good &= quiet(p.died <= THIS_YEAR, `${tag}: 卒年不在未来`);
    good &= quiet(p.died - p.born <= 122, `${tag}: 寿命 <= 122（${p.died - p.born}）`);
  } else {
    good &= quiet(THIS_YEAR - p.born <= 105, `${tag}: 在世者年龄可信（生于 ${p.born}）`);
  }
  good &= quiet(typeof p.country === "string" && p.country.length >= 2, `${tag}: country 非空`);
  good &= quiet(REGIONS.includes(p.region), `${tag}: region 合法（${p.region}）`);
  good &= quiet(FIELDS.includes(p.field), `${tag}: field 合法（${p.field}）`);
  good &= quiet(p.chinese === (p.country === "中国"), `${tag}: chinese 与 country 一致`);
  for (const k of BOOL_KEYS) good &= quiet(typeof p[k] === "boolean", `${tag}: ${k} 为布尔`);
  good &= quiet(p.monarch ? p.head : true, `${tag}: 君主必为元首`);
  good &= quiet(p.died === null ? !p.violentDeath : true, `${tag}: 在世者不得标记死于非命`);
  good &= quiet(p.died === null ? !p.posthumous : true, `${tag}: 在世者不得标记身后成名`);
  good &= quiet(typeof p.bio === "string" && p.bio.length >= 140 && p.bio.length <= 270, `${tag}: 小传 140–270 字（实际 ${p.bio ? p.bio.length : 0}）`);
  good &= quiet(typeof p.epitaph === "string" && p.epitaph.length >= 6 && p.epitaph.length <= 40, `${tag}: 墓志铭 6–40 字`);
  if (good) fieldFailures += 0;
}
ok(true, `逐人字段检查完成（${PEOPLE.length} 人）`);

console.log("无重名 / 别名索引无冲突");
{
  const ids = new Set();
  for (const p of PEOPLE) { ok(!ids.has(p.id) || false, ids.has(p.id) ? `id 重复：${p.id}` : ""); if (ids.has(p.id)) failures++; ids.add(p.id); }
  ok(ids.size === PEOPLE.length, "id 全部唯一");

  const norm = (s) => s.toLowerCase().replace(/[\s.·・\-'’]/g, "");
  const index = new Map();
  let conflicts = 0;
  for (const p of PEOPLE) {
    for (const raw of [p.name, ...p.aliases]) {
      const key = norm(raw);
      if (index.has(key) && index.get(key) !== p.id) {
        conflicts++;
        console.error(`  FAIL: 名称索引冲突「${raw}」同时指向 ${index.get(key)} 与 ${p.id}`);
        failures++;
      }
      index.set(key, p.id);
    }
  }
  ok(conflicts === 0, `名称/别名索引无冲突（共 ${index.size} 个索引词）`);
}

console.log("每人对全部问题都有确定答案");
{
  let bad = 0;
  const yesCount = new Map(QUESTIONS.map((q) => [q.id, 0]));
  for (const p of PEOPLE) {
    for (const q of QUESTIONS) {
      let a;
      try { a = q.ans(p); } catch (e) { a = undefined; }
      if (typeof a !== "boolean") {
        bad++;
        failures++;
        console.error(`  FAIL: ${p.id} × ${q.id} 答案非布尔（${a}）`);
      } else if (a) {
        yesCount.set(q.id, yesCount.get(q.id) + 1);
      }
    }
  }
  ok(bad === 0, `全部 ${PEOPLE.length}×${QUESTIONS.length} 组合均返回布尔`);
  for (const q of QUESTIONS) {
    const y = yesCount.get(q.id);
    ok(y >= 2 && y <= PEOPLE.length - 2, `问题 ${q.id} 有区分度（是=${y}/${PEOPLE.length}）`);
  }
}

console.log("题目文本与结构");
for (const q of QUESTIONS) {
  if (!(typeof q.id === "string" && typeof q.text === "string" && q.text.endsWith("？") && typeof q.ans === "function" && CATS.some((c) => c.key === q.cat))) {
    failures++;
    console.error(`  FAIL: 问题结构非法 ${q.id}`);
  }
}
ok(new Set(QUESTIONS.map((q) => q.id)).size === QUESTIONS.length, "问题 id 唯一");

console.log("库的均衡性");
{
  const cn = PEOPLE.filter((p) => p.chinese).length;
  const ratio = cn / PEOPLE.length;
  ok(ratio >= 0.33 && ratio <= 0.47, `中外比例约 4:6（中 ${cn} / 外 ${PEOPLE.length - cn}）`);
  for (const f of FIELDS) {
    const n = PEOPLE.filter((p) => p.field === f).length;
    ok(n >= 6, `领域 ${f} 人数 >= 6（实际 ${n}）`);
  }
  const women = PEOPLE.filter((p) => p.gender === "f").length;
  ok(women >= 10, `女性人物 >= 10（实际 ${women}）`);
}

console.log(failures === 0 ? `\n全部通过 ✔  人物 ${PEOPLE.length} / 问题 ${QUESTIONS.length}` : `\n${failures} 项失败 ✘`);
process.exit(failures === 0 ? 0 : 1);
