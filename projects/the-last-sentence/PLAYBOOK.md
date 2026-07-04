# The Last Sentence 最后一句话 — Playbook

全球只有一句话活着。任何人写下新句子，旧句子就死了——坠入墓地，墓碑上刻着它活了多少毫秒。
本项目是五个项目中唯一允许后端的：**共享状态就是产品本体**。

- 艺术方向：极简文学 / 纪念碑。近黑 `#111110`，骨白正文，唯一强调色是烛火琥珀 `#d8a03d`（只用于存活时长）。
- 两种声音：衬线（Georgia 栈）= 活着的句子；等宽 = 机器（计时器、墓碑、控件）。
- 界面语言：英文（全球实验型产品）；本文档中文。

---

## 一、逐屏旅程

### 1. 首屏（0 说明书）
- 顶栏：小号等宽字 wordmark `the last sentence` + 连接状态点（琥珀 = live / 红 = reconnecting / 灰 = offline demo）。
- 正中：**当前句子**，大号衬线（桌面 40–64px），句尾一个闪烁的打字机方块光标——它和毫秒跳动的计时器一起构成页面的心跳。
- 句子下方一行：`#8,403 · alive for 4m 12.882s`（序号骨白、时长琥珀、毫秒每帧刷新）。
- 再下一行灰字：`8,402 sentences died before this one`。
- 输入框（衬线、斜体占位符 `write the one that replaces it`）+ 剩余字符数 + `OVERWRITE` 按钮。
- 玩法通过第一次提交自我解释：你写 → 它上位 → 旧句坠亡。无教程、无弹窗。

### 2. 覆盖瞬间（核心 400ms）
- 旧句子从原位**加速下坠 + 淡出**（400ms，`cubic-bezier(0.55, 0, 0.85, 0.4)`，只动 transform/opacity）。
- 新句子以打字机逐字浮现（整句约 1s 内完成，见动效规格）。
- 同一瞬间：墓地顶部长出新墓碑（320ms 沉降动画），计数器 +1，计时器归零重新开始跳。
- 所有在线的浏览器**同时**看到这一幕（SSE 广播）。

### 3. 提交后
- 反馈行：`yours is #8,404 — alive right now.`
- 按钮变为 `WAIT 10S` 倒计时（前端冷却），同时后端对同 IP 强制 10s。
- 你的句子死掉时（本地记录过的序号被埋葬）：页面出现死亡横幅
  `yours is dead. it survived 4m 12.882s as #8,404.` + `COPY EPITAPH` 按钮。

### 4. 墓地（下滑）
- 无限滚动列表（IntersectionObserver 懒渲染，每次 40 条），每条墓碑：
  `#8,402` + `survived 4m 12.882s`（琥珀）+ `COPY` + 句子原文（衬线、灰）。
- 你自己的墓碑正文以骨白高亮。
- 列表尽头（服务器只保留最近 500 条时）：`older sentences are dust. only the last 500 are kept.`
- 底部：极简自推广位（虚线框，可换 AdSense，见 index.html 注释）+ 页脚。

### 5. 离线 demo（file:// 或纯静态托管）
- 顶部横幅：`offline demo — nothing you write here leaves this page. the real one is a single shared sentence.`
- 12 条预置墓碑（含 9ms 与 2 小时的极端对比、`first.` 之类的梗），当前句预置、可自娱覆盖，冷却照常。
- 用途：预告页/占位页（见 DEPLOY.md 过渡方案）。

---

## 二、交互规格

### 覆盖
| 事项 | 规格 |
|---|---|
| 输入上限 | 120 字符（Unicode code point 计），前端 maxlength + JS 截断，后端复核 |
| 空提交 | 前端摇头动画 + `say something first.`；后端 400 `empty`（含纯空白/零宽字符） |
| 提交方式 | 回车或点击 OVERWRITE；请求期间按钮禁用防连点 |
| 并发裁决 | 服务器单线程串行，以到达顺序为准；被夹在中间的句子存活可为 0–50ms（是梗不是 bug） |
| 一致性 | 提交成功不本地写 DOM，靠 SSE 广播统一驱动所有端（包括提交者自己） |

### 计时
| 事项 | 规格 |
|---|---|
| 格式 | `0.812s` / `12.041s` / `4m 12.882s` / `1h 04m 09.115s` / `2d 01h 33m 07.000s`，毫秒恒三位 |
| 刷新 | requestAnimationFrame 每帧更新，`tabular-nums` 防抖动 |
| 时钟源 | 服务器时间。快照/事件携带 `now`，客户端算 offset，显示 `serverNow - bornAt`，跨端一致 |

### 墓地
- 数据：SSE 快照带最近 500 条（新→旧）；覆盖事件把新墓碑 prepend。
- 渲染：首屏 40 条，滚近底部哨兵（600px 提前量）再渲染 40 条。
- 复制：每条墓碑 `COPY` → `"句子" survived 4m 12.882s as #8,402 on the last sentence — <链接>`；
  若是自己的句子 → `my sentence survived 4m 12.882s as #8,402 on the last sentence — <链接>`。
- 断线重连：EventSource 自动重连，重连后全量快照重建墓地（按 seq 去重）。

---

## 三、后端协议（server.mjs，零依赖 ≤300 行）

### 端点总表

| 端点 | 方法 | 请求 | 成功响应 | 错误 |
|---|---|---|---|---|
| `/` `/index.html` `/style.css` `/app.js` | GET | — | `200` 静态文件，带 CSP 与 `X-App: last-sentence` | `404 not_found`（其他路径）、`405 method_not_allowed` |
| `/events` | GET | SSE 长连接 | `200 text/event-stream`：连接即推 `state` 快照，此后每次覆盖推 `overwrite`；每 25s 心跳注释 | `405` |
| `/say` | POST | `{"text": "..."}`（JSON，≤8KB） | `200 {"ok":true,"seq":8404,"cooldownMs":10000}` | 见下表 |

### `/say` 错误码

| HTTP | body | 触发条件 |
|---|---|---|
| 400 | `{"error":"bad_request"}` | 非 JSON / text 非字符串 |
| 400 | `{"error":"empty"}` | 清洗后为空（纯空白、控制符、零宽字符） |
| 400 | `{"error":"too_long","max":120}` | 超过 120 code points |
| 413 | `{"error":"too_large"}` | body 超 8KB |
| 429 | `{"error":"cooldown","retryAfterMs":8123}` + `Retry-After` 头 | 同 IP 10s 内二次提交 |
| 405 | `{"error":"method_not_allowed"}` | 非 POST |

### SSE 事件

```
event: state      # 连接建立时一次；重连后重放
data: { "current": {"text","seq","bornAt"}, "total": 8403,
        "graves": [ {"text","seq","bornAt","diedAt","survivedMs"}, ... ≤500 条 新→旧 ],
        "now": 1783137988166 }

event: overwrite  # 每次覆盖广播
data: { "grave": {...}, "current": {...}, "total": 8404, "now": ... }
```

### 持久化
- 每次接受的句子追加一行到 `history.jsonl`：`{"text","at","seq"}`（text 已转义）。
- 重启恢复：逐行重放，相邻两行差 = 一块墓碑；恢复最近 500 条墓地、总数、当前句（存活时长跨重启连续）。
- 损坏行逐行跳过；文件缺失则写入创世句 `someone will overwrite this.`（#1）。
- 体积估算：~150B/句，一百万句 ≈ 150MB，appendFileSync 足够（写频受冷却天然限速）。

---

## 四、限流与内容安全

| 层 | 策略 |
|---|---|
| 冷却 | 10s/IP（`COOLDOWN_MS` 可调）。前端按钮倒计时；后端 Map 强制，429 带 `retryAfterMs`；Map 每分钟清扫防膨胀 |
| IP 判定 | 直连取 socket 地址；上 Fly/Railway 必须设 `TRUST_PROXY=1` 取 `X-Forwarded-For` 首跳（否则所有人共享代理 IP 的一个冷却桶） |
| XSS | 后端存储/广播前做 HTML 全转义（`& < > " '`）；前端解码后**只经 textContent 插入**，双保险；静态响应带 CSP（禁内联、禁外域） |
| 清洗 | 控制符/零宽字符 → 空格，连续空白折叠，首尾去除 |
| 脏词 | 小词表（约 19 词 + s/es/ed/er/ing 后缀）命中替换为 `▓▓`，墓碑保留占位不保留词 |
| 上限 | body 8KB、120 字符、静态路径白名单 |
| 兜底（上线后人工） | `history.jsonl` 可回溯；紧急下架 = 停服 → 编辑对应行 text 为 `[removed]` → 重启（保序号与毫秒完整）。SLA：恶性内容 ≤10 分钟内处理 |
| 已知残留 | 词表极小（英文为主）、无多语言审核、无验证码；换 IP 可绕冷却。V2 引入轻量文本分类 + 设备指纹（见风险节） |

---

## 五、动效规格（全部只动 transform/opacity，60fps）

| 动效 | 时长 / 缓动 | 说明 |
|---|---|---|
| 旧句下坠 | 400ms `cubic-bezier(0.55, 0, 0.85, 0.4)` | 克隆节点绝对定位，`translateY(42vh)` + 淡出，450ms 后移除。这是「死亡感」的核心 |
| 新句打字机 | 每字 14–36ms（按句长自适应，整句 ≈900ms 封顶） | 逐 code point 揭示；期间光标常亮 |
| 光标心跳 | 1.1s `steps(1)` 无限 | 句尾 0.5em 方块，55% 占空比 |
| 墓碑沉降 | 320ms `cubic-bezier(0.16, 1, 0.3, 1)` | `translateY(-8px)` + 淡入 |
| 拒绝摇头 | 240ms | 输入框 ±6px 水平抖动 + 下边线变红 |
| 按钮/状态点 | 160–240ms `ease-out` | hover 反色、状态切换 |
| prefers-reduced-motion | 全部动画禁用 | 下坠改瞬时消失、打字机改整句直出、光标静止；计时器照常（是内容不是装饰） |

---

## 六、发布 checklist

- [ ] `node projects/the-last-sentence/test/smoke.mjs` 全绿（44 项）
- [ ] `app.js` 顶部 `SITE_URL` 兜底域名 & `index.html` OG 标签换成正式域名
- [ ] 部署平台已设 `TRUST_PROXY=1`（在代理后必须）与 `HISTORY_FILE=/data/history.jsonl`
- [ ] 持久卷已挂载，重启后墓地仍在（手动验证一次）
- [ ] 手机实机过一遍：375px 无横向滚动、触控目标 ≥44px、输入不被键盘遮挡
- [ ] 冷却实测：连续提交第二次得到 429 + 按钮倒计时
- [ ] 脏词、XSS 字符串、纯空白、121 字符各打一发验证
- [ ] 值守方案就绪：能在 10 分钟内 SSH 下架恶性内容（见内容安全兜底）
- [ ] 静态预告页（demo 模式）先行上线，正式域名切换预案就绪
- [ ] 备份 cron：每日 `history.jsonl` 异地拷贝

---

## 七、4 周运营节奏

核心思路：**不造内容，造时刻**。产品的可运营资产只有两样——存活时长的极端值、序号的整数关口。

### 第 1 周 · 冷启动
- D1：静态 demo 预告页上线 24h（"the real one opens tomorrow"），同时发 X 首推："right now the whole internet is allowed exactly one sentence. tomorrow you can overwrite it."
- D2：正式上线。Show HN（草稿见 MARKETING.md）+ X 线程。创始团队轮流值守内容安全。
- D3–D7：每天固定一条"墓地考古"推文：截图一条戏剧性墓碑（活 9ms 的、活 3 小时的、被 0.4s 覆盖的表白）。目标：让"晒墓碑截图"成为默认分享行为。

### 第 2 周 · 抢位战（制造首个时刻）
- 预告一个**整点抢位战**（周六 UTC 20:00）："for one hour, we watch. the sentence alive at 21:00:00.000 gets framed forever."（获胜句置顶推文 + 加入 README 名人堂）。
- 主播/群主定向邀请：这个产品天然适合直播画面（一句话 + 心跳计时器）。
- 数据素材：赛后发布"这一小时死了 412 句，最短命 11ms"战报图。

### 第 3 周 · 涌现玩法引导
- **接龙挑战**：官号发起 "chain hour"——每句必须以上一句的最后一个词开头。不改代码、不设规则强制，只发一条推文点火，让社区自组织；赛后把最长接龙整理成"墓地长诗"发布。
- **纪念日刷屏**：引导用户在生日/纪念日"到此一句"（"leave a sentence on your day, screenshot it before it dies"）。墓碑复制文案自带日期语义（存活时长 + 序号），适合做成年度回访钩子。
- 收集"守夜人"故事：凌晨守着自己句子活过 1 小时的用户，转发其自述。

### 第 4 周 · #10,000 关口（或按实际增速调整）
- 提前 3 天倒计时："sentence #10,000 is coming. whoever writes it, writes history."（详见 MARKETING.md 事件方案）。
- #10,000 诞生瞬间：截图 + 墓碑永久高亮（手动置顶到 README/推文即可，不改机制）。
- 周末复盘长文：《一万句话的墓地：人们在唯一的文本框里写了什么》——数据向（中位存活时长、最常见开头词、凌晨 vs 高峰），这是第二波传播弹药。

### 常态节奏（第 5 周起）
- 每周一条墓地考古 + 每月一次整点抢位战 + 每个整数关口（50k/100k）一次倒计时。
- 跨年、节日整点是天然高峰，提前一周预告即可，无需开发。

---

## 八、风险与残留问题

1. **内容安全是最大风险**：词表极小，无法拦截多语言脏话、引流广告、人身攻击。上线初期必须人工值守；V2 优先级：更大词表 + 轻量分类模型 + 举报按钮。
2. **换 IP 绕冷却**：可接受（成本高于收益）；恶化时加设备指纹 + 全局提交频率熔断（如全局 >2 句/秒时排队）。
3. **单实例内存态**：多实例部署会分裂世界。当前规约：**只跑 1 个实例**（fly.toml 已锁）。规模化需 Redis 单键 + pub/sub，属 V2。
4. **history.jsonl 无限增长**：一百万句 ≈150MB，短期无虞；V2 做按月分卷。
5. **SSE 连接数**：单实例数千连接可扛；超出后上多实例读扩散（写仍单点）。
