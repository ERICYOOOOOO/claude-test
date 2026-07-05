# 全栈部署详解 · 总索引

本目录下 10 个小项目各有一份**从 0 开始、可逐条照抄**的全栈部署详解 `DEPLOY-FULL.md`
（与各项目原有的精简版 `DEPLOY.md` 并存，互不覆盖）。每份都覆盖同一条完整链路：

> 装 Node/Git、注册账号 → 本地跑通 → 上线前逐处改域名 → 部署 → 自定义域名/DNS/HTTPS
> → 缓存 → SEO → 变现 → 上线后自检 → 持续运维 → 故障排查

所有需要新建的配置文件（Dockerfile、fly.toml、`_headers`、vercel.json、netlify.toml、
GitHub Actions workflow、systemd unit、Nginx server 块、ads.txt、最小 package.json 等）
在对应指南里都给了**完整文件内容 + 确切放置路径**，不是片段。

## 按架构分类

三行看懂：这 10 个项目其实只有 4 种部署形态，先认形态，再翻对应指南。

| 形态 | 项目 | 部署一句话 |
|---|---|---|
| **纯静态**（零构建、零后端） | [flatline](./flatline/DEPLOY-FULL.md) · [the-law](./the-law/DEPLOY-FULL.md) · [daily-law](./daily-law/DEPLOY-FULL.md) · [daily-person](./daily-person/DEPLOY-FULL.md) · [overlap](./overlap/DEPLOY-FULL.md) · [you-own-nothing](./you-own-nothing/DEPLOY-FULL.md) | 目录直接丢 Cloudflare Pages / Vercel / GitHub Pages，托管成本≈0 |
| **静态 + 构建**（SEO 长尾页生成器） | [at-your-age](./at-your-age/DEPLOY-FULL.md) · [word-age](./word-age/DEPLOY-FULL.md) | 先 `node build.js` 生成上百个静态页 + sitemap，再托管；用 GitHub Actions 把构建自动化 |
| **静态 + 小游戏双端** | [body-clock](./body-clock/DEPLOY-FULL.md) | H5 走静态托管；另有微信/抖音小游戏从 appid 到审核的完整流程 |
| **真·全栈后端** | [the-last-sentence](./the-last-sentence/DEPLOY-FULL.md) | Node 后端（SSE + JSONL 持久化），**只能单实例**；上 Fly.io / Railway / 自建 VPS |

## 逐项速查表

| 项目 | 形态 | 默认域名 | 主推托管 | 上线前必改的关键常量 | 特殊注意 |
|---|---|---|---|---|---|
| [flatline](./flatline/DEPLOY-FULL.md) | 纯静态·每日 | `flatline.day` | Cloudflare Pages | `app.js` 的 `DOMAIN` | 需先玩一局导出 `og.png`（1200×630） |
| [the-law](./the-law/DEPLOY-FULL.md) | 纯静态·每日 | 见 `app.js`（必改） | Cloudflare Pages | `app.js` 顶部站点常量 + `index.html` 的 og/canonical | 归纳推理，纯前端规则引擎 |
| [daily-law](./daily-law/DEPLOY-FULL.md) | 纯静态·每日 | `meiriyifa.app` | Cloudflare Pages | `app.js` 的 `DOMAIN` | 中文，`laws.js` 内嵌数据 |
| [daily-person](./daily-person/DEPLOY-FULL.md) | 纯静态·每日 | `meiri-yiren.pages.dev`（占位符，**必换**） | Cloudflare Pages | `app.js` 的 `SITE_URL`（出现在分享卡） | 占位域名不换会印到分享卡上 |
| [overlap](./overlap/DEPLOY-FULL.md) | 纯静态·工具 | `overlap.love` | Cloudflare Pages | `index.html` 的 og/canonical + `app.js` 内域名 | 需提供 `og-card.png` |
| [you-own-nothing](./you-own-nothing/DEPLOY-FULL.md) | 纯静态·玩具 | `youownnothing.rent` | Cloudflare Pages | `app.js` 的 `DOMAIN` | 讽刺玩具，媒体友好 |
| [at-your-age](./at-your-age/DEPLOY-FULL.md) | 静态+构建·SEO | `atyourage.fyi` | Cloudflare Pages + `node build.js` | `data.js` 的 `AYA_DOMAIN`（改后**重跑 build.js**） | 构建期生成人物长尾页 + sitemap；AdSense/联盟变现 |
| [word-age](./word-age/DEPLOY-FULL.md) | 静态+构建·SEO | `wordage.fyi` | Cloudflare Pages + `node build.js` | `build.js` 的 `SITE_ORIGIN` / `index.html` 的 `data-site`（改后**重跑 build.js**） | 500 词长尾页；主页 <150KB 红线；AdSense/CPA 联盟 |
| [body-clock](./body-clock/DEPLOY-FULL.md) | 静态+小游戏 | `bodyclock.fun` | H5：静态托管；小游戏：微信/抖音 | `app.js` 的 `DOMAIN`；`game.js` 的 `AD_UNIT_*`；`project.config.json` 的 appid | 改 `shared/core.js` 后必须 `cp` 到 `wechat-minigame/` 并跑 `node test/core.mjs`；国内需备案+HTTPS |
| [the-last-sentence](./the-last-sentence/DEPLOY-FULL.md) | 全栈后端 | `thelastsentence.example`（兜底，**必换**） | Fly.io（备选 Railway / 自建 VPS） | `app.js` 的 `SITE_URL` 兜底；环境变量 `TRUST_PROXY`/`HISTORY_FILE` 等 | **只能单实例**；反代必须 `TRUST_PROXY=1` 且关 SSE 缓冲；`history.jsonl` 上持久卷 + 每日备份 |

## 跨项目共通要点（所有指南都遵守）

- **缓存**：`index.html` 用 `no-cache, must-revalidate`（每日题/逻辑常更新要即时回源）；
  `*.css` / `*.js` 用 `max-age=3600`（**未做文件名指纹，切勿设超长缓存**，除非把引用改成
  `app.v2.js` 这类带版本名）；图片/OG 用 `max-age=86400`。各平台的 `_headers` / `vercel.json`
  / Nginx 写法在每份指南第 6 节都有完整文件。
- **DNS 真实值**（各指南第 5 节复用）：GitHub Pages 根域 4 条 A 记录
  `185.199.108/109/110/111.153`、`www` 用 CNAME `<user>.github.io`；Vercel 用 A
  `76.76.21.21` 或 CNAME `cname.vercel-dns.com`；Cloudflare Pages 自动加 CNAME。
- **monorepo 子目录部署**：连 Git 时把 Output/Root directory 指到 `projects/<slug>`；
  或把单个项目目录抽成独立仓库（两种路径每份指南都写了）。
- **本地自验**：每个项目 `test/` 下都有 Playwright 冒烟测试；本仓库环境的 Chromium 在
  `/opt/pw-browsers/chromium`，一般机器用 `npx playwright install chromium`。

## 建议部署顺序

按"上线摩擦从低到高"推进，先用便宜的每日游戏跑通一遍 Cloudflare Pages 流程，最后再啃后端：

1. 先上一个纯静态每日游戏（如 flatline / daily-law）——15 分钟走通 Pages + 域名 + 缓存全链路。
2. 再上两个 SEO 工具（at-your-age / word-age）——多一步 `node build.js` 与 sitemap 提交。
3. body-clock 先上 H5，再按需提审小游戏。
4. 最后上 the-last-sentence 后端（需绑卡、持久卷、单实例、备份，摩擦最高）。
