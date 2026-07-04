/* 今日之律 — Playwright 冒烟测试
 * 运行（从仓库根 /home/user/claude-test）：node projects/the-law/test/smoke.mjs
 *
 * 覆盖：
 *  - file:// 打开，零 console error / pageerror
 *  - 脚本化：3+1 次实验 → 终审 8 题（按真实标签作答）→ 结案 CRACKED
 *  - 分享文本含期号；图卡 canvas 非空
 *  - 连点快速重复提交只计一次；首个提示行提交后消失
 *  - 刷新后结案态持久
 *  - 往期档案进出练习模式
 *  - localStorage 垃圾容错（独立上下文）
 *  - 375×667 无横向滚动、prefers-reduced-motion
 *  - 跨午夜换刊横幅
 *  - 双视口截图 → test/screenshots/
 */
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const INDEX = pathToFileURL(path.join(DIR, '..', 'index.html')).href;
const SHOTS = path.join(DIR, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ok - ' + msg); }
  else { fail++; console.error('  FAIL - ' + msg); }
}

const errors = [];
function watch(page, tag) {
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}`));
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/* ================= 桌面主流程 1280×800 ================= */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  watch(page, 'desktop');
  await page.goto(INDEX);
  await page.waitForSelector('#labSec:not([hidden])');

  const meta = await page.evaluate(() => {
    const T = window.__thelaw;
    return {
      issue: T.getSession().issue,
      labels: T.getExam().items.map(i => i.label),
      ruleText: T.getExam().rule.text,
      tier: T.getExam().rule.tier
    };
  });
  ok(meta.issue >= 1, `当期期号 = ${meta.issue}（法则：${meta.ruleText}，难度 ${meta.tier}）`);
  ok(await page.isVisible('#hint'), '首次实验前示例提示可见');

  /* 3 次不同实验 */
  const trials = [[2, 4, 6], [19, 3, 11], [8, 8, 8]];
  for (const t of trials) {
    await page.fill('#num0', String(t[0]));
    await page.fill('#num1', String(t[1]));
    await page.fill('#num2', String(t[2]));
    await page.click('#submitBtn');
    await page.waitForTimeout(300); /* 连点节流窗口 */
  }
  ok(await page.locator('#ledgerBody tr').count() === 3, '3 次实验入账');
  ok(await page.isHidden('#hint'), '示例提示在首次实验后消失');

  /* 连点快速重复提交：同一样本狂点 5 次只入账 1 条 */
  await page.fill('#num0', '1'); await page.fill('#num1', '1'); await page.fill('#num2', '1');
  for (let i = 0; i < 5; i++) await page.click('#submitBtn', { delay: 0 });
  await page.waitForTimeout(400);
  await page.click('#submitBtn'); /* 节流窗口外的重复提交，应被"已实验过"拦下 */
  ok(await page.locator('#ledgerBody tr').count() === 4, '连点/重复提交只计一次（共 4 条）');
  ok((await page.textContent('#benchNote')).includes('已实验过'), '重复提交有干燥提示');

  /* 终审 */
  await page.click('#finalBtn');
  await page.waitForSelector('#confirmBox:not([hidden])');
  await page.click('#confirmGo');
  await page.waitForSelector('#examSec:not([hidden])');
  for (let i = 0; i < 8; i++) {
    await page.waitForFunction(
      i => document.getElementById('qNum').textContent === String(i + 1) &&
           !document.getElementById('voteOk').disabled,
      i, { timeout: 5000 }
    );
    await page.click(meta.labels[i] ? '#voteOk' : '#voteNo');
  }
  await page.waitForSelector('#resultSec:not([hidden])', { timeout: 8000 });

  /* 结案断言 */
  ok((await page.textContent('#bigStamp')) === 'CRACKED', '判决大戳 CRACKED');
  ok((await page.textContent('#verdictSub')) === '完美破解', '8/8 完美破解');
  ok((await page.textContent('#lawReveal')) === meta.ruleText, '法则原文揭晓');
  const share = await page.textContent('#shareTextEl');
  ok(share.includes(`THE LAW #${meta.issue}`), `分享文本含期号 #${meta.issue}`);
  ok(share.includes('4 次实验 · 终审 8/8'), '分享文本含战绩 4 次实验 · 8/8');
  ok(!/\d+ · \d+/.test(share), '分享文本零剧透');
  const pngLen = await page.evaluate(() => document.getElementById('shareCanvas').toDataURL('image/png').length);
  ok(pngLen > 20000, `图卡 canvas 非空（dataURL ${pngLen} 字节）`);
  await page.click('#copyBtn');
  await page.waitForTimeout(200);
  ok((await page.textContent('#shareNote')).length > 0, '复制战报有反馈');
  const streak = await page.evaluate(() => window.__thelaw.getStore().streak);
  ok(streak === 1, `连胜更新为 1（实际 ${streak}）`);
  ok((await page.textContent('#countdown')).includes('距下一期'), '有明日回访钩子（倒计时）');

  await page.screenshot({ path: path.join(SHOTS, 'desktop-1280x800.png'), fullPage: true });

  /* 刷新后结案态持久 */
  await page.reload();
  await page.waitForSelector('#resultSec:not([hidden])');
  ok((await page.textContent('#shareTextEl')).includes(`THE LAW #${meta.issue}`), '刷新后结案态与分享文本持久');

  /* 往期档案 → 练习 → 返回 */
  await page.click('#archiveBtn');
  await page.waitForSelector('#archiveSec:not([hidden])');
  const archN = await page.locator('.archive-item').count();
  ok(archN === meta.issue - 1, `档案列出全部往期（${archN} 期）`);
  if (archN > 0) {
    await page.click('.archive-item >> nth=0');
    await page.waitForSelector('#practiceBar:not([hidden])');
    ok((await page.textContent('#practiceLabel')).includes('不计连胜'), '练习横幅可见且注明不计连胜');
    await page.fill('#num0', '3'); await page.fill('#num1', '9'); await page.fill('#num2', '15');
    await page.click('#submitBtn');
    await page.waitForTimeout(300);
    ok(await page.locator('#ledgerBody tr').count() === 1, '练习模式实验独立记账');
    await page.click('#exitPracticeBtn');
    await page.waitForSelector('#resultSec:not([hidden])');
    const streak2 = await page.evaluate(() => window.__thelaw.getStore().streak);
    ok(streak2 === 1, '练习不影响连胜');
  }
  await ctx.close();
}

/* ================= 移动端 375×667 + localStorage 垃圾 + reduced-motion ================= */
{
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 667 },
    reducedMotion: 'reduce'
  });
  const page = await ctx.newPage();
  watch(page, 'mobile');
  /* 载入前灌垃圾 */
  await page.addInitScript(() => {
    try {
      localStorage.setItem('thelaw.v1', '{{{此处不是JSON<<<');
    } catch (e) {}
  });
  await page.goto(INDEX);
  await page.waitForSelector('#labSec:not([hidden])');
  ok(true, 'localStorage 垃圾值下正常渲染');

  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  ok(scrollW <= 375, `375px 无横向滚动（scrollWidth=${scrollW}）`);

  /* 触控目标抽查 */
  const btnBox = await page.locator('#submitBtn').boundingBox();
  ok(btnBox.height >= 44, `提交按钮触控高度 ≥44px（${btnBox.height}）`);
  const stepBox = await page.locator('.step >> nth=0').boundingBox();
  ok(stepBox.height >= 44, `步进按钮触控高度 ≥44px（${stepBox.height}）`);

  /* 垃圾存储被回退默认值后仍可正常玩 */
  await page.click('.step[data-idx="0"][data-d="1"]');
  await page.click('#submitBtn');
  await page.waitForTimeout(300);
  ok(await page.locator('#ledgerBody tr').count() === 1, '垃圾存储回退后实验流程可用');

  await page.screenshot({ path: path.join(SHOTS, 'mobile-375x667.png'), fullPage: true });

  /* 跨午夜：把页面时钟拨快一天，触发换刊横幅 */
  await page.evaluate(() => {
    const Real = Date;
    const SHIFT = 86400000;
    // eslint-disable-next-line no-global-assign
    Date = class extends Real {
      constructor(...a) { if (a.length) { super(...a); } else { super(Real.now() + SHIFT); } }
      static now() { return Real.now() + SHIFT; }
    };
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForSelector('#newDayBar:not([hidden])', { timeout: 3000 });
  ok(true, '跨午夜后出现"新一期卷宗已送达"横幅');

  await ctx.close();
}

await browser.close();

/* ================= 汇总 ================= */
if (errors.length) {
  console.error('\nCONSOLE/PAGE ERRORS:');
  for (const e of errors) console.error('  ' + e);
}
ok(errors.length === 0, `零 console error / pageerror（收集到 ${errors.length} 条）`);

console.log(`\nsmoke.mjs: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
console.log('ALL SMOKE TESTS PASSED');
