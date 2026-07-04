# Flatline 营销与广告指南

核心资产是那张心电图卡：**看的人不知道题目是什么，只知道这个人第 7 拍没绷住**。
一切宣发都围绕"晒卡引发好奇"展开，永不解释玩法。

## 冷启动渠道（按执行顺序）

### 1. Hacker News — Show HN（上线日 T+0，美东工作日早上发）

**标题**（二选一，别加感叹号）：
- `Show HN: Flatline – a daily 45-second calmness test drawn as an ECG`
- `Show HN: A hospital monitor that records how badly your hands shake`

**正文草稿**：

> I built a daily web toy that measures composure instead of reflexes.
> Fourteen beats in ~45 seconds: tap on the mark, hold without trembling, and — the
> hard part — do nothing when the screen tries to bait you into tapping.
> Every hesitation and stray tap is sampled per beat, and the whole run is rendered
> as an ECG strip. Keep calm and you get a flat sinus line; lose three beats in a row
> and the monitor calls CODE BLUE on you, with the beat number stamped on the card.
>
> Same puzzle for everyone each day (local-date seeded, Wordle-style). No backend,
> no accounts, no analytics — one static page, everything in localStorage, works
> offline from file://. Share card is deliberately spoiler-free.
>
> Hardest part was making pressure feel real in 45 seconds: the screen shake, fake
> prompts and tempo ramp are all tuned so your beat-7 twitch is genuinely yours.
> Happy to answer anything about the scoring model or the canvas phosphor trail.

发帖后 2 小时内守评论区；被问玩法细节可以聊实现，但不预告后续拍型（保持新鲜感）。

### 2. Reddit r/webgames（T+0 同日；r/incremental_games、r/InternetIsBeautiful 隔日跟进）

**标题**：`Flatline — a daily 45s "stay calm" test. It draws your panic as an ECG spike (no signup, free)`

**正文**：

> Daily challenge, same for the whole world. The monitor gives you 14 beats: tap on
> time, hold steady, and ignore the fake prompts designed to bait you. It logs your
> micro-reactions and draws them as a heart monitor strip at the end.
> Flat line = you kept your cool. Red spike = it tells everyone exactly which beat
> broke you. My current shame: CODE BLUE on beat 7, two days running.
> Static page, no ads in the game, runs offline. Feedback on difficulty very welcome —
> the pressure curve is the whole game.

规则注意：r/webgames 允许自推但要真互动，发帖当天回复每条评论；附一张 CODE BLUE 卡截图。

### 3. X / Twitter（T+0 起，每天一发，连发 7 天）

- 首发：`我做了一台监护仪。它不治病，只记录你哪一拍没绷住。45 秒，全球同题，敢来吗 → flatline.day`（配 CODE BLUE 卡 + RESTING 卡对比图）
- 日常模板：`Flatline #12：今天第 9 拍全网崩得最多。你呢？`（配自己的当日卡）
- 互动钩子：转发晒出 FLATLINE MASTER 金卡的人（稀有度即话题）。

### 4. 小红书（T+1 起）

- 标题：`这个45秒的小测试把我的手抖画成了心电图…`
- 正文走"自嘲+不服"路线：`说是测镇定，我第7拍直接CODE BLUE被宣布抢救。评论区谁能拿到一条平线？不许说怎么玩，自己去试。`
- 配图：手机截图 3 张（开始屏、CODE BLUE 卡、RESTING 卡）。标签：#心理测试 #专注力 #小游戏 #解压。
- 关键：永远不截玩法过程图，保持"这是什么"的悬念。

### 5. 抖音 / 短视频（T+3 起，素材复用到 B 站 & YouTube Shorts）

- 15 秒脚本：竖屏实录，画面上半是手指、下半是屏幕。旁白："这个网站说能测出你什么时候慌。"
  → 前 5 拍稳 → 假提示出现手指一抖 → 全屏红 CODE BLUE + 报警音 → 定格分享卡。
  结尾字幕："第 7 拍。它连我哪一拍慌的都知道。"
- 挑战话术：`#第七拍挑战` —— 拍到自己 CODE BLUE 瞬间的真实反应。
- 电竞/学习区直播主天然适配：波形实时跳动本身就是直播画面。

### 6. 达人合作话术（私信模板，找 1–10 万粉的专注力/电竞/ADHD 区博主）

> 你好，我做了个 45 秒的小东西叫 Flatline：一台会记录"你哪一拍绷不住"的监护仪，
> 每天全球同一道题。你的观众应该会喜欢在直播里赌你第几拍崩。
> 没有任何商业化诉求，不用挂链接，你玩你的，截图随便发。
> 如果愿意，我可以把你的 ID 做进某一天的"今日全网崩拍统计"里当彩蛋。

要点：送话题不送钱；给"被做进游戏"的虚荣激励；绝不要求口播。

## 广告 / 变现指南

### 何时开 AdSense

同时满足再开，早开只会伤留存：
1. 日均 UV 稳定 > 2,000 持续两周；
2. 次日回访率 > 25%（说明广告不会赶走本来就不留的人）；
3. HN/Reddit 首发流量峰已过（首发期页面必须绝对干净）。

### 广告位激活步骤

1. AdSense 添加站点 → 通过审核（本页语义化 HTML + meta 齐全，通过率高）。
2. 只启用 `index.html` 结算屏底部预留的 `.promo` 容器（内有注释说明），
   用官方 `<ins class="adsbygoogle">` 替换内容，保持容器宽度与配色。
3. `</body>` 前引入 adsbygoogle.js —— 这是全站唯一允许的外部脚本；
   加载失败必须静默（AdSense 默认如此），不得影响游戏。
4. 铁律：游戏进行中永不出广告；开始屏永不出广告；一个广告位就是上限。
5. 观察一周：若分享率（复制+存图 ÷ 结算 PV）下跌超过 15%，撤广告，改走赞助位
   （"本台监护仪由 XX 供电"式的单行文字位，报价 = 日 UV × ¥0.05）。

### 买量建议：不买

- 本品类 LTV ≈ 0（无内购、广告 eCPM 低），任何 CPC 都亏；
- 增长模型只有一个：分享卡回流。钱应花在让卡更好看/更好笑上，而不是流量上；
- 唯一例外：若某条短视频自然爆了，可以对该条投少量 DOU+/加热（≤¥500）放大自然势能，
  投放目标选"主页访问"而非"点赞"。

### 后续变现路线（体量起来后再说）

1. 波形皮肤小额内购（琥珀单色、90 年代示波器、金色平线特效）——纯本地解锁码即可，仍零后端；
2. "复活重测今日题"激励视频（需接聚合 SDK，慎重，会破坏"每日一次"的仪式感，除非数据证明想要的人足够多）；
3. 品牌定制日（如咖啡品牌冠名"戒断日"高难题）。

## 每周固定动作

- 周一：发"上周全网最惨崩拍分布"（手工统计评论区晒卡即可，本品无后端）；
- 周五：预告周末题"会更难"（其实种子照常，纯话术）；
- 每天：官号发自己的当日卡，输赢都发——官号敢崩，用户才敢晒。
