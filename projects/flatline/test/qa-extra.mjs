// Flatline 对抗性 QA 测试 —— 从仓库根运行: node projects/flatline/test/qa-extra.mjs
// 覆盖: 时钟注入(期号/拍序/午夜滚动)、连胜结转/断裂/归零、练习不入档、
//       分享 PNG 像素级解码、触屏+键盘混用不双计、声音开关持久化、320px 极窄视口。
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX = path.resolve(HERE, '..', 'index.html');
const URL = 'file://' + INDEX;
const SHOTS = path.join(HERE, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

let passes = 0, failures = 0;
function check(name, cond, extra) {
  if (cond) { passes++; console.log('  PASS ' + name); }
  else { failures++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

const consoleErrors = [], pageErrors = [];
function watch(page, tag) {
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${tag}] ${m.text()}`); });
  page.on('pageerror', (e) => pageErrors.push(`[${tag}] ${e.message}`));
  page.on('download', (d) => d.cancel().catch(() => {}));
}

// 时钟注入：把 Date 整体平移到目标时刻，之后随真实时间流动（本地时区语义不变）
function clockScript(localIso) {
  return `(() => {
    const RealDate = Date;
    const target = new RealDate('${localIso}').getTime();
    const base = RealDate.now();
    class FakeDate extends RealDate {
      constructor(...a) { a.length === 0 ? super(target + (RealDate.now() - base)) : super(...a); }
      static now() { return target + (RealDate.now() - base); }
    }
    FakeDate.UTC = RealDate.UTC;
    FakeDate.parse = RealDate.parse;
    window.Date = FakeDate;
  })();`;
}
function seedScript(storeObj) {
  // 只在首次加载注入（reload 后 addInitScript 会重跑，不能把游戏写入的档案又盖回去）
  return `try {
    if (!localStorage.getItem('__qaSeeded')) {
      localStorage.setItem('__qaSeeded', '1');
      localStorage.setItem('flatline.v1', ${JSON.stringify(JSON.stringify(storeObj))});
    }
  } catch (e) {}`;
}
const DAY_0701 = 20635; // 2026-07-01 = #1
const goodResult = (day, issue) => ({
  day, issue, calm: 92, status: 'RESTING', failBeat: null,
  date: 'x', mode: 'daily', seed: day, scores: Array(14).fill(92),
});

const st8 = (page) => page.evaluate(() => window.__flatline.state());
const readStore = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('flatline.v1')));

let pidSeq = 100;
async function synthTap(page) {
  await page.evaluate((pid) => {
    const s = document.getElementById('stage');
    const o = { bubbles: true, cancelable: true, pointerId: pid, isPrimary: true };
    s.dispatchEvent(new PointerEvent('pointerdown', o));
    s.dispatchEvent(new PointerEvent('pointerup', o));
  }, ++pidSeq);
}
const pDown = (page) => page.evaluate((pid) => {
  document.getElementById('stage').dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: pid, isPrimary: true }));
}, ++pidSeq + 5000);
const pUp = (page) => page.evaluate((pid) => {
  document.getElementById('stage').dispatchEvent(
    new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: pid, isPrimary: true }));
}, pidSeq + 5000);

// 好好打一局：TAP 准点、HOLD 按住到点松手、WAIT 默认忍住（可用 onWait 干预）
async function driveGood(page, opts = {}) {
  const waitSeen = [];
  const holdDown = { on: false };
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    const s = await st8(page);
    if (s.screen === 'result') return { s, waitSeen };
    if (s.screen === 'game' && s.cue && !s.locked && !s.inGap) {
      const c = s.cue;
      if (c.type === 'TAP' && !c.pressed && c.pressInMs <= 80) await synthTap(page);
      else if (c.type === 'HOLD') {
        if (c.cueShown && !c.pressed && !c.released && !holdDown.on) { holdDown.on = true; await pDown(page); }
        else if (c.pressed && !c.released && c.releaseInMs != null && c.releaseInMs <= 60) { holdDown.on = false; await pUp(page); }
      } else if (c.type === 'WAIT' && !waitSeen.includes(s.beatIndex)) {
        waitSeen.push(s.beatIndex);
        if (opts.onWait) await opts.onWait(waitSeen.length, s.beatIndex);
      }
    }
    await page.waitForTimeout(25);
  }
  throw new Error('driveGood 超时');
}

// 摆烂局：什么都不按、WAIT 各点一下 → 前 3 拍必然 <30 → CODE BLUE
async function driveCrash(page) {
  const tapped = new Set();
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const s = await st8(page);
    if (s.screen === 'result') return s;
    if (s.screen === 'game' && s.cue && s.cue.type === 'WAIT' && !tapped.has(s.beatIndex)) {
      tapped.add(s.beatIndex);
      await synthTap(page);
    }
    await page.waitForTimeout(35);
  }
  throw new Error('driveCrash 超时');
}

async function pngStats(page) {
  return page.evaluate(async () => {
    const url = window.__flatline.exportPNG();
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, c.width, c.height).data;
    let lit = 0, green = 0, red = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r + g + b > 90) lit++;
      if (g > 140 && g > r * 1.4 && g >= b) green++;
      if (r > 140 && r > g * 1.4) red++;
    }
    const total = c.width * c.height;
    return { w: img.width, h: img.height, len: url.length,
      litFrac: lit / total, greenFrac: green / total, redFrac: red / total, dataUrl: url };
  });
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

// ============================================================ [A] 时钟注入：期号 / 拍序
console.log('\n[A] 时钟注入 — 期号与拍序随日期变化，同日确定');
{
  const cases = [
    ['2026-07-04T10:00:00', 4],
    ['2026-07-05T10:00:00', 5],
    ['2026-07-11T10:00:00', 11],
    ['2027-01-01T10:00:00', 185],
  ];
  const previews = [];
  for (const [iso, issue] of cases) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    watch(page, 'clock-' + iso.slice(0, 10));
    await page.addInitScript(clockScript(iso));
    await page.goto(URL);
    await page.waitForTimeout(300);
    const s = await st8(page);
    check(`${iso.slice(0, 10)} 期号 = #${issue}`, s.issue === issue, 'got #' + s.issue);
    const shown = await page.textContent('#startIssue');
    check(`${iso.slice(0, 10)} 开始屏期号一致`, shown.trim() === '#' + issue, shown);
    previews.push(await page.evaluate(() => window.__flatline.defsPreview()));
    await ctx.close();
  }
  check('不同日期拍序互不相同', new Set(previews).size === previews.length);
  // 同一天两次加载 → 拍序一致（全球同题的确定性）
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  watch(page, 'clock-repeat');
  await page.addInitScript(clockScript('2026-07-05T22:00:00'));
  await page.goto(URL);
  await page.waitForTimeout(300);
  const again = await page.evaluate(() => window.__flatline.defsPreview());
  check('同日重载拍序一致（确定性）', again === previews[1], again + ' vs ' + previews[1]);
  await ctx.close();
}

// ============================================================ [B] 跨午夜滚动
console.log('\n[B] 跨午夜 — 开始屏自动换期');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  watch(page, 'midnight');
  const D = DAY_0701 + 8; // 2026-07-09
  await page.addInitScript(clockScript('2026-07-09T23:59:58'));
  await page.addInitScript(seedScript({
    v: 1, sound: true, streak: 2, bestStreak: 3, bestCalm: 92,
    lastDay: D, lastResult: goodResult(D, 9), history: [goodResult(D, 9)],
  }));
  await page.goto(URL);
  await page.waitForTimeout(400);
  check('午夜前显示今日已完成', await page.isVisible('#startDone'));
  check('午夜前期号 #9', (await page.textContent('#startIssue')).trim() === '#9');
  await page.waitForTimeout(4000); // 跨过 00:00
  check('午夜后自动切换为可开局', await page.isVisible('#startFresh'), 'startDone 未消失');
  check('午夜后期号自动变 #10', (await page.textContent('#startIssue')).trim() === '#10',
    await page.textContent('#startIssue'));
  check('午夜后连胜行仍在（昨天打过，连胜未死）', await page.isVisible('#streakLine'));
  await ctx.close();
}

// ============================================================ [C] 连胜结转 + 练习不入档
console.log('\n[C] 连胜结转（昨天 RESTING → 今天 +1）+ 练习模式不改档案');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  watch(page, 'streak-carry');
  const D = DAY_0701 + 9; // 2026-07-10 = #10
  await page.addInitScript(clockScript('2026-07-10T09:00:00'));
  await page.addInitScript(seedScript({
    v: 1, sound: true, streak: 3, bestStreak: 5, bestCalm: 88,
    lastDay: D - 1, lastResult: goodResult(D - 1, 9), history: [goodResult(D - 1, 9)],
  }));
  await page.goto(URL);
  await page.waitForTimeout(400);
  check('开始屏展示昨日连胜', (await page.textContent('#streakLine')).includes('已连稳 3 天 · 最佳 5'),
    await page.textContent('#streakLine'));
  await page.mouse.click(640, 420);
  const { s: res } = await driveGood(page);
  check('今日局完赛', res.screen === 'result' && res.status !== 'CODEBLUE', res.status);
  let st = await readStore(page);
  check('连胜正确结转 3→4', st.streak === 4, 'streak=' + st.streak);
  check('bestStreak 保持 5', st.bestStreak === 5, 'bestStreak=' + st.bestStreak);
  check('lastDay 记为今天', st.lastDay === D, 'lastDay=' + st.lastDay);
  check('history 追加 1 条', st.history.length === 2, 'len=' + st.history.length);
  const dailyCalm = st.lastResult.calm;

  // 练习局：完整打一局，档案必须纹丝不动
  await page.click('#practiceBtn');
  await page.waitForTimeout(300);
  const ps = await st8(page);
  check('练习局已开（mode=practice）', ps.mode === 'practice');
  const { s: pres } = await driveGood(page);
  check('练习局完赛', pres.screen === 'result');
  const shareP = await page.evaluate(() => window.__flatline.shareText());
  check('练习分享首行为「Flatline 练习」', shareP.startsWith('Flatline 练习\n'), shareP.split('\n')[0]);
  check('练习分享不含期号 #', !shareP.split('\n')[0].includes('#'));
  st = await readStore(page);
  check('练习后连胜不变（仍为 4）', st.streak === 4, 'streak=' + st.streak);
  check('练习后 history 不变', st.history.length === 2, 'len=' + st.history.length);
  check('练习后 lastResult 仍是当日局', st.lastResult.calm === dailyCalm && st.lastResult.day === D);
  check('练习结算隐藏下一期倒计时', !(await page.isVisible('#countdownRow')));
  // 重载 → 开始屏回到「今日已完成」+ 连胜 4
  await page.reload();
  await page.waitForTimeout(400);
  check('重载回今日已完成态', await page.isVisible('#startDone'));
  check('重载后连胜行为 4 天', (await page.textContent('#streakLine')).includes('已连稳 4 天'));
  await ctx.close();
}

// ============================================================ [D] 连胜断裂（漏天）与 CODE BLUE 归零
console.log('\n[D] 连胜断裂 — 漏天重置为 1 / CODE BLUE 归零 / 死连胜不展示');
{
  // 漏 4 天后完赛 → streak = 1（不是 10）
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  watch(page, 'streak-break');
  const D = DAY_0701 + 9;
  await page.addInitScript(clockScript('2026-07-10T09:00:00'));
  await page.addInitScript(seedScript({
    v: 1, sound: true, streak: 9, bestStreak: 9, bestCalm: 95,
    lastDay: D - 5, lastResult: goodResult(D - 5, 5), history: [goodResult(D - 5, 5)],
  }));
  await page.goto(URL);
  await page.waitForTimeout(400);
  check('死连胜不在开始屏展示', !(await page.isVisible('#streakLine')));
  await page.mouse.click(640, 420);
  const { s: res } = await driveGood(page);
  check('漏天局完赛', res.screen === 'result' && res.status !== 'CODEBLUE', res.status);
  const st = await readStore(page);
  check('漏天后连胜重置为 1', st.streak === 1, 'streak=' + st.streak);
  check('bestStreak 保留 9', st.bestStreak === 9, 'bestStreak=' + st.bestStreak);
  await ctx.close();

  // 昨天正常、今天 CODE BLUE → 归零
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page2 = await ctx2.newPage();
  watch(page2, 'streak-zero');
  await page2.addInitScript(clockScript('2026-07-10T09:00:00'));
  await page2.addInitScript(seedScript({
    v: 1, sound: true, streak: 6, bestStreak: 6, bestCalm: 95,
    lastDay: D - 1, lastResult: goodResult(D - 1, 9), history: [goodResult(D - 1, 9)],
  }));
  await page2.goto(URL);
  await page2.waitForTimeout(400);
  await page2.mouse.click(640, 420);
  const crash = await driveCrash(page2);
  check('摆烂局触发 CODE BLUE', crash.status === 'CODEBLUE', crash.status);
  const st2 = await readStore(page2);
  check('CODE BLUE 连胜归零', st2.streak === 0, 'streak=' + st2.streak);
  check('bestStreak 不受影响', st2.bestStreak === 6);
  // CODE BLUE 分享 PNG 应含红色尖峰
  const blue = await pngStats(page2);
  check('CODE BLUE PNG 尺寸 1200×630', blue.w === 1200 && blue.h === 630);
  check('CODE BLUE PNG 含猩红像素', blue.redFrac > 0.0008, 'redFrac=' + blue.redFrac.toFixed(5));
  fs.writeFileSync(path.join(SHOTS, 'share-codeblue.png'),
    Buffer.from(blue.dataUrl.split(',')[1], 'base64'));
  await ctx2.close();
}

// ============================================================ [E] 分享 PNG 像素级检查（RESTING）
console.log('\n[E] 分享 PNG 解码 — 非全黑 / 有磷光绿 / 尺寸正确');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  watch(page, 'png');
  const D = DAY_0701 + 3;
  await page.addInitScript(clockScript('2026-07-04T12:00:00'));
  await page.addInitScript(seedScript({
    v: 1, sound: true, streak: 1, bestStreak: 1, bestCalm: 90,
    lastDay: D, lastResult: goodResult(D, 4), history: [goodResult(D, 4)],
  }));
  await page.goto(URL);
  await page.waitForTimeout(400);
  const p = await pngStats(page);
  check('PNG 尺寸 1200×630', p.w === 1200 && p.h === 630, p.w + 'x' + p.h);
  check('PNG dataURL 长度 > 20000', p.len > 20000, 'len=' + p.len);
  check('PNG 非全黑（发光像素 > 2%）', p.litFrac > 0.02, 'litFrac=' + p.litFrac.toFixed(4));
  check('PNG 非全白（发光像素 < 60%）', p.litFrac < 0.6, 'litFrac=' + p.litFrac.toFixed(4));
  check('PNG 含磷光绿像素', p.greenFrac > 0.003, 'greenFrac=' + p.greenFrac.toFixed(5));
  fs.writeFileSync(path.join(SHOTS, 'share-resting.png'),
    Buffer.from(p.dataUrl.split(',')[1], 'base64'));
  await ctx.close();
}

// ============================================================ [F] 触屏 + 键盘/鼠标混用不双计
console.log('\n[F] 触屏 tap 单计一次 / 键盘按住时触屏不双计');
{
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true,
  });
  const page = await ctx.newPage();
  watch(page, 'touch');
  await page.addInitScript(clockScript('2026-07-10T09:00:00'));
  await page.goto(URL);
  await page.waitForTimeout(400);
  await page.tap('#stage');
  const acted = [];
  const { s: res, waitSeen } = await driveGood(page, {
    onWait: async (nth, beat) => {
      // 注意：必须用 touchscreen.tap（原始触屏输入）。page.tap 会等元素"稳定"，
      // 而 P2/P3 屏幕摇晃是玩法本体，元素永不稳定 → page.tap 挂起数秒拖死驱动循环。
      if (nth === 1) {           // 真实触屏 tap 一次 → WAIT 应恰好计 1 次（得 8 分）
        await page.touchscreen.tap(187, 400);
        acted.push(beat);
      } else if (nth === 2) {    // 键盘按住期间触屏点一下 → 仍只算 1 次输入
        await page.keyboard.down('Space');
        await page.touchscreen.tap(187, 400);
        await page.keyboard.up('Space');
        acted.push(beat);
      }                          // 其余 WAIT 忍住 → 100
    },
  });
  check('混输入局完赛', res.screen === 'result');
  check('遇到 ≥2 个 WAIT 拍', waitSeen.length >= 2, 'waits=' + JSON.stringify(waitSeen));
  const s1 = res.scores[acted[0] - 1];
  const s2 = res.scores[acted[1] - 1];
  check('真实触屏 tap 恰计 1 次（WAIT 得 8 分）', s1 === 8, 'score=' + s1);
  check('键盘+触屏混用恰计 1 次（WAIT 得 8 分）', s2 === 8, 'score=' + s2);
  const untouched = waitSeen.filter((b) => !acted.includes(b));
  check('未动的 WAIT 得 100', untouched.every((b) => res.scores[b - 1] === 100),
    JSON.stringify(untouched.map((b) => res.scores[b - 1])));
  check('TAP/HOLD 拍未被触屏合成事件双计（无 <30 的好拍）',
    res.scores.every((x, i) => acted.includes(i + 1) || x >= 30), JSON.stringify(res.scores));
  await ctx.close();
}

// ============================================================ [G] 声音开关持久化
console.log('\n[G] 声音开关持久化');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  watch(page, 'sound');
  await page.goto(URL);
  await page.waitForTimeout(300);
  check('默认声音开', (await page.getAttribute('#muteBtn', 'aria-pressed')) === 'true');
  await page.click('#muteBtn');
  check('点击后关', (await page.getAttribute('#muteBtn', 'aria-pressed')) === 'false');
  await page.reload();
  await page.waitForTimeout(300);
  check('重载后仍关', (await page.getAttribute('#muteBtn', 'aria-pressed')) === 'false');
  check('localStorage.sound === false', (await readStore(page)).sound === false);
  await page.click('#muteBtn');
  await page.reload();
  await page.waitForTimeout(300);
  check('再次开启并持久化', (await page.getAttribute('#muteBtn', 'aria-pressed')) === 'true');
  await ctx.close();
}

// ============================================================ [H] 320px 极窄视口
console.log('\n[H] 320px 极窄视口 — 三个屏都不横滚');
{
  const noHScroll = (page) => page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth + 1 &&
    document.getElementById('monitor').scrollWidth <= window.innerWidth + 1);
  const ctx = await browser.newContext({
    viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true,
  });
  const page = await ctx.newPage();
  watch(page, '320px');
  await page.goto(URL);
  await page.waitForTimeout(400);
  check('320px 开始屏不横滚', await noHScroll(page));
  await page.tap('#stage');
  await page.waitForTimeout(1200); // 进拍 1
  check('320px 游戏屏不横滚', await noHScroll(page));
  await page.screenshot({ path: path.join(SHOTS, 'narrow-320-game.png') });
  await ctx.close();

  // 已完成态（按钮行最宽的屏）
  const ctx2 = await browser.newContext({ viewport: { width: 320, height: 568 } });
  const page2 = await ctx2.newPage();
  watch(page2, '320px-done');
  const D = DAY_0701 + 3;
  await page2.addInitScript(clockScript('2026-07-04T12:00:00'));
  await page2.addInitScript(seedScript({
    v: 1, sound: true, streak: 1, bestStreak: 1, bestCalm: 90,
    lastDay: D, lastResult: goodResult(D, 4), history: [goodResult(D, 4)],
  }));
  await page2.goto(URL);
  await page2.waitForTimeout(400);
  check('320px 已完成态不横滚', await page2.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page2.screenshot({ path: path.join(SHOTS, 'narrow-320-done.png') });
  await ctx2.close();
}

await browser.close();

console.log('\n================ 汇总 ================');
console.log('console errors: ' + consoleErrors.length);
consoleErrors.forEach((e) => console.log('  ' + e));
console.log('page errors:    ' + pageErrors.length);
pageErrors.forEach((e) => console.log('  ' + e));
check('零 console error', consoleErrors.length === 0);
check('零 pageerror', pageErrors.length === 0);
console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
console.log('QA-EXTRA: ALL GREEN');
