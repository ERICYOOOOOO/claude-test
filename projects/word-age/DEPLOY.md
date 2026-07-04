# Word Age — 部署指南

纯静态站：任何能挂静态文件的地方都能跑（Cloudflare Pages / Netlify / GitHub Pages / Vercel / 任意 Nginx）。无构建依赖（node 内置模块），无环境要求。

## 一、部署前：换成你的域名

1. 打开 `build.js`，把顶部 `SITE_ORIGIN`（默认 `https://wordage.fyi`）换成正式域名；或者用环境变量：
   ```bash
   SITE_ORIGIN=https://yourdomain.com node projects/word-age/build.js
   ```
2. 同步修改 `index.html` 里 `<html data-site="...">`、canonical、og:url，以及页脚/文案里的域名字样（全文搜索 `wordage.fyi`）。
3. 重新构建并自验：
   ```bash
   node projects/word-age/build.js
   node projects/word-age/test/data.mjs
   node projects/word-age/test/smoke.mjs   # 需要 Playwright（仅本地自验，不影响部署）
   ```

## 二、部署内容

把整个 `projects/word-age/` 目录（去掉 `test/`、`*.md`、`funfacts.js`、`build.js` 也可以，但留着无害）作为站点根。必须包含：

```
index.html  style.css  app.js  lib.js  data.js
words/           （500 个词页 + index.html 目录页）
sitemap.xml  robots.txt
```

### Cloudflare Pages（推荐，免费额度足够）
1. 仓库连到 Pages，Build command 留空（或 `node projects/word-age/build.js`），Output directory 填 `projects/word-age`。
2. 绑定自定义域，开启 HTTPS（自动）。
3. 缓存规则默认即可——全站静态，命中率≈100%，托管成本≈0。

### GitHub Pages
1. Settings → Pages → Deploy from branch，目录指到 `projects/word-age`（或用 Actions 把该目录推到 `gh-pages` 分支）。
2. 自定义域名 + Enforce HTTPS。

## 三、上线后 10 分钟

1. 打开 `https://域名/`、`/words/nice.html`、`/words/index.html`、`/sitemap.xml`、`/robots.txt` 逐一确认 200。
2. 用手机开一次（375px 无横向滚动、搜索可用、存图可用）。
3. Google Search Console：验证域名 → 提交 `sitemap.xml`（详细步骤见 MARKETING.md）。
4. Bing Webmaster Tools 同样提交一次（导入 GSC 即可，白捡流量）。

## 四、Monetization（AdSense 激活）

广告位已预留两处（都是极简"自推广位"，不破坏版式）：
- 主页 `index.html` 中 `<!-- Ad slot ... -->` 注释标记的 `<aside class="ad">`；
- 每个词页模板（`build.js` 里 `wordPage()` 函数内 `<!-- Ad slot ... -->`）。

激活步骤：
1. AdSense 后台添加站点并通过审核（内容站，500 页原创词条，通过率高；先确保已有真实流量再申请）。
2. 把 `<aside class="ad">` 内部替换为 AdSense 响应式广告单元代码（在 `build.js` 模板里改一处 = 全部词页生效，改完重新 `node build.js`）。
3. 保持每页 **只这一个广告位**：词条页价值在长尾复利，广告密度低才留得住 SEO 排名。
4. `ads.txt` 放到站点根（AdSense 后台会给内容）。
5. 变现主力其实是联盟链接（词典 App / 背单词课 CPA），挂法见 MARKETING.md——广告位与联盟位不要同屏堆叠。

## 五、日常更新流程（每周补词）

1. 在 `data.js` 对应年代分组里加一行 `["word",年,"显示年份","原义","变迁一句","o|y"]`；有冷知识就在 `funfacts.js` 加一条。
2. `node projects/word-age/build.js`（自动重建全部词页 + sitemap）。
3. `node projects/word-age/test/data.mjs && node projects/word-age/test/smoke.mjs` 全绿。
4. 部署（静态目录直接覆盖）。新页会随 sitemap 的新 `lastmod` 被再抓取。

## 六、注意事项

- **页重红线**：主页 HTML+CSS+JS+数据 < 150KB，`test/data.mjs` 会断言。补词到超线时优先精简 shift 文案或把低价值词移出主包。
- 词页不装载数据集；词条内容是构建期烘焙的，别手改 `words/*.html`（会被下次构建覆盖）。
- 全站无 cookie、无第三方请求（激活 AdSense 前），隐私声明可以一句话带过。
