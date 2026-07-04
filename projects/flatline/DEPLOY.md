# Flatline 部署指南

产物就是 `index.html` / `style.css` / `app.js` 三个文件（加可选 `og.png`），纯静态、零构建、
零后端。任何静态托管都行，以下三选一，推荐 Cloudflare Pages。

## 部署前准备（一次性）

1. 生成 `og.png`：进一局游戏 → 结算屏点"存图"，把导出的 1200×630 PNG 改名为 `og.png`
   放到项目根目录（`index.html` 的 `og:image` 已指向它）。挑一张 CODE BLUE 的图，悬念更强。
2. 如果最终域名不是 `flatline.day`：全局替换 `app.js` 里的 `DOMAIN` 常量、`index.html`
   底部与自推广位里的域名文案。
3. 跑一遍验收：`node projects/flatline/test/smoke.mjs` 必须 ALL GREEN。

## 方案 A：Cloudflare Pages（推荐：免费、全球 CDN、自定义域名最顺）

1. 仓库推到 GitHub（或用 `wrangler` 直传）。
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git。
3. 构建设置：Framework preset 选 **None**；Build command 留空；
   Build output directory 填 `projects/flatline`（若单独建仓则填 `/`）。
4. 部署完成后得到 `*.pages.dev` 域名，先自测一局。
5. 自定义域名：Pages 项目 → Custom domains → 添加 `flatline.day`。
   - 域名 DNS 托管在 Cloudflare：自动加 CNAME，一分钟生效；
   - 托管在别处：按提示加 `CNAME flatline.day → <项目>.pages.dev`（根域用 CNAME
     flattening 或 ALIAS）。HTTPS 证书自动签发。

## 方案 B：Vercel

1. `npm i -g vercel`，在 `projects/flatline/` 目录里执行 `vercel`。
2. Framework 选 **Other**，Build Command 留空，Output Directory 填 `.`。
3. `vercel --prod` 上生产；Dashboard → Settings → Domains 绑定 `flatline.day`，
   按提示配 A 记录（76.76.21.21）或 CNAME（cname.vercel-dns.com）。

## 方案 C：GitHub Pages

1. 单独建仓（如 `flatline`），把三个文件放仓库根目录。
2. Settings → Pages → Source 选 `main` 分支 `/ (root)`。
3. 自定义域名：Pages 设置里填 `flatline.day`，仓库会生成 `CNAME` 文件；
   DNS 加 `CNAME www → <user>.github.io`，根域加 4 条 A 记录
   （185.199.108/109/110/111.153）。勾选 Enforce HTTPS。

## 缓存建议

- `index.html`：`Cache-Control: public, max-age=0, must-revalidate` ——
  题目按本地日期换、逻辑常更新，HTML 必须即时回源。
- `style.css` / `app.js`：`public, max-age=3600`。**不要设超长缓存**，
  当前 HTML 未带指纹文件名；日后要上 `max-age=31536000, immutable`，
  必须同时把引用改成 `app.v2.js` 这类带版本文件名。
- `og.png`：`public, max-age=86400`。
- Cloudflare Pages / Vercel 的默认头已接近上述策略，一般不用动；
  GitHub Pages 固定 `max-age=600`，可接受。
- 游戏零运行时请求（无 API、无字体、无图片），CDN 费用为 0；
  唯一的重复流量是 HTML 回源校验，可忽略。

## 上线后自检清单

- [ ] 手机实机（iOS Safari + Android Chrome）各打一局：触控、声音开关、复制、存图
- [ ] `https://` 与 `https://www.`（如启用）都能开
- [ ] 用 X/Telegram 的卡片调试器验证 OG 图
- [ ] 跨时区抽查：改设备时区，确认期号随本地日期变化
- [ ] Lighthouse 移动端 Performance ≥ 95（本页无外部资源，达不到就是回归）
