// Overlap — Playwright smoke test. Run from the repo root:
//   node projects/overlap/test/smoke.mjs
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(DIR);
const URL = "file://" + path.join(ROOT, "index.html");
const SHOTS = path.join(DIR, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0;
function check(cond, msg) {
  console.log((cond ? "  ok    " : "  FAIL  ") + msg);
  if (!cond) failures++;
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function pickCity(page, side, query, expectName) {
  const input = page.locator("#city" + side);
  await input.fill("");
  await input.fill(query);
  const opt = page.locator(`#list${side} li`, { hasText: expectName }).first();
  await opt.waitFor({ state: "visible", timeout: 5000 });
  await opt.click();
}

/* ============================================== desktop: the whole journey */
{
  console.log("== desktop 1280x800: core loop ==");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(URL);
  check((await page.title()).includes("Overlap"), "page title mentions Overlap");
  check(await page.isVisible("#empty"), "empty state visible before any city is chosen");
  await page.screenshot({ path: path.join(SHOTS, "desktop-empty.png") });

  // search & select: English prefix for A, Chinese name for B
  await pickCity(page, "A", "New Y", "New York");
  check((await page.inputValue("#cityA")) === "New York", "typing “New Y” selects New York");
  await pickCity(page, "B", "东京", "Tokyo");
  check((await page.inputValue("#cityB")) === "Tokyo", "Chinese query 「东京」 selects Tokyo");

  await page.waitForSelector("#result:not([hidden])");
  check(await page.isVisible("#result"), "result section appears");

  const verdict = await page.textContent("#verdictNum");
  check(/^(\d+h( \d+m)?|\d+m)$/.test(verdict.trim()), `verdict shows a duration (got “${verdict.trim()}”)`);
  const tier = await page.textContent("#tierLine");
  check(tier.trim().length > 10, "tier line has copy");
  const offset = await page.textContent("#offsetLine");
  check(/ahead|behind/.test(offset), `offset line explains the clock gap (got “${offset.trim()}”)`);

  // dual-track band
  const segs = await page.locator("#bandBox svg rect.seg").count();
  check(segs >= 6, `band renders state segments (${segs} rects)`);
  const sides = await page.locator("#bandBox svg text.band-side").allTextContents();
  check(sides.join(",").includes("YOU") && sides.join(",").includes("THEM"), "band labels both tracks YOU / THEM");
  const ovl = await page.locator("#bandBox svg rect.ovl").count();
  console.log("         (overlap glow segments right now: " + ovl + ")");

  // countdown ticks
  const cd1 = await page.textContent("#countdown");
  check(/opens in|closes in|no shared window/.test(cd1), `countdown present (got “${cd1.trim()}”)`);
  if (!/no shared window/.test(cd1)) {
    const ticked = await page
      .waitForFunction((prev) => document.getElementById("countdown").textContent !== prev, cd1, { timeout: 5000 })
      .then(() => true, () => false);
    check(ticked, "countdown is ticking (text changed within 5s)");
  }

  // odometer backfill via “we met on”
  await page.fill("#metDate", "2024-02-14");
  await page.waitForTimeout(200);
  const meterH = await page.textContent("#meterNum");
  check(parseInt(meterH.replace(/,/g, ""), 10) > 0, `“we met on” backfills the odometer (${meterH.trim()} h)`);

  // share card: canvas PNG must be real pixels, not empty
  await page.click("#btnSaveCard");
  await page.waitForSelector("#cardPreviewBox:not([hidden])");
  const dataLen = await page.evaluate(() => Overlap.ui.renderShareCard().toDataURL("image/png").length);
  check(dataLen > 50000, `share card PNG is non-trivial (${dataLen} chars of dataURL)`);
  const shareText = await page.evaluate(() => Overlap.ui.buildShareText());
  check(shareText.includes("New York") && shareText.includes("Tokyo") && shareText.includes("overlap.love"),
    "share text carries cities + domain");
  check(/We overlap for /.test(shareText), "share text opens with the verdict");

  await page.screenshot({ path: path.join(SHOTS, "desktop-result.png"), fullPage: true });

  // swap survives rapid clicking
  for (let i = 0; i < 5; i++) await page.click("#swapBtn");
  check((await page.inputValue("#cityA")) === "Tokyo", "5 rapid swaps land as expected (odd count → swapped)");

  // reload: pair persists (hash + localStorage)
  await page.reload();
  await page.waitForSelector("#result:not([hidden])");
  check((await page.inputValue("#cityA")) === "Tokyo" && (await page.inputValue("#cityB")) === "New York",
    "reload restores the pair");

  // deep link via hash
  await page.goto(URL + "#paris/seoul");
  await page.waitForSelector("#result:not([hidden])");
  check((await page.inputValue("#cityA")) === "Paris" && (await page.inputValue("#cityB")) === "Seoul",
    "#paris/seoul deep link loads that pair");

  check(errors.length === 0, "zero console errors on desktop" + (errors.length ? " — " + errors.join(" | ") : ""));
  await ctx.close();
}

/* ============================================================ mobile 375px */
{
  console.log("== mobile 375x667 ==");
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(URL + "#shanghai/london");
  await page.waitForSelector("#result:not([hidden])");
  check(await page.isVisible("#result"), "result renders on 375px");
  const scrollW = await page.evaluate(() => document.scrollingElement.scrollWidth);
  check(scrollW <= 375, `no horizontal page scroll (scrollWidth ${scrollW})`);
  await page.screenshot({ path: path.join(SHOTS, "mobile-result.png"), fullPage: true });
  check(errors.length === 0, "zero console errors on mobile" + (errors.length ? " — " + errors.join(" | ") : ""));
  await ctx.close();
}

/* ============================================== garbage localStorage state */
{
  console.log("== localStorage garbage tolerance ==");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("overlap:v1:last", "{not json at all");
      localStorage.setItem("overlap:v1:meter:tokyo~new-york", '"just a string"');
      localStorage.setItem("overlap:v1:meter:paris~seoul", '{"ms":"NaN","met":12345}');
    } catch (e) { /* ignore */ }
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(URL + "#paris/seoul");
  await page.waitForSelector("#result:not([hidden])");
  check(await page.isVisible("#result"), "page still works with corrupted storage");
  const meter = await page.textContent("#meterNum");
  check(/^[\d,]+$/.test(meter.trim()), `meter falls back to a clean number (got “${meter.trim()}”)`);
  check(errors.length === 0, "zero console errors with garbage storage" + (errors.length ? " — " + errors.join(" | ") : ""));
  await ctx.close();
}

/* ===================================================== reduced motion pass */
{
  console.log("== prefers-reduced-motion ==");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(URL + "#sydney/honolulu");
  await page.waitForSelector("#result:not([hidden])");
  check(await page.isVisible("#result"), "renders under reduced motion (extreme pair Sydney–Honolulu)");
  check(errors.length === 0, "zero console errors under reduced motion" + (errors.length ? " — " + errors.join(" | ") : ""));
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nALL GREEN (smoke.mjs)" : "\n" + failures + " FAILURE(S) (smoke.mjs)");
process.exit(failures === 0 ? 0 : 1);
