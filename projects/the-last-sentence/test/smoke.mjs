// The Last Sentence — 冒烟测试。从仓库根运行:
//   node projects/the-last-sentence/test/smoke.mjs
// 覆盖: 语法检查、双 context 实时覆盖广播、存活时长毫秒格式、10s/IP 限流
// (前端反馈 + 后端 429)、XSS 以文本呈现、脏词过滤、重启恢复墓地、
// file:// 离线 demo 零 console error、分享文案复制、双视口截图。
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
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
  else { failures++; console.log('  FAIL ' + name + (extra ? ' — ' + String(extra).slice(0, 200) : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DUR_RE = /(?:\d+d )?(?:\d{1,2}h )?(?:\d{1,2}m )?\d{1,2}\.\d{3}s/;

// --- server helpers -----------------------------------------------------------
const histDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-smoke-'));
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
function stopServer(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 2000).unref();
  });
}
const post = (base, text, xff) =>
  fetch(base + '/say', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(xff ? { 'X-Forwarded-For': xff } : {}) },
    body: JSON.stringify({ text }),
  });

// --- 0. syntax ------------------------------------------------------------------
console.log('\n[0] node --check');
for (const f of ['server.mjs', 'app.js']) {
  const r = spawnSync(process.execPath, ['--check', path.join(PROJ, f)]);
  check(`${f} 语法`, r.status === 0, String(r.stderr));
}

let server = null, browser = null;
try {
  // --- 1. boot ---------------------------------------------------------------------
  console.log('\n[1] 启动 server(随机端口) + 双 context');
  server = await startServer(0);
  const BASE = `http://127.0.0.1:${server.port}`;
  console.log('  server at ' + BASE);

  browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctxA.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const ctxB = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  const errsA = [], errsB = [], dialogs = [];
  pageA.on('pageerror', (e) => errsA.push(e.message));
  pageB.on('pageerror', (e) => errsB.push(e.message));
  for (const p of [pageA, pageB]) p.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });

  await pageA.goto(BASE + '/');
  await pageB.goto(BASE + '/');
  await pageA.waitForFunction(() => window.__tls && window.__tls.state.currentSeq >= 1);
  await pageB.waitForFunction(() => window.__tls && window.__tls.state.currentSeq >= 1);
  check('A/B 均收到初始 state', true);
  check('A 显示创世句', (await pageA.textContent('#sentence')).includes('someone will overwrite this.'));
  check('连接状态显示 live', (await pageA.textContent('#conn-label')) === 'live');

  const t1 = await pageA.textContent('#timer');
  await sleep(400);
  const t2 = await pageA.textContent('#timer');
  check('计时器毫秒格式 ' + JSON.stringify(t2), DUR_RE.test(t1) && DUR_RE.test(t2));
  check('计时器在走动', t1 !== t2, `${t1} → ${t2}`);

  // --- 2. A 提交 → B 实时收到覆盖 -----------------------------------------------------
  console.log('\n[2] A 提交 → B 实时覆盖 + 墓地新增');
  const SENT1 = 'the tide forgets every name written in sand';
  await pageA.fill('#input', SENT1);
  await pageA.click('#submit');
  await pageB.waitForFunction(
    (s) => document.getElementById('sentence').textContent === s, SENT1, { timeout: 10_000 });
  check('B 实时收到新句(打字机完成)', true);
  check('B 序号更新为 #2', (await pageB.textContent('#seq')) === '#2');
  const grave0 = await pageB.textContent('#graves li:first-child');
  check('B 墓地新增创世句', grave0.includes('someone will overwrite this.'));
  const life0 = await pageB.textContent('#graves li:first-child .g-life');
  check('墓碑存活时长含毫秒 ' + JSON.stringify(life0), /survived /.test(life0) && DUR_RE.test(life0));
  check('墓碑标注序号 #1', grave0.includes('#1'));
  check('A 反馈 yours is #2', (await pageA.textContent('#feedback')).includes('yours is #2'));

  // --- 3. 限流: 前端倒计时 + 后端 429 ---------------------------------------------------
  console.log('\n[3] 10s/IP 冷却');
  check('A 按钮进入禁用倒计时', await pageA.isDisabled('#submit'));
  const btnLabel = await pageA.textContent('#submit');
  check('按钮显示倒计时 ' + JSON.stringify(btnLabel), /wait \d+s/.test(btnLabel));
  // 同 IP(浏览器出口 127.0.0.1)在冷却期内直接打后端 → 必须 429
  const r429 = await pageA.evaluate(async () => {
    const r = await fetch('/say', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'sneaking past the cooldown' }),
    });
    return { status: r.status, body: await r.json() };
  });
  check('后端强制 429', r429.status === 429, JSON.stringify(r429));
  check('429 带 retryAfterMs', r429.body.retryAfterMs > 0 && r429.body.retryAfterMs <= 10_000);

  // --- 4. 校验与内容安全(经 X-Forwarded-For 换桶,不用等冷却) ------------------------------
  console.log('\n[4] 校验 / XSS / 脏词');
  const rEmpty = await post(BASE, '   ​  ', '10.9.0.1');
  check('纯空白 → 400 empty', rEmpty.status === 400 && (await rEmpty.json()).error === 'empty');
  const rLong = await post(BASE, 'x'.repeat(121), '10.9.0.2');
  check('121 字符 → 400 too_long', rLong.status === 400 && (await rLong.json()).error === 'too_long');

  const XSS = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  const rXss = await post(BASE, XSS, '10.9.0.3');
  check('XSS 字符串被接受(作为文本)', rXss.status === 200);
  await pageB.waitForFunction(() => document.getElementById('sentence').textContent.includes('<img'), null, { timeout: 10_000 });
  const noNodes = await pageB.evaluate(() => document.querySelector('#sentence img, #sentence script') === null);
  check('XSS 以纯文本呈现(无 img/script 节点)', noNodes);
  check('无弹窗触发', dialogs.length === 0, dialogs.join('; '));

  const rProf = await post(BASE, 'the fucking tide returns anyway', '10.9.0.4');
  check('脏词句被接受', rProf.status === 200);
  await pageB.waitForFunction(
    (s) => document.getElementById('sentence').textContent === s,
    'the ▓▓ tide returns anyway', { timeout: 10_000 });
  const cur = await pageB.textContent('#sentence');
  check('脏词已替换为 ▓▓', cur.includes('the ▓▓ tide returns') && !/fuck/i.test(cur));

  // --- 5. 墓碑分享文案复制 ------------------------------------------------------------------
  console.log('\n[5] 分享复制');
  const SENT2 = 'ashes to ashes, bits to bits';
  await post(BASE, SENT2, '10.9.0.5');
  await pageA.waitForFunction((s) => document.getElementById('sentence').textContent === s, SENT2, { timeout: 10_000 });
  await pageA.click('#graves li:first-child .g-copy');
  const lastCopy = await pageA.evaluate(() => window.__lastCopy);
  check('墓碑 epitaph 文案格式', /survived .*#[\d,]+ on the last sentence — http/.test(lastCopy || ''), lastCopy);
  let clip = '';
  try { clip = await pageA.evaluate(() => navigator.clipboard.readText()); } catch {}
  check('剪贴板内容一致(或 fallback 已写)', clip === lastCopy || (!!lastCopy && clip === ''), clip);
  // A 自己的句子(#2)已死 → 死亡横幅 + "my sentence survived" 文案
  check('A 显示自己句子的死亡横幅', await pageA.isVisible('#mine'));
  const mineTxt = await pageA.textContent('#mine-text');
  check('死亡横幅含毫秒存活时长', /survived/.test(mineTxt) && DUR_RE.test(mineTxt), mineTxt);
  await pageA.click('#mine-copy');
  const myCopy = await pageA.evaluate(() => window.__lastCopy);
  check('my sentence 分享文案', /^my sentence survived .* as #2 on the last sentence — http/.test(myCopy || ''), myCopy);

  // --- 6. 截图 ---------------------------------------------------------------------------------
  console.log('\n[6] 双视口截图');
  await pageA.evaluate(() => window.scrollTo(0, 0));
  await sleep(200);
  await pageA.screenshot({ path: path.join(SHOTS, 'desktop.png') });
  await pageB.screenshot({ path: path.join(SHOTS, 'mobile.png'), fullPage: true });
  check('截图已写入', fs.existsSync(path.join(SHOTS, 'desktop.png')) && fs.existsSync(path.join(SHOTS, 'mobile.png')));
  check('A 无 pageerror', errsA.length === 0, errsA.join('; '));
  check('B 无 pageerror', errsB.length === 0, errsB.join('; '));

  // --- 7. 重启恢复 ------------------------------------------------------------------------------
  console.log('\n[7] 重启 server → 墓地恢复');
  const port = server.port;
  await stopServer(server.child);
  server = await startServer(port); // 复用端口,同一 history.jsonl
  const pageC = await ctxB.newPage();
  await pageC.goto(BASE + '/');
  await pageC.waitForFunction(() => window.__tls && window.__tls.state.currentSeq >= 1);
  const stC = await pageC.evaluate(() => window.__tls.state);
  check('总数恢复(≥5 句)', stC.total >= 5, JSON.stringify(stC));
  check('当前句恢复', (await pageC.textContent('#sentence')) === SENT2);
  const gyText = await pageC.textContent('#graves');
  check('墓地恢复含历史句', gyText.includes(SENT1) && gyText.includes('<img'), gyText.slice(0, 120));
  check('恢复的墓碑仍含毫秒时长', DUR_RE.test(gyText));
  await pageC.close();

  // --- 8. file:// 离线 demo ------------------------------------------------------------------------
  console.log('\n[8] file:// demo 模式');
  const ctxD = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageD = await ctxD.newPage();
  const errsD = [];
  pageD.on('console', (m) => { if (m.type() === 'error') errsD.push(m.text()); });
  pageD.on('pageerror', (e) => errsD.push(e.message));
  await pageD.goto('file://' + path.join(PROJ, 'index.html'));
  await pageD.waitForFunction(() => window.__tls && window.__tls.state.demo);
  check('demo 横幅可见', await pageD.isVisible('#demo-banner'));
  check('横幅注明 offline demo', (await pageD.textContent('#demo-banner')).includes('offline demo'));
  check('12 条预置墓碑', (await pageD.locator('#graves li').count()) === 12);
  check('连接标签 offline demo', (await pageD.textContent('#conn-label')) === 'offline demo');
  await pageD.fill('#input', 'hello from nowhere');
  await pageD.click('#submit');
  await pageD.waitForFunction(() => document.getElementById('sentence').textContent === 'hello from nowhere', null, { timeout: 10_000 });
  check('demo 可本地覆盖', true);
  check('demo 墓地变 13 条', (await pageD.locator('#graves li').count()) === 13);
  check('demo 冷却生效', await pageD.isDisabled('#submit'));
  await pageD.screenshot({ path: path.join(SHOTS, 'demo-file.png') });
  check('demo 零 console error', errsD.length === 0, errsD.join('; '));
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
