# Word Age — 营销与变现指南

定位复述：这是五件套里的**收入引擎**——不指望爆红，指望 500+ 常青长尾页在搜索引擎里慢慢生根，每一页都自带"想截图"的反差点。营销预算 ≈ 0，全部打法围绕 SEO + 社群投喂 + 联盟变现。

## 一、SEO 打法（主战场）

### 1. 目标关键词矩阵

每个词页同时覆盖四族查询（title / h1 区 / 正文自然覆盖，勿堆砌）：

| 查询族 | 示例 | 承接元素 |
|---|---|---|
| how old is the word X | how old is the word nice | title 主模板 + 首屏年份 |
| X word origin / etymology of X | nice etymology | AS FIRST WRITTEN + HOW IT DRIFTED 节 |
| when was the word X first used | when was "ok" first used | title 副句 "First recorded c. 1300" |
| what did X originally mean | what did nice originally mean | meta description + orig 节 |

高优先词（先内链加权、先补内容）：nice、silly、awful、awesome、girl、guy(待收)、ok、hello、fun、meat、clue、robot、quarantine、nickname——这些是"反差最大 + 搜索量最大"的交集。

竞争策略：不与 Etymonline/Merriam-Webster 硬拼权威词条，差异化角度是**年龄换算 + 反差参照 + 出生证明分享卡**——搜索者要的是"能转述给朋友的一句话"，我们的 title 直接给答案（年份进 title），抢 featured snippet 和 People Also Ask。

### 2. 站内结构（已内建）

- 每页唯一 title/description/canonical/OG；年份写进 title（点击率钩子）。
- 词页 ×4 相关词互链 + 目录页 + 主页，两跳全站可达；sitemap.xml 全量。
- 后续每周补词自动进 sitemap（lastmod 更新触发再抓取）。
- Roadmap：主题合辑页（"10 words younger than sliced bread" / "insults that used to be compliments"）——合辑页是外链磁铁，也是内链枢纽。

### 3. Google Search Console 步骤（上线当天）

1. GSC → 添加资源 → 域名资源（DNS TXT 验证）或 URL 前缀资源（HTML 标签验证，标签加到 index.html `<head>`）。
2. Sitemaps → 提交 `https://域名/sitemap.xml`，确认状态 Success、发现 502 个 URL。
3. URL 检查工具手动请求编入索引：主页 + nice/silly/ok/robot/quarantine 等 10 个头部词页（加速首批收录）。
4. 第 2–4 周每周看一次：Performance → Queries，把**已有曝光但排名 8–20 名**的查询记下来——这是"补一段内容就能上首页"的词，优先加长该词条或为它建合辑页。
5. 90 天节点：CTR < 1.5% 的头部页重写 meta description（把最反差的一句放进去）。

### 4. Bing/其他

Bing Webmaster Tools 一键导入 GSC 配置。DuckDuckGo/Brave 吃 Bing 索引，等于三送一。

## 二、社群投喂（冷启动两周）

### Reddit r/etymology（及 r/todayilearned、r/linguistics）

- 首发 3 帖（隔 2–3 天）：直接放事实本体 + 词卡截图，不放裸链接（社区反感）；链接放在评论区被问到时给。
  1. "TIL 'girl' originally meant a child of either sex — 'boy' meant servant"（r/todayilearned 模板：TIL + 来源）
  2. "'Silly' meant 'blessed' — the full 700-year decline"（r/etymology，附出生证明卡）
  3. "Words younger than you think: fun (1680s), hello (1827), boredom (1852)"（清单帖天然高转发）
- 规则：先养账号参与讨论一周；每帖必须经得起该版考据党复核（我们的数据线就是为此设计的）；被指出错误 24h 内修数据并回帖致谢——考据社区吃这一套。

### TikTok / Shorts / Reels 词源账号投喂

- 不自建号，先"供弹药"：把 20 张最反差词卡打包，私信 10 个词源/语言学习账号（@etymologynerd 类），话术："free visual, credit optional, source linked"。
- 视频脚本模板（供对方直接用）：Hook（"The word NICE used to mean stupid"）→ 3 秒出生证明卡 → 语义漂移一句 → "guess how old FUN is" 埋互动 → 评论区放链接。
- 自建号（第 3 周起，若有余力）：每日一卡 + 15 秒配音，素材全部由分享卡生成器批量出。

### Pinterest（常青流量，被低估）

出生证明卡天然是 Pinterest 素材：建 "Word Birthdays" 看板，每周钉 10 张卡，描述带 "how old is the word X" 原文关键词——Pinterest 图搜到站内的转化路径极短。

## 三、联盟变现路线（收入主力）

展示广告（AdSense）单价低（工具站 $1–3 RPM），**教育联盟才是这个站的正确变现**：查词源的人 = 英语学习者/爱好者，转化意图明确。

| 渠道 | 挂点 | 形式 |
|---|---|---|
| 词典 App（如 Merriam-Webster Premium、牛津订阅经销联盟） | 词页 MARGINALIA 下方一行字 | "Want the full 20-volume story? →"（CPA/CPS） |
| 背单词/词汇课（Vocabulary.com、Membean、italki 通用英语课） | 主页 method 节下 + 合辑页尾 | "Learn 1,000 word histories a year →"（CPA，教育联盟普遍 $5–20/转化） |
| 亚马逊联盟（词源书：Etymologicon、Word Perfect 等） | 合辑页/词页底部 "further reading" | 图书佣金低但零维护 |

规则：每页**最多一个联盟位**，永远晚于内容出现；文案保持站内干燥性格（不用 "BEST DEAL"）；`rel="sponsored"` 标注，别拿 SEO 冒险。

### AdSense 激活步骤（流量起来之后再做）

1. 前提：日 PV 稳定 300+ 再申请（过审率与收益都更好）。
2. 按 DEPLOY.md §四 替换两个预留广告位，`ads.txt` 上传。
3. 只开 display 单元，关掉自动广告（Auto ads 会毁掉版式——我们的排版是产品的一部分）。
4. 监控：若 AdSense RPM < 联盟位收益的 1/3，词页只留联盟位，广告只留主页。

## 四、节奏与指标

| 周 | 动作 | 目标 |
|---|---|---|
| W1 | GSC/Bing 提交；Reddit 首帖；10 个头部词手动请求收录 | 收录 ≥100 页 |
| W2 | TikTok 账号投喂私信 ×10；Pinterest 看板开张；补词 20 | 首个外链；收录 ≥300 页 |
| W3 | 首个合辑页上线；Reddit 第 2/3 帖；补词 20 | 自然点击首次 >0 的查询 ≥30 个 |
| W4 | GSC 数据反推补词；CTR 低的页改 description；联盟位上线 | 周自然点击 ≥100；首笔联盟转化 |

北极星指标：**自然搜索周点击数**（不是 PV）。分享卡存图次数（可用一个无 cookie 的本地计数 beacon 以后再加）是第二指标。

## 五、口径红线（营销也要守）

对外宣传永远说 "first recorded"（首次记录）而不是 "invented"（发明）——词源学口径是我们与内容农场的区别，也是 Reddit 考据党给外链的理由。任何帖子被纠错，先修数据再回帖。品牌声誉 = 这个站唯一的护城河。
