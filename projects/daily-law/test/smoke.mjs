/* 每日一法 · Playwright 冒烟测试
 * 运行（从仓库根 /home/user/claude-test）：node projects/daily-law/test/smoke.mjs
 *
 * 覆盖：
 *  - file:// 打开，零 console error / pageerror
 *  - 七轨逐一切换渲染正确且互不相同
 *  - 昨日回看（仅一天）、回到今天
 *  - 收藏后刷新仍在；复制文本含出处与域名；分享卡 PNG 非空
 *  - 时钟注入：同轨跨天内容变化；跨午夜日期翻页
 *  - dateOverride 命中日优先生效（12-04 宪法 / 12-10 世界人权宣言）
 *  - localStorage 垃圾值容错；快速连点切轨不卡死
 *  - 375×667 无横向滚动、触控目标 ≥44px；prefers-reduced-motion
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

async function waitRendered(page) {
  await page.waitForFunction(() => {
    const t = document.querySelector('#lawText');
    return t && t.textContent.length > 0;
  });
}
async function waitSource(page, snippet) {
  await page.waitForFunction(
    s => document.querySelector('#sourceLine').textContent.includes(s), snippet, { timeout: 5000 }
  );
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/* ================= 桌面主流程 1280×800 ================= */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  watch(page, 'desktop');
  await page.goto(INDEX);
  await waitRendered(page);

  const today = new Date();
  const dateNum = await page.textContent('#dateNum');
  ok(dateNum === String(today.getDate()), `大日期 = 今日本地日期（${dateNum}）`);
  ok((await page.textContent('#weekday')).startsWith('星期'), '星期行渲染');

  /* --- 昨日回看（仅一天） --- */
  const todayText = await page.textContent('#lawText');
  const todaySource = await page.textContent('#sourceLine');
  const expYest = await page.evaluate(() => window.__dailylaw.getEntry('cn', -1));
  await page.click('#btnYesterday');
  await waitSource(page, expYest.source);
  ok(!(await page.isHidden('#dayTag')), '昨日标签可见');
  ok((await page.textContent('#btnYesterday')) === '回到今天', '昨日态按钮变为「回到今天」——只能回看一天');
  const yestText = await page.textContent('#lawText');
  ok(yestText !== todayText && yestText === expYest.text, '昨日内容 ≠ 今日内容，且与选条函数一致');
  const yest = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  ok((await page.textContent('#dateNum')) === String(yest.getDate()), '昨日大日期正确');
  await page.click('#btnYesterday');
  await page.waitForFunction(exp => {
    return document.querySelector('#sourceLine').textContent === exp &&
      document.querySelector('#btnYesterday').textContent === '看昨日';
  }, todaySource);
  ok((await page.textContent('#lawText')) === todayText, '回到今天内容复原');

  /* --- 收藏（当前中国轨今日条） --- */
  await page.click('#btnFav');
  await page.waitForFunction(() => document.querySelector('#btnFav').getAttribute('aria-pressed') === 'true');
  ok(true, '点击收藏后按钮进入已收藏态');

  /* --- 复制引用 --- */
  await page.click('#btnCopy');
  await page.waitForSelector('#toast.show');
  const copied = await page.evaluate(() => window.__dailylaw.lastCopiedText);
  const curSource = (await page.textContent('#sourceLine')).replace(/^——/, '').replace(/（.*$/, '');
  ok(copied && copied.includes(curSource), '复制文本含出处：' + curSource);
  ok(copied.includes('meiriyifa.app'), '复制文本含域名回流位');
  ok(copied.includes('「'), '复制文本含条文引号体');

  /* --- 分享卡 PNG --- */
  await page.click('#btnShare');
  await page.waitForSelector('#shareModal:not([hidden])');
  const card = await page.evaluate(() => window.__dailylaw.lastCardDataURL);
  ok(card && card.startsWith('data:image/png') && card.length > 10000, `分享卡 PNG 非空（${card ? card.length : 0} 字符）`);
  const dl = await page.getAttribute('#btnDownload', 'href');
  ok(dl && dl.startsWith('data:image/png'), '下载链接已挂载 PNG');
  await page.click('#btnCloseModal');
  ok(await page.isHidden('#shareModal'), '分享弹层关闭');

  /* --- 七轨逐一切换，互不相同 --- */
  const seen = [];
  for (const id of ['cn', 'us', 'uk', 'de', 'jp', 'fr', 'intl']) {
    const exp = await page.evaluate(t => window.__dailylaw.getEntry(t, 0), id);
    await page.click(`.tracks button[data-track="${id}"]`);
    await waitSource(page, exp.source);
    const text = await page.textContent('#lawText');
    const src = await page.textContent('#sourceLine');
    ok(text === exp.text, `轨【${id}】渲染与选条一致（${exp.source}）`);
    if (id !== 'cn') {
      const origin = await page.textContent('#originLine');
      ok(origin.startsWith('原文：') && origin.length > 6, `轨【${id}】注明原语言与原文名`);
    } else {
      ok(await page.isHidden('#originLine'), '中国轨不显示原文行');
    }
    seen.push(text + '||' + src);
  }
  ok(new Set(seen).size === 7, '同一天七轨内容互不相同');

  /* --- 快速连点切轨不卡死 --- */
  for (const id of ['cn', 'us', 'uk', 'de']) {
    await page.click(`.tracks button[data-track="${id}"]`, { delay: 10 });
  }
  const expDe = await page.evaluate(() => window.__dailylaw.getEntry('de', 0));
  await waitSource(page, expDe.source);
  ok((await page.textContent('#lawText')) === expDe.text, '快速连点后最终轨渲染正确');

  /* --- 刷新：收藏仍在 --- */
  await page.reload();
  await waitRendered(page);
  ok((await page.getAttribute('#btnFav', 'aria-pressed')) === 'true', '刷新后默认轨（中国）收藏态保持');
  await page.click('#btnFavsPanel');
  await page.waitForSelector('#favsPanel:not([hidden])');
  const favSrc = await page.textContent('#favsList');
  ok(favSrc.includes(curSource.slice(0, 8)), '收藏夹面板列出已收藏条目');

  await page.screenshot({ path: path.join(SHOTS, 'desktop.png'), fullPage: true });
  await ctx.close();
}

/* ================= 时钟注入：同轨跨天内容变化 ================= */
{
  const texts = {};
  for (const [tag, ts] of [
    ['d1', new Date(2026, 0, 20, 12).getTime()],
    ['d2', new Date(2026, 0, 21, 12).getTime()]
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    watch(page, 'clock-' + tag);
    await page.addInitScript(t => { window.__FAKE_NOW__ = t; }, ts);
    await page.goto(INDEX);
    await waitRendered(page);
    texts[tag] = {
      cn: await page.textContent('#lawText'),
      date: await page.textContent('#dateNum'),
      de: await page.evaluate(() => window.__dailylaw.getEntry('de', 0).text)
    };
    await ctx.close();
  }
  ok(texts.d1.date === '20' && texts.d2.date === '21', '注入时钟后日期随天翻页（20 → 21）');
  ok(texts.d1.cn !== texts.d2.cn, '同轨（中国）跨天内容变化');
  ok(texts.d1.de !== texts.d2.de, '同轨（德国）跨天内容变化');
}

/* ================= 跨午夜边界 ================= */
{
  const res = {};
  for (const [tag, ts] of [
    ['before', new Date(2026, 2, 9, 23, 59).getTime()],
    ['after', new Date(2026, 2, 10, 0, 1).getTime()]
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    watch(page, 'midnight-' + tag);
    await page.addInitScript(t => { window.__FAKE_NOW__ = t; }, ts);
    await page.goto(INDEX);
    await waitRendered(page);
    res[tag] = { date: await page.textContent('#dateNum'), text: await page.textContent('#lawText') };
    await ctx.close();
  }
  ok(res.before.date === '9' && res.after.date === '10', '本地午夜前后正确换天（23:59 → 00:01）');
  ok(res.before.text !== res.after.text, '午夜前后同轨内容随之更换');
}

/* ================= dateOverride 命中日优先生效 ================= */
{
  /* 12-04 国家宪法日 → 中国轨固定为宪法第三十三条 */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  watch(page, 'override-cn');
  await page.addInitScript(t => { window.__FAKE_NOW__ = t; }, new Date(2026, 11, 4, 12).getTime());
  await page.goto(INDEX);
  await waitRendered(page);
  const src = await page.textContent('#sourceLine');
  ok(src.includes('宪法') && src.includes('第三十三条'), `12-04 中国轨命中宪法日覆盖条目（${src.trim()}）`);
  await ctx.close();
}
{
  /* 12-10 世界人权日 → 国际条约轨固定为《世界人权宣言》第一条 */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  watch(page, 'override-intl');
  await page.addInitScript(t => { window.__FAKE_NOW__ = t; }, new Date(2026, 11, 10, 12).getTime());
  await page.goto(INDEX);
  await waitRendered(page);
  const exp = await page.evaluate(() => window.__dailylaw.getEntry('intl', 0));
  ok(exp.source.includes('世界人权宣言'), '12-10 国际轨选条命中《世界人权宣言》');
  await page.click('.tracks button[data-track="intl"]');
  await waitSource(page, '世界人权宣言');
  ok((await page.textContent('#lawText')).includes('人人生而自由'), '12-10 国际轨渲染人权宣言第一条');
  await ctx.close();
}

/* ================= localStorage 垃圾值容错 ================= */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  watch(page, 'garbage');
  await page.addInitScript(() => {
    try { localStorage.setItem('dailylaw.v1', '{"v":9,oops###'); } catch (e) {}
  });
  await page.goto(INDEX);
  await waitRendered(page);
  ok((await page.getAttribute('#btnFav', 'aria-pressed')) === 'false', '垃圾 localStorage 回退为空收藏，页面正常');
  await page.click('#btnFav');
  await page.waitForFunction(() => document.querySelector('#btnFav').getAttribute('aria-pressed') === 'true');
  ok(true, '垃圾数据被覆盖后收藏功能恢复可用');
  await ctx.close();
}

/* ================= 移动端 375×667 ================= */
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true });
  const page = await ctx.newPage();
  watch(page, 'mobile');
  await page.goto(INDEX);
  await waitRendered(page);
  const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  ok(noHScroll, '375px 无横向滚动');
  const tabBox = await page.locator('.tracks button[data-track="intl"]').boundingBox();
  ok(tabBox && tabBox.height >= 44, `轨道按钮触控高度 ≥44px（${tabBox ? Math.round(tabBox.height) : 0}px）`);
  const favBox = await page.locator('#btnFav').boundingBox();
  ok(favBox && favBox.height >= 44, `操作按钮触控高度 ≥44px（${favBox ? Math.round(favBox.height) : 0}px）`);
  const dateSize = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#dateNum')).fontSize));
  ok(dateSize >= 100, `日期数字 ≥100px（${dateSize}px）`);
  await page.screenshot({ path: path.join(SHOTS, 'mobile.png'), fullPage: true });
  await ctx.close();
}

/* ================= prefers-reduced-motion ================= */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  watch(page, 'reduced');
  await page.goto(INDEX);
  await waitRendered(page);
  const exp = await page.evaluate(() => window.__dailylaw.getEntry('jp', 0));
  await page.click('.tracks button[data-track="jp"]');
  await waitSource(page, exp.source);
  ok((await page.textContent('#lawText')) === exp.text, 'reduced-motion 下切轨正常（降级淡入淡出）');
  await ctx.close();
}

await browser.close();

/* ================= 汇总 ================= */
if (errors.length) {
  console.error('\nconsole/page 错误：');
  for (const e of errors) console.error('  ' + e);
}
ok(errors.length === 0, `零 console error / pageerror（${errors.length} 条）`);

console.log(`\nsmoke.mjs：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
