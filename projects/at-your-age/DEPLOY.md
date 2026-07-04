# At Your Age — 部署指南

纯静态站：一个目录、零后端、零构建依赖（只需 node 跑一次 `build.js`）。托管成本为零。

## 0. 部署前

```bash
cd projects/at-your-age
node build.js                 # 生成 people/*.html, sitemap.xml, robots.txt
node test/data.mjs            # 数据 + 产物校验
node ../../projects/at-your-age/test/smoke.mjs   # 或从仓库根: node projects/at-your-age/test/smoke.mjs
```

**换正式域名**（当前占位 `atyourage.fyi`）：
1. `data.js` → `AYA_DOMAIN`（分享文本/卡面域名）
2. `build.js` → `BASE_URL` 由 DOMAIN 派生，无需另改
3. `index.html` → `og:url` 与 `canonical` 两处
4. 重跑 `node build.js`（sitemap/canonical 全部随之更新）+ 两个测试

需要上传的文件：`index.html style.css app.js data.js people/ sitemap.xml robots.txt`（`*.md`、`test/`、`build.js` 可不传，传了也无害）。

## 1. Cloudflare Pages（推荐，免费额度慷慨）

```bash
npx wrangler pages deploy projects/at-your-age --project-name=at-your-age
```
或 Dashboard → Pages → Upload assets 直接拖目录。
- Build command 留空（或 `node build.js`，Build output = `/`）。
- 自定义域：Pages → Custom domains → 加域名，按提示改 DNS。

## 2. Vercel

```bash
cd projects/at-your-age && npx vercel --prod
```
- Framework Preset: **Other**；Build Command: `node build.js`；Output Directory: `.`

## 3. GitHub Pages

- 仓库 Settings → Pages → Deploy from branch，把本目录内容放到 `gh-pages` 分支根（或用 Actions 里 `actions/upload-pages-artifact`）。
- 注意：项目页会带路径前缀（`user.github.io/repo/`），人物页相对链接不受影响；canonical 需与最终 URL 一致，建议绑自定义域。

## 4. 任意静态空间 / 自建 nginx

整个目录 `rsync` 上去即可。可选 nginx 优化：

```nginx
gzip on; gzip_types text/html text/css application/javascript application/xml;
location ~* \.(css|js)$ { expires 7d; }
```

## 5. 上线后

1. Google Search Console + Bing Webmaster：验证域名，提交 `https://<domain>/sitemap.xml`。
2. 真机验证：https 环境下 Copy text（clipboard 权限）与 Save card（下载）各一次。
3. OG 预览：把首页链接发进 X/Telegram/Slack 看卡片渲染。
4. 更新数据后：`node build.js && node test/data.mjs` 再上传（sitemap `lastmod` 自动刷新）。

## 常见问题

- **file:// 下 Copy 按钮显示 "Select & copy"**：本地协议无 clipboard 权限，属预期；https 正常。
- **分享卡字体在不同系统略有差异**：卡用系统字体栈（零外部字体是硬约束），Mac/iOS 出 SF、Windows 出 Segoe，均在设计容差内。
- **想回滚数据**：`data.js` 是唯一数据源，git 里一行一条，revert 后重跑 build 即可。
