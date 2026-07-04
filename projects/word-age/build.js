#!/usr/bin/env node
/* Word Age — static site generator. Zero dependencies.
 * Reads data.js (+ funfacts.js, lib.js), writes:
 *   words/<word>.html   one long-tail page per word
 *   words/index.html    the full catalogue (SEO hub page)
 *   sitemap.xml         homepage + catalogue + every word page
 *   robots.txt
 * Change the deploy origin here (or via env): SITE_ORIGIN=https://... node build.js */
"use strict";
const fs = require("fs");
const path = require("path");
const DATA = require("./data.js");
const FUN = require("./funfacts.js");
const Lib = require("./lib.js");

const SITE = (process.env.SITE_ORIGIN || "https://wordage.fyi").replace(/\/$/, "");
const NOW = new Date();
const YEAR = NOW.getFullYear();
const TODAY = NOW.toISOString().slice(0, 10);
const OUT = path.join(__dirname, "words");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function metaDescription(e, line) {
  let d = `“${e.w}” was first recorded ${e.d}, when it meant “${e.orig}.” About ${Lib.ageOf(e.y, YEAR)} years old — ${line}.`;
  if (d.length > 158) d = d.slice(0, 155).replace(/\s+\S*$/, "") + "…";
  return d;
}

function wordPage(e) {
  const line = Lib.anchorLine(e.w, e.y, DATA.ANCHORS);
  const fun = FUN[e.w] || "";
  const rel = Lib.related(e, DATA.WORDS);
  const url = `${SITE}/words/${e.w}.html`;
  const title = `How old is the word “${e.w}”? First recorded ${e.d} | Word Age`;
  const desc = metaDescription(e, line);
  const inline = JSON.stringify({ w: e.w, y: e.y, d: e.d, orig: e.orig, shift: e.shift, v: e.v, line })
    .replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en" data-site="${esc(SITE)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:title" content="${esc(`“${e.w}” — b. ${e.d}. ${Lib.verdictLabel(e.v)}.`)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${esc(url)}">
<meta property="og:site_name" content="Word Age">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="../style.css">
</head>
<body>
<div class="sheet">
<header class="masthead">
  <hr class="rule"><hr class="rule thin">
  <p class="crumb"><a href="../index.html">Word Age</a> · <a href="index.html">catalogue</a></p>
  <hr class="rule foot">
</header>
<main>
<article class="entry">
  <div class="headword-row">
    <h1 class="headword">${esc(e.w)}</h1>
    <span class="stamp">${Lib.verdictLabel(e.v)}</span>
  </div>
  <div class="yearblock">
    <span class="label">First recorded</span>
    <div id="year" class="year">${esc(e.d)}</div>
    <p class="ageline">≈ ${Lib.ageOf(e.y, YEAR)} years old</p>
  </div>
  <section class="orig">
    <span class="label">As first written</span>
    <p>“${esc(e.orig)}”</p>
  </section>
  <section class="drift">
    <span class="label">How it drifted</span>
    <p>${esc(e.shift)}</p>
  </section>
  <section class="persp">
    <span class="label">For perspective</span>
    <p>That makes <em>${esc(e.w)}</em> <strong>${esc(line)}</strong>.</p>
  </section>${fun ? `
  <section class="fun">
    <span class="label">Marginalia</span>
    <p>${esc(fun)}</p>
  </section>` : ""}
  <div class="actions">
    <button id="save-card" class="btn">Save birth certificate</button>
    <button id="copy-text" class="btn ghost">Copy as text</button>
    <span id="toast" class="toast" role="status"></span>
  </div>
  <div class="seealso">
    <span class="label">See also</span>
    <ul>
${rel.map((r) => `      <li><a href="${r.w}.html">${esc(r.w)}</a><span class="y">${esc(r.d)}</span></li>`).join("\n")}
    </ul>
  </div>
  <form id="pagesearch" class="pagesearch" action="../index.html" method="get">
    <input id="pq" name="q" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Look up another word" aria-label="Look up another word">
    <button class="btn" type="submit">Look up</button>
  </form>
</article>
<!-- Ad slot: see DEPLOY.md §Monetization to activate AdSense here. -->
<aside class="ad" aria-label="sponsor">
  <span class="label">A word from the press</span>
  <p>Word Age is free. <a href="../index.html">Look up the words you overuse</a> — most are lying about their age.</p>
</aside>
</main>
<footer class="colophon">
  <div class="inner">
    <span><a href="../index.html">← Word Age home</a></span>
    <span><a href="index.html">Browse the full catalogue</a></span>
    <span>${esc(SITE.replace(/^https?:\/\//, ""))}</span>
  </div>
</footer>
</div>
<script>window.WORD_PAGE=${inline};</script>
<script src="../lib.js"></script>
<script src="../app.js"></script>
</body>
</html>
`;
}

function cataloguePage(words) {
  const groups = {};
  for (const e of words) (groups[e.w[0]] = groups[e.w[0]] || []).push(e);
  const letters = Object.keys(groups).sort();
  const body = letters.map((L) => `<div class="cat-group">
  <h2 class="cat-letter">${L.toUpperCase()}</h2>
  <ul>
${groups[L].sort((a, b) => (a.w < b.w ? -1 : 1)).map((e) => `    <li><a href="${e.w}.html">${esc(e.w)}</a><span class="y">${esc(e.d)}</span></li>`).join("\n")}
  </ul>
</div>`).join("\n");
  return `<!DOCTYPE html>
<html lang="en" data-site="${esc(SITE)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Catalogue — all ${words.length} words | Word Age</title>
<meta name="description" content="Every word in the Word Age archive: ${words.length} English words with their first recorded year and original meaning.">
<link rel="canonical" href="${esc(SITE)}/words/index.html">
<meta property="og:title" content="The Word Age catalogue — ${words.length} word birthdays">
<meta property="og:description" content="Browse every word in the archive, from Old English survivors to last decade’s coinages.">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(SITE)}/words/index.html">
<meta property="og:site_name" content="Word Age">
<link rel="stylesheet" href="../style.css">
</head>
<body>
<div class="sheet">
<header class="masthead">
  <hr class="rule"><hr class="rule thin">
  <p class="brand"><a href="../index.html">Word Age</a></p>
  <p class="tagline">The catalogue · ${words.length} entries</p>
  <hr class="rule foot">
</header>
<main>
${body}
</main>
<footer class="colophon">
  <div class="inner">
    <span><a href="../index.html">← Word Age home</a></span>
    <span>${esc(SITE.replace(/^https?:\/\//, ""))}</span>
  </div>
</footer>
</div>
</body>
</html>
`;
}

function sitemap(words) {
  const urls = [`${SITE}/`, `${SITE}/words/index.html`]
    .concat(words.map((e) => `${SITE}/words/${e.w}.html`));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}
</urlset>
`;
}

// ---- run --------------------------------------------------------------------
const words = DATA.WORDS;
if (fs.existsSync(OUT)) {
  for (const f of fs.readdirSync(OUT)) if (f.endsWith(".html")) fs.unlinkSync(path.join(OUT, f));
} else fs.mkdirSync(OUT);

for (const e of words) fs.writeFileSync(path.join(OUT, `${e.w}.html`), wordPage(e));
fs.writeFileSync(path.join(OUT, "index.html"), cataloguePage(words));
fs.writeFileSync(path.join(__dirname, "sitemap.xml"), sitemap(words));
fs.writeFileSync(path.join(__dirname, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`built ${words.length} word pages + catalogue`);
console.log(`sitemap: ${words.length + 2} urls  ·  origin: ${SITE}`);
