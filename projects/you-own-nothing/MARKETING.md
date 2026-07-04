# You Own Nothing — 营销手册

定位：五件套的**名气引擎**。它不直接赚钱，它负责被截图、被转发、被媒体写，然后把流量导给作者品牌和另外四个产品。所有宣发都围绕一个可复述的事实展开：**"这个网站上，连猫都要 $4.99 一个月。"**

---

## 一、媒体 pitch 邮件模板（The Verge / Fast Company 调性）

> **Subject: I made a website where you have to subscribe to your own cat**
>
> Hi [name],
>
> I built a small satire site called You Own Nothing — a cozy illustrated apartment where every single object runs on a monthly subscription. The lamp is $2.99/mo (LumenCloud™). The view out the window is ViewPass™. The indoor air is AirPure™, $5.99/mo, "78% nitrogen, as is." The cat is WhiskerCare™ — purring is a Premium feature.
>
> Every paywall carries one real dark pattern from the SaaS playbook (pre-selected annual billing, the gray "let it rot" decline button, a countdown that quietly resets). Decline anything and it fades to gray and slumps. When you leave for work — the front door is $12.99/mo — you get a thermal receipt: MONTHLY TOTAL, and the line "Items you actually own: 0."
>
> It's free, no payments, no accounts, no tracking. One page, loads in under 100KB. Link: https://youownnothing.rent
>
> Happy to share how each dark pattern was reconstructed, or which real subscription news inspired which object.
>
> [signature]

发送节奏：上线日发 3–5 家（The Verge、Fast Company、TechCrunch weekend、Ars、404 Media），HN 冲上首页后立刻补一轮"it's currently #1 on Hacker News"跟进邮件。

## 二、Hacker News 帖草稿

> **Show HN: You Own Nothing – an apartment where everything is a subscription**
>
> I made a one-page satire toy: a hand-drawn apartment where all 16 objects are SaaS products. Each paywall ships with one randomly assigned dark pattern (pre-selected annual, shame-decline, fake countdown, pre-checked add-on). Decline anything and it desaturates and droops. Checkout prints a thermal receipt ending in "Items you actually own: 0."
>
> Technical notes: pure static, zero dependencies, ~85KB total, works from file://. The SVG is hand-coordinated, no icon libraries. The dark patterns are exhibits, not traps — decline always works, nothing is charged, nothing is collected.
>
> The cat is on a free trial. She does not know this.

评论区预备答案：为什么没有付款入口（“讽刺产品收钱会杀死讽刺”）、SVG 手写的工作流、每个黑暗模式对应的真实案例来源。

## 三、X（Twitter）线程脚本

1. 我做了个网站，里面你家的一切都要订阅。台灯 $2.99/月。空气 $5.99/月。猫 $4.99/月。[公寓全景图]
2. 每个弹窗都带一个真实存在的黑暗模式。这是预选年付。这是永远差 4 分 59 秒结束的优惠。这是灰色小字的 "let it rot"。[弹窗截图 x2]
3. 拒绝订阅的东西会当场枯萎。这是我拒绝了 13 样东西之后的家。[灰阶场景截图]
4. 出门上班也要钱。ThresholdPlus™，$12.99/月，每天三次出门额度。
5. 结账小票：MONTHLY TOTAL $260.83。Items you actually own: 0。[小票分享卡]
6. 免费、无支付、无采集。链接在下面。猫在免费试用期，它自己不知道。

## 四、TikTok / 短视频录屏脚本（30–45 秒）

- 0–3s（钩子，对镜头）："我点了我家的猫。它要 $4.99 一个月。"
- 3–10s：录屏点猫 → WhiskerCare™ 弹窗特写，镜头怼在 "Purring included in Premium only. Affection sold separately." 上，念出来。
- 10–20s：快剪连点：空气、窗外风景、暖气。每个价格念出来，语气越来越平静（平静是笑点）。
- 20–28s：点拒绝。台灯低头熄灭、植物一片片耷拉、猫起身走出画面。配一句："拒绝的东西会死。"
- 28–38s：推门上班 → 小票拉出来，镜头停在 "Items you actually own: 0"。
- 38–45s（收尾）："免费的，链接在简介。顺便，出门那扇门，$12.99 一个月。"

变体：第二条视频只做"全部拒绝"路线——一个人在完全灰掉的公寓里，总额 $0.00，标题"我什么都没订阅，所以我什么都没有了"。

## 五、蹭热点模板（常备）

每当有大公司宣布"XX 功能改订阅制"（座椅加热、打印机墨水、App 买断改订阅），当天转发引用：

> [新闻链接]
> we added this to the apartment three weeks ago
> https://youownnothing.rent

保持冷面。永远不解释笑话。

## 六、广告指南

**本品不投广告。** 一个讽刺订阅经济的产品做投放，等于笑话自己先笑场。传播全靠自然分享与媒体报道，预算为零是定位的一部分，也是媒体故事的一部分（"zero marketing budget, the cat did the work"）。

**站内广告位的反讽化处理：**结算页下方保留唯一一个广告位，默认渲染为一行自嘲文案——"this space is intentionally not sold · a rare non-subscription surface"。这行字本身是内容，被截图时是加分项。

若流量爆发后决定激活 AdSense（`index.html` 内 `.ad-slot` 注释已写明方法），必须遵守三条：只此一位、不进首屏、样式沿用小票等宽字体外框。任何弹出式、插页式、贴片式广告都直接摧毁产品可信度，永久禁止。更优先的变现替代：结算页放"支持作者"链接 + 收据 T 恤/贴纸周边（周边图案就是分享卡）。

## 七、导流位

- 分享卡与文本版底部固定域名（已内置）。
- 结算页后续可加一行小字："by [作者名] — I also make [Flatline / The Law / Word Age / At Your Age]"，等其余四件上线后统一加，样式沿用小票字体。

## 八、四周节奏（与 PLAYBOOK 一致的执行版）

- **W1**：周二上午（美东）发 Show HN + r/InternetIsBeautiful + X 线程；媒体 pitch 同日发出；全天盯评论修文案。
- **W2**：发布 TikTok 两条（"点猫"与"全拒绝"）；转发用户晒单，转发语只写一个数字（他们的月总额）。
- **W3**：蹭一次订阅制新闻；上线一个新隐藏物件（烟雾报警器 AlarmYard™）并只在 X 上发一句"we shipped something"。
- **W4**：预告下一个房间（订阅制卧室 / 订阅制身体），收集关注；复盘分享率决定变体优先级。
