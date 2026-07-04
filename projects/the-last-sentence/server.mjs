#!/usr/bin/env node
// ---------------------------------------------------------------------------
// The Last Sentence — zero-dependency server (node:http + node:fs only).
//
//   GET  /          static frontend (index.html / style.css / app.js)
//   GET  /events    SSE stream: one `state` snapshot on connect, then
//                   `overwrite` events every time the sentence is replaced
//   POST /say       submit a new sentence (rate-limited, validated, escaped)
//
// State lives in memory; every accepted sentence is appended to a JSONL log
// so a restart recovers the current sentence, the total count and the most
// recent 500 graves. Env: PORT, HOST, HISTORY_FILE, COOLDOWN_MS, TRUST_PROXY.
// ---------------------------------------------------------------------------
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const HISTORY_FILE = process.env.HISTORY_FILE ?? path.join(ROOT, 'history.jsonl');
const COOLDOWN_MS = Number(process.env.COOLDOWN_MS ?? 10_000);
const TRUST_PROXY = process.env.TRUST_PROXY === '1'; // set behind Fly/Railway proxies
const MAX_CHARS = 120;      // limit counted in Unicode code points, pre-escape
const GRAVES_KEPT = 500;    // graves held in memory / sent in the snapshot
const MAX_BODY = 8 * 1024;  // request body cap
const GENESIS = 'someone will overwrite this.';

// --- content safety ---------------------------------------------------------
// Small profanity list; hits are replaced by ▓▓ (the tombstone keeps its slot,
// the word does not). Deliberately short — this is a floor, not a promise.
const BAD_WORDS = [
  'fuck', 'shit', 'cunt', 'bitch', 'asshole', 'dick', 'cock', 'pussy',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'whore', 'slut',
  'kike', 'spic', 'chink', 'tranny',
];
const BAD_RE = new RegExp('\\b(?:' + BAD_WORDS.join('|') + ')(?:s|es|ed|er|ers|ing)?\\b', 'gi');
const censor = (t) => t.replace(BAD_RE, '▓▓');

// Full HTML escape — stored and broadcast escaped, so the payload is inert
// even if a client ever forgets to treat it as text.
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (t) => t.replace(/[&<>"']/g, (c) => ESC[c]);

// Strip control, zero-width and bidi-control characters (C0/C1, soft hyphen,
// ALM, Mongolian VS, ZWSP..RLM, line/para separators, LRE..RLO overrides,
// word joiner + invisible operators + bidi isolates, BOM, interlinear
// annotations), then collapse whitespace to single spaces.
const sanitize = (t) =>
  t.replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g, ' ')
    .replace(/\s+/g, ' ').trim();

// Variation selectors and tag characters are kept (emoji sequences need them),
// but a sentence made of nothing else renders as pure emptiness — reject it.
const INVISIBLE_ONLY = /^[\s\ufe00-\ufe0f\u{e0000}-\u{e007f}\u{e0100}-\u{e01ef}]+$/u;

// --- state ------------------------------------------------------------------
let current = null; // { text (escaped), seq, bornAt }
let total = 0;      // total sentences ever == current.seq
let graves = [];    // newest first, ≤ GRAVES_KEPT, { text, seq, bornAt, diedAt, survivedMs }

function loadHistory() {
  let rows = [];
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        if (r && typeof r.text === 'string' && Number.isFinite(r.at) && Number.isFinite(r.seq)) rows.push(r);
      } catch { /* skip corrupt line */ }
    }
  } catch { /* no file yet */ }
  if (rows.length === 0) {
    const row = { text: escapeHtml(GENESIS), at: Date.now(), seq: 1 };
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    fs.appendFileSync(HISTORY_FILE, JSON.stringify(row) + '\n');
    rows = [row];
  }
  const last = rows[rows.length - 1];
  current = { text: last.text, seq: last.seq, bornAt: last.at };
  total = last.seq;
  graves = [];
  for (let i = rows.length - 1; i > 0 && graves.length < GRAVES_KEPT; i--) {
    const dead = rows[i - 1], killer = rows[i];
    graves.push({
      text: dead.text, seq: dead.seq, bornAt: dead.at,
      diedAt: killer.at, survivedMs: Math.max(0, killer.at - dead.at),
    });
  }
}
loadHistory();

// --- rate limiting (per IP) --------------------------------------------------
const lastSay = new Map(); // ip -> timestamp of last accepted submission
function clientIp(req) {
  if (TRUST_PROXY) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}
setInterval(() => { // sweep stale entries so the map cannot grow unbounded
  const cut = Date.now() - COOLDOWN_MS;
  for (const [ip, t] of lastSay) if (t < cut) lastSay.delete(ip);
}, 60_000).unref();

// --- SSE ---------------------------------------------------------------------
const clients = new Set(); // Set<http.ServerResponse>
function sseSend(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}
setInterval(() => { for (const res of clients) res.write(':hb\n\n'); }, 25_000).unref();

// --- static files ------------------------------------------------------------
const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
};
const BASE_HEADERS = {
  'X-App': 'last-sentence', // lets a static-only deploy be told apart from the real server
  'X-Content-Type-Options': 'nosniff',
};

function sendJson(res, status, obj, extra = {}) {
  res.writeHead(status, { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...extra });
  res.end(JSON.stringify(obj));
}

// --- request handling ----------------------------------------------------------
function handleSay(req, res) {
  // Collect raw buffers and decode once at the end: decoding per-chunk would
  // mangle a multi-byte UTF-8 character split across TCP packets, and the
  // body cap must count bytes, not UTF-16 units.
  const chunks = [];
  let size = 0, over = false;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY) {
      if (!over) { over = true; sendJson(res, 413, { error: 'too_large' }); req.destroy(); }
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (over) return;
    let text;
    try { text = JSON.parse(Buffer.concat(chunks).toString('utf8')).text; } catch { return sendJson(res, 400, { error: 'bad_request' }); }
    if (typeof text !== 'string') return sendJson(res, 400, { error: 'bad_request' });

    text = sanitize(text);
    if (text.length === 0 || INVISIBLE_ONLY.test(text)) return sendJson(res, 400, { error: 'empty' });
    if ([...text].length > MAX_CHARS) return sendJson(res, 400, { error: 'too_long', max: MAX_CHARS });

    const ip = clientIp(req);
    const now = Date.now();
    const prev = lastSay.get(ip);
    if (prev !== undefined && now - prev < COOLDOWN_MS) {
      const retryAfterMs = COOLDOWN_MS - (now - prev);
      return sendJson(res, 429, { error: 'cooldown', retryAfterMs },
        { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) });
    }
    lastSay.set(ip, now);

    const clean = escapeHtml(censor(text));
    const grave = {
      text: current.text, seq: current.seq, bornAt: current.bornAt,
      diedAt: now, survivedMs: Math.max(0, now - current.bornAt),
    };
    total += 1;
    current = { text: clean, seq: total, bornAt: now };
    graves.unshift(grave);
    if (graves.length > GRAVES_KEPT) graves.length = GRAVES_KEPT;
    try {
      fs.appendFileSync(HISTORY_FILE, JSON.stringify({ text: clean, at: now, seq: total }) + '\n');
    } catch (e) { console.error('history append failed:', e.message); }

    broadcast('overwrite', { grave, current, total, now });
    sendJson(res, 200, { ok: true, seq: total, cooldownMs: COOLDOWN_MS });
  });
}

function handleEvents(req, res) {
  res.writeHead(200, {
    ...BASE_HEADERS,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.write(':welcome\n\n');
  sseSend(res, 'state', { current, total, graves, now: Date.now() });
  clients.add(res);
  req.on('close', () => clients.delete(res));
  res.on('error', () => clients.delete(res)); // aborted mid-broadcast: drop, don't throw
}

function handleStatic(req, res, route) {
  const [file, type] = route;
  fs.readFile(path.join(ROOT, file), (err, buf) => {
    if (err) { sendJson(res, 500, { error: 'io' }); return; }
    res.writeHead(200, {
      ...BASE_HEADERS,
      'Content-Type': type,
      'Cache-Control': 'no-cache',
      // Belt-and-braces CSP: no inline script, no external origins.
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'",
    });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/say') {
    if (req.method === 'POST') return handleSay(req, res);
    return sendJson(res, 405, { error: 'method_not_allowed' }, { Allow: 'POST' });
  }
  if (url === '/events') {
    if (req.method === 'GET') return handleEvents(req, res);
    return sendJson(res, 405, { error: 'method_not_allowed' }, { Allow: 'GET' });
  }
  const route = STATIC[url];
  if (route) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { error: 'method_not_allowed' }, { Allow: 'GET' });
    }
    return handleStatic(req, res, route);
  }
  sendJson(res, 404, { error: 'not_found' });
});

server.listen(PORT, HOST, () => {
  const addr = server.address();
  console.log(`the last sentence — listening on http://127.0.0.1:${addr.port} (sentence #${total} is alive)`);
});

// Graceful shutdown: close SSE streams so clients reconnect cleanly.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    for (const res of clients) { try { res.end(); } catch { /* ignore */ } }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  });
}
