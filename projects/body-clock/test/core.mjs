// 体内时钟 — 核心逻辑单测。从仓库根运行: node projects/body-clock/test/core.mjs
// 覆盖: 种子→目标分布与稳定性、误差→称号逐档边界、连胜结转/断裂、
//       状态归一化容错、分享文本格式、微信副本一致性。
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const core = require(path.join(HERE, '..', 'shared', 'core.js'));

let passes = 0, failures = 0;
function check(name, cond, extra) {
  if (cond) { passes++; console.log('  PASS ' + name); }
  else { failures++; console.log('  FAIL ' + name + (extra !== undefined ? ' — ' + extra : '')); }
}

/* ============================================ 1. 种子 → 目标时长 */
console.log('\n[1] 每日种子 → 目标时长');
{
  const today = core.EPOCH_DAY;
  const N = 3000;
  let min = Infinity, max = -Infinity, sum = 0, changed = 0;
  let allCentis = true;
  let prev = null;
  for (let d = today; d < today + N; d++) {
    const t = core.targetMsForDay(d);
    if (t < min) min = t;
    if (t > max) max = t;
    sum += t;
    if (t % 10 !== 0) allCentis = false;
    if (prev !== null && t !== prev) changed++;
    prev = t;
  }
  check('3000 天全部落在 [3.00s, 12.00s]', min >= 3000 && max <= 12000, `min=${min} max=${max}`);
  check('两位小数粒度（ms 为 10 的倍数）', allCentis);
  check('分布覆盖两端（min<4s, max>11s）', min < 4000 && max > 11000, `min=${min} max=${max}`);
  const mean = sum / N;
  check('均值接近 7.5s（±0.4s）', Math.abs(mean - 7500) < 400, `mean=${mean.toFixed(1)}`);
  check('跨日基本必变（相邻相同 < 2%）', (N - 1 - changed) < N * 0.02, `same=${N - 1 - changed}`);
  check('同日稳定（重复调用同值）',
    core.targetMsForDay(today + 7) === core.targetMsForDay(today + 7));
  check('期号: EPOCH_DAY 为第 1 期', core.issueNumber(core.EPOCH_DAY) === 1);
  check('期号: EPOCH_DAY+22 为第 23 期', core.issueNumber(core.EPOCH_DAY + 22) === 23);
}

/* ============================================ 2. 本地日期 dayIndex */
console.log('\n[2] 本地日期 dayIndex（跨午夜换题）');
{
  // 本环境 TZ=UTC；用相邻两毫秒跨过本地午夜验证换天。
  const d1 = new Date('2026-07-04T23:59:59.999');
  const d2 = new Date('2026-07-05T00:00:00.001');
  check('午夜前后 dayIndex 相差 1',
    core.localDayIndex(d2) - core.localDayIndex(d1) === 1,
    `${core.localDayIndex(d1)} -> ${core.localDayIndex(d2)}`);
  check('同一天内 dayIndex 不变',
    core.localDayIndex(new Date('2026-07-04T00:00:01')) ===
    core.localDayIndex(new Date('2026-07-04T23:59:59')));
  check('数字时间戳与 Date 等价',
    core.localDayIndex(d1.getTime()) === core.localDayIndex(d1));
}

/* ============================================ 3. 误差 → 称号逐档边界 */
console.log('\n[3] 误差 → 称号（边界值逐档）');
{
  const cases = [
    [0, '原子钟'], [10, '原子钟'],
    [11, '铯钟'], [30, '铯钟'],
    [31, '石英表'], [80, '石英表'],
    [81, '机械表'], [200, '机械表'],
    [201, '沙漏'], [500, '沙漏'],
    [501, '日晷'], [99999, '日晷']
  ];
  let ok = true, bad = '';
  for (const [err, name] of cases) {
    const t = core.gradeError(err);
    if (t.name !== name) { ok = false; bad += ` ${err}→${t.name}(期望${name})`; }
  }
  check('12 个边界值全部落档正确', ok, bad);
  check('负误差按绝对值判档', core.gradeError(-45).name === '石英表');
  check('judge 符号: 数多了为正', core.judge(7000, 7038).signedMs === 38);
  check('judge 符号: 数少了为负', core.judge(7000, 6950).signedMs === -50);
  check('judge 称号联动', core.judge(7000, 7038).tier.name === '石英表');
}

/* ============================================ 4. 连胜结转 / 断裂 */
console.log('\n[4] 连胜（守时 = 当日最好 ≤200ms）');
{
  const D = 20700;
  const kept = (e) => ({ done: true, bestErrMs: e, attempts: [] });
  // 连续三天守时，今天已完成
  check('三连: 昨前今全守时 → 3',
    core.computeStreak({ [D - 2]: kept(50), [D - 1]: kept(199), [D]: kept(200) }, D) === 3);
  // 今天还没打，从昨天结转
  check('今天未打: 结转昨天的 2',
    core.computeStreak({ [D - 2]: kept(50), [D - 1]: kept(80) }, D) === 2);
  // 今天完成但超标 → 当场断
  check('今天 >200ms → 0',
    core.computeStreak({ [D - 1]: kept(50), [D]: kept(201) }, D) === 0);
  // 漏一天 → 断
  check('中间漏一天 → 只算今天 1',
    core.computeStreak({ [D - 2]: kept(50), [D]: kept(80) }, D) === 1);
  // 昨天超标未守时，今天守时 → 1
  check('昨天超标今天守时 → 1',
    core.computeStreak({ [D - 1]: kept(300), [D]: kept(80) }, D) === 1);
  // 什么都没有
  check('无记录 → 0', core.computeStreak({}, D) === 0);
  check('days 为 null → 0', core.computeStreak(null, D) === 0);
  // 未完成的今天不参与
  check('今天未 done 不算守时',
    core.computeStreak({ [D - 1]: kept(50), [D]: { done: false, bestErrMs: 10 } }, D) === 1);
}

/* ============================================ 5. 状态归一化容错 */
console.log('\n[5] normalizeState 垃圾容错');
{
  const today = 20638;
  for (const junk of [null, undefined, 'garbage', 42, [], { v: 'x' }, { days: 'no' }]) {
    const st = core.normalizeState(junk, today);
    if (!(st && st.v === core.VERSION && typeof st.days === 'object' &&
          st.settings.distortion === false && st.settings.sound === true)) {
      check('垃圾输入回退默认: ' + JSON.stringify(junk), false); junk;
    }
  }
  check('7 种垃圾输入全部回退默认', true);
  const dirty = core.normalizeState({
    v: 1,
    settings: { distortion: true, distortionUnlocked: 'yes', sound: false },
    days: {
      [today]: { attempts: [{ errMs: 38, heldMs: 7038, star: true }, { errMs: 'NaN' }, null], done: true },
      [today - 500]: { attempts: [{ errMs: 5 }], done: true }, // 超过 400 天，应被剪掉
      'abc': { attempts: [{ errMs: 5 }] },
      [today + 99999]: { attempts: [] }
    }
  }, today);
  check('合法 attempt 保留、非法剔除', dirty.days[today].attempts.length === 1);
  check('bestErrMs 重算', dirty.days[today].bestErrMs === 38);
  check('star 标记保留', dirty.days[today].attempts[0].star === true);
  check('400 天以前的记录被剪', !(String(today - 500) in dirty.days));
  check('非数字键被剪', !('abc' in dirty.days) && !('NaN' in dirty.days));
  check('settings 布尔化', dirty.settings.distortion === true &&
    dirty.settings.distortionUnlocked === false && dirty.settings.sound === false);
  check('done 需要至少一次有效尝试',
    core.normalizeState({ days: { [today]: { done: true, attempts: [] } } }, today)
      .days[today] ? core.normalizeState({ days: { [today]: { done: true, attempts: [] } } }, today).days[today].done === false : true);
}

/* ============================================ 6. 分享文本 */
console.log('\n[6] 分享文本');
{
  const txt = core.shareText({
    issueNo: 23, targetMs: 7000, bestErrMs: 38,
    attempts: [{ errMs: 38 }, { errMs: 150 }, { errMs: 320 }],
    star: false, streak: 5, domain: 'bodyclock.fun'
  });
  const lines = txt.split('\n');
  check('首行格式与样例一致',
    lines[0] === '体内时钟 #23 · 目标 7.00s · 误差 0.038s ⌚ 石英表', lines[0]);
  check('迷你格 🟩🟨🟥', lines[1] === '🟩🟨🟥', lines[1]);
  check('连胜与域名尾行', lines[2] === '守时连胜 5 天 · bodyclock.fun', lines[2]);
  const star = core.shareText({ issueNo: 1, targetMs: 3000, bestErrMs: 8, attempts: [{ errMs: 8 }], star: true, streak: 0, domain: '' });
  check('干扰模式 ★ 后缀', star.includes('原子钟★'), star.split('\n')[0]);
  check('errAngleDeg: 0ms → 0°', core.errAngleDeg(0) === 0);
  check('errAngleDeg: +250ms → 45°', core.errAngleDeg(250) === 45);
  check('errAngleDeg: ±封顶 90°', core.errAngleDeg(9999) === 90 && core.errAngleDeg(-9999) === -90);
}

/* ============================================ 7. 微信副本一致性 */
console.log('\n[7] 微信小游戏 core 副本');
{
  const a = fs.readFileSync(path.join(HERE, '..', 'shared', 'core.js'), 'utf8');
  const wxPath = path.join(HERE, '..', 'wechat-minigame', 'shared', 'core.js');
  const b = fs.existsSync(wxPath) ? fs.readFileSync(wxPath, 'utf8') : null;
  check('wechat-minigame/shared/core.js 与 shared/core.js 逐字节一致', a === b,
    b === null ? '副本不存在' : '内容不一致 — 运行 cp shared/core.js wechat-minigame/shared/core.js');
}

console.log(`\n共 ${passes + failures} 项: ${passes} 通过, ${failures} 失败`);
process.exit(failures ? 1 : 0);
