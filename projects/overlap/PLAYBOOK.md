# 重叠时光 Overlap — PLAYBOOK

> 英文界面工具，面向异地恋 / 跨时区伴侣与好友。核心判断（来自策划案，全程贯彻）：
> **时区计算是红海，护城河全在情绪、分享、攒数这三层。**
> 算得准是入场券；让人舍不得关掉页面的，是那个只增不减的"共同清醒小时数"，
> 和一张愿意发给对方的卡。

---

## 一、逐屏旅程

### 屏 0 · 首屏（空态）
- 词标 `OVERLAP`（琥珀色小字距字），衬线大标题 *"Two cities. One day. How much of it is actually yours?"*
- 两张并排卡片：**YOU** / **THEM**，各一个城市搜索框 + 可折叠的"sleep & busy hours"设置。中间一枚 ⇄ 交换按钮。
- 空态提示一句衬线斜体 *"Start with your city. Then theirs."* + 一条微缩的示意灯带（半透明），暗示即将出现的可视化。
- **0 说明书**：第一次交互（在框里打字）本身就是教学。

### 屏 1 · 选城
- 输入即出下拉（≤8 条），每条含英文名、中文名、国家。支持中文（"东京"）、别名（"NYC"、"三藩市"、"Saigon"）、带变音符查询（"são"）。
- 键盘完整可用：↑↓ 选择、Enter 确认、Esc 关闭。
- 选中后城市卡片下方出现活的当地时间（每秒刷新）："Japan · 13:19"。

### 屏 2 · 结果（核心屏）
从上到下五段，一次滚动读完：
1. **时差一句话**（小字大写）："TOKYO RUNS 13H AHEAD."（同区则 "Same clock, different streets."）
2. **判语**：衬线体 "You overlap for **2h 47m** a day."，巨字带暖光晕；下接分档情绪文案（见第四节）。
3. **双轨灯带**：未来 24h，上轨 you、下轨 them，三色段（醒着自由=琥珀、忙=暗紫、睡=近黑）；两人都自由的区间以暖白发光框叠加，段内标注时长；上缘标你的整点（每 3h），下缘对齐标出对方同刻的当地时间——一眼看懂时差；左端 "now" 竖线。
4. **窗口列表**：最长窗口放大展示，衬线斜体命名（"the goodnight window"）+ 双方各自的时段 + 时长；其余窗口小字列出。
5. **倒计时**："next window opens in **3h 12m 08s**"，秒级跳动；窗口开着时变为 "the window is open — closes in …" 并发暖光。

### 屏 3 · 里程表（攒数）
- "HOURS AWAKE TOGETHER" + 衬线巨数 "1,204 h 32 m"。
- 页面开着且两人此刻都自由 → 圆点发光、实时累积；否则圆点熄灭。
- "we met on <date>" 回填：按当前日重叠量 × 相识天数估算历史累计，叠加页面实测值。
- "reset counter" 两步确认（点一次变 "sure? this zeroes it"，3 秒内再点才清零）——不弹系统对话框。

### 屏 4 · 分享
- 两个按钮：**Save the card**（canvas 生成 PNG 下载 + 页内预览）/ **Copy as text**（剪贴板文本版 + toast "Copied."）。
- 页脚：自推广位（激活 AdSense 前的默认态）+ 域名 + 隐私一句话（"your cities, hours and counter never leave this device"）。

### 回访钩子
- localStorage 记住这对城市与作息，回来即见结果屏；URL hash `#new-york/tokyo` 可直达/转发（页面开着收到链接也会热切换）。
- 里程表数字只增不减 = 每天回来看一眼的理由。

---

## 二、时区算法说明（DST 处理）

**红线：全部换算走 `Intl.DateTimeFormat({ timeZone })`，禁止任何手写固定 offset。**

- 模型：从"当前时刻向下取整到 15 分钟"起，对未来 24h 取 **96 个采样点**（15 分钟一个）。每个采样点是一个真实的绝对时刻（Unix ms），分别用两地 IANA 时区经 `formatToParts` 转成本地墙钟（时:分 + 星期），再对照各自的睡眠/忙碌时段判定 `sleep | busy | free`。两侧同为 `free` 的采样点即重叠。
- **DST 自动正确**：因为判定的是"真实时刻的本地墙钟"，夏令时切换、半小时区（印度 +5:30）、45 分钟区（加德满都 +5:45）、跨日界线全部由平台 tz 数据处理。24h 窗口若跨切换日，本地墙钟会出现 23/25 小时，采样法天然免疫。
- offset 推导（仅用于展示"X runs 13h ahead"）：`Date.UTC(本地墙钟各分量) − 时刻本身`，仍然来自 Intl，不是查表。
- **NYC–London 的真实细节**（写进测试）：常年相差 5h；只有两段"错位窗口"是 4h——美国 3 月第二个周日已入夏令时而英国要等 3 月最后一个周日（及秋季反向）。tz.mjs 用 2026-01-15（5h）、2026-03-20（4h）、2026-07-15（5h）三个固定时刻断言，并验证它体现在重叠分钟数里（180 → 120 → 180）。
- 忙碌时段跨午夜（夜班 22:00–06:00）归属**开始的那一天**：周五夜班延伸到周六凌晨仍算周五的班。睡眠优先于忙碌。`start === end` 表示该时段不存在。
- 分辨率 15 分钟：作息输入 step=900，窗口边界必落在采样格上，倒计时到边界时刻是精确的。
- 每秒 tick 只做轻量渲染；跨 15 分钟边界才重采样一次（96 次 formatToParts × 2，微不足道）。

## 三、城市表规范（cities.js）

- **330 条**，字段：`n` 英文名 / `c` 国家 / `z` IANA 时区 / `h` 中文名 / `a` 别名数组（缩写、旧称、罗马化、中文别名）。
- `id` 由脚本生成：名字 slug（去变音符、小写、连字符），撞名追加国家 slug（`san-jose` vs `san-jose-costa-rica`）。id 用于 URL hash 与里程表 key，**上线后不可更名**。
- 规则：
  - 时区一律真实 IANA ID，禁止 `Etc/GMT+8` 之类固定偏移。
  - 中国大陆城市统一 `Asia/Shanghai`（法定全国时间；乌鲁木齐、拉萨亦然）。
  - 已弃用别名不用（`Europe/Kiev` → `Europe/Kyiv`；蒙特利尔用 `America/Toronto`）。
  - 别名收录标准：真实有人会打的词（NYC、SF、KL、Saigon、Bombay、三藩市、汉城），不堆砌。
- 搜索排序：全名精确 > 名字前缀 > 中文/别名前缀 > 任意子串 > 国家前缀；≤8 条。
- 扩表流程：加条目 → 跑 `node projects/overlap/test/tz.mjs`（自动验证所有 zone 可被 Intl 解析、id 唯一、字段齐全）。

## 四、情绪文案分档表

| 档位 | 重叠量 | 文案（克制，禁营销腔） |
|---|---|---|
| zero | 0 | No shared free hour in the next day. One of you bends, or the calendar wins. |
| thin | <1h | Less than an hour. If it matters, you'll both be standing in it. |
| enough | 1–3h | 2 hours is enough if you both show up. |
| solid | 3–6h | That's real time. People in the same city use less of it. |
| wide | >6h | Most of your waking day is shared. Distance is doing less damage than it claims. |

## 五、窗口命名规则表

取最长窗口**中点时刻**在两地的本地小时，各归一档：
**M** 晨 05–12 · **D** 昼 12–18 · **E** 晚 18–21 · **N** 夜 21–05（夜从 21 点起：21:30 达峰的窗口是道晚安，不是晚饭）。

| you\them | M | D | E | N |
|---|---|---|---|---|
| **M** | morning coffee together | your coffee, their lunch | your morning, their evening | your sunrise, their midnight |
| **D** | your lunch, their coffee | the long afternoon | your afternoon, their evening | your daylight, their small hours |
| **E** | your evening, their morning | your evening, their afternoon | the dinner window | your dinner, their small hours |
| **N** | your midnight, their sunrise | their daylight, your small hours | their dinner, your small hours | the goodnight window |

命名始终以"you"侧视角措辞；查不到（不可能）回退 "the shared window"。

## 六、里程表机制

- 存储 key：`overlap:v1:meter:<idA~idB>`（两 id 排序后拼接，换向不换账本）。结构 `{v:1, ms:<实测毫秒>, met:<"YYYY-MM-DD"|null>}`。
- **实测累积**：每秒 tick，若两人此刻都 `free`，累加真实流逝毫秒（单次 delta 上限 120s，防合盖休眠后回灌）；每 20s 落盘，`pagehide`/切后台再落一次。后台回前台时重置 tick 起点，不给节流时间记账。
- **回填**：`met` 设置后，显示值 = `floor(相识天数) × 当前日重叠分钟` + 实测 ms。是坦率的估算（按今天的作息外推），文案写明 "estimated since …, plus time this page has watched"。
- **容错**：任何字段类型不对/负数/日期非法 → 整体回退 `{ms:0, met:null}`，不炸页面（smoke 有垃圾注入用例）。
- 纯本地版的诚实声明：不做服务端，就不承诺防改时间刷数——这是纪念表不是排行榜。二期上配对短链时再迁移到服务端时间。

## 七、动效与视觉规格

- **色板**：底 `#0e1526`；抬升面 `#131c31`；文字 `#e9e2cf`；次要 `#8b93a7`；琥珀（醒着自由）`#e8b45f`/`#c99a52`；忙紫 `#3d3157`；睡黑 `#0a101f`（描边 `#1d2742`）；重叠暖白 `#fff3d6`/发光 `#ffe9b8`。**页面唯一的暖白发光只给重叠**（灯带重叠框、倒计时开窗态、里程表活跃点、判语巨字）。
- **字体**：衬线 Georgia/Times/Songti（标题、判语、窗口名、里程数）；数据与 UI 用系统无衬线。字阶 1.25 模数：12.8/16/20/25/31/39/49/61/76。间距 4/8px 体系。
- **动效**：全部 `cubic-bezier(0.16,1,0.3,1)`，180–320ms；结果区入场 320ms 上浮；重叠发光 3.4s 呼吸（opacity）；⇄ 按钮 hover 旋转 180°；toast 220ms。只动 transform/opacity。`prefers-reduced-motion` 全灭。
- **星空**：body::before 十枚静态 radial-gradient 星点，不闪烁（克制）；分享卡上用种子随机 130 枚。
- 触控目标 ≥44px；375px 起可用（灯带在自身容器内横向滚动，页面不横滚）；焦点可见（amber outline）。

## 八、分享卡规格

- **PNG**：canvas 1080×1350（4:5，社交 feed 最优）。自上而下：词标 → 城市对 "New York ↔ Tokyo"（衬线斜体，超长自动缩字）→ 两地此刻时间 → 巨字时长（衬线 ≤190px，暖光晕）→ "a day, awake and free — together" → 双轨灯带（含发光重叠块）→ 最长窗口名与双方时段 → 里程表读数（>0 才出现）→ 分隔线 + `overlap.love` + tagline。种子固定的星空背景。文件名 `overlap-<idA>-<idB>.png`。
- **文本版**：
  ```
  We overlap for 2h 47m a day.
  New York 08:12 ↔ Tokyo 21:12
  Longest window: "the goodnight window" — 21:00–23:45 for me, 10:00–12:45 for them
  1,204 hours awake together and counting
  overlap.love
  ```
- 零剧透原则不适用（工具类），但卡面必须有炫耀点（巨字 + 窗口名 + 里程数）与回流位（域名）。

## 九、发布 checklist

- [ ] `node --check` app.js / cities.js 通过
- [ ] `node projects/overlap/test/tz.mjs` 全绿（DST 三时刻、日界线、同城、Auckland–Honolulu、命名、城市表）
- [ ] `node projects/overlap/test/smoke.mjs` 全绿（双视口截图、零 console error、中文搜索、卡片非空、垃圾 localStorage、reduced-motion）
- [ ] file:// 直开可用（零依赖、零请求）
- [ ] 总重 <150KB（当前 ~90KB）
- [ ] 域名占位 `overlap.love` 全局替换为真实域名（index.html OG 标签、app.js 卡片/文本、页脚）
- [ ] 生成 `og-card.png`（用产品自身存一张 NYC–Tokyo 卡即可）放站点根目录
- [ ] robots 可抓、meta description/OG 核对
- [ ] 真机各过一遍 iOS Safari / Android Chrome（time input、date input、下载 PNG）

## 十、4 周运营节奏

| 周 | 动作 | 目标 |
|---|---|---|
| W1 上线周 | r/LongDistance 首帖（见 MARKETING 模板）+ 小红书 3 条真实向笔记；盯 DST 边界反馈 | 首批 UGC 卡片流出 |
| W2 攒数周 | 推 "we met on" 回填玩法（"我们已经一起醒着 6,968 小时"）；X/即刻发跨时区远程团队副线 | 回访率、hash 链接互发 |
| W3 长尾周 | 按 SEO 词表补 10–20 组热门城市对语料（帖子/笔记形式，链到对应 hash 深链）| 搜索流量起步 |
| W4 节点周 | 蹲最近的情感节点（七夕/纪念日话题）发起 "晒你们的重叠时长" 挑战；评估 AdSense/联盟位是否开启 | 分享卡二次传播 |

每周固定：看一次里程表相关反馈（数字是命根子，任何"数字变小了"的反馈当 P0 修）。
