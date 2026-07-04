# Overlap — 部署指南

纯静态四个文件（index.html / style.css / app.js / cities.js），任何静态托管 30 秒上线，托管成本 0。

## 0. 上线前必改

1. **域名占位**：仓库里统一用 `overlap.love` 占位。换成真实域名，全局替换三处来源：
   - `index.html`：`og:url`、`og:image`
   - `app.js`：分享卡页脚 `overlap.love`、文本版最后一行
   - `index.html` 页脚文字
2. **og-card.png**：用产品自己生成——打开站点，选 New York ↔ Tokyo，点 "Save the card"，把 PNG 改名 `og-card.png` 放站点根目录（og:image 已指向它）。
3. 跑一遍测试：
   ```bash
   node projects/overlap/test/tz.mjs
   node projects/overlap/test/smoke.mjs
   ```

## 1. 托管（任选其一）

### Cloudflare Pages（推荐：免费、全球边缘、无冷启动）
```bash
npx wrangler pages deploy projects/overlap --project-name overlap
```
控制台绑定自定义域名即可。

### Netlify
```bash
npx netlify deploy --dir=projects/overlap --prod
```

### GitHub Pages
仓库 Settings → Pages → 指向包含这四个文件的目录（或复制到独立仓库根目录）。

### Vercel
```bash
npx vercel projects/overlap --prod
```

## 2. 缓存与响应头（可选优化）

- `index.html`：`Cache-Control: no-cache`（保证文案/文档热更新）
- `app.js` / `style.css` / `cities.js`：`Cache-Control: public, max-age=3600`。改动频繁期不要设长缓存——文件间没有指纹化。
- 无任何第三方请求，无需 CSP 白名单；想加一条也很简单：`default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'`。

## 3. AdSense 激活（可选）

`index.html` 页脚 `.slot` 即广告位，当前渲染为一句自推广。激活：

1. AdSense 审核通过后，把 `.slot` 内文字替换为你的 `<ins class="adsbygoogle">` 单元 + 官方 script 标签；
2. 保留 `.slot` 容器与样式（虚线框可去掉：删掉 `.slot` 的 `border`）；
3. 红线：只此一个位、只在页脚、不加浮动/插屏。这个产品的转化资产是分享卡，不是 CPM。

## 4. 联盟位（可选，见 MARKETING.md 的克制挂法）

页脚 `.foot-lines` 里加一行文字链即可，样式跟随 `footer a`。不加卡片、不加图。

## 5. 验证上线

- 打开站点：秒出首屏，DevTools Network 应只有 4 个同源请求。
- 选 "东京" 中文搜索命中；选两城出灯带与倒计时。
- 手机开一次：无横向滚动、时间/日期控件可用、PNG 能存到相册。
- 把 `https://你的域名/#new-york/tokyo` 发到 Slack/微信，确认 OG 卡片渲染。

## 6. 已知边界

- localStorage 被禁用（隐身模式部分浏览器）时：功能全部可用，只是里程表和记忆不持久。
- 里程表是本地纪念表，改系统时间可以刷——纯前端版不承诺防作弊（PLAYBOOK 第六节，二期配对短链再上服务端时间）。
- iOS Safari 的 `<input type="time" step="900">` 分钟轮不强制 15 分钟档，用户可选任意分钟——算法按 15 分钟采样取整判定，误差 <15 分钟，可接受。
