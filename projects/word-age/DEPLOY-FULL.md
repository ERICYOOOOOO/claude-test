# Word Age（词龄）· 全栈部署详解（从 0 到上线）

> 本指南假设你是**全新电脑、什么都没装**。跟着从上到下逐条照抄即可把这个站从零跑通、构建、上线到自己的域名、加上 CDN/HTTPS/缓存/SEO/变现，并做好上线后运维。命令里凡是写“仓库根”的，指你 `git clone` 下来的仓库最外层目录；写“项目目录”的，指 `仓库根/projects/word-age/`。所有路径都会标明是相对仓库根还是绝对路径。

---

## 0. 这是什么 / 架构判定

**产品**：Word Age 是一个英文词源 SEO 工具站。输入任意英文单词，返回它的“出生证明”——首次被记录的年份、实际年龄、当年原义、语义如何漂移到今天，外加一句“想截图”的历史反差参照（例如“nice 比活版印刷术还老 140 年”）。500 个逐条核实的常用词，一个 Word of the Day，一键导出 1080×1350 出生证明 PNG。传播点：反差事实卡在 Reddit / TikTok / Pinterest 天然易传，长尾词页在搜索引擎里慢慢生根。

**架构判定：纯静态站 + 构建期烘焙（static + build-step）。** 依据：

- 逻辑全在客户端（`app.js` / `lib.js`），数据内嵌 JS（`data.js`，浏览器里 `var WORD_AGE`），**零 fetch、零后端、零第三方请求**，`file://` 直接可用。
- `build.js` 是一个**零依赖**的 Node 脚本（只用 `fs` / `path` 内置模块），构建期把每个词烘焙成一个独立静态 HTML 页 + 目录页 + `sitemap.xml` + `robots.txt`。生产环境只需要托管一堆静态文件，**托管成本 ≈ 0**，命中 CDN 后回源率极低。
- 没有 `package.json`、没有 npm 依赖、没有服务端进程、没有小游戏容器。

**文件清单**（均为项目目录 `projects/word-age/` 下真实文件）：

| 文件 | 作用 | 是否需上传到生产 |
|---|---|---|
| `index.html` | 主页（即时搜索、Word of the Day、分享卡入口） | ✅ 必须 |
| `style.css` | 全站样式（活版印刷风） | ✅ 必须 |
| `app.js` | 客户端交互（搜索、odometer、canvas 出生证明、localStorage） | ✅ 必须 |
| `lib.js` | 纯逻辑（锚点引擎、年龄计算、wotd 种子），浏览器与 Node 共用 | ✅ 必须 |
| `data.js` | 内嵌数据集（500 词 + 30 锚点），`var WORD_AGE` | ✅ 必须 |
| `words/` | 构建产物：500 个 `<word>.html` + `index.html` 目录页 | ✅ 必须（由 `build.js` 生成） |
| `sitemap.xml` | 站点地图（502 个 URL：主页 + 目录 + 500 词页） | ✅ 必须（由 `build.js` 生成） |
| `robots.txt` | 爬虫规则 + Sitemap 指向 | ✅ 必须（由 `build.js` 生成） |
| `build.js` | 静态站生成器（构建期用） | ⬜ 可上传可不传（不影响页面，留着无害） |
| `funfacts.js` | 词页“Marginalia”冷知识，构建期烘焙进词页 | ⬜ 构建期用，页面已烘焙，可不上传 |
| `test/` | `data.mjs` / `smoke.mjs` / `qa-extra.mjs` + `screenshots/` | ⬜ 不上传 |
| `DESCRIPTION.md` / `PLAYBOOK.md` / `MARKETING.md` / `DEPLOY.md` / 本文件 | 文档 | ⬜ 不上传 |

> 一句话：**上传 `index.html style.css app.js lib.js data.js` + `words/` + `sitemap.xml` + `robots.txt` 即是全站。** 其余留着无害，但 `test/` 和 `*.md` 建议排除（见 §4 各平台忽略规则）。

---

## 1. 从零准备环境

### 1.1 安装 Node.js（需 LTS，≥18；本仓库实测 v22.22.2）

`build.js` 与测试都用 Node。三平台任选其一：

**macOS**（推荐 Homebrew 或 nvm）：
```bash
# 方式一：Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node

# 方式二：nvm（可多版本切换，推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# 关闭并重开终端，然后：
nvm install --lts
nvm use --lts
```

**Windows**（PowerShell，winget）：
```powershell
winget install OpenJS.NodeJS.LTS
# 关闭并重开 PowerShell 使 PATH 生效
```

**Linux**（Debian/Ubuntu，nvm 最省心；或 NodeSource）：
```bash
# 方式一：nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
nvm install --lts

# 方式二：NodeSource（系统级安装 Node 20 LTS）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**验证**（三平台通用）：
```bash
node -v
npm -v
```
期望输出类似：
```
v22.22.2        # 或任意 v18.x / v20.x / v22.x
10.9.x
```
只要 `node -v` 显示 `v18` 及以上即可。

### 1.2 安装并配置 Git

- macOS：`brew install git`（或装 Xcode Command Line Tools：`xcode-select --install`）
- Windows：`winget install Git.Git`
- Linux：`sudo apt-get install -y git`

配置身份（提交记录会用到，一次性）：
```bash
git config --global user.name "你的名字"
git config --global user.email "ericgu050714@gmail.com"
```
验证：
```bash
git --version        # 期望 git version 2.x.x
git config --global user.name    # 回显你的名字
```

### 1.3 需要注册的账号

| 账号 | 用途 | 是否免费 |
|---|---|---|
| **GitHub** | 存代码 / 触发自动部署 / GitHub Pages | 免费 |
| **Cloudflare**（主推托管） | Cloudflare Pages 托管 + 全球 CDN + HTTPS | 免费额度足够 |
| Vercel 或 Netlify（备选托管） | 备用静态托管 | 免费额度足够 |
| **域名注册商**（Cloudflare Registrar / Namecheap / Porkbun 等） | 买 `wordage.fyi` 或你自己的域名 | 域名年费（`.fyi` 约 $5–20/年），非免费 |
| **Google Search Console** | 提交 sitemap、看搜索表现（SEO 主战场） | 免费 |
| Bing Webmaster Tools | 导入 GSC，白捡 Bing/DuckDuckGo 流量 | 免费 |
| Google AdSense（**流量起来后再申请**） | 展示广告变现 | 免费，但有审核门槛 |

> 教育联盟（词典 App / 背单词课 CPA）才是本站变现主力，见 §8 与 `MARKETING.md`；AdSense 只是补充。

### 1.4 取得代码

这是一个 **monorepo**，Word Age 只是其中一个子目录 `projects/word-age/`。

```bash
# 克隆整个仓库（把 URL 换成你自己 fork 后的地址）
git clone https://github.com/<你的用户名>/claude-test.git
cd claude-test/projects/word-age      # ← 之后所有相对命令都从这里或仓库根出发
pwd                                    # 确认你在 .../claude-test/projects/word-age
```

如果只想要这一个子目录（sparse checkout，省空间）：
```bash
git clone --filter=blob:none --sparse https://github.com/<你的用户名>/claude-test.git
cd claude-test
git sparse-checkout set projects/word-age
cd projects/word-age
```

---

## 2. 本地运行与自验

### 2.1 直接用浏览器打开（file://）

双击 `projects/word-age/index.html`，或在浏览器地址栏输入该文件的绝对路径（`file:///.../projects/word-age/index.html`）。

- **能玩到**：即时搜索、Word of the Day、四件事展示、反差参照、判词红章、保存出生证明 PNG、复制文本、`?q=nice` 深链——因为数据内嵌、逻辑纯客户端，`file://` 下全部可用。
- **注意**：词页 `words/<word>.html` 用的是相对路径引用 `../style.css`、`../app.js`，`file://` 下也能打开。跨页“Permanent page →”跳转在 `file://` 下同样可用。

### 2.2 起本地静态服务器（更接近生产）

从**项目目录**起服，任选其一：
```bash
# 方式一：Node（无需预装，npx 现取）
npx serve .
# 输出会给出访问地址，通常 http://localhost:3000

# 方式二：Python3
python3 -m http.server 8000
# 访问 http://localhost:8000
```
打开 `http://localhost:8000/`（主页）、`http://localhost:8000/words/nice.html`（词页）、`http://localhost:8000/words/index.html`（目录页）逐一确认能开。

### 2.3 构建：`node build.js`

`build.js` 会**删掉并重新生成** `words/*.html`，并重写 `sitemap.xml`、`robots.txt`：

```bash
# 在项目目录 projects/word-age/ 下：
node build.js
```
期望输出：
```
built 500 word pages + catalogue
sitemap: 502 urls  ·  origin: https://wordage.fyi
```
生成产物验证：
```bash
ls words | wc -l          # 期望 501（500 词页 + index.html）
head -3 sitemap.xml       # 应看到 <?xml ...> 与 <urlset ...>
cat robots.txt            # 应看到 Sitemap: https://wordage.fyi/sitemap.xml
```
再用静态服务器打开任一新生成的词页确认 200，例如 `http://localhost:8000/words/robot.html`。

> `build.js` 的 origin 由环境变量 `SITE_ORIGIN` 决定，默认 `https://wordage.fyi`。换域名时见 §3。

### 2.4 后端 / 小游戏

**本项目不涉及。** 纯静态、零后端、无微信/抖音小游戏容器。

### 2.5 运行自带测试

项目有三个测试文件：

- `test/data.mjs`：**纯 Node，无需浏览器**。校验数据集形状、锚点语法、构建产物（词页数 == 数据集、每页有 title/canonical/OG/≥4 内链）、sitemap 数量、**主页 < 150KB 红线**、Word of the Day 跨午夜确定性。
- `test/smoke.mjs`、`test/qa-extra.mjs`：**需要 Playwright chromium**（浏览器端交互 + 截图）。

**先跑纯 Node 测试**（改完数据/构建后必跑）：
```bash
# 在项目目录 projects/word-age/ 下：
node test/data.mjs
```
期望输出（ALL GREEN）：
```
data.mjs: all assertions passed — 500 words, 30 anchors, 500 pages, 502 sitemap urls, homepage 144.9KB
```
（若任意断言失败会打印 `FAIL: ...` 并以非 0 退出。红线：主页 payload 必须 < 150KB，当前约 144.9KB，补词过线会在这里报错。）

**跑浏览器测试**（需 Playwright）：
```bash
# 安装 Playwright 与 chromium（一般机器）：
npm i -D playwright
npx playwright install chromium

node test/smoke.mjs
node test/qa-extra.mjs
```
> 注意：`smoke.mjs` / `qa-extra.mjs` 里硬编码了 `executablePath: "/opt/pw-browsers/chromium"`（本仓库 CI 环境的 chromium 路径）。**一般机器上没有这个路径**，`npx playwright install chromium` 会把 chromium 装到别处，因此在你自己的机器上运行这两个文件前，需要把该行改成用默认 chromium（去掉 `executablePath`），或把系统 chromium 软链到该路径。`data.mjs` 无此依赖，是部署前的最低必跑项。

期望 `smoke.mjs` 结尾：
```
smoke.mjs: all assertions passed
```

---

## 3. 上线前必改（精确到文件 + 常量/行）

只有在你用**自己的域名**（而非 `wordage.fyi`）时才需要改。核心是把域名从两处“真源”改掉：`build.js` 的 `SITE`（决定所有生成页里的 canonical/og:url/sitemap/robots）与 `index.html` 的静态标签（主页自己的 canonical/og:url/data-site/文案）。

| 文件 | 位置（常量名/行号/选择器） | 现值 | 改成 |
|---|---|---|---|
| `build.js` | 第 16 行 `const SITE = (process.env.SITE_ORIGIN \|\| "https://wordage.fyi")...` | `https://wordage.fyi` | 你的域名（改默认值，或走环境变量，见下） |
| `index.html` | 第 2 行 `<html lang="en" data-site="https://wordage.fyi">` | `https://wordage.fyi` | `https://你的域名` |
| `index.html` | 第 8 行 `<link rel="canonical" href="https://wordage.fyi/">` | `https://wordage.fyi/` | `https://你的域名/` |
| `index.html` | 第 12 行 `<meta property="og:url" content="https://wordage.fyi/">` | `https://wordage.fyi/` | `https://你的域名/` |
| `index.html` | 第 115 行 页脚 `<span>wordage.fyi</span>` | `wordage.fyi` | `你的域名` |

**词页与目录页无需手改**——它们由 `build.js` 用 `SITE` 常量烘焙（canonical / og:url / footer / `data-site` 全部来自 `SITE`）。改完 `SITE` 后重跑构建即可全站生效。

**改法一（推荐：改默认值，长期稳定）**：把 `build.js` 第 16 行的 `"https://wordage.fyi"` 直接改成你的域名，再重跑构建。

**改法二（临时/CI：环境变量，不改源码）**：
```bash
SITE_ORIGIN=https://你的域名 node build.js
```

**改完如何验证**：
```bash
node build.js
node test/data.mjs                                   # 仍须 ALL GREEN
grep -c "你的域名" sitemap.xml                       # 应等于 502
grep "canonical" words/nice.html                     # href 应是 https://你的域名/words/nice.html
grep "og:url\|canonical\|data-site" index.html       # 三处都应是你的新域名
grep "Sitemap" robots.txt                            # 应指向 https://你的域名/sitemap.xml
```
全站搜一遍旧域名，确认无残留：
```bash
grep -rn "wordage.fyi" index.html words/ sitemap.xml robots.txt build.js
# 若还有输出，逐个改掉
```

> AdSense 相关的 `ads.txt` 与广告单元不在“域名必改”里，见 §8。

---

## 4. 部署（主链路，≥2 方案，主推 Cloudflare Pages）

本项目是静态站，用静态托管方案。**主推方案 A（Cloudflare Pages）**：免费额度足、全球 CDN、自动 HTTPS、对 monorepo 子目录支持好。下面每个方案都给完整、可照抄的步骤与配置全文。

> 部署内容始终是**项目目录 `projects/word-age/` 的内容作为站点根**。因为这是 monorepo，务必把“根目录/子目录/输出目录”填对，否则会把整个 monorepo 顶层当站点根，导致 404。

### 方案 A（主推）：Cloudflare Pages

#### 路线①：连 Git（网页操作，推送即自动部署）

1. 先把代码推到 GitHub（若还没推）：
   ```bash
   # 在仓库根：
   git add -A && git commit -m "word-age: ready to deploy"
   git push origin main
   ```
2. 登录 Cloudflare Dashboard → 左侧 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
3. 授权并选择你的 `claude-test` 仓库，分支选 `main`。
4. 在 **Build settings** 里按 monorepo 子目录**精确填写**：
   - **Framework preset**：`None`
   - **Root directory**（关键）：`projects/word-age`
   - **Build command**：`node build.js`
   - **Build output directory**：`.`（Root directory 已定位到 `projects/word-age`，输出就是该目录本身；构建会把 `words/`、`sitemap.xml`、`robots.txt` 就地重建）
     - 若平台不接受 `.`，退而把 Root directory 留空、Build command 填 `node projects/word-age/build.js`、Output directory 填 `projects/word-age`。
5. 点击 **Save and Deploy**。首次构建日志里应看到 `built 500 word pages + catalogue`。
6. 部署完成后会给一个 `*.pages.dev` 预览域名，打开确认主页 / `/words/nice.html` / `/sitemap.xml` 都 200。
7. 绑定自定义域见 §5。

> 之后每次 `git push` 到 `main`，Cloudflare 自动重跑 `node build.js` 并发布。

#### 路线②：命令行 wrangler 直传（不连 Git，先本地构建再上传）

```bash
# 装 wrangler（全局）
npm i -g wrangler

# 在项目目录 projects/word-age/ 下，先本地构建：
node build.js

# 首次会提示浏览器登录 Cloudflare
wrangler login

# 直传当前目录（站点根就是 . ）
wrangler pages deploy . --project-name=word-age
```
期望输出末尾给出一个 `https://word-age.pages.dev` 地址，打开确认。之后每次改动重跑 `node build.js && wrangler pages deploy . --project-name=word-age` 即可。

### 方案 B：Vercel 或 Netlify

#### B-1 Vercel

在**项目目录 `projects/word-age/`** 放一个 `vercel.json`（完整文件内容，路径：`projects/word-age/vercel.json`）：
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "node build.js",
  "outputDirectory": ".",
  "cleanUrls": false,
  "trailingSlash": false,
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
      "source": "/sitemap.xml",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=86400" }
      ]
    }
  ]
}
```
命令行部署：
```bash
npm i -g vercel
cd projects/word-age
vercel            # 首次交互式登录+建项目；Root Directory 选 projects/word-age
vercel --prod     # 正式发布
```
若走 Vercel 网页连 Git：**Root Directory** 填 `projects/word-age`，**Build Command** 填 `node build.js`，**Output Directory** 填 `.`。

#### B-2 Netlify

在**项目目录**放 `netlify.toml`（完整文件内容，路径：`projects/word-age/netlify.toml`）：
```toml
[build]
  base    = "projects/word-age"
  command = "node build.js"
  publish = "."

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

[[headers]]
  for = "/sitemap.xml"
  [headers.values]
    Cache-Control = "public, max-age=86400"
```
命令行部署：
```bash
npm i -g netlify-cli
cd projects/word-age
node build.js
netlify deploy            # 预览
netlify deploy --prod     # 正式
```

### 方案 C：GitHub Pages（用 Actions 构建）

因为需要跑 `node build.js`，用 GitHub Actions 构建后发布。新建文件（完整内容，路径相对仓库根：`.github/workflows/deploy.yml`）：
```yaml
name: Deploy Word Age to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - "projects/word-age/**"
      - ".github/workflows/deploy.yml"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Build static site
        working-directory: projects/word-age
        run: node build.js
        # 换域名可加： env: { SITE_ORIGIN: "https://你的域名" }

      - name: Sanity test (no browser)
        working-directory: projects/word-age
        run: node test/data.mjs

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: projects/word-age

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```
然后在 GitHub 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。推送到 `main` 即触发。

> GitHub Pages 子目录/根域坑：本站页面用的是相对路径（`href="../style.css"`、`href="words/index.html"`），因此把 `projects/word-age` 作为整个 artifact 根发布即可正常工作。若你把站点部署在 `用户名.github.io/仓库名/` 这种**子路径**下，主页与词页仍能互跳（相对路径），但 `sitemap.xml` / canonical 里的绝对 URL 由 `SITE` 决定——务必让 `SITE` 与真实访问 URL 一致（推荐直接绑自定义域，见 §5，避免子路径）。

### 方案 D（可选）：自建 Nginx

把项目目录内容传到服务器（例如 `/var/www/word-age/`），先在服务器或本地 `node build.js` 生成产物。Nginx server 块（完整内容，路径：`/etc/nginx/sites-available/word-age`，然后 `ln -s` 到 `sites-enabled/`）：
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name wordage.fyi www.wordage.fyi;   # 换成你的域名

    root /var/www/word-age;
    index index.html;

    # HTML / 主页：每日题与逻辑常更新，即时回源
    location = / {
        add_header Cache-Control "no-cache, must-revalidate";
    }
    location ~* \.html$ {
        add_header Cache-Control "no-cache, must-revalidate";
    }

    # CSS/JS：未做文件名指纹，勿超长缓存
    location ~* \.(css|js)$ {
        add_header Cache-Control "public, max-age=3600";
    }

    # sitemap / robots
    location = /sitemap.xml { add_header Cache-Control "public, max-age=86400"; }
    location = /robots.txt  { add_header Cache-Control "public, max-age=86400"; }

    location / {
        try_files $uri $uri/ =404;
    }
}
```
启用并签 HTTPS（见 §5 certbot）：
```bash
sudo ln -s /etc/nginx/sites-available/word-age /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. 自定义域名 + DNS + HTTPS

### 5.1 买域名

在 Cloudflare Registrar / Namecheap / Porkbun 等注册 `wordage.fyi` 或你自己的域名。买完先别急着配，先决定用哪个托管平台（下面按平台给 DNS）。

### 5.2 各平台绑定域名

- **Cloudflare Pages**：项目 → **Custom domains** → **Set up a domain** → 输入你的域名。若域名也托管在 Cloudflare，DNS 记录会自动创建（CNAME 到 `*.pages.dev`），HTTPS 自动签发，通常几分钟内生效。
- **Vercel**：项目 → **Settings → Domains** → 添加域名，按提示加 DNS 记录。
- **Netlify**：**Domain settings → Add custom domain**，按提示加记录。
- **GitHub Pages**：**Settings → Pages → Custom domain** 填域名（会在仓库生成 `CNAME` 文件），勾选 **Enforce HTTPS**。

### 5.3 DNS 记录表（按平台给真实值）

| 平台 | 类型 | 主机名 | 值 | 说明 |
|---|---|---|---|---|
| **Cloudflare Pages** | CNAME | `@`（根域）/ `www` | `<项目名>.pages.dev` | 同 Cloudflare 内一键代理，自动 |
| **Vercel** | A | `@` | `76.76.21.21` | 根域 A 记录 |
| **Vercel** | CNAME | `www` | `cname.vercel-dns.com` | www 子域 |
| **Netlify** | CNAME | `www` | `<站点名>.netlify.app` | www 子域；根域用 Netlify DNS 或 ALIAS |
| **GitHub Pages** | A | `@` | `185.199.108.153` | 根域 4 条 A 之一 |
| **GitHub Pages** | A | `@` | `185.199.109.153` | 根域 4 条 A 之一 |
| **GitHub Pages** | A | `@` | `185.199.110.153` | 根域 4 条 A 之一 |
| **GitHub Pages** | A | `@` | `185.199.111.153` | 根域 4 条 A 之一 |
| **GitHub Pages** | CNAME | `www` | `<你的用户名>.github.io` | www 子域 |

> 只用其中**一个平台对应的那几行**。GitHub Pages 根域需要 4 条 A 记录全加；www 用 CNAME。

### 5.4 HTTPS 自动签发

- Cloudflare Pages / Vercel / Netlify / GitHub Pages 均**自动签发并续期** Let's Encrypt 证书，你无需手动操作，绑定域名后等几分钟到数十分钟即可 `https://` 访问。
- **自建 Nginx** 用 certbot 手动签：
  ```bash
  sudo apt-get install -y certbot python3-certbot-nginx
  sudo certbot --nginx -d wordage.fyi -d www.wordage.fyi
  # 按提示选择自动把 http 跳转到 https；证书自动续期由 certbot.timer 负责
  sudo certbot renew --dry-run   # 验证续期可用
  ```

### 5.5 强制 HTTPS

本站的出生证明分享卡会被人在各类内嵌浏览器（微信/微博/Telegram 内打开）访问，且 `og:url` / canonical 全是 `https://`。务必**只对外暴露 https**（各平台默认强制跳转；Nginx 用 certbot 自动加的 301）。混合内容会导致部分 App 内浏览器拒绝加载。

---

## 6. 缓存策略（可照抄的配置全文）

**目标头**：

- **HTML（含主页与所有词页）**：`no-cache, must-revalidate` —— Word of the Day 按本地日期换、逻辑常更新、补词后词页内容会变，必须即时回源，避免用户看到旧题/旧内容。
- **CSS / JS**：`max-age=3600`（1 小时）—— 本站**未做文件名指纹**（引用的是固定的 `style.css` / `app.js` / `lib.js` / `data.js`），若超长缓存，改了逻辑用户长时间拿不到新版。除非你先把引用改成带版本的名字（如 `app.v2.js`），否则**不要**设超长 `max-age`/`immutable`。
- **图片 / OG 图**：`max-age=86400`（1 天）。本站 OG 用的是 `twitter:card` summary（无独立大图文件），故此项主要留给未来你加的静态图；`sitemap.xml` / `robots.txt` 也按 1 天。

**Cloudflare Pages / Netlify 用 `_headers`**（完整文件内容，放在**站点根**，即项目目录 `projects/word-age/_headers`）：
```
/*.html
  Cache-Control: no-cache, must-revalidate

/
  Cache-Control: no-cache, must-revalidate

/words/*
  Cache-Control: no-cache, must-revalidate

/*.css
  Cache-Control: public, max-age=3600

/*.js
  Cache-Control: public, max-age=3600

/sitemap.xml
  Cache-Control: public, max-age=86400

/robots.txt
  Cache-Control: public, max-age=86400
```
> `/words/*` 覆盖所有词页（它们是 `.html`，也被上面 `/*.html` 命中，这里显式再写一遍求稳）。放好后 `_headers` 会随站点一起部署，无需额外配置。

**Vercel**：见 §4 方案 B-1 的 `vercel.json` `headers` 段（已含上述四类头，直接用那份全文）。

**Nginx**：见 §4 方案 D server 块里的 `location ~* \.html$` / `\.(css|js)$` / `sitemap.xml` 各段（已按上述目标头写好）。

---

## 7. SEO 上线（本站重点）

### 7.1 robots.txt / sitemap.xml

二者均由 `build.js` 生成，无需手写。上线后确认可访问且 200：
```bash
curl -sI https://你的域名/robots.txt   | head -1   # 期望 HTTP/2 200
curl -sI https://你的域名/sitemap.xml  | head -1   # 期望 HTTP/2 200
```
`robots.txt` 现内容：
```
User-agent: *
Allow: /

Sitemap: https://wordage.fyi/sitemap.xml
```
（换域名后 `Sitemap:` 那行会自动变成你的域名——前提是你已按 §3 改了 `SITE` 并重跑构建。）`sitemap.xml` 应含 502 个 `<loc>`（主页 + 目录 + 500 词页）。

### 7.2 Google Search Console（上线当天）

1. 打开 [Google Search Console](https://search.google.com/search-console) → **添加资源**。
   - 选 **域名资源**（`你的域名`）→ 用 **DNS TXT 记录**验证（把 GSC 给的 TXT 值加到域名 DNS）；
   - 或选 **URL 前缀资源**（`https://你的域名/`）→ 用 **HTML 标签**验证：把 GSC 给的 `<meta name="google-site-verification" ...>` 加到 `index.html` 的 `<head>` 里（`<link rel="stylesheet">` 之前任意位置），重新部署。
2. 左侧 **Sitemaps** → 输入 `sitemap.xml` → 提交。等待状态 **成功**、发现约 **502** 个 URL。
3. **网址检查**工具手动请求编入索引：主页 + `nice` / `silly` / `ok`（若已收） / `robot` / `quarantine` 等 10 个头部词页，加速首批收录。
4. 第 2–4 周每周看 **效果 → 查询**：把“有曝光但排名 8–20 名”的查询记下来，优先加长该词条内容或建合辑页（打法见 `MARKETING.md §一`）。

### 7.3 Bing Webmaster Tools

打开 [Bing Webmaster Tools](https://www.bing.com/webmasters) → **导入 GSC 配置**（一键，无需重新验证）→ 确认 sitemap 已带入。DuckDuckGo / Brave 吃 Bing 索引，等于三送一。

### 7.4 OG 卡调试

用各家调试器抓一次，确认卡片标题/描述正确（本站是 `summary` 卡，无大图）：
- Facebook Sharing Debugger：`https://developers.facebook.com/tools/debug/`（输入 `https://你的域名/words/nice.html`，点 **Scrape Again** 强刷缓存）
- X/Twitter：直接在草稿里贴链接预览
- Telegram：把链接发到“Saved Messages”看卡片

> OG 平台会缓存首次抓取结果，改了 `og:*` 后**必须在调试器里强制重抓**才会刷新（见 §11）。

---

## 8. 变现挂点激活

站内已预留广告位/联盟位，均为极简“house ad”，不破坏活版印刷版式。**流量起来（日 PV 稳定 300+）再申请 AdSense**，否则过审率与收益都差。

### 8.1 预留广告位的确切位置

- **主页**：`index.html` 第 105–108 行，`<!-- Ad slot ... -->` 注释后的：
  ```html
  <aside class="ad" aria-label="sponsor">
    <span class="label">A word from the press</span>
    <p>Word Age is free and carries no tracking. ...</p>
  </aside>
  ```
- **每个词页**：模板在 `build.js` 的 `wordPage()` 函数第 106–110 行（`<!-- Ad slot: see DEPLOY.md ... -->` 后的 `<aside class="ad" aria-label="sponsor">`）。**改这一处 = 全部 500 个词页生效**（改完必须 `node build.js` 重建）。

### 8.2 AdSense 激活步骤

1. AdSense 后台 **添加站点** → 通过审核（500 页原创内容站，过审率高；先确保有真实流量）。
2. 关掉 **Auto ads**（自动广告会毁掉本站排版——排版是产品的一部分），只用手动 **展示广告单元**。
3. 把上面两处 `<aside class="ad">` 的**内部**替换为你的 AdSense 响应式广告单元代码（保留外层 `<aside class="ad">` 以维持样式与间距）：
   - 主页改 `index.html` 那一处；
   - 词页改 `build.js` 模板那一处，然后 `node build.js` 让全站词页生效。
4. **每页只保留这一个广告位**——词页价值在长尾复利，广告密度低才留得住 SEO 排名。
5. 把 AdSense 后台给你的 `ads.txt` 放到**站点根**（项目目录 `projects/word-age/ads.txt`）。示例格式（把发布商 ID 换成你自己的）：
   ```
   google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0
   ```
   上线后确认 `curl -sI https://你的域名/ads.txt | head -1` 返回 200。

### 8.3 联盟变现（本站收入主力）

查词源的人 = 英语学习者/爱好者，教育联盟转化意图明确、单价远高于展示广告。按 `MARKETING.md §三` 挂：

- 词典 App（Merriam-Webster Premium / 牛津订阅经销）→ 词页 **Marginalia** 下一行字；
- 背单词/词汇课（Vocabulary.com / Membean / italki）→ 主页 **Method** 节下 + 合辑页尾；
- 亚马逊联盟词源书 → 词页/合辑页底部 “further reading”。

规则：每页**最多一个联盟位**，永远晚于内容出现，加 `rel="sponsored"`，文案保持站内“干燥”性格（不用 “BEST DEAL”），**联盟位与广告位不要同屏堆叠**。

### 8.4 小游戏变现

**本项目不涉及。**

---

## 9. 上线后自检清单

上线后逐项打勾：

- [ ] 主页 `https://你的域名/` 返回 200，搜索可用、Word of the Day 有词
- [ ] `https://你的域名/words/nice.html`、`/words/index.html`、`/sitemap.xml`、`/robots.txt` 全 200
- [ ] `https://` 与 `www` 都能访问（且统一 301 到规范域）
- [ ] 真机 iOS Safari + Android Chrome 各开一次：375px 无横向滚动、搜索可用、“保存出生证明”能出图
- [ ] OG 卡：在 Facebook 调试器 + Telegram 各贴一次 `/words/nice.html`，标题/描述正确
- [ ] 跨时区/跨午夜：换设备时区或等过 0 点，Word of the Day 按本地日期换题且当天稳定
- [ ] `?q=fun` 深链直接渲染结果；查无此词（如 `qzzxy`）给出 3 个最近建议
- [ ] Lighthouse 移动端 Performance ≥ 95（纯静态、<150KB，应轻松达标）
- [ ] `node test/data.mjs` 在本地对**已部署内容**对应的构建产物仍 ALL GREEN

**后端 / 小游戏相关自检项**：本项目不涉及。

---

## 10. 持续更新与运维

### 10.1 每周补词的确切流程

1. 在 `data.js` 对应年代分组里加一行（行格式见文件头注释）：
   ```
   ["word", 年份数字, "显示年份", "原义", "语义变迁一句(>20字符)", "o"]
   ```
   （`verdict` 用 `"o"`=older / `"y"`=younger；`display` 是诚实字符串如 `"c. 1300"` / `"Old English"` / `"1839"`。）有冷知识就在 `funfacts.js` 加一条（key 必须是已存在的词）。
2. 重建：
   ```bash
   cd projects/word-age
   node build.js          # 期望：built 501 word pages ...（词数+1）
   ```
3. 跑测试（必须 ALL GREEN，尤其 **<150KB 红线**）：
   ```bash
   node test/data.mjs
   # 若报 homepage payload >= 150KB：精简 shift 文案，或把低价值词移出主包
   ```
4. 部署：连 Git 的平台直接 `git push`（自动重跑构建）；wrangler/CLI 平台重跑 `node build.js && wrangler pages deploy . --project-name=word-age`。
5. 新页会随 `sitemap.xml` 的新 `lastmod` 被搜索引擎再抓取。

### 10.2 注意事项

- **别手改 `words/*.html`**：它们是构建产物，下次 `node build.js` 会被整体删除重建。要改词页样式/结构，改 `build.js` 的 `wordPage()` 模板。
- 全站无 cookie、无第三方请求（激活 AdSense 前），隐私声明一句话即可。
- 备份 / 日志 / 监控 / 回滚：静态站无状态，回滚 = 在托管平台“回退到上一次部署”（Cloudflare Pages / Vercel / Netlify 都在部署列表里一键 rollback）；GitHub Pages 则 `git revert` 后 push。

---

## 11. 故障排查表

| 症状 | 可能原因 | 解决 |
|---|---|---|
| 部署后整站 404 / 只看到 monorepo 顶层 | Root/Output 目录没指到 `projects/word-age` | 按 §4 各平台“确切填法”重设 Root directory = `projects/word-age` |
| 词页里 CSS/图片丢失、样式全无 | 部署在子路径（`用户名.github.io/仓库名/`）下相对路径错位 | 绑自定义域到站点根（§5），或确保 artifact 根就是 `projects/word-age` |
| canonical / sitemap 里还是 `wordage.fyi` | 改了 `index.html` 但没改 `build.js` 的 `SITE` 并重跑 | 按 §3 改 `SITE` → `node build.js` → `grep` 复查 |
| 改了词条/逻辑，用户仍看旧内容 | CSS/JS 被超长缓存，或 HTML 被缓存 | 确认 §6 头（HTML `no-cache`、JS/CSS `max-age=3600` 且未设 immutable）；必要时把引用改成 `app.v2.js` 再上线 |
| OG 卡片不刷新 | 社交平台缓存了首次抓取 | 在 Facebook/Telegram 调试器点 **Scrape Again** 强制重抓（§7.4） |
| `node test/data.mjs` 报 payload ≥ 150KB | 补词把主包撑过红线 | 精简 `shift` 文案 / 把低价值词移出主包（当前约 144.9KB，余量小） |
| `node test/smoke.mjs` 启动即报找不到 chromium | 硬编码路径 `/opt/pw-browsers/chromium` 在你机器上不存在 | `npx playwright install chromium` 后，把 smoke/qa-extra 里 `executablePath` 那行改为默认 chromium；`data.mjs` 无此依赖，部署前跑它即可 |
| 保存出生证明按钮在某些场景无效 | canvas / clipboard 在个别内嵌浏览器受限 | 属预期降级；核心查词不受影响，真机用系统浏览器验证 |
| Word of the Day “今天没换/换错” | 跨午夜或跨时区，按**本地日期**种子 | 属正常：全球同一本地日期同词；跨 0 点后自动换（`test/data.mjs` 已断言跨午夜确定性） |
| 微信/内嵌浏览器里加载失败 | 混合内容（http 资源） | 确保全站只暴露 https（§5.5），无任何 http 资源引用 |

**后端 SSE / 机器休眠 / TRUST_PROXY / 小游戏震动 等排查项**：本项目不涉及（纯静态、无后端、无小游戏）。

---

*本指南基于对 `projects/word-age/` 源码的实读：`build.js`（`SITE` 常量第 16 行、生成 500 词页 + 目录 + sitemap + robots）、`index.html`（域名标签第 2/8/12/115 行）、`data.js`（500 词 / 30 锚点）、`test/data.mjs`（<150KB 红线、502 URL 断言）。换域名只需改 `build.js` 的 `SITE` 与 `index.html` 四处并重跑 `node build.js`。*
