# 体内时钟 — 部署指南

## 一、H5 版（主体）

纯静态、零依赖、零后端。`index.html` + `style.css` + `app.js` + `shared/core.js` 四个文件，file:// 直接可开。

1. 把 `projects/body-clock/`（去掉 `test/` 与 `wechat-minigame/` 亦可）传到任意静态托管：GitHub Pages、Cloudflare Pages、阿里云 OSS + CDN 皆可。
2. 改 `app.js` 顶部 `DOMAIN = 'bodyclock.fun'` 为真实域名（分享卡回流位）。
3. 国内传播建议备案域名 + HTTPS（微信内置浏览器对非 HTTPS 页面有拦截提示）。
4. 广告：`index.html` 结算屏的 `<aside class="ad-slot">` 默认是自推广位；接 AdSense 时替换该块为广告代码（建议 300×100，勿加动画）。激励视频占位在 `app.js` 的 `showRewardedAd`，注释里写了三个平台的接法。

发布前自检：

```bash
node projects/body-clock/test/core.mjs    # 40 项全绿
node projects/body-clock/test/smoke.mjs   # 48 项全绿
```

## 二、微信小游戏

### 1. appid 申请
1. [mp.weixin.qq.com](https://mp.weixin.qq.com) 注册 **小程序** 账号（个人或企业主体均可发小游戏；企业主体才能开流量主广告）。
2. 注册时服务类目选 **游戏 → 休闲游戏**。本作无版号要求口径：按平台现行规则，休闲益智类小游戏以"游戏"类目提审需要版号；**个人主体常见做法是走"小程序—工具/生活服务"边缘类目的产品不适用于本作**，正规路径是等休闲游戏备案通道或以企业主体申请版号/备案。提审前务必在"社区—公告"确认当期政策，规则常变，以平台当日口径为准。
3. 「开发 → 开发管理 → 开发设置」拿到 appid。

### 2. 开发者工具导入
1. 下载微信开发者工具（稳定版）。
2. 同步核心逻辑副本（每次改 `shared/core.js` 后必做）：
   ```bash
   cd projects/body-clock
   cp shared/core.js wechat-minigame/shared/core.js
   node test/core.mjs   # 第 7 组用例校验两份文件逐字节一致
   ```
3. 开发者工具 →「导入项目」→ 目录选 `projects/body-clock/wechat-minigame/`，填 appid（没有就用测试号 touristappid，`project.config.json` 已预填）。
4. 编译即可在模拟器跑通：按住 → 松开 → 误差/称号 → 结算。**真机预览必测**：震动手感、iOS 高刷屏计时、切后台回前台跨天。

### 3. 广告与分享
- 流量主：注册用户数达到平台门槛后，「流量主」模块开通 → 创建两个**激励式视频广告位**，把 adUnitId 填入 `game.js` 顶部 `AD_UNIT_RETRY` / `AD_UNIT_DISTORTION`。
- 所有 `wx.` 调用都封装在 `adapter.js`：`createRewardedVideo`（onClose 的 `res.isEnded` 才发奖）、`shareAppMessage`、`vibrateShort({type:'light'})`、`getStorageSync/setStorageSync`。game.js 不直接碰 `wx.`。

## 三、抖音（字节）小游戏差异

同一份 `wechat-minigame/` 代码可直接提审抖音：`adapter.js` 自动探测全局对象（`wx` → 微信，`tt` → 抖音）。在[字节开放平台](https://developer.open-douyin.com)创建小游戏，用「抖音开发者工具」导入同一目录。

### tt. API 对照表

| 能力 | 微信 | 抖音 | 差异 |
|---|---|---|---|
| 画布 | `wx.createCanvas` | `tt.createCanvas` | 一致 |
| 系统信息 | `wx.getSystemInfoSync` | `tt.getSystemInfoSync` | 一致 |
| 触摸 | `wx.onTouchStart/End` | `tt.onTouchStart/End` | 一致 |
| 震动 | `wx.vibrateShort({type})` | `tt.vibrateShort()` | 抖音不支持 `type` 参数（传入被忽略，无副作用） |
| 存储 | `wx.getStorageSync` | `tt.getStorageSync` | 一致 |
| 激励视频 | `wx.createRewardedVideoAd` | `tt.createRewardedVideoAd` | 一致；adUnitId 在字节「流量变现」后台创建 |
| 主动分享 | `wx.shareAppMessage` | `tt.shareAppMessage` | 抖音多 `channel` 参数：`'video'` 可拉起**录屏发布抖音视频**——本作核心传播能力，建议接 `tt.getGameRecorderManager` 录"按住→揭晓"10 秒片段 |
| 被动分享 | `wx.onShareAppMessage` | `tt.onShareAppMessage` | 一致 |
| 群能力 | `wx.getGroupCloudStorage` | 无对应 | 好友 PK 榜路线图仅微信侧做 |

### 抖音侧建议
- 优先接录屏分享（`tt.getGameRecorderManager`）：干扰模式 + 翻车瞬间是天然短视频素材。
- 侧边栏复访（`tt.checkScene`）有流量扶持，接入成本低。

## 四、审核注意事项（两端通用）

- **类目与版号**：休闲品类按平台现行规则自查。微信/抖音对无版号小游戏均有阶段性备案政策，提审前查当期公告；先上 H5 版收集数据不受此限。
- **诱导分享**：分享按钮文案不得出现"分享后获得××"。本作分享无奖励，合规。
- **激励视频**：发奖必须以 `res.isEnded === true` 为准（adapter 已实现）；不得"关闭广告也发奖"。
- **隐私**：仅本地存储、无账号体系、无个人信息收集——隐私声明勾选最小集即可。
- **防沉迷**：小游戏接平台实名/防沉迷由容器托管，无需自研，但企业主体提审时需勾选适龄声明。
- **文案**："全球同题"在审核语境下建议写"每日同题"，避免境外服务联想。

## 五、发布后回归清单

- 跨午夜换题（真机放到 23:59 等一分钟）。
- iOS 微信内 H5 的 `navigator.vibrate` 不可用 → 应静默无报错（已 try/catch）。
- localStorage 被清后连胜按回溯规则重算，不会 NaN。
- 激励视频无填充时（onError）按钮不应卡死（adapter 的 onFail 分支）。
