# At Your Age（同龄羞辱）· 全栈部署详解（从 0 到上线）

> 本指南假设你是全新电脑、什么都没装：没有 Node、没有 Git、没有任何账号。跟着从上到下逐条照抄即可把这个站上线到全球 CDN、绑上自己的域名、开启 HTTPS、提交 SEO、挂上广告。所有涉及源码的常量名 / 行号 / 值都来自本仓库真实文件，不是示意。

本项目目录（相对仓库根）：`projects/at-your-age/`
本项目目录（绝对路径，本机）：`/home/user/claude-test/projects/at-your-age/`

---

## 0. 这是什么 / 架构判定

**产品**：输入出生日期 → 得到精确到天的年龄 → 被告知「在你这个精确年龄，莫扎特已经死了 6 年」（ROAST 面，猩红）。点一下大红开关，180ms 翻绿成 HEAL 面：「在你这个年纪，摩西奶奶还要再等 45 年才拿起画笔」。一暴一治的情绪落差就是全部玩法，也是全部传播机制——每张卡都自带「你也去测测」的钩子。

**数据规模（读源码实测）**：`data.js` 内嵌 **215 条里程碑**（ROAST 110 / HEAL 105），覆盖 **189 位人物**。构建期由 `build.js` 烘焙成 **189 张长尾静态人物页** + 1 张名录页 + sitemap（共 **191 个 URL**）。

**架构判定：纯静态 + 一次性构建（static-build）**。依据：

- 全部逻辑跑在客户端（`app.js`，零依赖、零网络请求，`file://` 直接可开）；数据以 JS 数组内嵌在 `data.js`，没有任何 fetch / 后端 / 数据库。
- `build.js` 只是**构建期**跑一次的 SSG 脚本（Node 内置 `fs`/`path`，无 npm 依赖），把数据烘焙成静态 HTML + sitemap + robots，产物提交到仓库、直接当静态文件托管。
- 没有服务端、没有小游戏容器层。托管成本 ≈ 0（任何静态 CDN 免费额度都够）。
- 硬约束：**单页总重 < 150KB、无外链资源**（字体走系统栈，图标是 inline SVG data-URI）。

**文件清单**（逐个真实文件；「是否上传到生产」指托管到线上的静态资源）：

| 文件 / 目录 | 作用 | 是否需上传到生产 |
|---|---|---|
| `index.html` | 首页（gate 输入 + result 判词 + 分享 + adslot） | ✅ 必须 |
| `style.css` | 首页样式（瑞士编辑风，人物页样式另内联在 build.js） | ✅ 必须 |
| `app.js` | 客户端引擎：年龄计算、判词模板、翻转、another one、分享卡 canvas | ✅ 必须 |
| `data.js` | 唯一数据源：215 条里程碑 + `AYA_DOMAIN` 常量；浏览器与 Node 双用 | ✅ 必须 |
| `people/` | 构建产物：189 张 `<slug>.html` + `index.html` 名录 | ✅ 必须（重跑 build.js 重生成） |
| `sitemap.xml` | 构建产物：191 个 URL 的站点地图 | ✅ 必须 |
| `robots.txt` | 构建产物：`Allow: /` + Sitemap 指向 | ✅ 必须 |
| `build.js` | SSG 构建脚本（Node，无依赖） | ⭕ 建议上传（CI 需要）；纯静态托管可不传 |
| `test/data.mjs` | 数据 + 产物完整性校验（无浏览器） | ❌ 不上传 |
| `test/smoke.mjs` | Playwright 冒烟测试 | ❌ 不上传 |
| `test/qa-extra.mjs` | Playwright 对抗性 QA（年龄精度 / 语法 / 卡面像素色） | ❌ 不上传 |
| `test/screenshots/` | 测试截图输出 | ❌ 不上传 |
| `DESCRIPTION.md` / `PLAYBOOK.md` / `MARKETING.md` / `DEPLOY.md` | 产品 / 运营 / 旧部署文档 | ❌ 不上传 |
| `DEPLOY-FULL.md` | 本文件 | ❌ 不上传 |

> 注意：仓库里**目前没有 `package.json`**。构建与测试都用 `node xxx` 直接跑；只有需要 `npm i` 装 Playwright 或部分平台强制要 `package.json` 时才新建（§4 会给全文）。

---

## 1. 从零准备环境

### 1.1 安装 Node.js（需要 LTS ≥ 18；本仓库实测在 v22 上跑）

选你的系统，三选一：

**macOS**（推荐 nvm，可多版本切换）：
```bash
# 方式一：Homebrew（先装 brew: https://brew.sh）
brew install node

# 方式二：nvm（更灵活）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# 重开终端后：
nvm install --lts
nvm use --lts
```

**Windows**（PowerShell，用 winget）：
```powershell
winget install OpenJS.NodeJS.LTS
# 重开 PowerShell 生效
```

**Linux**（nvm 通用；或 NodeSource apt 源）：
```bash
# 方式一：nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install --lts && nvm use --lts

# 方式二：NodeSource（Debian/Ubuntu，需 sudo）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**验证**（两条都要有版本号，v 后数字 ≥ 18）：
```bash
node -v
# 期望类似：v22.22.2
npm -v
# 期望类似：10.9.x
```

### 1.2 安装并配置 Git

- macOS：`brew install git`（或装 Xcode Command Line Tools：`xcode-select --install`）
- Windows：`winget install Git.Git`
- Linux：`sudo apt-get install -y git`

配置身份（提交历史会用到，填你自己的）：
```bash
git config --global user.name "Your Name"
git config --global user.email "ericgu050714@gmail.com"
git config --global init.defaultBranch main
```
验证：
```bash
git --version
# 期望类似：git version 2.43.0
```

### 1.3 需要注册的账号

逐个来，用途 + 是否免费：

| 账号 | 用途 | 是否免费 |
|---|---|---|
| **GitHub**（github.com） | 存代码、CI 构建、可选用 GitHub Pages 托管 | 免费 |
| **Cloudflare**（dash.cloudflare.com） | 主推托管平台（Cloudflare Pages）+ 全球 CDN + DNS | 免费额度足够 |
| 备选：Vercel / Netlify | 备用托管方案（§4 方案 B） | 免费额度足够 |
| **域名注册商**（Cloudflare Registrar / Namecheap / Porkbun 等） | 买 `atyourage.fyi` 或你自己的域名 | 域名年费（`.fyi` 约 $5–20/年） |
| **Google Search Console**（search.google.com/search-console） | 提交 sitemap、看搜索表现 | 免费 |
| **Bing Webmaster Tools**（bing.com/webmasters） | 提交 sitemap（可从 GSC 一键导入） | 免费 |
| **Google AdSense**（adsense.google.com） | 变现（需正式域名 + 真实流量，见 §8） | 免费申请，按分成 |

本项目**不涉及**：后端平台（Fly/Railway/VPS）、微信/抖音开放平台——纯静态站用不到。

### 1.4 取得代码

这是 monorepo，本项目在子目录 `projects/at-your-age/`。

```bash
# 克隆整个仓库（把 <仓库地址> 换成真实的 git 地址）
git clone <仓库地址>
cd <仓库名>/projects/at-your-age
# 绝对路径示例（本机）：
#   cd /home/user/claude-test/projects/at-your-age
pwd
# 期望结尾：.../projects/at-your-age
```

> 只想拿本项目、不想拉全仓库历史？用 sparse-checkout：
> ```bash
> git clone --filter=blob:none --sparse <仓库地址>
> cd <仓库名>
> git sparse-checkout set projects/at-your-age
> cd projects/at-your-age
> ```

---

## 2. 本地运行与自验

以下命令默认 **cwd = 项目目录** `projects/at-your-age/`（除非注明「从仓库根」）。

### 2.1 直接用浏览器打开（file://）

直接双击 `index.html`，或：
```bash
# macOS
open index.html
# Linux
xdg-open index.html
# Windows
start index.html
```
**能玩到**：输入生日 → 精确年龄 → ROAST/HEAL 判词 → 翻转 → another one → Save card（下载 PNG）。
**不能玩到 / 有降级**：Copy 按钮在 `file://` 下没有 clipboard 权限，会退化成「Select & copy」提示（这是预期，`app.js:434` 有 fallback 分支，`https` 下正常）。

### 2.2 起本地静态服务器（更接近生产，路径行为一致）

任选一：
```bash
# 方式一：Node（无需预装，npx 现拉）
npx serve .
# 访问：http://localhost:3000

# 方式二：Python 自带
python3 -m http.server 8000
# 访问：http://localhost:8000
```

### 2.3 构建：`node build.js`（这是「build 项目」的核心）

```bash
node build.js
```
**期望输出**（数字应与源码一致）：
```
build: 189 person pages + ledger, sitemap with 191 urls, 215 milestones.
```
**生成 / 覆盖的产物**：
- `people/<slug>.html` ×189（先清空目录内旧 `.html` 再重写，见 `build.js:171-177`）
- `people/index.html`（名录页）
- `sitemap.xml`（首页 + 名录 + 189 人物页 = 191 URL，`lastmod` = 今天）
- `robots.txt`（`User-agent: * / Allow: / / Sitemap: https://<域名>/sitemap.xml`）

**如何验证**：起服务器后打开任意一张生成页看是否 200，例如：
```bash
npx serve . &
curl -sI http://localhost:3000/people/wolfgang-amadeus-mozart.html | head -1
# 期望：HTTP/1.1 200 OK
```
或浏览器访问 `http://localhost:3000/people/index.html` 看到名录，随便点一个人名进人物页。

### 2.4 后端 / 小游戏

**本项目不涉及**：没有 `server.mjs`、没有 SSE、没有 `wechat-minigame/`。纯静态站，跳过。

### 2.5 运行自带测试

三个测试文件，两类：

**(a) 数据 + 产物校验（无浏览器，随时能跑）**：
```bash
# 从项目目录：
node test/data.mjs
# 或从仓库根：
node projects/at-your-age/test/data.mjs
```
它会校验 `MILESTONES` 数组结构、`DOMAIN` 格式、并实跑 build 验证产物一致性。期望：无 `FAIL:` 行、退出码 0。

**(b) Playwright 冒烟 + 对抗 QA（需要 Chromium）**：
这两个用 `import { chromium } from "playwright"`。`test/smoke.mjs:30` 硬编码了本仓库的浏览器路径 `/opt/pw-browsers/chromium`。

- 在**本仓库容器**里：浏览器已在 `/opt/pw-browsers/chromium`，且需要 `playwright` 包可被 import。若报 `Cannot find package 'playwright'`，先装：
  ```bash
  npm i -D playwright        # 会就地生成 package.json / node_modules
  ```
- 在**一般机器**上：需自己装 Chromium，并可能要改掉那行硬编码路径：
  ```bash
  npm i -D playwright
  npx playwright install chromium
  ```
  然后把 `test/smoke.mjs:30` 与 `test/qa-extra.mjs` 里的 `chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })` 改为 `chromium.launch()`（用 Playwright 自管的浏览器）。

运行（从仓库根，测试内部用 `file://` 打开 index.html）：
```bash
node projects/at-your-age/test/smoke.mjs
node projects/at-your-age/test/qa-extra.mjs
```
**期望结尾**：
```
smoke.mjs: all checks passed.
```
（每条前缀 `  ok  `；出现任何 `  FAIL  ` 则退出码 1。）

---

## 3. 上线前必改（精确到文件 + 常量 / 行）

占位域名是 `atyourage.fyi`。若你用**别的**域名，按下表改；**若你就是要用 `atyourage.fyi`，本节可跳过、直接去 §4**。所有值均从源码读出、附行号。

| 文件 | 位置（常量名 / 行号 / 选择器） | 现值 | 改成 |
|---|---|---|---|
| `data.js` | 第 236 行 `const AYA_DOMAIN` | `"atyourage.fyi"` | `"你的域名"`（不带协议、不带斜杠） |
| `index.html` | 第 11 行 `<meta property="og:url">` | `https://atyourage.fyi/` | `https://你的域名/` |
| `index.html` | 第 13 行 `<link rel="canonical">` | `https://atyourage.fyi/` | `https://你的域名/` |

**关键联动（不用手改、但要知道）**：

- `build.js:9` 从 `data.js` 读 `DOMAIN`，`build.js:11` 派生 `BASE_URL = "https://" + DOMAIN`。所以人物页的 `canonical`/`og:url`、`sitemap.xml`、`robots.txt` 的域名**全部随 `AYA_DOMAIN` 自动更新**——不需要单独改 build.js。
- `app.js:8` 也从 `data.js` 读 `AYA_DOMAIN`（`app.js:314` 分享文本、`app.js:397` 分享卡底部域名脚注都用它）——所以分享卡 / 分享文本的域名也自动跟着 `AYA_DOMAIN` 走。

> 一句话：**域名的单一事实源是 `data.js:236`**；`index.html` 的 og:url / canonical 是 HTML 静态文本、build 碰不到，所以那两处必须手改。

**改完必须重跑构建**（否则 189 张人物页 / sitemap / robots 里还是旧域名）：
```bash
node build.js
```

**改完如何验证**：
```bash
# 1) 首页两处已换：
grep -n "og:url\|canonical" index.html
# 2) 产物已换域名（应打印你的新域名，且行数 = 191 sitemap 条目附近）：
grep -c "你的域名" sitemap.xml
grep "Sitemap:" robots.txt
grep "canonical" people/wolfgang-amadeus-mozart.html
# 3) 回归测试：
node test/data.mjs   # 期望无 FAIL
```

---

## 4. 部署（主链路，≥2 方案，主推方案 A）

> 无论哪个方案，**先在本地跑一次 `node build.js` 并把产物提交**（`people/`、`sitemap.xml`、`robots.txt` 都是要上线的静态文件）。

### 方案 A（主推）· Cloudflare Pages

慷慨免费额度 + 自带全球 CDN + 与自家 DNS 无缝。两条路线任选。

#### 路线① 连 Git 自动构建（推荐，push 即部署）

1. 登录 https://dash.cloudflare.com → 左侧 **Workers & Pages** → **Create** → **Pages** 选项卡 → **Connect to Git**。
2. 授权 GitHub → 选中你的仓库。
3. 在 **Set up builds and deployments** 里，因为项目在 monorepo 子目录，**确切填法**：
   - **Production branch**：`main`
   - **Framework preset**：`None`
   - **Root directory (advanced)** → 填 `projects/at-your-age`（关键：把构建上下文切到子目录）
   - **Build command**：`node build.js`
   - **Build output directory**：`.`（构建产物就地生成在项目目录，不是单独的 dist；填一个点表示「就用 Root directory 本身」）
4. **Save and Deploy**。首次构建日志里应出现 `build: 189 person pages + ledger, sitemap with 191 urls, 215 milestones.`
5. 部署完给你一个 `xxx.pages.dev` 临时域名，打开自测。

> 若 Cloudflare 不允许 Build output 填 `.`，改为让 build 输出到子目录：把 Build command 改成 `node build.js && mkdir -p dist && cp -r index.html style.css app.js data.js people robots.txt sitemap.xml dist/`，Build output directory 填 `dist`。（能填 `.` 就别绕这一步。）

#### 路线② 命令行 wrangler 直传（无需连 Git，适合手动发布）

```bash
npm i -g wrangler
wrangler login                     # 浏览器授权一次
cd projects/at-your-age
node build.js                      # 先本地构建出产物
wrangler pages deploy . --project-name=at-your-age
```
`wrangler` 会把当前目录整包上传到 Pages。**注意**：它会连 `test/`、`*.md` 一起传，无害但可清理——可先 `cp` 出一个纯净目录再 deploy：
```bash
node build.js
rm -rf /tmp/aya-dist && mkdir -p /tmp/aya-dist
cp -r index.html style.css app.js data.js people robots.txt sitemap.xml /tmp/aya-dist/
wrangler pages deploy /tmp/aya-dist --project-name=at-your-age
```

### 方案 B · Vercel（或 Netlify）

**Vercel（命令行）**：
```bash
npm i -g vercel
cd projects/at-your-age
vercel            # 首次：登录 + 关联项目，Framework 选 Other
vercel --prod     # 正式发布
```
在 Vercel 项目设置里：**Framework Preset = Other**，**Build Command = `node build.js`**，**Output Directory = `.`**，**Root Directory = `projects/at-your-age`**（连 Git 时在 Settings → General 填）。

若想用配置文件锁定（放在**项目目录** `projects/at-your-age/vercel.json`，完整文件）：
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
    }
  ]
}
```

**Netlify（配置文件）**：放在**项目目录** `projects/at-your-age/netlify.toml`（完整文件）：
```toml
[build]
  command = "node build.js"
  publish = "."

[build.environment]
  NODE_VERSION = "22"

# 缓存头见 §6 的 _headers 文件（Netlify 也读根目录 _headers）
```
连 Git 时在 Netlify 站点设置里把 **Base directory** 设为 `projects/at-your-age`。

### 方案 C · GitHub Pages（用 Actions 构建，因为本项目需要跑 build.js）

因为要跑 `node build.js`，用「Deploy from branch」不方便，用官方 Pages Actions。

先在 GitHub 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。

新建文件（放在**仓库根** `.github/workflows/deploy.yml`，完整文件）：
```yaml
name: Deploy At Your Age to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - "projects/at-your-age/**"
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
    defaults:
      run:
        working-directory: projects/at-your-age
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Build static site
        run: node build.js

      - name: Data integrity test
        run: node test/data.mjs

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: projects/at-your-age

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

**GitHub Pages 子目录路径坑（重要）**：若不绑自定义域，站点 URL 会是 `https://<user>.github.io/<repo>/`，带路径前缀。本项目内部链接都是**相对路径**（人物页 `../index.html`、名录 `index.html`），相对链接不受前缀影响、能正常跳；但 `index.html` 的 `canonical`/`og:url` 和 sitemap 里的绝对 URL 仍写着你的域名，会与实际 URL 不一致——**所以 GitHub Pages 强烈建议绑自定义域**（§5），让实际 URL = canonical。绑域名时，若走 Actions 部署，需在 build 产物里放一个 `CNAME` 文件（build.js 当前不生成它），在上面 workflow 的 build 步骤后加一行：
```yaml
      - name: Add CNAME for custom domain
        run: echo "你的域名" > projects/at-your-age/CNAME
```

### 方案 D（可选）· 自建 Nginx

把构建后的整目录 `rsync` 到服务器 `/var/www/atyourage/`，Nginx server 块（放 `/etc/nginx/sites-available/atyourage`，完整文件）：
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name 你的域名 www.你的域名;

    root /var/www/atyourage;
    index index.html;

    gzip on;
    gzip_types text/html text/css application/javascript application/xml;

    # HTML：每次回源校验（每日判词/数据常更新）
    location ~* \.html$ {
        add_header Cache-Control "no-cache, must-revalidate";
    }
    location = / {
        add_header Cache-Control "no-cache, must-revalidate";
    }
    # CSS/JS：1 小时（未做文件名指纹，勿超长缓存）
    location ~* \.(css|js)$ {
        add_header Cache-Control "public, max-age=3600";
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
```
启用 + HTTPS：
```bash
sudo ln -s /etc/nginx/sites-available/atyourage /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名 -d www.你的域名
```

> 本项目**不涉及**后端方案（Fly.io / Railway / systemd 服务进程 / SSE 反代 / history.jsonl 备份）与小游戏发布流程——纯静态站，没有服务端进程或小游戏包。

---

## 5. 自定义域名 + DNS + HTTPS

### 5.1 买域名

在注册商买 `atyourage.fyi`（或你的域名）。若域名和托管都在 Cloudflare，DNS 全自动、最省事。

### 5.2 各平台绑定 + DNS 记录

**Cloudflare Pages**（方案 A）：项目 → **Custom domains** → **Set up a custom domain** → 输入域名。若域名托管在 Cloudflare，记录自动写入；否则按提示加 CNAME。HTTPS 证书自动签发。

**Vercel**：项目 → Settings → Domains → 加域名，按提示配 DNS。

**GitHub Pages**：仓库 Settings → Pages → Custom domain 填域名（同时保证产物里有 `CNAME` 文件，见 §4 方案 C）。

DNS 记录表（按你选的平台取用真实值）：

| 平台 | 类型 | 主机名 | 值 | 说明 |
|---|---|---|---|---|
| Cloudflare Pages | CNAME | `@`（根）/ `www` | `<项目>.pages.dev` | Pages 自动创建，开橙云代理 |
| Vercel | A | `@` | `76.76.21.21` | 根域 A 记录 |
| Vercel | CNAME | `www` | `cname.vercel-dns.com` | www 子域 |
| GitHub Pages | A | `@` | `185.199.108.153` | 四条 A 记录之一 |
| GitHub Pages | A | `@` | `185.199.109.153` | 四条 A 记录之二 |
| GitHub Pages | A | `@` | `185.199.110.153` | 四条 A 记录之三 |
| GitHub Pages | A | `@` | `185.199.111.153` | 四条 A 记录之四 |
| GitHub Pages | CNAME | `www` | `<user>.github.io` | www 子域指向 Pages |

### 5.3 HTTPS

Cloudflare Pages / Vercel / Netlify / GitHub Pages 均**自动签发并续期** Let's Encrypt 证书，绑域名后等几分钟到证书就绪即可。自建 Nginx 用 §4 方案 D 的 certbot。确认强制 HTTPS：各平台后台一般有「Always use HTTPS」开关，打开。

> 本站的 Copy / Save card 依赖 `https`（`file://` 与 http 下 clipboard 受限），且分享出去的链接被社交平台内嵌浏览器打开也要求 HTTPS——所以 HTTPS 是硬需求，不是可选项。

---

## 6. 缓存策略（可照抄配置全文）

目标响应头：

- **HTML**（首页 + 189 人物页）：`no-cache, must-revalidate` —— 每日判词随「今天」变、数据常更新，必须即时回源校验。
- **CSS / JS**（`style.css` / `app.js` / `data.js`）：`public, max-age=3600`（1 小时）—— **未做文件名指纹**，超长缓存会让用户拿到旧逻辑；除非你把引用改成带版本名（如 `app.v2.js`）才可拉长。
- **图片 / OG**：本项目没有外部图片文件（图标是 inline SVG data-URI，分享卡是运行时 canvas 生成的 PNG），所以无需单独配图片缓存。若日后加静态 OG 图，用 `public, max-age=86400`（1 天）。

**Cloudflare Pages / Netlify** —— 放在**项目根**（即构建产物目录）`projects/at-your-age/_headers`（完整文件）：
```
/*.html
  Cache-Control: no-cache, must-revalidate

/
  Cache-Control: no-cache, must-revalidate

/*.css
  Cache-Control: public, max-age=3600

/*.js
  Cache-Control: public, max-age=3600
```
> 因为 `_headers` 必须在发布目录里才生效，若走 build，请把它当作源码文件放进项目目录（它不会被 build.js 清理，build.js 只删 `people/*.html`）。

**Vercel** —— 用 §4 方案 B 里 `vercel.json` 的 `headers` 段（已含上述三类规则），无需再单独配。

**Nginx** —— 用 §4 方案 D server 块里的三个 `location`（`\.html$` → no-cache、`= /` → no-cache、`\.(css|js)$` → max-age=3600）。

---

## 7. SEO 上线

本项目是 **SEO 工具型**站，长尾人物页是核心资产，这一节要认真做。

### 7.1 robots.txt / sitemap.xml

两者都是 `build.js` 的产物，确保它们线上可 200 访问：
```bash
curl -sI https://你的域名/robots.txt  | head -1   # 期望 200
curl -sI https://你的域名/sitemap.xml | head -1   # 期望 200
```
`robots.txt` 内容应为 `User-agent: * / Allow: / / Sitemap: https://你的域名/sitemap.xml`；`sitemap.xml` 应含 191 个 `<loc>`。若域名不对 → 回 §3 改 `AYA_DOMAIN` 重跑 build。

### 7.2 Google Search Console

1. 打开 https://search.google.com/search-console → **Add property** → 选 **Domain**（推荐，覆盖 http/https/www 全变体）→ 输入 `你的域名`。
2. 按提示在 DNS 加一条 **TXT 验证记录** → **Verify**。
3. 左侧 **Sitemaps** → 输入 `sitemap.xml` → **Submit**。等 Google 抓取（几天）。
4. 用 **URL Inspection** 抽查几张人物页（如 `/people/albert-einstein.html`）是否「可编入索引」。

### 7.3 Bing Webmaster

打开 https://www.bing.com/webmasters → **Import** → 从 Google Search Console 一键导入已验证站点 + sitemap（免去重复验证）。

### 7.4 OG 卡图调试

分享卡靠 `<meta property="og:*">`（首页 `index.html:8-11`，人物页由 `build.js` 的 `pageShell` 注入）。上线后用各家调试器强制刷新缓存：
- Facebook Sharing Debugger：https://developers.facebook.com/tools/debug/ → 输 URL → **Scrape Again**
- X（Twitter）：直接发一条含链接的测试推，看卡片（本站用 `twitter:card = summary`）
- Telegram：把链接发给 @WebpageBot 强制刷新
逐一确认标题 / 描述 / 类型正确渲染。改过 meta 后必须来这里「重新抓取」，否则平台缓存旧卡（见 §11）。

---

## 8. 变现挂点激活

### 8.1 AdSense

**门槛**：需正式域名 + 真实流量（AdSense 不收 `file://`）；先把站部署好、有内容、跑一段时间再申请。

**步骤**（吸收自 `MARKETING.md §5`）：
1. https://adsense.google.com → **Sites** → 添加 `你的域名`。
2. 把 AdSense 给的验证 `<meta>` / script 注入 `index.html` 的 `<head>`（第 3–16 行之间）。
3. 过审后创建一个 **Display ad** 单元（Responsive）。
4. 打开 `index.html`，定位 **AD SLOT** 注释块（第 86–96 行），把里面的：
   ```html
   <p class="adcopy">This space is deliberately quiet. The calendar makes enough noise.</p>
   ```
   替换成 AdSense 的 `<ins class="adsbygoogle" ...>` + 它附带的 `<script>`。**保持外层 `<aside class="adslot">` 容器不动、max-height ≈ 120px**，别破坏周围留白与布局（`<150KB` 与视觉红线）。
5. **人物页要不要广告**：人物页模板在 `build.js` 的 `pageShell()`（第 80–105 行）。要挂的话在 footer 前插同一个广告单元，**改一处 = 全站 189 页生效**，然后必须重跑 `node build.js`。建议先只开首页、观察 CLS 与美学损伤再决定。

**`ads.txt`**（放**站点根**，即项目根 `projects/at-your-age/ads.txt`，完整文件，把 `pub-XXXX` 换成你的 AdSense publisher ID）：
```
google.com, pub-XXXX, DIRECT, f08c47fec0942fa0
```
> 它不会被 build.js 清理，作为静态文件放项目根即可，上线后 `curl https://你的域名/ads.txt` 应能 200 拿到。

### 8.2 联盟（克制挂法）

来自 `MARKETING.md §4`：只在 **HEAL 模式**结果下方出现一行文字链（情绪出口，不在 ROAST 伤口上撒盐），品类走在线课程 CPA（Coursera / Skillshare / Udemy / MasterClass 等）。实现：在 `index.html` 的 adslot 内按 `body[data-mode="heal"]` 条件显示（约 10 行 JS）。链接加 `rel="sponsored"`、旁注「ad」。**红线**：不挂理财 / 保健品 / 算命；ROAST 面永远不带广告（暴击要纯粹才有人转发）。

> 本项目**不涉及**小游戏流量主 / 激励视频 adUnitId / `res.isEnded===true` 发奖合规 / 诱导分享红线——那些是微信/抖音小游戏的事，本站是 Web 静态站。

---

## 9. 上线后自检清单

- [ ] 真机 iOS Safari：输生日 → 判词 → 翻转手感 → Save card 能下载 PNG
- [ ] 真机 Android Chrome：同上；Copy text 能写入剪贴板（`https` 下）
- [ ] `https://你的域名` 与 `https://www.你的域名` 都能开、且都强制 HTTPS
- [ ] `http://` 自动 301 到 `https://`
- [ ] OG 卡：X / Telegram / Facebook Debugger 三处卡片标题描述正确
- [ ] 跨时区 / 跨午夜：临近午夜时刷新，年龄「到天」的差值随日期翻页正确（换「今天」）
- [ ] `curl -sI https://你的域名/sitemap.xml` 与 `/robots.txt` 均 200，域名正确
- [ ] 抽查 3 张人物页（如 einstein / mozart / grandma-moses）canonical = 实际 URL
- [ ] Lighthouse 移动端 **Performance ≥ 95**（工具型 + 零外链，应轻松达标）
- [ ] 首页总重 **< 150KB**、DevTools Network 面板确认无任何外链请求
- [ ] `node test/data.mjs` 本地绿、`node test/smoke.mjs` 全 ok

> 本项目**不涉及**：多设备实时互见 SSE、限流 429、平台重启后编号连续、小游戏震动 / 高刷计时 / 激励视频填充——无后端、无小游戏。

---

## 10. 持续更新与运维

改数据是常态（补人物 = 补 sitemap URL = 补长尾入口）。标准流程：

```bash
cd projects/at-your-age

# 1) 编辑数据：data.js 的 AYA_MILESTONES 数组，一行一条里程碑
#    （字段规则见文件头注释与 PLAYBOOK.md：mode roast/heal、event 简单过去式无句号、
#     可选 ageDays / death / future）

# 2) 重新构建（重生成 189 人物页 + 名录 + sitemap + robots）
node build.js
# 期望：build: N person pages + ledger, sitemap with M urls, K milestones.

# 3) 跑测试
node test/data.mjs
node test/smoke.mjs         # 需 Playwright，见 §2.5

# 4) 提交并推送（连 Git 的托管会自动重新部署）
git add -A
git commit -m "data: add <人物名> milestones"
git push
```

- **回滚数据**：`data.js` 是唯一数据源、git 里一行一条，`git revert` 或改回后重跑 `node build.js` 即可。
- **回滚部署**：Cloudflare Pages / Vercel 后台都有 Deployments 历史，一键 rollback 到上一版本。
- **监控**：Search Console 看 impression 起量的人物页，优先给它们补条目 / 导语（`MARKETING.md §3`）。
- 本项目**不涉及**服务端日志 / 进程监控 / 数据卷备份——静态站没有运行时状态。

---

## 11. 故障排查表

| 症状 | 可能原因 | 解决 |
|---|---|---|
| `file://` 下 Copy 按钮显示 "Select & copy" | 本地协议无 clipboard 权限（`app.js:434` 的 fallback） | 属预期；部署到 `https` 后正常 |
| 分享出去的卡图是旧标题 / 旧描述 | 社交平台缓存了旧 OG | 去 Facebook Debugger「Scrape Again」/ Telegram @WebpageBot 强刷（§7.4） |
| 改了 CSS/JS 用户还是旧版 | CSS/JS 走了 1 小时缓存、且未做文件名指纹 | 等缓存过期，或把引用改成 `app.v2.js`（同步改 index.html 里 `<script src>`），或在托管后台 Purge cache |
| 换了域名但人物页 / sitemap 还是旧域名 | 只改了 `data.js` 没重跑 build，或忘了改 `index.html` 两处 | 回 §3：改 `AYA_DOMAIN` + index.html og:url/canonical → `node build.js` |
| GitHub Pages 上人物页样式在、但 canonical 指向别处 | 用了 `<user>.github.io/<repo>/` 子路径，与 canonical 域名不一致 | 绑自定义域（§5），让实际 URL = canonical；并在产物放 `CNAME` |
| 人物页 404 | build 没跑 / 产物没上传 / Output directory 配错 | 确认 `node build.js` 已跑、`people/*.html` 已提交、托管 Output 指向项目目录 |
| 跨午夜后年龄「天数」没变 | 页面在午夜前已加载、未刷新（年龄按加载时的「今天」算） | 刷新页面重新计算；这是预期行为，非 bug |
| 分享卡字体在 Win / Mac 略有差异 | 卡用系统字体栈（零外部字体是硬约束） | 设计容差内（Mac/iOS 出 SF、Windows 出 Segoe），无需处理 |
| `node test/smoke.mjs` 报 `Cannot find package 'playwright'` 或找不到浏览器 | 未装 playwright / 非本仓库容器无 `/opt/pw-browsers/chromium` | `npm i -D playwright && npx playwright install chromium`，并把 `executablePath` 那行改成 `chromium.launch()`（§2.5） |
| 首页体积超 150KB | 误加了外链资源 / 大图 | `grep http index.html` 应只有 canonical/OG；移除任何外链、图标用 inline SVG data-URI |

---

*本指南基于对 `projects/at-your-age/` 源码的实读（`data.js:236` 域名常量、`build.js` 构建逻辑、`index.html:11/13` 的 og/canonical、`app.js:8/314/397` 的 DOMAIN 引用、三个 test 文件、215 里程碑 / 189 人物 / 191 URL 实测）。数据或结构变动后请同步更新本文件。*
