# 每日一法 Daily Law · 全栈部署详解（从 0 到上线）

> 本指南假设你是一台全新的电脑、什么都没装：没有 Node、没有 Git、没有任何账号。跟着从头到尾照抄，就能把「每日一法」真正推上线、绑好域名、开好缓存、做完 SEO、挂好广告。凡涉及本项目源码的事实（文件名、常量名、常量值、行号、测试命令）都来自对仓库真实内容的核对，可放心照做。

---

## 0. 这是什么 / 架构判定

**产品**：「每日一法」是一本法条单向历。每天一页、大字日期，呈现一条真实存在、可公开核验的法律条文，配一段 60–120 字的编辑手记。顶部七轨切换——中国、美国、英国、德国、日本、法国、国际条约——以本地日期为种子，全球同一天看到同一页；只保留昨日回看，错过即翻篇。传播点：**引用型内容（法条自带转发理由）+ 日期仪式感（每日回访）**，卡面即广告、域名即回流。

**架构判定：纯静态站点（static），零构建、零后端、零环境变量。** 依据：

- 全部逻辑在客户端 `app.js` 里跑（IIFE，`'use strict'`），无任何网络请求、无框架、无 CDN、无字体外链。
- 数据内嵌在 `laws.js`：`LAW_TRACKS`（7 条轨道）与 `LAWS`（共 **110** 条法条）两个全局常量，浏览器直接读全局变量；`laws.js` 末尾有 `if (typeof module !== 'undefined' && module.exports)` 守卫，只为 Node 测试可 `require`，浏览器里跳过。
- 每日选条是纯函数：`seed = floor((本地当天正午时间 - 时区偏移) / 86400000)`，再 `(seed + trackSalt) % pool.length` 取条（`app.js` 的 `dayInfo`/`pick`）。同一天全球同页，不依赖服务器。
- 收藏用 `localStorage`（键 `dailylaw.v1`，见 `app.js:10` `STORE_KEY`），分享卡用 `canvas` 本地绘制。`file://` 直接双击也能打开，页面总重约 88KB（红线 <150KB）。

**托管成本 ≈ 0**：把 4 个静态文件丢到任意静态托管 / CDN 即可，没有服务器进程、没有数据库、没有账单风险。

### 文件清单表

| 文件 | 作用 | 是否需上传到生产 |
| --- | --- | --- |
| `index.html` | 页面骨架、`<meta>`/OG 标签、DOM 结构、引入 `laws.js`+`app.js` | ✅ 必须 |
| `style.css` | 全部样式（纸白 `#faf7f0` / 碑墨 `#1c1a17` / 朱砂 `#b02e24`、翻页动效、响应式） | ✅ 必须 |
| `app.js` | 主逻辑：选条、渲染、翻页、收藏、复制、canvas 分享卡；顶部有 `DOMAIN` 常量 | ✅ 必须 |
| `laws.js` | 内容库：`LAW_TRACKS`（7 轨）+ `LAWS`（110 条），含 `dateOverride` 应景条 | ✅ 必须 |
| `DEPLOY.md` | 旧版精简部署说明（本文件的前身，参考用） | ❌ 不上传 |
| `DEPLOY-FULL.md` | 本文件 | ❌ 不上传 |
| `DESCRIPTION.md` / `PLAYBOOK.md` / `MARKETING.md` | 产品描述 / 策划案 / 营销变现指南 | ❌ 不上传 |
| `test/data.mjs` | 内容库校验（七轨齐备、每轨 ≥15、字段、无重复、手记字数、免责声明、`node --check`） | ❌ 不上传 |
| `test/smoke.mjs` | Playwright 冒烟测试（`file://` 打开、七轨互异、跨天/午夜、收藏、复制、分享卡、双视口） | ❌ 不上传 |
| `test/qa-extra.mjs` | 附加 QA 测试 | ❌ 不上传 |
| `test/screenshots/` | 冒烟测试产出的截图目录 | ❌ 不上传 |

> 生产环境**只需要 4 个文件**：`index.html`、`style.css`、`app.js`、`laws.js`。其余全部是文档与测试，上传徒增体积、也不该暴露。

---

## 1. 从零准备环境

### 1.1 安装 Node.js（LTS，≥18）

本项目**运行时不需要 Node**（纯静态，浏览器直接跑），但你在本地跑测试（Playwright / `node --check`）、用 `npx serve` 起本地服务器、以及命令行部署都需要 Node。装 LTS（≥18；本机实测 `v22.22.2` 可用）。

**macOS（推荐 nvm，也可 Homebrew）**
```bash
# 方式一：nvm（可管理多版本）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# 重开终端后：
nvm install --lts
nvm use --lts

# 方式二：Homebrew
brew install node
```

**Windows（winget，PowerShell 里执行）**
```powershell
winget install OpenJS.NodeJS.LTS
# 装完关掉再重开 PowerShell，让 PATH 生效
```

**Linux（Debian/Ubuntu，推荐 nvm；或 NodeSource）**
```bash
# 方式一：nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install --lts

# 方式二：NodeSource（系统级安装 Node 22）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**验证**（三平台通用）：
```bash
node -v      # 期望：v22.22.2（或任意 v18+ / v20+ / v22+）
npm -v       # 期望：10.x 或更高，例如 10.9.3
```

### 1.2 安装并配置 Git

- macOS：`brew install git`（或首次运行 `git` 会提示装 Xcode Command Line Tools）。
- Windows：`winget install Git.Git`。
- Linux：`sudo apt-get install -y git`。

配置身份（提交记录会用到，填你自己的）：
```bash
git config --global user.name "你的名字"
git config --global user.email "ericgu050714@gmail.com"
git --version                 # 期望：git version 2.40+ 之类
git config --global user.name # 回显你刚设置的名字
```

### 1.3 需要注册的账号

| 账号 | 用途 | 是否免费 |
| --- | --- | --- |
| **GitHub** | 托管代码；GitHub Pages / Cloudflare Pages / Vercel 都可连 Git 自动部署 | 免费 |
| **Cloudflare**（主推托管） | Cloudflare Pages 托管 + 全球 CDN + 免费 HTTPS；国内可达性相对好 | 免费 |
| **Vercel 或 Netlify**（备选托管） | 备选静态托管，零配置拖拽上传 | 免费额度足够 |
| **域名注册商**（如 Cloudflare Registrar / Namecheap / 阿里云） | 购买 `meiriyifa.app` 域名 | 付费（`.app` 约 12–20 美元/年，强制 HTTPS） |
| **Google AdSense**（变现，可选） | 激活页面预留的 `promo` 广告位 | 免费（审核制） |
| Google Search Console / Bing Webmaster（SEO，可选） | 提交站点、看收录 | 免费 |

> 本项目是纯静态、无后端、无小游戏，因此**不需要** Fly.io / Railway 等后端平台，也**不需要**微信 / 抖音开放平台账号。第 4 节含后端 / 小游戏的子章节对本项目会标注「不涉及」。

### 1.4 取得代码

本项目在一个 monorepo（`claude-test`）里，路径为 `projects/daily-law/`。

**方式一：克隆整个仓库（推荐）**
```bash
# 选一个你放代码的目录，例如 ~/code
cd ~/code
git clone <你的仓库地址> claude-test
cd claude-test/projects/daily-law
pwd    # 期望结尾是 .../claude-test/projects/daily-law
ls     # 期望看到 index.html style.css app.js laws.js DEPLOY.md test/ 等
```

**方式二：只取本项目目录（用 sparse-checkout，省空间）**
```bash
cd ~/code
git clone --no-checkout <你的仓库地址> claude-test
cd claude-test
git sparse-checkout init --cone
git sparse-checkout set projects/daily-law
git checkout
cd projects/daily-law
```

后文所有命令，除非特别标注「仓库根」，默认工作目录都是本项目目录 `.../claude-test/projects/daily-law`（相对仓库根即 `projects/daily-law`）。

---

## 2. 本地运行与自验

### 2.1 直接用浏览器打开（file://）

双击 `index.html`，或在项目目录执行：
```bash
# macOS
open index.html
# Linux
xdg-open index.html
# Windows (PowerShell)
start index.html
```

`file://` 下**能玩到**：七轨切换、翻页动效、看昨日/回到今天、收藏（写 `localStorage`）、编辑手记、canvas 存图分享、复制引用的降级路径（`document.execCommand('copy')`）。
`file://` 下**可能受限**：`navigator.clipboard.writeText` 在部分浏览器对非安全上下文（`file://`）不可用，此时 `app.js` 的 `copyText` 会自动降级到 `execCommand('copy')`，仍能复制（`app.js:242–266`）。要百分百还原线上体验，用下面的本地服务器。

### 2.2 起本地静态服务器

任选其一（都在项目目录里执行）：
```bash
# 方式一：Node 的 serve（无需预装，npx 现拉现用）
npx serve .
# 输出里会给一个地址，通常是 http://localhost:3000

# 方式二：Python 自带的静态服务器
python3 -m http.server 8000
# 访问 http://localhost:8000
```
用浏览器打开上面给出的地址即可，此时是 `http(s)://localhost`，`clipboard` 等能力与线上一致。

### 2.3 构建项目（本项目不涉及）

本项目**无构建步骤**：没有 `build.js`、没有 `package.json` 的 build 脚本、没有产物目录。`index.html` 直接 `<script src="laws.js">` + `<script src="app.js">`，源码即产物。第 4 节涉及「构建项目」的部分对本项目一律跳过。

### 2.4 后端服务（本项目不涉及）

本项目纯客户端，无 `server.mjs`、无 SSE、无 `/events`、无 `/say` 接口，无需起任何服务端进程。

### 2.5 小游戏（本项目不涉及）

本项目是网页（H5），非微信/抖音小游戏，无 `wechat-minigame/` 目录，无需微信开发者工具。

### 2.6 运行自带测试

测试用 **Playwright（chromium）**。仓库根 `package.json` 里 `dependencies` 声明了 `playwright ^1.61.1`（该仓库把它列在 `dependencies` 而非 `devDependencies`）。

**准备 Playwright**：
```bash
# 在仓库根安装依赖
cd ~/code/claude-test
npm install

# 安装 chromium 浏览器：
# 本项目所在的这台机器已内置于 /opt/pw-browsers（含 chromium、chromium-1194 等）。
# 注意：test/smoke.mjs（第 49 行）与 test/qa-extra.mjs（第 80 行）都**硬编码**了
#   chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
# 若你机器上没有这个路径，先装 chromium：
npx playwright install chromium
```
> 重要：因为上述两个测试脚本**硬编码**了 `executablePath: '/opt/pw-browsers/chromium'`，
> 单独设 `PLAYWRIGHT_BROWSERS_PATH` 对它们**不会生效**。在没有 `/opt/pw-browsers/chromium` 的机器上，
> 需把安装好的 chromium 软链到该路径（如 `mkdir -p /opt/pw-browsers && ln -s <你的chromium 可执行文件> /opt/pw-browsers/chromium`），
> 或直接把 `test/smoke.mjs:49` 与 `test/qa-extra.mjs:80` 的 `executablePath` 改成你本机的 chromium 路径，再跑测试。

**逐条运行**（测试脚本内部用相对路径定位 `index.html` / `laws.js`，从仓库根运行最稳妥）：
```bash
cd ~/code/claude-test

# 1) 内容库校验（不需要浏览器，纯 Node）
node projects/daily-law/test/data.mjs
# 期望：一连串「  ok - ...」，末尾 pass 数 > 0、fail = 0
#       断言含：七条轨道、每轨 ≥15 条、字段齐全、无重复、手记 40–160 字、
#       dateOverride 格式与轨内唯一、index.html 含免责声明、laws.js/app.js 通过 node --check

# 2) Playwright 冒烟测试（需要 chromium）
node projects/daily-law/test/smoke.mjs
# 期望：零 console error/pageerror、七轨互异、昨日回看、收藏持久、复制含域名、
#       分享卡 PNG 非空、跨午夜翻页、dateOverride（12-04 宪法日 / 12-10 世界人权宣言）命中、
#       375×667 无横向滚动、触控目标 ≥44px；产出截图到 test/screenshots/
#       末尾应为全绿（fail = 0）

# 3) 附加 QA
node projects/daily-law/test/qa-extra.mjs
# 期望：同样全绿
```
上线前**三个测试都必须全绿（ALL GREEN，fail = 0）**。

---

## 3. 上线前必改（精确到文件 + 常量 / 行）

本项目默认域名就是 `meiriyifa.app`。如果你就用这个域名，域名相关**无需改动**；如果你换成别的域名，按下表逐处替换。同时建议补上 canonical 与 OG 图（当前 `index.html` 里**没有** `<link rel="canonical">`、`og:url`、`og:image`，补齐利于 SEO 与社交卡片）。

| 文件 | 位置（常量名 / 行号 / 选择器） | 现值 | 改成 |
| --- | --- | --- | --- |
| `app.js` | 第 9 行，常量 `DOMAIN` | `var DOMAIN = 'meiriyifa.app';` | 换域名时改成你的域名，如 `var DOMAIN = 'yourdomain.com';`（分享卡底部与复制文本的回流位都读它，见 `app.js:238`、`app.js:396`） |
| `index.html` | 第 62 行，`<p class="colophon">` | `每日一法 · meiriyifa.app` | 页脚落款域名，与上面一致 |
| `index.html` | 第 8–10 行，`og:title` / `og:description` / `og:type` | 已有文案，`og:type=website` | 换域名/换文案时同步；`og:type` 保持 `website` |
| `index.html` | `<head>` 内（当前**缺失**，建议新增） | 无 canonical | 新增 `<link rel="canonical" href="https://你的域名/">` |
| `index.html` | `<head>` 内（当前**缺失**，建议新增） | 无 `og:url` / `og:image` | 新增 `<meta property="og:url" content="https://你的域名/">` 与 `<meta property="og:image" content="https://你的域名/og.png">`（`og.png` 见 §7 说明） |

**建议在 `index.html` 第 10 行 `og:type` 之后补齐这几行**（照抄，替换域名）：
```html
<link rel="canonical" href="https://meiriyifa.app/">
<meta property="og:url" content="https://meiriyifa.app/">
<meta property="og:image" content="https://meiriyifa.app/og.png">
<meta name="twitter:card" content="summary_large_image">
```

**改完如何验证**：
- 改 `DOMAIN` 后：在项目目录 `node -e "require('./laws.js')"` 不报错（语法未破坏）；本地起服务器打开页面，点「存图分享」，卡片底部与「复制引用」文本末行应显示新域名。
- 改 `index.html` 后：`node --check` 不适用于 HTML，改用浏览器打开确认页脚落款正确；用「查看网页源代码」确认 canonical/og 已写入。
- 全量回归：回到仓库根跑 `node projects/daily-law/test/data.mjs`（会断言免责声明仍在）与 `node projects/daily-law/test/smoke.mjs`（断言复制文本含域名），须全绿。

> 本项目**无环境变量、无后端配置、无小游戏 appid/广告位**，第 3 节这些子项对本项目不涉及。

---

## 4. 部署（主链路，≥2 方案，主推 Cloudflare Pages）

生产只需上传 4 个文件（`index.html`、`style.css`、`app.js`、`laws.js`）。由于它们都在 monorepo 的子目录 `projects/daily-law/`，各平台要**把「根/输出目录」指到这个子目录**，这是唯一容易踩的坑。

### 方案 A（主推）：Cloudflare Pages

#### 路线 ①：连 Git（网页操作，自动持续部署）

1. 打开 https://dash.cloudflare.com → 左侧 **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**。
2. 授权 GitHub，选中你的 `claude-test` 仓库。
3. 进入 **Set up builds and deployments**，按下表填（本项目无构建，关键是设置子目录）：
   - **Production branch**：`main`（或你的默认分支）。
   - **Framework preset**：`None`。
   - **Build command**：**留空**（本项目无构建；若是需构建项目才填 `node build.js`）。
   - **Build output directory**：填 `projects/daily-law`。
   - 展开 **Root directory (advanced)**：填 `projects/daily-law`（把构建/上传的工作目录锁到子目录；填了它，Build output directory 可相应填 `.`）。二者取其一能定位到子目录即可，推荐：**Root directory = `projects/daily-law`，Build output directory = `.`**。
4. **Save and Deploy**。首次部署完成后会给一个 `*.pages.dev` 地址，打开验证七轨、翻页、收藏、存图都正常。
5. 之后每次 `git push`，Cloudflare 自动重新部署。

#### 路线 ②：命令行 wrangler 直传（不连 Git，手动发布）

```bash
# 全局安装 wrangler
npm i -g wrangler
wrangler --version          # 期望：3.x 或更高

# 登录（会打开浏览器授权）
wrangler login

# 在项目目录直传本目录（首次会提示创建 project）
cd ~/code/claude-test/projects/daily-law
wrangler pages deploy . --project-name=daily-law
# 期望：上传 4 个文件，输出一个 https://<hash>.daily-law.pages.dev 部署地址
```

### 方案 B（备选）：Vercel（或 Netlify）

因为项目在子目录，需要一个配置文件把根目录指过去。

**Vercel（命令行）**
```bash
npm i -g vercel
cd ~/code/claude-test/projects/daily-law
vercel            # 首次交互式创建 project，Root Directory 选当前目录
vercel --prod     # 发布到生产
```
**`vercel.json`（放在 `projects/daily-law/vercel.json`，完整内容）**：
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, must-revalidate" }
      ]
    },
    {
      "source": "/index.html",
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
      "source": "/og.png",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=86400" }
      ]
    }
  ]
}
```
> 若在 Vercel 网页端连 Git 部署，在 Project → Settings → **Root Directory** 填 `projects/daily-law`，Framework Preset 选 **Other**，Build/Output 全留空。

**Netlify（备选于备选）——`netlify.toml`（放在仓库根 `netlify.toml`，完整内容）**：
```toml
[build]
  base    = "projects/daily-law"
  publish = "."                 # 相对 base 解析；写成 "projects/daily-law" 会双重嵌套成 projects/daily-law/projects/daily-law 导致部署失败
  command = ""

[[headers]]
  for = "/index.html"
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

[[headers]]
  for = "/og.png"
  [headers.values]
    Cache-Control = "public, max-age=86400"
```
命令行：`npm i -g netlify-cli && netlify deploy --prod`（首次 `netlify init` 关联站点）。

### 方案 C：GitHub Pages

本项目**无需构建**，但内容在子目录，GitHub Pages 的「Deploy from a branch」只能选仓库根或 `/docs`，不能直接选任意子目录。两条路：

**路线 ①（简单）**：把 4 个文件复制/建一个专门分支的根目录，或建一个只含本项目的独立仓库，然后 Settings → Pages → Deploy from branch。

**路线 ②（推荐，用 Actions 从子目录发布）**——新建文件 **`.github/workflows/deploy.yml`（放在仓库根的 `.github/workflows/deploy.yml`，完整内容）**：
```yaml
name: Deploy daily-law to GitHub Pages

on:
  push:
    branches: [ main ]
    paths: [ "projects/daily-law/**" ]
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

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      # 本项目无构建；若为需构建项目，在此处 run: node build.js
      - name: Prepare artifact (copy only production files)
        run: |
          mkdir -p _site
          cp projects/daily-law/index.html _site/
          cp projects/daily-law/style.css  _site/
          cp projects/daily-law/app.js     _site/
          cp projects/daily-law/laws.js    _site/

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: _site

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```
提交后到 GitHub 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**，推一次代码即触发。

> GitHub Pages 子目录相对路径提示：本项目 `index.html` 引用的是相对路径 `style.css`/`app.js`/`laws.js`，用上面的 workflow 把它们放到站点根，路径就正确。若你走「项目页」（`https://<user>.github.io/<repo>/`）而不是自定义域名，相对路径同样成立，但绝对路径 `/app.js` 会 404——本项目没用绝对路径，安全。

### 方案 D（可选）：自建 Nginx

把 4 个文件放到服务器目录（如 `/var/www/daily-law/`）。**Nginx server 块（放在 `/etc/nginx/sites-available/daily-law`，完整内容）**：
```nginx
server {
    listen 443 ssl http2;
    server_name meiriyifa.app www.meiriyifa.app;

    ssl_certificate     /etc/letsencrypt/live/meiriyifa.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/meiriyifa.app/privkey.pem;

    root /var/www/daily-law;
    index index.html;

    gzip on;
    gzip_types text/css application/javascript text/html image/svg+xml;

    # HTML 即时回源（每日题 / 逻辑常更新）
    location = /index.html {
        add_header Cache-Control "no-cache, must-revalidate";
    }
    # CSS/JS 一小时缓存（未做文件名指纹，勿超长）
    location ~* \.(css|js)$ {
        add_header Cache-Control "public, max-age=3600";
    }
    # OG 图一天
    location = /og.png {
        add_header Cache-Control "public, max-age=86400";
    }

    location / {
        try_files $uri $uri/ =404;
    }
}

# 80 → 443 跳转
server {
    listen 80;
    server_name meiriyifa.app www.meiriyifa.app;
    return 301 https://$host$request_uri;
}
```
启用与签证书见 §5.4。

### 4.x 后端 / 小游戏方案（本项目不涉及）

本项目无后端、无实时 SSE、无微信/抖音小游戏，因此 Fly.io / Railway / VPS + systemd + SSE 反代 / 微信小游戏发布流程等**对本项目不涉及**，无需 Dockerfile、fly.toml、systemd unit、TRUST_PROXY、持久卷、`history.jsonl` 备份 cron 等。上面的静态方案 A/B/C/D 已是完整主链路。

---

## 5. 自定义域名 + DNS + HTTPS

### 5.1 买域名

在任一注册商购买 `meiriyifa.app`（`.app` 是 Google 运营的顶级域，**强制 HTTPS**、天然带 HSTS，很适合本项目）。推荐 Cloudflare Registrar（无溢价）、Namecheap、阿里云均可。

### 5.2 各平台绑定域名

- **Cloudflare Pages**：项目 → **Custom domains** → **Set up a domain** → 输入 `meiriyifa.app`（和 `www.meiriyifa.app`）。若域名的 DNS 就托管在 Cloudflare，会自动加好 CNAME 记录并签发证书，几分钟生效。
- **Vercel**：Project → Settings → **Domains** → 添加域名，按提示在注册商加 A/CNAME 记录。
- **Netlify**：Site → **Domain management** → Add custom domain。
- **GitHub Pages**：Settings → Pages → **Custom domain** 填 `meiriyifa.app`（会在仓库产物里生成 `CNAME` 文件），勾 **Enforce HTTPS**。

### 5.3 DNS 记录表（按你选的平台取一组）

| 平台 | 类型 | 主机名 | 值 | 说明 |
| --- | --- | --- | --- | --- |
| **GitHub Pages（根域）** | A | `@` | `185.199.108.153` | GitHub Pages 官方 4 个 IP，四条都加 |
| | A | `@` | `185.199.109.153` | 同上 |
| | A | `@` | `185.199.110.153` | 同上 |
| | A | `@` | `185.199.111.153` | 同上 |
| | CNAME | `www` | `<你的用户名>.github.io` | www 指向 Pages |
| **Vercel** | A | `@` | `76.76.21.21` | 根域指向 Vercel |
| | CNAME | `www` | `cname.vercel-dns.com` | www 指向 Vercel |
| **Cloudflare Pages** | CNAME | `@` | `<project>.pages.dev` | 由 Cloudflare 自动添加（根域用 CNAME flattening） |
| | CNAME | `www` | `<project>.pages.dev` | 同上 |
| **自建 Nginx（方案 D）** | A | `@` | 你的服务器公网 IP | 直接指向服务器 |
| | A | `www` | 你的服务器公网 IP | 同上 |

### 5.4 HTTPS 自动签发

- Cloudflare Pages / Vercel / Netlify / GitHub Pages 都**自动签发并续期**免费证书（Let's Encrypt / 各家 CA），你只需等 DNS 生效后勾选「Enforce HTTPS」（GitHub Pages）即可。
- **自建 Nginx（方案 D）** 用 certbot 手动签：
  ```bash
  sudo apt-get install -y certbot python3-certbot-nginx
  sudo ln -s /etc/nginx/sites-available/daily-law /etc/nginx/sites-enabled/
  sudo certbot --nginx -d meiriyifa.app -d www.meiriyifa.app
  sudo nginx -t && sudo systemctl reload nginx
  # certbot 会自动配置续期定时任务
  ```
- **强制 HTTPS 与分享场景**：`.app` 域名浏览器强制 HTTPS；分享卡在微信 / 小红书等内嵌浏览器打开时也要求 HTTPS，务必确保线上是 `https://`，否则内嵌浏览器可能拦截或不渲染。

---

## 6. 缓存策略（可照抄的配置全文）

目标响应头：
- **HTML**（`index.html`）：`no-cache, must-revalidate` —— 每日题目与逻辑随时可能更新，必须即时回源，不能缓存旧页。
- **CSS/JS**（`style.css`/`app.js`/`laws.js`）：`public, max-age=3600`（1 小时）—— 本项目**未做文件名指纹**（引用是固定的 `app.js`、`laws.js`），所以**不要**设超长缓存，否则用户会长期卡在旧版。若将来要长缓存，需先把引用改成带版本的文件名（如 `app.v2.js`），再把 `max-age` 调大。
- **图片 / OG**（如 `og.png`）：`public, max-age=86400`（1 天）。

### 6.1 Cloudflare Pages / Netlify —— `_headers`

**文件 `_headers`（放在 `projects/daily-law/_headers`，会随站点一起上传到根，完整内容）**：
```
/index.html
  Cache-Control: no-cache, must-revalidate

/
  Cache-Control: no-cache, must-revalidate

/*.css
  Cache-Control: public, max-age=3600

/*.js
  Cache-Control: public, max-age=3600

/og.png
  Cache-Control: public, max-age=86400
```
> `_headers` 必须位于**发布目录的根**。用 Cloudflare Pages（Root directory = `projects/daily-law`）或 Netlify（publish = `projects/daily-law`）时，把它放在 `projects/daily-law/` 下即可。

### 6.2 Vercel —— `vercel.json` 的 headers 段

见 §4 方案 B 的 `vercel.json` 全文，其中 `headers` 数组即缓存配置（`/` 与 `/index.html` 走 no-cache，`css|js` 走 1 小时，`og.png` 走 1 天），无需重复。

### 6.3 Nginx —— location 段

见 §4 方案 D 的 server 块，其中三个 `location`（`= /index.html`、`~* \.(css|js)$`、`= /og.png`）即缓存配置，直接照抄。

---

## 7. SEO 上线

本项目是单页应用型静态站，SEO 做**最小集**即可（长尾法条静态页是后续迭代，见 DEPLOY.md「可选增强」）。

- **robots.txt**：本项目无构建脚本自动生成，手动新建 **`projects/daily-law/robots.txt`（完整内容）**：
  ```
  User-agent: *
  Allow: /
  Sitemap: https://meiriyifa.app/sitemap.xml
  ```
- **sitemap.xml**：单页站点手动新建 **`projects/daily-law/sitemap.xml`（完整内容）**：
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>https://meiriyifa.app/</loc>
      <changefreq>daily</changefreq>
      <priority>1.0</priority>
    </url>
  </urlset>
  ```
  上线后浏览器访问 `https://meiriyifa.app/robots.txt` 与 `/sitemap.xml`，应各返回 **200** 并显示上述内容。
- **Google Search Console**：https://search.google.com/search-console → 添加资源 → 选「网域」用 DNS TXT 验证（或「网址前缀」用 HTML 标签验证）→ 验证通过后 **Sitemaps** 提交 `sitemap.xml`。
- **Bing Webmaster**：https://www.bing.com/webmasters → **Import from GSC** 一键导入已验证的站点与 sitemap。
- **OG 卡图调试**：先按 §3 补齐 `og:image`（准备一张 1200×630 的 `og.png` 放站点根），再用 X（Twitter）Card Validator、Telegram（把链接发给 @WebpageBot）、Facebook Sharing Debugger 各刷一次，确认标题、描述、卡图正确。改了 OG 后社交平台有缓存，需在这些调试器里点「重新抓取」。
- **国内可选**：提交百度站长平台（对国内搜索有用）。

> 本项目无 `build.js`，robots/sitemap 是**手动维护**的静态文件；将来若做长尾静态页，再引入构建脚本自动生成。

---

## 8. 变现挂点激活

页面已预留**唯一一个**不破坏美学的广告位：`index.html` 第 55–58 行的 `<aside class="promo" id="promo">`（在收藏夹面板与页脚之间），默认渲染为极简自推广位（文案「每天一页的仪式感，也可以送人……」）。

### 8.1 AdSense（默认路径）

- **申请门槛**：AdSense 后台添加站点并通过审核。本项目内容是公有领域法条 + 原创手记、页脚有免责声明（`node test/data.mjs` 会断言免责声明存在），有利于过审。**保留页脚免责声明**。
- **ads.txt**：审核通过后，AdSense 会给你一个发布商 ID。新建 **`projects/daily-law/ads.txt`（放站点根，完整内容，把 `pub-XXXXXXXXXXXXXXXX` 换成你的 ID）**：
  ```
  google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
  ```
  上线后访问 `https://meiriyifa.app/ads.txt` 应返回 200。
- **替换广告位**：把 `index.html` 第 55–58 行整个 `<aside class="promo" id="promo">…</aside>` 块替换为（`ca-pub-XXXX` / `YYYY` 换成你的 client / slot）：
  ```html
  <aside class="promo" id="promo">
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXX"
         data-ad-slot="YYYY" data-ad-format="auto" data-full-width-responsive="true"></ins>
  </aside>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX" crossorigin="anonymous"></script>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
  ```
  保持 `promo` 的 `max-width` 与纸白配色不变；**只此一个广告位，不加浮层、不加插屏**。本项目单页，改一处即全站生效（无需重跑任何构建）。
- **改完验证**：本地起服务器打开页面，广告位区域出现 AdSense 占位/广告；`node projects/daily-law/test/data.mjs` 仍全绿（免责声明未被误删）；上线后线上确认无控制台报错。

### 8.2 联盟备选

公考 / 法考课程 CPS 联盟（更高客单）与 AdSense **二选一、不叠加**（见 MARKETING.md）。做法是把 `promo` 块内容换成一句以内容价值开头的推荐文案 + 合作链接，例如「推荐 · 常识判断里的法条，这里每天积累一条。系统学习 → XX 课程」。禁用倒计时 / 红包 / 弹窗。

### 8.3 小游戏流量主（本项目不涉及）

本项目非小游戏，无微信流量主 / 激励视频 `adUnitId`、无「发奖以 `res.isEnded===true` 为准」的合规红线、无诱导分享红线相关内容。

---

## 9. 上线后自检清单

- [ ] 真机 iOS Safari 打开线上地址：七轨切换、翻页动效、收藏、存图、复制均正常
- [ ] 真机 Android Chrome 打开：同上
- [ ] `https://meiriyifa.app` 与 `https://www.meiriyifa.app` 都可访问、都是 HTTPS、http 自动跳 https
- [ ] OG 卡：X / Telegram / Facebook 调试器抓取，标题+描述+卡图正确
- [ ] 跨时区/跨午夜换题：改设备时区或用 `window.__FAKE_NOW__`（测试钩子）验证同一天全球同页、午夜后翻到新一天
- [ ] 昨日回看：点「看昨日」显示昨天的条目，再点「回到今天」复原；「昨日」角标出现/消失
- [ ] 收藏持久：收藏后刷新页面仍在（`localStorage` 键 `dailylaw.v1`）
- [ ] 复制引用：粘贴出来的文本末行是你的域名（`DOMAIN`）
- [ ] 分享卡：存图得到非空 PNG，卡面日期/条文/朱红印章/域名齐全
- [ ] Lighthouse 移动端 Performance ≥ 95（纯静态、零外链，通常轻松达标）
- [ ] `robots.txt` / `sitemap.xml` / `ads.txt`（若已挂 AdSense）各返回 200
- [ ] 375px 视口无横向滚动、触控目标 ≥44px（`smoke.mjs` 已覆盖，线上再手过一遍）

> 后端 / 小游戏相关的自检项（两设备实时互见 SSE、同出口 IP 限流 429、平台重启后编号连续、震动手感、iOS 高刷计时、激励视频无填充不卡死等）**本项目不涉及**。

---

## 10. 持续更新与运维

**更新内容（最常见操作）**：改的是 `laws.js`（增删法条、调 `dateOverride` 应景条），流程：
```bash
cd ~/code/claude-test
# 1) 编辑 projects/daily-law/laws.js（遵守字段规范：track/text/source/enact/note，外国轨补 origLang/origName）
# 2) 跑内容库校验（本项目无构建步骤，直接测）
node projects/daily-law/test/data.mjs      # 必须全绿：七轨 ≥15、字段齐、无重复、手记字数、dateOverride 唯一
# 3) 跑冒烟测试
node projects/daily-law/test/smoke.mjs      # 必须全绿
node projects/daily-law/test/qa-extra.mjs   # 必须全绿
# 4) 提交并推送 → 连 Git 的托管（Cloudflare Pages / Vercel / GitHub Pages）自动重新部署
git add projects/daily-law/laws.js
git commit -m "content: 新增/调整法条"
git push
# 命令行直传的（wrangler / vercel --prod）则手动重发一次
```
> 本项目**无构建**，所以「改数据 → 重跑 build.js」这一步**对本项目不适用**，直接测试 + 部署即可。

**运维**：纯静态无进程、无日志、无数据库，日常运维极轻——托管平台自带可用性与证书续期。回滚就是在托管平台的 Deployments 列表点回上一个成功版本（或 `git revert` 后 push）。无需备份服务器状态（用户收藏在各自浏览器 `localStorage`，天然分布式、无需服务端备份）。

---

## 11. 故障排查表

| 症状 | 可能原因 | 解决 |
| --- | --- | --- |
| `file://` 下「复制引用」点了没反应/报错 | 非安全上下文 `navigator.clipboard` 不可用 | 已自动降级到 `execCommand('copy')`（`app.js:251`）；要完整体验用 `npx serve .` 走 `http://localhost` |
| 改了内容/样式，线上还是旧版 | CSS/JS 被缓存（或 CDN 边缘缓存） | 确认 `_headers`/`vercel.json` 里 css/js 是 `max-age=3600` 而非超长；在托管平台「Purge cache」；硬刷新（Cmd/Ctrl+Shift+R） |
| 想给 JS 设超长缓存但怕用户卡旧版 | 未做文件名指纹，引用是固定 `app.js` | 要长缓存必须先把引用改成 `app.v2.js` 之类带版本名，再调大 `max-age`；否则维持 1 小时 |
| 分享到微信/Telegram，卡图不更新 | 社交平台缓存了旧 OG | 在 X/Facebook/Telegram 调试器里「重新抓取」；给 `og.png` 换文件名或加版本参数 |
| OG 卡图根本不出 | `index.html` 缺 `og:image`/`og:url` | 按 §3 补齐 `og:image`/`og:url`/`twitter:card`，准备 1200×630 的 `og.png` 放站点根 |
| GitHub Pages 项目页里 `app.js` 404 | 用了绝对路径 `/app.js`，项目页有子路径前缀 | 本项目用的是相对路径，正常；若你手改成绝对路径要还原为相对，或用自定义域名根路径 |
| 部署上去页面空白 / 404 | monorepo 子目录没指对 | 把 Root/Output 目录设为 `projects/daily-law`（Cloudflare/Vercel/Netlify），或用 §4 方案 C 的 workflow 只拷 4 个文件 |
| 跨午夜没换题，或全球不同页 | 误改了 `dayInfo` 的种子算法 | 种子须为 `floor((当天正午 - tzOffset)/86400000)`（`app.js:21–26`）；用 `window.__FAKE_NOW__` 注入时间跑 `smoke.mjs` 验证 |
| 某普法节点当天没出应景条 | `dateOverride` 的 `MM-DD` 写错，或该轨没这条 | 核对 `laws.js` 里对应 `dateOverride`（如宪法日 `12-04`、世界人权宣言 `12-10`）；`data.mjs` 会断言 `dateOverride` 轨内唯一 |
| 收藏刷新后丢了 | 浏览器隐私模式 / 清了 `localStorage` / 数据损坏 | `loadStore` 对损坏数据容错返回空收藏（`app.js:69–78`）；隐私模式本就不持久，属预期 |
| AdSense 审核不过 | 缺免责声明 / 内容太薄 | 保留页脚免责声明（`data.mjs` 已断言其存在）；内容库 110 条 + 原创手记通常足够，等审核 |

> 后端专属坑（SSE 被代理缓冲、机器休眠断流、`TRUST_PROXY` 未开导致全站一个冷却桶）与小游戏专属坑（微信内 `navigator.vibrate` 不可用需静默）**本项目不涉及**。本项目唯一需要留意的是「CSS/JS 未指纹 → 勿超长缓存」和「monorepo 子目录要指对」这两条。
