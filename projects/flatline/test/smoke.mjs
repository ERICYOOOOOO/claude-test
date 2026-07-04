// Flatline 冒烟测试 —— 从仓库根运行: node projects/flatline/test/smoke.mjs
// 覆盖: 零 console error/pageerror、完整一局到结算、分享文本/PNG、
//       localStorage 垃圾容错、快速连点不重复计分、reduced-motion、375px 视口。
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX = path.resolve(HERE, '..', 'index.html');
const SHOTS = path.join(HERE, 'screenshots');
const URL = 'file://' + INDEX;
fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0;
let passes = 0;
function check(name, cond, extra) {
  if (cond) { passes++; console.log('  PASS ' + name); }
  else { failures++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

const consoleErrors = [];
const pageErrors = [];
function watch(page, tag) {
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[${tag}] ${m.text()}`);
  });
  page.on('pageerror', (e) => pageErrors.push(`[${tag}] ${e.message}`));
  page.on('download', (d) => d.cancel().catch(() => {}));
}

const st8 = (page) => page.evaluate(() => window.__flatline.state());

async function tap(page) {
  await page.evaluate(() => {
    const s = document.getElementById('stage');
    const o = { bubbles: true, cancelable: true, pointerId: 7, isPrimary: true };
    s.dispatchEvent(new PointerEvent('pointerdown', o));
    s.dispatchEvent(new PointerEvent('pointerup', o));
  });
}
const pDown = (page) => page.evaluate(() => {
  document.getElementById('stage').dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 9, isPrimary: true }));
});
const pUp = (page) => page.evaluate(() => {
  document.getElementById('stage').dispatchEvent(
    new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 9, isPrimary: true }));
});

// 轮询驱动一局：TAP 在目标前 ≤80ms 点击；HOLD 提示后按住、到点松手；WAIT 忍住。
async function driveGame(page, opts = {}) {
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline) {
    const s = await st8(page);
    if (s.screen === 'result') return s;
    if (opts.untilBeat && s.screen === 'game' && s.beatIndex >= opts.untilBeat && !s.inGap) return s;
    if (opts.onState) await opts.onState(s);
    if (s.screen === 'game' && s.cue && !s.locked) {
      const c = s.cue;
      if (c.type === 'TAP' && !c.pressed && c.pressInMs <= 80) await tap(page);
      else if (c.type === 'HOLD') {
        if (c.cueShown && !c.pressed && !c.released) await pDown(page);
        else if (c.pressed && !c.released && c.releaseInMs != null && c.releaseInMs <= 60) await pUp(page);
      }
    }
    await page.waitForTimeout(28);
  }
  throw new Error('driveGame 超时');
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

// ============================================================ 桌面 1280×800
console.log('\n[1] 桌面 1280×800 — 完整一局');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  watch(page, 'desktop');
  await page.goto(URL);
  await page.waitForTimeout(600);
  check('开始屏可见', await page.isVisible('#scrStart'));
  const boot = await st8(page);
  check('期号为正整数', Number.isInteger(boot.issue) && boot.issue > 0, 'issue=' + boot.issue);
  await page.screenshot({ path: path.join(SHOTS, 'desktop-start.png') });

  await page.mouse.click(640, 420); // 真实点击开始
  let midShot = false;
  const res = await driveGame(page, {
    onState: async (s) => {
      if (!midShot && s.screen === 'game' && s.beatIndex === 7 && !s.inGap) {
        midShot = true;
        await page.screenshot({ path: path.join(SHOTS, 'desktop-game.png') });
      }
    },
  });
  check('到达结算态', res.screen === 'result');
  check('14 拍全部计分', res.scores.length === 14, 'scores=' + JSON.stringify(res.scores));
  check('每拍恰好一个分数(0-100)', res.scores.every((x) => Number.isFinite(x) && x >= 0 && x <= 100));
  check('好局未触发 CODE BLUE', res.status !== 'CODEBLUE', 'status=' + res.status);
  await page.waitForTimeout(700); // 等盖章动画
  await page.screenshot({ path: path.join(SHOTS, 'desktop-result.png') });
  check('结算屏可见', await page.isVisible('#scrResult'));
  check('状态戳非空', (await page.textContent('#stamp')).trim().length > 0);

  // 分享文本
  const share = await page.evaluate(() => window.__flatline.shareText());
  console.log('  分享文本 >>>\n' + share.split('\n').map((l) => '    | ' + l).join('\n'));
  check('分享文本非空', share.length > 0);
  check('分享文本含期号', share.includes('Flatline #' + boot.issue));
  check('波形行恰 14 字符', [...share.split('\n')[1]].length === 14);
  check('分享文本含镇定指数', /镇定指数 \d+\/100/.test(share));
  await page.click('#copyBtn');
  await page.waitForTimeout(200);
  const copied = await page.evaluate(() => window.__flatline.lastCopied());
  check('复制动作产出与分享文本一致', copied === share);

  // PNG 导出
  const png = await page.evaluate(() => window.__flatline.exportPNG());
  check('PNG dataURL 有效', png.startsWith('data:image/png') && png.length > 20000, 'len=' + png.length);
  await page.click('#pngBtn'); // 真点一次存图按钮（download 事件被丢弃）
  await page.waitForTimeout(300);

  // ---------------- 快速连点不重复计分（练习模式）
  console.log('\n[2] 快速连点不重复计分');
  await page.click('#practiceBtn');
  let ready = null;
  for (let i = 0; i < 200; i++) {
    const s = await st8(page);
    if (s.screen === 'game' && s.cue && s.cue.type === 'TAP' && s.beatIndex === 1) { ready = s; break; }
    await page.waitForTimeout(30);
  }
  check('练习局第 1 拍为 TAP', !!ready);
  await page.evaluate(() => {
    const s = document.getElementById('stage');
    for (let i = 0; i < 12; i++) {
      const o = { bubbles: true, cancelable: true, pointerId: 40 + i, isPrimary: true };
      s.dispatchEvent(new PointerEvent('pointerdown', o));
      s.dispatchEvent(new PointerEvent('pointerup', o));
    }
  });
  let after = null;
  for (let i = 0; i < 300; i++) {
    const s = await st8(page);
    if (s.scores.length >= 1) { after = s; break; }
    await page.waitForTimeout(30);
  }
  check('12 连点只产生 1 个分数', after && after.scores.length === 1, after && JSON.stringify(after.scores));
  check('连点后游戏未崩溃', after && after.screen === 'game');

  // ---------------- localStorage 垃圾容错
  console.log('\n[3] localStorage 垃圾容错');
  for (const junk of ['{{{not json', '12345', '{"streak":"abc","history":5,"lastResult":[1]}']) {
    await page.evaluate((j) => localStorage.setItem('flatline.v1', j), junk);
    await page.reload();
    await page.waitForTimeout(400);
    const ok = await page.evaluate(() => {
      const s = window.__flatline.state();
      return s.screen === 'start' && !s.playedToday;
    });
    check('垃圾值重载不崩: ' + junk.slice(0, 18), ok);
  }

  // ---------------- reduced-motion
  console.log('\n[4] prefers-reduced-motion');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.waitForTimeout(400);
  check('reduced-motion 下加载正常', (await st8(page)).screen === 'start');
  check('reduced-motion 移除扫描线',
    await page.evaluate(() => getComputedStyle(document.querySelector('.scanlines')).display === 'none'));

  // ---------------- CODE BLUE 失败路径（全程摆烂：不按 + 点假提示）
  console.log('\n[5] CODE BLUE 失败路径');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  await page.waitForTimeout(400);
  await page.mouse.click(640, 420); // 存档已被垃圾测试清空，重新开今日局
  let waitTapped = -1;
  const worst = await (async () => {
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      const s = await st8(page);
      if (s.screen === 'result') return s;
      if (s.screen === 'game' && s.cue && s.cue.type === 'WAIT' && waitTapped !== s.beatIndex) {
        waitTapped = s.beatIndex;
        await tap(page); // 上当
      }
      await page.waitForTimeout(40);
    }
    throw new Error('CODE BLUE 局超时');
  })();
  check('摆烂局触发 CODE BLUE', worst.status === 'CODEBLUE', 'status=' + worst.status);
  check('第 3 拍即终止', worst.scores.length === 3, JSON.stringify(worst.scores));
  check('崩拍分数全部 <30', worst.scores.every((x) => x < 30));
  const blueShare = await page.evaluate(() => window.__flatline.shareText());
  console.log('  CODE BLUE 分享 >>>\n' + blueShare.split('\n').map((l) => '    | ' + l).join('\n'));
  check('分享文本含 CODE BLUE 与崩拍号', blueShare.includes('⚠ CODE BLUE · 第3拍'));
  check('波形行含崩拍尖峰 █', blueShare.split('\n')[1].includes('█'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, 'desktop-codeblue.png') });
  // 重载 → 开始屏应显示"今日已完成"
  await page.reload();
  await page.waitForTimeout(500);
  check('重载后显示今日已完成', await page.isVisible('#startDone'));
  check('已完成态戳含 CODE BLUE', (await page.textContent('#doneStamp')).includes('CODE BLUE'));
  await ctx.close();
}

// ============================================================ 移动 375×667
console.log('\n[6] 移动 375×667');
{
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true,
  });
  const page = await ctx.newPage();
  watch(page, 'mobile');
  await page.goto(URL);
  await page.waitForTimeout(600);
  check('移动端开始屏可见', await page.isVisible('#scrStart'));
  check('移动端无横向滚动', await page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: path.join(SHOTS, 'mobile-start.png') });
  await page.tap('#stage');
  const s3 = await driveGame(page, { untilBeat: 3 });
  check('移动端可玩到第 3 拍', s3.beatIndex >= 3);
  await page.screenshot({ path: path.join(SHOTS, 'mobile-game.png') });
  await ctx.close();
}

// ============================================================ 静态体检
console.log('\n[7] 静态体检');
{
  const bytes = ['index.html', 'style.css', 'app.js']
    .map((f) => fs.statSync(path.resolve(HERE, '..', f)).size)
    .reduce((a, b) => a + b, 0);
  check('单页总重 < 150KB', bytes < 150 * 1024, bytes + ' bytes');
  const html = fs.readFileSync(path.resolve(HERE, '..', 'index.html'), 'utf8');
  check('无外部 CDN/字体引用', !/(cdn\.|googleapis|fonts\.g|unpkg|jsdelivr)/.test(html));
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
console.log('SMOKE: ALL GREEN');
