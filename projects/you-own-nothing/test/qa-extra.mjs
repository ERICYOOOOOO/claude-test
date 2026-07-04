/* Adversarial QA for You Own Nothing.
   Run from the repo root:  node projects/you-own-nothing/test/qa-extra.mjs

   Covers, beyond smoke.mjs:
   - subscribe-everything path with per-tier accounting (incl. the annual-preselect
     trap being switched back to monthly, and pre-checked add-ons kept/removed)
   - decline-everything path: $0.00 total but the verdict still reads
     "Items you actually own: 0"
   - subscribe -> cancel -> resubscribe state machine, and reload persistence
   - every dark pattern asserted at least once (forced + natural sampling loop)
   - full keyboard journey (Tab / Enter / ESC) incl. modal focus trap
   - 320px viewport: no horizontal scroll anywhere in the journey
   - aesthetic screenshot pack for manual review                                */
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

function money(v) {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const PATTERNS = ['annual', 'rot', 'countdown', 'popular', 'scarcity', 'addon'];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

function collectErrors(page, sink) {
  page.on('console', (msg) => { if (msg.type() === 'error') sink.push('console: ' + msg.text()); });
  page.on('pageerror', (err) => sink.push('pageerror: ' + err.message));
}

/* Force the next modal's dark pattern by pinning Math.random.
   floor(((i + 0.5) / 6) * 6) === i, and the value stays in [0,1) for the
   other Math.random consumers (verdicts, retention lines, barcode). */
async function forcePattern(page, idx) {
  await page.evaluate((i) => {
    if (!window.__realRandom) window.__realRandom = Math.random;
    Math.random = () => (i + 0.5) / 6;
  }, idx);
}
async function restoreRandom(page) {
  await page.evaluate(() => { if (window.__realRandom) Math.random = window.__realRandom; });
}

async function openObj(page, id) {
  await page.click(`.obj[data-id="${id}"] .hit`, { force: true });
  await page.waitForSelector('#modal-root:not(.hidden)', { timeout: 3000 });
}
async function waitClosed(page) {
  await page.waitForSelector('#modal-root.hidden', { state: 'attached', timeout: 3000 });
}
async function newPage(viewport) {
  const errors = [];
  const page = await browser.newPage({ viewport });
  collectErrors(page, errors);
  await page.goto(indexUrl);
  await page.waitForTimeout(350);
  return { page, errors };
}

/* =================================================================
   1. subscribe everything — per-tier accounting, annual trap, add-ons
   ================================================================= */
{
  const { page, errors } = await newPage({ width: 1280, height: 800 });
  const objects = await page.evaluate(() => window.YON.objects.map((o) => ({
    id: o.id,
    brand: o.brand,
    tiers: o.tiers.map((t) => ({ name: t.name, price: t.price }))
  })));
  check('all-sub: 16 objects exposed', objects.length === 16);

  let expected = 0;
  let expectedAddonCount = 0;
  const chosen = {}; // id -> { tierIdx, addon }

  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    const patternIdx = i % 6; // every dark pattern appears at least twice across 16
    await forcePattern(page, patternIdx);
    await openObj(page, o.id);

    if (PATTERNS[patternIdx] === 'annual') {
      // the trap: annual preselected, CTA quotes a yearly charge
      check(`all-sub[${o.id}]: annual is preselected`,
        (await page.locator('.m-billing .bopt.on[data-billing="annual"]').count()) === 1);
      const ctaYr = await page.textContent('#modal .m-cta');
      check(`all-sub[${o.id}]: CTA quotes /yr while trapped`, ctaYr.includes('/yr'), ctaYr);
      // the player escapes back to monthly via the tiny gray link
      await page.click('.m-billing .bswitch');
      check(`all-sub[${o.id}]: switch-to-monthly works`,
        (await page.locator('.m-billing .bopt.on[data-billing="monthly"]').count()) === 1);
    }

    const tierIdx = i % 3;
    await page.click(`#modal .tier[data-tier="${tierIdx}"]`);
    check(`all-sub[${o.id}]: tier ${tierIdx} selectable`,
      (await page.getAttribute('#modal .tier.on', 'data-tier')) === String(tierIdx));
    const cta = await page.textContent('#modal .m-cta');
    check(`all-sub[${o.id}]: CTA quotes the monthly tier price`,
      cta.includes(money(o.tiers[tierIdx].price) + '/mo'), cta);

    let addon = false;
    const addonInput = page.locator('#m-addon-input');
    if (await addonInput.count()) {
      check(`all-sub[${o.id}]: protection plan comes pre-checked`, await addonInput.isChecked());
      if (i % 2 === 1) {
        await addonInput.uncheck(); // half the players notice the trap
      } else {
        addon = true;
        expectedAddonCount++;
      }
    }

    await page.click('#modal [data-action="subscribe"]');
    await waitClosed(page);
    expected += o.tiers[tierIdx].price + (addon ? 1.99 : 0);
    chosen[o.id] = { tierIdx, addon };

    const t = await page.evaluate(() => window.YON.totalMonthly());
    check(`all-sub[${o.id}]: running total exact`, Math.abs(t - expected) < 0.005, `${t} vs ${expected}`);
  }

  await restoreRandom(page);
  await page.waitForTimeout(650); // let the odometer settle
  const odo = await page.getAttribute('#odometer', 'data-value');
  check('all-sub: odometer shows the exact grand total', odo === money(expected), `${odo} vs ${money(expected)}`);
  check('all-sub: 16 price chips on the art', (await page.locator('#chips [data-chip]').count()) === 16);
  check('all-sub: all-decided toast appears', (await page.locator('#all-done:not(.hidden)').count()) === 1);
  check('all-sub: decided counter reads 16 of 16',
    (await page.textContent('#decided-count')).trim() === '16 of 16 decided');

  await page.click('#toast-leave');
  await page.waitForSelector('#checkout:not(.hidden)', { timeout: 3000 });

  const lines = await page.$$eval('#receipt .r-line', (els) => els.map((e) => e.textContent));
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    const t = o.tiers[chosen[o.id].tierIdx];
    const line = lines.find((l) => l.startsWith(o.brand));
    check(`receipt: ${o.brand} itemized with tier + price`,
      !!line && line.includes(t.name) && line.includes(money(t.price)), line);
  }
  const addonLines = lines.filter((l) => l.includes('protection plan'));
  check('receipt: one add-on sub-line per kept protection plan',
    addonLines.length === expectedAddonCount, `${addonLines.length} vs ${expectedAddonCount}`);
  const totalLine = await page.textContent('#receipt .r-total');
  check('receipt: MONTHLY TOTAL equals the tier-by-tier sum',
    totalLine.includes(money(expected)), totalLine);
  const receiptText = await page.textContent('#receipt');
  check('receipt: PER YEAR is 12x', receiptText.includes(money(expected * 12)));
  check('receipt: exit method honors the door tier',
    receiptText.includes('front door (' + objects[7].tiers[chosen.door.tierIdx].name.toLowerCase() + ' hinge)'));
  check('receipt: even a fully subscribed tenant owns nothing',
    receiptText.includes('Items you actually own: 0'));

  check('all-sub: zero console errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* =================================================================
   2. decline everything — $0.00, husk apartment, still owns nothing
   ================================================================= */
{
  const { page, errors } = await newPage({ width: 1280, height: 800 });
  const ids = await page.evaluate(() => window.YON.objects.map((o) => o.id));

  for (const id of ids) {
    await openObj(page, id);
    await page.click('#modal [data-action="decline"]');
    await waitClosed(page);
    const declined = await page.evaluate(
      (oid) => document.querySelector(`.obj[data-id="${oid}"]`).classList.contains('declined'), id);
    check(`all-decline[${id}]: grayscale lands`, declined);
  }

  check('all-decline: total stays $0.00', (await page.evaluate(() => window.YON.totalMonthly())) === 0);
  await page.waitForTimeout(400);
  check('all-decline: odometer reads $0.00', (await page.getAttribute('#odometer', 'data-value')) === '$0.00');
  check('all-decline: zero price chips', (await page.locator('#chips [data-chip]').count()) === 0);

  // the declined door doubles as the exit
  await page.click('.obj[data-id="door"] .hit', { force: true });
  await page.waitForSelector('#checkout:not(.hidden)', { timeout: 3000 });
  const receiptText = await page.textContent('#receipt');
  check('all-decline: MONTHLY TOTAL $0.00 on the receipt',
    receiptText.includes('MONTHLY TOTAL') && receiptText.includes('$0.00'));
  const declinedLines = await page.$$eval('#receipt .r-line', (els) =>
    els.filter((e) => e.textContent.includes('declined')).length);
  check('all-decline: 16 declined lines', declinedLines === 16, String(declinedLines));
  check('all-decline: THE JOKE — declining also buys you nothing',
    receiptText.includes('Items you actually own: 0'));
  check('all-decline: exit is the window, undignified', receiptText.includes('window, undignified'));

  const share = await page.evaluate(() => window.YON.shareText());
  check('all-decline: share text embraces the husk',
    share.includes('No subscriptions') && share.includes('Items I actually own: 0'), share.slice(0, 60));

  check('all-decline: zero console errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* =================================================================
   3. state machine: subscribe -> keep -> cancel -> win-back -> resubscribe
      + reload persistence
   ================================================================= */
{
  const { page, errors } = await newPage({ width: 1280, height: 800 });
  await forcePattern(page, 4); // scarcity: no billing/addon noise, deterministic prices

  // subscribe the cat, Basic
  await openObj(page, 'cat');
  await page.click('#modal .tier[data-tier="0"]');
  await page.click('#modal [data-action="subscribe"]');
  await waitClosed(page);
  check('sm: cat Basic = $4.99', Math.abs(await page.evaluate(() => window.YON.totalMonthly()) - 4.99) < 0.005);
  check('sm: decided 1 of 16', (await page.textContent('#decided-count')).trim() === '1 of 16 decided');

  // manage modal: ACTIVE chip, keep does nothing
  await openObj(page, 'cat');
  check('sm: manage modal shows ACTIVE', (await page.locator('#modal .m-chip').count()) === 1);
  check('sm: keep-subscription CTA present', (await page.textContent('#modal .m-cta')).includes('Keep subscription'));
  await page.click('#modal .m-cta'); // Keep subscription = dismiss
  await waitClosed(page);
  check('sm: keeping changes nothing', Math.abs(await page.evaluate(() => window.YON.totalMonthly()) - 4.99) < 0.005);

  // cancel anyway
  await openObj(page, 'cat');
  await page.click('#modal [data-action="decline"]');
  await waitClosed(page);
  check('sm: cancel zeroes the total', (await page.evaluate(() => window.YON.totalMonthly())) === 0);
  check('sm: cancel grays the cat',
    await page.evaluate(() => document.querySelector('.obj[data-id="cat"]').classList.contains('declined')));
  check('sm: cancel removes the chip', (await page.locator('#chips [data-chip="cat"]').count()) === 0);
  check('sm: still 1 of 16 decided (declined counts as decided)',
    (await page.textContent('#decided-count')).trim() === '1 of 16 decided');

  // win-back, resubscribe at Max
  await openObj(page, 'cat');
  check('sm: win-back banner shows', (await page.locator('#modal .m-banner.winback').count()) === 1);
  check('sm: CTA verb is Resubscribe', (await page.textContent('#modal .m-cta')).includes('Resubscribe'));
  await page.click('#modal .tier[data-tier="2"]');
  await page.click('#modal [data-action="subscribe"]');
  await waitClosed(page);
  check('sm: resubscribed at Max = $13.99', Math.abs(await page.evaluate(() => window.YON.totalMonthly()) - 13.99) < 0.005);
  check('sm: cat un-grayed',
    await page.evaluate(() => !document.querySelector('.obj[data-id="cat"]').classList.contains('declined')));
  check('sm: chip shows the new price',
    (await page.textContent('#chips [data-chip="cat"] text')) === '$13.99/mo');

  // add a second subscription and a decline, then reload
  await openObj(page, 'lamp');
  await page.click('#modal .tier[data-tier="1"]');
  await page.click('#modal [data-action="subscribe"]');
  await waitClosed(page);
  await openObj(page, 'plant');
  await page.click('#modal [data-action="decline"]');
  await waitClosed(page);
  const before = await page.evaluate(() => ({
    total: window.YON.totalMonthly(),
    decisions: JSON.parse(JSON.stringify(window.YON.state.decisions))
  }));

  await page.reload();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({
    total: window.YON.totalMonthly(),
    decisions: JSON.parse(JSON.stringify(window.YON.state.decisions)),
    catChip: !!document.querySelector('#chips [data-chip="cat"]'),
    plantGray: document.querySelector('.obj[data-id="plant"]').classList.contains('declined'),
    odo: document.getElementById('odometer').getAttribute('data-value')
  }));
  check('persist: total survives reload', Math.abs(after.total - before.total) < 0.005, `${after.total} vs ${before.total}`);
  check('persist: decisions object identical',
    JSON.stringify(after.decisions) === JSON.stringify(before.decisions));
  check('persist: cat chip restored', after.catChip);
  check('persist: plant still gray', after.plantGray);
  check('persist: odometer restored instantly', after.odo === money(before.total), after.odo);

  check('sm: zero console errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* =================================================================
   4. dark patterns — each one asserted, then natural sampling
   ================================================================= */
{
  const { page, errors } = await newPage({ width: 1280, height: 800 });

  // A: annual preselect
  await forcePattern(page, 0);
  await openObj(page, 'tv');
  check('dp-annual: annual preselected',
    (await page.locator('.m-billing .bopt.on[data-billing="annual"]').count()) === 1);
  const bswitchSize = await page.$eval('.m-billing .bswitch', (el) => getComputedStyle(el).fontSize);
  check('dp-annual: escape hatch is tiny gray text', bswitchSize === '11px', bswitchSize);
  await page.click('.m-billing .bswitch');
  check('dp-annual: one click back to monthly',
    (await page.locator('.m-billing .bopt.on[data-billing="monthly"]').count()) === 1);
  check('dp-annual: CTA re-quotes /mo after the switch',
    (await page.textContent('#modal .m-cta')).includes('/mo'));
  await page.keyboard.press('Escape');
  await waitClosed(page);

  // B: rot decline
  await forcePattern(page, 1);
  await openObj(page, 'tv');
  const rot = page.locator('#modal .m-decline.rot');
  check('dp-rot: decline reads "let it rot"', (await rot.textContent()) === 'let it rot');
  const rotStyle = await rot.evaluate((el) => {
    const s = getComputedStyle(el);
    return { size: s.fontSize, color: s.color };
  });
  check('dp-rot: 11px gray humiliation', rotStyle.size === '11px', JSON.stringify(rotStyle));
  check('dp-rot: still keyboard-focusable',
    await rot.evaluate((el) => { el.focus(); return document.activeElement === el; }));
  check('dp-rot: still wired to decline', (await rot.getAttribute('data-action')) === 'decline');
  await page.keyboard.press('Escape');
  await waitClosed(page);

  // C: countdown that never ends
  await forcePattern(page, 2);
  await openObj(page, 'tv');
  const c0 = await page.textContent('#m-countdown');
  check('dp-countdown: starts at 04:59', c0 === '04:59', c0);
  await page.waitForTimeout(2300);
  const c1 = await page.textContent('#m-countdown');
  check('dp-countdown: actually ticks down', /^04:5[0-8]$/.test(c1) && c1 < c0, c1);
  await page.keyboard.press('Escape');
  await waitClosed(page);

  // D: most-expensive tier preselected + badge
  await forcePattern(page, 3);
  await openObj(page, 'tv');
  check('dp-popular: badge sits on the priciest tier',
    (await page.locator('#modal .tier[data-tier="2"] .t-badge').count()) === 1);
  check('dp-popular: priciest tier preselected',
    (await page.getAttribute('#modal .tier.on', 'data-tier')) === '2');
  await page.click('#modal .tier[data-tier="0"]');
  check('dp-popular: player can still pick Basic',
    (await page.getAttribute('#modal .tier.on', 'data-tier')) === '0');
  await page.keyboard.press('Escape');
  await waitClosed(page);

  // E: scarcity banner
  await forcePattern(page, 4);
  await openObj(page, 'tv');
  check('dp-scarcity: banner shows',
    (await page.textContent('#modal .m-banner')).includes('Only 3 subscriptions left'));
  await page.keyboard.press('Escape');
  await waitClosed(page);

  // F: pre-checked protection plan — kept, it bills; unchecked, it doesn't
  await forcePattern(page, 5);
  await openObj(page, 'tv');
  check('dp-addon: pre-checked', await page.isChecked('#m-addon-input'));
  await page.click('#modal .tier[data-tier="0"]');
  await page.click('#modal [data-action="subscribe"]'); // checked -> billed
  await waitClosed(page);
  let t = await page.evaluate(() => window.YON.totalMonthly());
  check('dp-addon: kept box adds $1.99', Math.abs(t - (11.99 + 1.99)) < 0.005, String(t));
  // cancel, resubscribe with the box unchecked
  await openObj(page, 'tv');
  await page.click('#modal [data-action="decline"]');
  await waitClosed(page);
  await openObj(page, 'tv'); // win-back, still forced addon pattern
  await page.uncheck('#m-addon-input');
  await page.click('#modal .tier[data-tier="0"]');
  await page.click('#modal [data-action="subscribe"]');
  await waitClosed(page);
  t = await page.evaluate(() => window.YON.totalMonthly());
  check('dp-addon: unchecked box does not bill', Math.abs(t - 11.99) < 0.005, String(t));

  // natural sampling: all six patterns must show up without any forcing
  await restoreRandom(page);
  const seen = new Set();
  for (let i = 0; i < 150 && seen.size < 6; i++) {
    await openObj(page, 'sofa');
    const sig = await page.evaluate(() => {
      if (document.querySelector('.m-billing')) return 'annual';
      if (document.querySelector('.m-decline.rot')) return 'rot';
      if (document.querySelector('#m-countdown')) return 'countdown';
      if (document.querySelector('.t-badge')) return 'popular';
      if (document.querySelector('#m-addon-input')) return 'addon';
      const b = document.querySelector('.m-banner');
      if (b && b.textContent.includes('Only 3')) return 'scarcity';
      return 'none';
    });
    seen.add(sig);
    await page.keyboard.press('Escape');
    await waitClosed(page);
  }
  check('dp-natural: all six patterns occur in the wild', seen.size >= 6, [...seen].join(','));

  check('dp: zero console errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* =================================================================
   5. keyboard-only journey: Tab / Enter / ESC, focus trap, focus return
   ================================================================= */
{
  const { page, errors } = await newPage({ width: 1280, height: 800 });

  // Tab from the top of the document until an object has focus
  let objId = null;
  for (let i = 0; i < 40 && !objId; i++) {
    await page.keyboard.press('Tab');
    objId = await page.evaluate(() => {
      const a = document.activeElement;
      return a && a.classList && a.classList.contains('obj') ? a.dataset.id : null;
    });
  }
  check('kb: an object is reachable by Tab', !!objId, String(objId));

  // Enter opens the modal, focus lands on the CTA
  await page.keyboard.press('Enter');
  await page.waitForSelector('#modal-root:not(.hidden)', { timeout: 3000 });
  check('kb: focus lands on the CTA',
    await page.evaluate(() => document.activeElement === document.querySelector('#modal .m-cta')));

  // focus never escapes the dialog (forward and backward)
  let trapped = true;
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    if (!(await page.evaluate(() => document.getElementById('modal').contains(document.activeElement)))) trapped = false;
  }
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Shift+Tab');
    if (!(await page.evaluate(() => document.getElementById('modal').contains(document.activeElement)))) trapped = false;
  }
  check('kb: Tab is trapped inside the dialog', trapped);

  // ESC closes and returns focus to the object
  await page.keyboard.press('Escape');
  await waitClosed(page);
  check('kb: ESC returns focus to the object',
    await page.evaluate((id) => document.activeElement === document.querySelector(`.obj[data-id="${id}"]`), objId));

  // Enter again, Enter on the CTA subscribes
  await page.keyboard.press('Enter');
  await page.waitForSelector('#modal-root:not(.hidden)', { timeout: 3000 });
  await page.keyboard.press('Enter'); // CTA is focused
  await waitClosed(page);
  const t = await page.evaluate(() => window.YON.totalMonthly());
  check('kb: Enter on CTA subscribes', t > 0, String(t));
  check('kb: focus back on the object after subscribing',
    await page.evaluate((id) => document.activeElement === document.querySelector(`.obj[data-id="${id}"]`), objId));

  // Enter on the subscribed object opens the manage modal; ESC backs out
  await page.keyboard.press('Enter');
  await page.waitForSelector('#modal-root:not(.hidden)', { timeout: 3000 });
  check('kb: manage modal opens by keyboard', (await page.locator('#modal .m-chip').count()) === 1);
  await page.keyboard.press('Escape');
  await waitClosed(page);

  // Space also activates (parity with Enter)
  await page.keyboard.press('Tab');
  const nextId = await page.evaluate(() => document.activeElement && document.activeElement.dataset
    ? document.activeElement.dataset.id : null);
  if (nextId) {
    await page.keyboard.press(' ');
    const opened = await page.locator('#modal-root:not(.hidden)').count();
    check('kb: Space opens the modal too', opened === 1);
    await page.keyboard.press('Escape');
    await waitClosed(page);
  }

  check('kb: zero console errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* =================================================================
   6. 320px viewport — no horizontal scroll at any stage
   ================================================================= */
{
  const { page, errors } = await newPage({ width: 320, height: 568 });
  async function noHScroll(stage) {
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      iw: window.innerWidth,
      bw: document.body.scrollWidth
    }));
    check(`320px: no horizontal scroll (${stage})`,
      m.sw <= m.iw + 1 && m.bw <= m.iw + 1, JSON.stringify(m));
  }
  await noHScroll('apartment');

  await openObj(page, 'sofa');
  await page.waitForTimeout(350); // let the modal-in scale animation finish before measuring
  await noHScroll('modal open');
  const modalBox = await page.locator('#modal').boundingBox();
  check('320px: modal fits the viewport', modalBox.width <= 320, String(modalBox.width));
  const ctaBox = await page.locator('#modal .m-cta').boundingBox();
  check('320px: CTA is a >=44px touch target', ctaBox.height >= 44, String(ctaBox.height));
  await page.click('#modal [data-action="subscribe"]');
  await waitClosed(page);

  await page.click('#leave-btn');
  await page.waitForSelector('#checkout:not(.hidden)', { timeout: 3000 });
  await noHScroll('checkout');
  await page.screenshot({ path: path.join(shotsDir, 'qa-320-receipt.png') });

  check('320px: zero console errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* =================================================================
   7. aesthetic screenshot pack (reviewed by eye, separately)
   ================================================================= */
{
  const { page } = await newPage({ width: 1280, height: 800 });

  // 7.1 pristine apartment
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shotsDir, 'qa-desktop-initial.png') });

  // 7.2 hover state on the sofa
  await page.hover('.obj[data-id="sofa"] .hit', { force: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shotsDir, 'qa-hover-sofa.png') });
  await page.mouse.move(10, 10);

  // 7.3 the cat modal with the pre-checked protection plan
  await forcePattern(page, 5);
  await openObj(page, 'cat');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shotsDir, 'qa-modal-cat.png') });
  await page.keyboard.press('Escape');
  await waitClosed(page);
  await restoreRandom(page);

  // 7.4 half subscribed / half declined (state injected, then reloaded)
  await page.evaluate(() => {
    const ids = window.YON.objects.map((o) => o.id);
    const decisions = {};
    ids.forEach((id, i) => {
      decisions[id] = i % 2 === 0
        ? { status: 'subscribed', tier: i % 3, addon: i % 4 === 0 }
        : { status: 'declined' };
    });
    localStorage.setItem('yon-state-v1', JSON.stringify({ v: 1, decisions, moveIns: 0 }));
  });
  await page.reload();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(shotsDir, 'qa-half-half.png') });

  // 7.5 everything declined — the husk
  await page.evaluate(() => {
    const decisions = {};
    window.YON.objects.forEach((o) => { decisions[o.id] = { status: 'declined' }; });
    localStorage.setItem('yon-state-v1', JSON.stringify({ v: 1, decisions, moveIns: 0 }));
  });
  await page.reload();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(shotsDir, 'qa-all-declined.png') });

  // 7.6 the receipt, from the half-half state
  await page.evaluate(() => {
    const ids = window.YON.objects.map((o) => o.id);
    const decisions = {};
    ids.forEach((id, i) => {
      decisions[id] = i % 2 === 0
        ? { status: 'subscribed', tier: i % 3, addon: i % 4 === 0 }
        : { status: 'declined' };
    });
    localStorage.setItem('yon-state-v1', JSON.stringify({ v: 1, decisions, moveIns: 0 }));
  });
  await page.reload();
  await page.waitForTimeout(500);
  await page.click('#leave-btn');
  await page.waitForSelector('#checkout:not(.hidden)', { timeout: 3000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shotsDir, 'qa-receipt.png') });

  // 7.7 the share card PNG itself
  const dataUrl = await page.evaluate(() => window.YON.shareCardDataURL());
  fs.writeFileSync(path.join(shotsDir, 'qa-sharecard.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
  check('shots: share card PNG written', dataUrl.length > 20000);
  await page.close();

  // 7.8 mobile apartment + bottom-sheet modal
  const { page: mp } = await newPage({ width: 375, height: 667 });
  await mp.waitForTimeout(400);
  await mp.screenshot({ path: path.join(shotsDir, 'qa-mobile.png') });
  await forcePattern(mp, 0); // annual toggle is the widest layout
  await openObj(mp, 'window');
  await mp.waitForTimeout(300);
  await mp.screenshot({ path: path.join(shotsDir, 'qa-mobile-modal.png') });
  await mp.close();
}

await browser.close();

console.log(failures === 0 ? '\nALL QA CHECKS PASSED' : `\n${failures} QA CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
