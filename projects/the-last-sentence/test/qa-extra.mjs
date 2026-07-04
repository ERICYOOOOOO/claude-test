// The Last Sentence — 对抗性 QA 测试。从仓库根运行:
//   node projects/the-last-sentence/test/qa-extra.mjs
// 覆盖: 并发竞态串行化、恶意负载(121/120 字符、纯空白、零宽/不可见字符、
// RLO 双向控制符、emoji/中文/RTL、UTF-8 多字节分块边界)、SSE 断线重连、
// 单 IP 洪水(1×200 + 9×429)、history.jsonl 损坏行恢复、计时精度(±100ms)、
// 375px 无横向滚动。另存 5 张美学评审截图 (test/screenshots/qa-*.png)。
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.resolve(HERE, '..');
const SERVER = path.join(PROJ, 'server.mjs');
const SHOTS = path.join(HERE, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

let passes = 0, failures = 0;
function check(name, cond, extra) {
  if (cond) { passes++; console.log('  PASS ' + name); }
  else { failures++; console.log('  FAIL ' + name + (extra ? ' — ' + String(extra).slice(0, 300) : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- server helpers -----------------------------------------------------------
const histDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-qa-'));
const HIST = path.join(histDir, 'history.jsonl');

function startServer(port) {
  const child = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env, PORT: String(port), HOST: '127.0.0.1',
      HISTORY_FILE: HIST, TRUST_PROXY: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => console.error('  [server:err]', String(d).trim()));
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('server did not start')), 8000);
    child.stdout.on('data', (d) => {
      const m = String(d).match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (m) { clearTimeout(to); resolve({ child, port: Number(m[1]) }); }
    });
    child.on('exit', (code) => reject(new Error('server exited early: ' + code)));
  });
}
function stopServer(child, signal = 'SIGTERM') {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill(signal);
    setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 2000).unref();
  });
}
const post = (base, text, xff) =>
  fetch(base + '/say', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(xff ? { 'X-Forwarded-For': xff } : {}) },
    body: JSON.stringify({ text }),
  });

// Read one `state` snapshot off the SSE endpoint, then hang up.
async function getState(base) {
  const ac = new AbortController();
  const res = await fetch(base + '/events', { signal: ac.signal });
  const reader = res.body.getReader();
  let buf = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += Buffer.from(value).toString('utf8');
      const m = buf.match(/event: state\ndata: (.*)\n\n/);
      if (m) { ac.abort(); return JSON.parse(m[1]); }
    }
  } catch (e) { if (e.name !== 'AbortError') throw e; }
  throw new Error('no state event in: ' + buf.slice(0, 200));
}

// POST raw bytes split across two TCP writes (multibyte boundary attack).
function rawChunkedPost(port, bodyBuf, splitAt, xff) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1');
    let data = '';
    sock.setTimeout(5000, () => { sock.destroy(); reject(new Error('raw post timeout')); });
    sock.on('data', (d) => { data += d; });
    sock.on('close', () => {
      const m = data.match(/^HTTP\/1\.1 (\d+)/);
      resolve({ status: m ? Number(m[1]) : 0, raw: data });
    });
    sock.on('error', reject);
    sock.on('connect', () => {
      sock.write(
        'POST /say HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\n' +
        `X-Forwarded-For: ${xff}\r\nContent-Length: ${bodyBuf.length}\r\nConnection: close\r\n\r\n`);
      sock.write(bodyBuf.subarray(0, splitAt));
      setTimeout(() => sock.write(bodyBuf.subarray(splitAt)), 60);
    });
  });
}

const decode = (t) => [['&lt;', '<'], ['&gt;', '>'], ['&quot;', '"'], ['&#39;', "'"], ['&amp;', '&']]
  .reduce((s, [a, b]) => s.split(a).join(b), String(t));

let ipN = 1;
const ip = () => `10.99.${Math.floor(ipN / 250)}.${(ipN++ % 250) + 1}`;

let server = null, browser = null;
try {
  // --- 0. boot: fresh world + two viewports -----------------------------------
  console.log('\n[0] 启动 fresh server + 双视口 (空态截图)');
  server = await startServer(0);
  const BASE = `http://127.0.0.1:${server.port}`;
  console.log('  server at ' + BASE);

  browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const ctxB = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  const errsA = [], errsB = [];
  const isNetNoise = (t) => /Failed to load resource|net::ERR_|ERR_CONNECTION/.test(t);
  pageA.on('pageerror', (e) => errsA.push('pageerror: ' + e.message));
  pageB.on('pageerror', (e) => errsB.push('pageerror: ' + e.message));
  pageA.on('console', (m) => { if (m.type() === 'error' && !isNetNoise(m.text())) errsA.push('console: ' + m.text()); });
  pageB.on('console', (m) => { if (m.type() === 'error' && !isNetNoise(m.text())) errsB.push('console: ' + m.text()); });

  await pageA.goto(BASE + '/');
  await pageB.goto(BASE + '/');
  await pageA.waitForFunction(() => window.__tls && window.__tls.state.currentSeq >= 1);
  await pageB.waitForFunction(() => window.__tls && window.__tls.state.currentSeq >= 1);
  check('空态: 创世句 + 0 座墓', (await pageA.textContent('#sentence')) === 'someone will overwrite this.'
    && (await pageA.locator('#graves li').count()) === 0);
  await sleep(600); // let the timer tick into a readable value
  await pageA.screenshot({ path: path.join(SHOTS, 'qa-1-empty.png') });

  // --- 1. 并发竞态: 两个 context 几乎同时 POST ----------------------------------
  console.log('\n[1] 并发竞态 (双 context 同时 POST)');
  const T1 = 'the first of two simultaneous truths';
  const T2 = 'the second of two simultaneous truths';
  const race = (page, text, xff) => page.evaluate(async ([t, x]) => {
    const r = await fetch('/say', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': x },
      body: JSON.stringify({ text: t }),
    });
    return { status: r.status, body: await r.json() };
  }, [text, xff]);
  const [rA, rB] = await Promise.all([race(pageA, T1, ip()), race(pageB, T2, ip())]);
  check('两次 POST 均 200', rA.status === 200 && rB.status === 200, JSON.stringify([rA, rB]));
  const seqs = [rA.body.seq, rB.body.seq].sort((a, b) => a - b);
  check('序号串行化 (2,3 各一次)', seqs[0] === 2 && seqs[1] === 3, JSON.stringify(seqs));
  await pageA.waitForFunction(() => window.__tls.state.total === 3, null, { timeout: 10_000 });
  await pageB.waitForFunction(() => window.__tls.state.total === 3, null, { timeout: 10_000 });
  check('A/B 总数一致 (+2)', true);
  const st1 = await getState(BASE);
  const winner = rA.body.seq === 3 ? T1 : T2;
  const loser = rA.body.seq === 3 ? T2 : T1;
  check('无句子丢失: 胜者存活', decode(st1.current.text) === winner, decode(st1.current.text));
  check('无句子丢失: 败者入墓 (存活 0–5000ms)',
    decode(st1.graves[0].text) === loser && st1.graves[0].survivedMs >= 0 && st1.graves[0].survivedMs < 5000,
    JSON.stringify(st1.graves[0]));
  check('墓地按 seq 严格降序', st1.graves.every((g, i, a) => i === 0 || a[i - 1].seq === g.seq + 1));
  const order = (p) => p.$$eval('#graves li', (ls) => ls.map((l) => l.querySelector('span').textContent));
  const [ordA, ordB] = [await order(pageA), await order(pageB)];
  check('A/B 墓地顺序一致', JSON.stringify(ordA) === JSON.stringify(ordB), `${ordA} vs ${ordB}`);

  // --- 2. 恶意负载 ---------------------------------------------------------------
  console.log('\n[2] 恶意负载');
  const r121 = await post(BASE, 'x'.repeat(121), ip());
  check('121 字符 → 400 too_long', r121.status === 400 && (await r121.json()).error === 'too_long');
  const s120 = 'y'.repeat(120);
  const r120 = await post(BASE, s120, ip());
  check('120 字符恰好通过', r120.status === 200);
  await pageB.waitForFunction((s) => document.getElementById('sentence').textContent === s, s120, { timeout: 10_000 });
  check('120 字符完整显示', true);

  const rSpace = await post(BASE, '     ', ip());
  check('全空格 → 400 empty', rSpace.status === 400 && (await rSpace.json()).error === 'empty');
  const rZw = await post(BASE, '​﻿‍​', ip());
  check('零宽字符(ZWSP/BOM/ZWJ) → 400 empty', rZw.status === 400 && (await rZw.json()).error === 'empty');
  const rWj = await post(BASE, '⁠⁠⁡', ip());
  check('不可见字符(WJ/U+2061) → 400 empty', rWj.status === 400 && (await rWj.json()).error === 'empty');
  const rVs = await post(BASE, '️️', ip());
  check('纯变体选择符 → 400 empty', rVs.status === 400 && (await rVs.json()).error === 'empty');
  const rTab = await post(BASE, ' \t\n 　 ', ip());
  check('tab/换行/全角空格 → 400 empty', rTab.status === 400 && (await rTab.json()).error === 'empty');
  let bigStatus = 'conn-reset';
  try { bigStatus = (await post(BASE, 'z'.repeat(9000), ip())).status; } catch { /* server cut the socket */ }
  check('9KB body 被拒 (413/连接切断)', bigStatus === 413 || bigStatus === 'conn-reset', String(bigStatus));
  check('9KB 后服务器仍存活', (await fetch(BASE + '/')).status === 200);

  const EMOJI = 'the candle \u{1F56F}️ still burns \u{1F525} here';
  await post(BASE, EMOJI, ip());
  await pageB.waitForFunction((s) => document.getElementById('sentence').textContent === s, EMOJI, { timeout: 10_000 });
  check('emoji 存活显示', true);
  const ZH = '最后一句话留给沉默的人';
  await post(BASE, ZH, ip());
  await pageB.waitForFunction((s) => document.getElementById('sentence').textContent === s, ZH, { timeout: 10_000 });
  check('中文存活显示', true);
  const AR = 'الجملة الأخيرة تعيش هنا';
  await post(BASE, AR, ip());
  await pageB.waitForFunction((s) => document.getElementById('sentence').textContent === s, AR, { timeout: 10_000 });
  check('RTL 阿拉伯文存活显示', true);

  const rRlo = await post(BASE, 'safe‮gnp.exe', ip());
  const stRlo = await getState(BASE);
  check('RLO 双向控制符被剥离', rRlo.status === 200 && !decode(stRlo.current.text).includes('‮'),
    JSON.stringify(decode(stRlo.current.text)));

  // UTF-8 多字节边界: body 在一个 3 字节汉字中间被拆成两个 TCP 包
  const CJK = '烛火不灭烛火不灭';
  const bodyBuf = Buffer.from(JSON.stringify({ text: CJK }), 'utf8');
  const rRaw = await rawChunkedPost(server.port, bodyBuf, 13, ip()); // 13 = inside the 2nd char
  const stRaw = await getState(BASE);
  check('分块 POST 仍 200', rRaw.status === 200, rRaw.raw.slice(0, 160));
  check('UTF-8 边界不产生乱码 (无 U+FFFD)',
    decode(stRaw.current.text) === CJK && !stRaw.current.text.includes('�'),
    JSON.stringify(decode(stRaw.current.text)));

  // --- 3. 美学评审截图 -------------------------------------------------------------
  console.log('\n[3] 美学评审截图');
  await post(BASE, 'what survives is not always what deserved to', ip());
  await pageA.waitForFunction(() => document.getElementById('sentence').textContent.startsWith('what survives'), null, { timeout: 10_000 });
  await sleep(1200);
  await pageA.fill('#input', 'nothing I write here will outlive the hour');
  await pageA.hover('#submit');
  await pageA.screenshot({ path: path.join(SHOTS, 'qa-2-typed.png') });
  await pageA.fill('#input', '');

  const killShot = post(BASE, 'and just like that, it was someone else’s turn', ip());
  await pageA.waitForSelector('.sentence.dying', { timeout: 10_000 });
  await pageA.screenshot({ path: path.join(SHOTS, 'qa-3-overwrite.png') });
  await killShot;

  await pageA.evaluate(() => document.querySelector('.graveyard').scrollIntoView());
  await sleep(400);
  await pageA.screenshot({ path: path.join(SHOTS, 'qa-4-graveyard.png') });
  await pageA.evaluate(() => window.scrollTo(0, 0));

  await pageB.screenshot({ path: path.join(SHOTS, 'qa-5-mobile.png'), fullPage: true });
  const hScroll = await pageB.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('375px 无横向滚动', hScroll <= 0, 'overflow ' + hScroll + 'px');
  check('5 张截图已写入', ['qa-1-empty', 'qa-2-typed', 'qa-3-overwrite', 'qa-4-graveyard', 'qa-5-mobile']
    .every((n) => fs.existsSync(path.join(SHOTS, n + '.png'))));

  // --- 4. 洪水: 单 IP 连发 10 次 ------------------------------------------------------
  console.log('\n[4] 单 IP 洪水 (10 连发)');
  const floodIp = ip();
  const before = await getState(BASE);
  const flood = await Promise.all(Array.from({ length: 10 }, (_, i) =>
    post(BASE, `flood attempt ${i}`, floodIp).then((r) => r.status)));
  const ok = flood.filter((s) => s === 200).length;
  const tooMany = flood.filter((s) => s === 429).length;
  check('恰好 1 次 200', ok === 1, JSON.stringify(flood));
  check('其余 9 次 429', tooMany === 9, JSON.stringify(flood));
  const after = await getState(BASE);
  check('内存态一致: total 恰 +1', after.total === before.total + 1, `${before.total} → ${after.total}`);
  check('服务器仍存活 (GET / 200)', (await fetch(BASE + '/')).status === 200);
  const histLines = fs.readFileSync(HIST, 'utf8').split('\n').filter((l) => l.trim()).length;
  check('history.jsonl 行数 == total', histLines === after.total, `${histLines} vs ${after.total}`);
  await pageA.waitForFunction((t) => window.__tls.state.total === t, after.total, { timeout: 10_000 });
  check('前端总数同步', true);

  // --- 5. 计时精度: 墓碑存活时长 = 覆盖时刻差 ------------------------------------------
  console.log('\n[5] 计时精度 (±100ms)');
  const tA = Date.now();
  await post(BASE, 'i was born to be measured', ip());
  await sleep(1437);
  const tB = Date.now();
  await post(BASE, 'and i am the measurement', ip());
  const stT = await getState(BASE);
  const g = stT.graves[0];
  check('survivedMs === diedAt - bornAt (精确)', g.survivedMs === g.diedAt - g.bornAt, JSON.stringify(g));
  const drift = Math.abs(g.survivedMs - (tB - tA));
  check(`存活时长与实际覆盖间隔差 ${drift}ms ≤ 100ms`, drift <= 100, `survived ${g.survivedMs} vs wall ${tB - tA}`);
  const lifeTxt = await pageA.textContent('#graves li:first-child .g-life');
  const shown = lifeTxt.match(/(\d+)\.(\d{3})s/);
  const shownMs = shown ? Number(shown[1]) * 1000 + Number(shown[2]) : NaN;
  check('墓碑显示毫秒与服务端一致', Math.abs(shownMs - g.survivedMs) < 1, `${lifeTxt} vs ${g.survivedMs}ms`);

  // --- 6. SSE 断线重连 ------------------------------------------------------------------
  console.log('\n[6] SSE 断线重连 (kill -9 → 重启)');
  const port = server.port;
  // wait out the typewriter so the mid-animation empty frame can't flake the check below
  await pageA.waitForFunction(() => document.getElementById('sentence').textContent === 'and i am the measurement', null, { timeout: 10_000 });
  const seqBeforeKill = (await getState(BASE)).current.seq;
  await stopServer(server.child, 'SIGKILL');
  server = null;
  await pageA.waitForFunction(() => document.getElementById('conn-label').textContent === 'reconnecting', null, { timeout: 15_000 });
  check('断线后显示可见降级提示 (reconnecting)', true);
  check('断线状态点变红 (.lost)', await pageA.$eval('#conn-dot', (d) => d.classList.contains('lost')));
  check('断线期间句子仍在 (不清空)', (await pageA.textContent('#sentence')).length > 0);
  await sleep(1500);
  server = await startServer(port);
  await pageA.waitForFunction(() => document.getElementById('conn-label').textContent === 'live', null, { timeout: 30_000 });
  check('自动重连回 live', true);
  const stR = await pageA.evaluate(() => window.__tls.state);
  check('重连后状态一致 (seq 不变)', stR.currentSeq === seqBeforeKill, JSON.stringify(stR));
  check('重连后未误入 demo 模式', !stR.demo && await pageA.isHidden('#demo-banner'));
  const dupSeq = await pageA.$$eval('#graves li', (ls) => {
    const s = ls.map((l) => l.querySelector('span').textContent);
    return s.length - new Set(s).size;
  });
  check('重连快照重建墓地无重复 seq', dupSeq === 0, dupSeq + ' duplicates');
  await post(BASE, 'the wire went quiet, then it did not', ip());
  await pageA.waitForFunction(() => document.getElementById('sentence').textContent.includes('the wire went quiet'), null, { timeout: 10_000 });
  check('重连后覆盖广播恢复', true);

  // --- 7. history.jsonl 损坏行恢复 ----------------------------------------------------------
  console.log('\n[7] history.jsonl 损坏一行 → 重启恢复');
  await stopServer(server.child);
  server = null;
  const lines = fs.readFileSync(HIST, 'utf8').split('\n').filter((l) => l.trim());
  const victimIdx = lines.length - 3; // a middle line, not genesis, not the last
  const victim = JSON.parse(lines[victimIdx]);
  lines[victimIdx] = '{"text":"i am corrupt and unparseable, ';
  fs.writeFileSync(HIST, lines.join('\n') + '\n');
  const lastRow = JSON.parse(lines[lines.length - 1]);
  server = await startServer(port);
  const stC = await getState(BASE);
  check('重启成功且跳过坏行', true);
  check('总数保持 (== 最后一行 seq)', stC.total === lastRow.seq, `${stC.total} vs ${lastRow.seq}`);
  check('当前句 == 最后一行', stC.current.text === lastRow.text);
  check('坏行句子从墓地消失', !stC.graves.some((gg) => gg.text === victim.text));
  check('坏行不产生负存活时长', stC.graves.every((gg) => gg.survivedMs >= 0 && gg.diedAt >= gg.bornAt));
  const pageC = await ctxA.newPage();
  const errsC = [];
  pageC.on('pageerror', (e) => errsC.push(e.message));
  await pageC.goto(BASE + '/');
  await pageC.waitForFunction(() => window.__tls && window.__tls.state.currentSeq >= 1);
  check('恢复后页面正常加载', (await pageC.evaluate(() => window.__tls.state.total)) === stC.total);
  check('恢复页无 pageerror', errsC.length === 0, errsC.join('; '));
  await pageC.close();

  // --- 8. 全程零 JS 错误 --------------------------------------------------------------------
  console.log('\n[8] 全程 console/page error 审计');
  check('A 全程无 JS 错误 (net 噪音除外)', errsA.length === 0, errsA.join(' | '));
  check('B 全程无 JS 错误 (net 噪音除外)', errsB.length === 0, errsB.join(' | '));
} catch (e) {
  failures++;
  console.error('\nFATAL', e);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) await stopServer(server.child);
  fs.rmSync(histDir, { recursive: true, force: true });
}

console.log(`\n结果: ${passes} pass / ${failures} fail`);
process.exit(failures ? 1 : 0);
