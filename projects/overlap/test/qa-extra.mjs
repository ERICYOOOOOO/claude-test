// Overlap — adversarial QA suite (independent of the dev-written tests).
//   node projects/overlap/test/qa-extra.mjs
// Part 1 runs the pure core under Node and re-verifies every timezone claim
// through an INDEPENDENT Intl path (timeZoneName: "longOffset"), so a bug in
// the app's own offset derivation cannot vouch for itself.
// Part 2 drives the real page under Playwright: deep links, odometer abuse
// (negative / 1e12 / NaN / future date / clock rollback), and screenshots.
import "../cities.js";
import "../app.js";
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const O = globalThis.Overlap;
const CITIES = globalThis.CITIES;
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
function eq(got, want, msg) {
  check(got === want, msg + " (want " + want + ", got " + got + ")");
}

/* Independent offset oracle: parse Intl's own "GMT+05:45" longOffset name.
 * Completely different code path from app.js's Date.UTC reconstruction. */
function oracleOffset(date, tz) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(date);
  const name = parts.find((p) => p.type === "timeZoneName").value;
  const m = /^GMT(?:([+-])(\d{1,2}):(\d{2}))?$/.exec(name);
  if (!m) throw new Error("unparseable longOffset: " + name);
  return m[1] ? (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +m[3]) : 0;
}

function awakeOnly(startMin, endMin) {
  return { sleepStart: endMin, sleepEnd: startMin, busyStart: 0, busyEnd: 0, busyDays: [] };
}
function schedNone() {
  return { sleepStart: 0, sleepEnd: 0, busyStart: 0, busyEnd: 0, busyDays: [] };
}

const JAN = new Date("2026-01-15T12:00:00Z");
const JUL = new Date("2026-07-15T12:00:00Z");

/* ==================== 1. minute-offset zones, double-checked ==================== */
console.log("== qa 1: fractional-hour zones vs independent Intl oracle ==");
{
  // [zone, expected Jan offset, expected Jul offset] — constants from tzdata.
  const table = [
    ["Asia/Kathmandu", 345, 345],
    ["Asia/Kolkata", 330, 330],
    ["Australia/Lord_Howe", 660, 630], // +11 (LHDT) / +10:30 (LHST) — the half-hour DST zone
    ["America/St_Johns", -210, -150], // Newfoundland −3:30 / −2:30
    ["Australia/Adelaide", 630, 570],
    ["Australia/Darwin", 570, 570],
    ["Asia/Tehran", 210, 210], // Iran dropped DST in 2022
    ["Asia/Yangon", 390, 390],
    ["Australia/Sydney", 660, 600],
    ["Europe/London", 0, 60],
    ["Asia/Shanghai", 480, 480],
    ["Asia/Dubai", 240, 240],
    ["Pacific/Honolulu", -600, -600],
    ["Pacific/Auckland", 780, 720]
  ];
  for (const [z, wantJan, wantJul] of table) {
    eq(O.zoneOffsetMinutes(JAN, z), wantJan, z + " Jan offset");
    eq(O.zoneOffsetMinutes(JUL, z), wantJul, z + " Jul offset");
    eq(oracleOffset(JAN, z), wantJan, z + " Jan oracle agrees");
    eq(oracleOffset(JUL, z), wantJul, z + " Jul oracle agrees");
  }
  // Kathmandu is exactly 15 minutes ahead of Kolkata — and it must move the overlap.
  eq(O.zoneOffsetMinutes(JAN, "Asia/Kathmandu") - O.zoneOffsetMinutes(JAN, "Asia/Kolkata"), 15, "Kathmandu−Kolkata = 15 min");
  const day = O.computeDay(Date.parse("2026-01-15T00:00:00Z"), "Asia/Kolkata", "Asia/Kathmandu", awakeOnly(540, 600), awakeOnly(540, 600));
  eq(day.overlapMinutes, 45, "both free 09:00–10:00 local → 15-min slip leaves exactly 45 min");
}

/* ==================== 2. opposite-hemisphere DST (Sydney ↔ London) ==================== */
console.log("== qa 2: Sydney ↔ London, DST in opposite directions ==");
{
  const SYD = "Australia/Sydney";
  const LON = "Europe/London";
  eq(O.zoneOffsetMinutes(JAN, SYD) - O.zoneOffsetMinutes(JAN, LON), 660, "January: 11h apart (AEDT vs GMT)");
  eq(O.zoneOffsetMinutes(JUL, SYD) - O.zoneOffsetMinutes(JUL, LON), 540, "July: 9h apart (AEST vs BST)");
  eq(oracleOffset(JAN, SYD) - oracleOffset(JAN, LON), 660, "January 11h confirmed by oracle");
  eq(oracleOffset(JUL, SYD) - oracleOffset(JUL, LON), 540, "July 9h confirmed by oracle");
  // And in the overlap: London free 20–23, Sydney free 07–10.
  const a = awakeOnly(20 * 60, 23 * 60);
  const b = awakeOnly(7 * 60, 10 * 60);
  eq(O.computeDay(JAN.getTime(), LON, SYD, a, b).overlapMinutes, 180, "January: 20–23 London == 07–10 Sydney → full 3h");
  eq(O.computeDay(JUL.getTime(), LON, SYD, a, b).overlapMinutes, 60, "July: windows slide 2h apart → 1h left");
}

/* ==================== 3. offsetLine wording ==================== */
console.log("== qa 3: offset headline wording ==");
{
  const kol = { n: "Kolkata", z: "Asia/Kolkata" };
  const ktm = { n: "Kathmandu", z: "Asia/Kathmandu" };
  eq(O.offsetLine(JAN, kol, ktm), "Kathmandu runs 15m ahead.", "sub-hour gap must not read “0h 15m”");
  eq(O.offsetLine(JAN, ktm, kol), "Kolkata runs 15m behind.", "…and the reverse direction");
  eq(
    O.offsetLine(JAN, { n: "London", z: "Europe/London" }, { n: "Adelaide", z: "Australia/Adelaide" }),
    "Adelaide runs 10h 30m ahead.",
    "half-hour zone reads “10h 30m”"
  );
  eq(
    O.offsetLine(JAN, { n: "London", z: "Europe/London" }, { n: "Abidjan", z: "Africa/Abidjan" }),
    "Same clock, different streets.",
    "zero gap keeps the same-clock line"
  );
}

/* ==================== 4. city table: random 30 + curated sanity ==================== */
console.log("== qa 4: city table spot checks ==");
{
  // seeded PRNG so the "random" 30 are reproducible run-to-run
  let seed = 20260704;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const picked = new Set();
  while (picked.size < 30) picked.add(Math.floor(rnd() * CITIES.length));
  let ok30 = true;
  for (const i of picked) {
    const c = CITIES[i];
    try {
      const oJan = O.zoneOffsetMinutes(JAN, c.z);
      const oJul = O.zoneOffsetMinutes(JUL, c.z);
      if (oJan !== oracleOffset(JAN, c.z) || oJul !== oracleOffset(JUL, c.z)) throw new Error("oracle mismatch");
      if (!/^[A-Za-z_]+\/[A-Za-z0-9_+\-/]+$/.test(c.z) || /^Etc\//.test(c.z)) throw new Error("suspicious zone id");
      if (oJan % 15 !== 0 || oJul % 15 !== 0 || Math.abs(oJan) > 840 || Math.abs(oJul) > 840) throw new Error("implausible offset");
    } catch (e) {
      ok30 = false;
      console.log("         bad: " + c.n + " → " + c.z + " (" + e.message + ")");
    }
  }
  check(ok30, "random 30 cities: Intl-resolvable, real IANA ids, oracle-confirmed offsets");

  const zoneExpect = {
    shanghai: "Asia/Shanghai",
    beijing: "Asia/Shanghai",
    urumqi: "Asia/Shanghai", // national time by law, per playbook
    lhasa: "Asia/Shanghai",
    dubai: "Asia/Dubai",
    kathmandu: "Asia/Kathmandu",
    delhi: "Asia/Kolkata",
    kyiv: "Europe/Kyiv", // not the deprecated Europe/Kiev
    montreal: "America/Toronto",
    honolulu: "Pacific/Honolulu",
    "hong-kong": "Asia/Hong_Kong",
    "sao-paulo": "America/Sao_Paulo",
    "st-john-s": "America/St_Johns",
    adelaide: "Australia/Adelaide"
  };
  for (const id in zoneExpect) {
    const c = O.cityById(id);
    check(!!c, "city id exists: " + id);
    if (c) eq(c.z, zoneExpect[id], id + " → zone");
  }

  // 12 Chinese-alias searches (aliases, not just the 中文名 field)
  const zh = [
    ["上海", "Shanghai"],
    ["迪拜", "Dubai"],
    ["纽约", "New York"],
    ["雪梨", "Sydney"],
    ["汉城", "Seoul"],
    ["海参崴", "Vladivostok"],
    ["檀香山", "Honolulu"],
    ["约堡", "Johannesburg"],
    ["西贡", "Ho Chi Minh City"],
    ["翡冷翠", "Florence"],
    ["大溪地", "Papeete"],
    ["加德满都", "Kathmandu"]
  ];
  for (const [q, want] of zh) eq(O.searchCities(q)[0]?.n, want, "「" + q + "」 → " + want);
}

/* ==================== 5. schedule boundary abuse ==================== */
console.log("== qa 5: schedule boundaries & degenerate configs ==");
{
  const p = (min, dow) => ({ minutes: min, hh: Math.floor(min / 60), mm: min % 60, dow });
  const def = O.defaultSched();
  // 23:00–07:00 sleep, fence-posts exactly on the boundary
  eq(O.stateAt(p(22 * 60 + 59, 3), def), "free", "22:59 → still free");
  eq(O.stateAt(p(23 * 60, 3), def), "sleep", "23:00 sharp → asleep");
  eq(O.stateAt(p(0, 3), def), "sleep", "00:00 → asleep (wrapped)");
  eq(O.stateAt(p(6 * 60 + 59, 3), def), "sleep", "06:59 → asleep");
  eq(O.stateAt(p(7 * 60, 6), def), "free", "07:00 sharp → awake");

  // Degenerate configs must not crash and must stay self-consistent:
  // every track's segments must cover exactly 1440 minutes, windows must sum
  // to overlapMinutes, and overlap can't exceed either side's free time.
  const configs = [
    ["all-day awake (sleep 00:00–00:00, busy never)", schedNone(), schedNone()],
    ["busy the whole clock (00:00–23:59 every day)", { sleepStart: 0, sleepEnd: 0, busyStart: 0, busyEnd: 1439, busyDays: [0, 1, 2, 3, 4, 5, 6] }, schedNone()],
    ["sleep 12h + busy the other 12h → zero free", { sleepStart: 0, sleepEnd: 720, busyStart: 720, busyEnd: 0, busyDays: [0, 1, 2, 3, 4, 5, 6] }, O.defaultSched()],
    ["empty sleep at noon (12:00–12:00) + default busy", { sleepStart: 720, sleepEnd: 720, busyStart: 540, busyEnd: 1080, busyDays: [1, 2, 3, 4, 5] }, O.defaultSched()],
    ["overnight busy vs overnight sleep", { sleepStart: 300, sleepEnd: 780, busyStart: 1320, busyEnd: 360, busyDays: [0, 1, 2, 3, 4, 5, 6] }, { sleepStart: 1380, sleepEnd: 420, busyStart: 540, busyEnd: 1080, busyDays: [1, 2, 3, 4, 5] }]
  ];
  for (const [label, sa, sb] of configs) {
    const day = O.computeDay(JAN.getTime(), "Asia/Kathmandu", "Europe/London", sa, sb);
    const sumA = day.segsA.reduce((s, g) => s + (g.i1 - g.i0 + 1) * 15, 0);
    const sumB = day.segsB.reduce((s, g) => s + (g.i1 - g.i0 + 1) * 15, 0);
    const winSum = day.windows.reduce((s, w) => s + w.minutes, 0);
    const freeA = day.samples.filter((s) => s.sa === "free").length * 15;
    const freeB = day.samples.filter((s) => s.sb === "free").length * 15;
    check(
      sumA === 1440 && sumB === 1440 && winSum === day.overlapMinutes && day.overlapMinutes <= Math.min(freeA, freeB),
      label + " — segments cover 1440/1440, windows sum " + winSum + " = overlap " + day.overlapMinutes + " ≤ free " + Math.min(freeA, freeB)
    );
  }
  const dead = O.computeDay(JAN.getTime(), "Asia/Kathmandu", "Europe/London", { sleepStart: 0, sleepEnd: 720, busyStart: 720, busyEnd: 0, busyDays: [0, 1, 2, 3, 4, 5, 6] }, O.defaultSched());
  eq(dead.overlapMinutes, 0, "zero-free schedule really yields 0 overlap");
  eq(dead.windows.length, 0, "…and no windows");
  eq(O.tierFor(0).id, "zero", "…and the zero-tier line");

  // tier fence-posts
  eq(O.tierFor(59).id, "thin", "59m → thin");
  eq(O.tierFor(60).id, "enough", "60m → enough");
  eq(O.tierFor(179).id, "enough", "179m → enough");
  eq(O.tierFor(180).id, "solid", "180m → solid");
  eq(O.tierFor(359).id, "solid", "359m → solid");
  eq(O.tierFor(360).id, "wide", "360m → wide");
  // naming bucket fence-posts
  for (const [h, g] of [[4, "N"], [5, "M"], [11, "M"], [12, "D"], [17, "D"], [18, "E"], [20, "E"], [21, "N"], [23, "N"], [0, "N"]]) {
    eq(O.bucketGroup(h), g, "bucketGroup(" + h + ") = " + g);
  }
}

/* =========================================================== Playwright */
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function newPage(opts = {}, init = null) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

/* ==================== 6. deep links ==================== */
{
  console.log("== qa 6: deep links ==");
  const { ctx, page, errors } = await newPage();
  await page.goto(URL);
  check(await page.isVisible("#empty"), "fresh visit: empty state shows");
  check(await page.isHidden("#result"), "fresh visit: result hidden");
  await page.screenshot({ path: path.join(SHOTS, "qa-empty.png") });

  await page.goto(URL + "#london/tokyo");
  await page.reload(); // hard load with the hash, not a hashchange
  await page.waitForSelector("#result:not([hidden])");
  eq(await page.inputValue("#cityA"), "London", "#london/tokyo fills YOU = London");
  eq(await page.inputValue("#cityB"), "Tokyo", "#london/tokyo fills THEM = Tokyo");
  const off = (await page.textContent("#offsetLine")).trim();
  check(/^Tokyo runs \d+h( \d+m)? ahead\.$/.test(off), `offset headline sane (got “${off}”)`);
  check((await page.locator("#bandBox svg rect.seg").count()) >= 4, "band renders");
  await page.screenshot({ path: path.join(SHOTS, "qa-result-desktop.png"), fullPage: true });
  await page.locator("#countdown").screenshot({ path: path.join(SHOTS, "qa-countdown.png") });

  // share card: dump the actual PNG for eyeballing
  const dataUrl = await page.evaluate(() => Overlap.ui.renderShareCard().toDataURL("image/png"));
  fs.writeFileSync(path.join(SHOTS, "qa-sharecard.png"), Buffer.from(dataUrl.split(",")[1], "base64"));
  check(dataUrl.length > 50000, "share card PNG non-trivial");

  check(errors.length === 0, "zero console errors (deep link)" + (errors.length ? " — " + errors.join(" | ") : ""));
  await ctx.close();
}
{
  const { ctx, page, errors } = await newPage();
  await page.goto(URL + "#atlantis/el-dorado");
  await page.waitForTimeout(300);
  check(await page.isVisible("#empty"), "#atlantis/el-dorado: graceful empty state");
  check(await page.isHidden("#result"), "…result stays hidden");
  const { ctx: c2, page: p2, errors: e2 } = await newPage();
  await p2.goto(URL + "#London/Tokyo"); // wrong case = no match by design
  await p2.waitForTimeout(300);
  check(await p2.isVisible("#empty"), "#London/Tokyo (bad case): graceful empty state");
  check(errors.length === 0 && e2.length === 0, "zero console errors on bad hashes");
  await ctx.close();
  await c2.close();
}

/* ==================== 7. odometer abuse ==================== */
{
  console.log("== qa 7: odometer abuse ==");
  const { ctx, page, errors } = await newPage({}, () => {
    try {
      localStorage.setItem("overlap:v1:meter:london~tokyo", '{"v":1,"ms":-99999999,"met":null}');
      localStorage.setItem("overlap:v1:meter:paris~seoul", '{"v":1,"ms":1e12,"met":null}');
      localStorage.setItem("overlap:v1:meter:new-york~tokyo", '{"v":1,"ms":{"evil":true},"met":"NaN-13-99"}');
      localStorage.setItem("overlap:v1:meter:berlin~madrid", '{"v":1,"ms":3600000,"met":"2999-01-01"}');
    } catch (e) { /* ignore */ }
  });
  const readMeter = async () => (await page.textContent("#meterNum")).trim() + "|" + (await page.textContent("#meterMin")).trim();

  await page.goto(URL + "#london/tokyo");
  await page.waitForSelector("#result:not([hidden])");
  eq(await readMeter(), "0|00", "negative ms → clamped to 0");

  await page.goto(URL + "#paris/seoul");
  await page.waitForSelector("#result:not([hidden])");
  eq(await readMeter(), "0|00", "ms = 1e12 (≈31.7 years) → rejected as impossible, reads 0");

  await page.goto(URL + "#new-york/tokyo");
  await page.waitForSelector("#result:not([hidden])");
  eq(await readMeter(), "0|00", "ms as object + garbage met → clean 0");

  await page.goto(URL + "#berlin/madrid");
  await page.waitForSelector("#result:not([hidden])");
  eq(await readMeter(), "1|00", "future met date dropped, honest 1h of ms kept");
  const cap = (await page.textContent("#meterSub")).trim();
  check(!cap.includes("2999"), `caption never claims “since 2999” (got “${cap}”)`);

  // clock rollback: pretend the last tick came from the future
  const before = await page.evaluate(() => Overlap.ui.state.meter.ms);
  await page.evaluate(() => { Overlap.ui.state.lastTickMs = Date.now() + 3600000; });
  await page.waitForTimeout(2600);
  const after = await page.evaluate(() => Overlap.ui.state.meter.ms);
  check(Number.isFinite(after) && after >= before && after >= 0, `clock rollback: meter never decreases (${before} → ${after})`);
  check(/^[\d,]+$/.test((await page.textContent("#meterNum")).trim()), "meter display still a clean number after rollback");
  check(errors.length === 0, "zero console errors through all odometer abuse" + (errors.length ? " — " + errors.join(" | ") : ""));
  await ctx.close();
}

/* ==================== 8. live accrual + open-window state ==================== */
{
  console.log("== qa 8: live accrual while both free ==");
  const { ctx, page, errors } = await newPage();
  await page.goto(URL);
  // find a city whose local time is free right now; pair it with itself
  const id = await page.evaluate(() => {
    const now = new Date();
    const c = CITIES.find((c) => Overlap.stateAt(Overlap.localParts(now, c.z), Overlap.defaultSched()) === "free");
    return c ? c.id : null;
  });
  check(!!id, "found a city that is free right now (" + id + ")");
  await page.goto(URL + "#" + id + "/" + id);
  await page.waitForSelector("#result:not([hidden])");
  const cd = (await page.textContent("#countdown")).trim();
  check(/the window is open — closes in/.test(cd), `countdown shows the open state (got “${cd}”)`);
  check(await page.locator("#meterDot.on").isVisible(), "meter dot glows while both are free");
  const ms0 = await page.evaluate(() => Overlap.ui.state.meter.ms);
  await page.waitForTimeout(2400);
  const ms1 = await page.evaluate(() => Overlap.ui.state.meter.ms);
  check(ms1 - ms0 > 1000 && ms1 - ms0 < 10000, `meter accrues real time while open (${ms0} → ${ms1})`);
  const heroFirst = await page.evaluate(() => {
    const first = document.getElementById("windowsBox").firstElementChild;
    return !!first && first.classList.contains("main");
  });
  check(heroFirst, "the named hero window is listed first, smaller windows after");
  await page.screenshot({ path: path.join(SHOTS, "qa-open.png"), fullPage: true });
  check(errors.length === 0, "zero console errors (accrual)");
  await ctx.close();
}

/* ==================== 9. zero-overlap state, driven through the UI ==================== */
{
  console.log("== qa 9: zero overlap through the UI ==");
  const { ctx, page, errors } = await newPage();
  await page.goto(URL + "#london/tokyo");
  await page.waitForSelector("#result:not([hidden])");
  await page.click(".picker:has(#cityA) .sched summary");
  await page.fill("#sleepStartA", "00:00");
  await page.fill("#sleepEndA", "12:00");
  await page.fill("#busyStartA", "12:00");
  await page.fill("#busyEndA", "00:00");
  await page.selectOption("#busyDaysA", "everyday");
  eq((await page.textContent("#verdictNum")).trim(), "0m", "sleep 12h + busy 12h → verdict 0m");
  const tier = (await page.textContent("#tierLine")).trim();
  check(tier.startsWith("No shared free hour"), `zero tier line (got “${tier}”)`);
  check((await page.textContent("#windowsBox")).includes("Nothing lines up"), "windows box explains the empty day");
  check((await page.textContent("#countdown")).includes("no shared window"), "countdown says no window");
  await page.screenshot({ path: path.join(SHOTS, "qa-zero.png"), fullPage: true });
  check(errors.length === 0, "zero console errors (zero overlap)");
  await ctx.close();
}

/* ==================== 10. mobile with a fractional zone ==================== */
{
  console.log("== qa 10: 375px with Kathmandu's :45 clock ==");
  const { ctx, page, errors } = await newPage({ viewport: { width: 375, height: 667 } });
  await page.goto(URL + "#london/kathmandu");
  await page.waitForSelector("#result:not([hidden])");
  const scrollW = await page.evaluate(() => document.scrollingElement.scrollWidth);
  check(scrollW <= 375, `no horizontal page scroll (${scrollW})`);
  const off = (await page.textContent("#offsetLine")).trim();
  check(/Kathmandu runs \d+h 45m ahead\./.test(off), `fractional offset headline (got “${off}”)`);
  await page.screenshot({ path: path.join(SHOTS, "qa-mobile.png"), fullPage: true });
  check(errors.length === 0, "zero console errors (mobile)");
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nALL GREEN (qa-extra.mjs)" : "\n" + failures + " FAILURE(S) (qa-extra.mjs)");
process.exit(failures === 0 ? 0 : 1);
