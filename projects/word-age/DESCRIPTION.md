# 词龄 Word Age — 产品描述

**一句话**：输入一个英文单词，拿到它的"出生证明"——首次被记录的年份、实际年龄、当年的原义、语义怎么漂移到今天，以及一个让人想截图的历史反差参照。

## 它做什么

- **查词**：主页即时搜索（内嵌索引，零网络请求），覆盖 500 个经过逐条核实的常用英文词。查无此词时按编辑距离给出最相近的 3 个建议。
- **四件事**：首录年份（`c. 1300` / `Old English` / `1839` 等诚实精度）→ 实际年龄 → 当年原义 → 一句语义变迁小史。
- **反差参照**：算法自动从 30 个历史锚点里挑最有戏剧性的一个——"nice is older than the printing press (1440) by 140 years"；"teenager is younger than sliced bread (1928) by 13 years"。
- **判词**：每词人工标注 "Older than you think" / "Younger than you think"，盖成氧化红印章。
- **分享**：一键导出 1080×1350 出生证明 PNG（canvas 生成，巨大衬线词 + b. 年份 + 判词红章 + 原义 + 参照 + 域名），或一键复制纯文本版。
- **Word of the Day**：按用户本地日期种子每日一词，全球同一天同词。
- **SEO 长尾**：每词一个静态页（构建期烘焙全部内容），独立 title/description/OG/canonical，页内 4 个相关词互链 + 馆藏目录页 + sitemap.xml。

## 它的性格

活版印刷/档案馆：奶油纸、油墨黑、氧化红点缀；全衬线（Georgia 栈）、小型大写字母标签、hairline 分割线；词条页排成词典内页。查询结果的年份数字以 96px+ 的字号从模糊滚动到清晰（450ms 数字滚轮），像一台老计数器落定。文案克制、干燥：不欢迎语、不感叹号轰炸。

## 数据的底线

只收词源学界公认事实（OED / Etymonline 共识口径）；年份精确到世纪/年代级，绝不编造具体假年份；有争议的词源明示 "probably / perhaps"；顺手破谣（NEWS 不是缩写、sincere 与蜡无关、kangaroo 不是"我不知道"、Grace Hopper 的飞蛾不是 bug 一词的起源）。不确定的词，宁可不收。

## 技术形态

纯静态、零依赖、零后端：数据内嵌 JS，file:// 直接可用；build.js（node，零依赖）生成 500 个词页 + 目录页 + sitemap；主页总重 < 150KB；移动优先（375px 起）、键盘可完成核心操作、prefers-reduced-motion 降级。

---

## English blurb

**Word Age** — every word has a birthday, and most of them are lying about it. Type any English word and get its birth certificate: the year it was first written down, its real age, what it meant back then (*nice* meant foolish; *meat* meant all food; *girl* meant any child), and a perspective line you'll want to screenshot — "older than the printing press by 140 years." 500 hand-checked entries, a word-of-the-day, and a printable certificate for the friend who says "awesome" too much. No accounts, no tracking, loads instantly.
