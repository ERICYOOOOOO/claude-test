/* 每日一法 · QA 对抗性验收测试（node projects/daily-law/test/qa-extra.mjs）
 * 独立于 smoke.mjs，覆盖：
 *  1. 排期确定性：时钟注入 2026-01-01 起 30 天 × 7 轨，与 PLAYBOOK 规格逐条对照；
 *     同轨相邻两天必不相同（含覆盖日两侧规则）；400 天全轨扫描零相邻重复；
 *     任意 7 天窗口内同条至多出现 2 次且仅当窗口含其节点日；
 *     16 个 dateOverride 节点日全部命中正确条目；非节点日走轮转、不误触发。
 *  2. 轨道状态：切轨后刷新回到默认中国轨（设计即如此：localStorage 只存收藏）；
 *     收藏跨轨混合后列表正确、移除/取消即时生效、刷新持久。
 *  3. 复制文本：含条文引号体 + 出处 + 生效年份 + 原文名 + 域名，零 HTML 标签泄漏。
 *  4. 极端：三种垃圾 localStorage、320px 视口、连续快速切轨 20 次无动画残留、零 console error。
 */
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const INDEX = pathToFileURL(path.join(DIR, '..', 'index.html')).href;
const require = createRequire(import.meta.url);
const { LAW_TRACKS, LAWS } = require(path.join(DIR, '..', 'laws.js'));

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ok - ' + msg); }
  else { fail++; console.error('  FAIL - ' + msg); }
}

const errors = [];
function watch(page, tag) {
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}`));
}

/* ---------- PLAYBOOK 规格的独立实现（与 app.js 互为对照） ---------- */
function two(n) { return (n < 10 ? '0' : '') + n; }
function trackSalt(id) { let s = 0; for (let i = 0; i < id.length; i++) s = (s * 31 + id.charCodeAt(i)) % 9973; return s; }
const POOLS = {}; LAW_TRACKS.forEach(t => { POOLS[t.id] = LAWS.filter(e => e.track === t.id); });
function specInfo(base, offset) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, 12, 0, 0);
  return { date: d, seed: Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000), mmdd: two(d.getMonth() + 1) + '-' + two(d.getDate()) };
}
function specPick(trackId, info) {
  const pool = POOLS[trackId];
  for (const e of pool) if (e.dateOverride === info.mmdd) return e;
  let idx = ((info.seed + trackSalt(trackId)) % pool.length + pool.length) % pool.length;
  const t = new Date(info.date.getFullYear(), info.date.getMonth(), info.date.getDate() + 1);
  const y = new Date(info.date.getFullYear(), info.date.getMonth(), info.date.getDate() - 1);
  const tmmdd = two(t.getMonth() + 1) + '-' + two(t.getDate());
  const ymmdd = two(y.getMonth() + 1) + '-' + two(y.getDate());
  if (pool[idx].dateOverride === tmmdd) idx = (idx + 1) % pool.length;
  else if (pool[idx].dateOverride === ymmdd) idx = (idx - 1 + pool.length) % pool.length;
  return pool[idx];
}

/* PLAYBOOK 排期表：16 个节点日 */
const NODES = [
  ['03-08', 'intl', '消除对妇女一切形式歧视公约》第一条'],
  ['03-15', 'cn', '消费者权益保护法》第二十五条'],
  ['04-22', 'intl', '巴黎协定'],
  ['05-01', 'cn', '劳动法》第三十六条'],
  ['05-03', 'jp', '日本国宪法》第九条'],
  ['05-23', 'de', '基本法》第一条'],
  ['06-01', 'intl', '儿童权利公约》第三十一条'],
  ['06-08', 'intl', '海洋法公约》第一百三十六条'],
  ['06-15', 'uk', '大宪章》第三十九条'],
  ['06-26', 'intl', '禁止酷刑公约》第二条'],
  ['07-14', 'fr', '人权和公民权宣言》第一条'],
  ['08-26', 'us', '第十九修正案'],
  ['09-01', 'cn', '义务教育法》第二条'],
  ['09-17', 'us', '美国宪法序言'],
  ['12-04', 'cn', '宪法》第三十三条'],
  ['12-10', 'intl', '世界人权宣言》第一条']
];
ok(NODES.length === 16, '排期表共 16 个节点日');

const TRACK_IDS = LAW_TRACKS.map(t => t.id);
const BASE = new Date(2026, 0, 1); /* 注入基准：2026-01-01 */
const BASE_TS = new Date(2026, 0, 1, 12, 0, 0).getTime();

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/* ================= 1. 排期确定性（时钟注入 + 全轨扫描） ================= */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  watch(page, 'schedule');
  await page.addInitScript(t => { window.__FAKE_NOW__ = t; }, BASE_TS);
  await page.goto(INDEX);
  await page.waitForFunction(() => document.querySelector('#lawText').textContent.length > 0);

  /* 30 天 × 7 轨：应用选条 === 规格选条，逐条对照 */
  const grid = await page.evaluate(ids => {
    const out = {};
    for (const id of ids) {
      out[id] = [];
      for (let off = 0; off < 30; off++) out[id].push(window.__dailylaw.getEntry(id, off).source);
    }
    return out;
  }, TRACK_IDS);
  let specMatch = true, adjDup = false;
  for (const id of TRACK_IDS) {
    for (let off = 0; off < 30; off++) {
      const exp = specPick(id, specInfo(BASE, off)).source;
      if (grid[id][off] !== exp) { specMatch = false; console.error(`    规格不符：${id} +${off} 天 app=${grid[id][off]} spec=${exp}`); }
      if (off > 0 && grid[id][off] === grid[id][off - 1]) { adjDup = true; console.error(`    相邻重复：${id} +${off} 天 ${grid[id][off]}`); }
    }
  }
  ok(specMatch, '30 天 × 7 轨：应用选条与 PLAYBOOK 规格逐日一致（210 格）');
  ok(!adjDup, '30 天 × 7 轨：同轨相邻两天内容必不相同');

  /* 400 天全轨扫描：零相邻重复；7 天窗口同条 ≤2 次且仅当窗口含其节点日 */
  const year = await page.evaluate(ids => {
    const out = {};
    for (const id of ids) {
      out[id] = [];
      for (let off = 0; off < 400; off++) {
        const e = window.__dailylaw.getEntry(id, off);
        out[id].push({ s: e.source, ov: e.dateOverride || null });
      }
    }
    return out;
  }, TRACK_IDS);
  let adjRepeats = 0, badWindows = 0;
  for (const id of TRACK_IDS) {
    const seq = year[id];
    for (let i = 1; i < seq.length; i++) if (seq[i].s === seq[i - 1].s) adjRepeats++;
    for (let i = 0; i + 7 <= seq.length; i++) {
      const win = seq.slice(i, i + 7);
      const counts = {};
      win.forEach(e => { counts[e.s] = (counts[e.s] || 0) + 1; });
      for (const [src, c] of Object.entries(counts)) {
        if (c > 2) { badWindows++; console.error(`    7 天窗口 ${id}+${i}：${src} 出现 ${c} 次`); }
        else if (c === 2) {
          /* 允许出现两次的唯一情形：该条是覆盖条且窗口含其节点日 */
          const entry = win.find(e => e.s === src);
          const winDates = [];
          for (let k = 0; k < 7; k++) {
            const d = new Date(BASE.getFullYear(), BASE.getMonth(), BASE.getDate() + i + k, 12);
            winDates.push((d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate());
          }
          if (!entry.ov || !winDates.includes(entry.ov)) {
            badWindows++; console.error(`    7 天窗口 ${id}+${i}：${src} 无节点日却出现 2 次`);
          }
        }
      }
    }
  }
  ok(adjRepeats === 0, `400 天 × 7 轨扫描：零相邻重复（${adjRepeats}）`);
  ok(badWindows === 0, `任意 7 天窗口同条 ≤2 次，且重复仅出现在节点日窗口（违例 ${badWindows}）`);

  /* 16 个节点日全部命中正确条目（用与 2026-01-01 的天数差作 offset） */
  let nodeHits = 0;
  for (const [mmdd, trackId, snippet] of NODES) {
    const [mm, dd] = mmdd.split('-').map(Number);
    const target = new Date(2026, mm - 1, dd, 12);
    const off = Math.round((target - new Date(2026, 0, 1, 12)) / 86400000);
    const got = await page.evaluate(([id, o]) => window.__dailylaw.getEntry(id, o), [trackId, off]);
    const hit = got.source.includes(snippet) && got.dateOverride === mmdd;
    if (hit) nodeHits++;
    else console.error(`    节点未命中：${mmdd} ${trackId} 期望含「${snippet}」，实际 ${got.source}（override=${got.dateOverride}）`);
  }
  ok(nodeHits === 16, `16 个 dateOverride 节点日全部命中正确条目（${nodeHits}/16）`);

  /* 非节点日不误触发：节点日前后一天，选条结果必须等于规格轮转（含防重复规则），
     且当天返回条目的 dateOverride 不等于当天 mmdd 之外的任何强制注入 */
  let sideOK = true;
  for (const [mmdd, trackId] of NODES) {
    const [mm, dd] = mmdd.split('-').map(Number);
    for (const delta of [-1, 1]) {
      const target = new Date(2026, mm - 1, dd + delta, 12);
      const off = Math.round((target - new Date(2026, 0, 1, 12)) / 86400000);
      if (off < 0) continue;
      const got = await page.evaluate(([id, o]) => window.__dailylaw.getEntry(id, o).source, [trackId, off]);
      const exp = specPick(trackId, specInfo(BASE, off)).source;
      if (got !== exp) { sideOK = false; console.error(`    节点侧翼误触发：${mmdd}${delta > 0 ? '+1' : '-1'} ${trackId} got=${got} exp=${exp}`); }
    }
  }
  ok(sideOK, '节点日前后一天均走常规轮转，不误触发覆盖');
  await ctx.close();
}

/* ================= 2. 轨道状态 + 收藏跨轨 ================= */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  watch(page, 'state');
  await page.goto(INDEX);
  await page.waitForFunction(() => document.querySelector('#lawText').textContent.length > 0);

  /* 切轨后刷新：设计为回到默认中国轨（localStorage 只持久化收藏） */
  await page.click('.tracks button[data-track="fr"]');
  await page.waitForFunction(() => window.__dailylaw.getState().track === 'fr');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#lawText').textContent.length > 0);
  const afterReload = await page.evaluate(() => window.__dailylaw.getState().track);
  ok(afterReload === 'cn', '刷新后回到默认中国轨（按设计：轨道选择不持久化）');
  const selTab = await page.getAttribute('.tracks button[data-track="cn"]', 'aria-selected');
  ok(selTab === 'true', '刷新后 tab 选中态与状态一致');

  /* 跨轨混合收藏：cn / us / intl 各一条 */
  const favSources = [];
  for (const id of ['cn', 'us', 'intl']) {
    await page.click(`.tracks button[data-track="${id}"]`);
    await page.waitForFunction(t => window.__dailylaw.getState().track === t, id);
    const exp = await page.evaluate(t => window.__dailylaw.getEntry(t, 0), id);
    await page.waitForFunction(s => document.querySelector('#sourceLine').textContent.includes(s), exp.source);
    await page.click('#btnFav');
    await page.waitForFunction(() => document.querySelector('#btnFav').getAttribute('aria-pressed') === 'true');
    favSources.push(exp.source);
  }
  await page.click('#btnFavsPanel');
  await page.waitForSelector('#favsPanel:not([hidden])');
  let items = await page.$$eval('#favsList li', lis => lis.map(li => li.querySelector('.fav-src').textContent));
  ok(items.length === 3, `跨轨收藏 3 条，列表 3 项（实际 ${items.length}）`);
  ok(items[0].startsWith('中国 ·') && items[1].startsWith('美国 ·') && items[2].startsWith('国际条约 ·'),
    '收藏列表轨道名逐项正确（中国/美国/国际条约）');
  ok(items.every((t, i) => t.includes(favSources[i])), '收藏列表出处与入藏条目一致');
  ok((await page.textContent('#favsCount')) === '3', '收藏计数徽标 = 3');

  /* 移除中间一条（美国）：即时生效 */
  await page.click('#favsList li:nth-child(2) .fav-remove');
  await page.waitForFunction(() => document.querySelectorAll('#favsList li').length === 2);
  items = await page.$$eval('#favsList li', lis => lis.map(li => li.querySelector('.fav-src').textContent));
  ok(items.length === 2 && !items.some(t => t.startsWith('美国 ·')), '面板移除即时生效，美国条目消失');
  ok((await page.textContent('#favsCount')) === '2', '移除后计数即时更新为 2');

  /* 当前（intl）用主按钮取消收藏：按钮态与面板同时更新 */
  await page.click('#btnFav');
  await page.waitForFunction(() => document.querySelector('#btnFav').getAttribute('aria-pressed') === 'false');
  await page.waitForFunction(() => document.querySelectorAll('#favsList li').length === 1);
  ok(true, '主按钮取消收藏即时同步面板（剩 1 条）');

  /* 刷新持久：剩余 1 条（中国轨今日条）仍在 */
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#lawText').textContent.length > 0);
  ok((await page.getAttribute('#btnFav', 'aria-pressed')) === 'true', '刷新后中国轨收藏态持久');
  await page.click('#btnFavsPanel');
  await page.waitForSelector('#favsPanel:not([hidden])');
  const after = await page.$$eval('#favsList li', lis => lis.map(li => li.querySelector('.fav-src').textContent));
  ok(after.length === 1 && after[0].includes(favSources[0]), '刷新后收藏列表仍为剩余 1 条且内容正确');
  await ctx.close();
}

/* ================= 3. 复制文本完整性与无 HTML 泄漏 ================= */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  watch(page, 'copy');
  await page.goto(INDEX);
  await page.waitForFunction(() => document.querySelector('#lawText').textContent.length > 0);
  for (const id of ['cn', 'intl']) {
    await page.click(`.tracks button[data-track="${id}"]`);
    await page.waitForFunction(t => window.__dailylaw.getState().track === t, id);
    const exp = await page.evaluate(t => window.__dailylaw.getEntry(t, 0), id);
    await page.waitForFunction(s => document.querySelector('#sourceLine').textContent.includes(s), exp.source);
    await page.click('#btnCopy');
    await page.waitForSelector('#toast.show');
    const txt = await page.evaluate(() => window.__dailylaw.lastCopiedText);
    ok(txt.includes('「' + exp.text + '」'), `轨【${id}】复制文本含完整条文引号体`);
    ok(txt.includes(exp.source) && txt.includes(exp.enact), `轨【${id}】复制文本含出处与生效年份`);
    ok(txt.includes('meiriyifa.app'), `轨【${id}】复制文本含域名回流位`);
    if (id !== 'cn') ok(txt.includes(exp.origName), `轨【${id}】复制文本含原文名`);
    else ok(!txt.includes('原文：'), '中国轨复制文本不带原文行');
    ok(!/<[a-zA-Z][^>]*>/.test(txt), `轨【${id}】复制文本零 HTML 标签泄漏`);
  }
  await ctx.close();
}

/* ================= 4a. 三种垃圾 localStorage ================= */
{
  const garbages = [
    ['纯数组', '[1,2,3]'],
    ['favs 非数组', '{"v":1,"favs":"cn|xx"}'],
    ['favs 混垃圾', '{"v":1,"favs":[123,null,{"a":1},"cn|不存在的出处","us|Fake, Art. 0"]}']
  ];
  for (const [name, raw] of garbages) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    watch(page, 'garbage:' + name);
    await page.addInitScript(g => { try { localStorage.setItem('dailylaw.v1', g); } catch (e) {} }, raw);
    await page.goto(INDEX);
    await page.waitForFunction(() => document.querySelector('#lawText').textContent.length > 0);
    const favs = await page.evaluate(() => window.__dailylaw.getState().favs);
    ok(Array.isArray(favs) && favs.length === 0, `垃圾 localStorage（${name}）→ 收藏回退为空，页面正常`);
    ok((await page.getAttribute('#btnFav', 'aria-pressed')) === 'false', `垃圾（${name}）后收藏按钮为未收藏态`);
    await ctx.close();
  }
}

/* ================= 4b. 320px 视口 ================= */
{
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, hasTouch: true });
  const page = await ctx.newPage();
  watch(page, '320px');
  await page.goto(INDEX);
  await page.waitForFunction(() => document.querySelector('#lawText').textContent.length > 0);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '320px 无横向滚动');
  const lawVisible = await page.evaluate(() => {
    const r = document.querySelector('#lawText').getBoundingClientRect();
    return r.width > 200 && r.height > 20;
  });
  ok(lawVisible, '320px 条文区可读');
  const btnBox = await page.locator('#btnShare').boundingBox();
  ok(btnBox && btnBox.height >= 44, `320px 操作按钮触控高度 ≥44px（${btnBox ? Math.round(btnBox.height) : 0}）`);
  /* 320px 下分享卡弹层仍可用 */
  await page.click('#btnShare');
  await page.waitForSelector('#shareModal:not([hidden])');
  const card = await page.evaluate(() => window.__dailylaw.lastCardDataURL);
  ok(card && card.startsWith('data:image/png') && card.length > 10000, '320px 分享卡照常生成');
  await page.click('#btnCloseModal');
  await ctx.close();
}

/* ================= 4c. 连续快速切轨 20 次 ================= */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  watch(page, 'rapid');
  await page.goto(INDEX);
  await page.waitForFunction(() => document.querySelector('#lawText').textContent.length > 0);
  const seq = [];
  for (let i = 0; i < 20; i++) seq.push(TRACK_IDS[(i * 3 + 1) % TRACK_IDS.length]);
  for (const id of seq) {
    await page.click(`.tracks button[data-track="${id}"]`);
    await page.waitForTimeout(25); /* 快于 120ms 出场动画，制造中断 */
  }
  const last = seq[seq.length - 1];
  const exp = await page.evaluate(t => window.__dailylaw.getEntry(t, 0), last);
  await page.waitForFunction(s => document.querySelector('#sourceLine').textContent.includes(s), exp.source);
  ok((await page.textContent('#lawText')) === exp.text, `快速切轨 20 次后渲染 = 最后所选轨【${last}】`);
  await page.waitForTimeout(400);
  const clean = await page.evaluate(() => {
    const leaf = document.querySelector('#leaf');
    const cs = getComputedStyle(leaf);
    return {
      classes: leaf.className,
      opacity: cs.opacity,
      noFlip: !leaf.classList.contains('flip-out') && !leaf.classList.contains('flip-in')
    };
  });
  ok(clean.noFlip && clean.opacity === '1', `动画结算干净：无残留 flip 类、opacity=1（class="${clean.classes}"）`);
  const selCount = await page.$$eval('.tracks button[aria-selected="true"]', b => b.length);
  ok(selCount === 1, '始终只有一个 tab 处于选中态');
  await ctx.close();
}

await browser.close();

if (errors.length) {
  console.error('\nconsole/page 错误：');
  for (const e of errors) console.error('  ' + e);
}
ok(errors.length === 0, `全部场景零 console error / pageerror（${errors.length} 条）`);

console.log(`\nqa-extra.mjs：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
