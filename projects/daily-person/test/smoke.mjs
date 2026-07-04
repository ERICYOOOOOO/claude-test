/* 每日一人 · Playwright 冒烟测试。从仓库根运行：
 *   node projects/daily-person/test/smoke.mjs */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHOTS = path.join(ROOT, "test", "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const URL = "file://" + path.join(ROOT, "index.html");

let failures = 0;
function ok(cond, msg) {
  if (cond) { console.log("  ok:", msg); return; }
  failures++;
  console.error("  FAIL:", msg);
}

function track(page, errors) {
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
}

// 时钟注入：固定 Date.now 与无参 new Date()
async function freezeClock(ctx, iso) {
  const fixed = new Date(iso).getTime();
  await ctx.addInitScript((f) => {
    const _Date = Date;
    class FakeDate extends _Date {
      constructor(...args) { args.length ? super(...args) : super(f); }
      static now() { return f; }
    }
    FakeDate.UTC = _Date.UTC;
    FakeDate.parse = _Date.parse;
    // eslint-disable-next-line no-global-assign
    window.Date = FakeDate;
  }, fixed);
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

/* ---------- 第 1 天（桌面）：核心循环 ---------- */
let day1PersonId = null;
{
  console.log("第 1 天 2026-07-10（桌面 1280×800）：问答→模糊猜名→揭晓→分享");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await freezeClock(ctx, "2026-07-10T12:00:00Z");
  const page = await ctx.newPage();
  const errors = [];
  track(page, errors);
  await page.goto(URL);
  await page.waitForTimeout(250);

  ok((await page.title()).includes("每日一人"), "标题正确");
  const issueText = await page.locator("#issue-no").innerText();
  ok(issueText.includes("第 7 期"), `期号按每日种子计算（${issueText}）`);
  day1PersonId = await page.evaluate(() => window.__dp.person().id);
  ok(typeof day1PersonId === "string" && day1PersonId.length > 0, `今日人物已确定（${day1PersonId}）`);

  // 问 3 题：渲染的是/否必须与人物属性一致
  for (const qid of ["t1", "t2", "t3"]) {
    const expected = await page.evaluate((id) => {
      const q = window.DP_QUESTIONS.find((x) => x.id === id);
      return q.ans(window.__dp.person());
    }, qid);
    await page.click(`[data-qid="${qid}"]`);
    await page.waitForTimeout(80);
    const last = await page.locator("#log li .log-ans").last().innerText();
    ok(last === (expected ? "是" : "否"), `问题 ${qid} 渲染答案「${last}」与属性一致`);
  }
  ok((await page.locator("#q-count").innerText()).includes("已问 3 题"), "问数计数为 3");
  await page.screenshot({ path: path.join(SHOTS, "desktop-game.png") });

  // 连点保护：对已问问题再触发 click 不重复计数
  await page.evaluate(() => {
    const b = document.querySelector('[data-qid="t1"]');
    b.click(); b.click();
  });
  await page.waitForTimeout(80);
  ok((await page.locator("#q-count").innerText()).includes("已问 3 题"), "重复点击同一问题不重复计数");

  // 猜一个错误人物：计数 +1 且提示「不是」
  const wrongName = await page.evaluate(() => {
    const me = window.__dp.person().id;
    return window.DP_PEOPLE.find((p) => p.id !== me).name;
  });
  await page.fill("#guess-input", wrongName);
  await page.click("#btn-guess");
  await page.waitForTimeout(80);
  ok((await page.locator("#guess-feedback").innerText()).includes("不是"), "猜错提示「不是 TA」");
  ok((await page.locator("#q-count").innerText()).includes("已问 4 题"), "猜错也计一次");

  // 模糊猜名：取最长拉丁别名，替换中间一个字母（编辑距离 1）
  const typo = await page.evaluate(() => {
    const p = window.__dp.person();
    const latin = [p.name, ...p.aliases]
      .filter((a) => /^[\x00-\x7f]+$/.test(a.replace(/[·・\s]/g, "")))
      .sort((a, b) => b.length - a.length)[0];
    const i = Math.floor(latin.length / 2);
    const repl = latin[i] === "x" ? "q" : "x";
    return latin.slice(0, i) + repl + latin.slice(i + 1);
  });
  ok(typeof typo === "string" && typo.length >= 4, `构造了带一处笔误的名字（${typo}）`);
  await page.fill("#guess-input", typo);
  await page.click("#btn-guess");
  await page.waitForTimeout(900); // 落章 + 翻页
  ok(await page.evaluate(() => window.__dp.session.rec.win === true), "打错一个字母仍被编辑距离匹配命中");

  // 揭晓页：辞条完整
  ok(await page.locator("#view-reveal").isVisible(), "猜中后进入辞条页");
  const bio = await page.locator("#entry-bio").innerText();
  ok(bio.length >= 140, `辞条含小传（${bio.length} 字）`);
  ok((await page.locator("#entry-years").innerText()).includes("–"), "生卒年使用 en-dash");
  ok((await page.locator("#crest-char").innerText()).length > 0, "首字纹章渲染");
  ok((await page.locator("#entry-epitaph").innerText()).length > 0, "墓志铭一句渲染");

  // 分享文本：期号 + 轨迹 + 零剧透
  const share = await page.evaluate(() => window.__dp.shareText());
  ok(share.includes("#7"), "分享文本含期号");
  ok(share.includes("🎯"), "分享文本含猜中标记");
  ok(/🟦|🟥/.test(share), "分享文本含问题轨迹");
  const personName = await page.evaluate(() => window.__dp.person().name);
  ok(!share.includes(personName), "分享文本不含人名（零剧透）");
  await page.click("#btn-copy");
  await page.waitForTimeout(150);
  ok((await page.locator("#share-feedback").innerText()).length > 0, "复制按钮给出反馈");

  // 分享图 canvas 非空
  const pngLen = await page.evaluate(() => window.__dp.drawShareCard().toDataURL("image/png").length);
  ok(pngLen > 20000, `分享图 canvas 有内容（dataURL ${pngLen} 字符）`);

  // 连胜写入 localStorage
  ok(await page.evaluate(() => window.__dp.state.streak === 1), "首胜连胜为 1");

  // 档案：可进入并开练习局
  await page.click("#btn-to-archive");
  await page.waitForTimeout(120);
  const archCount = await page.locator("#archive-list li").count();
  ok(archCount === 6, `第 7 期时档案有 6 期（实际 ${archCount}）`);
  await page.locator("#archive-list li button").first().click();
  await page.waitForTimeout(120);
  ok(await page.locator("#practice-banner").isVisible(), "练习局显示不计连胜横幅");
  const practicePerson = await page.evaluate(() => window.__dp.person().id);
  ok(practicePerson !== day1PersonId, "练习局人物与今日不同");

  ok(errors.length === 0, `第 1 天零 console error${errors[0] ? "（" + errors[0] + "）" : ""}`);
  await ctx.close();
}

/* ---------- 第 2 天：期号与人物必须变化；放弃路径 ---------- */
{
  console.log("第 2 天 2026-07-11：跨日换人 + 放弃路径");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await freezeClock(ctx, "2026-07-11T12:00:00Z");
  const page = await ctx.newPage();
  const errors = [];
  track(page, errors);
  await page.goto(URL);
  await page.waitForTimeout(250);

  ok((await page.locator("#issue-no").innerText()).includes("第 8 期"), "次日期号 +1");
  const day2PersonId = await page.evaluate(() => window.__dp.person().id);
  ok(day2PersonId !== day1PersonId, `次日人物不同（${day1PersonId} → ${day2PersonId}）`);

  // 问满「时代」8 题后出现放弃入口
  for (const qid of ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"]) {
    await page.click(`[data-qid="${qid}"]`);
    await page.waitForTimeout(30);
  }
  ok(await page.locator("#btn-surrender").isVisible(), "问满 8 题后可翻答案页");
  await page.click("#btn-surrender");
  await page.waitForTimeout(200);
  ok(await page.locator("#view-reveal").isVisible(), "放弃后进入辞条页");
  ok((await page.locator("#result-line").innerText()).includes("未破解"), "放弃标记为未破解");
  ok(await page.evaluate(() => window.__dp.state.streak === 0), "放弃后连胜清零");
  const share = await page.evaluate(() => window.__dp.shareText());
  ok(share.includes("#8") && !share.includes("🎯"), "放弃的分享文本无 🎯");
  ok(errors.length === 0, `第 2 天零 console error${errors[0] ? "（" + errors[0] + "）" : ""}`);
  await ctx.close();
}

/* ---------- localStorage 垃圾容错 ---------- */
{
  console.log("localStorage 垃圾容错");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await freezeClock(ctx, "2026-07-10T12:00:00Z");
  await ctx.addInitScript(() => {
    try { localStorage.setItem("dailyperson.v1", "{{{垃圾数据%%%"); } catch (e) {}
  });
  const page = await ctx.newPage();
  const errors = [];
  track(page, errors);
  await page.goto(URL);
  await page.waitForTimeout(250);
  ok(await page.locator("#view-game").isVisible(), "损坏存档仍可开局");
  await page.click('[data-qid="t1"]');
  await page.waitForTimeout(80);
  ok((await page.locator("#q-count").innerText()).includes("已问 1 题"), "损坏存档被回退为默认值后可正常游戏");
  ok(errors.length === 0, `垃圾存档零 console error${errors[0] ? "（" + errors[0] + "）" : ""}`);
  await ctx.close();
}

/* ---------- 移动端 375×667 + prefers-reduced-motion ---------- */
{
  console.log("移动端 375×667（reduced-motion）");
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 667 },
    reducedMotion: "reduce"
  });
  await freezeClock(ctx, "2026-07-10T12:00:00Z");
  const page = await ctx.newPage();
  const errors = [];
  track(page, errors);
  await page.goto(URL);
  await page.waitForTimeout(250);
  ok(await page.locator("#view-game").isVisible(), "375px 可用");
  const noHScroll = await page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth + 1);
  ok(noHScroll, "无横向滚动");
  await page.click('[data-qid="t1"]');
  await page.waitForTimeout(120);
  ok((await page.locator("#q-count").innerText()).includes("已问 1 题"), "移动端可问答");
  // 触控目标 ≥ 44px
  const minH = await page.evaluate(() => {
    const els = document.querySelectorAll(".q-item, #btn-guess, .cat-tab");
    let m = 999;
    els.forEach((e) => { const r = e.getBoundingClientRect(); if (r.height < m) m = r.height; });
    return m;
  });
  ok(minH >= 43.5, `触控目标高度 >= 44px（最小 ${Math.round(minH)}px）`);
  await page.screenshot({ path: path.join(SHOTS, "mobile-game.png") });
  ok(errors.length === 0, `移动端零 console error${errors[0] ? "（" + errors[0] + "）" : ""}`);
  await ctx.close();
}

/* ---------- 揭晓页截图（桌面） ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await freezeClock(ctx, "2026-07-10T12:00:00Z");
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForTimeout(250);
  const name = await page.evaluate(() => window.__dp.person().name);
  await page.fill("#guess-input", name);
  await page.click("#btn-guess");
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(SHOTS, "desktop-reveal.png"), fullPage: true });
  console.log("  ok: 揭晓页截图已存");
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\n冒烟测试全部通过 ✔" : `\n${failures} 项失败 ✘`);
process.exit(failures === 0 ? 0 : 1);
