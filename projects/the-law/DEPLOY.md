# 今日之律 The Law — 部署指南

纯静态三个文件（index.html / style.css / app.js），无构建步骤、无后端、无环境变量。任何能伺服静态文件的地方都能跑，file:// 直接双击也能玩。

## 部署前必改

1. **域名**：全局搜索替换 `thelaw.day` 为你的真实域名，共三处：
   - `app.js` 顶部常量 `SITE_HOST`（分享文本与图卡底部的回流位）
   - `index.html` 自推广位文案与页脚
2. **期号锚点（可选）**：`app.js` 的 `LAUNCH_DAY = 20497` 对应第 1 期 = 2026-02-13。想让上线当天从 № 0001 开始，改成 `Math.floor(Date.UTC(年, 月-1, 日)/86400000)` 的值。注意：改动会同时改变每天选到的规则（种子随日序号走），上线后不要再动。

## 方案 A：Cloudflare Pages（推荐，免费）

```bash
# 目录即产物，直接上传
npx wrangler pages deploy projects/the-law --project-name the-law
```
或在 Dashboard 里 Create project → Direct upload，把三个文件拖进去。绑定自定义域名后自动 HTTPS。

## 方案 B：GitHub Pages

```bash
# 假设文件在仓库根或 /docs
# Settings → Pages → Deploy from a branch → 选分支与目录
```
无需 workflow；静态文件即成品。

## 方案 C：Netlify / Vercel / 任意静态托管

拖拽上传目录即可。无需重定向规则、无需函数。

## 方案 D：自有服务器（nginx）

```nginx
server {
  listen 443 ssl;
  server_name thelaw.day;
  root /var/www/the-law;
  location / { try_files $uri $uri/ =404; }
  # 建议：静态资源缓存 1 小时（谜题按客户端本地日期出题，与服务器无关）
  location ~ \.(css|js)$ { add_header Cache-Control "public, max-age=3600"; }
}
```

## 部署后验证清单

- [ ] 打开首页：卷宗抬头显示今天日期与期号，法则行是涂黑条
- [ ] 提交 2 · 4 · 6：<100ms 内出现盖章记录
- [ ] 手机 375px 宽：无横向滚动，按钮可点
- [ ] 断网刷新（PWA 之外的朴素验证）：已缓存时仍可玩
- [ ] 跨时区抽查：谜题按**用户本地日期**换刊（与 Wordle 相同），不同时区期号可能相差一天，属预期行为
- [ ] 回归测试（可选，本仓库内）：
  ```bash
  node projects/the-law/test/rules.mjs
  node projects/the-law/test/smoke.mjs   # 需 Playwright + chromium
  ```

## 变现接入（可选）

`index.html` 结案区 `<aside class="promo">` 内有注释说明：
1. `<head>` 引入 AdSense 脚本并填 client id；
2. 用 `<ins class="adsbygoogle">` 单元替换 aside 内部内容；
3. 保留 `class="promo"` 外壳维持卷宗样式。
未接入时默认渲染极简自推广位，不破坏美学。

## 运维成本

零。没有数据库、没有接口、没有定时任务。每日换题由客户端种子完成；规则库扩充 = 改 `app.js` 里的 `RULES` 数组 + 跑一遍 `test/rules.mjs`（密度红线会自动把不合格的模板拦下来）。
