/* 每日一人 · QA 对抗性验收测试（独立于 smoke.mjs，可重复运行）
 * 运行：node projects/daily-person/test/qa-extra.mjs
 * 覆盖：
 *  1. 公平性：全库 46 问答案向量两两不同（任何一期都可被纯逻辑锁定）；
 *     随机抽 10 期，脚本按"最优二分"扮演玩家，断言问完后候选集唯一且即为答案。
 *  2. 排期：复刻 app.js 的固定种子洗牌，断言 111 天一轮内人物不重复；
 *     浏览器时钟注入 5 天，期号逐日 +1、人物互异、与排期模型一致、同日两次加载稳定。
 *  3. 猜名边界：空/空白/超长/全角字母/全角空格/大小写/繁体（别名与编辑距离）/只输姓氏。
 *  4. 练习模式不碰连胜与纪录；分享文本不泄露人名与任何别名。
 *  5. 页面开着跨午夜：偏移时钟真实走表，断言换期墨条弹出。
 *  6. 全程零 console error；顺手输出美学目检截图（test/screenshots/qa-*.png）。
 */
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

/* ================= 第一部分：纯逻辑（node） ================= */

(0, eval)(fs.readFileSync(path.join(ROOT, "people.js"), "utf8"));
(0, eval)(fs.readFileSync(path.join(ROOT, "questions.js"), "utf8"));
const PEOPLE = globalThis.DP_PEOPLE;
const QUESTIONS = globalThis.DP_QUESTIONS;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 与 app.js 完全一致的排期（种子 1129）
const PERM = (() => {
  const idx = PEOPLE.map((_, i) => i);
  const rnd = mulberry32(1129);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
  }
  return idx;
})();
const personForIssue = (issue) =>
  PEOPLE[PERM[(((issue - 1) % PEOPLE.length) + PEOPLE.length) % PEOPLE.length]];

console.log("公平性：答案向量唯一 + 最优二分玩家");
{
  const vec = (p) => QUESTIONS.map((q) => (q.ans(p) ? 1 : 0)).join("");
  const seen = new Map();
  let coll = 0;
  for (const p of PEOPLE) {
    const v = vec(p);
    if (seen.has(v)) { coll++; console.error(`  FAIL: 属性同构 ${seen.get(v)} <-> ${p.id}`); failures++; }
    seen.set(v, p.id);
  }
  ok(coll === 0, `全库 ${PEOPLE.length} 人的 46 问答案向量两两不同（每期必然可锁定）`);

  // 最优二分玩家：每步选把当前候选集分得最均匀的问题
  const rnd = mulberry32(20260704);
  const issues = new Set();
  while (issues.size < 10) issues.add(1 + Math.floor(rnd() * PEOPLE.length));
  const costs = [];
  for (const issue of issues) {
    const target = personForIssue(issue);
    let cand = PEOPLE.slice();
    const asked = new Set();
    let steps = 0;
    while (cand.length > 1 && asked.size < QUESTIONS.length) {
      let best = null, bestScore = Infinity;
      for (const q of QUESTIONS) {
        if (asked.has(q.id)) continue;
        const yes = cand.filter((p) => q.ans(p)).length;
        const score = Math.abs(2 * yes - cand.length);
        if (score < bestScore) { bestScore = score; best = q; }
      }
      asked.add(best.id);
      const a = best.ans(target);
      cand = cand.filter((p) => best.ans(p) === a);
      steps++;
    }
    costs.push(steps);
    ok(cand.length === 1 && cand[0].id === target.id,
      `第 ${issue} 期（${target.id}）二分 ${steps} 问后候选唯一且命中`);
  }
  console.log(`  info: 二分问数 min ${Math.min(...costs)} / max ${Math.max(...costs)}（理论 log2(111)≈6.8）`);
}

console.log("排期：111 天一轮内不重复");
{
  ok(new Set(PERM).size === PEOPLE.length, "洗牌序列是 0..110 的排列");
  const ids = new Set();
  for (let issue = 1; issue <= PEOPLE.length; issue++) ids.add(personForIssue(issue).id);
  ok(ids.size === PEOPLE.length, `第 1–${PEOPLE.length} 期人物 ${ids.size} 位互不重复`);
}

/* ================= 第二部分：浏览器 ================= */

function track(page, errors) {
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
}
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
    window.Date = FakeDate;
  }, fixed);
}
// 偏移时钟：从 iso 起真实走表（用于跨午夜）
async function shiftClock(ctx, iso) {
  const base = new Date(iso).getTime();
  await ctx.addInitScript((b) => {
    const _Date = Date;
    const start = _Date.now();
    class ShiftDate extends _Date {
      constructor(...args) { args.length ? super(...args) : super(b + (_Date.now() - start)); }
      static now() { return b + (_Date.now() - start); }
    }
    ShiftDate.UTC = _Date.UTC;
    ShiftDate.parse = _Date.parse;
    window.Date = ShiftDate;
  }, base);
}
const qCount = async (page) => {
  const m = (await page.locator("#q-count").innerText()).match(/(\d+)/);
  return m ? Number(m[1]) : NaN;
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

/* ---------- 时钟注入 5 天：期号/人物互异，与排期模型一致 ---------- */
{
  console.log("时钟注入 5 天（2026-07-14 → 07-18）");
  const seen = [];
  for (let d = 0; d < 5; d++) {
    const iso = `2026-07-${14 + d}T09:00:00Z`;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await freezeClock(ctx, iso);
    const page = await ctx.newPage();
    const errors = [];
    track(page, errors);
    await page.goto(URL);
    await page.waitForTimeout(200);
    const issue = Number((await page.locator("#issue-no").innerText()).match(/\d+/)[0]);
    const pid = await page.evaluate(() => window.__dp.person().id);
    ok(issue === 11 + d, `${iso.slice(0, 10)} 期号为 ${11 + d}（实际 ${issue}）`);
    ok(pid === personForIssue(11 + d).id, `第 ${issue} 期人物与排期模型一致（${pid}）`);
    seen.push(pid);

    // 分享文本零剧透：当期人名与全部别名都不得出现
    await page.evaluate(() => {
      const p = window.__dp.person();
      document.querySelector("#guess-input").value = p.name;
      document.querySelector("#guess-form").dispatchEvent(new Event("submit", { cancelable: true }));
    });
    await page.waitForTimeout(900);
    const share = await page.evaluate(() => window.__dp.shareText());
    const leak = await page.evaluate(() => {
      const p = window.__dp.person();
      const s = window.__dp.shareText();
      return [p.name, ...p.aliases].filter((n) => s.includes(n));
    });
    ok(share.includes("#" + issue) && leak.length === 0,
      `第 ${issue} 期分享文本含期号、不含人名与别名${leak.length ? "（泄露：" + leak.join("/") + "）" : ""}`);
    ok(errors.length === 0, `${iso.slice(0, 10)} 零 console error${errors[0] ? "（" + errors[0] + "）" : ""}`);
    await ctx.close();
  }
  ok(new Set(seen).size === 5, `5 天人物互异（${seen.join(" → ")}）`);

  // 同日稳定：同一天两次加载同期同人
  const ctxA = await browser.newContext(); await freezeClock(ctxA, "2026-07-16T02:00:00Z");
  const ctxB = await browser.newContext(); await freezeClock(ctxB, "2026-07-16T21:30:00Z");
  const pa = await ctxA.newPage(); await pa.goto(URL); await pa.waitForTimeout(150);
  const pb = await ctxB.newPage(); await pb.goto(URL); await pb.waitForTimeout(150);
  const a = await pa.evaluate(() => [window.__dp.issue(), window.__dp.person().id]);
  const b = await pb.evaluate(() => [window.__dp.issue(), window.__dp.person().id]);
  ok(a[0] === b[0] && a[1] === b[1], `同日（清晨/深夜）两次加载同期同人（第 ${a[0]} 期 ${a[1]}）`);
  await ctxA.close(); await ctxB.close();
}

/* ---------- 猜名边界 + 练习模式隔离 ---------- */
{
  console.log("猜名边界（2026-07-10，当期人物 kafka）");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await freezeClock(ctx, "2026-07-10T12:00:00Z");
  const page = await ctx.newPage();
  const errors = [];
  track(page, errors);
  await page.goto(URL);
  await page.waitForTimeout(200);
  ok((await page.evaluate(() => window.__dp.person().id)) === "kafka", "基准日人物为 kafka（供确定性断言）");

  // 空输入 / 纯空白：不计次不崩
  await page.click("#btn-guess");
  await page.fill("#guess-input", "   ");
  await page.click("#btn-guess");
  ok((await qCount(page)) === 0, "空输入与纯空白不计次");

  // 超长输入：不崩、查无此人、不计次
  await page.fill("#guess-input", "李".repeat(5000));
  await page.click("#btn-guess");
  await page.waitForTimeout(100);
  ok((await page.locator("#guess-feedback").innerText()).includes("查无此人"), "5000 字输入被拒绝且有反馈");
  ok((await qCount(page)) === 0, "超长输入不计次");

  // 全角拉丁字母：查无此人、不计次（不做全角折叠是已知实现边界）
  await page.fill("#guess-input", "ｌｉｂａｉ");
  await page.click("#btn-guess");
  await page.waitForTimeout(80);
  ok((await page.locator("#guess-feedback").innerText()).includes("查无此人"), "全角字母输入不崩、给查无此人");
  ok((await qCount(page)) === 0, "全角字母不误报、不计次");

  // 英文名大小写 + 半角空格：命中李白、计一次
  await page.fill("#guess-input", "LI BAI");
  await page.click("#btn-guess");
  await page.waitForTimeout(80);
  ok((await page.locator("#guess-feedback").innerText()).includes("不是 李白"), "「LI BAI」大小写不敏感命中李白");
  ok((await qCount(page)) === 1, "猜错计一次");

  // 全角空格分隔的中文名：命中、计一次
  await page.fill("#guess-input", "李　白");
  await page.click("#btn-guess");
  await page.waitForTimeout(80);
  ok((await page.locator("#guess-feedback").innerText()).includes("不是 李白"), "全角空格「李　白」仍命中李白");

  // 繁体：别名直接命中（鄧麗君），编辑距离兜底（孫中山）
  await page.fill("#guess-input", "鄧麗君");
  await page.click("#btn-guess");
  await page.waitForTimeout(80);
  ok((await page.locator("#guess-feedback").innerText()).includes("不是 邓丽君"), "繁体「鄧麗君」经别名命中邓丽君");
  await page.fill("#guess-input", "孫中山");
  await page.click("#btn-guess");
  await page.waitForTimeout(80);
  ok((await page.locator("#guess-feedback").innerText()).includes("不是 孙中山"), "繁体「孫中山」经编辑距离命中孙中山");
  ok((await qCount(page)) === 4, "四次有效猜错累计 4 次");

  // 只输姓氏：给消歧候选（下拉），提交则查无此人、不计次
  await page.fill("#guess-input", "李");
  await page.waitForTimeout(80);
  const suggCount = await page.locator("#suggestions li").count();
  ok(suggCount >= 2, `单姓「李」给出 ${suggCount} 个消歧候选`);
  await page.click("#btn-guess");
  await page.waitForTimeout(80);
  ok((await page.locator("#guess-feedback").innerText()).includes("查无此人"), "单字提交不猜测、提示查无此人");
  ok((await qCount(page)) === 4, "单字提交不计次");

  // 带点别名 + 正确答案收尾（记 5 次，best=5）
  await page.fill("#guess-input", "franz kafka");
  await page.click("#btn-guess");
  await page.waitForTimeout(900);
  ok(await page.evaluate(() => window.__dp.session.rec.win === true), "「franz kafka」小写别名猜中");
  ok(await page.evaluate(() => window.__dp.state.streak === 1 && window.__dp.state.best === 5),
    "今日正赛胜利：连胜 1、最佳 5 问");

  console.log("练习模式不碰连胜/纪录");
  await page.click("#btn-to-archive");
  await page.waitForTimeout(150);
  await page.locator("#archive-list li button").first().click();
  await page.waitForTimeout(150);
  ok(await page.locator("#practice-banner").isVisible(), "练习横幅可见");
  await page.locator(".q-item").first().click();
  await page.waitForTimeout(80);
  await page.evaluate(() => {
    const p = window.__dp.person();
    document.querySelector("#guess-input").value = p.name;
    document.querySelector("#guess-form").dispatchEvent(new Event("submit", { cancelable: true }));
  });
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => ({
    streak: window.__dp.state.streak, wins: window.__dp.state.wins,
    best: window.__dp.state.best, practice: window.__dp.state.practice,
    practiceWin: window.__dp.session.rec.win, issue: window.__dp.issue()
  }));
  ok(st.practiceWin === true && st.practice[String(st.issue)] && st.practice[String(st.issue)].win === true,
    `练习第 ${st.issue} 期 2 问获胜并单独记录`);
  ok(st.streak === 1 && st.wins === 1 && st.best === 5,
    `练习胜利（2 问）不改连胜（${st.streak}）、总胜场（${st.wins}）与最佳纪录（${st.best}）`);
  const pLeak = await page.evaluate(() => {
    const p = window.__dp.person();
    const s = window.__dp.shareText();
    return [p.name, ...p.aliases].filter((n) => s.includes(n));
  });
  ok(pLeak.length === 0, "练习局分享文本同样零剧透");
  ok(errors.length === 0, `边界用例零 console error${errors[0] ? "（" + errors[0] + "）" : ""}`);
  await ctx.close();
}

/* ---------- 页面开着跨午夜：偏移时钟真实走表 ---------- */
{
  console.log("跨午夜墨条（约 50s 真实等待）");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await shiftClock(ctx, "2026-07-10T23:59:45Z");
  const page = await ctx.newPage();
  const errors = [];
  track(page, errors);
  await page.goto(URL);
  await page.waitForTimeout(300);
  const issueBefore = await page.evaluate(() => window.__dp.issue());
  await page.waitForTimeout(50000); // 15s 后过午夜，30s 轮询一次
  ok(await page.locator("#day-rollover").isVisible(), "跨午夜后弹出「新的一期已经开始」墨条");
  ok((await page.evaluate(() => window.__dp.issue())) === issueBefore, "旧局未被偷换，需玩家主动翻页");
  ok(errors.length === 0, `跨午夜零 console error${errors[0] ? "（" + errors[0] + "）" : ""}`);
  await ctx.close();
}

/* ---------- 美学目检截图 ---------- */
{
  console.log("美学目检截图");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await freezeClock(ctx, "2026-07-10T12:00:00Z");
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(SHOTS, "qa-01-first-screen.png") });

  await page.click('[data-qid="t1"]');
  await page.screenshot({ path: path.join(SHOTS, "qa-02-stamp.png") }); // 落章瞬间
  await page.locator(".cat-tab", { hasText: "地域" }).click();
  await page.click('[data-qid="g3"]');
  await page.waitForTimeout(800);
  await page.locator(".cat-tab", { hasText: "领域" }).click();
  await page.click('[data-qid="f3"]');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, "qa-03-midgame.png") });

  await page.evaluate(() => {
    const p = window.__dp.person();
    document.querySelector("#guess-input").value = p.name;
    document.querySelector("#guess-form").dispatchEvent(new Event("submit", { cancelable: true }));
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(SHOTS, "qa-04-reveal.png"), fullPage: true });

  const dataUrl = await page.evaluate(() => window.__dp.drawShareCard().toDataURL("image/png"));
  fs.writeFileSync(path.join(SHOTS, "qa-05-share-card.png"), Buffer.from(dataUrl.split(",")[1], "base64"));

  await page.click("#btn-to-archive");
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOTS, "qa-06-archive.png") });
  await ctx.close();

  const mctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
  await freezeClock(mctx, "2026-07-10T12:00:00Z");
  const mp = await mctx.newPage();
  await mp.goto(URL);
  await mp.waitForTimeout(250);
  await mp.click('[data-qid="t1"]');
  await mp.waitForTimeout(800);
  await mp.screenshot({ path: path.join(SHOTS, "qa-07-mobile-game.png") });
  await mp.evaluate(() => {
    const p = window.__dp.person();
    document.querySelector("#guess-input").value = p.name;
    document.querySelector("#guess-form").dispatchEvent(new Event("submit", { cancelable: true }));
  });
  await mp.waitForTimeout(900);
  await mp.screenshot({ path: path.join(SHOTS, "qa-08-mobile-reveal.png"), fullPage: true });
  await mctx.close();
  console.log("  ok: 截图已存 test/screenshots/qa-*.png");
}

await browser.close();
console.log(failures === 0 ? "\nQA 对抗测试全部通过 ✔" : `\n${failures} 项失败 ✘`);
process.exit(failures === 0 ? 0 : 1);
