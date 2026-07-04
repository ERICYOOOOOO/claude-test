// Playwright smoke test. Run from the repo root:
//   node projects/at-your-age/test/smoke.mjs
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

async function enterBirth(page, y, m, d) {
  await page.fill("#year", "");
  await page.fill("#month", "");
  await page.fill("#day", "");
  await page.fill("#year", y);
  await page.fill("#month", m);
  await page.fill("#day", d);
  await page.click("#go");
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

/* ------------------------------------------------------ desktop main loop */
{
  console.log("== desktop 1280x800 ==");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto(URL);
  check(await page.isVisible("#gate"), "gate screen visible on first load");
  await page.screenshot({ path: path.join(SHOTS, "desktop-gate.png") });

  await enterBirth(page, "1995", "06", "15");
  await page.waitForSelector("#result:not([hidden])");
  check(await page.isVisible("#result"), "result screen appears after 1995-06-15");

  const mode1 = await page.evaluate(() => window.AYA.getMode());
  check(mode1 === "roast", `default mode is roast (got ${mode1})`);
  const ageNum = await page.textContent("#ageNum");
  check(/^\d+$/.test(ageNum.trim()) && parseInt(ageNum, 10) >= 29, `age number rendered (${ageNum.trim()})`);
  const verdictRoast = (await page.textContent("#verdict")).trim();
  check(verdictRoast.length > 20, `roast verdict present: "${verdictRoast.slice(0, 60)}..."`);
  await page.screenshot({ path: path.join(SHOTS, "desktop-roast.png") });

  // flip to HEAL
  await page.click("#flip");
  await page.waitForTimeout(350);
  const mode2 = await page.evaluate(() => window.AYA.getMode());
  const verdictHeal = (await page.textContent("#verdict")).trim();
  check(mode2 === "heal", "flip switches to heal mode");
  check(await page.getAttribute("body", "data-mode") === "heal", "body accent switches to heal");
  check(verdictHeal.length > 20 && verdictHeal !== verdictRoast, "heal verdict differs from roast verdict");
  await page.screenshot({ path: path.join(SHOTS, "desktop-heal.png") });

  // another one
  await page.click("#another");
  await page.waitForTimeout(350);
  const verdictNext = (await page.textContent("#verdict")).trim();
  check(verdictNext.length > 20 && verdictNext !== verdictHeal, "\"another one\" swaps the verdict");

  // rapid re-clicks must not throw
  for (let i = 0; i < 12; i++) await page.click("#another", { delay: 10 });
  await page.waitForTimeout(300);

  // share text + card
  const share = await page.evaluate(() => window.AYA.shareText());
  check(share.length > 40 && share.includes("mode"), "share text non-empty");
  check(share.includes("atyourage"), "share text carries the domain");
  const dataUrl = await page.evaluate(() => window.AYA.cardDataURL());
  check(dataUrl.startsWith("data:image/png") && dataUrl.length > 5000,
    `share card PNG generated (${Math.round(dataUrl.length / 1024)} KB base64)`);

  // copy button path (clipboard may be denied on file://; must not crash)
  await page.click("#copy");
  await page.waitForTimeout(200);

  // ---- edge cases -------------------------------------------------------
  await page.click("#editBirth");
  await page.waitForSelector("#gate:not([hidden])");

  await enterBirth(page, "2099", "01", "01");
  check(await page.isVisible("#err"), "future date shows friendly error");
  check((await page.textContent("#err")).includes("born"), "future-date copy is friendly");

  await enterBirth(page, "1850", "01", "01");
  check((await page.textContent("#err")).includes("1900"), "pre-1900 shows range error");

  await enterBirth(page, "1999", "02", "30");
  check((await page.textContent("#err")).toLowerCase().includes("exist"), "Feb 30 flagged as nonexistent");

  await enterBirth(page, "abcd", "xx", "yy");
  check(await page.isVisible("#err"), "garbage input shows error, no crash");

  // leap-year birthday works
  await enterBirth(page, "2000", "02", "29");
  await page.waitForSelector("#result:not([hidden])");
  check(await page.isVisible("#result"), "Feb 29, 2000 accepted (leap year)");

  // corrupted localStorage must not brick the app
  await page.evaluate(() => localStorage.setItem("aya:v1", "{{{corrupt"));
  await page.reload();
  check(await page.isVisible("#gate"), "corrupt localStorage falls back to gate cleanly");
  await enterBirth(page, "1995", "06", "15");
  await page.waitForSelector("#result:not([hidden])");
  check(await page.isVisible("#result"), "works again after storage corruption");

  check(errors.length === 0, `zero console errors (got ${errors.length}${errors.length ? ": " + errors.join(" | ") : ""})`);
  await ctx.close();
}

/* ------------------------------------------------- mobile + reduced motion */
{
  console.log("== mobile 375x667 (reduced motion) ==");
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 667 },
    reducedMotion: "reduce"
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto(URL);
  await enterBirth(page, "1995", "06", "15");
  await page.waitForSelector("#result:not([hidden])");
  check(await page.isVisible("#result"), "mobile: result renders");

  const before = (await page.textContent("#verdict")).trim();
  await page.click("#flip");
  await page.waitForTimeout(150);
  const after = (await page.textContent("#verdict")).trim();
  check(after !== before, "mobile: flip still swaps content with reduced motion");

  const noHScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );
  check(noHScroll, "mobile: no horizontal scroll at 375px");

  await page.screenshot({ path: path.join(SHOTS, "mobile-result.png"), fullPage: true });
  check(errors.length === 0, `mobile: zero console errors (got ${errors.length}${errors.length ? ": " + errors.join(" | ") : ""})`);
  await ctx.close();
}

await browser.close();

if (failures) {
  console.error(`\nsmoke.mjs: ${failures} failure(s)`);
  process.exit(1);
}
console.log("\nsmoke.mjs: all checks passed.");
