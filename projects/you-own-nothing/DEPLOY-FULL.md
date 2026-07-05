# You Own Nothing（你什么都不拥有）· 全栈部署详解（从 0 到上线）

> 本指南假设你是一台全新的电脑、什么都没装。跟着从上往下逐条照抄即可把这个站点搬上公网，绑好自己的域名、HTTPS、缓存和 SEO。凡是涉及源码的文件名 / 常量名 / 常量值 / 行号，均取自本项目真实源码，可直接核对。

---

## 0. 这是什么 / 架构判定

**产品：** 一间温暖的手绘公寓，里面每一样东西——台灯、沙发、窗外的景色、室内的空气、你的猫——都是月付订阅。点击任意物件弹出一个以假乱真的 SaaS 订阅弹窗（三档定价 + fine print + 随机一种"黑暗模式"展示）；订阅则物件继续活着，拒绝则它在 400ms 内褪成灰阶垂头。逛完全屋或推门"去上班"，得到一张热敏小票：`MONTHLY TOTAL $XXX.XX` / `Items you actually own: 0`，可存成 PNG 分享卡或复制文本版。**没有真实支付、没有账号、没有任何数据采集**——这是关于订阅经济的一面镜子，不是它的又一个实例。传播点：猫 $4.99/mo（"the cat is on a free trial"）、空气 $5.99/mo、门 $12.99/mo。

**架构判定：纯静态（static），无构建、无后端、无数据库。** 依据：

- 全部逻辑在客户端 `app.js` 内，物件数据以 JS 数组内嵌（`OBJECTS`），插画为内嵌 SVG，**零依赖、零网络请求、`file://` 双击即可玩**（`app.js:1` 注释即声明 "everything in this file is client-side satire. No payments, no accounts, no tracking"）。
- 无 `package.json` 属于本项目（仓库根的 `package.json` 只为跑 Playwright 测试用），**没有 `build.js`、没有 `server.mjs`、没有 `wechat-minigame/`**。
- 持久化仅用浏览器 `localStorage`（键 `yon-state-v1`，见 `app.js:8`），托管成本 ≈ 0，任何静态托管免费档都能扛住爆发流量（全站约 85KB）。

**文件清单表：**

| 文件 | 作用 | 是否需上传到生产 |
|------|------|:---:|
| `index.html` | 页面骨架 + `<head>` 元信息 + 内嵌 SVG 公寓 + 结算区/弹窗容器 | ✅ 必须 |
| `style.css` | 全部样式（两套视觉语言：暖插画 + 无菌 SaaS 弹窗、动效、响应式） | ✅ 必须 |
| `app.js` | 全部逻辑：物件数据、弹窗、订阅/拒绝状态机、小票、PNG 分享卡、localStorage | ✅ 必须 |
| `test/smoke.mjs` | Playwright 冒烟测试 | ❌ 不上传 |
| `test/qa-extra.mjs` | Playwright 对抗式 QA | ❌ 不上传 |
| `test/screenshots/` | 测试产出的截图（含可当 OG 图的 `desktop-apartment.png`） | ❌ 不上传（但可挑一张做 OG 图，见 §7） |
| `DESCRIPTION.md` `PLAYBOOK.md` `MARKETING.md` `DEPLOY.md` `DEPLOY-FULL.md` | 文档 | ❌ 不上传（纯文本上传也无害，但没必要） |

> 结论：**上线 = 把 `index.html` / `style.css` / `app.js` 三个文件放到任意静态托管的根目录。** 其余都是开发期辅助物。

---

## 1. 从零准备环境

一台全新电脑要装的东西只有两样：**Node.js**（用来跑本地服务器、测试、部署 CLI）和 **Git**（用来取代码、连托管平台）。纯静态站本身不需要 Node 运行时，但部署工具链需要。

### 1.1 安装 Node.js（LTS，≥ 18；本项目开发机实测 v22.22.2）

**macOS（推荐 Homebrew 或 nvm 二选一）**

```bash
# 方式一：Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node

# 方式二：nvm（可多版本切换，更省心）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# 关掉再重开终端，或 source ~/.zshrc
nvm install --lts
nvm use --lts
```

**Windows（winget，Win10/11 自带）**

```powershell
winget install OpenJS.NodeJS.LTS
# 装完关掉再重开 PowerShell
```

**Linux（Debian/Ubuntu，nvm 最稳）**

```bash
# 方式一：nvm（推荐，不污染系统）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install --lts && nvm use --lts

# 方式二：NodeSource（系统级安装）
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**验证（三平台通用）：**

```bash
node -v
npm -v
```

期望输出（版本号 ≥ 18 即可，示例为本项目开发机）：

```
v22.22.2
10.9.7
```

### 1.2 安装并配置 Git

- macOS：`brew install git`（或首次运行 `git` 时按提示装 Xcode Command Line Tools）
- Windows：`winget install Git.Git`
- Linux：`sudo apt-get install -y git`

首次使用必须配置身份（提交与平台识别用）：

```bash
git config --global user.name "你的名字"
git config --global user.email "ericgu050714@gmail.com"
git config --global init.defaultBranch main
# 验证
git config --global --list
```

期望看到你刚填的 `user.name` / `user.email` / `init.defaultBranch=main`。

### 1.3 需要注册的账号

| 账号 | 用途 | 是否免费 |
|------|------|:---:|
| **GitHub** | 存代码、连托管平台自动部署、GitHub Pages | 免费 |
| **Cloudflare**（主推托管） | Cloudflare Pages 托管 + 免费无限带宽 CDN + DNS + 自动 HTTPS | 免费档足够 |
| **域名注册商**（如 Cloudflare Registrar / Namecheap / Porkbun） | 买 `youownnothing.rent`（`.rent` 顶级域是梗的一部分） | 域名年费另付，约 $20–40/yr（`.rent` 偏贵） |
| Vercel 或 Netlify（备选托管） | 备选静态托管方案 | 免费档足够 |
| Google AdSense（可选变现，见 §8） | 结算页广告位；本品建议保持"自嘲位"不上真广告 | 免费申请 |

> 本项目**不涉及**后端平台（Fly.io/Railway）、微信/抖音开放平台、版号等——因为它是纯静态站，无服务端、无小游戏。

### 1.4 取得代码

这是一个 monorepo（仓库 `ERICYOOOOOO/claude-test`），本项目在子目录 `projects/you-own-nothing/`。

```bash
# 克隆整个仓库（HTTPS 方式；把 URL 换成你 fork 后的地址）
git clone https://github.com/ERICYOOOOOO/claude-test.git
cd claude-test/projects/you-own-nothing
# 确认三个核心文件在
ls
```

期望看到：`app.js  DEPLOY.md  DESCRIPTION.md  index.html  MARKETING.md  PLAYBOOK.md  style.css  test`。

**只想要本项目三文件？** 部署时你只需要 `index.html style.css app.js` 三个文件。可以复制到一个独立目录：

```bash
mkdir -p ~/yon-deploy
cp index.html style.css app.js ~/yon-deploy/
```

后文凡写"项目目录"均指仓库内的 `projects/you-own-nothing/`（相对仓库根）；凡写"发布目录"指你实际上传的那份（可以是它本身，也可以是上面这个精简副本）。

---

## 2. 本地运行与自验

### 2.1 直接浏览器打开（`file://`）

双击 `index.html`，或在项目目录执行：

```bash
# macOS
open index.html
# Linux
xdg-open index.html
# Windows
start index.html
```

`file://` 协议下**功能完整**：点击物件、订阅/拒绝、灰阶动画、结算小票、PNG 分享卡下载、"copy text" 复制文本、`localStorage` 持久化——全部可用。这是本项目刻意的设计（零请求）。

**唯一需注意：** 某些浏览器在 `file://` 下对 Clipboard API 权限更严，"copy text" 可能回退到 textarea 选中方式（`app.js` 已内置回退，仍可用）。要 100% 还原生产行为，用下面的本地服务器。

### 2.2 起本地静态服务器

任选其一，在项目目录（或发布目录）执行：

```bash
# 方式一：Node，无需预装（首次会临时拉取 serve）
npx serve .
# 访问：http://localhost:3000

# 方式二：Python3（大多数系统自带）
python3 -m http.server 8000
# 访问：http://localhost:8000
```

浏览器打开对应地址，应看到暖色公寓、灯亮着、咖啡冒蒸汽、猫尾巴在动、右上角 `Monthly total $0.00`、`0 of 16 decided`。

### 2.3 构建项目

**本项目不涉及。** 无 `build.js`、无打包、无生成产物——三个源文件即最终产物。

### 2.4 后端项目

**本项目不涉及。** 无 `server.mjs`、无 SSE、无 API 路由，纯客户端。

### 2.5 小游戏

**本项目不涉及。** 无 `wechat-minigame/`、无微信/抖音适配层。

### 2.6 运行自带测试（Playwright）

测试需要 Playwright 及 Chromium。本仓库开发机的 Chromium 在 `/opt/pw-browsers/chromium`（`smoke.mjs` 里硬编码了这个路径：`chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`）。**一般机器**没有这个路径，需要先装浏览器，并相应处理执行路径。

**在本仓库开发机（已有 `/opt/pw-browsers/chromium`）：** 从**仓库根目录**执行

```bash
# 相对仓库根（claude-test/）
node projects/you-own-nothing/test/smoke.mjs
node projects/you-own-nothing/test/qa-extra.mjs
```

`smoke.mjs` 逐条打印 `PASS xxx`，末尾若有失败会 `FAIL xxx` 并以非零码退出；全绿即通过。它会顺带在 `test/screenshots/` 生成桌面/移动端截图。

**在你自己的一般机器上：** 先装依赖与浏览器

```bash
# 在仓库根
npm install                       # 装 playwright（见根 package.json 的 dependencies）
npx playwright install chromium   # 下载 Chromium 到默认缓存目录
```

由于两个测试文件把执行路径写死为 `/opt/pw-browsers/chromium`，一般机器要么创建软链指过去，要么临时改这一行：

```bash
# 办法一：软链（把 npx 装好的 chromium 指到脚本期望的位置；路径按实际 ls 结果调整）
sudo mkdir -p /opt/pw-browsers
sudo ln -s "$(find ~/.cache/ms-playwright -name chrome -path '*chromium*' | head -n1)" /opt/pw-browsers/chromium

# 办法二：临时改脚本（仅本地跑，别提交）——把 executablePath 那行删掉，
#         让 Playwright 用自己下载的默认 Chromium 即可。
```

期望结果（示例）：

```
PASS  desktop: scene renders 16 objects
PASS  desktop: starts at $0.00
PASS  desktop: odometer reflects total
PASS  desktop: declines do not change total
PASS  checkout: itemized lines cover all objects
...
ALL CHECKS PASSED
```

> 说明：`node --check projects/you-own-nothing/app.js` 可静态检查 `app.js` 语法（无输出即通过），部署前值得跑一次。

---

## 3. 上线前必改（精确到文件 + 常量 / 行）

本项目上线前**唯一必须改**的是"域名"这一件事——但它散落在 JS 常量和 HTML 元信息两处，都要改。若你就用默认域名 `youownnothing.rent`，则 §3 全部可跳过（源码里已经是这个值）。下面表格覆盖"你换成自己域名"时要动的每一处。

| 文件 | 位置（常量名/行号/选择器） | 现值 | 改成 |
|------|------|------|------|
| `app.js` | 第 7 行 `var DOMAIN` | `'youownnothing.rent'` | `'你的域名.com'`（不带协议、不带斜杠） |
| `index.html` | `<head>` 内（当前第 12 行 `<link rel=stylesheet>` 之前）| **无 `canonical`**（需新增） | 新增 `<link rel="canonical" href="https://你的域名/">` |
| `index.html` | `<head>` 内（`og:type` 附近，当前第 10 行后）| **无 `og:url`**（需新增） | 新增 `<meta property="og:url" content="https://你的域名/">` |
| `index.html` | `<head>` 内 | **无 `og:image`**（需新增，见 §7） | 新增 `<meta property="og:image" content="https://你的域名/og.png">` |
| `index.html` | 第 6 行 `<title>` / 第 7 行 `description` / 第 8–9 行 `og:title`/`og:description` | 现有英文文案（不含域名） | 一般无需改；如品牌名变化再改 |

**说明：`DOMAIN` 常量决定什么？** 它出现在 3 处，全是"给用户看的域名字样"，不是资源加载路径：

- `app.js:759` 结算小票底部的域名行（`h += '<div class="r-domain">' + esc(DOMAIN)`）
- `app.js:824` "copy text" 文本版分享卡的末行（`lines.push('https://' + DOMAIN)`）
- `app.js:980` PNG 分享卡 canvas 上绘制的域名（`ctx.fillText(DOMAIN, cx, y)`）

所以改错了不会白屏，但分享卡/小票会印错域名，露馅。**改完如何验证：** 本地起服务器 → 逛到结算页 → 看小票底部域名对不对 → 点 "save the receipt (PNG)" 存图，看图上域名 → 点 "copy text" 粘贴到记事本，看末行 `https://...` 是否是新域名。

`<head>` 三处新增（`canonical` / `og:url` / `og:image`）**改完如何验证：** 部署后用浏览器"查看源代码"确认标签在；再用 §7 的 OG 调试器抓一次，看标题/描述/缩略图正确。

> 提醒：换域名时，全局搜索一遍 `youownnothing.rent` 确保无遗漏：
> ```bash
> grep -rn "youownnothing.rent" projects/you-own-nothing --include=*.js --include=*.html
> ```
> 应只剩你已处理的那几处（`app.js:7` 一处常量 + 其派生用法即随之更新）。

---

## 4. 部署（主链路，≥2 方案，主推 1 个）

纯静态站，主推 **Cloudflare Pages**（免费、带宽无限、全球 CDN、自动 HTTPS，爆款不心疼）。下面给 A/B/C 三方案 + 可选 D 自建 Nginx。后端/小游戏方案**本项目不涉及**，跳过。

### 方案 A（主推）Cloudflare Pages

#### 路线 ① 连 Git（网页操作，推荐给长期维护）

1. 把代码推到 GitHub（若还没推）：
   ```bash
   # 在仓库根
   git add -A && git commit -m "deploy you-own-nothing"
   git push origin main
   ```
2. 登录 <https://dash.cloudflare.com> → 左侧 **Workers & Pages** → **Create application** → **Pages** 选项卡 → **Connect to Git**。
3. 授权并选择仓库 `ERICYOOOOOO/claude-test`。
4. **关键：因为这是 monorepo 子目录，填写如下**（这是本方案最容易错的地方）：
   - **Project name**：`you-own-nothing`
   - **Production branch**：`main`
   - **Framework preset**：`None`
   - **Build command**：**留空**（本项目无构建）
   - **Build output directory**：`projects/you-own-nothing`
   - 展开 **Root directory (advanced)**：**留空**（配合上面的 output 目录使用即可；若你把 Root directory 设为 `projects/you-own-nothing`，则 Build output directory 改填 `.` 或留空——两者取其一，别叠加导致路径变成 `projects/you-own-nothing/projects/you-own-nothing`）。
5. **Save and Deploy**。约 1 分钟后得到 `https://you-own-nothing.pages.dev`，打开应能玩。
6. 之后每次 `git push` 自动重新部署。

#### 路线 ② 命令行 wrangler 直传（推荐给一次性/无 Git）

```bash
# 装 Cloudflare CLI（全局）
npm i -g wrangler
# 登录（会打开浏览器授权）
wrangler login
# 在仓库根执行，直传项目目录
wrangler pages deploy projects/you-own-nothing --project-name=you-own-nothing
```

期望输出末尾出现 `Deployment complete! Take a peek over at https://xxxxxxxx.you-own-nothing.pages.dev`。

> 直传只上传该目录下的文件；`test/` 和 `*.md` 一并被传但不影响功能。若想干净，先按 §1.4 复制精简副本再 `wrangler pages deploy ~/yon-deploy --project-name=you-own-nothing`。

### 方案 B Vercel（或 Netlify）

**Vercel（命令行）：**

```bash
npm i -g vercel
cd projects/you-own-nothing   # 进入项目目录
vercel --prod                 # 首次会问几个问题，一路默认即可
```

为把缓存策略和 monorepo 路径固定下来，在**项目目录**放一个 `vercel.json`：

**文件路径：`projects/you-own-nothing/vercel.json`（完整内容）**

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
      "source": "/og.png",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=86400" }
      ]
    }
  ]
}
```

**Netlify（命令行）：**

```bash
npm i -g netlify-cli
cd projects/you-own-nothing
netlify deploy --dir . --prod
```

**文件路径：`projects/you-own-nothing/netlify.toml`（完整内容）**

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

[[headers]]
  for = "/og.png"
  [headers.values]
    Cache-Control = "public, max-age=86400"
```

### 方案 C GitHub Pages

本项目无构建，最省事的是**网页操作**，但 monorepo 子目录不能直接被 Pages 当根发布，所以用 GitHub Actions 把子目录内容作为 artifact 发布。给出完整 workflow：

**文件路径：`.github/workflows/deploy.yml`（相对仓库根，完整内容）**

```yaml
name: Deploy you-own-nothing to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - 'projects/you-own-nothing/**'
      - '.github/workflows/deploy.yml'
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

      - name: Upload artifact (only the three prod files' folder)
        uses: actions/upload-pages-artifact@v3
        with:
          # 只发布项目目录；test/ 与 *.md 一起进包但不影响页面
          path: projects/you-own-nothing

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

启用步骤：GitHub 仓库 → **Settings** → **Pages** → **Build and deployment** → **Source** 选 **GitHub Actions**。推送后在 **Actions** 标签看绿勾，站点地址形如 `https://ericyoooooo.github.io/claude-test/`。

> **GitHub Pages 子目录相对路径注意：** 本项目 `index.html` 里引用是 `href="style.css"` / `src="app.js"`（相对路径），且我们把项目目录整体作为 artifact 根发布，所以资源能正确解析。**不要**把整个仓库当根发布再指望 `/projects/you-own-nothing/` 生效——那样根路径 `/` 会 404。绑自定义域名后（§5）根路径问题彻底消失。

> 说明：本项目**无 `build.js`**，故 workflow 里**没有** `setup-node` + `node build.js` 步骤。若将来引入构建，在 `Checkout` 后插入 `actions/setup-node@v4` 与 `run: node build.js`，再把 `upload-pages-artifact` 的 `path` 指向构建产物目录。

### 方案 D（可选）自建 Nginx

买一台 VPS，把三个文件放到 `/var/www/youownnothing`，Nginx 配置：

**文件路径：`/etc/nginx/sites-available/youownnothing`（完整 server 块）**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name youownnothing.rent www.youownnothing.rent;
    root /var/www/youownnothing;
    index index.html;

    # SPA 无关：这是纯静态多资源站，直接按文件系统找
    location / {
        try_files $uri $uri/ =404;
    }

    # HTML：每次回源校验（每日文案/逻辑可能更新）
    location = /index.html {
        add_header Cache-Control "no-cache, must-revalidate";
    }

    # CSS/JS：短缓存 1 小时（未做文件名指纹，勿超长缓存）
    location ~* \.(css|js)$ {
        add_header Cache-Control "public, max-age=3600";
    }

    # 图片/OG：1 天
    location ~* \.(png|jpg|jpeg|webp|ico|svg)$ {
        add_header Cache-Control "public, max-age=86400";
    }
}
```

启用 + HTTPS：

```bash
sudo ln -s /etc/nginx/sites-available/youownnothing /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
# 用 certbot 自动签发 + 续期
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d youownnothing.rent -d www.youownnothing.rent
```

> 本项目**无后端进程**，所以**不需要** systemd unit、不需要 SSE 反代（`proxy_buffering off` 等）、不需要 `TRUST_PROXY`、不需要 `history.jsonl` 备份 cron——这些都是全栈/后端项目才有的东西，本项目不涉及。Nginx 在这里只当静态文件服务器。

---

## 5. 自定义域名 + DNS + HTTPS

### 5.1 买域名

到注册商（Cloudflare Registrar 最省事，或 Namecheap / Porkbun）搜索 `youownnothing.rent`，加入购物车结账。`.rent` 顶级域是本产品梗的一部分，建议保留；若太贵可退而用 `.com` / `.fun` 等（记得同步改 §3 的 `DOMAIN`）。

### 5.2 各平台绑定域名步骤

- **Cloudflare Pages（方案 A）：** 项目页 → **Custom domains** → **Set up a domain** → 输入 `youownnothing.rent` → 若域名 DNS 已托管在 Cloudflare，会**自动**添加 CNAME 记录并签发证书，几分钟生效。再加一次 `www.youownnothing.rent` 同理。
- **Vercel（方案 B）：** 项目 → **Settings** → **Domains** → 添加 `youownnothing.rent`，按提示在注册商加 DNS 记录。
- **Netlify：** **Domain settings** → **Add custom domain**，按提示加记录。
- **GitHub Pages（方案 C）：** 仓库 **Settings → Pages → Custom domain** 填 `youownnothing.rent` → 会在项目目录生成 `CNAME` 文件（若手动放，路径 `projects/you-own-nothing/CNAME`，内容一行 `youownnothing.rent`）→ 勾选 **Enforce HTTPS**。

### 5.3 DNS 记录表（按你选的托管平台取用）

| 类型 | 主机名（Name） | 值（Value） | 说明 |
|------|------|------|------|
| CNAME | `youownnothing.rent`（根，或写 `@`） | `you-own-nothing.pages.dev` | **Cloudflare Pages** 根域，DNS 在 CF 时用 CNAME flattening 自动处理 |
| CNAME | `www` | `you-own-nothing.pages.dev` | Cloudflare Pages 的 www |
| A | `@`（根） | `76.76.21.21` | **Vercel** 根域 A 记录 |
| CNAME | `www` | `cname.vercel-dns.com` | Vercel 的 www |
| A | `@`（根） | `185.199.108.153` | **GitHub Pages** 根域（四条 A，见下） |
| A | `@`（根） | `185.199.109.153` | GitHub Pages |
| A | `@`（根） | `185.199.110.153` | GitHub Pages |
| A | `@`（根） | `185.199.111.153` | GitHub Pages |
| CNAME | `www` | `ericyoooooo.github.io` | GitHub Pages 的 www（换成你的 `<user>.github.io`） |
| A | `@`（根） | `你的 VPS IP` | **自建 Nginx（方案 D）** 时用 |

> 只需填**你所选那一个平台**对应的记录，不要把多个平台的记录同时加进去。

### 5.4 HTTPS 自动签发

- Cloudflare Pages / Vercel / Netlify / GitHub Pages：绑定域名后**自动签发并续期**免费证书（Let's Encrypt 或平台自有 CA），你什么都不用做，等状态从 "Provisioning" 变 "Active" 即可（通常几分钟到 1 小时）。
- 自建 Nginx：用 §4 方案 D 里的 `certbot`，它会自动续期。

> 本项目**无内嵌浏览器/小游戏运行环境**，故没有"微信/抖音强制 HTTPS"的额外约束——但生产站本就该全站 HTTPS，且分享卡里印的是 `https://youownnothing.rent`，务必让 HTTPS 生效以免落地页降级为 http。

---

## 6. 缓存策略

**目标头：**

- **HTML（`index.html`、根 `/`）：** `no-cache, must-revalidate` —— 文案/判决行/物件数据可能随更新变动，要即时回源，别让用户看到旧版。
- **CSS / JS（`style.css`、`app.js`）：** `public, max-age=3600`（1 小时）—— **本项目未做文件名指纹**（引用是裸 `style.css` / `app.js`，见 `index.html:12` 与 `index.html:398`），**切勿设超长缓存**，否则改了样式/逻辑后用户一小时内甚至更久看到旧版。若将来要长缓存，先把引用改成带版本的 `app.v2.js` 之类再说。
- **图片 / OG（`og.png` 等）：** `public, max-age=86400`（1 天）。

各平台配置文件（选你用的那个平台，全文照抄）：

**Cloudflare Pages / Netlify —— 文件路径：`projects/you-own-nothing/_headers`（完整内容）**

```
/*.html
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

> 把 `_headers` 放在**发布目录根**（即和 `index.html` 同级）。Cloudflare Pages 和 Netlify 都识别这个文件；它不会被当页面提供。

**Vercel：** 用 §4 方案 B 里给出的 `projects/you-own-nothing/vercel.json` 的 `headers` 段（已含相同策略），无需另建文件。

**Nginx：** 用 §4 方案 D `server` 块里的三个 `location`（HTML `no-cache` / CSS·JS `max-age=3600` / 图片 `max-age=86400`），已内置。

---

## 7. SEO 上线

本项目是个"玩具/传播品"，SEO 求最小可用集即可：让分享卡图正确、能被搜到、社交平台展开有大图。

### 7.1 robots.txt / sitemap.xml

**本项目无 `build.js`，不会自动生成**，手动放两个小文件到发布目录根：

**文件路径：`projects/you-own-nothing/robots.txt`（完整内容）**

```
User-agent: *
Allow: /
Sitemap: https://youownnothing.rent/sitemap.xml
```

**文件路径：`projects/you-own-nothing/sitemap.xml`（完整内容）**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://youownnothing.rent/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

部署后访问 `https://youownnothing.rent/robots.txt` 与 `/sitemap.xml`，都应返回 200 且内容正确。

### 7.2 OG 图（社交大图）

本项目 `<head>` **当前没有 `og:image`**（见 §3），社交平台展开只有标题+描述、无缩略图。补一张图能显著提升点击率。

1. 用现成截图当 OG 图：把 `test/screenshots/desktop-apartment.png` 复制成发布目录根的 `og.png`：
   ```bash
   cp test/screenshots/desktop-apartment.png og.png
   ```
   （或自己截一张公寓全景，导出 1200×630 更标准。）
2. 在 `index.html` `<head>` 里新增（配合 §3 的 `og:url` / `canonical` 一起加）：
   ```html
   <meta property="og:image" content="https://youownnothing.rent/og.png">
   <meta name="twitter:card" content="summary_large_image">
   ```

### 7.3 搜索引擎收录

- **Google Search Console：** 登录 <https://search.google.com/search-console> → **Add property** → 选 **Domain** 输入 `youownnothing.rent` → 按提示在 DNS 加一条 TXT 记录验证 → 验证通过后 **Sitemaps** → 提交 `https://youownnothing.rent/sitemap.xml`。
- **Bing Webmaster Tools：** 登录 <https://www.bing.com/webmasters> → **Import from GSC**（直接从 Google Search Console 一键导入，省去重复验证）。

### 7.4 OG 调试器（确认卡图）

发一次前先抓一遍缓存：

- X/Twitter：<https://cards-dev.twitter.com/validator>（现多用直接发帖预览）
- Facebook/通用：<https://developers.facebook.com/tools/debug/> 输入 URL → **Scrape Again**
- Telegram：把链接发给 <https://t.me/WebpageBot> 让它刷新缓存
- LinkedIn：<https://www.linkedin.com/post-inspector/>

确认标题 "You Own Nothing"、描述、`og.png` 缩略图都正确显示。

---

## 8. 变现挂点激活

本项目**故意保持"自嘲位"**：结算页有一个预留广告位，默认文案是 `this space is intentionally not sold · a rare non-subscription surface`（`index.html:389`）。产品的可信度建立在"真的不卖你任何东西/不采集数据"上，`MARKETING.md` 的建议是**默认别上真广告**。以下是"若你决定激活"的确切位置。

### 8.1 AdSense

- **申请门槛：** 站点需有实质内容、可正常访问、绑定自有域名；提交后人工审核数天。
- **`ads.txt`（放站点根，声明授权卖方）——文件路径：`projects/you-own-nothing/ads.txt`（完整示例，把 pub-id 换成你的）**
  ```
  google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0
  ```
- **把预留位换成广告单元：** `index.html` 结算区里有明确注释指路（`index.html:384-388`）：
  > "To activate AdSense: replace the inner content of `.ad-slot` with your ad unit snippet (script + `<ins class="adsbygoogle">`). Keep it below the receipt."
  即把 `index.html:389` 这一行 `<div class="ad-slot">…</div>` 的**内部内容**替换为你的广告单元代码，例如：
  ```html
  <div class="ad-slot">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-0000000000000000" crossorigin="anonymous"></script>
    <ins class="adsbygoogle"
         style="display:block"
         data-ad-client="ca-pub-0000000000000000"
         data-ad-slot="1234567890"
         data-ad-format="auto"
         data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
  </div>
  ```
  改这**一处**即全站生效（广告只在结算页出现，符合"只此一个位、不打破小票美学"的原则）。
- **本项目无 `build.js`**，故不存在"改模板后重跑 build 全站生效"——直接改 `index.html` 这一处并重新部署即可。

### 8.2 联盟/其他

见 `MARKETING.md`。本产品的调性建议以内容传播（HN / r/InternetIsBeautiful / X 线程 / 短视频录屏）驱动，而非广告，参见 `PLAYBOOK.md` §九的 4 周节奏。

### 8.3 小游戏流量主 / 激励视频

**本项目不涉及**（无小游戏形态，故无 `adUnitId`、无 `res.isEnded===true` 发奖合规红线、无诱导分享红线）。

---

## 9. 上线后自检清单

- [ ] 真机 iOS Safari 打开：公寓正常、点击弹窗、订阅/拒绝、结算小票、存 PNG、copy text 都可用
- [ ] 真机 Android Chrome 同上
- [ ] `https://youownnothing.rent` 与 `https://www.youownnothing.rent` 都能开、都是 HTTPS（无证书警告）
- [ ] `http://` 自动 301 到 `https://`
- [ ] OG 卡：X/Telegram/Facebook 展开有标题+描述+`og.png` 大图（§7.4 调试器已刷新）
- [ ] 375px / 320px 视口无横向滚动（跑 `qa-extra.mjs` 已覆盖，或真机手测）
- [ ] `prefers-reduced-motion` 开启时动效降级（系统"减弱动态效果"打开后无强烈动画）
- [ ] `localStorage` 塞垃圾值仍能正常启动（`app.js` 对 `yon-state-v1` 有 try/catch + 损坏回退）
- [ ] 结算页 `Items you actually own: 0` 判决行显示正确
- [ ] 分享卡 PNG 与 copy text 文本版内容一致，且域名为你的真实域名
- [ ] 首屏免责行可见：`Satire. Nothing is charged, nothing is collected, nothing is owned.`（`index.html:366`）
- [ ] Lighthouse 移动端 Performance ≥ 95（DevTools → Lighthouse → Mobile；纯静态 85KB 应轻松达标）
- [ ] 广告位状态符合预期（默认"自嘲位"，或已正确替换为 AdSense 单元）

> 后端实时互见/限流/墓地编号、小游戏震动·高刷·激励视频——**本项目均不涉及**。

---

## 10. 持续更新与运维

本项目无后端、无数据库，运维极轻。标准更新流程：

1. 改内容（如新增判决行、调物件文案、加隐藏物件——都在 `app.js` 的数据数组里）。
2. 静态自检：
   ```bash
   node --check projects/you-own-nothing/app.js
   ```
   无输出即语法通过。
3. 跑测试（见 §2.6，从仓库根）：
   ```bash
   node projects/you-own-nothing/test/smoke.mjs
   node projects/you-own-nothing/test/qa-extra.mjs
   ```
   全绿再继续。
4. 重新部署：
   - 方案 A/C（连 Git）：`git push origin main`，平台自动构建部署。
   - 方案 A 路线②/B（CLI）：重跑 `wrangler pages deploy …` / `vercel --prod` / `netlify deploy --prod`。
5. 部署后按 §9 抽查关键项（尤其 CSS/JS 因 1 小时缓存，最长 1 小时后全量用户见到新版；急需即时可在托管平台"Purge cache"）。

**回滚：** 静态站无状态，回滚 = 重新部署上一版目录（或在 Cloudflare Pages / Vercel 的 **Deployments** 列表点旧版 **Rollback**）。用户端 `localStorage` 结构带版本号 `yon-state-v1`（`app.js:8`），旧数据损坏会自动回退默认值，无迁移负担。

> 备份/日志/监控/告警：纯静态站基本无需，托管平台自带访问日志与可用性即可。如需极轻量 PV 统计，用**无 Cookie** 方案（Cloudflare Web Analytics / GoatCounter 一行脚本），别用重型分析——本品可信度建立在"真的不采集"上。

---

## 11. 故障排查表

| 症状 | 可能原因 | 解决 |
|------|------|------|
| 改了 `style.css`/`app.js`，用户仍见旧版 | CSS/JS 有 1 小时缓存（`max-age=3600`），且文件名无指纹 | 等最长 1 小时；或在托管平台 Purge cache；长期方案是把引用改成 `app.v2.js` 之类带版本名再上长缓存 |
| 社交平台展开还是旧标题/无图 | OG 抓取有缓存 | 用 §7.4 各平台调试器 **Scrape Again / 刷新**；确认 `og:image` 已加且 `og.png` 返回 200 |
| GitHub Pages 打开根路径 404 或样式全丢 | 把整个仓库当根发布，`/style.css` 实际在 `/projects/you-own-nothing/style.css` | 用 §4 方案 C 的 workflow（把项目目录作为 artifact 根发布）；绑自定义域名后根路径归位 |
| `file://` 下 "copy text" 没复制成功 | 部分浏览器在 `file://` 限制 Clipboard API | 属预期；`app.js` 已有 textarea 回退。要还原生产行为用 §2.2 本地 http 服务器 |
| 分享卡 PNG / 小票底部域名印错 | `app.js:7` 的 `DOMAIN` 常量没跟着换域名 | 改 `app.js:7` 为你的域名，重新部署（见 §3） |
| 页面白屏、控制台报错 | `app.js` 语法被改坏 | `node --check projects/you-own-nothing/app.js` 定位；回滚到上一版 |
| HTTPS 不生效 / 证书警告 | 域名刚绑定，证书在签发中；或 DNS 记录填错 | 等几分钟到 1 小时；核对 §5.3 DNS 记录是否只填了所选平台那一组 |
| `wrangler pages deploy` 把 test/ 也传上去了 | 直传整目录 | 无害；要干净就用 §1.4 精简副本目录再传 |
| 跑测试报找不到 `/opt/pw-browsers/chromium` | 一般机器无此路径（脚本硬编码） | 见 §2.6：`npx playwright install chromium` 后做软链，或临时删掉脚本里的 `executablePath` 行 |
| 手机上横向能滚动一点 | 视口适配问题 | 跑 `qa-extra.mjs`（含 320px 无横滚断言）定位；本项目已针对 375/320px 处理，若复现多为新增内容超宽 |

> 本项目**无 SSE 代理缓冲 / 机器休眠断流 / `TRUST_PROXY` 单冷却桶 / 微信 `navigator.vibrate` 不可用 / 跨午夜换题**这类坑——它们属于后端/小游戏/每日题项目，本纯静态站不涉及。
