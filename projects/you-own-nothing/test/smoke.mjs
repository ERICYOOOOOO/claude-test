/* Smoke test for You Own Nothing.
   Run from the repo root:  node projects/you-own-nothing/test/smoke.mjs */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '..');
const indexUrl = 'file://' + path.join(projectDir, 'index.html');
const shotsDir = path.join(__dirname, 'screenshots');
fs.mkdirSync(shotsDir, { recursive: true });

let failures = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log('PASS  ' + name);
  } else {
    failures++;
    console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : ''));
  }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

function collectErrors(page, sink) {
  page.on('console', (msg) => { if (msg.type() === 'error') sink.push('console: ' + msg.text()); });
  page.on('pageerror', (err) => sink.push('pageerror: ' + err.message));
}

async function resolveModal(page, action) {
  await page.waitForSelector('#modal-root:not(.hidden)', { timeout: 3000 });
  await page.click(`#modal [data-action="${action}"]`);
  await page.waitForSelector('#modal-root.hidden', { state: 'attached', timeout: 3000 });
}

/* ---------------- desktop: full core loop ---------------- */
{
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  collectErrors(page, errors);
  await page.goto(indexUrl);
  await page.waitForTimeout(500);

  check('desktop: scene renders 16 objects', (await page.locator('#scene .obj').count()) === 16);

  const total0 = await page.getAttribute('#odometer', 'data-value');
  check('desktop: starts at $0.00', total0 === '$0.00', total0);

  await page.screenshot({ path: path.join(shotsDir, 'desktop-apartment.png') });

  // subscribe 3 objects, asserting the monthly total rises each time
  let prev = 0;
  for (const id of ['lamp', 'cat', 'air']) {
    await page.click(`.obj[data-id="${id}"] .hit`, { force: true });
    await resolveModal(page, 'subscribe');
    await page.waitForTimeout(650);
    const t = await page.evaluate(() => window.YON.totalMonthly());
    check(`desktop: total rises after subscribing ${id}`, t > prev, `now ${t}`);
    prev = t;
    check(`desktop: ${id} shows a price chip`, (await page.locator(`#chips [data-chip="${id}"]`).count()) === 1);
  }
  const displayed = await page.getAttribute('#odometer', 'data-value');
  check('desktop: odometer reflects total', displayed !== '$0.00' && displayed.startsWith('$'), displayed);

  // decline 2 objects, asserting the grayscale class lands
  for (const id of ['plant', 'window']) {
    await page.click(`.obj[data-id="${id}"] .hit`, { force: true });
    await resolveModal(page, 'decline');
    await page.waitForTimeout(500);
    const declined = await page.evaluate(
      (oid) => document.querySelector(`.obj[data-id="${oid}"]`).classList.contains('declined'),
      id
    );
    check(`desktop: ${id} carries .declined after refusing`, declined);
  }
  const tAfterDecline = await page.evaluate(() => window.YON.totalMonthly());
  check('desktop: declines do not change total', tAfterDecline === prev, `now ${tAfterDecline}`);

  // edge: rapid double-click on the same object opens exactly one modal
  await page.click('.obj[data-id="sofa"] .hit', { force: true, clickCount: 2, delay: 30 });
  await page.waitForTimeout(300);
  check('edge: rapid double click opens one modal', (await page.locator('#modal-root:not(.hidden)').count()) === 1
    && (await page.locator('#modal .m-brand').count()) === 1);

  // edge: ESC closes
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('edge: ESC closes the modal', (await page.locator('#modal-root.hidden').count()) === 1);

  // edge: backdrop click closes (after the anti-double-click grace beat)
  await page.click('.obj[data-id="tv"] .hit', { force: true });
  await page.waitForSelector('#modal-root:not(.hidden)');
  await page.waitForTimeout(350);
  await page.mouse.click(20, 400); // backdrop area, far from the centered modal
  await page.waitForTimeout(250);
  check('edge: backdrop click closes the modal', (await page.locator('#modal-root.hidden').count()) === 1);

  // door: first click = ThresholdPlus modal, resolve it, second click = leave for work
  await page.click('.obj[data-id="door"] .hit', { force: true });
  await page.waitForSelector('#modal-root:not(.hidden)');
  const doorBrand = await page.textContent('#modal .m-brand');
  check('door: modal is ThresholdPlus', doorBrand.includes('ThresholdPlus'), doorBrand);
  await page.click('#modal [data-action="subscribe"]');
  await page.waitForSelector('#modal-root.hidden', { state: 'attached' });
  await page.waitForTimeout(400);
  await page.click('.obj[data-id="door"] .hit', { force: true });
  await page.waitForSelector('#checkout:not(.hidden)', { timeout: 3000 });
  const receiptText = await page.textContent('#receipt');
  check('checkout: verdict line appears', receiptText.includes('Items you actually own: 0'));
  check('checkout: monthly total line appears', receiptText.includes('MONTHLY TOTAL'));
  check('checkout: itemized lines cover all objects', (await page.locator('#receipt .r-line').count()) >= 16);

  // share text + card
  const share = await page.evaluate(() => window.YON.shareText());
  check('share: text is non-empty and on brand', share.length > 80 && share.includes('Items I actually own: 0'), String(share.length));
  const dataUrl = await page.evaluate(() => window.YON.shareCardDataURL());
  check('share: PNG data URL generated', dataUrl.startsWith('data:image/png') && dataUrl.length > 20000, String(dataUrl.length));

  await page.screenshot({ path: path.join(shotsDir, 'desktop-receipt.png') });

  // move in again resets
  await page.click('#btn-again');
  await page.waitForTimeout(300);
  const totalReset = await page.evaluate(() => window.YON.totalMonthly());
  check('reset: move in again zeroes the ledger', totalReset === 0);
  check('reset: declined classes cleared', (await page.locator('#scene .obj.declined').count()) === 0);

  check('desktop: zero console errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ---------------- mobile 375px: no horizontal scroll, flow works ---------------- */
{
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  collectErrors(page, errors);
  await page.goto(indexUrl);
  await page.waitForTimeout(500);

  const scroll = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth
  }));
  check('mobile: no horizontal scroll', scroll.sw <= scroll.iw + 1, JSON.stringify(scroll));

  await page.screenshot({ path: path.join(shotsDir, 'mobile-apartment.png') });

  await page.click('.obj[data-id="sofa"] .hit', { force: true });
  await resolveModal(page, 'subscribe');
  await page.waitForTimeout(650);
  const t = await page.evaluate(() => window.YON.totalMonthly());
  check('mobile: subscribing works', t > 0, String(t));
  await page.screenshot({ path: path.join(shotsDir, 'mobile-modal-after.png') });
  check('mobile: zero console errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ---------------- reduced motion: flow still works ---------------- */
{
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  collectErrors(page, errors);
  await page.goto(indexUrl);
  await page.waitForTimeout(400);
  await page.click('.obj[data-id="coffee"] .hit', { force: true });
  await resolveModal(page, 'subscribe');
  const t = await page.evaluate(() => window.YON.totalMonthly());
  check('reduced-motion: subscribe works, odometer jumps', t > 0, String(t));
  const odo = await page.getAttribute('#odometer', 'data-value');
  check('reduced-motion: odometer shows amount', odo.includes('$') && odo !== '$0.00', odo);
  check('reduced-motion: zero console errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ---------------- garbage localStorage: app must still boot ---------------- */
{
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  collectErrors(page, errors);
  await page.goto(indexUrl);
  await page.evaluate(() => localStorage.setItem('yon-state-v1', '{"v":"lol", decisions¡¡ not json'));
  await page.reload();
  await page.waitForTimeout(400);
  check('garbage-storage: scene still renders', (await page.locator('#scene .obj').count()) === 16);
  check('garbage-storage: total resets to $0.00', (await page.evaluate(() => window.YON.totalMonthly())) === 0);
  check('garbage-storage: zero console errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

await browser.close();

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
