/* Word Age — dataset + build-product assertions. Run: node projects/word-age/test/data.mjs */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = require(path.join(ROOT, "data.js"));
const FUN = require(path.join(ROOT, "funfacts.js"));
const Lib = require(path.join(ROOT, "lib.js"));

let failures = 0;
function ok(cond, msg) {
  if (cond) return;
  failures++;
  console.error("FAIL:", msg);
}

const words = DATA.WORDS;
const anchors = DATA.ANCHORS;

// ---- dataset shape ----------------------------------------------------------
ok(words.length >= 260, `dataset has >= 260 words (got ${words.length})`);
ok(anchors.length >= 24, `anchor library has >= 24 anchors (got ${anchors.length})`);

const seen = new Set();
for (const w of words) {
  ok(typeof w.w === "string" && /^[a-z][a-z-]*$/.test(w.w), `slug ok: ${w.w}`);
  ok(!seen.has(w.w), `no duplicate word: ${w.w}`);
  seen.add(w.w);
  ok(Number.isInteger(w.y) && w.y >= 600 && w.y <= 2020, `year in 600–2020: ${w.w} (${w.y})`);
  ok(typeof w.d === "string" && w.d.length > 0, `display year non-empty: ${w.w}`);
  ok(typeof w.orig === "string" && w.orig.length > 3, `orig meaning non-empty: ${w.w}`);
  ok(typeof w.shift === "string" && w.shift.length > 20, `shift note non-empty: ${w.w}`);
  ok(w.v === "older" || w.v === "younger", `verdict older/younger: ${w.w}`);
  ok(!/\bposh\b|\bgolf\b.*acronym|sine cera(?!.*(myth|false))/i.test(w.shift), `no folk etymology asserted: ${w.w}`);
}
for (const a of anchors) {
  ok(Number.isInteger(a.y) && a.y > 600 && a.y <= 2020, `anchor year sane: ${a.n}`);
  ok(typeof a.n === "string" && a.n.length > 2, `anchor name: ${a.n}`);
  ok([1, 2, 3].includes(a.f), `anchor fame 1–3: ${a.n}`);
}
for (const k of Object.keys(FUN)) ok(seen.has(k), `funfact key exists in dataset: ${k}`);

// spec-critical words must be present and correctly characterized
const mustHave = { nice: 1300, silly: 900, girl: 1300, awful: 1300, meat: 900, clue: 1595, deer: 900, starve: 900 };
for (const [w, y] of Object.entries(mustHave)) {
  const e = words.find((x) => x.w === w);
  ok(e, `spec word present: ${w}`);
  if (e) ok(e.y === y, `spec word year: ${w} = ${y} (got ${e.y})`);
}

// anchor engine sanity: the canonical example from the spec
const niceLine = Lib.anchorLine("nice", 1300, anchors);
ok(/older than .+ by \d+ years/.test(niceLine), `anchor line grammar: "${niceLine}"`);
for (const w of words) {
  const line = Lib.anchorLine(w.w, w.y, anchors);
  ok(/^(older|younger) than .+ by \d+ years?$|^exactly as old as .+$/.test(line), `anchor line valid for ${w.w}: "${line}"`);
}

// ---- build products ---------------------------------------------------------
const wordsDir = path.join(ROOT, "words");
const pages = fs.readdirSync(wordsDir).filter((f) => f.endsWith(".html") && f !== "index.html");
ok(pages.length === words.length, `word pages == dataset size (${pages.length} vs ${words.length})`);
ok(fs.existsSync(path.join(wordsDir, "index.html")), "catalogue page exists");

for (const w of words) {
  const p = path.join(wordsDir, `${w.w}.html`);
  ok(fs.existsSync(p), `page exists: ${w.w}`);
  if (!fs.existsSync(p)) continue;
  const html = fs.readFileSync(p, "utf8");
  ok(html.includes(`<title>How old is the word “${w.w}”?`), `title has word: ${w.w}`);
  ok(html.includes('rel="canonical"'), `canonical: ${w.w}`);
  ok(html.includes('property="og:title"'), `og tags: ${w.w}`);
  ok(html.includes('name="description"'), `meta description: ${w.w}`);
  const relLinks = (html.match(/<li><a href="[a-z-]+\.html">/g) || []).length;
  ok(relLinks >= 4, `>= 4 related links: ${w.w} (got ${relLinks})`);
  ok(html.includes('href="../index.html"'), `home link: ${w.w}`);
  ok(html.includes("window.WORD_PAGE="), `inline entry: ${w.w}`);
}

// sitemap: one URL per page + homepage + catalogue
const sm = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const locs = sm.match(/<loc>/g) || [];
ok(locs.length === words.length + 2, `sitemap urls == words + 2 (${locs.length} vs ${words.length + 2})`);
for (const w of words) ok(sm.includes(`/words/${w.w}.html</loc>`), `sitemap has ${w.w}`);
ok(fs.existsSync(path.join(ROOT, "robots.txt")), "robots.txt exists");

// ---- page-weight red line (QUALITY_BRIEF: < 150KB per page, excl. screenshots)
const homeBytes = ["index.html", "style.css", "app.js", "lib.js", "data.js"]
  .map((f) => fs.statSync(path.join(ROOT, f)).size)
  .reduce((a, b) => a + b, 0);
ok(homeBytes < 150 * 1024, `homepage payload < 150KB (got ${(homeBytes / 1024).toFixed(1)}KB)`);
const nicePage = ["words/nice.html", "style.css", "app.js", "lib.js"]
  .map((f) => fs.statSync(path.join(ROOT, f)).size)
  .reduce((a, b) => a + b, 0);
ok(nicePage < 150 * 1024, `word page payload < 150KB (got ${(nicePage / 1024).toFixed(1)}KB)`);

// ---- word of the day determinism across a day boundary ----------------------
const i1 = Lib.wotdIndex(words.length, Date.UTC(2026, 6, 4, 12));
const i2 = Lib.wotdIndex(words.length, Date.UTC(2026, 6, 4, 23, 59));
const i3 = Lib.wotdIndex(words.length, Date.UTC(2026, 6, 5, 0, 1));
ok(i1 === i2, "wotd stable within a day (UTC clock)");
ok(typeof i3 === "number" && i3 >= 0 && i3 < words.length, "wotd index in range after midnight");

if (failures) {
  console.error(`\ndata.mjs: ${failures} failure(s)`);
  process.exit(1);
}
console.log(`data.mjs: all assertions passed — ${words.length} words, ${anchors.length} anchors, ${pages.length} pages, ${locs.length} sitemap urls, homepage ${(homeBytes / 1024).toFixed(1)}KB`);
