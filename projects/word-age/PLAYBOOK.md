# 词龄 Word Age — PLAYBOOK

英文产品：输入一个英文单词，告诉你它第一次被写进英语的年份、实际年龄、当年原义、语义变迁小史，和一个自动匹配的历史反差参照。定位：SEO 长尾工具站，每个词一个静态长尾页。

- 站点名：**Word Age**
- 域名占位：`https://wordage.fyi`（`build.js` 顶部 `SITE_ORIGIN` 常量，或环境变量 `SITE_ORIGIN` 覆盖）
- 技术：纯静态、零依赖、零后端。数据内嵌 `data.js`，file:// 可直接打开。

---

## 一、逐屏旅程

### 屏 1：主页首屏（0 说明书）
1. 报头：双线规（粗+细 hairline）下压着小型大写字母站名 `WORD AGE`，副题一句干话："Every word has a birthday. Most are not what you expect."
2. 一个大号衬线搜索框（autofocus），placeholder：`Type an English word — try “nice”`。
3. 搜索框正下方 6 个示例词 chip（nice / silly / girl / fun / meat / scientist）——第一次交互由点 chip 或打字完成，无需任何教程。
4. 往下是 Word of the Day 卡（当日种子词，词 + 年份 + 一行原义 + 链到词页）。

### 屏 2：查询结果（主页内联）
输入即搜（无 fetch，内存索引）：
- 下拉给前缀匹配建议（≤8 条，键盘 ↑↓ Enter 可选）。
- 命中后结果面板展开：
  - 巨大年份数字（桌面 ≥96px），**数字滚轮入场**：每位数字从模糊滚动到清晰，450ms；
  - 红色小型大写判词章：`OLDER THAN YOU THINK` / `YOUNGER THAN YOU THINK`；
  - 实际年龄（`≈ 726 years old`）；
  - `AS FIRST WRITTEN`（当年原义）→ `HOW IT DRIFTED`（一句变迁史）→ `FOR PERSPECTIVE`（反差参照）→ 可选 `MARGINALIA`（fun fact）；
  - 操作行：Save birth certificate（PNG）/ Copy as text / Permanent page →（去静态词页，利于分享收录）。
- 查无此词：不羞辱用户，给最相近 3 个建议（编辑距离），一行 "Not in the archive yet. Closest entries:"。

### 屏 3：词页（words/&lt;word&gt;.html，SEO 主力）
构建期完全静态渲染（不依赖 JS 出内容），版式像词典内页：词头 + 年份 + 判词 + 三段小史 + 参照 + 4 个相关词互链 + 返回主页。页面加载后 JS 只做增强：年份滚轮动画、分享按钮。

### 屏 4：馆藏目录（The Catalogue，words/index.html）
构建期生成独立目录页：全部词按字母序 + 年份，分组分栏。主页页脚链向它，它链向每个词页——爬虫从主页两跳可达全站；主页自身保持轻量（150KB 页重红线）。

## 二、数据集规范与收词标准

`data.js` 内嵌 `WORD_AGE.WORDS`，每条：

| 字段 | 必填 | 说明 |
|---|---|---|
| `w` | ✓ | 词形，小写，唯一 |
| `y` | ✓ | 数值年份（600–2020），用于排序/年龄/参照计算。世纪级约定：Old English→900，c.1300→1300，late 14c→1380，1590s→1595 等 |
| `d` | ✓ | 展示年份字符串（`Old English` / `c. 1300` / `1590s` / `1834`），**绝不显示编造的精确年份** |
| `orig` | ✓ | 首录时的意思（短语） |
| `shift` | ✓ | 一句语义变迁小史（≤160 字符） |
| `v` | ✓ | 判词：`older` / `younger`（按大众直觉的常见偏差人工标注） |
| `fun` | 可选 | 一条冷知识/破谣（如 kangaroo "我不知道"是讹传）。**存放在 `funfacts.js`（仅构建期使用，不进浏览器包）**——为守住主页 150KB 页重红线；fun 只在静态词页上以 MARGINALIA 节呈现 |

**收词红线**：
1. 只收词源学界公认事实（OED / Etymonline 共识口径）；不确定的词宁可不收。
2. 年份精确到世纪/年代即可；`d` 用 `c.` / `1590s` 风格表达不确定度，`y` 只是计算锚点。
3. 有争议的词源在 `shift`/`fun` 里用 "probably / perhaps / traditionally said" 明示（如 penguin、pie、noise）。
4. 民间词源必须剔除或点名破谣（sincere ≠ "sine cera"，posh 不收，golf 不收缩写讹传）。
5. 语义漂移是卖点：优先收"原义与今义反差大"的词（silly=blessed、meat=一切食物、starve=死亡）。

规模：首发 ≥260 词（实际首发 500 词）；四周运营每周 +15~25 词（见第八节）。数据以紧凑数组行存储（`[word, year, display, orig, shift, verdict]`，一行一词），运行时映射回对象——纯为页重预算。

## 三、参照锚点算法

`WORD_AGE.ANCHORS` ≥24 条：`{y, name, fame(1–3)}`，如 the printing press (1440)、Oxford University (c.1096)、US independence (1776)、the telescope (1608)、the fork arriving in England (c.1608)、Shakespeare's birth (1564)、sliced bread (1928)、Google (1998)。

匹配逻辑（`app.js` 与 `build.js` 共用同一份实现，产物与前端一致）：
- 词比锚点老（`a.y > y`）：得分 `fame × (2100 − a.y)`——偏爱"又有名又古老"的锚点，制造"连印刷术都比它年轻"的戏剧性；
- 词比锚点年轻（`a.y < y`）：得分 `fame × (a.y − 500)`——偏爱"又有名又晚近"的锚点（teenager → younger than sliced bread）；
- 同年：直接命中（"exactly as old as …"）；
- 年差 <15 且不同年：得分 ×0.4（太贴近读起来平淡）；
- 取得分前 3，按词名哈希确定性选一（60/30/10 权重）——同类词的参照有变化，但同一词永远一致（SEO 页稳定）。

文案模板：`older/younger than {name} ({y}) by {diff} years`。

## 四、SEO 结构

- **URL**：`/words/<word>.html`，全小写，词形即 slug（数据集只收 `[a-z-]` 词形）。
- **标题模板**：`How old is the word “{word}”? First recorded {d} | Word Age`（≤65 字符）。
- **Meta description 模板**：`“{word}” was first recorded {d}, when it meant “{orig}”. That makes it about {age} years old — {anchor line}. Full history inside.`（~155 字符内截断）。
- **OG**：og:title / og:description / og:type=article / og:url / og:site_name；Twitter summary card。
- **内链策略**：每词页 4 个相关词（2 个年份最近 + 1 个同首字母最近 + 1 个同判词哈希选取，确定性、去重）+ 返回主页；主页 Catalogue 全量链接 → 整站任意页两跳互达，权重扁平分发。
- **canonical**：每页自指。
- **sitemap.xml**：主页 + 全部词页，`lastmod` 用构建日期。`robots.txt` 指向 sitemap。
- 词条正文静态在 HTML 里（不靠 JS 渲染），首录年份出现在 title、h1 区、正文三处，覆盖 "how old is the word X" / "X word origin" / "when was the word X first used" 三族查询。

## 五、视觉与动效规格（活版印刷/档案馆）

- 色板：奶油纸 `#f7f2e7`、油墨黑 `#17130e`、氧化红 `#8e2f22`（点缀：判词章、强调、链接下划线）。hairline：`1px solid rgba(23,19,14,.25)`。
- 字体：全衬线 `Georgia, 'Iowan Old Style', 'Times New Roman', serif`；标签用 `font-variant-caps: small-caps` + 字距 0.12em。
- 字阶（1.25 模数）：13 / 16 / 20 / 25 / 31 / 39 / 61 / 96(+)；间距 4/8px 体系。
- 词条页版式：词头巨大衬线 + 右上角小型大写词性/年代标签；分节用 hairline + 小型大写节名；像词典内页。
- 年份数字：桌面 ≥96px（clamp 到移动 64px），带旧式数字感（letter-spacing 微负）。
- **年份滚轮动画**：每位数字一个纵列（0–9 堆叠），`transform: translateY` 从 0 滚到目标位，450ms `cubic-bezier(0.16,1,0.3,1)`，同时 `filter: blur(6px)→0`；各位错峰 40ms。动画期间滚轮 `aria-hidden` 且容器带 `aria-label`；落定后自动替换为纯文本（保证复制/朗读正确）。`prefers-reduced-motion: reduce` 时直接渲染纯文本。无数字的展示串（如 Old English）以斜体较小字号整体呈现。
- 其余动效 180–320ms，只动 transform/opacity。
- 禁：渐变背景、玻璃拟态、圆角阴影全家桶、emoji 堆砌、营销腔。空态/错态均有版式（"Not in the archive yet."）。

## 六、分享卡规格

母题二选一 → **出生证明（Certificate of Birth）**（与档案馆方向同构，且比墓碑少歧义）。

- Canvas 1080×1350（4:5 竖版，Instagram/小红书友好）。
- 结构：外双线框（粗 6px + 细 2px，oxide red 细线）→ 顶部小型大写 `CERTIFICATE OF BIRTH · THE WORD AGE ARCHIVE` → 巨大衬线词（自动缩放贴宽）→ `b. c. 1300 (≈ 726 years old)` → 红章判词（微旋转 −3°，描边无填充）→ `At birth it meant: “foolish, ignorant”` → 反差参照一行 → 底部 hairline + 域名 + "look up your own word"。
- 全部 ctx 字体走 Georgia 栈；背景奶油纸色 + 四角极淡年代渍（radial 极低透明度，不做纹理图片）。
- 文本版一键复制（格式见 app.js `shareText()`），零剧透、带回流链接。

## 七、发布 checklist

1. `node projects/word-age/build.js` 干净跑完；词页数 = 数据集词数；sitemap 条目 = 词数 + 1。
2. `node projects/word-age/test/data.mjs` 全断言通过。
3. `node projects/word-age/test/smoke.mjs` 通过（零 console error、搜索链路、3 随机词页、双视口截图、分享卡非空）。
4. 全 JS `node --check` 通过。
5. 换正式域名：改 `build.js` 的 `SITE_ORIGIN` → 重跑 build → 校验 sitemap/OG/canonical/分享卡域名一致。
6. 部署静态目录（词页 + sitemap + robots）；Search Console 提交 sitemap（见 MARKETING.md）。
7. AdSense：结果页下方注释位按 DEPLOY.md 步骤激活；未激活时保持自推广位。

## 八、4 周内容运营节奏

| 周 | 补词计划（每周 15–25 词） | 动作 |
|---|---|---|
| W1 | 高搜索量情绪词（awesome/awful 族、love/hate 族可考证部分） | 提交 sitemap；Reddit r/etymology 投 3 张最反差词卡（nice、silly、meat） |
| W2 | 食物主题包（menu/recipe/salad 族扩充） | 上"主题合辑"静态页雏形：Words younger than you think；TikTok 词源账号投喂 5 条脚本 |
| W3 | 科技/网络词包（更多缩写与商标词，严格考证） | 用 Search Console 首批曝光词反推补词；交换外链（词源博客） |
| W4 | 人名/地名来源词包（eponym/toponym） | 上"猜词龄"互动小游戏（roadmap）；复盘 CTR，重写表现差的 meta description |

节奏纪律：每周补词 = 改 `data.js` → 跑 build → 跑双测试 → 部署；每词必须过第二节红线。

## 九、目录结构

```
projects/word-age/
  PLAYBOOK.md DESCRIPTION.md DEPLOY.md MARKETING.md
  index.html style.css
  data.js       数据集（紧凑数组行，浏览器 + Node 双用）
  funfacts.js   fun facts（仅构建期，Node-only）
  lib.js        共享纯逻辑（锚点算法/编辑距离/相关词/分享文案）
  app.js        UI（主页模式 + 词页模式自动识别）
  build.js      零依赖 SSG
  robots.txt sitemap.xml
  words/<word>.html × N + words/index.html（构建产物，随仓库提交）
  test/smoke.mjs test/data.mjs test/screenshots/
```

页重实测（构建后由 test/data.mjs 断言）：主页 HTML+CSS+JS+数据 < 150KB；词页不装载数据集（词条内容构建期烘焙 + 单词条内联 JSON），单页 ≈ 30KB。
