/* Word Age — adversarial QA extras. Run from the repo root:
 *   node projects/word-age/test/qa-extra.mjs
 * Covers: hostile/edge search input (XSS, apostrophes, long strings, empty),
 * clock-injected Word of the Day stability, SEO completeness of generated
 * word pages (title/meta/OG/internal links/sitemap), non-blank share card. */
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
function guard(page, errors, dialogs) {
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("dialog", async (d) => { dialogs.push(d.message()); await d.dismiss(); });
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

// ---------- 1. hostile & edge search input ----------
{
  console.log("search edge cases (desktop 1280×800)");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [], dialogs = [];
  guard(page, errors, dialogs);
  await page.goto(url("index.html"));

  // uppercase resolves
  await page.fill("#q", "NICE");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  ok(await page.locator("#result").isVisible(), "uppercase NICE resolves");
  ok((await page.locator("#r-word").innerText()).trim() === "nice", "normalized to lowercase headword");

  // surrounding/inner whitespace stripped
  await page.fill("#q", "  m e a t  ");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  ok((await page.locator("#r-word").innerText()).trim() === "meat", "whitespace-riddled input still finds 'meat'");

  // empty Enter straight after a hit: guarded no-op, result stays put
  await page.fill("#q", "");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  ok(await page.locator("#result").isVisible(), "empty Enter keeps the last good result on screen");
  ok(await page.locator("#notfound").isHidden(), "empty Enter conjures no error state");

  // apostrophe word: don't -> "dont" -> polite not-found with 3 suggestions
  await page.fill("#q", "don't");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  ok(await page.locator("#notfound").isVisible(), "don't lands in not-found state (no crash)");
  ok(await page.locator("#nf-sugg .chip").count() === 3, "apostrophe word gets 3 nearest suggestions");
  ok((await page.locator("#nf-q").innerText()) === "dont", "not-found echoes the sanitized query");

  // clearing the input dismisses the stale not-found note (it quotes the query)
  await page.fill("#q", "");
  await page.waitForTimeout(150);
  ok(await page.locator("#notfound").isHidden(), "clearing input dismisses the not-found note");

  // 600-char monster string: no layout break, no crash
  await page.fill("#q", "a".repeat(600));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  ok(await page.locator("#notfound").isVisible(), "600-char input handled as not-found");
  const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  ok(noHScroll, "long input does not blow the layout horizontally");

  // XSS probe via the input
  await page.fill("#q", "<img src=x onerror=alert(1)>");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  ok(dialogs.length === 0, "XSS input: no alert dialog fired");
  ok(await page.evaluate(() => document.querySelectorAll("#notfound img, #result img").length) === 0, "XSS input: no <img> element injected");
  const echoed = await page.locator("#nf-q").innerText();
  ok(!/[<>]/.test(echoed), `XSS input echoed sanitized ("${echoed}")`);

  // XSS probe via ?q= deep link
  await page.goto(url("index.html") + "?q=" + encodeURIComponent('<img src=x onerror=alert(1)>"><script>alert(2)</script>'));
  await page.waitForTimeout(400);
  ok(dialogs.length === 0, "XSS via ?q=: no dialog");
  ok(await page.evaluate(() => document.querySelectorAll("main img, main script").length) === 0, "XSS via ?q=: no injected node");

  // XSS probe via #hash deep link
  await page.goto(url("index.html") + "#%3Cimg%20src=x%20onerror=alert(3)%3E");
  await page.waitForTimeout(400);
  ok(dialogs.length === 0, "XSS via #hash: no dialog");

  // rapid-fire typing (paste-like) does not error
  for (const q of ["nice", "qq", "silly", "zz", "girl"]) {
    await page.fill("#q", q);
    await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(600);
  ok(await page.locator("#result").isVisible(), "rapid repeated queries settle on a result");
  ok(errors.length === 0, `zero console errors across all hostile input ${errors[0] || ""}`);
  ok(dialogs.length === 0, "zero dialogs across all hostile input");
  await ctx.close();
}

// ---------- 2. Word of the Day under an injected clock ----------
{
  console.log("word of the day: same-day stability + cross-midnight change");
  // 2026-07-04 02:00 UTC; container clock is deterministic per context via Date.now override
  const T0 = Date.UTC(2026, 6, 4, 2, 0, 0);
  async function wotdAt(ms) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors = [], dialogs = [];
    guard(page, errors, dialogs);
    await page.addInitScript(`Date.now = () => ${ms};`);
    await page.goto(url("index.html"));
    await page.waitForTimeout(200);
    const w = (await page.locator("#wotd-word").innerText()).trim();
    ok(errors.length === 0, `zero console errors under injected clock ${errors[0] || ""}`);
    await ctx.close();
    return w;
  }
  const morning = await wotdAt(T0);              // 02:00
  const evening = await wotdAt(T0 + 20 * 3600e3); // 22:00 same day
  const nextDay = await wotdAt(T0 + 24 * 3600e3); // 02:00 next day
  ok(morning.length > 0, `wotd rendered ("${morning}")`);
  ok(morning === evening, `wotd stable within one day ("${morning}" === "${evening}")`);
  ok(morning !== nextDay, `wotd changes across midnight ("${morning}" -> "${nextDay}")`);
}

// ---------- 3. five generated word pages: SEO contract ----------
{
  console.log("word pages: title/meta/OG/related links/sitemap");
  const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
  const picks = ["nice", "silly", "meat", "robot", "selfie"];
  for (const w of picks) {
    const file = path.join(ROOT, "words", `${w}.html`);
    ok(fs.existsSync(file), `${w}.html exists`);
    const html = fs.readFileSync(file, "utf8");
    ok(new RegExp(`<title>How old is the word “${w}”\\? First recorded .+ \\| Word Age</title>`).test(html), `${w}: title template complete`);
    const md = html.match(/<meta name="description" content="([^"]+)"/);
    ok(md && md[1].length > 40 && md[1].length <= 170, `${w}: meta description present & sane length (${md ? md[1].length : 0})`);
    for (const tag of ["og:title", "og:description", "og:type", "og:url", "og:site_name"]) {
      ok(html.includes(`property="${tag}"`), `${w}: ${tag} present`);
    }
    ok(html.includes('name="twitter:card"'), `${w}: twitter card present`);
    ok(html.includes(`<link rel="canonical" href="https://wordage.fyi/words/${w}.html">`), `${w}: canonical self-reference`);
    // 4 related internal links whose targets exist on disk
    const rel = [...html.matchAll(/<li><a href="([a-z-]+\.html)">/g)].map((m) => m[1]);
    ok(rel.length >= 4, `${w}: >= 4 related links (${rel.length})`);
    for (const r of rel) ok(fs.existsSync(path.join(ROOT, "words", r)), `${w}: related target exists (${r})`);
    ok(sitemap.includes(`/words/${w}.html</loc>`), `${w}: in sitemap`);
  }

  // click-through: every related link on a live page navigates to a real entry
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [], dialogs = [];
  guard(page, errors, dialogs);
  await page.goto(url("words/nice.html"));
  await page.waitForTimeout(300);
  const hrefs = await page.locator(".seealso li a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  ok(hrefs.length >= 4, `nice: ${hrefs.length} clickable related links`);
  await page.locator(".seealso li a").first().click();
  await page.waitForTimeout(700);
  ok(await page.locator("h1.headword").count() === 1, "clicking a related link lands on a live entry page");
  ok(errors.length === 0, `zero console errors on click-through ${errors[0] || ""}`);
  await ctx.close();
}

// ---------- 4. share card PNG is not blank ----------
{
  console.log("share card: rendered PNG has real ink on it");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [], dialogs = [];
  guard(page, errors, dialogs);
  await page.goto(url("words/nice.html"));
  await page.waitForTimeout(700);
  const stats = await page.evaluate(async () => {
    const dataUrl = window.WordAgeApp.renderCard();
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let ink = 0, red = 0;
    const total = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (Math.abs(r - 247) + Math.abs(g - 242) + Math.abs(b - 231) > 60) ink++;
      if (r > 100 && r < 190 && g < 90 && b < 80) red++;
    }
    return { w: img.width, h: img.height, inkPct: (100 * ink) / total, redPct: (100 * red) / total, bytes: dataUrl.length };
  });
  ok(stats.w === 1080 && stats.h === 1350, `card is 1080×1350 (got ${stats.w}×${stats.h})`);
  ok(stats.inkPct > 1.5, `card is not blank — ${stats.inkPct.toFixed(2)}% non-paper pixels`);
  ok(stats.redPct > 0.02, `oxide-red stamp/frame actually drawn (${stats.redPct.toFixed(3)}% red pixels)`);
  ok(stats.bytes > 20000, `PNG data URL non-trivial (${stats.bytes} chars)`);
  ok(errors.length === 0, `zero console errors ${errors[0] || ""}`);
  await ctx.close();
}

await browser.close();

if (failures) {
  console.error(`\nqa-extra.mjs: ${failures} failure(s)`);
  process.exit(1);
}
console.log("\nqa-extra.mjs: all assertions passed");
