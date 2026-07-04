#!/usr/bin/env node
/* At Your Age — static SEO build.
   Generates: people/<slug>.html (one per person), people/index.html (ledger),
   sitemap.xml, robots.txt. Run: node build.js  (from this directory or anywhere) */
"use strict";

const fs = require("fs");
const path = require("path");
const { MILESTONES, DOMAIN } = require(path.join(__dirname, "data.js"));

const BASE_URL = "https://" + DOMAIN;
const ROOT = __dirname;
const PEOPLE_DIR = path.join(ROOT, "people");

function slugify(name) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------ group data */
const people = new Map(); // person -> { person, short, p, slug, entries: [] }
for (const m of MILESTONES) {
  if (!people.has(m.person)) {
    people.set(m.person, { person: m.person, short: m.short, p: m.p, slug: slugify(m.person), entries: [] });
  }
  people.get(m.person).entries.push(m);
}
for (const p of people.values()) {
  p.entries.sort((a, b) => a.age - b.age);
}

// guard against slug collisions (two different people, same slug)
const seenSlugs = new Map();
for (const p of people.values()) {
  if (seenSlugs.has(p.slug)) {
    throw new Error("Slug collision: " + p.person + " vs " + seenSlugs.get(p.slug));
  }
  seenSlugs.set(p.slug, p.person);
}

/* ------------------------------------------------------------- template */
const PAGE_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
background:#fff;color:#111;line-height:1.5}
.wrap{max-width:760px;margin:0 auto;padding:0 20px}
.mast{border-bottom:2px solid #111;padding:14px 0 10px;display:flex;justify-content:space-between;align-items:baseline}
.mast a{color:#111;text-decoration:none;font-weight:800;letter-spacing:.14em;font-size:14px}
.mast span{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.65}
h1{font-size:clamp(30px,6vw,52px);line-height:1.05;font-weight:800;letter-spacing:-.03em;margin:48px 0 12px}
.lede{opacity:.85;max-width:56ch}
.band{width:128px;height:14px;margin:28px 0}
.band.roast{background:#e0332b}.band.heal{background:#2e7d4f}
ol{list-style:none;margin:8px 0 48px}
li{border-top:1px solid #111;padding:16px 0;display:flex;gap:20px;align-items:baseline}
.age{font-variant-numeric:tabular-nums;font-weight:800;font-size:30px;min-width:2.4ch;letter-spacing:-.02em}
.what{font-size:17px}
.yr{font-size:12px;opacity:.6;font-variant-numeric:tabular-nums;margin-left:8px;white-space:nowrap}
.tag{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
padding:2px 7px;margin-left:10px;color:#fff;vertical-align:2px}
.tag.roast{background:#e0332b}.tag.heal{background:#2e7d4f}
.cta{border:2px solid #111;padding:24px;margin:0 0 56px}
.cta p{font-size:18px;font-weight:650;letter-spacing:-.01em}
.cta a{display:inline-block;margin-top:14px;background:#111;color:#fff;text-decoration:none;
font-weight:700;font-size:13px;letter-spacing:.12em;text-transform:uppercase;padding:14px 22px}
.cta a:hover{background:#e0332b}
footer{border-top:2px solid #111;padding:12px 0 32px;font-size:12px;opacity:.75}
footer a{color:#111;text-decoration-color:#e0332b;text-decoration-thickness:2px}
.cols{columns:2;column-gap:32px;margin:24px 0 48px}
.cols a{display:block;color:#111;text-decoration:none;border-top:1px solid #111;padding:10px 0;font-size:15px}
.cols a:hover{color:#e0332b}
.cols small{opacity:.6;font-variant-numeric:tabular-nums}
@media(max-width:560px){.cols{columns:1}}
`.trim();

function pageShell({ title, desc, canonical, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<link rel="canonical" href="${canonical}">
<style>${PAGE_CSS}</style>
</head>
<body>
<header class="mast wrap"><a href="../index.html">AT YOUR AGE.</a><span>the ledger</span></header>
<main class="wrap">
${body}
</main>
<footer><div class="wrap">Ages computed from public birth and event dates.
&middot; <a href="index.html">full ledger</a> &middot; <a href="../index.html">check your own age</a></div></footer>
</body>
</html>
`;
}

function personPage(p) {
  const maxAge = p.entries[p.entries.length - 1].age;
  const first = p.entries[0];
  const title = `What had ${p.person} done by age ${maxAge}? — At Your Age`;
  const desc = `${p.person} ${first.event} at ${first.age}. Every ${p.short} milestone by age, ` +
    `next to a calculator that measures your own age against it — to the day.`;
  const items = p.entries.map((m) =>
    `<li><span class="age">${m.age}</span><span class="what">${esc(cap(m.event))}.` +
    `<span class="yr">${esc(m.year)}</span><span class="tag ${m.mode}">${m.mode}</span></span></li>`
  ).join("\n");
  const bandMode = p.entries.filter(e => e.mode === "heal").length >= p.entries.length / 2 ? "heal" : "roast";
  const body = `
<h1>What had ${esc(p.person)} done by&nbsp;${maxAge}?</h1>
<p class="lede">${p.entries.length === 1 ? "One receipt" : p.entries.length + " receipts"} on file,
sorted by age at the moment it happened.</p>
<div class="band ${bandMode}"></div>
<ol>
${items}
</ol>
<div class="cta">
<p>And you? Same calendar, same 24 hours.</p>
<a href="../index.html">Measure your age against ${esc(p.short)} &#8594;</a>
</div>`;
  return pageShell({
    title,
    desc,
    canonical: `${BASE_URL}/people/${p.slug}.html`,
    body
  });
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function ledgerPage(list) {
  const links = list
    .slice()
    .sort((a, b) => a.person.localeCompare(b.person))
    .map((p) => {
      const ages = p.entries.map(e => e.age);
      const range = ages.length > 1 ? `ages ${ages[0]}–${ages[ages.length - 1]}` : `age ${ages[0]}`;
      return `<a href="${p.slug}.html">${esc(p.person)} <small>· ${range}</small></a>`;
    }).join("\n");
  const body = `
<h1>The full ledger.</h1>
<p class="lede">${list.length} people, ${MILESTONES.length} receipts. Early bloomers sting,
late bloomers soothe. Pick a name, see everything they had done by any given age.</p>
<div class="band roast"></div>
<div class="cols">
${links}
</div>
<div class="cta">
<p>The comparison only hurts with your own number in it.</p>
<a href="../index.html">Enter your birthday &#8594;</a>
</div>`;
  return pageShell({
    title: "The full ledger — every person on At Your Age",
    desc: `All ${list.length} people in the At Your Age dataset: what Mozart, Grandma Moses, Colonel Sanders and ${list.length - 3} others had done at every age.`,
    canonical: `${BASE_URL}/people/index.html`,
    body
  });
}

/* ---------------------------------------------------------------- write */
// clean stale person pages, keep directory
if (fs.existsSync(PEOPLE_DIR)) {
  for (const f of fs.readdirSync(PEOPLE_DIR)) {
    if (f.endsWith(".html")) fs.unlinkSync(path.join(PEOPLE_DIR, f));
  }
} else {
  fs.mkdirSync(PEOPLE_DIR, { recursive: true });
}

const list = [...people.values()];
for (const p of list) {
  fs.writeFileSync(path.join(PEOPLE_DIR, p.slug + ".html"), personPage(p));
}
fs.writeFileSync(path.join(PEOPLE_DIR, "index.html"), ledgerPage(list));

const today = new Date().toISOString().slice(0, 10);
const urls = [
  `${BASE_URL}/`,
  `${BASE_URL}/people/index.html`,
  ...list.map((p) => `${BASE_URL}/people/${p.slug}.html`)
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(ROOT, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`);

console.log(`build: ${list.length} person pages + ledger, sitemap with ${urls.length} urls, ${MILESTONES.length} milestones.`);
