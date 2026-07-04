# 每日一人 · 部署指南

纯静态站：`index.html + style.css + app.js + people.js + questions.js` 五个文件即全部产品，
无构建步骤、无环境变量、无后端。任何静态托管都能跑，本地双击 index.html 也能玩。

## 上线前必改的两处代码

1. **域名**：`app.js` 顶部 `SITE_URL = "meiri-yiren.pages.dev"` 改成正式域名
  （出现在分享文本与 PNG 卡底部）；
2. **创刊日**：`app.js` 的 `EPOCH0 = Math.floor(Date.UTC(2026, 6, 4) / 86400000)`
   把 `(2026, 6, 4)` 改为真实上线日（月份从 0 计）。上线后**永远不要再改**，
   否则所有期号错位。

## 方案 A：Cloudflare Pages（推荐，免费）

```bash
# 仓库根目录
npx wrangler pages deploy projects/daily-person --project-name meiri-yiren
```

或在 Dashboard 里 Create Project → 直接上传该目录。自定义域名在
Pages → Custom domains 添加，DNS 托管在 Cloudflare 时自动签证书。

## 方案 B：GitHub Pages

仓库 Settings → Pages → 选分支与 `/projects/daily-person` 目录（或把五个文件放到
独立仓库根目录）。注意 GitHub Pages 有 10 分钟左右的缓存，人物按本地日期切换
与服务器无关，不受影响。

## 方案 C：任意对象存储/静态服务器

五个文件 + `favicon`（已内联 data URI，无需额外文件）拷上去即可。
建议响应头：`Cache-Control: max-age=3600`（HTML）/ `max-age=86400`（js/css，
发版时文件名不变，靠 CDN 刷新）。

## 数据更新流程（每周补人）

1. 在 `people.js` 数组**尾部**追加新人物（不要插入中间，排期表会错位）；
2. `node projects/daily-person/test/data.mjs` —— 必须全绿；
3. `node projects/daily-person/test/smoke.mjs` —— 必须全绿；
4. 重新部署。老玩家的 localStorage 无需迁移（存档只记期号与问题 id）。

## AdSense 激活

`index.html` 里搜 `ad-slot`——揭晓页下方有一个默认渲染为"自推广位"的 aside，
是唯一广告挂点（结束态下方，不打扰游戏中的玩家）：

1. AdSense 后台添加站点并过审（内容站建议先跑两周积累页面）；
2. 把 aside 内部替换为 AdSense 代码，**保留 `class="ad-slot"` 容器**，
   版面即不被破坏；
3. 建议只投一个原生/展示位，尺寸 responsive；拒绝锚定广告与插页——
   与"辞典"审美冲突，伤留存。

## 验证

```bash
node --check projects/daily-person/app.js
node projects/daily-person/test/data.mjs    # 数据一致性
node projects/daily-person/test/smoke.mjs   # Playwright 冒烟（截图在 test/screenshots/）
```

上线后手动检查：正式域名打开 → 问三题 → 猜中 → 复制战绩含正式域名 → 存图正常。
