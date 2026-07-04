// 体内时钟 — Playwright 冒烟测试。从仓库根运行: node projects/body-clock/test/smoke.mjs
// 覆盖: 零 console error、真实按住/松开的误差量级与称号一致性、3 次机会耗尽锁定、
//       分享文本/PNG、激励视频占位发奖、练习不影响每日、时钟注入跨天换题、
//       375/320px 无横滚、localStorage 垃圾容错、reduced-motion、快速连点。
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

// 选一个目标 ≈7s 的测试日（种子确定性 → node 侧可精确预知目标）
let TEST_DAY = core.EPOCH_DAY;
for (let d = core.EPOCH_DAY; d < core.EPOCH_DAY + 3000; d++) {
  const t = core.targetMsForDay(d);
  if (t >= 6800 && t <= 7300) { TEST_DAY = d; break; }
}
const TARGET = core.targetMsForDay(TEST_DAY);
// 本环境 TZ=UTC，tzOffset=0：正午时刻 = day*86400000 + 12h
const FAKE_NOW = TEST_DAY * 86400000 + 12 * 3600000;
console.log(`测试日 dayIndex=${TEST_DAY} (第 ${core.issueNumber(TEST_DAY)} 期) 目标=${TARGET}ms`);

const st8 = (page) => page.evaluate(() => window.__bc.state());
async function holdDial(page, ms) {
  const box = await page.locator('#dial').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
  await page.waitForTimeout(120); // 等 reveal 渲染
}
async function newPage(browser, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: opts.reducedMotion });
  const page = await ctx.newPage();
  watch(page, opts.tag || 'page');
  await page.addInitScript(({ now, garbage }) => {
    window.__BC_NOW__ = now;
    if (garbage != null) { try { localStorage.setItem('bodyclock.v1', garbage); } catch (e) {} }
    else { try { localStorage.clear(); } catch (e) {} }
  }, { now: opts.now ?? FAKE_NOW, garbage: opts.garbage ?? null });
  await page.goto(URL);
  await page.waitForTimeout(150);
  return { ctx, page };
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/* ================================================= 1. 桌面完整旅程 */
console.log('\n[1] 桌面 1280×800 — 三次机会完整旅程');
{
  const { ctx, page } = await newPage(browser, { width: 1280, height: 800 }, { tag: 'desktop' });
  let s = await st8(page);
  check('目标与 node 侧种子一致', s.targetMs === TARGET, `${s.targetMs} vs ${TARGET}`);
  check('期号正确', s.issueNo === core.issueNumber(TEST_DAY), s.issueNo);
  check('初始 3 次机会 · 0 已用', s.allowed === 3 && s.attemptCount === 0);
  check('目标显示两位小数', await page.locator('#target-sec').textContent() === core.formatSec(TARGET));
  await page.screenshot({ path: path.join(SHOTS, 'desktop-start.png') });

  // —— 第 1 次：按 目标-120ms，期待误差 ~50–150ms 量级
  await holdDial(page, TARGET - 120);
  s = await st8(page);
  check('第 1 次已计入', s.attemptCount === 1);
  const shownErr = Math.round(parseFloat(await page.locator('#r-err').textContent()) * 1000);
  check('误差为 ~50ms 量级（5–350ms）', shownErr >= 5 && shownErr <= 350, shownErr + 'ms');
  check('显示误差与内部一致', shownErr === s.lastErrMs, `${shownErr} vs ${s.lastErrMs}`);
  check('称号与误差档位一致', (await page.locator('#r-tier').textContent()) === core.gradeError(shownErr).name,
    await page.locator('#r-tier').textContent());
  check('结果面板可见（reveal）', s.phase === 'reveal');
  await page.screenshot({ path: path.join(SHOTS, 'desktop-reveal.png') });
  await page.click('#btn-next');

  // —— 第 2 次：键盘 Space 按住 600ms（可键盘完成 + 大误差 → 日晷）
  await page.locator('#dial').focus();
  await page.keyboard.down('Space');
  await page.waitForTimeout(600);
  await page.keyboard.up('Space');
  await page.waitForTimeout(120);
  s = await st8(page);
  check('键盘按住可完成第 2 次', s.attemptCount === 2);
  check('大误差落 日晷 档', s.lastErrMs > 5000 && (await page.locator('#r-tier').textContent()) === '日晷');
  await page.click('#btn-next');

  // —— 第 3 次：短按 400ms
  await holdDial(page, 400);
  s = await st8(page);
  check('第 3 次已计入 · done', s.attemptCount === 3 && s.done === true);
  check('按钮转为查看结算', (await page.locator('#btn-next').textContent()).includes('结算'));
  await page.click('#btn-next');
  await page.waitForTimeout(150);
  s = await st8(page);
  check('进入结算屏', s.phase === 'summary');
  check('锁定后再按弹结算不消耗', await (async () => {
    await holdDial(page, 300);
    return (await st8(page)).attemptCount === 3;
  })());

  // —— 结算屏：迷你格 / 分享文本 / PNG / 倒计时
  const sq = [...(await page.locator('#s-squares').textContent())].filter(c => c.trim()).length;
  check('三次迷你格', sq >= 3, sq);
  const txt = await page.evaluate(() => window.__bc.shareText());
  check('分享文本首行格式', new RegExp(`^体内时钟 #${core.issueNumber(TEST_DAY)} · 目标 ${core.formatSec(TARGET)}s · 误差 0\\.\\d{3}s .+`, 'u').test(txt.split('\n')[0]), txt.split('\n')[0]);
  check('分享文本迷你格行', /^[🟩🟨🟥]{3}$/u.test(txt.split('\n')[1]), txt.split('\n')[1]);
  check('分享文本带域名', txt.includes('bodyclock.fun'));
  const png = await page.evaluate(() => window.__bc.sharePngDataUrl());
  check('分享 PNG 非空（>10KB）', png.startsWith('data:image/png') && png.length > 10000, png.length);
  fs.writeFileSync(path.join(SHOTS, 'share-card.png'), Buffer.from(png.split(',')[1], 'base64'));
  await page.click('#btn-copy'); // 复制按钮无异常即可（headless 剪贴板受限走兜底）
  await page.click('#btn-png');  // 下载被测试拦截取消
  check('倒计时格式 hh:mm:ss', /^\d{2}:\d{2}:\d{2}$/.test(await page.locator('#countdown').textContent()));
  await page.screenshot({ path: path.join(SHOTS, 'desktop-summary.png') });

  // —— 激励视频挂点 1：再来一次机会
  await page.click('#btn-ad-retry');
  check('广告占位弹层出现', await page.locator('#ad-modal').isVisible());
  await page.click('#btn-ad-mock');
  await page.waitForTimeout(120);
  s = await st8(page);
  check('发奖后 +1 次机会', s.allowed === 4 && s.phase === 'idle');
  await holdDial(page, 500);
  s = await st8(page);
  check('第 4 次可打', s.attemptCount === 4);
  await page.click('#btn-next');
  await page.waitForTimeout(120);
  check('加时按钮每天限一次（已隐藏）', await page.locator('#btn-ad-retry').isHidden());

  // —— 练习模式不影响每日
  await page.click('#tab-practice');
  await page.waitForTimeout(100);
  s = await st8(page);
  check('练习模式生效', s.mode === 'practice' && s.phase === 'idle');
  const practiceTarget = s.targetMs;
  check('练习目标在 3–12s', practiceTarget >= 3000 && practiceTarget <= 12000, practiceTarget);
  await holdDial(page, 700);
  s = await st8(page);
  check('练习出结果', s.phase === 'reveal' && s.lastErrMs !== null);
  await page.click('#btn-next');
  await page.click('#tab-daily');
  await page.waitForTimeout(100);
  s = await st8(page);
  check('回每日：仍是 4 次已用、结算态', s.attemptCount === 4 && s.phase === 'summary');

  // —— 时钟注入跨天换题
  await page.evaluate((n) => window.__bc.setNow(n), FAKE_NOW + 86400000);
  await page.waitForTimeout(120);
  s = await st8(page);
  check('跨天：期号 +1', s.issueNo === core.issueNumber(TEST_DAY) + 1, s.issueNo);
  check('跨天：目标换题且与种子一致', s.targetMs === core.targetMsForDay(TEST_DAY + 1), s.targetMs);
  check('跨天：机会重置', s.attemptCount === 0 && s.phase === 'idle');

  // —— 激励视频挂点 2：解锁干扰模式 ★
  await page.click('#btn-settings');
  await page.click('#toggle-distortion');
  await page.waitForTimeout(100);
  check('未解锁时点开关拉起广告占位', await page.locator('#ad-modal').isVisible());
  await page.click('#btn-ad-mock');
  await page.waitForTimeout(100);
  s = await st8(page);
  check('干扰模式已解锁并开启', s.distortion === true);
  check('表盘出现 ★ 标记', await page.locator('#distortion-flag').isVisible());
  await holdDial(page, 900);
  s = await st8(page);
  check('干扰模式下成绩带 star', s.attempts[0] && s.attempts[0].star === true);

  await ctx.close();
}

/* ================================================= 2. 快速连点 / 误触 */
console.log('\n[2] 快速连点与误触');
{
  const { ctx, page } = await newPage(browser, { width: 1280, height: 800 }, { tag: 'rapid' });
  const box = await page.locator('#dial').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  for (let i = 0; i < 4; i++) { // 4 连快点（<200ms 按住 = 误触）
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(150);
  let s = await st8(page);
  check('4 次快速点击不消耗机会', s.attemptCount === 0, s.attemptCount);
  // 按住期间再派发一个 pointerdown，不应重置计时或报错
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.getElementById('dial').dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 99, isPrimary: false }));
  });
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(120);
  s = await st8(page);
  check('重复 pointerdown 只计一次', s.attemptCount === 1, s.attemptCount);
  await ctx.close();
}

/* ================================================= 3. localStorage 垃圾容错 */
console.log('\n[3] localStorage 垃圾容错');
{
  const { ctx, page } = await newPage(browser, { width: 1280, height: 800 },
    { tag: 'garbage', garbage: '{{{不是JSON⚙' });
  const s = await st8(page);
  check('垃圾数据回退默认可玩', s.attemptCount === 0 && s.allowed === 3 && s.phase === 'idle');
  await holdDial(page, 500);
  check('垃圾数据后仍可完成一次', (await st8(page)).attemptCount === 1);
  await ctx.close();

  const { ctx: c2, page: p2 } = await newPage(browser, { width: 1280, height: 800 },
    { tag: 'garbage2', garbage: JSON.stringify({ v: 1, days: { abc: 1, [TEST_DAY]: { attempts: [{ errMs: 'x' }, { errMs: 50, heldMs: 7050 }], done: true } }, settings: 'no' }) });
  const s2 = await st8(p2);
  check('半截合法数据被归一化（保留 1 次有效尝试）', s2.attemptCount === 1 && s2.bestErrMs === 50, JSON.stringify({ n: s2.attemptCount, b: s2.bestErrMs }));
  await c2.close();
}

/* ================================================= 4. 移动端视口 */
console.log('\n[4] 375px 与 320px 视口 — 无横向滚动');
{
  const { ctx, page } = await newPage(browser, { width: 375, height: 667 }, { tag: 'mobile375' });
  const noH = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check('375px 无横滚', noH,
    await page.evaluate(() => document.documentElement.scrollWidth + ' vs ' + window.innerWidth));
  const dialBox = await page.locator('#dial').boundingBox();
  check('375px 触控目标 ≥44px（表盘 ' + Math.round(dialBox.width) + 'px）', dialBox.width >= 44);
  await page.screenshot({ path: path.join(SHOTS, 'mobile-start.png') });
  await holdDial(page, 600);
  check('375px 可完成一次', (await st8(page)).attemptCount === 1);
  await page.screenshot({ path: path.join(SHOTS, 'mobile-reveal.png') });
  await ctx.close();

  const { ctx: c3, page: p3 } = await newPage(browser, { width: 320, height: 568 }, { tag: 'mobile320' });
  const noH320 = await p3.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check('320px 无横滚', noH320,
    await p3.evaluate(() => document.documentElement.scrollWidth + ' vs ' + window.innerWidth));
  await p3.screenshot({ path: path.join(SHOTS, 'narrow-320.png') });
  await c3.close();
}

/* ================================================= 5. prefers-reduced-motion */
console.log('\n[5] prefers-reduced-motion 降级');
{
  const { ctx, page } = await newPage(browser, { width: 1280, height: 800 },
    { tag: 'reduced', reducedMotion: 'reduce' });
  await holdDial(page, 500);
  const s = await st8(page);
  check('降级动画下完整一次可玩', s.attemptCount === 1 && s.phase === 'reveal');
  await ctx.close();
}

/* ================================================= 6. 控制台零错误 */
console.log('\n[6] 控制台');
check('零 console error', consoleErrors.length === 0, consoleErrors.join(' | '));
check('零 pageerror', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();
console.log(`\n共 ${passes + failures} 项: ${passes} 通过, ${failures} 失败`);
process.exit(failures ? 1 : 0);
