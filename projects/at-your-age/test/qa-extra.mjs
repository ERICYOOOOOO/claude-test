// Adversarial QA suite — age precision (frozen clock), template grammar,
// "another one" exhaustion, share-card pixel colors. Run from repo root:
//   node projects/at-your-age/test/qa-extra.mjs
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

/* ================================================== 1. frozen-clock ages */
{
  console.log("== age precision with today frozen to 2026-07-04 ==");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  await ctx.addInitScript(() => {
    const RealDate = Date;
    const fixed = new RealDate(2026, 6, 4, 12, 0, 0); // local noon, 2026-07-04
    class FakeDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(fixed.getTime());
        else super(...args);
      }
      static now() { return fixed.getTime(); }
    }
    FakeDate.UTC = RealDate.UTC;
    FakeDate.parse = RealDate.parse;
    // eslint-disable-next-line no-global-assign
    window.Date = FakeDate;
  });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(URL);

  async function ageOf(y, m, d) {
    await enterBirth(page, y, m, d);
    await page.waitForSelector("#result:not([hidden])");
    const num = (await page.textContent("#ageNum")).trim();
    const sub = (await page.textContent("#ageSub")).trim().replace(/\s+/g, " ");
    await page.click("#editBirth");
    await page.waitForSelector("#gate:not([hidden])");
    return { num, sub };
  }

  let r = await ageOf("1990", "07", "04");
  check(r.num === "36", `born 1990-07-04 -> exactly 36 (got ${r.num})`);
  check(r.sub.includes("years and 0 days"), `... and 0 days (got "${r.sub}")`);
  check(r.sub.includes("13,149"), `... 13,149 days on the clock (got "${r.sub}")`);

  r = await ageOf("1990", "07", "05");
  check(r.num === "35", `born 1990-07-05 -> 35 (got ${r.num})`);
  check(r.sub.includes("years and 364 days"), `... and 364 days (got "${r.sub}")`);
  check(r.sub.includes("13,148"), `... 13,148 total days (got "${r.sub}")`);

  r = await ageOf("1990", "07", "03");
  check(r.sub.includes("years and 1 day ") || / 1 day\b/.test(r.sub),
    `born 1990-07-03 -> "1 day", singular (got "${r.sub}")`);
  check(!/1 days\b/.test(r.sub), "no \"1 days\" plural bug in the age line");

  r = await ageOf("2000", "02", "29");
  check(r.num === "26", `leap-day birth 2000-02-29 -> 26 (got ${r.num})`);
  check(r.sub.includes("years and 125 days"), `... 125 days since Mar 1 rollover (got "${r.sub}")`);
  check(r.sub.includes("9,622"), `... 9,622 total days (got "${r.sub}")`);

  r = await ageOf("2013", "07", "04");
  check(r.num === "13", `13th birthday today -> admitted, age 13 (got ${r.num})`);

  // -------- minors: must refuse kindly, never roast a child ---------------
  async function expectMinor(y, m, d, label) {
    await enterBirth(page, y, m, d);
    const errVisible = await page.isVisible("#err");
    const txt = errVisible ? (await page.textContent("#err")).trim() : "";
    const resultHidden = await page.isHidden("#result");
    check(errVisible && resultHidden, `${label}: blocked at the gate`);
    check(txt.includes("13"), `${label}: copy names the 13+ threshold`);
    check(/not behind/.test(txt) && !/!|behind[^ ]|loser|fail/i.test(txt.replace("not behind", "")),
      `${label}: copy is kind, no roasting (got "${txt}")`);
  }
  await expectMinor("2013", "07", "05", "12y 364d (one day short of 13)");
  await expectMinor("2015", "01", "01", "11-year-old");
  await expectMinor("2026", "07", "04", "born today");

  check(errors.length === 0, `frozen-clock run: zero console errors (got ${errors.join(" | ")})`);
  await ctx.close();
}

/* =============================================== 2. template engine grammar */
{
  console.log("== template engine: four sentence families + plural audit ==");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(URL);

  const res = await page.evaluate(() => {
    const byId = (id) => AYA_MILESTONES.find((m) => m.id === id);
    const days = (m) => m.ageDays || Math.round(m.age * 365.2425);
    const V = (id, totalDays) => window.AYA.verdictFor(byId(id), { totalDays });
    const out = {};

    // family A: dead person, user has outlived them (41y0d vs Mozart 13096d)
    out.deadOlder = V("mozart-dead", 14975);
    // family B: dead person, user still younger
    out.deadYounger = V("mozart-dead", 8000);
    // family C: same age, almost to the day (roast + heal)
    out.nearRoast = V("zuckerberg-facebook", days(byId("zuckerberg-facebook")) + 100);
    out.nearHeal = V("moses-show", days(byId("moses-show")) - 100);
    // family D: milestone earlier than user (user older), roast
    out.roastOlder = V("zuckerberg-facebook", days(byId("zuckerberg-facebook")) + 4402);
    // family E: milestone later than user (user younger), roast
    out.roastYounger = V("jfk-president", 10000);
    // heal, user younger, entry with `future`
    out.healFuture = V("moses-painting", 11000);
    // heal, user younger, no `future`
    out.healYounger = V("sanders-sale", 11000);
    // heal, user already past the age
    out.healOlder = V("hford-starwars", 22000);

    // exact death-gap magnitude: 41y user vs Mozart dead at 35y312d -> 5y53d
    out.deathSpanOK = /5 years and 53 days/.test(out.deadOlder);
    out.spans = [
      window.AYA.formatSpan(1),
      window.AYA.formatSpan(2),
      window.AYA.formatSpan(365),
      window.AYA.formatSpan(366),
      window.AYA.formatSpan(730),
      window.AYA.formatSpan(731)
    ];

    // fuzz every milestone x a ladder of ages; hunt for grammar corpses
    const bad = [];
    const ages = [13, 18, 25, 30, 36, 41, 55, 70, 88, 101];
    for (const m of AYA_MILESTONES) {
      for (const a of ages) {
        const v = window.AYA.verdictFor(m, { totalDays: Math.round(a * 365.2425) + 37 });
        if (/\b1 (years|days)\b/.test(v)) bad.push(`[plural] ${m.id}@${a}: ${v}`);
        if (/undefined|NaN|\[object/.test(v)) bad.push(`[hole] ${m.id}@${a}: ${v}`);
        if (/ {2}/.test(v)) bad.push(`[dblspace] ${m.id}@${a}: ${v}`);
        if (/\.\./.test(v)) bad.push(`[dblperiod] ${m.id}@${a}: ${v}`);
        if (!/^[A-Z"“]/.test(v)) bad.push(`[case] ${m.id}@${a}: ${v}`);
        if (!/\.$/.test(v)) bad.push(`[period] ${m.id}@${a}: ${v}`);
      }
    }
    out.bad = bad.slice(0, 10);
    out.badCount = bad.length;
    return out;
  });

  check(/had been dead for 5 years and 53 days|outlived Mozart by 5 years and 53 days/.test(res.deadOlder),
    `dead & outlived: correct 5y53d gap ("${res.deadOlder}")`);
  check(/Mozart was dead by 35\. You have .+ left on his clock\./.test(res.deadYounger),
    `dead & younger: countdown phrasing ("${res.deadYounger}")`);
  check(/almost to the day|At exactly the age you are now/.test(res.nearRoast),
    `same-age roast template fires ("${res.nearRoast}")`);
  check(/exactly your age when|This is apparently the moment/.test(res.nearHeal),
    `same-age heal template fires ("${res.nearHeal}")`);
  check(/12 years and 19 days/.test(res.roastOlder) &&
        /younger than you are right now|longer to get around to it|ago, by your calendar/.test(res.roastOlder),
    `user-older roast: correct span 12y19d ("${res.roastOlder}")`);
  check(/The clock is running|Just saying/.test(res.roastYounger),
    `user-younger roast template fires ("${res.roastYounger}")`);
  check(/wouldn't pick up a brush in earnest for another|didn't pick up a brush in earnest until 76/.test(res.healFuture),
    `heal "future" template fires ("${res.healFuture}")`);
  check(/before you're even there|early\.|There is time/.test(res.healYounger),
    `heal user-younger template fires ("${res.healYounger}")`);
  check(/only getting started|Late by whose clock/.test(res.healOlder),
    `heal user-older template fires ("${res.healOlder}")`);
  check(res.deathSpanOK, "death gap magnitude sane (35y-dead Mozart vs 41y user ~= 5 years)");

  const [s1, s2, s3, s4, s5, s6] = res.spans;
  check(s1 === "1 day", `formatSpan(1) = "1 day" (got "${s1}")`);
  check(s2 === "2 days", `formatSpan(2) = "2 days" (got "${s2}")`);
  check(s3 === "1 year", `formatSpan(365) = "1 year" (got "${s3}")`);
  check(s4 === "1 year and 1 day", `formatSpan(366) = "1 year and 1 day" (got "${s4}")`);
  check(s5 === "2 years", `formatSpan(730) = "2 years" (got "${s5}")`);
  check(s6 === "2 years and 1 day", `formatSpan(731) = "2 years and 1 day" (got "${s6}")`);

  check(res.badCount === 0,
    `grammar fuzz over ${215 * 10} verdicts: zero "1 years"/holes/casing bugs` +
    (res.badCount ? ` — got ${res.badCount}, e.g. ${res.bad.join(" ;; ")}` : ""));

  check(errors.length === 0, `template run: zero console errors (got ${errors.join(" | ")})`);
  await ctx.close();
}

/* ==================================== 3. "another one": no repeats, cycles */
{
  console.log("== another one x20 unique, full-pool exhaustion cycles cleanly ==");
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce" // render synchronously so we can hammer the button
  });
  const errors = [];
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(URL);
  await enterBirth(page, "1995", "06", "15");
  await page.waitForSelector("#result:not([hidden])");

  const r = await page.evaluate(() => {
    const pool = AYA_MILESTONES.filter((m) => m.mode === "roast").length;
    const ids = [window.AYA.getCurrent().id];
    const btn = document.getElementById("another");
    for (let i = 0; i < pool * 2 + 9; i++) {
      btn.click();
      ids.push(window.AYA.getCurrent().id);
    }
    return { pool, ids };
  });

  const first21 = new Set(r.ids.slice(0, 21));
  check(first21.size === 21, `20 rapid clicks -> 21 distinct milestones, zero repeats (got ${first21.size})`);
  const cycle1 = new Set(r.ids.slice(0, r.pool));
  const cycle2 = new Set(r.ids.slice(r.pool, r.pool * 2));
  check(cycle1.size === r.pool, `first pass covers the whole roast pool of ${r.pool} without a dupe (got ${cycle1.size})`);
  check(cycle2.size === r.pool, `after exhaustion it re-cycles the full pool again (got ${cycle2.size})`);
  check(r.ids.length === r.pool * 2 + 10 && r.ids.every(Boolean),
    "no null/crash across 2x pool exhaustion");

  const store = await page.evaluate(() => JSON.parse(localStorage.getItem("aya:v1")));
  check(store && store.v === 1 && Array.isArray(store.seen.roast) && store.seen.roast.length <= r.pool,
    "localStorage seen-list stays bounded after cycling");

  check(errors.length === 0, `exhaustion run: zero console errors (got ${errors.join(" | ")})`);
  await ctx.close();
}

/* =============================== 4. share cards: red card vs green card px */
{
  console.log("== share card pixels: ROAST bleeds red, HEAL reads green ==");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(URL);
  await enterBirth(page, "1995", "06", "15");
  await page.waitForSelector("#result:not([hidden])");

  async function sampleCard() {
    return page.evaluate(async () => {
      const url = window.AYA.cardDataURL();
      const img = new Image();
      await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data);
      return {
        url,
        w: img.width, h: img.height,
        band: px(540, 753),   // center of the full-width accent band
        chip: px(795, 120),   // flat area of the top-right mode chip
        paper: px(540, 200)   // background must stay paper white
      };
    });
  }

  const roast = await sampleCard();
  check(roast.w === 1080 && roast.h === 1350, `card is 1080x1350 (got ${roast.w}x${roast.h})`);
  check(roast.band[0] > 180 && roast.band[1] < 120 && roast.band[2] < 120,
    `ROAST band pixel is red (rgb ${roast.band.slice(0, 3).join(",")})`);
  check(roast.chip[0] > 180 && roast.chip[1] < 120,
    `ROAST chip pixel is red (rgb ${roast.chip.slice(0, 3).join(",")})`);
  check(roast.paper[0] > 245 && roast.paper[1] > 245 && roast.paper[2] > 245,
    `card background stays paper white (rgb ${roast.paper.slice(0, 3).join(",")})`);

  await page.click("#flip");
  await page.waitForTimeout(300);
  const heal = await sampleCard();
  check(heal.band[1] > 100 && heal.band[0] < 100 && heal.band[1] > heal.band[0],
    `HEAL band pixel is green (rgb ${heal.band.slice(0, 3).join(",")})`);
  check(heal.chip[1] > 100 && heal.chip[0] < 100,
    `HEAL chip pixel is green (rgb ${heal.chip.slice(0, 3).join(",")})`);
  check(roast.url !== heal.url, "roast and heal cards are genuinely different PNGs");

  const b64 = (u) => Buffer.from(u.split(",")[1], "base64");
  fs.writeFileSync(path.join(SHOTS, "card-roast.png"), b64(roast.url));
  fs.writeFileSync(path.join(SHOTS, "card-heal.png"), b64(heal.url));
  console.log("  (cards written to test/screenshots/card-roast.png / card-heal.png)");

  check(errors.length === 0, `card run: zero console errors (got ${errors.join(" | ")})`);
  await ctx.close();
}

/* ---------------------------------------------- extra shot for design review */
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.screenshot({ path: path.join(SHOTS, "mobile-gate.png"), fullPage: true });
  await ctx.close();
}

await browser.close();

if (failures) {
  console.error(`\nqa-extra.mjs: ${failures} failure(s)`);
  process.exit(1);
}
console.log("\nqa-extra.mjs: all checks passed.");
