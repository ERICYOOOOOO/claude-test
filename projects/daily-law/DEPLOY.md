# 每日一法 · 部署指南

纯静态站点，四个文件即全部产品：`index.html`、`style.css`、`app.js`、`laws.js`。无构建步骤、无环境变量、无后端。

## 一、部署

任选一个静态托管，把项目目录（不含 `test/`、`*.md`）上传即可：

### Cloudflare Pages（推荐，国内可达性较好）
1. 仓库根目录 → Pages → Create project → 直接上传或连 Git。
2. Build command 留空，Output directory 填本目录。
3. 绑定域名（如 `meiriyifa.app`），开启 HTTPS（默认）。

### GitHub Pages
```bash
# 仓库 Settings → Pages → Deploy from branch，选择包含本目录的分支/路径
```

### Vercel / Netlify
拖拽目录上传即可，零配置。

### 自有服务器（nginx）
```nginx
server {
  listen 443 ssl;
  server_name meiriyifa.app;
  root /var/www/daily-law;
  gzip on;
  gzip_types text/css application/javascript text/html;
  add_header Cache-Control "public, max-age=3600";
}
```
`laws.js` 更新频率低，可对 js/css 设更长缓存并在引用处加版本参数（如 `app.js?v=2`）。

## 二、上线前替换项

- 域名三处保持一致：`app.js` 顶部 `DOMAIN` 常量（分享卡与复制文本的回流位）、`index.html` 的 og 标签、页脚 colophon。
- 如需统计，建议自托管 Plausible/Umami 一行脚本；不要引入重型分析 SDK（破坏零依赖与页面重量红线）。

## 三、上线后验证

```bash
# 仓库根运行（本地 file:// 版）
node projects/daily-law/test/data.mjs
node projects/daily-law/test/smoke.mjs
```
线上再手动过一遍：七轨切换、昨日回看、收藏刷新、复制、存图、375px 视口。

## 四、变现挂点激活（AdSense）

页面已预留一个不破坏美学的广告位：`index.html` 中 `<aside class="promo" id="promo">`（收藏夹面板与页脚之间），默认渲染为极简自推广位。

激活步骤：
1. AdSense 后台添加站点并通过审核（内容为公有领域法条 + 原创手记，注意保留页脚免责声明，有助于审核）。
2. 用官方代码替换 `promo` 块内容：
```html
<aside class="promo">
  <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXX"
       data-ad-slot="YYYY" data-ad-format="auto"></ins>
</aside>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX" crossorigin="anonymous"></script>
<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
```
3. 保持 `max-width` 与纸白配色容器不变；只此一个广告位，不加浮层、不加插屏。
4. 联盟备选：公考/法考课程联盟链接可替换自推广位文案（见 MARKETING.md 的克制挂法），与 AdSense 二选一，不叠加。

## 五、SEO

- 已内置：语义化标题层级、`meta description`、OG 标签、`aria` 语义。
- 可选增强：为每条法条生成长尾静态页（`/law/民法典-1010.html` 之类）需要一个构建脚本，属后续迭代；当前单页先以「每日一法」「法条日历」「XX条全文」等词做站内文案覆盖。
- 提交 Google Search Console 与 Bing Webmaster；国内可提交百度站长平台。
