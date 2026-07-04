# You Own Nothing — 产品描述

## 一句话

一间温暖的手绘公寓，里面的每一样东西——台灯、沙发、窗外的风景、室内的空气、你的猫——都是月付订阅。逛完结账，小票上写着：Items you actually own: 0。

## 这是什么

一个 Neal.fun 式的单页讽刺玩具。打开是一间活着的插画公寓：灯亮着，咖啡冒着蒸汽，猫在地毯上甩尾巴，窗外云在飘。点击任何物件，会弹出一个以假乱真的 SaaS 订阅弹窗——独立品牌、三档定价、fine print、随机一种黑暗模式（预选年付、灰色小字的拒绝按钮 "let it rot"、永远重置的假倒计时、预勾选的 Protection Plan）。

订阅，物件继续活着，右上角的月费总额用数字滚轮往上跳；拒绝，它在 400 毫秒内褪成灰阶并垂下头——台灯熄灭低头，植物一片一片耷拉叶子，猫起身走出画面一格。十六件东西全部处理完，或者推开前门（门也要订阅，ThresholdPlus™，$12.99/mo 每天三次出门额度）去上班，你会得到一张热敏小票：逐项清单、MONTHLY TOTAL、出门方式，以及那句判决——**Items you actually own: 0**。

小票可以存成 PNG 分享卡（撕裂边、等宽字体、条码、"the cat is on a free trial"），也可以一键复制文本版。然后你可以 move in again，再来一遍。

没有真实支付，没有账号，没有数据采集。所有黑暗模式都是展品而不是陷阱——这是关于订阅经济的一面镜子，不是它的又一个实例。

## 为什么它有效

每个人都被订阅套路过。看到一盏台灯标价 $2.99/月的第一反应是笑，第二反应是想起自己上个月的账单。情绪弧线：温馨 → 荒诞 → 顿悟。传播点足够密：猫 $4.99/月（"Purring included in Premium only"）、空气 $5.99/月（"78% nitrogen, as is"）、门 $29.99/月的 Priority hinge。数字本身就是梗，看的人会想自己点一遍。

## 技术形态

- 纯静态三文件：index.html / style.css / app.js，零依赖、零请求，file:// 直接可开
- 手写坐标的内嵌 SVG 插画（16 个可点物件 + 环境动效）
- 总重约 85KB，任何静态托管免费档都能扛住爆发流量
- localStorage 持久化（损坏容忍），prefers-reduced-motion 降级，键盘可完整操作

## English blurb

**You Own Nothing** is a single-page satire toy: a cozy hand-drawn apartment where every object — the lamp, the sofa, the view out the window, the indoor air, the cat — runs on a monthly subscription. Tap anything and a suspiciously convincing SaaS paywall appears, complete with three tiers, fine print, and one randomly assigned dark pattern. Subscribe and the thing stays alive; decline and it fades to gray and slumps. When you leave for work (the front door is $12.99/mo), you get a thermal receipt: MONTHLY TOTAL, itemized, and the verdict — *Items you actually own: 0*. No real payments, no accounts, no tracking. The cat is on a free trial. She does not know this.
