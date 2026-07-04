# At Your Age（同龄羞辱）— Playbook

一个输入生日、算出精确到天的年龄，然后告诉你「同龄人当年干成了什么」的自嘲式工具。
一键在 **ROAST（暴击）** 与 **HEAL（治愈）** 之间翻转——这一暴一治的落差就是传播引擎。

- 界面语言：英文。纯静态、零依赖、零后端，file:// 可直接打开。
- 技术栈：手写 HTML/CSS/JS + node build.js（SSG）。数据内嵌于 `data.js`，无 fetch。
- 当前数据规模：215 条里程碑（ROAST 110 / HEAL 105），189 位人物。

---

## 1. 逐屏旅程

### 屏 0 · 门（gate）
- 报头：`AT YOUR AGE.`（左）+ `215 RECEIPTS ON FILE`（右，动态取数据条数）。
- 主标题：**How far behind are you, exactly?**（"exactly" 带一道猩红下划色块）。
- 一段 52ch 内的干燥说明 + 三个下划线输入位（YEAR / MONTH / DAY，自动跳格）+ 黑块按钮 **RUN THE NUMBERS**。
- 底部一行小字：`Your date never leaves this page. No account, no cookies, no mercy.`
- 错误态（红字、role=alert，均不崩）：
  - 缺字段/非数字 → `Three numbers, please — year, month, day.`
  - 不存在的日期（2 月 30）→ `That date doesn't exist. Check the month against the day.`
  - 未来日期 → `You appear not to have been born yet. Come back once that's sorted.`
  - 1900 之前 → `This machine calibrates back to 1900. If you were really born before that, you've outlasted everyone in here — congratulations.`

### 屏 1 · 判词（result）
自上而下的报纸版式：
1. **模式翻转开关**（左，最显眼控件，规格见 §4）+ `b. 1995-06-15 — change`（右，回门）。
2. **巨型年龄数字**（桌面 ≥120px，tabular-nums）+ 小字 `YEARS AND 19 DAYS · 11,342 DAYS ON THE CLOCK`。
3. 一道 128×16px 模式色块（ROAST 红 / HEAL 绿）。
4. **判词**（动态文案引擎产出，§3），24–40px。
5. meta 行：`MARK ZUCKERBERG · TECH · 2004 · FULL LEDGER →`（链到该人物 SEO 页）。
6. 动作排：`ANOTHER ONE`（黑实心）/ `COPY TEXT` / `SAVE CARD`（描边）。
7. 广告位（§7）。
- 回访者：localStorage 里有生日则直接落在本屏（`change` 可改）。

### 循环
输入生日（一次）→ 被暴击 → 翻到治愈 → another one × N → 复制/存卡 → 分享 → 收到卡的人进站输入自己的生日。结束态永远有下一步：换一条、换模式、存卡。

---

## 2. 数据集规范（`data.js`）

```js
{ id, person, short, p, age, [ageDays], event, year, mode, category, [death], [future] }
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✓ | 全局唯一 slug（`mozart-dead`）|
| `person` | ✓ | 全名；同一人多条时字符串必须逐字一致（build 按它聚合成页）|
| `short` | ✓ | 日常称呼（"Mozart"），用于判词 |
| `p` | ✓ | `"he"` / `"she"`，模板由此生成 his/her/him |
| `age` | ✓ | 事件发生时的整数年龄，1–100 |
| `ageDays` | — | 精确到天的年龄（如 Mozart 卒年 13096 天），有则优先 |
| `event` | ✓ | 一般过去时动词短语、无主语、无句号（`"won the Masters"`）|
| `year` | ✓ | 公元年份（number）或 BC 字符串（`"336 BC"`）|
| `mode` | ✓ | `"roast"` / `"heal"` |
| `category` | ✓ | music/art/literature/science/tech/business/politics/sports/film/food/fashion/exploration/philosophy/life |
| `death` | — | `true` → 走动态死亡模板（"had been dead for …"）|
| `future` | — | 仅 heal；动词原形短语，用于 "wouldn't {future} for another N years" |

**准确性红线**：只收广为人知、可由公开出生日期 + 事件日期复核的事实；模糊的（出生年存疑、口径打架）宁可不收。事件表述避免争议人物、避免把早逝写成嘲笑（死亡模板只用于莫扎特/亚历山大这类黑色幽默安全区）。新增条目必须跑 `node test/data.mjs`。

**选取平衡**：ROAST 收神童/早成者（越年轻越疼），HEAL 收大器晚成者（越老越暖）；两性、领域尽量均衡；同一人物可同时出现在两种模式（Buffett 11 岁买股票 / 50 岁后才赚到 99% 财富）。

---

## 3. 文案引擎句式表

设 `U` = 用户总天数，`M` = 里程碑天数（`ageDays` 或 `age×365.2425`），`Δ = U − M`。
`span = formatSpan(|Δ|)` 输出 `"12 years and 19 days"`（不足 1 年只输出天；整年不带零头）。
同一条目当天模板固定（`hash(id)+daySeed` 选变体），跨天轮换。

### ROAST
| 条件 | 模板（变体轮换） |
|---|---|
| `death && Δ>0` | `By your exact age, {S} had been dead for {span}.` / `You have now outlived {S} by {span}. The bar was right there.` |
| `death && Δ≤0` | `{S} was dead by {A}. You have {span} left on {his} clock.` |
| `|Δ| ≤ 150 天` | `{S} was your age — almost to the day — when {he} {event}.` / `At exactly the age you are now, {S} {event}.` |
| `Δ > 0`（你更老） | `{S} {event} at {A}. That's {span} younger than you are right now.` / `At {A}, {S} {event}. You've had {span} longer to get around to it.` / `{S} {event} at {A} — {span} ago, by your calendar.` |
| `Δ < 0`（你还小） | `{S} {event} at {A}. You have {span} to do something comparable. The clock is running.` / `In {span}, you'll be as old as {S} was when {he} {event}. Just saying.` |

### HEAL
| 条件 | 模板 |
|---|---|
| `|Δ| ≤ 150 天` | `{S} was exactly your age when {he} {event}. Not too late — on time.` / `At the age you are today, {S} {event}. This is apparently the moment.` |
| `Δ<0 && future` | `At your age, {S} wouldn't {future} for another {span}.` / `You could idle for {span} and still be on {S}'s schedule — {he} didn't {future} until {A}.` |
| `Δ < 0` | `{S} {event} at {A}. You have {span} before you're even there.` / `By {S}'s calendar you're {span} early. {He} {event} at {A}.` / `There is time. {S} {event} at {A} — that's {span} from where you're standing.` |
| `Δ > 0` | `{S} {event} at {A}. You're {span} past that, and {he} was only getting started.` / `Late by whose clock? {S} was {A} when {he} {event}.` |

**语气红线**：克制毒舌 / 克制温柔，零感叹号、零 emoji、零 "OMG"。疼点全部来自数字精度（"12 years and 19 days"），不来自形容词。

### 选条与去重
- 年龄计算：UTC 天数差（闰年安全）；年 + 自上个生日起的天数；2/29 生日平年顺延 3/1。
- 每模式序列 = `mulberry32(daySeed ⊕ hash(birthISO) ⊕ hash(mode))` 洗牌，再把「相关命中」（roast: 里程碑 ≤ 你的年龄；heal: ≥ 你的年龄）稳定前置——第一条永远是最疼/最暖的方向。
- `another one` 前进指针；已看 id 存 localStorage（`aya:v1`，带版本号，损坏自动回退默认），全池看完自动清空重轮。

---

## 4. 双模式切换交互规格（核心传播点）

- 结构：`<button #flip>` > `.flip-inner`（`preserve-3d`）> 两张全尺寸面 `.face-roast` / `.face-heal`（`backface-visibility:hidden`，heal 面预置 `rotateX(-180deg)`）。
- 触发：点击切换 `body[data-mode]` → `.flip-inner` 旋至 `rotateX(-180deg)`。
- 动效：**180ms `cubic-bezier(0.16,1,0.3,1)`**，只动 transform。
- 面文案：`ROAST｜flip to heal ↓` / `HEAL｜flip to roast ↑`——按钮自我说明，第 0 次交互即教学。
- 联动（同拍完成）：`--accent` 红↔绿（色块、按钮 hover、焦点环、标题色点全部跟随）；判词做 90ms 压下（`rotateX(88deg)`+淡出）→ 换文案 → 90ms 弹回，总时长同 180ms。
- 无障碍：`aria-pressed` + 动态 `aria-label`；`prefers-reduced-motion` 下全部瞬切；触控目标 72px 高。

---

## 5. 视觉与动效规格

- **艺术方向**：瑞士编辑/杂志内页。纯白 `#ffffff`、近黑 `#111111`、ROAST 红 `#e0332b`、HEAL 绿 `#2e7d4f`；除此四色只允许透明度变化。
- 字体：系统无衬线栈；年龄数字 `clamp(96px, 26vw, 224px)`、weight 800、`letter-spacing:-0.05em`、`tabular-nums`；判词 24–40px/1.22；全部大写小字均带 0.08–0.18em 字距。
- 网格：max-width 1040px，4/8px 间距体系，2px 墨线分区（报头/页脚），层级全靠字阶与留白，无阴影、无圆角、无渐变。
- 动效清单：flip 180ms；判词换字 90+90ms；按钮 hover 变色 180ms、active 位移 1px；全部 transform/opacity，60fps；reduced-motion 全禁。
- 状态设计：空态=门屏；错误态=红字判语；无加载态（零请求）。

---

## 6. 分享卡规格

- **PNG（canvas）**：1080×1350（4:5，适配 IG/小红书/朋友圈）。纯白底；左上 `AT YOUR AGE` 报头字距 6px；右上模式色块章（ROAST/HEAL 白字）；中部巨型年龄数字（480px 起，超宽自动缩）；下方 `YEARS AND 19 DAYS`；一道全宽 22px 模式色带；判词 54px 换行（≤6 行）；左下域名 `atyourage.fyi`，右下灰字 `flip it. heal mode exists.`——**卡面本身给出翻转钩子**，看到卡的人知道还有另一面。文件名 `at-your-age-31-roast.png`。
- **文本版**（一键复制，clipboard API + textarea 降级）：
  ```
  At 19, Zuckerberg launched Facebook from a dorm room. You've had 12 years and 19 days longer to get around to it.
  Me: 31 years, 19 days. ROAST mode — https://atyourage.fyi
  ```
- 零剧透原则：只露一条判词，不露库；域名固定占位。

---

## 7. SEO 结构与变现挂点

- `build.js`（node，无依赖）→ `people/<slug>.html` ×189（标题 `What had X done by age N?`，按年龄排全部里程碑 + 模式标签 + 回计算器 CTA）、`people/index.html`（全名录）、`sitemap.xml`（191 URL）、`robots.txt`。
- 每页：唯一 title/description/canonical/OG；语义化 h1/ol；内链 首页 ↔ 人物页 ↔ 名录 双向。
- 主页命中词：`am I behind in life` / `how old am I exactly in days`；人物页命中 `what did mozart do by age 25` 长尾矩阵（见 MARKETING.md）。
- 广告位：结果屏下方 `aside.adslot`（Advertisement kicker + 默认自推广一行字），HTML 注释内附 AdSense 接入三步；不破版式（max-height ~120px）。
- 域名 `atyourage.fyi` 为占位：上线时改 `data.js` 的 `AYA_DOMAIN` 与 `build.js` 的 `BASE_URL`（同一常量派生）+ `index.html` 头部两处 URL。

---

## 8. 发布 checklist

1. [ ] `node --check` data.js / app.js / build.js 通过
2. [ ] `node projects/at-your-age/test/data.mjs` 全绿（215 条、字段、去重、build 产物一致）
3. [ ] `node projects/at-your-age/test/smoke.mjs` 全绿（零 console error、核心循环、边界、双视口截图）
4. [ ] 换正式域名（§7 四处）后重跑 build + 两个测试
5. [ ] 页面总重 <150KB、无外链资源（grep `http` 确认只有 canonical/OG）
6. [ ] 部署（DEPLOY.md），验证 file:// 之外的真实 https 环境 clipboard 可用
7. [ ] Google Search Console 提交 sitemap.xml；Bing 同步
8. [ ] OG 卡在 X/Telegram/微信各预览一次
9. [ ] 手机真机各一次：输入、翻转、存卡到相册
10. [ ] 埋一条 uptime 监控（可选，静态站可跳过）

## 9. 四周运营节奏

- **W1 · 冷启动**：上线 + Search Console；作者本人在 X/小红书发自己的 ROAST 卡（文案模板见 MARKETING.md）；Hacker News「Show HN」+ r/InternetIsBeautiful 各一发；每天挑 1 张网友回帖的卡转发。
- **W2 · 挑战化**：发布 TikTok/Shorts「输入你的生日」挑战脚本（先暴击表情、再翻治愈）；找 3–5 个职场焦虑/35 岁危机类中小 KOL 送定制卡；上 Product Hunt。
- **W3 · SEO 加深**：按搜索词反馈补 30–50 条数据（每条过 data.mjs）；给 10 个「what did X do by age N」高流量人物页手写 2 句独家导语；开始交换友链。
- **W4 · 节点与复盘**：蹲一个情绪节点（毕业季/新年/生日月）投放「又老一岁」话题；复盘留存与分享率，决定是否加「生日年度提醒」与「里程碑进度清单」（plan 中的回访钩子，当前版本刻意未做）。
