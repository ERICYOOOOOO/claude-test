# Overlap · 重叠时光 — 全栈部署详解（从 0 到上线）

> 本指南假设你是一台全新的电脑，什么都没装：没有 Node、没有 Git、没有任何账号。跟着从上往下逐条照抄即可把 Overlap 部署到自己的域名上线。命令里凡是标注「仓库根」的，指 `/home/user/claude-test`；标注「项目目录」的，指 `/home/user/claude-test/projects/overlap`。你自己的电脑上路径会不同，但相对关系（`projects/overlap` 是仓库根下的子目录）一致。

---

## 0. 这是什么 / 架构判定

**产品**：Overlap（overlap.love）是一个异地恋 / 跨时区伴侣用的「每日重叠时间计算器」。选两座城市、各自设好睡眠与忙碌时段，它把未来 24 小时画成一条双轨发光灯带，告诉你三件事：一个数字（"You overlap for 2h 47m a day."）、一个被命名的最长窗口（"the goodnight window"）、以及一枚只增不减的「共同清醒小时数」里程表。传播引擎是那张一键生成的 1080×1350 夜空分享卡（见 PLAYBOOK 第八节、MARKETING 全篇）。

**架构判定：纯静态（static），无构建、无后端、零运行时依赖。**
判定依据：

- 全部逻辑在客户端浏览器执行。时区换算走浏览器内置 `Intl.DateTimeFormat`（PLAYBOOK 第二节），不需要服务端。
- 数据内嵌在 JS 里：330 座城市及其 IANA 时区写死在 `cities.js`（第 383 行 `globalThis.CITIES = C;` 暴露）。
- 状态只存本地 `localStorage`（里程表 key 形如 `overlap:v1:meter:<idA~idB>`，PLAYBOOK 第六节），没有数据库、没有账号、没有 API 调用。
- `index.html` 用 `file://` 直接双击就能跑（DESCRIPTION「纯静态零依赖，file:// 可直接打开，全页 <100KB」）。
- **没有构建步骤**：项目目录里没有 `build.js`、没有 `package.json`、没有打包配置。上传到生产的就是仓库里这几个源文件本身。

结论：托管成本 ≈ 0，任何静态托管（Cloudflare Pages / Netlify / Vercel / GitHub Pages）都能 30 秒上线，无冷启动、无服务器运维。本指南第 4 节「后端」「小游戏」相关小节对本项目**不涉及**，但保留编号骨架。

**文件清单（项目目录下真实存在的文件）**

| 文件 | 作用 | 是否需上传到生产 |
|---|---|---|
| `index.html` | 页面骨架、OG/Twitter 元标签、广告位容器、加载 `cities.js` + `app.js` | ✅ 是 |
| `style.css` | 全部样式（暗色星空主题、灯带、分享卡预览） | ✅ 是 |
| `app.js` | 全部逻辑：搜索、时区采样、灯带渲染、里程表、Canvas 分享卡、文本版 | ✅ 是 |
| `cities.js` | 330 城市 → IANA 时区数据表 + 中文名 + 别名 | ✅ 是 |
| `og-card.png` | 社交预览卡图，**当前仓库里没有，需你自己生成**（见 3、7 节） | ✅ 是（需新增） |
| `DEPLOY.md` | 旧版精简部署备忘（本指南是它的完整扩写版） | ❌ 否 |
| `DEPLOY-FULL.md` | 本文件 | ❌ 否 |
| `DESCRIPTION.md` / `PLAYBOOK.md` / `MARKETING.md` | 产品 / 玩法 / 营销文档 | ❌ 否 |
| `test/tz.mjs` | Node 直跑的时区算法测试（无浏览器） | ❌ 否 |
| `test/smoke.mjs` | Playwright 冒烟测试（截图、无 console error、中文搜索等） | ❌ 否 |
| `test/qa-extra.mjs` | 独立对抗性 QA 套件（独立 Intl 路径复核 + 里程表滥用） | ❌ 否 |
| `test/screenshots/` | 测试产出的截图目录（运行时生成） | ❌ 否 |

生产只需要 5 个文件：`index.html` / `style.css` / `app.js` / `cities.js` / `og-card.png`。其余都是文档与测试，不要上传。

---

## 1. 从零准备环境

### 1.1 安装 Node.js（LTS，≥18）

本项目运行时不需要 Node（浏览器直接跑），但**跑测试、用命令行部署工具（wrangler / vercel / netlify）需要 Node**。装 LTS（当前仓库实测用的是 v22.22.2，任何 ≥18 都行）。

**macOS**（推荐用 nvm，可多版本共存）：

```bash
# 装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# 关掉终端重开，然后：
nvm install --lts
nvm use --lts
```

或用 Homebrew：

```bash
brew install node
```

**Windows**（用 winget，Win10/11 自带）：

```powershell
winget install OpenJS.NodeJS.LTS
```

**Linux**（Debian/Ubuntu，用 NodeSource；或用 nvm 同 macOS）：

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**验证**（三平台通用）：

```bash
node -v
npm -v
```

期望输出（版本号可以更高，只要 node ≥ 18）：

```
v22.22.2
10.9.3
```

### 1.2 安装并配置 Git

**macOS**：`brew install git`（或装 Xcode Command Line Tools：`xcode-select --install`）
**Windows**：`winget install Git.Git`
**Linux**：`sudo apt-get install -y git`

配置你的身份（提交记录会用到，一次性）：

```bash
git config --global user.name "你的名字"
git config --global user.email "ericgu050714@gmail.com"
```

验证：

```bash
git --version          # 期望：git version 2.x.x
git config --global user.name    # 期望：回显你刚填的名字
```

### 1.3 需要注册的账号

| 账号 | 用途 | 是否免费 |
|---|---|---|
| **GitHub** | 存代码、CI、可选的 GitHub Pages 托管 | 免费 |
| **Cloudflare**（主推托管） | Cloudflare Pages 静态托管 + 全球 CDN + 自动 HTTPS | 免费 |
| **域名注册商**（Cloudflare Registrar / Namecheap / 阿里云等） | 买 `overlap.love` 这类域名 | 付费（域名年费，`.love` 约 US$20–40/年） |
| Vercel 或 Netlify（备选托管） | 备选静态托管方案 | 免费 |
| Google AdSense（可选，变现） | 页脚广告位（第 8 节） | 免费申请，需审核 |
| Google Search Console（SEO） | 提交 sitemap、看收录（第 7 节） | 免费 |

本项目**不涉及**后端平台（Fly.io/Railway）、微信/抖音开放平台——那是含服务端或小游戏的项目才需要。

### 1.4 取得代码

本项目在一个 monorepo（`claude-test`）的子目录里。两种取法：

**方式 A：克隆整个仓库（最简单）**

```bash
git clone <你的仓库地址> claude-test
cd claude-test/projects/overlap
pwd    # 应显示 .../claude-test/projects/overlap
```

**方式 B：只想要这一个项目上线**——把项目目录里那 4 个源文件复制到一个新的独立空目录 / 新仓库根，之后所有「项目目录」都指这个新目录：

```bash
mkdir overlap-site && cd overlap-site
# 把 index.html style.css app.js cities.js 四个文件拷进来
```

方式 B 让托管平台的「子目录」配置省心（Output directory 直接就是根），代价是脱离 monorepo。个人上线推荐方式 B；想保留 monorepo 结构则用方式 A，并在第 4 节按「子目录」填法配置。

---

## 2. 本地运行与自验

### 2.1 直接用浏览器打开（file://）

双击 `index.html`，或：

```bash
# macOS
open /home/user/claude-test/projects/overlap/index.html
# Linux
xdg-open /home/user/claude-test/projects/overlap/index.html
# Windows
start index.html
```

**能玩到什么**：城市搜索（中英文/别名）、双轨灯带、倒计时、里程表、"Copy as text"、"Save the card" 存 PNG——全部功能都能用，因为零依赖、零网络请求。
**不能玩到 / 需注意**：`file://` 下 `localStorage` 在个别浏览器（尤其某些隐身模式或严格隐私设置）可能被禁，导致里程表和「记住这对城市」不持久（功能仍可用，只是刷新后不记账，见 DEPLOY 旧版「已知边界」）。要 100% 还原生产行为，用下面的本地服务器。

### 2.2 起本地静态服务器

任选一种：

```bash
# 进项目目录
cd /home/user/claude-test/projects/overlap

# 方案一：Node 的 serve（无需预装，npx 现拉）
npx serve .
# 输出里会给出地址，通常是 http://localhost:3000

# 方案二：Python 自带（macOS/Linux 一般都有 python3）
python3 -m http.server 8000
# 访问 http://localhost:8000
```

浏览器打开对应地址，DevTools → Network 刷新，**应只看到 4 个同源请求**：`index.html`、`style.css`、`cities.js`、`app.js`（外加一个内联 SVG favicon，不算外部请求）。没有任何第三方域名请求即正确。

### 2.3 构建项目

**本项目不涉及。** 没有 `build.js`、没有打包、没有生成产物——源文件即生产文件。

### 2.4 后端服务

**本项目不涉及。** 纯静态，没有 `server.mjs`、没有 API、没有 SSE。

### 2.5 小游戏（微信/抖音）

**本项目不涉及。** 这是 H5 网页工具，不是小游戏，没有 `wechat-minigame/` 目录。

### 2.6 运行自带测试

项目有三个测试脚本，都从**仓库根**运行（路径写死了相对关系）。

**依赖说明**：
- `test/tz.mjs` 是纯 Node 脚本，**不需要浏览器**，直接跑。
- `test/smoke.mjs` 和 `test/qa-extra.mjs` 用 **Playwright**（`import { chromium } from "playwright"`）。
  - 本仓库根 `package.json` 已声明 `"playwright": "^1.61.1"` 依赖；先在仓库根 `npm install` 装好。
  - `smoke.mjs` / `qa-extra.mjs` 里写死了浏览器路径 `executablePath: "/opt/pw-browsers/chromium"`（本环境预装的 chromium）。**在你自己的普通电脑上没有这个路径**，需先 `npx playwright install chromium`，然后把脚本里的 `executablePath: "/opt/pw-browsers/chromium"` 改掉——最简单是删掉这个参数让 Playwright 用自己下载的默认 chromium：把 `chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })` 改成 `chromium.launch()`。（这是本地测试用改动，不影响生产文件，别提交。）

跑测试（从仓库根 `/home/user/claude-test`）：

```bash
cd /home/user/claude-test
npm install                      # 装 playwright（首次）
npx playwright install chromium  # 装浏览器（本地机器需要；本环境已内置可跳过）

# 1) 纯算法测试（无浏览器，秒回）
node projects/overlap/test/tz.mjs
```

期望输出结尾：

```
  ok    「shen」 reaches Shenzhen
  ok    garbage query → no results, no crash (want 0, got 0)
  ok    empty query → empty (want 0, got 0)

ALL GREEN (tz.mjs)
```

```bash
# 2) 冒烟测试（Playwright，双视口截图 + 零 console error + 中文搜索 + 卡片非空 + 垃圾 localStorage + reduced-motion）
node projects/overlap/test/smoke.mjs

# 3) 对抗性 QA（独立 Intl 路径复核每个时区断言 + 里程表滥用：负数/1e12/NaN/未来日期/时钟回拨）
node projects/overlap/test/qa-extra.mjs
```

两个 Playwright 脚本期望各自以类似 `ALL GREEN` 收尾、无 `FAIL`。截图落在 `projects/overlap/test/screenshots/`。上线前这三个必须全绿（对应 PLAYBOOK 第九节 checklist 前三条）。

---

## 3. 上线前必改（精确到文件 + 常量 / 行）

仓库里统一用 `overlap.love` 作占位域名。**如果你就用 overlap.love 这个域名，则域名部分无需改**，只需生成 `og-card.png`。**如果换成你自己的域名**（下表以 `yourdomain.com` 示意），按下表逐处替换。

| # | 文件 | 位置（行号 / 选择器） | 现值 | 改成 |
|---|---|---|---|---|
| 1 | `index.html` | 第 11 行 `<meta property="og:url">` | `https://overlap.love/` | `https://yourdomain.com/` |
| 2 | `index.html` | 第 12 行 `<meta property="og:image">` | `https://overlap.love/og-card.png` | `https://yourdomain.com/og-card.png` |
| 3 | `index.html` | 第 138 行 页脚 `<span>` | `overlap.love · made for the distance` | `yourdomain.com · made for the distance` |
| 4 | `app.js` | 第 1013 行 分享卡 Canvas 页脚 `ctx.fillText("overlap.love", ...)` | `overlap.love` | `yourdomain.com` |
| 5 | `app.js` | 第 1033 行 文本版最后一行 `lines.push("overlap.love")` | `overlap.love` | `yourdomain.com` |

> 说明：`app.js` 里域名只出现在这两处（分享卡图上的落款、复制文本的落款）。没有独立的「域名常量」——它们是硬编码字符串，直接改字面量即可。canonical 标签当前 HTML 里**没有单独的 `<link rel="canonical">`**，OG 的 `og:url`（第 11 行）承担了规范 URL 的作用；若你想额外加 canonical，可在 `<head>` 内 og:url 附近加一行 `<link rel="canonical" href="https://yourdomain.com/">`。

**改完如何验证**：

- 第 1–3 处（HTML）：本地起服务器（2.2 节）打开页面，DevTools → Elements 搜 `og:url` 确认是新域名；页脚肉眼确认落款。
- 第 4–5 处（app.js）：选两城 → 点 "Copy as text"，粘贴出来最后一行应是新域名；点 "Save the card" 生成 PNG，卡片左下落款应是新域名。或跑 `node projects/overlap/test/tz.mjs` 确认 `node --check` 级别没语法错（改字符串不会破坏逻辑，但保险起见跑一遍）。

**必做：生成 `og-card.png`**（社交预览卡图，`og:image` 指向它）。用产品自己生成：

1. 本地起服务器打开站点（2.2 节）。
2. YOU 选 `New York`，THEM 选 `Tokyo`（或任意你喜欢的一对）。
3. 点 **"Save the card"**，浏览器会下载一张 `overlap-<idA>-<idB>.png`（1080×1350）。
4. 把它**改名为 `og-card.png`**，放到**站点根目录**（和 `index.html` 同级）。上传到生产时一并上传。

**构建/后端/小游戏相关的上线前改动**：本项目不涉及构建重跑、环境变量、appid/广告位。

---

## 4. 部署（主链路，≥2 方案，主推 Cloudflare Pages）

以下所有方案，「要部署的目录」= 包含 `index.html` `style.css` `app.js` `cities.js` `og-card.png` 的那个目录。monorepo 方式 A 下是 `projects/overlap`；独立方式 B 下就是仓库根。

### 方案 A（主推）· Cloudflare Pages

免费、全球边缘 CDN、无冷启动、自动 HTTPS。两条路线任选。

#### 路线 ① 连 Git（网页操作，改代码自动重新部署）

1. 先把代码推到 GitHub（若还没）：

   ```bash
   cd /home/user/claude-test
   git add -A && git commit -m "overlap: ready to deploy"
   git push origin main
   ```

2. 登录 <https://dash.cloudflare.com> → 左侧 **Workers & Pages** → **Create** → 选 **Pages** 标签 → **Connect to Git**。
3. 授权 GitHub、选中你的仓库（`claude-test`），点 **Begin setup**。
4. 关键设置（针对 monorepo 子目录）：
   - **Project name**：`overlap`（决定临时域名 `overlap.pages.dev`）。
   - **Production branch**：`main`。
   - **Framework preset**：`None`。
   - **Build command**：**留空**（本项目无构建）。
   - **Build output directory**：填 `projects/overlap`（monorepo 方式 A）。若用独立仓库（方式 B），填 `/` 或留默认根。
   - 展开 **Root directory (advanced)**：可留空；填 `projects/overlap` 也行（那样 Output directory 就填 `/`）。二者选其一，别重复叠加。
5. 点 **Save and Deploy**。约 1 分钟后得到 `https://overlap.pages.dev`，打开验证。
6. 之后每次 `git push`，Cloudflare 自动重新部署。

#### 路线 ② 命令行 wrangler 直传（不连 Git，一条命令上线）

```bash
# 全局装 wrangler（或用 npx，无需全局装）
npm i -g wrangler
# 首次登录（会开浏览器授权）
wrangler login

# 直传项目目录（从仓库根执行）
cd /home/user/claude-test
wrangler pages deploy projects/overlap --project-name=overlap
```

期望输出末尾给出一个部署 URL（`https://<hash>.overlap.pages.dev`）和别名。打开即上线。以后改完文件重跑同一条命令即可。

### 方案 B（备选）· Vercel 或 Netlify

#### Vercel

在**要部署的目录**放一个 `vercel.json`（顺便把第 6 节缓存头一并配好，见下）。然后：

```bash
npm i -g vercel
cd /home/user/claude-test/projects/overlap
vercel --prod
```

首次会问项目名、scope，一路默认即可；上线后给 `https://<项目>.vercel.app`。

**`vercel.json` 完整文件内容**（放置路径：**项目目录** `/home/user/claude-test/projects/overlap/vercel.json`）：

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "headers": [
    {
      "source": "/index.html",
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
      "source": "/(.*)\\.(png|jpg|jpeg|svg|ico|webp)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=86400" }
      ]
    }
  ]
}
```

#### Netlify

```bash
npm i -g netlify-cli
cd /home/user/claude-test/projects/overlap
netlify deploy --dir=. --prod
```

**`netlify.toml` 完整文件内容**（放置路径：**项目目录** `/home/user/claude-test/projects/overlap/netlify.toml`）：

```toml
[build]
  publish = "."
  command = ""

# 缓存头见第 6 节的 _headers 文件；netlify.toml 也可写 [[headers]]，二选一即可。
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
  for = "/og-card.png"
  [headers.values]
    Cache-Control = "public, max-age=86400"
```

> monorepo 方式 A 下，若你在 Netlify 网页端连 Git，需在 **Base directory** 填 `projects/overlap`、**Publish directory** 填 `projects/overlap`（或 Base 填 `projects/overlap`、Publish 填 `.`）。

### 方案 C（备选）· GitHub Pages

本项目**无构建**，最简单是网页配置：

1. 若用独立仓库（方式 B，4 个文件在仓库根）：GitHub 仓库 **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**。几十秒后给出 `https://<user>.github.io/<repo>/`。
2. monorepo 方式 A（文件在 `projects/overlap` 子目录）GitHub Pages 不能直接指子目录，用 Actions 把子目录发布出去。

**`.github/workflows/deploy.yml` 完整文件内容**（放置路径：**仓库根** `/home/user/claude-test/.github/workflows/deploy.yml`）：

```yaml
name: Deploy Overlap to GitHub Pages

on:
  push:
    branches: [main]
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

      - name: Upload site (only the overlap project subdir)
        uses: actions/upload-pages-artifact@v3
        with:
          path: projects/overlap

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

> 说明：本项目无构建，所以工作流里**没有** `setup-node` / `node build.js` 步骤——直接把 `projects/overlap` 目录作为 artifact 上传即可。推送到 `main` 后，去仓库 **Actions** 看这个 workflow 跑绿，然后 **Settings → Pages → Source** 选 **GitHub Actions**。
>
> **子目录相对路径注意**：GitHub Pages 走 `actions/upload-pages-artifact` 上传的是 `projects/overlap` 内部内容作为站点根，因此站内引用（`href="style.css"`、`src="app.js"`、`src="cities.js"`）都是相对路径，天然正确。但 `og:image` 用的是绝对 URL（`https://.../og-card.png`），部署到 `user.github.io/repo/` 这种带子路径的地址时，OG 图 URL 必须指向 `og-card.png` 的真实绝对地址——所以 GitHub Pages 上线**强烈建议绑定自定义根域名**（第 5 节），否则把第 3 节表里 og:url/og:image 改成 `https://<user>.github.io/<repo>/` 与 `https://<user>.github.io/<repo>/og-card.png`。

### 方案 D（可选）· 自建 Nginx

买一台 VPS，把 5 个生产文件放到 `/var/www/overlap`，用如下 server 块。

**Nginx server 块完整内容**（放置路径：`/etc/nginx/sites-available/overlap`，再 `ln -s` 到 `sites-enabled/`）：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name overlap.love www.overlap.love;

    root /var/www/overlap;
    index index.html;

    # HTML：即时回源，文案/逻辑常更新
    location = /index.html {
        add_header Cache-Control "no-cache, must-revalidate";
    }
    location = / {
        add_header Cache-Control "no-cache, must-revalidate";
    }

    # CSS/JS：1 小时（未做文件名指纹，勿设更长）
    location ~* \.(css|js)$ {
        add_header Cache-Control "public, max-age=3600";
    }

    # 图片/OG 卡：1 天
    location ~* \.(png|jpg|jpeg|svg|ico|webp)$ {
        add_header Cache-Control "public, max-age=86400";
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
```

启用并签发 HTTPS：

```bash
sudo ln -s /etc/nginx/sites-available/overlap /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d overlap.love -d www.overlap.love
```

certbot 会自动改写上面的 server 块加上 443/证书并配置自动续期。

### 【后端项目】

**本项目不涉及。** Overlap 无服务端，不需要 Fly.io / Railway / VPS 常驻进程 / SSE / 持久卷 / 备份 cron。（这些属于像「the-last-sentence」那类含后端的项目。）

### 【小游戏项目】

**本项目不涉及。** Overlap 是 H5 网页，不是微信/抖音小游戏，无需 appid 申请、开发者工具导入、adapter、审核类目/版号流程。（这些属于像「body-clock」那类小游戏项目。）

---

## 5. 自定义域名 + DNS + HTTPS

### 5.1 买域名

在任一注册商买 `overlap.love`（或你选的域名）：Cloudflare Registrar（无溢价、买了顺手用 Cloudflare Pages 最省事）、Namecheap、Porkbun、阿里云/腾讯云（国内）。`.love` 顶级域大多数注册商都支持。

### 5.2 各平台绑定域名步骤

- **Cloudflare Pages**：项目页 → **Custom domains** → **Set up a domain** → 输入 `overlap.love` → 若域名的 DNS 就在 Cloudflare，它会**自动加好 CNAME 记录并签发证书**，一键完成。再加一个 `www.overlap.love` 同理。
- **Vercel**：项目 → **Settings → Domains** → 添加 `overlap.love`，按它提示去注册商加记录（见下表）。
- **Netlify**：**Domain settings → Add custom domain**，按提示加记录。
- **GitHub Pages**：仓库 **Settings → Pages → Custom domain** 填 `overlap.love` → Save（会在站点目录生成 `CNAME` 文件），勾选 **Enforce HTTPS**。

### 5.3 DNS 记录表（按你用的平台选一组填到注册商 DNS）

| 平台 | 类型 | 主机名 | 值 | 说明 |
|---|---|---|---|---|
| **Cloudflare Pages** | CNAME | `overlap.love`（@，根域） | `overlap.pages.dev` | CF 内部用 CNAME flattening，根域可 CNAME；在 CF 面板加会自动配好 |
| Cloudflare Pages | CNAME | `www` | `overlap.pages.dev` | www 子域 |
| **Vercel** | A | `overlap.love`（@） | `76.76.21.21` | 根域 A 记录 |
| Vercel | CNAME | `www` | `cname.vercel-dns.com` | www 子域 |
| **GitHub Pages** | A | `overlap.love`（@） | `185.199.108.153` | 4 条 A 记录，逐条加 |
| GitHub Pages | A | `overlap.love`（@） | `185.199.109.153` | |
| GitHub Pages | A | `overlap.love`（@） | `185.199.110.153` | |
| GitHub Pages | A | `overlap.love`（@） | `185.199.111.153` | |
| GitHub Pages | CNAME | `www` | `<user>.github.io` | 把 `<user>` 换成你的 GitHub 用户名 |
| **Netlify** | A | `overlap.love`（@） | `75.2.60.5` | Netlify 负载均衡 IP（也可用它给的 ALIAS/CNAME） |
| Netlify | CNAME | `www` | `<你的站点>.netlify.app` | |

改 DNS 后传播通常几分钟到几十分钟。用 `dig overlap.love +short` 或 `nslookup overlap.love` 验证解析已指向目标。

### 5.4 HTTPS 自动签发

Cloudflare Pages / Vercel / Netlify / GitHub Pages **都会为自定义域名自动签发并续期 Let's Encrypt 证书**，你无需手动操作，通常绑定后几分钟内 `https://` 生效。自建 Nginx 用第 4 节方案 D 里的 certbot。

**国内内嵌浏览器强制 HTTPS**：微信、QQ、小红书等 App 内置浏览器对 `http://` 页面会拦截或降权，且分享卡的 OG 抓取也要求 HTTPS。务必确认 `https://overlap.love` 与 `https://www.overlap.love` 都能开、且 http 自动跳 https（上述平台默认帮你跳）。本项目虽是工具型 H5、非小游戏，但既然主打社交分享，HTTPS 是硬要求。

---

## 6. 缓存策略（可照抄配置全文）

目标响应头：

- **HTML（`index.html`、`/`）**：`Cache-Control: no-cache, must-revalidate` —— 文案/逻辑随时可能更新，必须即时回源，避免用户看到旧版首屏。
- **CSS / JS（`style.css`、`app.js`、`cities.js`）**：`Cache-Control: public, max-age=3600`（1 小时）。**关键红线：本项目文件名没有做指纹（没有 `app.v2.js` 这种哈希后缀），所以绝不能设超长缓存**，否则改了 JS 用户一小时内甚至更久还在跑旧代码。若哪天想上长缓存，先把 `index.html` 里对 `app.js`/`style.css`/`cities.js` 的引用改成带版本号（如 `app.js?v=2` 或改名 `app.v2.js`），再设 `max-age=31536000, immutable`。
- **图片 / OG（`og-card.png`、SVG 图标）**：`Cache-Control: public, max-age=86400`（1 天）。

### Cloudflare Pages / Netlify —— `_headers` 文件

**完整文件内容**（放置路径：**要部署的目录根**，即项目目录 `/home/user/claude-test/projects/overlap/_headers`；随站点一起上传）：

```
/index.html
  Cache-Control: no-cache, must-revalidate

/
  Cache-Control: no-cache, must-revalidate

/*.css
  Cache-Control: public, max-age=3600

/*.js
  Cache-Control: public, max-age=3600

/og-card.png
  Cache-Control: public, max-age=86400
```

Cloudflare Pages 与 Netlify 都原生识别站点根的 `_headers` 文件，无需额外配置。

### Vercel —— `vercel.json` 的 headers 段

见第 4 节方案 B 里给出的 **`vercel.json` 完整文件**，其 `headers` 数组已按上述策略配好，无需重复。

### Nginx —— location 段

见第 4 节方案 D 的 server 块，其中三段 `location`（`= /index.html`、`~* \.(css|js)$`、`~* \.(png|...)$`）即缓存配置全文。

---

## 7. SEO 上线

本项目是工具型、且 MARKETING 第 4 节把 SEO 当重点（长距离时区/城市对长尾词），所以做完整集。

### 7.1 robots.txt 与 sitemap.xml

本项目**无构建**，不会自动生成这两个文件，需手动新增（放站点根，随站点上传）。

**`robots.txt` 完整文件内容**（放置路径：项目目录 `/home/user/claude-test/projects/overlap/robots.txt`）：

```
User-agent: *
Allow: /

Sitemap: https://overlap.love/sitemap.xml
```

**`sitemap.xml` 完整文件内容**（放置路径：项目目录 `/home/user/claude-test/projects/overlap/sitemap.xml`）。本站是单页应用，深链走 URL hash（`#new-york/tokyo`），而 hash 不被搜索引擎当独立 URL 索引，所以 sitemap 只列根 URL：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://overlap.love/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

> 若换了域名，把上面两个文件里的 `overlap.love` 一并换掉。上线后访问 `https://overlap.love/robots.txt` 和 `.../sitemap.xml`，浏览器返回 **200** 且内容正确即可。
>
> 注：`<urlset xmlns>` 的标准命名空间是 `http://www.sitemaps.org/schemas/sitemap/0.9`——照抄时确保这一行准确（搜索引擎对命名空间宽容，但建议用官方值：`xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`）。

### 7.2 Google Search Console

1. 打开 <https://search.google.com/search-console> → 添加资源 → 选 **网域（Domain）** 输入 `overlap.love`。
2. 它给一条 TXT 记录，去注册商 DNS 加上，回来点验证。
3. 验证通过后 → 左侧 **Sitemaps** → 输入 `sitemap.xml` → 提交。
4. 用 **URL 检查** 工具对 `https://overlap.love/` 请求编入索引。

### 7.3 Bing Webmaster

<https://www.bing.com/webmasters> → 新增站点 → 选 **Import from Google Search Console** 一键导入，省去重复验证与重新提交 sitemap。

### 7.4 OG 卡图调试

发链接前先在各平台调试器确认 `og-card.png` 能抓到、卡片正确：

- Facebook Sharing Debugger：<https://developers.facebook.com/tools/debug/> 输入 `https://overlap.love/`，点 **Scrape Again** 刷新缓存。
- X（Twitter）Card Validator / 直接发一条草稿预览。
- Telegram：把链接发给 @WebpageBot 或直接发到「Saved Messages」看预览。

确认标题（`index.html` 第 8 行 `og:title`）、描述（第 9 行）、图（第 12 行 `og:image` 指向的 `og-card.png`）都对。**OG 抓取有缓存**，改了图或 meta 后必须用上面的调试器强制重抓，否则社媒仍显示旧卡（见第 11 节故障表）。

---

## 8. 变现挂点激活

产品的核心转化资产是**分享卡**，不是广告 CPM（DEPLOY 旧版、PLAYBOOK 已定调）。广告只作补充，且克制。

### 8.1 Google AdSense

- **申请门槛**：站点已上线、有真实内容与流量、绑定自定义域名。用 AdSense 后台添加站点 `overlap.love`，等待审核（几天到两周）。
- **`ads.txt`**（放站点根，声明谁有权卖你的广告位）。**完整文件内容**（放置路径：项目目录 `/home/user/claude-test/projects/overlap/ads.txt`，`pub-XXXXXXXXXXXXXXXX` 换成你 AdSense 后台的 publisher ID）：

  ```
  google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
  ```

- **广告位在哪**：`index.html` 第 132–136 行的页脚广告容器：

  ```html
  <div class="slot" id="adSlot">Overlap is free and runs entirely in your browser. If it helped, send it to the person it's about.</div>
  ```

  第 133–135 行的 HTML 注释已写明激活方式。**激活步骤**：把 `#adSlot` 这个 `<div>` 的**内部文字**替换成你的 AdSense 广告单元代码（`<ins class="adsbygoogle" ...></ins>` + AdSense 官方 `<script>` 引入），**保留 `<div class="slot" id="adSlot">` 容器与其 class**（样式靠它）。例如：

  ```html
  <div class="slot" id="adSlot">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="1234567890" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
  </div>
  ```

- **红线**（DEPLOY 旧版第 3 节）：只此一个位、只在页脚、不加浮动/插屏/横幅图。想去掉虚线框就删 `.slot` 的 `border` 样式。改的是 `index.html` 一个文件、无需重新构建，改完重新部署即全站生效。

### 8.2 联盟位（可选）

按 MARKETING 第 5 节的克制挂法：日 UV 稳定 >500 再挂；只在页脚 `index.html` 第 137 行 `.foot-lines` 里加**一行文字链**（如机票比价 affiliate），加 `rel="sponsored"`，样式跟随 `footer a`，不加卡片/图/弹层/「限时」字样。

### 8.3 小游戏变现

**本项目不涉及**（无流量主/激励视频/adUnitId/`res.isEnded` 合规红线/诱导分享红线——那是小游戏项目的事）。

---

## 9. 上线后自检清单

逐项打勾（对应 PLAYBOOK 第九节 + 本指南）：

- [ ] `node projects/overlap/test/tz.mjs` → `ALL GREEN (tz.mjs)`
- [ ] `node projects/overlap/test/smoke.mjs` 全绿、零 console error
- [ ] `node projects/overlap/test/qa-extra.mjs` 全绿
- [ ] `https://overlap.love` 与 `https://www.overlap.love` 都能开，http 自动跳 https
- [ ] 真机 **iOS Safari**：`<input type="time" step="900">` 可选、`<input type="date">` 可选、"Save the card" 能存到相册、页面无横向滚动（灯带在自身容器内横滚，整页不横滚）
- [ ] 真机 **Android Chrome**：同上，下载 PNG 正常
- [ ] OG 卡：把 `https://overlap.love/#new-york/tokyo` 发到 Slack/微信/X，卡图正确渲染（先过第 7.4 调试器）
- [ ] 跨时区正确：随手选一对已知时差的城市（如 NYC↔Tokyo 13h），核对灯带与「runs Xh ahead」
- [ ] 跨午夜换题/换窗口：在窗口边界前后观察倒计时与窗口名切换正常
- [ ] 中文搜索命中：输入「东京」「三藩市」能选到
- [ ] Lighthouse 移动端 Performance ≥ 95（DevTools → Lighthouse → Mobile；全页 <100KB、零第三方请求，应轻松达标）
- [ ] DevTools Network：生产页只有同源请求（4 个源文件 + og-card.png 按需），无第三方
- [ ] 里程表：选两城、开着页面、双方都空闲时圆点发光并累积；刷新后数字不减（localStorage 生效）

**后端 / 小游戏相关自检**（两网络设备 SSE 互见、同出口 IP 429、震动手感、iOS 高刷计时、激励视频无填充等）：**本项目不涉及**。

---

## 10. 持续更新与运维

**改数据 / 文案的标准流程**（本项目无构建，流程很短）：

1. 改源文件（例如给 `cities.js` 加城市、改 `app.js` 文案、调 `style.css`）。
2. `node --check` 快速语法自检（可选）：
   ```bash
   cd /home/user/claude-test/projects/overlap
   node --check app.js && node --check cities.js && echo "syntax ok"
   ```
3. 跑测试（改了 `cities.js`／时区逻辑**必跑** tz.mjs，它会验证所有 zone 可被 Intl 解析、id 唯一、字段齐全）：
   ```bash
   cd /home/user/claude-test
   node projects/overlap/test/tz.mjs
   node projects/overlap/test/smoke.mjs
   ```
4. 重新部署：
   - 连了 Git（Cloudflare/Vercel/Netlify/GitHub Pages）→ `git push` 自动部署。
   - 用 wrangler 直传 → 重跑 `wrangler pages deploy projects/overlap --project-name=overlap`。
5. 部署后如果改的是 `og-card.png` 或 OG meta，去第 7.4 的调试器强制重抓。

**城市 id 稳定性红线**（PLAYBOOK 第三节）：`cities.js` 里 id 由脚本按名字 slug 生成，用于 URL hash 与里程表 key，**上线后不可更名**——改了会让老用户的分享链接与里程表账本失联。加城市可以，改已有城市的 id 不行。

**后端运维**（备份 / 日志 / 监控 / 回滚 / 墓地编号连续）：**本项目不涉及**。静态站的「回滚」就是在托管平台的 Deployments 列表里把某个历史部署 **Rollback / Promote** 回去（Cloudflare Pages、Vercel、Netlify 都有一键回滚）。

**运营节奏**：见 PLAYBOOK 第十节 4 周表 + MARKETING。每周固定看一次里程表相关反馈——「共同清醒小时数」是命根子，任何「数字变小了」的反馈按 P0 处理。

---

## 11. 故障排查表

| 症状 | 可能原因 | 解决 |
|---|---|---|
| 用 `file://` 直开，里程表不记账/不记住城市 | 部分浏览器在 `file://` 或隐身模式禁用 `localStorage` | 用本地服务器（2.2 节）或线上访问；功能本身不受影响，只是不持久（属已知边界） |
| 社媒分享仍显示旧卡图/旧标题 | OG 抓取有缓存 | 用第 7.4 调试器（Facebook Debugger「Scrape Again」等）强制重抓；确认 `og-card.png` 已上传且 `og:image` URL 正确 |
| 改了 `app.js`/`style.css` 但用户还看到旧版 | CSS/JS 被缓存（未做文件名指纹） | 缓存别超 `max-age=3600`（第 6 节）；紧急时给引用加版本号 `app.js?v=2` 或改名 `app.v2.js` 并同步改 `index.html` 引用 |
| GitHub Pages 部署后样式/脚本 404 或图裂 | 站点在 `user.github.io/<repo>/` 子路径下，绝对 URL 失配 | 站内引用已是相对路径本身没问题；`og:image` 用了绝对 URL——绑自定义根域名（第 5 节），或把第 3 节表里 og:url/og:image 改成带 `<repo>` 子路径的绝对地址 |
| OG 卡图不显示 | `og-card.png` 没上传，或 `og:image` 指向的域名/路径不对 | 按第 3 节生成并放站点根，确认 `https://<域名>/og-card.png` 返回 200 |
| 首屏出现第三方请求 / 报 CSP 或跨域错 | 误引入了外部资源 | 本项目应零第三方请求；检查是否手滑加了外链字体/脚本；DevTools Network 确认只剩同源 |
| 选了城市但灯带/时差不对 | 极少数——某 IANA zone 拼错或本机 Intl 数据老 | 跑 `node projects/overlap/test/tz.mjs`，它对 DST 三时刻、日界线、半小时区做断言；tz 数据由平台负责，升级 OS/Node 可修 |
| 跨午夜时窗口名/倒计时突变 | 正常行为：跨 15 分钟/午夜边界会重采样换窗口 | 非 bug；若数值明显错则跑 tz.mjs 复核 |
| 微信内 `navigator.vibrate` 无效 | 微信内嵌浏览器不支持震动 | 本产品无强震动依赖；若后续加了震动反馈，需静默降级（try/catch，不弹错） |
| Playwright 测试报找不到浏览器 | 脚本写死了 `executablePath: "/opt/pw-browsers/chromium"`（本环境专用路径） | 本地先 `npx playwright install chromium`，把该参数删掉让其用默认 chromium（2.6 节）；此改动别提交 |
| 里程表数字异常（负数/暴涨） | 损坏或被篡改的 localStorage | 逻辑已对垃圾数据回退 `{ms:0, met:null}`（PLAYBOOK 第六节，qa-extra 有滥用用例）；用户清 `overlap:v1:meter:*` 即重置 |

---

### 后端 / 小游戏专属章节小结

本指南骨架保留了「后端项目」与「小游戏项目」的位置，Overlap 作为**纯静态 H5 工具**，这两类内容全部标注为「本项目不涉及」：无服务端进程、无容器/Dockerfile/systemd、无 SSE、无持久卷/备份、无微信/抖音小游戏发布流程。若未来做「二期配对短链 + 服务端时间」（PLAYBOOK 第六节提到的防作弊里程表），届时再引入后端方案（Fly.io/Railway 单实例 + 持久存储），本指南第 4 节后端骨架可作起点。
