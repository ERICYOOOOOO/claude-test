// 体内时钟 — 对抗性 QA 附加测试。从仓库根运行: node projects/body-clock/test/qa-extra.mjs
// 独立 QA 视角，不复述 smoke 已覆盖项。覆盖:
//   [1] 注入 performance.now 假时钟 → 逐档称号边界（9/10/11、30/31、80/81、200/201、500/501ms）
//       与 PLAYBOOK 3.2 数值表逐一对照；误触 199/200ms 边界；针角封顶。
//   [2] 作弊面: 按住中切 tab（visibilitychange）作废+UI 反馈；多指/伪造 pointer 去重；
//       右键无菜单；按住 >60s 超时保护；按住中跨天作废。
//   [3] 状态机: 中途刷新恢复剩余次数与 extra；练习成绩不写入每日；
//       连胜跨天注入（守时+1 / 漏一天清零 / 超标清零）。
//   [4] 激励视频占位: 中途关闭不发奖；看完发奖 +1 且每日仅一次；刷新后 extra 持久;
//       干扰模式解锁跨刷新持久、★ 全链路。
//   [5] 微信骨架静态审查: game.json/project.config.json 字段、game.js 零直接 wx./tt.、
//       adapter.js api 调用全部有降级、core 副本逐字节一致、MAX_HOLD 三端同源。
//   [6] 美学素材: 截取 待机/按住脉动/揭晓/结算/分享卡/移动端 供人工目检。
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const core = require(path.join(HERE, '..', 'shared', 'core.js'));
const URL = 'file://' + path.resolve(HERE, '..', 'index.html');
const SHOTS = path.join(HERE, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

let passes = 0, failures = 0;
function check(name, cond, extra) {
  if (cond) { passes++; console.log('  PASS ' + name); }
  else { failures++; console.log('  FAIL ' + name + (extra !== undefined ? ' — ' + extra : '')); }
}

const consoleErrors = [], pageErrors = [];
function watch(page, tag) {
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${tag}] ${m.text()}`); });
  page.on('pageerror', (e) => pageErrors.push(`[${tag}] ${e.message}`));
  page.on('download', (d) => d.cancel().catch(() => {}));
}

// 与 smoke 同法选一个 ~7s 的测试日
let TEST_DAY = core.EPOCH_DAY;
for (let d = core.EPOCH_DAY; d < core.EPOCH_DAY + 3000; d++) {
  const t = core.targetMsForDay(d);
  if (t >= 6800 && t <= 7300) { TEST_DAY = d; break; }
}
const TARGET = core.targetMsForDay(TEST_DAY);
const NOON = (d) => d * 86400000 + 12 * 3600000; // 本环境 TZ=UTC
console.log(`测试日 dayIndex=${TEST_DAY} (第 ${core.issueNumber(TEST_DAY)} 期) 目标=${TARGET}ms`);

const st8 = (page) => page.evaluate(() => window.__bc.state());

/* 假时钟: app.js 的按住时长 = performance.now() 差值。
 * 注入可控 performance.now 后，按住时长毫秒级精确，绕过真实 mouse 抖动。 */
async function newPage(browser, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  watch(page, opts.tag || 'qa');
  await page.addInitScript((now) => {
    window.__BC_NOW__ = now;
    window.__qaT = 1e6;
    performance.now = function () { return window.__qaT; };
  }, opts.now ?? NOON(TEST_DAY));
  await page.goto(URL);
  await page.waitForTimeout(120);
  return { ctx, page };
}

async function dialCenter(page) {
  const box = await page.locator('#dial').boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
/* 精确按住 heldMs 毫秒（假时钟推进，真实等待为 0） */
async function exactHold(page, heldMs) {
  const c = await dialCenter(page);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.evaluate((d) => { window.__qaT += d; }, heldMs);
  await page.mouse.up();
  await page.waitForTimeout(70);
}
/* 完成一天 3 次，误差序列 deltas（相对当日目标的有符号毫秒），最后点开结算 */
async function playDay(page, deltas) {
  for (const d of deltas) {
    const s = await st8(page);
    if (s.phase === 'reveal') await page.click('#btn-next');
    const t = (await st8(page)).targetMs;
    await exactHold(page, t + d);
  }
  const s = await st8(page);
  if (s.phase === 'reveal' && s.done) { await page.click('#btn-next'); await page.waitForTimeout(100); }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/* ============================================ 1. 计时精度对抗 — 称号逐档边界 */
console.log('\n[1] 假时钟 · 称号边界逐档（练习模式，不限次）');
{
  const { ctx, page } = await newPage(browser, { width: 1280, height: 800 }, { tag: 'tiers' });
  await page.click('#tab-practice');
  await page.waitForTimeout(80);

  // PLAYBOOK 3.2 数值表: ≤10 原子钟 / ≤30 铯钟 / ≤80 石英表 / ≤200 机械表 / ≤500 沙漏 / >500 日晷
  const CASES = [
    [9, '原子钟'], [10, '原子钟'], [11, '铯钟'], [30, '铯钟'], [31, '石英表'],
    [80, '石英表'], [81, '机械表'], [200, '机械表'], [201, '沙漏'],
    [500, '沙漏'], [501, '日晷'], [-10, '原子钟'], [-201, '沙漏'], [-501, '日晷']
  ];
  for (const [delta, wantTier] of CASES) {
    const t = (await st8(page)).targetMs;
    await exactHold(page, t + delta);
    const s = await st8(page);
    const shownTier = await page.locator('#r-tier').textContent();
    const shownErr = await page.locator('#r-err').textContent();
    const wantErr = core.formatSec(Math.abs(delta), 3);
    check(`${delta >= 0 ? '+' : ''}${delta}ms → ${wantTier}`,
      s.lastErrMs === Math.abs(delta) && shownTier === wantTier && shownErr === wantErr,
      `err=${s.lastErrMs} tier=${shownTier} shown=${shownErr}`);
    await page.click('#btn-next');
  }

  // 方向文案与针角
  let t = (await st8(page)).targetMs;
  await exactHold(page, t - 50);
  check('提前 50ms → "数快了 · 提前 50 毫秒"',
    (await page.locator('#r-dir').textContent()) === '数快了 · 提前 50 毫秒',
    await page.locator('#r-dir').textContent());
  let deg = await page.evaluate(() => document.getElementById('needle').style.transform);
  check('提前 → 针角为负（偏左）', deg === `rotate(${core.errAngleDeg(-50)}deg)`, deg);
  await page.click('#btn-next');
  t = (await st8(page)).targetMs;
  await exactHold(page, t + 9999);
  deg = await page.evaluate(() => document.getElementById('needle').style.transform);
  check('拖后超 500ms → 针角封顶 +90°', deg === 'rotate(90deg)', deg);
  await page.click('#btn-next');

  // 误触边界: <200ms 不计入（PLAYBOOK 3.3），恰 200ms 计入
  let before = (await st8(page)).phase;
  await exactHold(page, 199);
  let s = await st8(page);
  check('按住 199ms → 误触不出结果', s.phase === 'idle' && before === 'idle', s.phase);
  check('误触有 UI 反馈（toast）', await page.locator('#toast').isVisible() &&
    (await page.locator('#toast').textContent()).includes('不计入'),
    await page.locator('#toast').textContent().catch(() => 'no toast'));
  await exactHold(page, 200);
  s = await st8(page);
  check('按住恰 200ms → 计入（练习出结果）', s.phase === 'reveal');
  await page.click('#btn-next');

  // 超时保护: 按住超过 60s 作废
  await exactHold(page, 60001);
  s = await st8(page);
  check('按住 60.001s → 超时作废不计入', s.phase === 'idle', s.phase);
  check('超时有 UI 反馈（toast）', await page.locator('#toast').isVisible(),
    await page.locator('#toast').textContent().catch(() => 'no toast'));
  await exactHold(page, 59000);
  s = await st8(page);
  check('按住 59s → 仍照常计时（日晷）', s.phase === 'reveal' && s.lastTier === '日晷',
    `${s.phase}/${s.lastTier}`);
  await ctx.close();
}

/* ============================================ 2. 每日边界 + 守时判定 + 分享全链路 */
console.log('\n[2] 假时钟 · 每日 3 次边界成绩与分享对照');
{
  const { ctx, page } = await newPage(browser, { width: 1280, height: 800 }, { tag: 'daily' });
  // 第 1 次后表盘提示必须同步剩余次数（回归: renderHint 曾在 reveal/summary 后失更）
  await exactHold(page, TARGET + 200);
  check('揭晓后提示同步「还剩 2 次」',
    (await page.locator('#dial-hint').textContent()).includes('还剩 2 次'),
    await page.locator('#dial-hint').textContent());
  await page.click('#btn-next');
  // 三次: +200（机械表/🟨/守时线上）、+9（原子钟/🟩）、+501（日晷/🟥）
  await playDay(page, [9, 501]);
  const s = await st8(page);
  check('结算态提示同步「已用完」',
    (await page.locator('#dial-hint').textContent()).includes('已用完'),
    await page.locator('#dial-hint').textContent());
  check('best 取最好 = 9ms', s.bestErrMs === 9, s.bestErrMs);
  check('结算称号 = 原子钟', (await page.locator('#s-tier').textContent()) === '原子钟');
  check('迷你格顺序着色 🟨🟩🟥', (await page.locator('#s-squares').textContent()) === '🟨🟩🟥',
    await page.locator('#s-squares').textContent());
  check('守时判定 ✓（9 ≤ 200）', (await page.locator('#s-streak').textContent()).includes('守时 ✓'));
  const txt = await page.evaluate(() => window.__bc.shareText());
  const lines = txt.split('\n');
  check('分享首行与 PLAYBOOK 6.1 格式一致',
    lines[0] === `体内时钟 #${core.issueNumber(TEST_DAY)} · 目标 ${core.formatSec(TARGET)}s · 误差 0.009s ⚛️ 原子钟`,
    lines[0]);
  check('连胜=1 不显示连胜尾行（>1 才显示）', lines[2] === 'bodyclock.fun', lines[2]);
  await ctx.close();

  // 守时边界另一侧: 最好恰 201ms → 未守时
  const { ctx: c2, page: p2 } = await newPage(browser, { width: 1280, height: 800 }, { tag: 'daily201' });
  await playDay(p2, [201, 300, -250]);
  const s2 = await st8(p2);
  check('best=201 → 未守时文案', s2.bestErrMs === 201 &&
    (await p2.locator('#s-streak').textContent()).includes('未守时'),
    `${s2.bestErrMs} / ${await p2.locator('#s-streak').textContent()}`);
  check('201/300/250 全超 80 → 🟥🟥🟥',
    (await p2.locator('#s-squares').textContent()) === '🟥🟥🟥');
  await c2.close();
}

/* ============================================ 3. 作弊面 */
console.log('\n[3] 作弊面 — 失焦 / 多指 / 右键 / 跨天中断');
{
  const { ctx, page } = await newPage(browser, { width: 1280, height: 800 }, { tag: 'cheat' });

  // —— 按住中切 tab: PLAYBOOK 口径 = 作废该次 + UI 反馈
  const c = await dialCenter(page);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.evaluate(() => { window.__qaT += 3000; });
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(80);
  let s = await st8(page);
  check('切走 → 该次作废（phase 回 idle）', s.phase === 'idle', s.phase);
  check('切走 → 不消耗机会', s.attemptCount === 0, s.attemptCount);
  check('切走 → 有 UI 反馈（toast「不算」）',
    await page.locator('#toast').isVisible() &&
    (await page.locator('#toast').textContent()).includes('不算'),
    await page.locator('#toast').textContent().catch(() => 'no toast'));
  await page.mouse.up(); // 归位真实鼠标
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(80);
  s = await st8(page);
  check('切回后松开不产生幽灵成绩', s.attemptCount === 0 && s.phase === 'idle');

  // —— 多指去重: 真指按住中，伪造第二指 down/up 不得重置计时或提前结算
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.evaluate(() => { window.__qaT += 2000; });
  await page.evaluate(() => {
    const dial = document.getElementById('dial');
    dial.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 77, isPrimary: false }));
    dial.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 77, isPrimary: false }));
  });
  await page.waitForTimeout(60);
  s = await st8(page);
  check('第二指 down/up 不结束真按住', s.phase === 'holding' && s.attemptCount === 0,
    `${s.phase}/${s.attemptCount}`);
  await page.evaluate((t) => { window.__qaT += t - 2000; }, TARGET + 38);
  await page.mouse.up();
  await page.waitForTimeout(80);
  s = await st8(page);
  check('松开后仅计 1 次且时长未被重置（err=38ms）',
    s.attemptCount === 1 && s.lastErrMs === 38, `n=${s.attemptCount} err=${s.lastErrMs}`);

  // —— 右键: 不弹菜单（contextmenu 被阻止）
  const prevented = await page.evaluate(() => {
    const dial = document.getElementById('dial');
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    dial.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  check('表盘 contextmenu 被阻止', prevented === true);
  // 左键按住中追加右键按/放（同一鼠标指针的 chorded button）不得干扰
  await page.click('#btn-next');
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.evaluate(() => { window.__qaT += 1500; });
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await page.evaluate((t) => { window.__qaT += t - 1500 + 50; }, TARGET);
  await page.mouse.up();
  await page.waitForTimeout(80);
  s = await st8(page);
  check('按住中点右键不重置/不提前结算（err=50ms，共 2 次）',
    s.attemptCount === 2 && s.lastErrMs === 50, `n=${s.attemptCount} err=${s.lastErrMs}`);

  // —— 按住中跨天: 作废且换题，不产生跨题成绩
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.evaluate(() => { window.__qaT += 4000; });
  await page.evaluate((n) => window.__bc.setNow(n), NOON(TEST_DAY + 1));
  await page.waitForTimeout(80);
  s = await st8(page);
  check('按住中跨天 → 作废 + 换题', s.phase === 'idle' && s.issueNo === core.issueNumber(TEST_DAY) + 1
    && s.attemptCount === 0, `${s.phase}/#${s.issueNo}/n=${s.attemptCount}`);
  check('跨天中断有 UI 反馈', await page.locator('#toast').isVisible(),
    await page.locator('#toast').textContent().catch(() => 'no toast'));
  await page.mouse.up();
  await page.waitForTimeout(60);
  check('跨天后松开不计入新题', (await st8(page)).attemptCount === 0);
  await ctx.close();
}

/* ============================================ 4. 状态机 — 刷新恢复 / 练习隔离 / 连胜注入 */
console.log('\n[4] 状态机 — 刷新恢复 / 练习隔离 / 连胜跨天注入');
{
  const { ctx, page } = await newPage(browser, { width: 1280, height: 800 }, { tag: 'state' });
  // 2 次后刷新
  await exactHold(page, TARGET + 100);
  await page.click('#btn-next');
  await exactHold(page, TARGET - 150);
  await page.reload();
  await page.waitForTimeout(150);
  let s = await st8(page);
  check('刷新后恢复 2 次已用 / 还剩 1 次', s.attemptCount === 2 && s.allowed === 3 && s.phase === 'idle',
    `n=${s.attemptCount} allowed=${s.allowed}`);
  check('刷新后 best 保留 100ms', s.bestErrMs === 100, s.bestErrMs);
  check('刷新后提示还剩次数', (await page.locator('#dial-hint').textContent()).includes('还剩 1 次'),
    await page.locator('#dial-hint').textContent());

  // 练习不写每日
  await page.click('#tab-practice');
  await page.waitForTimeout(80);
  const pt = (await st8(page)).targetMs;
  await exactHold(page, pt + 5);
  s = await st8(page);
  check('练习打出原子钟只进练习', s.mode === 'practice' && s.lastErrMs === 5);
  await page.click('#btn-next');
  await page.click('#tab-daily');
  await page.waitForTimeout(80);
  s = await st8(page);
  check('回每日: 仍 2 次已用，best 仍 100（练习未写入）',
    s.attemptCount === 2 && s.bestErrMs === 100, `n=${s.attemptCount} best=${s.bestErrMs}`);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('bodyclock.v1')));
  check('localStorage 中当日仅 2 条尝试', stored.days[String(TEST_DAY)].attempts.length === 2);

  // 用掉第 3 次（守时），进入连胜注入
  await exactHold(page, TARGET + 80);
  await page.click('#btn-next');
  await page.waitForTimeout(80);
  s = await st8(page);
  check('D0 守时 → 连胜 1', s.streak === 1, s.streak);

  // D+1 守时 → 2
  await page.evaluate((n) => window.__bc.setNow(n), NOON(TEST_DAY + 1));
  await page.waitForTimeout(80);
  s = await st8(page);
  check('D+1 开盘结转昨日连胜 1', s.streak === 1, s.streak);
  await playDay(page, [50, 300, 400]);
  s = await st8(page);
  check('D+1 守时（best 50）→ 连胜 2', s.streak === 2, s.streak);
  check('结算文案「连胜 2 天」', (await page.locator('#s-streak').textContent()).includes('连胜 2 天'));

  // D+3（漏掉 D+2）→ 清零后重计 1
  await page.evaluate((n) => window.__bc.setNow(n), NOON(TEST_DAY + 3));
  await page.waitForTimeout(80);
  s = await st8(page);
  check('漏一天 → 开盘连胜清零', s.streak === 0, s.streak);
  check('清零后头部连胜行隐藏', await page.locator('#streak-line').isHidden());
  await playDay(page, [-120, 400, 600]);
  s = await st8(page);
  check('漏一天后守时 → 重计 1', s.streak === 1, s.streak);

  // D+4 全部超标 → 断（0），头部隐藏
  await page.evaluate((n) => window.__bc.setNow(n), NOON(TEST_DAY + 4));
  await page.waitForTimeout(80);
  await playDay(page, [201, -300, 450]);
  s = await st8(page);
  check('超标日（best 201）→ 连胜 0', s.streak === 0, s.streak);
  check('未守时结算文案', (await page.locator('#s-streak').textContent()).includes('未守时'));

  // D+5 守时 → 从 1 重来
  await page.evaluate((n) => window.__bc.setNow(n), NOON(TEST_DAY + 5));
  await page.waitForTimeout(80);
  await playDay(page, [10, 900, -900]);
  s = await st8(page);
  check('断后次日守时 → 连胜 1', s.streak === 1, s.streak);
  await ctx.close();
}

/* ============================================ 5. 激励视频占位 */
console.log('\n[5] 激励视频占位 — 看完才发奖 / 每日一次 / 持久化');
{
  const { ctx, page } = await newPage(browser, { width: 1280, height: 800 }, { tag: 'ad' });
  await playDay(page, [500, -400, 300]);
  let s = await st8(page);
  check('3 次打完进结算', s.phase === 'summary' && s.allowed === 3);

  // 中途关闭 → 不发奖
  await page.click('#btn-ad-retry');
  check('占位弹层出现', await page.locator('#ad-modal').isVisible());
  await page.click('#btn-ad-close');
  await page.waitForTimeout(60);
  s = await st8(page);
  check('中途关闭不发奖（仍 3 次）', s.allowed === 3, s.allowed);
  check('关闭后挂点按钮仍在', await page.locator('#btn-ad-retry').isVisible());

  // 模拟看完 → +1，且用完后挂点消失（每日限 1）
  await page.click('#btn-ad-retry');
  await page.click('#btn-ad-mock');
  await page.waitForTimeout(80);
  s = await st8(page);
  check('看完发奖 +1 次（allowed=4）', s.allowed === 4 && s.phase === 'idle', s.allowed);
  await page.reload();
  await page.waitForTimeout(150);
  s = await st8(page);
  check('刷新后 extra 持久（仍 4 次额度、已用 3）', s.allowed === 4 && s.attemptCount === 3,
    `allowed=${s.allowed} n=${s.attemptCount}`);
  await exactHold(page, (await st8(page)).targetMs + 7);
  await page.click('#btn-next');
  await page.waitForTimeout(80);
  s = await st8(page);
  check('加时第 4 次可打且计入 best（7ms）', s.attemptCount === 4 && s.bestErrMs === 7);
  check('额度用完回结算，加时挂点隐藏（每日仅一次）',
    s.phase === 'summary' && await page.locator('#btn-ad-retry').isHidden());

  // 干扰模式解锁：跨刷新持久 + ★ 全链路
  await page.click('#btn-ad-distortion');
  await page.click('#btn-ad-mock');
  await page.waitForTimeout(80);
  s = await st8(page);
  check('解锁后干扰模式开启', s.distortion === true);
  await page.reload();
  await page.waitForTimeout(150);
  s = await st8(page);
  check('刷新后解锁状态持久', s.distortion === true);
  await page.evaluate((n) => window.__bc.setNow(n), NOON(TEST_DAY + 1));
  await page.waitForTimeout(80);
  s = await st8(page);
  check('跨天机会重置回 3（extra 不结转）', s.allowed === 3 && s.attemptCount === 0,
    `allowed=${s.allowed}`);
  await exactHold(page, (await st8(page)).targetMs + 44);
  s = await st8(page);
  check('★ 写入尝试记录', s.attempts[0] && s.attempts[0].star === true);
  check('揭晓屏带 ★ 与「干扰模式」标记',
    await page.locator('#r-star').isVisible() &&
    (await page.locator('#result-mode-label').textContent()).includes('干扰'));
  await playDay(page, [400, 500]);
  const txt = await page.evaluate(() => window.__bc.shareText());
  check('分享文本称号缀 ★', /石英表★/.test(txt.split('\n')[0]), txt.split('\n')[0]);
  await ctx.close();
}

/* ============================================ 6. 微信小游戏骨架静态审查 */
console.log('\n[6] 微信小游戏骨架静态审查');
{
  const WX = path.join(HERE, '..', 'wechat-minigame');
  const read = (f) => fs.readFileSync(path.join(WX, f), 'utf8');
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  // game.json 字段合法
  let gj = null;
  try { gj = JSON.parse(read('game.json')); } catch (e) {}
  check('game.json 可解析', gj !== null);
  check('deviceOrientation 合法', gj && ['portrait', 'landscape'].includes(gj.deviceOrientation));
  const VALID_KEYS = ['deviceOrientation', 'showStatusBar', 'networkTimeout', 'workers',
    'subpackages', 'plugins', 'openDataContext', 'resizable', 'iOSHighPerformance'];
  check('game.json 无未知字段', gj && Object.keys(gj).every((k) => VALID_KEYS.includes(k)),
    gj && Object.keys(gj).filter((k) => !VALID_KEYS.includes(k)).join(','));
  check('networkTimeout 数值合法', gj && typeof gj.networkTimeout === 'object' &&
    Object.values(gj.networkTimeout).every((v) => Number.isFinite(v) && v > 0));

  let pc = null;
  try { pc = JSON.parse(read('project.config.json')); } catch (e) {}
  check('project.config.json 可解析且 compileType=game', pc !== null && pc.compileType === 'game');

  // game.js 不得直接触碰 wx./tt.（一律经 adapter）
  const gameSrc = stripComments(read('game.js'));
  check('game.js 零直接 wx./tt. 调用', !/\b(wx|tt)\s*\./.test(gameSrc));
  check('game.js 语法可解析', (() => {
    try { new Function('require', 'module', 'exports', read('game.js')); return true; } catch (e) { return false; }
  })());

  // adapter.js: 平台 API 集中且全部有降级（api 空值守卫或 try/catch）
  const adapterRaw = read('adapter.js');
  const adapterSrc = stripComments(adapterRaw);
  check('adapter.js 语法可解析', (() => {
    try { new Function('require', 'module', 'exports', adapterRaw); return true; } catch (e) { return false; }
  })());
  check('adapter.js 仅以 typeof 探测 wx/tt（无裸调用）', !/\b(wx|tt)\s*\./.test(adapterSrc));
  // 每个含 api.xxx( 调用的方法体必须含降级（"api &&"、"!api" 或 try）
  const bodies = adapterSrc.split(/\n\s{2}\w[\w]*:\s*function/).slice(1);
  const unguarded = bodies.filter((b) => /\bapi\.\w+\(/.test(b) &&
    !(/\bapi\s*&&/.test(b) || /!api\b/.test(b) || /\btry\b/.test(b)));
  check('adapter.js 所有 api 调用均有降级路径', unguarded.length === 0,
    unguarded.length + ' 处未守卫');

  // 副本一致 + 超时常量三端同源
  const a = fs.readFileSync(path.join(HERE, '..', 'shared', 'core.js'), 'utf8');
  const b = read(path.join('shared', 'core.js'));
  check('wechat-minigame/shared/core.js 逐字节一致', a === b);
  check('core 暴露 MAX_HOLD_MS 超时常量', core.MAX_HOLD_MS === 60000, core.MAX_HOLD_MS);
  check('game.js 使用 MAX_HOLD_MS 超时保护', /MAX_HOLD_MS/.test(gameSrc));
  const appSrc = fs.readFileSync(path.join(HERE, '..', 'app.js'), 'utf8');
  check('app.js 使用 MAX_HOLD_MS 超时保护', /MAX_HOLD_MS/.test(appSrc));
}

/* ============================================ 7. 美学素材截图（人工目检用） */
console.log('\n[7] 美学素材截图');
{
  const { ctx, page } = await newPage(browser, { width: 1280, height: 800 }, { tag: 'shots' });
  await page.screenshot({ path: path.join(SHOTS, 'qa-idle.png') });

  // 按住脉动（真实等待 1.4s 抓呼吸环中段；假时钟只推 100ms → 松开算误触，不消耗）
  const c = await dialCenter(page);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(SHOTS, 'qa-holding.png') });
  await page.evaluate(() => { window.__qaT += 100; });
  await page.mouse.up();
  await page.waitForTimeout(2400); // 等误触 toast 消失，别混进美学截图

  // 揭晓（+38ms 石英表，针角微偏右）
  await exactHold(page, TARGET + 38);
  await page.waitForTimeout(700); // 等回摆动画走完
  await page.screenshot({ path: path.join(SHOTS, 'qa-reveal.png') });
  await page.click('#btn-next');
  await exactHold(page, TARGET + 150);
  await page.click('#btn-next');
  await exactHold(page, TARGET - 320);
  await page.click('#btn-next');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, 'qa-summary.png') });
  const png = await page.evaluate(() => window.__bc.sharePngDataUrl());
  fs.writeFileSync(path.join(SHOTS, 'qa-share-card.png'), Buffer.from(png.split(',')[1], 'base64'));
  await ctx.close();

  const { ctx: cm, page: pm } = await newPage(browser, { width: 375, height: 667 }, { tag: 'shots-m' });
  await pm.screenshot({ path: path.join(SHOTS, 'qa-mobile-idle.png') });
  await exactHold(pm, TARGET - 66);
  await pm.waitForTimeout(700);
  await pm.screenshot({ path: path.join(SHOTS, 'qa-mobile-reveal.png') });
  await cm.close();
  check('7 张素材截图落盘', ['qa-idle', 'qa-holding', 'qa-reveal', 'qa-summary',
    'qa-share-card', 'qa-mobile-idle', 'qa-mobile-reveal']
    .every((n) => fs.existsSync(path.join(SHOTS, n + '.png'))));
}

/* ============================================ 8. 控制台 */
console.log('\n[8] 控制台');
check('零 console error', consoleErrors.length === 0, consoleErrors.join(' | '));
check('零 pageerror', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();
console.log(`\n共 ${passes + failures} 项: ${passes} 通过, ${failures} 失败`);
process.exit(failures ? 1 : 0);
