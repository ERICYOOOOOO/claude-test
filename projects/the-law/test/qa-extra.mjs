/* 今日之律 — 对抗性 QA 附加测试（独立 QA 视角）
 * 运行（从仓库根 /home/user/claude-test）：node projects/the-law/test/qa-extra.mjs
 *
 * 覆盖（在 rules.mjs / smoke.mjs 之外）：
 *  A. 引擎层（node 直跑）
 *   A1. 上线纪念日锚点：2026-02-13 → 期号 1
 *   A2. 公平性抽查：随机 10 期，终审官方答案 == 实验期同三元组的 ✓✗（同一判定器）
 *   A3. 可玩性：脚本"聪明玩家"（候选规则空间 + 最大分裂实验，≤10 次）
 *       在 6 个周一档上全部 ≥7/8 —— 周一规则可被合理策略推出，不是纯猜
 *  B. 浏览器层（Playwright，file://，时钟注入）
 *   B1. 5 个不同日期：期号正确、难度点数正确、每日规则互不相同且与引擎一致、
 *       同日两次进入终审题面逐位相同（确定性）
 *   B2. 极端输入：越界输入钳制、(1,1,1)、(20,20,20)、重复三元组按 PLAYBOOK
 *       给「已实验过（№ xx），不再计次」提示、Enter 提交、提示行刷新后不复活
 *   B3. 端到端公平性：练习 2 期，把终审 8 题原样提交为实验，盖章与官方答案一致
 *   B4. 半损坏 localStorage（只删一个 key / history 类型错误）不崩、可玩
 *   B5. 练习不影响今日连胜（含 lastCracked/best/history）；
 *       回归：终审答题 800ms 换题窗口内点「返回今日」不得重结算今日卷宗
 */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const DIR = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(DIR, '..', 'app.js');
const INDEX = pathToFileURL(path.join(DIR, '..', 'index.html')).href;
const L = require(APP);

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ok - ' + msg); }
  else { fail++; console.error('  FAIL - ' + msg); }
}

/* ================= A. 引擎层 ================= */
console.log('\n[A1] 锚点');
{
  const day0213 = Math.floor(Date.UTC(2026, 1, 13, 12) / 86400000);
  ok(L.issueOf(day0213) === 1, `2026-02-13 → 期号 1（LAUNCH_DAY=${L.LAUNCH_DAY}）`);
}

console.log('\n[A2] 公平性抽查（随机 10 期）');
{
  const rng = L.mulberry32(0xFA1122);
  const seen = new Set();
  while (seen.size < 10) seen.add(1 + Math.floor(rng() * 380));
  for (const issue of seen) {
    const day = L.LAUNCH_DAY + issue - 1;
    const rule = L.dailyRule(day);
    const exam = L.buildExam(day);
    let mismatch = 0, posN = 0;
    for (const it of exam.items) {
      /* 实验期玩家提交同一三元组会得到 rule.pred(t) 的 ✓✗ —— 必须与官方答案一致 */
      if (rule.pred(it.t) !== it.label) mismatch++;
      if (it.label) posN++;
    }
    ok(mismatch === 0 && posN === 4,
      `期 ${issue}（${rule.text}）：官方答案与实验判定一致，4 正 4 负`);
  }
}

console.log('\n[A3] 可玩性：聪明玩家 vs 6 个周一档');
{
  const DOMAIN = [];
  for (let a = L.MIN; a <= L.MAX; a++)
    for (let b = L.MIN; b <= L.MAX; b++)
      for (let c = L.MIN; c <= L.MAX; c++) DOMAIN.push([a, b, c]);

  function tierInstances(tier) {
    const out = [];
    for (const r of L.RULES) if (r.tier === tier)
      for (const p of r.params) out.push({ name: r.id + ' ' + JSON.stringify(p), pred: t => !!r.pred(t, p) });
    return out;
  }

  /* 玩家策略：维护该难度档全部（模板×参数）候选，第一枪打示例 2·4·6，
   * 之后每次选一个能把剩余候选分裂得最均匀的三元组做实验（信息最大化，
   * 相当于系统性二分），候选收敛后按多数票裁定终审。 */
  function smartPlayer(day, maxExp) {
    const rule = L.dailyRule(day);
    let cands = tierInstances(rule.tier);
    const tried = new Set();
    let t = [2, 4, 6], nExp = 0;
    for (let n = 0; n < maxExp; n++) {
      if (n > 0) {
        let best = null, bestScore = 0;
        for (const q of DOMAIN) {
          const key = q.join(',');
          if (tried.has(key)) continue;
          let yes = 0;
          for (const c of cands) if (c.pred(q)) yes++;
          const score = Math.min(yes, cands.length - yes);
          if (score > bestScore) { bestScore = score; best = q; }
        }
        if (!best) break; /* 剩余候选在全域上外延等价 —— 已推出法则 */
        t = best;
      }
      tried.add(t.join(','));
      const okAns = rule.pred(t);
      nExp++;
      cands = cands.filter(c => c.pred(t) === okAns);
    }
    const exam = L.buildExam(day);
    let correct = 0;
    for (const it of exam.items) {
      let yes = 0;
      for (const c of cands) if (c.pred(it.t)) yes++;
      if ((yes * 2 >= cands.length) === it.label) correct++;
    }
    return { nExp, left: cands.length, correct, text: rule.text };
  }

  const today = L.localDayIndex();
  const mondays = [];
  for (let d = today; mondays.length < 6; d++) if (L.weekdayOf(d) === 1) mondays.push(d);
  for (const day of mondays) {
    const r = smartPlayer(day, 10);
    ok(r.correct >= 7 && r.nExp <= 10,
      `day ${day}（${r.text}）：${r.nExp} 次实验、剩 ${r.left} 个候选、终审 ${r.correct}/8`);
  }
}

/* ================= B. 浏览器层 ================= */

const errors = [];
function watch(page, tag) {
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}`));
}
function fakeClock(ctx, ts) {
  return ctx.addInitScript(ts => {
    const Real = Date;
    const delta = ts - Real.now();
    // eslint-disable-next-line no-global-assign
    Date = class extends Real {
      constructor(...a) { if (a.length) { super(...a); } else { super(Real.now() + delta); } }
      static now() { return Real.now() + delta; }
    };
  }, ts);
}
async function answerExamByLabels(page) {
  const labels = await page.evaluate(() => window.__thelaw.getExam().items.map(i => i.label));
  for (let i = 0; i < 8; i++) {
    await page.waitForFunction(
      i => document.getElementById('qNum').textContent === String(i + 1) &&
           !document.getElementById('voteOk').disabled,
      i, { timeout: 5000 }
    );
    await page.click(labels[i] ? '#voteOk' : '#voteNo');
  }
  await page.waitForSelector('#resultSec:not([hidden])', { timeout: 8000 });
}
async function submitTriple(page, t) {
  await page.fill('#num0', String(t[0]));
  await page.fill('#num1', String(t[1]));
  await page.fill('#num2', String(t[2]));
  await page.click('#submitBtn');
  await page.waitForTimeout(280);
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/* ---------- B1. 时钟注入 5 个日期 ---------- */
console.log('\n[B1] 时钟注入 5 个日期');
{
  const DATES = [
    [2026, 6, 5],   /* 周日 二档 */
    [2026, 6, 6],   /* 周一 一档 */
    [2026, 6, 7],   /* 周二 一档 */
    [2026, 6, 8],   /* 周三 二档 */
    [2026, 6, 11]   /* 周六 三档（地狱日） */
  ];
  const seenRules = [];
  for (const [y, m, d] of DATES) {
    const ts = Date.UTC(y, m, d, 10, 30);
    const expDay = Math.floor(ts / 86400000);   /* 环境 TZ=UTC */
    const expRule = L.dailyRule(expDay);
    const expIssue = L.issueOf(expDay);
    const expExam = JSON.stringify(L.buildExam(expDay).items);

    const ctx = await browser.newContext();
    await fakeClock(ctx, ts);
    const page = await ctx.newPage();
    watch(page, `B1-${y}-${m + 1}-${d}`);
    await page.goto(INDEX);
    await page.waitForSelector('#labSec:not([hidden])');
    const got = await page.evaluate(() => ({
      fileNo: document.getElementById('fileNo').textContent,
      dots: document.getElementById('fileDiff').textContent,
      redacted: document.getElementById('lawText').classList.contains('redacted'),
      issue: window.__thelaw.getSession().issue,
      ruleText: window.__thelaw.getExam().rule.text,
      exam: JSON.stringify(window.__thelaw.getExam().items)
    }));
    ok(got.issue === expIssue && got.fileNo === '№ ' + String(expIssue).padStart(4, '0'),
      `${y}-${m + 1}-${d} 期号 ${got.issue} 与抬头 ${got.fileNo} 正确`);
    ok(got.dots === '●●●'.slice(0, expRule.tier) + '○○○'.slice(0, 3 - expRule.tier),
      `${y}-${m + 1}-${d} 难度点 ${got.dots} = ${expRule.tier} 档`);
    ok(got.ruleText === expRule.text, `${y}-${m + 1}-${d} 规则与引擎一致（${got.ruleText}）`);
    ok(got.redacted, `${y}-${m + 1}-${d} 开局法则处于涂黑遮蔽态`);
    ok(got.exam === expExam, `${y}-${m + 1}-${d} 终审题面与引擎逐位一致`);
    seenRules.push(got.ruleText);
    await ctx.close();

    /* 同日第二次全新进入：终审题面必须逐位相同（确定性） */
    if (d === 11) {
      const ctx2 = await browser.newContext();
      await fakeClock(ctx2, ts + 3600e3);   /* 同日不同时刻 */
      const page2 = await ctx2.newPage();
      watch(page2, 'B1-det');
      await page2.goto(INDEX);
      await page2.waitForSelector('#labSec:not([hidden])');
      const exam2 = await page2.evaluate(() => JSON.stringify(window.__thelaw.getExam().items));
      ok(exam2 === expExam, `${y}-${m + 1}-${d} 同日两次进入终审题面相同`);
      await ctx2.close();
    }
  }
  ok(new Set(seenRules).size === 5, `5 个日期的每日规则互不相同（${new Set(seenRules).size}/5）`);
}

/* ---------- B2 + B3. 极端输入 / 端到端公平性（2026-07-06） ---------- */
console.log('\n[B2] 极端输入与键盘');
{
  const ts = Date.UTC(2026, 6, 6, 9, 0);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await fakeClock(ctx, ts);
  const page = await ctx.newPage();
  watch(page, 'B2');
  await page.goto(INDEX);
  await page.waitForSelector('#labSec:not([hidden])');

  /* 越界/垃圾输入钳制 */
  await page.fill('#num0', '999');
  await page.locator('#num0').blur();
  ok(await page.inputValue('#num0') === '20', '输入 999 钳制为 20');
  await page.fill('#num1', '0');
  await page.locator('#num1').blur();
  ok(await page.inputValue('#num1') === '1', '输入 0 钳制为 1');
  await page.fill('#num2', 'abc');
  await page.locator('#num2').blur();
  ok(await page.inputValue('#num2') === '1', '输入 abc 回退为 1');

  /* 极端三元组 */
  await submitTriple(page, [1, 1, 1]);
  await submitTriple(page, [20, 20, 20]);
  ok(await page.locator('#ledgerBody tr').count() === 2, '(1,1,1) 与 (20,20,20) 均可提交入账');
  const stamps = await page.evaluate(() => {
    const s = window.__thelaw.getSession();
    const r = window.__thelaw.getExam().rule;
    return s.exps.every((e, i) => e.ok === r.pred(e.t));
  });
  ok(stamps, '极端样本盖章与判定器一致');

  /* 重复同一三元组：PLAYBOOK 规格 —— 不计次 + 指明原序号 */
  for (let i = 0; i < 4; i++) await page.click('#submitBtn', { delay: 0 });
  await page.waitForTimeout(320);
  await page.click('#submitBtn');
  ok(await page.locator('#ledgerBody tr').count() === 2, '重复 (20,20,20) 多次不新增台账行');
  const noteTxt = await page.textContent('#benchNote');
  ok(noteTxt.includes('已实验过') && noteTxt.includes('№ 02') && noteTxt.includes('不再计次'),
    `重复提示符合规格：「${noteTxt}」`);

  /* 提示行提交后消失且刷新不复活 */
  ok(await page.isHidden('#hint'), '示例提示已消失');
  await page.reload();
  await page.waitForSelector('#labSec:not([hidden])');
  ok(await page.isHidden('#hint'), '刷新后示例提示不复活');
  ok(await page.locator('#ledgerBody tr').count() === 2, '刷新后台账持久（2 条）');

  /* 键盘 Enter 提交 */
  await page.fill('#num0', '3'); await page.fill('#num1', '7'); await page.fill('#num2', '12');
  await page.focus('#num2');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(280);
  ok(await page.locator('#ledgerBody tr').count() === 3, 'Enter 键提交实验成功');

  /* 完成今日 → 解锁档案 */
  await page.click('#finalBtn');
  await page.waitForSelector('#confirmBox:not([hidden])');
  ok(await page.isHidden('#confirmZero'), '有实验时无「还没做过实验」警示');
  await page.click('#confirmGo');
  await page.waitForSelector('#examSec:not([hidden])');
  await answerExamByLabels(page);
  ok((await page.textContent('#bigStamp')) === 'CRACKED', '今日 8/8 CRACKED');

  /* B3. 端到端公平性：练习 2 期，把终审 8 题原样提交为实验 */
  console.log('\n[B3] 端到端公平性（练习 2 期 × 8 题）');
  for (const nth of [0, 1]) {
    await page.click('#archiveBtn');
    await page.waitForSelector('#archiveSec:not([hidden])');
    await page.click(`.archive-item >> nth=${nth}`);
    await page.waitForSelector('#practiceBar:not([hidden])');
    const items = await page.evaluate(() =>
      window.__thelaw.getExam().items.map(i => ({ t: i.t, label: i.label })));
    for (const it of items) await submitTriple(page, it.t);
    const res = await page.evaluate(() => {
      const s = window.__thelaw.getSession();
      const items = window.__thelaw.getExam().items;
      return {
        n: s.exps.length,
        issue: s.issue,
        agree: items.every((it, i) => s.exps[i].ok === it.label)
      };
    });
    ok(res.n === 8 && res.agree,
      `练习期 ${res.issue}：终审 8 题官方答案与实验盖章完全一致`);
    await page.click('#exitPracticeBtn');
    await page.waitForSelector('#resultSec:not([hidden])');
  }
  await ctx.close();
}

/* ---------- B4. 半损坏 localStorage ---------- */
console.log('\n[B4] 半损坏 localStorage');
{
  const CASES = [
    ['缺 today key', { v: 1, streak: 3, best: 4, lastCracked: 141, history: { 141: { n: 5, k: 8, verdict: 'CRACKED', traj: '10101', practice: false } } }, '连胜 3'],
    ['缺 streak key', { v: 1, best: 4, lastCracked: 141, history: {}, today: null }, '连胜 0'],
    ['history 类型损坏为数组', { v: 1, streak: 2, best: 2, lastCracked: 141, history: [1, 2, 3], today: null }, '连胜 2']
  ];
  for (const [name, store, expStreak] of CASES) {
    const ctx = await browser.newContext();
    await fakeClock(ctx, Date.UTC(2026, 6, 6, 9, 0));
    await ctx.addInitScript(s => { try { localStorage.setItem('thelaw.v1', s); } catch (e) {} }, JSON.stringify(store));
    const page = await ctx.newPage();
    watch(page, 'B4-' + name);
    await page.goto(INDEX);
    await page.waitForSelector('#labSec:not([hidden])');
    ok((await page.textContent('#streakBox')) === expStreak, `${name}：渲染正常，${expStreak}`);
    await submitTriple(page, [5, 9, 14]);
    ok(await page.locator('#ledgerBody tr').count() === 1, `${name}：仍可正常做实验`);
    await ctx.close();
  }
}

/* ---------- B5. 练习隔离 + 结算竞态回归 ---------- */
console.log('\n[B5] 练习不影响连胜 + 800ms 竞态回归');
{
  const ts = Date.UTC(2026, 6, 6, 9, 0);       /* 期号 144 */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await fakeClock(ctx, ts);
  /* 预置：已连胜 5，昨天(143)刚破解 */
  await ctx.addInitScript(s => { try { localStorage.setItem('thelaw.v1', s); } catch (e) {} },
    JSON.stringify({ v: 1, streak: 5, best: 5, lastCracked: 143, history: {}, today: null }));
  const page = await ctx.newPage();
  watch(page, 'B5');
  await page.goto(INDEX);
  await page.waitForSelector('#labSec:not([hidden])');
  ok((await page.textContent('#streakBox')) === '连胜 5', '预置连胜 5 载入');

  /* 0 实验直接终审（莽夫路径）：8/8 → 连胜 6 */
  await page.click('#finalBtn');
  await page.waitForSelector('#confirmBox:not([hidden])');
  ok(await page.isVisible('#confirmZero'), '0 实验进终审有「还没做过任何实验」警示');
  await page.click('#confirmGo');
  await page.waitForSelector('#examSec:not([hidden])');
  await answerExamByLabels(page);
  const s1 = await page.evaluate(() => window.__thelaw.getStore());
  ok(s1.streak === 6 && s1.lastCracked === 144, `今日破解后连胜 5→6（实际 ${s1.streak}）`);
  const share0 = await page.textContent('#shareTextEl');
  ok(share0.split('\n').length === 3 && share0.includes('0 次实验'), '0 实验分享文本省略轨迹行');

  /* 完整打完一期练习：连胜/lastCracked/best/今日历史全不动 */
  await page.click('#archiveBtn');
  await page.waitForSelector('#archiveSec:not([hidden])');
  await page.click('.archive-item >> nth=0');
  await page.waitForSelector('#practiceBar:not([hidden])');
  await page.click('#finalBtn');
  await page.waitForSelector('#confirmBox:not([hidden])');
  await page.click('#confirmGo');
  await page.waitForSelector('#examSec:not([hidden])');
  await answerExamByLabels(page);
  const pr = await page.evaluate(() => {
    const st = window.__thelaw.getStore();
    const sess = window.__thelaw.getSession();
    return { streak: st.streak, last: st.lastCracked, best: st.best,
             practiceEntry: st.history[String(sess.issue)],
             todayEntry: st.history['144'], issue: sess.issue,
             countdownHidden: document.getElementById('countdown').hidden };
  });
  ok(pr.streak === 6 && pr.last === 144 && pr.best === 6,
    `练习期 ${pr.issue} 完成后连胜仍为 6、lastCracked 仍为 144`);
  ok(pr.practiceEntry && pr.practiceEntry.practice === true, '练习成绩入历史且标记 practice');
  ok(pr.todayEntry && pr.todayEntry.practice === false, '今日正式成绩未被练习覆盖');
  ok(pr.countdownHidden, '练习结案不显示倒计时');
  ok((await page.textContent('#shareTextEl')).includes('（练习）'), '练习分享文本带（练习）标记');

  /* 回归：练习终审中答完一题，在 800ms 换题窗口内点「返回今日」——
   * 今日卷宗不得被重新结算（连胜必须保持 6，不得被清成 1） */
  await page.click('#exitPracticeBtn');
  await page.waitForSelector('#resultSec:not([hidden])');
  await page.click('#archiveBtn');
  await page.waitForSelector('#archiveSec:not([hidden])');
  await page.click('.archive-item >> nth=1');
  await page.waitForSelector('#practiceBar:not([hidden])');
  await page.click('#finalBtn');
  await page.waitForSelector('#confirmBox:not([hidden])');
  await page.click('#confirmGo');
  await page.waitForSelector('#examSec:not([hidden])');
  await page.click('#voteOk');                     /* 答第 1 题 */
  await page.click('#exitPracticeBtn');            /* 立刻退出（<800ms） */
  await page.waitForTimeout(1300);                 /* 让 setTimeout 走完 */
  const s2 = await page.evaluate(() => {
    const st = window.__thelaw.getStore();
    return { streak: st.streak, last: st.lastCracked, phase: st.today.phase,
             stampTxt: document.getElementById('bigStamp').textContent };
  });
  ok(s2.streak === 6 && s2.last === 144,
    `竞态回归：退出练习后今日连胜未被重结算（连胜 ${s2.streak}，应为 6）`);
  ok(s2.phase === 'done' && s2.stampTxt === 'CRACKED', '今日结案态未被破坏');
  await ctx.close();
}

await browser.close();

/* ================= 汇总 ================= */
if (errors.length) {
  console.error('\nCONSOLE/PAGE ERRORS:');
  for (const e of errors) console.error('  ' + e);
}
ok(errors.length === 0, `零 console error / pageerror（收集到 ${errors.length} 条）`);

console.log(`\nqa-extra.mjs: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
console.log('ALL QA-EXTRA TESTS PASSED');
