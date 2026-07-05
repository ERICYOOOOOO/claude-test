# 今日之律 The Law · 全栈部署详解（从 0 到上线）

> 本指南假设你是一台全新电脑，什么都没装：没有 Node、没有 Git、没有任何账号。跟着从上往下逐条照抄即可把这个项目从零搬到公网、绑上你自己的域名、开启 HTTPS 与缓存、做完 SEO 与变现挂点。所有涉及源码的常量名、现值、行号、命令、生成物都来自本仓库真实文件，未做任何虚构。

---

## 0. 这是什么 / 架构判定

**产品**：《今日之律 The Law》是一款每日归纳推理谜题，血统来自 Wason 2-4-6 实验与桌游 Zendo。每天全球共享同一条被"涂黑"的隐藏法则，作用于 1–20 的数字三元组 `(a, b, c)`。玩家提交实验换取墨绿 ✓（合法）或印泥红 ✗（非法），归纳出规律后接受 8 题终审（4 正 4 负，专挑边界近失变体），判对 ≥7 题即 `CRACKED`。

**传播点**：**零剧透战报**——分享卡只有 ✓/✗ 轨迹格（`🟩`/`🟥`）与实验次数，不含任何具体数字，敢晒不怕剧透；**全球同题**（种子按日期确定性生成）；**难度曲线**（周一最易、周六地狱日）。

**架构判定：纯静态单页（static）。** 依据：

- 逻辑全部在客户端 `app.js` 内（规则引擎 `RULES`、每日出题 `dailyRule`、终审生成 `buildExam`、分享/图卡全是纯前端）；
- 数据（39 个规则模板）内嵌在 JS 里，无数据库、无接口调用、无外链；
- 进度存 `localStorage`（键名 `thelaw.v1`，见 `app.js:314`），不落服务器；
- 每日换题由**客户端本地日期**驱动（`localDayIndex()`，`app.js:200`），与服务器时钟无关；
- 因此**无构建步骤、无后端、无环境变量**，托管成本 ≈ 0，`file://` 双击即可玩（唯一限制见 §2）。

**文件清单表**（本项目目录 `projects/the-law/`）：

| 文件 | 作用 | 是否需上传到生产 |
| --- | --- | --- |
| `index.html` | 页面骨架、meta（title/description/og）、内联 SVG favicon、所有 DOM 节点 | ✅ 必须 |
| `style.css` | 全部样式（卷宗纸感、盖章动画、响应式） | ✅ 必须 |
| `app.js` | 规则引擎 + 存储 + UI 全部逻辑（约 40KB） | ✅ 必须 |
| `DEPLOY.md` | 原精简部署说明（本指南的前身，供参考） | ❌ 不需要 |
| `DEPLOY-FULL.md` | 本文件 | ❌ 不需要 |
| `DESCRIPTION.md` | 产品描述 | ❌ 不需要 |
| `MARKETING.md` | 推广脚本 | ❌ 不需要 |
| `PLAYBOOK.md` | 交互/玩法规格 | ❌ 不需要 |
| `test/rules.mjs` | 引擎单元测试（node 直跑，无浏览器） | ❌ 不需要 |
| `test/smoke.mjs` | Playwright 冒烟测试 | ❌ 不需要 |
| `test/qa-extra.mjs` | 对抗性 QA 附加测试 | ❌ 不需要 |
| `test/screenshots/` | 测试生成的双视口截图 | ❌ 不需要 |

**生产环境只需三个文件**：`index.html`、`style.css`、`app.js`。其余是文档与测试，不影响运行。

---

## 1. 从零准备环境

### 1.1 安装 Node.js（LTS，≥18）

本项目运行不需要 Node（纯静态），但**跑测试、用命令行部署工具（wrangler / vercel）都需要**。装 LTS（≥18；本仓库实测 v22 可用）。

**macOS**（二选一）：

```bash
# 方式 1：Homebrew（若没装 brew，先跑官网那条 install 脚本）
brew install node

# 方式 2：nvm（推荐，可多版本切换）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# 关掉重开终端，然后：
nvm install --lts
nvm use --lts
```

**Windows**（PowerShell，用 winget）：

```powershell
winget install OpenJS.NodeJS.LTS
# 装完关掉重开 PowerShell
```

**Linux**（二选一）：

```bash
# 方式 1：nvm（推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# 关掉重开终端
nvm install --lts && nvm use --lts

# 方式 2：NodeSource（Debian/Ubuntu，装系统级）
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**验证**（两条都要有版本号输出）：

```bash
node -v
# 期望类似：v22.22.2（只要 ≥ v18 即可）
npm -v
# 期望类似：10.9.7
```

### 1.2 安装并配置 Git

**macOS**：`brew install git`（或装 Xcode Command Line Tools：`xcode-select --install`）
**Windows**：`winget install Git.Git`
**Linux**：`sudo apt-get install -y git`

配置身份（提交署名，一次即可，全局生效）：

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱@example.com"
git config --global --list   # 验证：应看到 user.name / user.email
```

### 1.3 需要注册的账号

| 账号 | 用途 | 是否免费 |
| --- | --- | --- |
| **GitHub** | 托管代码、GitHub Pages、CI/CD | 免费 |
| **Cloudflare**（主推托管） | Cloudflare Pages 静态托管 + 全球 CDN + 自动 HTTPS | 免费 |
| **域名注册商**（如 Cloudflare Registrar / Namecheap / 阿里云） | 买 `你的域名`（当前源码占位 `thelaw.day`） | 付费（约 ¥60–120/年） |
| **Google Search Console** | SEO：提交 sitemap、验证收录 | 免费 |
| Vercel / Netlify（备选托管） | 备选静态托管方案 | 免费 |
| Google AdSense（可选，变现） | 广告变现，见 §8 | 免费注册，有审核门槛 |

> 本项目为纯前端，**不需要**后端平台（Fly.io/Railway）、也**不涉及**微信/抖音开放平台。§4 中相关小节按要求保留骨架并标注"本项目不涉及"。

### 1.4 取得代码

本项目在一个 monorepo（`claude-test`）的子目录 `projects/the-law/` 里。两种取法：

**方式 A：克隆整个仓库，再进子目录**

```bash
# 换成你自己的仓库地址
git clone https://github.com/<你的用户名>/claude-test.git
cd claude-test/projects/the-law
pwd
# 期望绝对路径类似：/home/你/claude-test/projects/the-law
```

**方式 B：只取本项目三个文件**（若你只想单独发布这一个游戏）

```bash
mkdir the-law && cd the-law
# 从已克隆的 monorepo 里拷三个文件过来（按你的实际路径改）
cp /path/to/claude-test/projects/the-law/index.html .
cp /path/to/claude-test/projects/the-law/style.css .
cp /path/to/claude-test/projects/the-law/app.js .
```

下文命令统一以**仓库根** `claude-test/`（记作 `<repo>`）或**项目目录** `<repo>/projects/the-law/` 为基准，每处会明确标注。

---

## 2. 本地运行与自验

### 2.1 直接浏览器打开（file://）

双击 `projects/the-law/index.html`，或：

```bash
# macOS
open projects/the-law/index.html
# Linux
xdg-open projects/the-law/index.html
# Windows
start projects\the-law\index.html
```

**file:// 下能玩到什么**：完整游戏——提交实验、盖章、终审 8 题、结案盖大戳、连胜、往期档案练习、复制战报、保存 PNG 图卡（canvas 本地生成，见 `app.js:764 drawShareCard`）全部可用。`localStorage` 也能存（`thelaw.v1`）。
**file:// 下唯一要注意的**：某些浏览器对 `file://` 的 `navigator.clipboard` 更严格，复制战报可能回退到 `document.execCommand('copy')`（`app.js:733 legacyCopy` 已做兜底，不会崩）。总体功能不受影响。

### 2.2 起本地静态服务器（更贴近生产）

任选其一。命令都在**项目目录** `projects/the-law/` 下执行：

```bash
# 方式 1：Node 的 serve（无需预装，npx 现拉）
npx serve .
# 输出会给出地址，通常是 http://localhost:3000

# 方式 2：Python 自带
python3 -m http.server 8000
# 访问 http://localhost:8000
```

浏览器打开对应地址，应看到卷宗抬头显示今天日期与期号、法则行是涂黑条 `████████████████`。

### 2.3 【构建项目】node build.js

**本项目不涉及。** 无构建步骤、无 `build.js`、无产物目录——三个源文件即成品。

### 2.4 【后端项目】起服 / SSE

**本项目不涉及。** 无 `server.mjs`、无 `/events`、无 `/say`、无任何服务端接口。

### 2.5 【小游戏】微信开发者工具导入

**本项目不涉及。** 无 `wechat-minigame/` 目录，是标准 H5 网页。

### 2.6 运行自带测试

测试分两类。**统一从仓库根 `<repo>`（即 `claude-test/`）执行**（测试文件里用的是 `projects/the-law/...` 相对路径）。

**(a) 引擎单元测试（node 直跑，无需浏览器）**：

```bash
cd <repo>          # 即 claude-test 根目录
node projects/the-law/test/rules.mjs
```

期望最后几行：

```
rules.mjs: NNN passed, 0 failed
ALL RULES TESTS PASSED
```

（`rules.mjs` 校验：规则模板 ≥36、三档各 ≥10、全域 8000 三元组正/负例率均 ≥10%、未来 380 天每日种子恒能出题、终审确定性、verdict 边界、分享文本零剧透格式。）

**(b) 浏览器测试（需 Playwright + chromium）**：

`smoke.mjs` 与 `qa-extra.mjs` 用 Playwright 驱动 `file://`。先装依赖：

```bash
cd <repo>
npm install                          # 装 package.json 里的 playwright ^1.61.1
# 一般机器还需下载浏览器二进制：
npx playwright install chromium
```

> 本仓库/本环境已内置 chromium，路径为 `/opt/pw-browsers/chromium`，两个测试脚本里已硬编码 `executablePath: '/opt/pw-browsers/chromium'`（见 `smoke.mjs`）。若你在自己机器上跑且该路径不存在，需把脚本里的 `executablePath` 改成 `npx playwright install chromium` 装出来的路径，或删掉该参数让 Playwright 用默认下载路径。

运行：

```bash
cd <repo>
node projects/the-law/test/smoke.mjs
node projects/the-law/test/qa-extra.mjs
```

`smoke.mjs` 期望：逐条 `ok - ...`，末尾汇总 `0 failed`，并在 `projects/the-law/test/screenshots/` 生成 `desktop-1280x800.png` 与 `mobile-375x667.png`。
`qa-extra.mjs` 期望：引擎层（锚点期号、公平性、聪明玩家 ≥7/8）+ 浏览器层（多日期确定性、越界钳制、半损坏 localStorage 容错等）全部通过，`0 failed`。

---

## 3. 上线前必改（精确到文件 + 常量/行）

全站硬编码的域名占位是 `thelaw.day`，**只出现在 3 处**（已 grep 核实，无遗漏）。逐处替换成你买的真实域名（下表以 `example.com` 举例）。

| # | 文件 | 位置（常量/行号/选择器） | 现值 | 改成 |
| --- | --- | --- | --- | --- |
| 1 | `app.js` | 第 10 行，常量 `SITE_HOST` | `var SITE_HOST = 'thelaw.day';` | `var SITE_HOST = 'example.com';` |
| 2 | `index.html` | 第 136 行，`<aside class="promo">` 内自推广文案 | `把 thelaw.day 发给一个自认聪明的朋友。` | `把 example.com 发给一个自认聪明的朋友。` |
| 3 | `index.html` | 第 150 行，`<footer class="foot">` 内 `<span class="mono">` | `<span class="mono">thelaw.day</span>` | `<span class="mono">example.com</span>` |

`SITE_HOST` 的作用：分享战报文本最后一行的回流域名（`app.js:286 shareText`）与 PNG 图卡底部落款（`app.js:859 drawShareCard`）。改错会导致别人晒战报时带的是旧域名。

**改完如何验证**：项目目录下 `grep -rn "thelaw.day" .` 应无输出（除文档 `DEPLOY.md`/`DEPLOY-FULL.md` 提及外，源码零命中）；浏览器打开走一遍到结案，"复制战报"里最后一行应是你的新域名，PNG 图卡底部落款同理。

**期号锚点（可选，改前想清楚）**：`app.js:9` 的 `LAUNCH_DAY = 20497` 对应第 1 期 = 2026-02-13。若想让上线当天从 № 0001 开始，改成 `Math.floor(Date.UTC(年, 月-1, 日)/86400000)` 算出的整数。**注意**：日序号同时是每日选规则的种子（`dailyRule` 用 `hashDay(day, ...)`），改锚点会改变每天选到的规则；**上线后绝对不要再动**，否则老玩家的往期档案会对不上。改完重跑 `node projects/the-law/test/rules.mjs`，确认仍 `ALL RULES TESTS PASSED`（它会遍历未来 380 天保证每天都能出题）。

**canonical / og:url / og:image（当前源码没有，建议补）**：`index.html` 现有 `og:title`/`og:description`（第 8–9 行）但**没有** `<link rel="canonical">`、`og:url`、`og:image`。为 SEO 与社交卡片效果，建议在 `<head>` 内（第 12 行 `<link rel="stylesheet">` 之前）新增以下 4 行，把域名换成你的：

```html
<link rel="canonical" href="https://example.com/">
<meta property="og:url" content="https://example.com/">
<meta property="og:image" content="https://example.com/og.png">
<meta property="og:image:alt" content="今日之律 The Law — 每日归纳推理谜题">
```

`og.png`（建议 1200×630）需你自己做一张放到站点根目录；没有它，X/Telegram/微信里分享链接不会有大图卡，但不影响游戏。**改完验证**：`view-source` 看 `<head>` 里这 4 行在；上线后用 §7 的 OG 调试器抓一次。

---

## 4. 部署（主链路，≥2 方案，主推 Cloudflare Pages）

先说明 monorepo 的关键点：三个文件在 `projects/the-law/` 子目录，**不是仓库根**。所以所有平台都要把"根目录/输出目录"指到 `projects/the-law`。

### 4.1 方案 A：Cloudflare Pages（主推，免费，全球 CDN + 自动 HTTPS）

#### 路线 ①：连 Git（网页操作，每次 push 自动部署）

1. 先把代码推到 GitHub（若还没）：

   ```bash
   cd <repo>                      # claude-test 根
   git add -A
   git commit -m "deploy the-law"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/claude-test.git   # 若未设过 remote
   git push -u origin main
   ```

2. 登录 <https://dash.cloudflare.com> → 左侧 **Workers & Pages** → **Create** → **Pages** 选项卡 → **Connect to Git**。
3. 授权 GitHub，选中 `claude-test` 仓库。
4. 在 **Set up builds and deployments** 页，按 monorepo 子目录**确切填写**：
   - **Production branch**：`main`
   - **Framework preset**：`None`
   - **Build command**：**留空**（本项目无构建）
   - **Build output directory**：`projects/the-law`
   - （如有 **Root directory** 高级选项，可填 `projects/the-law` 并把 output 留 `/`；两种写法二选一，能指到那三个文件即可）
5. **Save and Deploy**。约 1 分钟后拿到 `https://<项目名>.pages.dev`，打开即上线。之后每次 `git push` 自动重新部署。

> 若本项目将来加了构建（当前没有），Build command 才填 `node build.js`。**本项目留空。**

#### 路线 ②：命令行 wrangler 直传（不连 Git，一条命令上传）

```bash
# 全局装 wrangler（Cloudflare CLI）
npm i -g wrangler
# 首次需登录（会开浏览器授权）
wrangler login

# 从仓库根直传项目目录（目录即产物）
cd <repo>
wrangler pages deploy projects/the-law --project-name=the-law
```

期望输出末尾给出一个 `https://<hash>.the-law.pages.dev` 部署地址。绑定自定义域名见 §5。

### 4.2 方案 B：Vercel（备选，命令行 + vercel.json 全文）

1. 装并登录：

   ```bash
   npm i -g vercel
   vercel login
   ```

2. 在**项目目录**放一个 `vercel.json`（告诉 Vercel 这是纯静态、并顺带配好缓存头，§6 会复用）。

   **文件路径**：`<repo>/projects/the-law/vercel.json`
   **完整内容**：

   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "cleanUrls": true,
     "headers": [
       {
         "source": "/(.*)\\.html",
         "headers": [
           { "key": "Cache-Control", "value": "no-cache, must-revalidate" }
         ]
       },
       {
         "source": "/",
         "headers": [
           { "key": "Cache-Control", "value": "no-cache, must-revalidate" }
         ]
       },
       {
         "source": "/(.*)\\.(css|js)",
         "headers": [
           { "key": "Cache-Control", "value": "public, max-age=3600" }
         ]
       },
       {
         "source": "/(.*)\\.(png|jpg|jpeg|svg|webp|ico)",
         "headers": [
           { "key": "Cache-Control", "value": "public, max-age=86400" }
         ]
       }
     ]
   }
   ```

3. 从项目目录部署：

   ```bash
   cd <repo>/projects/the-law
   vercel            # 首次交互：选账号、项目名，Root 就是当前目录
   vercel --prod     # 正式发布，拿到 https://<项目>.vercel.app
   ```

### 4.3 方案 B'：Netlify（备选，netlify.toml 全文）

**文件路径**：`<repo>/projects/the-law/netlify.toml`
**完整内容**：

```toml
[build]
  publish = "."
  command = ""

[[headers]]
  for = "/*.html"
  [headers.values]
    Cache-Control = "no-cache, must-revalidate"

[[headers]]
  for = "/"
  [headers.values]
    Cache-Control = "no-cache, must-revalidate"

[[headers]]
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=3600"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=3600"
```

部署：

```bash
npm i -g netlify-cli
netlify login
cd <repo>/projects/the-law
netlify deploy            # 预览
netlify deploy --prod     # 正式
```

### 4.4 方案 C：GitHub Pages（免费）

本项目无构建，最省事的是**网页操作**：

1. `git push` 后到仓库 → **Settings** → **Pages**。
2. **Source** 选 **Deploy from a branch**；**Branch** 选 `main`。
3. 目录选择器：GitHub Pages 只能选仓库根或 `/docs`，**无法直接指到 `projects/the-law/`**。两条出路：
   - **出路 A**：把三个文件单独放到一个仓库根（用 §1.4 方式 B 建独立仓库），Pages 目录选 `/ (root)`。
   - **出路 B**：用下面的 Actions workflow，把子目录当产物发布（推荐，保留 monorepo）。

**完整 workflow（用 Actions 从子目录发布，无构建）**：

**文件路径**：`<repo>/.github/workflows/deploy.yml`
**完整内容**：

```yaml
name: Deploy the-law to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - "projects/the-law/**"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact (only the-law folder)
        uses: actions/upload-pages-artifact@v3
        with:
          path: projects/the-law

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

> 本项目无构建，所以 workflow 里**没有** `setup-node` / `node build.js` 步骤——直接把 `projects/the-law` 整个目录上传为 Pages artifact。若将来加了构建，才在 `Upload artifact` 前插入 `actions/setup-node@v4` + `run: node build.js`，并把 `path` 改成产物目录。

推完后到 **Settings → Pages**，Source 选 **GitHub Actions**。站点地址形如 `https://<用户名>.github.io/claude-test/`。**注意子目录路径**：此时站点根是仓库名子路径，而 `index.html` 里引用是相对路径（`href="style.css"`、`src="app.js"`），相对路径在子路径下仍然正确，无需改。若你把它绑到自定义域名根（§5），就没有子路径问题。

### 4.5 方案 D：自建 Nginx（server 块全文）

把三个文件放到服务器 `/var/www/the-law/`，Nginx 配置：

**文件路径**：`/etc/nginx/sites-available/the-law`（然后 `ln -s` 到 `sites-enabled/`）
**完整内容**：

```nginx
server {
    listen 80;
    server_name example.com www.example.com;
    # 强制跳 HTTPS（证书用 certbot 签，见 §5）
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    root /var/www/the-law;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # HTML：每日题、逻辑常更新，即时回源
    location = /index.html {
        add_header Cache-Control "no-cache, must-revalidate";
    }
    location = / {
        add_header Cache-Control "no-cache, must-revalidate";
    }
    # CSS/JS：未做文件名指纹，缓存 1 小时
    location ~* \.(css|js)$ {
        add_header Cache-Control "public, max-age=3600";
    }
    # 图片/OG：缓存 1 天
    location ~* \.(png|jpg|jpeg|svg|webp|ico)$ {
        add_header Cache-Control "public, max-age=86400";
    }
}
```

启用并重载：

```bash
sudo ln -s /etc/nginx/sites-available/the-law /etc/nginx/sites-enabled/
sudo nginx -t          # 期望：syntax is ok / test is successful
sudo systemctl reload nginx
```

### 4.6 【后端项目 the-last-sentence 专属方案】

**本项目不涉及。** 《今日之律》无服务端、无 SSE、无持久卷、无 `TRUST_PROXY`。Fly.io / Railway / VPS + systemd + SSE 反代那一整套是给含后端项目（如 the-last-sentence）用的，此处不适用。本项目用 §4.1–4.5 的静态方案即可。

### 4.7 【小游戏 body-clock 专属方案】

**本项目不涉及。** 无微信/抖音小游戏形态，是标准 H5 网页，直接用静态方案上线。

---

## 5. 自定义域名 + DNS + HTTPS

### 5.1 买域名

在任一注册商买 `example.com`：Cloudflare Registrar（成本价、与 Pages 同厂最省心）、Namecheap、阿里云/腾讯云（国内备案场景）。买完你会在注册商后台管理该域名的 DNS。

### 5.2 各平台绑定域名步骤

- **Cloudflare Pages（主推）**：项目 → **Custom domains** → **Set up a custom domain** → 输入 `example.com`。若域名的 DNS 也托管在 Cloudflare，它会自动加好 CNAME 并签发证书；跟着提示点确认即可，几分钟生效。
- **Vercel**：项目 → **Settings → Domains** → 添加 `example.com`，按它给的 DNS 记录到注册商填。
- **Netlify**：**Domain settings → Add custom domain**，同上。
- **GitHub Pages**：**Settings → Pages → Custom domain** 填 `example.com`，会在仓库生成 `CNAME` 文件；勾选 **Enforce HTTPS**。

### 5.3 DNS 记录表（按你选的平台填其中一组）

| 平台 | 类型 | 主机名 | 值 | 说明 |
| --- | --- | --- | --- | --- |
| **Cloudflare Pages** | CNAME | `example.com`（或 `@`） | `<项目名>.pages.dev` | 同厂时后台自动加，橙色云朵开启即走 CDN |
| **Cloudflare Pages** | CNAME | `www` | `<项目名>.pages.dev` | www 也指过去 |
| **GitHub Pages（根域）** | A | `@` | `185.199.108.153` | 4 条 A 记录缺一不可 |
| **GitHub Pages（根域）** | A | `@` | `185.199.109.153` | 同上 |
| **GitHub Pages（根域）** | A | `@` | `185.199.110.153` | 同上 |
| **GitHub Pages（根域）** | A | `@` | `185.199.111.153` | 同上 |
| **GitHub Pages（www）** | CNAME | `www` | `<用户名>.github.io` | www 子域指到 github.io |
| **Vercel** | A | `@` | `76.76.21.21` | 根域用 A |
| **Vercel** | CNAME | `www` | `cname.vercel-dns.com` | www 用 CNAME |
| **Netlify** | CNAME | `www` | `<站点名>.netlify.app` | 根域建议用 Netlify DNS 或 ALIAS |
| **自建 Nginx** | A | `@` | `你的服务器公网 IP` | 直接指到 VPS |
| **自建 Nginx** | A | `www` | `你的服务器公网 IP` | 同上 |

DNS 生效后用 `dig example.com +short` 或 `nslookup example.com` 抽查，返回的值应与上表一致。

### 5.4 HTTPS 自动签发

- **Cloudflare Pages / Vercel / Netlify / GitHub Pages**：绑定域名后**自动签发并续期** Let's Encrypt 证书，你不用做任何事，几分钟内 `https://` 可用。GitHub Pages 记得勾 **Enforce HTTPS**。
- **自建 Nginx**：用 certbot 手动签：

  ```bash
  sudo apt-get install -y certbot python3-certbot-nginx
  sudo certbot --nginx -d example.com -d www.example.com
  # 交互选 redirect（强制 HTTPS）。certbot 会自动改 nginx 配置并设置续期定时器。
  sudo certbot renew --dry-run   # 验证自动续期可用
  ```

**国内 / 内嵌浏览器强制 HTTPS**：本游戏用到 `navigator.clipboard`（复制战报，`app.js:727`）和 `canvas.toBlob`（保存图卡，`app.js:748`），这些在微信/抖音内嵌浏览器与现代浏览器里**必须 HTTPS 才可用**（`http://` 或非安全上下文会被禁用，代码已有 `execCommand` 兜底但体验降级）。因此上线务必走 HTTPS。

---

## 6. 缓存策略（可照抄的配置全文）

**目标头**（依据：`index.html` 每天由客户端本地日期换题、逻辑常更新，需即时回源；`app.js`/`style.css` **未做文件名指纹**，若缓存过长会导致改了代码用户还看旧版）：

| 资源 | Cache-Control | 理由 |
| --- | --- | --- |
| `/` 与 `*.html` | `no-cache, must-revalidate` | 每日题/逻辑常更新，即时回源校验 |
| `*.css` / `*.js` | `public, max-age=3600` | 无指纹，最多缓存 1 小时，改动 1 小时内全网生效 |
| 图片 / OG (`*.png` 等) | `public, max-age=86400` | 变动少，缓存 1 天 |

> 若将来想把 CSS/JS 缓存拉长（如 `max-age=31536000`），必须先给文件加指纹（把引用改成 `app.v2.js` / `style.v2.css` 之类，每次改代码换文件名），否则用户会长期卡在旧版本。当前没做指纹，**不要**超长缓存。

### 6.1 Cloudflare Pages / Netlify 的 `_headers`

**文件路径**：`<repo>/projects/the-law/_headers`（必须和三个源文件同目录，即输出目录根）
**完整内容**：

```
/
  Cache-Control: no-cache, must-revalidate
/index.html
  Cache-Control: no-cache, must-revalidate
/*.css
  Cache-Control: public, max-age=3600
/*.js
  Cache-Control: public, max-age=3600
/*.png
  Cache-Control: public, max-age=86400
/*.svg
  Cache-Control: public, max-age=86400
```

（Cloudflare Pages 与 Netlify 都原生识别根目录下的 `_headers` 纯文本文件。）

### 6.2 Vercel 的 `vercel.json` headers 段

已包含在 §4.2 的 `vercel.json` 全文里（`headers` 数组），无需重复添加。

### 6.3 Nginx 的 location 段

已包含在 §4.5 的 server 块里（`location = /index.html`、`location ~* \.(css|js)$` 等），照抄即可。

---

## 7. SEO 上线

### 7.1 robots.txt / sitemap.xml

本项目**无 `build.js`，不会自动生成**这两个文件。手写两个静态文件放到站点根（与 `index.html` 同目录 `<repo>/projects/the-law/`）：

**文件路径**：`<repo>/projects/the-law/robots.txt`
**完整内容**：

```
User-agent: *
Allow: /
Sitemap: https://example.com/sitemap.xml
```

**文件路径**：`<repo>/projects/the-law/sitemap.xml`
**完整内容**：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

（单页应用只有首页一个 URL；`changefreq=daily` 契合每日换题。）把 `example.com` 换成你的域名。上线后浏览器访问 `https://example.com/robots.txt` 和 `/sitemap.xml`，都应返回 **200** 并显示内容。

### 7.2 Google Search Console

1. 打开 <https://search.google.com/search-console> → **Add property** → 选 **Domain** 输入 `example.com`。
2. 按提示到注册商加一条 **TXT** 记录（类型 TXT、主机名 `@`、值为它给的 `google-site-verification=...`）→ 回来点 **Verify**。
3. 验证通过后 → 左侧 **Sitemaps** → 输入 `sitemap.xml` → **Submit**。状态应变 **Success**。

### 7.3 Bing Webmaster

到 <https://www.bing.com/webmasters> → **Import** → 从 Google Search Console 一键导入已验证的域名和 sitemap，省去重复验证。

### 7.4 OG 卡图调试

上线并补好 §3 的 og 标签后，用这些调试器强制抓取一次（它们有缓存，改了 og 要在这里刷新）：

- X / Twitter：<https://cards-dev.twitter.com/validator>
- Facebook：<https://developers.facebook.com/tools/debug/>（点 Scrape Again）
- Telegram：把链接发给 [@WebpageBot](https://t.me/WebpageBot) 刷新
- 微信：只能真机发链接看卡片（无官方调试器）

确认标题、描述、`og:image`（若你放了 `og.png`）正确显示。

---

## 8. 变现挂点激活

### 8.1 AdSense

**门槛**：站点需有原创内容、可正常访问、绑定自有域名（`.pages.dev`/`.vercel.app` 子域一般不批），审核数天到数周。

**ads.txt**（放站点根，声明你的 AdSense 账号，防止广告库存被冒卖）：

**文件路径**：`<repo>/projects/the-law/ads.txt`
**完整内容**（把 `pub-0000000000000000` 换成你 AdSense 后台的 Publisher ID）：

```
google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0
```

上线后访问 `https://example.com/ads.txt` 应返回 200。

**把预留广告位换成真实广告单元**：`index.html` 第 129–137 行有预留的 `<aside class="promo">`，内部第 130–134 行是注释说明的三步。确切改法：

1. 在 `<head>`（`index.html` 第 12 行 `<link rel="stylesheet">` 附近）加载 AdSense 脚本（换成你的 client id）：

   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-0000000000000000" crossorigin="anonymous"></script>
   ```

2. 把 `<aside class="promo">` **内部**的自推广两行（第 135–136 行 `<p class="promo-kicker">` 与 `<p>喜欢这类…</p>`）替换成广告单元，**保留 `class="promo"` 外壳**以维持卷宗样式：

   ```html
   <aside class="promo">
     <ins class="adsbygoogle"
          style="display:block"
          data-ad-client="ca-pub-0000000000000000"
          data-ad-slot="1234567890"
          data-ad-format="auto"
          data-full-width-responsive="true"></ins>
     <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
   </aside>
   ```

`data-ad-slot` 从 AdSense 后台建广告单元时拿。**本项目无构建，改一次 `index.html` 即全站生效**（只有一个页面）。未接入时默认渲染极简自推广位（第 135–136 行），不破坏美学。

**联盟 / 其他**：见 `MARKETING.md`，可在自推广位放你自己的其他产品链接，同样改这个 `<aside>` 即可。

### 8.2 【小游戏】流量主 / 激励视频

**本项目不涉及。** 无微信/抖音小游戏形态，没有 `adUnitId`、没有激励视频、没有 `res.isEnded` 发奖逻辑、也不涉及诱导分享红线。这些是小游戏项目（如 body-clock）的合规点，此处不适用。

---

## 9. 上线后自检清单

- [ ] 真机 iOS Safari 打开：卷宗抬头显示今天日期与期号，法则行是涂黑条
- [ ] 真机 Android Chrome 打开：同上，按钮可点、盖章动画正常
- [ ] 提交 `2 · 4 · 6`：<100ms 出现盖章记录（台账新增一行）
- [ ] 走完整流程到结案：出 `CRACKED`/`PARTIAL`/`FAILED` 大戳，法则揭晓
- [ ] "复制战报"：文本最后一行是**你的新域名**（非 `thelaw.day`），且零剧透（无具体数字，只有 `🟩`/`🟥`）
- [ ] "保存图卡"：下载到 `the-law-<期号>.png`，底部落款是新域名
- [ ] `https://` 可访问且强制跳转（`http://` 自动跳 `https://`）
- [ ] `https://www.example.com` 与 `https://example.com` 都能开
- [ ] OG 卡：X/Telegram 里贴链接，标题/描述正确（放了 `og:image` 则有大图）
- [ ] 手机 375px 宽：无横向滚动，按钮可点（smoke 测试也覆盖此项）
- [ ] 跨时区/跨午夜换题：本地过 0 点后刷新，期号 +1、法则改变（`newDayBar` 横幅"新一期卷宗已送达"会出现）
- [ ] `robots.txt` / `sitemap.xml` / `ads.txt`（若接了广告）都返回 200
- [ ] Lighthouse 移动端 Performance ≥ 95（纯静态、无外链，应轻松达标）
- [ ] 【后端项目专属项】本项目不涉及：无 SSE 双设备互见、无同出口 IP 限流、无实例重启连续性
- [ ] 【小游戏专属项】本项目不涉及：无震动/高刷计时/激励视频填充

---

## 10. 持续更新与运维

**改数据 / 扩规则的流程**（本项目无构建，故无 build 步骤）：

1. 编辑 `app.js` 里的 `RULES` 数组（`app.js:52` 起）新增/调整规则模板。红线：每个"模板×参数"实例在 8000 个三元组域内正例率必须 ∈ [10%, 90%]，否则谜题太易/太难。
2. 跑引擎测试守门：

   ```bash
   cd <repo>
   node projects/the-law/test/rules.mjs   # 密度红线会自动拦下不合格模板
   ```

   期望 `ALL RULES TESTS PASSED`。不过就别上线。
3. （可选）跑浏览器测试：`node projects/the-law/test/smoke.mjs`。
4. 重新部署：
   - Cloudflare Pages / Vercel / Netlify（连 Git 的）：`git push` 即自动重部署。
   - wrangler 直传：`wrangler pages deploy projects/the-law --project-name=the-law`。
   - 自建 Nginx：`scp` 三个文件到 `/var/www/the-law/`（无需重启 nginx）。
5. **注意**：改 `RULES` 会改变每天选到的规则种子映射——最好只**追加**模板、不删不重排既有模板，以免打乱历史期号对应的法则（老玩家往期档案会对不上）。`LAUNCH_DAY` 上线后永不改。

**运维成本**：零。没有数据库、接口、定时任务、日志、监控、回滚流程要维护——每日换题由客户端种子完成。这也是纯静态架构的最大优势。

---

## 11. 故障排查表

| 症状 | 可能原因 | 解决 |
| --- | --- | --- |
| 复制战报按钮无反应 / 提示"复制失败" | `file://` 或非 HTTPS 下 `navigator.clipboard` 被禁 | 上线走 HTTPS（§5）；代码已有 `execCommand` 兜底，手动选中 `<pre>` 里文本也可复制 |
| 战报/图卡底部还是旧域名 `thelaw.day` | §3 的 `SITE_HOST`（`app.js:10`）没改，或 JS 被缓存 | 改常量后清 CDN 缓存/等 1 小时（CSS/JS `max-age=3600`），强刷（Cmd/Ctrl+Shift+R） |
| 改了代码但用户仍看旧版 | CSS/JS 无文件名指纹 + 缓存 | 遵守 §6 只给 `max-age=3600`；急需即时生效就在平台后台 Purge Cache，或给文件加版本名 `app.v2.js` 并改 `index.html` 引用 |
| 分享到 X/微信没有卡图或卡图是旧的 | 源码本无 `og:image`；社交平台缓存 OG | 按 §3 补 og 标签并放 `og.png`；用 §7.4 调试器 Scrape Again 刷新 |
| GitHub Pages 打开是 404 或样式全丢 | Pages 目录指错（子目录 monorepo）/相对路径在子路径下失配 | 用 §4.4 的 Actions workflow 只发布 `projects/the-law`；`index.html` 用的相对引用 `style.css`/`app.js` 无需改 |
| 首页法则行不是涂黑而是空白 / 报错 | `app.js` 未加载（路径错或 CSP 拦截） | 检查 `index.html:155` 的 `<script src="app.js">` 路径；纯静态无需 CSP，若平台加了 CSP 需允许 inline（本页有内联 canvas 逻辑但脚本在外部文件） |
| 换了时区/过午夜期号没变 | 换题按**客户端本地日期**（`localDayIndex`，与 Wordle 一致） | 属预期：不同时区期号可能差一天；本地刷新即更新，`newDayBar` 横幅会提示"换刊" |
| `node test/*.mjs` 报找不到 chromium | 本机无 `/opt/pw-browsers/chromium`（脚本硬编码此路径） | `npx playwright install chromium` 后把脚本里 `executablePath` 改成实际路径，或删该参数用默认 |
| `rules.mjs` 某模板 FAIL（密度红线） | 新加的规则正例率越界 [10%,90%] | 调参数或删该模板；红线就是为拦截"全对/全错"的坏谜题 |
| localStorage 存不进（隐私模式/满） | 浏览器禁写或配额满 | 代码已 try/catch 静默兜底（`app.js:384`），游戏仍可玩，只是进度不持久 |
| 微信内 `navigator.vibrate` 无震动 | 本项目**未使用** vibrate，无此问题 | 无需处理（该坑属小游戏项目） |

---

*完。本项目为纯静态三文件（`index.html` / `style.css` / `app.js`），无构建、无后端、无环境变量；上线只需替换 3 处域名占位（§3），选 §4 任一方案部署，绑域名开 HTTPS（§5），配缓存头（§6）即可。*
