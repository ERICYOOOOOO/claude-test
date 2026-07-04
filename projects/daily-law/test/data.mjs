/* 每日一法 · 内容库校验（node projects/daily-law/test/data.mjs）
 * 断言：七轨齐备、每轨 ≥15 条、字段齐全、无重复（轨+出处+条款）、
 *       手记字数 40–160、dateOverride 格式与轨内唯一、免责声明存在于 index.html、
 *       全部 JS 通过 node --check。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(DIR, '..');
const require = createRequire(import.meta.url);
const { LAW_TRACKS, LAWS } = require(path.join(ROOT, 'laws.js'));

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ok - ' + msg); }
  else { fail++; console.error('  FAIL - ' + msg); }
}

/* ---------- 语法检查 ---------- */
for (const f of ['laws.js', 'app.js']) {
  const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f)], { encoding: 'utf8' });
  ok(r.status === 0, `node --check ${f}${r.status === 0 ? '' : '：' + r.stderr.trim()}`);
}

/* ---------- 轨道 ---------- */
ok(Array.isArray(LAW_TRACKS) && LAW_TRACKS.length === 7, `七条轨道（实际 ${LAW_TRACKS.length}）`);
const trackIds = LAW_TRACKS.map(t => t.id);
ok(new Set(trackIds).size === 7, '轨道 id 无重复');
ok(LAW_TRACKS.every(t => t.name && typeof t.name === 'string'), '轨道均有中文名');

/* ---------- 每轨条数 ---------- */
const byTrack = {};
for (const id of trackIds) byTrack[id] = LAWS.filter(e => e.track === id);
for (const t of LAW_TRACKS) {
  ok(byTrack[t.id].length >= 15, `轨【${t.name}】≥15 条（实际 ${byTrack[t.id].length}）`);
}
ok(LAWS.length >= 105, `内容库总数 ≥105（实际 ${LAWS.length}）`);

/* ---------- 字段齐全 ---------- */
const ENACT_RE = /^\d{4}年.{0,4}(施行|生效|通过|颁布)$/;
const OVERRIDE_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
let fieldsOK = true, enactOK = true, noteOK = true, foreignOK = true, overrideFmtOK = true;
const badNotes = [];
for (const e of LAWS) {
  if (!trackIds.includes(e.track)) fieldsOK = false;
  /* 最短 4 字：德国基本法第 102 条「死刑废止。」这类极简条文是合法存在 */
  if (typeof e.text !== 'string' || e.text.trim().length < 4 || e.text !== e.text.trim()) fieldsOK = false;
  if (typeof e.source !== 'string' || e.source.trim().length < 5) fieldsOK = false;
  if (typeof e.enact !== 'string' || !ENACT_RE.test(e.enact)) { enactOK = false; console.error('    坏 enact：' + e.source + ' → ' + e.enact); }
  const n = [...(e.note || '')].length;
  if (n < 40 || n > 160) { noteOK = false; badNotes.push(`${e.source}（${n} 字）`); }
  if (e.track !== 'cn' && (!e.origLang || !e.origName)) { foreignOK = false; console.error('    缺原文信息：' + e.source); }
  if (e.dateOverride !== undefined && !OVERRIDE_RE.test(e.dateOverride)) overrideFmtOK = false;
}
ok(fieldsOK, '每条均有合法 track/text/source');
ok(enactOK, 'enact 均为「YYYY年…施行/生效/通过/颁布」');
ok(noteOK, `手记字数均在 40–160${badNotes.length ? '（越界：' + badNotes.join('；') + '）' : ''}`);
ok(foreignOK, '外国轨/条约轨均注明原语言与原文名');
ok(overrideFmtOK, 'dateOverride 均为 MM-DD 格式');

/* ---------- 无重复（轨+出处+条款；出处字符串已含条款号） ---------- */
const keys = LAWS.map(e => e.track + '|' + e.source);
const dupKeys = keys.filter((k, i) => keys.indexOf(k) !== i);
ok(dupKeys.length === 0, `无重复条目（轨+出处+条款）${dupKeys.length ? '：' + [...new Set(dupKeys)].join('；') : ''}`);
const texts = LAWS.map(e => e.text);
ok(new Set(texts).size === texts.length, '条文文本全库无重复');

/* ---------- dateOverride 轨内唯一 ---------- */
let ovUnique = true;
for (const id of trackIds) {
  const ovs = byTrack[id].filter(e => e.dateOverride).map(e => e.dateOverride);
  if (new Set(ovs).size !== ovs.length) { ovUnique = false; console.error('    轨内 dateOverride 冲突：' + id); }
}
ok(ovUnique, '同轨内 dateOverride 无冲突');

/* ---------- 免责声明 ---------- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(html.includes('不构成法律意见'), 'index.html 含免责声明「不构成法律意见」');
ok(html.includes('以官方最新版本为准'), 'index.html 含「以官方最新版本为准」');

/* ---------- 汇总 ---------- */
console.log('\n分轨条数：' + LAW_TRACKS.map(t => `${t.name} ${byTrack[t.id].length}`).join('，') + `；共 ${LAWS.length} 条`);
console.log(`\ndata.mjs：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
