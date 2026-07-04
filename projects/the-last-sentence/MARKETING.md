# The Last Sentence — 营销与宣发

产品的传播资产只有两样：**极端的存活时长**（9ms 与 3 小时同样好笑/动人）和**序号的整数关口**。
所有物料都围绕"截图墓碑"这个动作设计。链接位统一用正式域名（上线时替换 `<URL>`）。

---

## 1. Show HN 草稿

**标题：**
`Show HN: The whole internet shares one sentence – overwrite it, or watch yours die`

**正文：**

> Right now, exactly one sentence is alive at <URL>. A millisecond timer shows how long it has survived. Anyone can overwrite it (120 chars, one submission per 10s per IP). The dead sentence falls into a graveyard below, its tombstone engraved with exactly how long it lived — "survived 4m 12.882s as #8,412".
>
> That's the whole product. No accounts, no votes, no feed.
>
> Technical notes, since HN will ask:
>
> - Backend is a single zero-dependency Node file (~235 lines, node:http + node:fs). One in-memory state, SSE broadcast, append-only JSONL for recovery. No database, no framework.
> - Concurrent submissions are serialized by arrival; if yours gets sandwiched it may survive 0–50ms. This is a feature — the graveyard's saddest tombstones are the best ones.
> - Rate limit is 10s/IP, profanity gets ▓▓'d, everything is HTML-escaped twice (server + textContent). I know the moderation list is small; I'm watching the graveyard manually and can take anything down in minutes while it's small.
> - If you open the page with no backend it degrades into a self-contained offline demo.
>
> The interesting question for me isn't technical: what do people write when there's exactly one slot for the entire internet, and holding it costs nothing but is impossible?

**首条自评（预埋 FAQ）：**
> Things people asked in testing: (1) Yes, midnight-UTC squatting is a strategy — the record so far is held by a sentence written at 4am. (2) The counter never resets; sentence #10,000 will happen in public. (3) If two of you submit in the same 40ms, one of you becomes the shortest-lived tombstone of the day. Sorry in advance.

发布时间：美东周二–周四早 8–10 点。当天全天值守评论区 + 内容安全。

---

## 2. X（Twitter）线程

**T1（钩子）**
> right now the entire internet is allowed exactly one sentence.
>
> it's alive at <URL> and a timer is counting every millisecond it survives.
>
> you can overwrite it. someone will overwrite yours.

**T2（机制）**
> when your sentence dies it gets a tombstone:
>
> "survived 4m 12.882s as #8,412"
>
> the graveyard scrolls forever. the timer never lies. 9 milliseconds is still a lifetime.
> （配图：墓地截图，一条 9ms 与一条 2h 相邻）

**T3（存在主义）**
> there is no feed, no likes, no algorithm.
>
> just one question: how long will yours live?
>
> pro tip: the sentences written at 4am live the longest. the ones written during a flood live 40 milliseconds. both are worth a screenshot.

**T4（技术 flex，钓转发）**
> the whole backend is one zero-dependency node file. 235 lines. no database — the graveyard is a text file that gets one line appended per death.
>
> the entire internet's shared state, in a .jsonl.

**T5（CTA）**
> it's live: <URL>
>
> write something worth killing.

日常内容池（每日一条轮换）：
- 墓地考古：截一条戏剧性墓碑配一句干评（"someone proposed. it survived 41 seconds."）。
- 数据梗：today's shortest life: 11ms · longest: 2h 09m。
- 守夜人故事转发。

---

## 3. 「抢占 #10,000 句」事件运营

**原理**：序号公开且单调递增，整数关口是免费的全球倒计时。不写一行代码。

**T-3 天** — 预告：
> sentence #10,000 is coming.
>
> whoever writes it, writes history. whoever writes #9,999 dies for it.
> （附当前 #N 与近期速率，让大家自己估算窗口期）

**T-1 天** — 加注：
> #10,000 gets: framed in the readme, pinned on this account, and left alone by us forever.
> #9,999 gets: our deepest respect.

**当口**（速率会因围观暴涨，窗口极难掐准，这正是戏剧性）：
- 直播/space 开着页面读秒；到达瞬间立刻截图三件套：#9,999 墓碑、#10,000 诞生、当时的存活计时。
- 获胜句置顶 + 收录 README「名人堂」；采访作者一句话（"你当时想了什么"）发后续。

**T+1 天** — 战报：
> in the 60 seconds around #10,000: 214 sentences died. median lifespan: 0.31s. the shortest: 8ms — the unluckiest keystroke on the internet.

**复用**：同模板跑 #50,000、#100,000、跨年 0 点（"the first sentence of 2027"）、产品周年（"纪念日刷屏"：邀请用户回来在同一天再写一句，对比两块墓碑）。

---

## 4. 渠道与节奏摘要

| 渠道 | 动作 | 时机 |
|---|---|---|
| HN | Show HN + 全天值守 | 上线日 |
| X | 5 条线程 + 每日墓地考古 | 上线日起 |
| Reddit r/InternetIsBeautiful, r/SideProject | 单帖（用 T1 文案） | 上线第 3 天 |
| 主播/群主 | 定向私信 20 个（页面天然适合直播） | 第 2 周抢位战前 |
| 事件 | 整点抢位战 → 接龙挑战 → #10,000 | 周节奏见 PLAYBOOK |

**红线**：官号永远不在正式场合占据当前句（运营挑战除外，且要自曝身份）；不买量——这个产品的唯一增长逻辑是"截图值得发"。
