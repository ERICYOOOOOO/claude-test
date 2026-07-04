/* Word Age — Playwright smoke test. Run from the repo root:
 *   node projects/word-age/test/smoke.mjs */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHOTS = path.join(ROOT, "test", "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const url = (p) => "file://" + path.join(ROOT, p);

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

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

// ---------- homepage: desktop ----------
{
  console.log("homepage (desktop 1280×800)");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  track(page, errors);
  await page.goto(url("index.html"));
  await page.waitForTimeout(300);
  ok(errors.length === 0, `zero console errors on load ${errors[0] || ""}`);
  ok((await page.title()).includes("Word Age"), "title present");

  // word of the day rendered
  const wotd = (await page.locator("#wotd-word").innerText()).trim();
  ok(wotd.length > 0, `word of the day rendered ("${wotd}")`);

  // live suggestions
  await page.fill("#q", "sil");
  await page.waitForTimeout(120);
  ok(await page.locator("#sugg li").count() > 0, "typing shows suggestions");

  // core search: nice
  await page.fill("#q", "nice");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1100); // odometer settles (450ms) then swaps to plain text
  ok(await page.locator("#result").isVisible(), "search result visible for 'nice'");
  const yearText = (await page.locator("#r-year").innerText()).replace(/\s+/g, " ").trim();
  ok(yearText.length > 0, `year non-empty ("${yearText}")`);
  ok(yearText.includes("1300"), "year shows 1300 for nice");
  ok((await page.locator("#r-stamp").innerText()).toLowerCase().includes("older"), "verdict stamp shown");
  ok((await page.locator("#r-orig").innerText()).includes("foolish"), "original meaning shown");
  ok((await page.locator("#r-persp").innerText()).match(/older than .+ by \d+ years/i) !== null, "perspective line shown");
  ok(await page.locator("#r-related li").count() === 4, "4 related links");

  // share card + share text (canvas non-empty)
  const cardLen = await page.evaluate(() => window.WordAgeApp.renderCard().length);
  ok(cardLen > 20000, `share card PNG data non-trivial (${cardLen} chars)`);
  const shareTxt = await page.evaluate(() => window.WordAgeApp.shareText());
  ok(shareTxt.includes("nice") && shareTxt.includes("1300") && shareTxt.includes("/words/nice.html"), "share text has word, year, link");
  await page.click("#copy-text");
  await page.waitForTimeout(200);

  // not-found path with 3 suggestions
  await page.fill("#q", "qzzxy");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  ok(await page.locator("#notfound").isVisible(), "not-found state shown");
  ok(await page.locator("#nf-sugg .chip").count() === 3, "3 closest suggestions offered");
  await page.locator("#nf-sugg .chip").first().click();
  await page.waitForTimeout(500);
  ok(await page.locator("#result").isVisible(), "suggestion chip recovers to a result");

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOTS, "home-desktop.png"), fullPage: false });
  ok(errors.length === 0, `zero console errors after interactions ${errors[0] || ""}`);
  await ctx.close();
}

// ---------- homepage: mobile + garbage localStorage + reduced motion ----------
{
  console.log("homepage (mobile 375×667, corrupted localStorage, reduced motion)");
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 667 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  const errors = [];
  track(page, errors);
  await page.goto(url("index.html"));
  await page.evaluate(() => localStorage.setItem("wordage.v1", "{not json!!"));
  await page.reload();
  await page.waitForTimeout(250);
  ok(errors.length === 0, `zero console errors with corrupted localStorage ${errors[0] || ""}`);
  await page.fill("#q", "meat");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  ok(await page.locator("#result").isVisible(), "search works on mobile");
  const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  ok(noHScroll, "no horizontal scroll at 375px");
  await page.screenshot({ path: path.join(SHOTS, "home-mobile.png"), fullPage: false });
  await ctx.close();
}

// ---------- deep link ?q= ----------
{
  console.log("deep link ?q=fun");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  track(page, errors);
  await page.goto(url("index.html") + "?q=fun");
  await page.waitForTimeout(600);
  ok(await page.locator("#result").isVisible(), "?q= deep link renders result");
  ok((await page.locator("#r-word").innerText()).trim() === "fun", "deep link resolves to 'fun'");
  ok(errors.length === 0, `zero console errors ${errors[0] || ""}`);
  await ctx.close();
}

// ---------- 3 random generated word pages ----------
{
  const all = fs.readdirSync(path.join(ROOT, "words")).filter((f) => f.endsWith(".html") && f !== "index.html");
  const picks = [];
  while (picks.length < 3) {
    const p = all[Math.floor(Math.random() * all.length)];
    if (!picks.includes(p)) picks.push(p);
  }
  for (const file of picks) {
    const word = file.replace(/\.html$/, "");
    console.log(`word page: ${file}`);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors = [];
    track(page, errors);
    await page.goto(url(path.join("words", file)));
    await page.waitForTimeout(1100);
    ok(errors.length === 0, `zero console errors ${errors[0] || ""}`);
    ok((await page.title()).includes(word), `title contains "${word}"`);
    const yr = (await page.locator("#year").innerText()).replace(/\s+/g, " ").trim();
    ok(yr.length > 0, `year rendered ("${yr}")`);
    const cardLen = await page.evaluate(() => window.WordAgeApp.renderCard().length);
    ok(cardLen > 20000, `share card works on word page (${cardLen} chars)`);
    ok(await page.locator(".seealso li a").count() >= 4, "related links present");
    await ctx.close();
  }
  // one screenshot of a word page for the record
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(url("words/nice.html"));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOTS, "word-nice-desktop.png"), fullPage: true });
  await ctx.close();
}

// ---------- catalogue page ----------
{
  console.log("catalogue page");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  track(page, errors);
  await page.goto(url("words/index.html"));
  await page.waitForTimeout(200);
  ok(errors.length === 0, `zero console errors ${errors[0] || ""}`);
  ok(await page.locator(".cat-group li a").count() >= 260, "catalogue lists all words");
  await ctx.close();
}

await browser.close();

if (failures) {
  console.error(`\nsmoke.mjs: ${failures} failure(s)`);
  process.exit(1);
}
console.log("\nsmoke.mjs: all assertions passed");
