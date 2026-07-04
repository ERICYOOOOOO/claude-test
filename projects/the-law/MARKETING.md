# 今日之律 The Law — 营销宣传 + 广告指南

## 受众画像

核心受众就是 HN / Reddit 智力向人群：程序员、数学系、桌游玩家、Wordle 疲劳者。他们的共同点：

- 对「归纳推理」「科学方法」「证伪」这类词有条件反射式的好感；
- 熟悉 Wason 2-4-6、Zendo、Eleusis——提这些名字等于递暗号；
- 反感营销腔，吃"作者本人平实陈述 + 技术细节"这一套；
- 分享动机是炫耀智力，而非安利产品——零剧透战报格就是给这个动机造的容器。

## 核心信息（所有渠道共用）

1. **每天全球同一条隐藏法则**——你和所有人破解同一题。
2. **实验换 ✓/✗，归纳出规律**——不是算题，是做科学。
3. **用的实验越少越体面**——战报晒的是思维效率。
4. **零剧透分享格**——🟩🟥 轨迹 + 次数，绝不泄题。

一句话版本：*「Wordle 给了你答案的形状；The Law 连形状都不给——你得自己设计实验去逼问它。」*

## Hacker News「Show HN」草稿

> **Show HN: The Law – a daily Wason 2-4-6 puzzle with spoiler-free sharing**
>
> Every day there's one hidden rule about number triples (a, b, c) in 1–20 — the same rule for everyone on Earth that day. You probe it by submitting experiments and getting an instant ✓/✗. When you think you've induced the rule, you take the Final Review: 8 unseen triples (half legal, half near-miss traps generated on the rule's boundary), and *you* play judge. 7/8 cracks the case.
>
> The design problem I cared about most is confirmation bias — in Wason's classic 2-4-6 experiment most people only submit triples that *confirm* their hypothesis and never try to falsify it. The scoring leans into that: unlimited experiments, but your share card shows exactly how many you burned. The flex is inducing the rule in 5 experiments, not 50.
>
> Sharing is Wordle-style and fully spoiler-free: just your 🟩🟥 experiment trail and your Final Review score. No numbers, no rule text.
>
> Technical notes: pure static page, zero dependencies, ~60KB, works from file://. The daily rule comes from 39 parameterized templates (3 difficulty tiers; Monday easiest, Saturday brutal), seeded by the local date. The rule judge and the exam generator share one predicate function, and the 8 review questions are generated deterministically from the seed — half positives, half negatives mutated from positives so they sit right on the boundary your wrong hypothesis would miss. Every template×parameter combo is unit-tested to have ≥10% positives and ≥10% negatives over the whole 8000-triple domain, so random experimentation always gets signal.
>
> Play today's law: https://thelaw.day — happy to answer questions about the rule library or difficulty calibration.

发帖注意：
- 周二–周四美西早上 8–10 点发；标题保持小写谦逊风，不加感叹号。
- 首评自己补一条「今天的规则难度是 3/3（周六）」之类的当日上下文，制造集体感。
- 评论区高频问题预案：如何防作弊（判定器在客户端但规则文本不在 DOM 里，且乐趣本来就是自证）、时区（本地日期换刊，同 Wordle）、色盲（✓/✗ 符号冗余于颜色）。

## Reddit 帖（r/puzzles、r/wordle、r/boardgames）

> **I made a daily version of Zendo / Wason's 2-4-6 task. Everyone gets the same hidden rule each day.**
>
> Submit number triples, get ✓/✗, induce the rule, then judge 8 unseen triples to crack the case. Fewer experiments = better bragging rights. Sharing is spoiler-free (just your ✓/✗ trail). Saturday rules are evil. Free, no ads on the puzzle, no account.

- r/boardgames 版强调 Zendo 血统；r/puzzles 版强调归纳与证伪；不跨版复制同文。

## 中文渠道（即刻 / 小红书 / V2EX）

- V2EX（分享创造）：技术叙事——「39 个参数化规则模板、密度红线单元测试、终审近失负例生成」，附今日战报格。
- 即刻/小红书：情绪叙事——「连错 4 次之后突然想通的那一秒，是这个游戏卖的全部东西」。配图用 PNG 图卡（档案纸 + CRACKED 大戳），自带传播面。
- 统一话术禁令：不用「立即体验」「开启你的旅程」「烧脑神器」。

## 病毒机制运营

- **战报格是唯一增长引擎**：所有运营动作都指向"让人把 🟩🟥 格子发出去"。
- 每周六「地狱日」做固定话题（#周六重案#），难度即话题性——破解率越低越值得晒。
- 盯社媒搜索 `THE LAW #`，转发低实验数的战报（「3 次实验破解周六题」是最好的广告）。
- 完美破解（8/8）在图卡上有专属副行「完美破解」，制造稀缺晒点。

## 广告指南（如投）

- 只投智力向语境：HN 不能投就不投，Reddit 定向 r/puzzles 类版面的原生位。
- 素材即产品：一张真实 PNG 战报图卡 + 一句「今天的法则，全球 x% 的人破解了」。
- 禁投泛娱乐信息流——受众错配且拉低调性。
- 站内变现按 DEPLOY.md 的 AdSense 挂点，只出现在结案区下方，永不打断实验流程。

## 数据观测（无后端条件下）

- 分享回流：给分享链接带不上参数（纯文本域名），改看托管商的 Referer 统计与社媒搜索。
- 难度校准信号：社媒战报里的实验次数分布与终审得分。若某天大量 FAILED，检查该模板是否该降档或收窄参数域。
- 目标区间：单日破解率 30–50%（与策划案一致）；连续两周超出则调整 `TIER_BY_WEEKDAY` 或模板参数。

## 4 周节奏（与 PLAYBOOK 对齐）

| 周 | 动作 |
|----|------|
| 1 | HN Show HN + Reddit 双帖冷启动；盯换刊与首批战报 |
| 2 | 中文渠道铺开；按战报数据首轮难度校准 |
| 3 | 周六地狱日栏目化；档案"补卡"话术促回流 |
| 4 | 规则库扩到 50+；评估复合规则做周六专属；发月度战报模板 |
