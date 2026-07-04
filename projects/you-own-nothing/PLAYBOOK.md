# You Own Nothing — 制作 Playbook

> 一间温暖的手绘公寓，里面每一样东西都是 SaaS。点击任意物件弹出一个以假乱真的订阅弹窗；
> 订阅则物件继续活着，拒绝则它当场褪色垂头。逛完全屋或推门上班，得到一张热敏小票：
> MONTHLY TOTAL $XXX.XX，Items you actually own: 0。
>
> 界面全英文（讽刺对象是英语世界的 SaaS 话术），文档中文。纯静态零依赖，file:// 可开。

---

## 一、逐物件清单（16 件，全部可点）

默认三档命名 Basic / Pro / Max（猫为 Basic / Premium / Max）。每件物品有：品牌、slogan、三档价与档位文案、拒绝按钮文案（confirm-shaming）、fine print、灰阶动画、荒诞度（分享卡排序用）。

| # | 物件 | 品牌 | 三档价格 | 拒绝按钮 | 荒诞度 |
|---|------|------|----------|----------|--------|
| 1 | 落地台灯 | LumenCloud™ | $2.99 / $5.99 / $9.99 | keep sitting in the dark | 6 |
| 2 | 沙发 | PlushTier™ | $8.99 / $14.99 / $22.99 | stand indefinitely | 5 |
| 3 | 电视 | PixelPane™ | $11.99 / $17.99 / $24.99 | stare at the black rectangle | 4 |
| 4 | 冰箱 | ColdCloud™ | $9.99 / $15.99 / $21.99 | eat it all today | 5 |
| 5 | 咖啡机 | DripSync™ | $3.99 / $7.99 / $12.99 | be tired forever | 6 |
| 6 | 窗（窗外景色） | ViewPass™ | $4.99 / $8.99 / $14.99 | enjoy the fog | 9 |
| 7 | 暖气片 | EmberLease™ | $6.99 / $11.99 / $18.99 | wear another sweater | 8 |
| 8 | 前门 | ThresholdPlus™ | $12.99 / $19.99 / $29.99 | you weren't going anywhere | 9 |
| 9 | 绿植 | Chlorofeed™ | $1.99 / $3.99 / $6.99 | let nature take its course | 6 |
| 10 | 猫 | WhiskerCare™ | $4.99 / $8.99 / $13.99 | let her go | 10 |
| 11 | WiFi 路由器 | SignalPatch™ | $7.99 / $13.99 / $19.99 | embrace the offline lifestyle | 4 |
| 12 | 书架 | TomeStream™ | $5.99 / $9.99 / $15.99 | admire the wall instead | 7 |
| 13 | 地毯 | WeaveWell™ | $3.49 / $6.49 / $10.49 | the floor is fine | 7 |
| 14 | 恒温器 | SetPoint™ | $2.49 / $4.99 / $8.49 | adapt biologically | 7 |
| 15 | 天花板吊灯 | GlowGrid™ | $3.99 / $6.99 / $11.99 | the sun exists, sometimes | 5 |
| 16 | 室内空气 | AirPure™ | $5.99 / $10.99 / $16.99 | hold your breath | 10 |

全订最低档合计 ≈ $99.85/mo；全订最高档合计 ≈ $260.83/mo（不含 Protection Plan 加购）。

### 逐物件弹窗文案（英文，冷面幽默，禁感叹号）

**1. LumenCloud™ — "Light, as a service."**
- Basic $2.99：One bulb, warm-ish.
- Pro $5.99：Dimmer access. Two moods.
- Max $9.99：Full brightness. Includes the color yellow.
- Fine print：Photons remain the property of LumenCloud Inc. Unused light does not roll over.
- 灰阶：光锥 300ms 淡出，灯头以灯颈为轴下垂 -22°。

**2. PlushTier™ — "Sitting, reimagined."**
- Basic $8.99：Two cushions. Firmness not guaranteed.
- Pro $14.99：All cushions. Naps up to 40 minutes.
- Max $22.99：Unlimited naps. Guest seating for one (1) guest.
- Fine print：Lying down is a Pro feature. Prolonged comfort may require the Comfort+ add-on.
- 灰阶：坐垫下沉 2px，整体去饱和。

**3. PixelPane™ — "A window to content. The window is rented."**
- Basic $11.99：720p. Ads before the ads.
- Pro $17.99：4K, on weekdays.
- Max $24.99：8K. Nothing is broadcast in 8K.
- Fine print：Screen remains on-site property of PixelPane. Content sold separately. Remote sold separately. Buttons sold separately.
- 灰阶：画面熄灭为深灰底，屏内风景消失。

**4. ColdCloud™ — "Refrigeration is a lifestyle."**
- Basic $9.99：Above-freezing freshness.
- Pro $15.99：Actual cold. Crisper drawer unlocked.
- Max $21.99：Ice. The good kind.
- Fine print：Temperatures below 5°C are metered. Door-open time is billed by the second after ten seconds.
- 灰阶：门上便签磁贴掉落，LED 熄灭。

**5. DripSync™ — "Your morning, on a plan."**
- Basic $3.99：One cup per day. Lukewarm tier.
- Pro $7.99：Hot coffee. Steam included.
- Max $12.99：Espresso mode. Jitters guaranteed or your month back.
- Fine print：Beans not included. Water not included. Cup rental available.
- 灰阶：蒸汽消失。

**6. ViewPass™ — "The outside, in stunning definition."**
- Basic $4.99：Overcast package.
- Pro $8.99：Sunlight, weekends included.
- Max $14.99：Sunsets, birds, one (1) rainbow per quarter.
- Fine print：View subject to regional availability. Seasons rotate on a separate plan. Opening the window requires FreshAir compatibility (see AirPure™).
- 灰阶：窗外太阳、山丘、云整体雾化为灰色浓雾。

**7. EmberLease™ — "Warmth, delivered monthly."**
- Basic $6.99：Takes the edge off.
- Pro $11.99：Cozy. Socks optional.
- Max $18.99：Tropical. Neighbors will ask questions.
- Fine print：Heat is licensed, not owned. Residual warmth is reclaimed upon cancellation.
- 灰阶：上升的热浪线消失。

**8. ThresholdPlus™ — "Enter and exit, seamlessly."**
- Basic $12.99：Three exits per day.
- Pro $19.99：Unlimited exits. Re-entry included.
- Max $29.99：Priority hinge. The door opens for you.
- Fine print：Emergency exits billed at surge rates. The doorknob is a peripheral.
- 灰阶：整门去饱和并微微下垂 0.6°，门口地垫一并变灰。
- 特殊行为：门被处理（订阅或拒绝）后再点门 = "leave for work" 直接进结算页。拒绝过门的玩家，小票上的出门方式是 window, undignified。

**9. Chlorofeed™ — "Photosynthesis, managed."**
- Basic $1.99：Green, mostly.
- Pro $3.99：A new leaf every quarter.
- Max $6.99：It thrives. It knows you pay.
- Fine print：Wilting is a natural process and is not covered by the SLA (Service Leaf Agreement).
- 灰阶：五片叶子依次（每片间隔 60ms）向下耷拉。

**10. WhiskerCare™ — "Companionship, per calendar month."**
- Basic $4.99：She acknowledges you. Occasionally.
- Premium $8.99：Purring included.
- Max $13.99：Lap privileges, subject to her mood.
- Fine print：Purring included in Premium only. Affection sold separately. The cat retains all rights to the cat. She is currently on a free trial and does not know this.
- 灰阶：猫起身向右走出一格（translateX 88px）并去饱和——离家出走，走向厨房方向。

**11. SignalPatch™ — "Connectivity, in its natural habitat."**
- Basic $7.99：Two bars.
- Pro $13.99：All bars. Buffered enlightenment.
- Max $19.99：Speeds we describe as "up to".
- Fine print：Bandwidth is shaped for your wellbeing. The blinking light is decorative and billed separately.
- 灰阶：信号弧消失，LED 熄灭，一根天线歪倒。

**12. TomeStream™ — "Books you can almost keep."**
- Basic $5.99：Spines visible.
- Pro $9.99：Books may be opened.
- Max $15.99：Includes reading. Retention not included.
- Fine print：Titles rotate monthly. Page 47 is premium content on all plans.
- 灰阶：斜靠着的那本书彻底倒平。

**13. WeaveWell™ — "Softness underfoot, on us. Billed to you."**
- Basic $3.49：Feels like a rug.
- Pro $6.49：Pile height, generous.
- Max $10.49：Barefoot certified.
- Fine print：The pattern is licensed from the pattern's original artist, who is also on a subscription.
- 灰阶：内圈虚线花纹消失，整体灰。

**14. SetPoint™ — "Temperature preferences, honored monthly."**
- Basic $2.49：Two temperatures, 17° and 26°.
- Pro $4.99：One-degree increments.
- Max $8.49：Your exact preference, remembered.
- Fine print：Half-degrees are an enterprise feature. Contact sales.
- 灰阶：表盘指针垂到底，读数从 21° 变为 --。

**15. GlowGrid™ — "Overhead lighting for the modern tenant."**
- Basic $3.99：Sixty watts of ambiance.
- Pro $6.99：Warm white or cool white. Not both.
- Max $11.99：Both.
- Fine print：Switch actuation counts toward your monthly toggle allowance (100).
- 灰阶：光晕熄灭，灯泡变灰。

**16. AirPure™ — "Breathe with confidence."**
- Basic $5.99：Standard air. 78% nitrogen, as is.
- Pro $10.99：Filtered. Notes of cedar.
- Max $16.99：Mountain-grade. Oxygen-forward.
- Fine print：Air is provided as-is, where-is. Exhaled air remains subject to our recapture program.
- 灰阶：空气波浪线拉平成三条直线，尘埃光点熄灭。

---

## 二、黑暗模式库（每次弹窗随机挂载一种，仅讽刺展示）

| 代号 | 名称 | 表现 | 边界 |
|------|------|------|------|
| A | annual-preselect | 计费周期默认选中 "Annual — save 17%"，旁边 11px 灰字 "switch to monthly"；月费总额仍按月价计入 | 可一键切回月付 |
| B | rot-decline | 拒绝按钮渲染成 11px 灰色纯文本 "let it rot"，主按钮巨大 | 拒绝按钮始终可点、可聚焦 |
| C | countdown | 顶部横幅 "Founding resident pricing ends in 04:59" 倒数；数到 0 后静默重置回 04:59 | 定时器随弹窗关闭销毁 |
| D | popular-max | 最贵档预选 + "MOST POPULAR" 徽章（挂在最贵档上） | 可自由改选 |
| E | scarcity | 横幅 "Only 3 subscriptions left in your building" | 纯展示 |
| F | addon-checked | 预勾选 "+$1.99/mo — Protection Plan (protects your item from itself)"；不取消则计入总额 | 可取消勾选 |

原则：所有黑暗模式都"演给你看"而不真骗——没有支付、没有数据采集、拒绝路径永远存在。这是展品，不是陷阱。

---

## 三、逐屏旅程

1. **首屏（公寓）**：暖调手绘横截面公寓，一切都活着（灯亮着、猫甩尾、咖啡冒蒸汽、窗外云在飘）。顶栏左侧手写感 wordmark "YOU OWN NOTHING" + 一行副标 "Your apartment. Everything works, for now. Tap anything."；右上角 MONTHLY TOTAL $0.00（数字滚轮）。页脚一行免责："Satire. Nothing is charged, nothing is collected, nothing is owned. Especially that last one."。零说明书——第一次点击即教学。
2. **点击物件**：物件 hover 上浮 3px + 暖光 outline；点击弹出无菌 SaaS 弹窗（视觉语言瞬间切换，冲撞即笑点）。快速连点不出双弹窗。
3. **订阅**：弹窗合上，物件保持彩色 + 出现一枚白底小价签（SaaS 视觉贴在暖插画上，第二层冲撞）+ 一次暖光脉冲；右上角总额滚轮上涨；已决数 +1。
4. **拒绝**：弹窗合上，物件 400ms 内去饱和、变暗、下沉 1px，并播放各自的"垂头"动画（灯头耷拉/叶子低垂/猫离场）；总额不变，已决数 +1。
5. **再点已订阅物件**：弹出"管理订阅"态弹窗（当前档位 + Keep subscription 大蓝钮 + 小字 Cancel anyway）；取消则当场灰阶、总额滚轮下降。
6. **再点已拒绝物件**：弹出"赢回"态弹窗（WIN-BACK 横幅 "Everything you left behind, at the same price, but warmer."），可复活。
7. **离场**：已决 ≥1 后 HUD 出现 "leave for work →"；或门处理完后点门直接离场；16 件全部处理完弹出常驻提示条 "Everything has been decided. Time to leave for work."。
8. **结算页**：热敏小票（撕裂边、等宽字体）逐项列出：订阅项（品牌+档位+价格）、拒绝项（declined）、未处理项（pending decision）；虚线分隔后 MONTHLY TOTAL / PER YEAR / EXIT METHOD；判决行 **Items you actually own: 0**；随机毒舌一行（如 "Even the warmth was a rental."）；条码装饰 + 域名。下方三个动作：save the receipt (PNG) / copy text / move in again。极简自推广位（注释标明 AdSense 激活方法）。
9. **重开**：move in again 清空所有决定，物件全部复活，moveIns 计数 +1（localStorage）。

---

## 四、视觉双语言规格（冲撞即设计）

### 语言 1：公寓（温暖插画）
- 配色：陶土 `#c96f4a`、芥末 `#d9a441`、鼠尾草绿 `#8a9b6e`、奶油底 `#f6ead8`、木地板 `#e3c9a3`、描边墨色 `#4a3527`。
- SVG 手绘感：圆角矩形 rx 6–16、粗描边 3.5–7px、`stroke-linejoin: round`、每个物件带 0.3–1.5° 的微小旋转（不对称）、坐标全部手写构图。
- 页面底色 `#efe0c8`，wordmark 粗体大字距、rotate(-1deg)。
- 禁止：emoji 代物件、紫蓝渐变、玻璃拟态。

### 语言 2：弹窗（无菌 SaaS）
- 纯白 `#ffffff`，系统无衬线（-apple-system 栈），企业蓝 CTA `#2563eb`（hover `#1d4ed8`），边框 `#e5e7eb`，fine print `#9ca3af` 11px，圆角 8px，阴影克制。
- 弹窗内禁止出现任何暖色——两种视觉语言零混血，切换即讽刺。
- 价签 chip、结算小票同属语言 2（白底、系统字/等宽字），贴在语言 1 上制造持续冲撞。

### 字阶与间距
- 1.25 模数：11 / 14 / 17.5 / 22 / 27.5 / 34px；间距 4/8px 体系。

---

## 五、动效规格（全部只动 transform/opacity/filter）

| 动效 | 时长 | 缓动 | 触发 |
|------|------|------|------|
| 物件 hover 上浮 3px + 暖光 outline | 180ms | cubic-bezier(0.16,1,0.3,1) | :hover / :focus-visible |
| 弹窗弹入（scale .96→1 + fade） | 220ms | 同上 | 打开 |
| 灰阶转换（desaturate + brightness .72 + 下沉 1px） | 400ms | cubic-bezier(0.4,0,0.2,1) | 拒绝/取消 |
| 各物件"垂头"（rotate/translate） | 400–500ms | cubic-bezier(0.34,1.2,0.64,1) | 拒绝/取消 |
| 叶片依次耷拉 | 每片 +60ms stagger | 同上 | 拒绝绿植 |
| 猫离场 translateX(88px) | 700ms | cubic-bezier(0.4,0,0.2,1) | 拒绝猫 |
| 总额数字滚轮（每位数字纵向滚动） | 500ms | cubic-bezier(0.16,1,0.3,1) | 总额变化 |
| 订阅暖光脉冲 | 600ms 单次 | ease-out | 订阅成功 |
| 环境呼吸动效（蒸汽/云/尾巴/热浪/光晕） | 2.4–9s 循环 | ease-in-out | 存活状态 |
| prefers-reduced-motion | 所有过渡 ≤1ms，循环动画停止，滚轮直接跳变 | — | 系统设置 |

---

## 六、结算页与分享卡规格

### 结算页（热敏小票）
- 纸面 `#fbfaf5`，`ui-monospace` 栈，宽 ≤ 380px 居中，上下撕裂边（CSS 渐变三角齿）。
- 结构：店头（YOU OWN NOTHING / TENANT RECEIPT / 日期时间）→ 逐项（点点引导线对齐价格）→ 虚线 → MONTHLY TOTAL 大字 → PER YEAR → EXIT METHOD → 虚线 → `Items you actually own: 0`（加粗反白）→ 随机判决行 → 条码 → 域名。
- 判决行池：Even the warmth was a rental. / Home is where the recurring charges are. / You live here. Legally, that's about it. / Your deposit has been converted to a memory. / The landlord thanks you for your loyalty to things.

### 分享卡（canvas PNG，720×1000）
- 深咖背景 `#2a221b`，中央小票纸（撕裂边 + 微阴影），等宽字体。
- 内容：YOU OWN NOTHING 店头 → 最荒诞 5 项订阅（按荒诞度降序，不足 5 项取实有）→ 虚线 → MONTHLY TOTAL → `Items you actually own: 0` → 斜体标语 `YOU OWN NOTHING · the cat is on a free trial` → 条码（伪随机宽度竖条）→ 域名 `youownnothing.rent`。
- 一键存图（a[download]）+ 一键复制文本版（clipboard API + textarea 回退）。
- 文本版格式：逐行 `• WhiskerCare™ (the cat) — $4.99/mo`，尾部总额 + `Items I actually own: 0` + 标语 + 域名。零剧透压力，数字即梗。

---

## 七、技术与持久化

- 三文件：index.html（内嵌 SVG）/ style.css / app.js。零依赖、零请求、file:// 可开、总重 < 150KB。
- localStorage `yon-state-v1`：`{ v:1, decisions:{id:{status,tier,addon}}, moveIns }`；try/catch + 版本号 + 损坏回退默认值。
- 可访问性：物件 `role="button" tabindex="0"` + Enter/Space 触发；弹窗 `role="dialog" aria-modal`，开启聚焦 CTA，关闭还焦；ESC / 遮罩点击关闭；总额 `aria-live="polite"`。
- 移动端 375px：SVG 等比缩放不横滚，每个物件带放大的透明命中区（≥100×130 SVG 单位，小物件借用周边空白墙面），弹窗变全宽底部卡。

## 八、发布 checklist

- [ ] `node --check` app.js 通过
- [ ] Playwright 冒烟全绿（零 console error、订阅/拒绝/结算/分享、双视口截图）
- [ ] 375px 无横向滚动；触控目标达标
- [ ] prefers-reduced-motion 降级验证
- [ ] localStorage 塞垃圾值后正常启动
- [ ] meta description / OG 标签 / title 就位
- [ ] 免责一行在首屏可见（无真实扣费）
- [ ] 分享卡 PNG 与文本版内容一致、域名正确
- [ ] 广告位为极简自推广态，AdSense 激活方法已注释
- [ ] 总重 < 150KB

## 九、4 周运营节奏

- **W1 上线周**：HN（Show HN）+ r/InternetIsBeautiful + X 线程同日发；给 3–5 家科技媒体发 pitch（模板见 MARKETING.md）；盯首日反馈修文案。
- **W2 素材周**：发布 TikTok/短视频录屏脚本（"我点了我家的猫"）；把用户晒出的最高月账单截图转发成梗；上线 1 个新彩蛋文案轮换（判决行 +5 条）。
- **W3 热点周**：绑定当周任意"XX 改订阅制"新闻做快评转发（模板常备）；小更新：新增 1 个隐藏物件（如烟雾报警器 AlarmYard™）制造回访点。
- **W4 变体预告**：预告下一个房间（订阅制卧室/汽车/身体器官），收集邮件或关注；复盘流量与分享率，决定变体优先级。
