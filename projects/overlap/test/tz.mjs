// Overlap — algorithm tests, run directly under Node (no browser):
//   node projects/overlap/test/tz.mjs
// Verifies the Intl-based zone math on fixed injected instants, so results are
// deterministic regardless of when or where the test machine runs.
import "../cities.js";
import "../app.js";

const O = globalThis.Overlap;
const CITIES = globalThis.CITIES;

let failures = 0;
function check(cond, msg) {
  console.log((cond ? "  ok    " : "  FAIL  ") + msg);
  if (!cond) failures++;
}
function eq(got, want, msg) {
  check(got === want, msg + " (want " + want + ", got " + got + ")");
}

function schedNone() {
  // no sleep, no busy → free 24/7
  return { sleepStart: 0, sleepEnd: 0, busyStart: 0, busyEnd: 0, busyDays: [] };
}
function awakeOnly(startMin, endMin) {
  // free only inside [start, end): sleep covers the rest of the clock
  return { sleepStart: endMin, sleepEnd: startMin, busyStart: 0, busyEnd: 0, busyDays: [] };
}

/* ---------------------------------------------------- 1. NYC ↔ London DST */
console.log("== NYC ↔ London: the 5h/4h DST story ==");
{
  const NY = "America/New_York";
  const LON = "Europe/London";
  // Mid-January: both on standard time → 5 hours apart.
  const jan = new Date("2026-01-15T15:00:00Z");
  eq(O.zoneOffsetMinutes(jan, LON) - O.zoneOffsetMinutes(jan, NY), 300, "January: London 5h ahead of NYC");
  // 2026-03-20: US already on DST (Mar 8), UK not yet (Mar 29) → 4 hours apart.
  const gap = new Date("2026-03-20T15:00:00Z");
  eq(O.zoneOffsetMinutes(gap, LON) - O.zoneOffsetMinutes(gap, NY), 240, "March 20 (DST mismatch window): 4h apart");
  // Mid-July: both on DST → back to 5.
  const jul = new Date("2026-07-15T15:00:00Z");
  eq(O.zoneOffsetMinutes(jul, LON) - O.zoneOffsetMinutes(jul, NY), 300, "July: back to 5h apart");

  // And it must show up in the overlap itself:
  // A is free only 09:00–12:00 NYC; B is free only 14:00–17:00 London.
  const a = awakeOnly(9 * 60, 12 * 60);
  const b = awakeOnly(14 * 60, 17 * 60);
  eq(O.computeDay(jan.getTime(), NY, LON, a, b).overlapMinutes, 180, "January: 09–12 NYC == 14–17 London → 3h overlap");
  eq(O.computeDay(gap.getTime(), NY, LON, a, b).overlapMinutes, 120, "March 20: windows slide 1h apart → 2h overlap");
  eq(O.computeDay(jul.getTime(), NY, LON, a, b).overlapMinutes, 180, "July: 3h overlap again");
}

/* ------------------------------------------------- 2. Tokyo ↔ LA dateline */
console.log("== Tokyo ↔ LA: across the date line ==");
{
  const TYO = "Asia/Tokyo";
  const LA = "America/Los_Angeles";
  const t = new Date("2026-06-01T05:00:00Z");
  const pT = O.localParts(t, TYO);
  const pL = O.localParts(t, LA);
  check(pT.d === 1 && pT.mo === 6, "Tokyo is already June 1 (got " + pT.mo + "/" + pT.d + ")");
  check(pL.d === 31 && pL.mo === 5, "LA is still May 31 (got " + pL.mo + "/" + pL.d + ")");
  eq(pT.hh, 14, "Tokyo wall clock 14:00");
  eq(pL.hh, 22, "LA wall clock 22:00");
  eq(O.zoneOffsetMinutes(t, TYO) - O.zoneOffsetMinutes(t, LA), 960, "16h apart in northern summer (JST vs PDT)");
  // Weekday must differ across the line: Tokyo Monday (busy at 14:00 with
  // defaults), LA still Sunday evening (free at 22:00).
  eq(pT.dow, 1, "Tokyo weekday is Monday");
  eq(pL.dow, 0, "LA weekday is Sunday");
  eq(O.stateAt(pT, O.defaultSched()), "busy", "Tokyo person is busy (Monday 14:00)");
  eq(O.stateAt(pL, O.defaultSched()), "free", "LA person is free (Sunday 22:00)");

  const day = O.computeDay(t.getTime(), TYO, LA, O.defaultSched(), O.defaultSched());
  check(Number.isFinite(day.overlapMinutes), "overlap computes to a finite number");
  const winter = new Date("2026-01-15T05:00:00Z");
  eq(O.zoneOffsetMinutes(winter, TYO) - O.zoneOffsetMinutes(winter, LA), 1020, "17h apart in northern winter (JST vs PST)");
}

/* ------------------------------------------------------- 3. same city */
console.log("== Same city: identical clocks ==");
{
  const TYO = "Asia/Tokyo";
  const t = Date.parse("2026-04-10T00:00:00Z");
  const free = O.computeDay(t, TYO, TYO, schedNone(), schedNone());
  eq(free.overlapMinutes, 1440, "no sleep, no busy → all 24h overlap");
  eq(free.windows.length, 1, "…as a single continuous window");
  eq(free.windows[0].minutes, 1440, "…of 1440 minutes");

  const def = O.computeDay(t, TYO, TYO, O.defaultSched(), O.defaultSched());
  check(JSON.stringify(def.segsA) === JSON.stringify(def.segsB), "default schedules → the two tracks are identical");
  const freeMin = def.samples.filter((s) => s.sa === "free").length * 15;
  eq(def.overlapMinutes, freeMin, "overlap equals one person's free time exactly");
}

/* ----------------------------------------- 4. Auckland ↔ Honolulu extreme */
console.log("== Auckland ↔ Honolulu: the 23-hour pair ==");
{
  const AKL = "Pacific/Auckland";
  const HNL = "Pacific/Honolulu";
  const jan = new Date("2026-01-15T00:00:00Z");
  eq(O.zoneOffsetMinutes(jan, AKL) - O.zoneOffsetMinutes(jan, HNL), 1380, "January: NZDT vs HST = 23h apart");
  const jul = new Date("2026-07-15T00:00:00Z");
  eq(O.zoneOffsetMinutes(jul, AKL) - O.zoneOffsetMinutes(jul, HNL), 1320, "July: NZST vs HST = 22h apart");
  for (const when of [jan, jul]) {
    const day = O.computeDay(when.getTime(), AKL, HNL, O.defaultSched(), O.defaultSched());
    eq(day.samples.length, 96, "96 samples at " + when.toISOString());
    check(Number.isFinite(day.overlapMinutes) && day.overlapMinutes >= 0 && day.overlapMinutes <= 1440, "overlap in [0,1440]");
    const sum = day.windows.reduce((s, w) => s + w.minutes, 0);
    eq(sum, day.overlapMinutes, "window durations sum to the total");
    check(day.samples.every((s) => ["sleep", "busy", "free"].includes(s.sa) && ["sleep", "busy", "free"].includes(s.sb)), "every sample has a valid state");
  }
  // 23h apart means wall clocks nearly agree: Auckland 12:00 ≈ Honolulu 13:00 the day before.
  const noonAkl = new Date("2026-01-15T23:00:00Z"); // Auckland Jan 16 12:00 NZDT
  eq(O.localParts(noonAkl, AKL).hh, 12, "Auckland shows 12:00");
  eq(O.localParts(noonAkl, HNL).hh, 13, "Honolulu shows 13:00 (previous day)");
  check(O.localParts(noonAkl, HNL).d === 15 && O.localParts(noonAkl, AKL).d === 16, "…and one calendar day behind");
}

/* -------------------------------------------------- 5. schedule mechanics */
console.log("== Schedule edge cases ==");
{
  const p = (min, dow) => ({ minutes: min, hh: Math.floor(min / 60), mm: min % 60, dow });
  const s = O.defaultSched();
  eq(O.stateAt(p(23 * 60 + 30, 2), s), "sleep", "23:30 → asleep (wrap span start side)");
  eq(O.stateAt(p(6 * 60, 2), s), "sleep", "06:00 → asleep (wrap span end side)");
  eq(O.stateAt(p(8 * 60, 2), s), "free", "08:00 Tuesday → free before work");
  eq(O.stateAt(p(10 * 60, 2), s), "busy", "10:00 Tuesday → busy");
  eq(O.stateAt(p(10 * 60, 6), s), "free", "10:00 Saturday → free (weekdays only)");
  const night = { sleepStart: 0, sleepEnd: 0, busyStart: 22 * 60, busyEnd: 6 * 60, busyDays: [5] };
  eq(O.stateAt(p(23 * 60, 5), night), "busy", "Fri 23:00 → busy (night shift starts Friday)");
  eq(O.stateAt(p(3 * 60, 6), night), "busy", "Sat 03:00 → still Friday's night shift");
  eq(O.stateAt(p(3 * 60, 5), night), "free", "Fri 03:00 → not busy (Thursday didn't start one)");
  // sleep wins over busy
  const clash = { sleepStart: 9 * 60, sleepEnd: 17 * 60, busyStart: 9 * 60, busyEnd: 18 * 60, busyDays: [1, 2, 3, 4, 5] };
  eq(O.stateAt(p(10 * 60, 3), clash), "sleep", "overlapping sleep+busy → sleep wins");
}

/* ------------------------------------------------------ 6. naming & copy */
console.log("== Window naming & verdict copy ==");
{
  // Build a synthetic window and name it via real zones: 21:30 NYC == 02:30 London (winter)
  const start = Date.parse("2026-01-16T02:00:00Z"); // NYC 21:00 Jan 15
  const win = { start, end: start + 60 * 60000 };
  eq(O.windowName(win, "America/New_York", "Europe/London"), "the goodnight window", "NYC evening × London night → the goodnight window");
  const morning = Date.parse("2026-01-15T14:00:00Z"); // NYC 09:00, London 14:00
  eq(
    O.windowName({ start: morning, end: morning + 30 * 60000 }, "America/New_York", "America/New_York"),
    "morning coffee together",
    "both mid-morning → morning coffee together"
  );
  eq(O.tierFor(0).id, "zero", "0m → zero tier");
  eq(O.tierFor(45).id, "thin", "45m → thin tier");
  eq(O.tierFor(167).id, "enough", "2h 47m → enough tier");
  eq(O.tierFor(240).id, "solid", "4h → solid tier");
  eq(O.tierFor(500).id, "wide", "8h+ → wide tier");
  eq(O.fmtDur(167), "2h 47m", "fmtDur 167 → 2h 47m");
  eq(O.fmtDur(60), "1h", "fmtDur 60 → 1h");
  eq(O.fmtDur(45), "45m", "fmtDur 45 → 45m");
  eq(O.fmtDur(1440), "24h", "fmtDur 1440 → 24h");
  check(Object.keys(O.PAIR_NAMES).length === 16, "all 16 bucket pairs have names");
}

/* ------------------------------------------------------- 7. city table */
console.log("== City table ==");
{
  check(CITIES.length >= 300, "table has ≥300 cities (" + CITIES.length + ")");
  let badZone = null;
  let badField = null;
  const ids = new Set();
  for (const c of CITIES) {
    if (!c.n || !c.z || !c.h || !c.c) badField = c;
    try {
      O.localParts(new Date(), c.z);
    } catch (e) {
      badZone = c;
    }
    ids.add(c.id);
  }
  check(!badField, "every city has name, country, zone and 中文名" + (badField ? " (bad: " + JSON.stringify(badField) + ")" : ""));
  check(!badZone, "every IANA zone resolves through Intl" + (badZone ? " (bad: " + badZone.n + " → " + badZone.z + ")" : ""));
  eq(ids.size, CITIES.length, "ids are unique");

  eq(O.searchCities("东京")[0]?.n, "Tokyo", "「东京」 finds Tokyo");
  eq(O.searchCities("nyc")[0]?.n, "New York", "「nyc」 finds New York");
  eq(O.searchCities("三藩市")[0]?.n, "San Francisco", "「三藩市」 finds San Francisco");
  eq(O.searchCities("saigon")[0]?.n, "Ho Chi Minh City", "「saigon」 finds Ho Chi Minh City");
  eq(O.searchCities("são")[0]?.n, "Sao Paulo", "「são」 (diacritics) finds Sao Paulo");
  eq(O.searchCities("london")[0]?.n, "London", "「london」 exact");
  check(O.searchCities("shen").some((c) => c.n === "Shenzhen"), "「shen」 reaches Shenzhen");
  eq(O.searchCities("zzzznope").length, 0, "garbage query → no results, no crash");
  eq(O.searchCities("").length, 0, "empty query → empty");
}

/* ---------------------------------------------------------------- done */
console.log(failures === 0 ? "\nALL GREEN (tz.mjs)" : "\n" + failures + " FAILURE(S) (tz.mjs)");
process.exit(failures === 0 ? 0 : 1);
