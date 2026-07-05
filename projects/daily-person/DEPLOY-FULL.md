# 每日一人（Daily Person）· 全栈部署详解（从 0 到上线）

> 本指南假设你是一台全新电脑、什么都没装。从装 Node、装 Git、注册账号，一直到自定义域名、HTTPS、缓存、SEO、变现、上线后运维，每一条命令都能照抄执行。凡涉及源码的文件名、常量名、常量值、行号，均来自本项目真实源码（已逐一核对）。

---

## 0. 这是什么 / 架构判定

**产品**：「每日一人」是一款中文每日猜人物游戏。每天零点（玩家本地时间）全球翻开同一位历史人物，玩家只能问「是/否」问题（46 个，按时代/地域/领域/身份/生平五类索引），看几问能把 TA 从 111 人的辞典里揪出来。猜中后翻到一页手写辞条（首字纹章、生卒年、150–250 字小传、墓志铭），战绩可复制成 🟦🟥🎯 轨迹文本或存成 1080×1350 竖版 PNG 分享卡，**零剧透**（分享内容里永不出现人名）。传播点：同题社交（群里报问数抬杠）+ 战绩可炫耀零剧透 + 小传可二次转发。

**架构判定：纯静态站（static）**。判定依据：

- 全部逻辑在客户端 `app.js`，数据内嵌在 `people.js` / `questions.js`（`window.DP_PEOPLE` / `window.DP_QUESTIONS`），页面**不做任何 fetch**，`file://` 双击即可玩；
- **无构建步骤**（没有 `package.json`、没有 `build.js`、没有打包器）；上传的就是源码本身；
- **无后端、无数据库、无环境变量**；连胜/纪录存 `localStorage`（键 `dailyperson.v1`）；
- 每日题目由固定种子（1129）洗牌 + 本地日期算期号得出，全球同一天同题，与服务器无关；
- 总重约 136KB（< 150KB），托管成本 ≈ 0。

所以本指南「全栈链路」对本项目落地为：本机装环境 → 本地跑通 → （无构建，跳过）→ 静态托管上线 → 全球 CDN → 自定义域名/DNS/HTTPS → 缓存头 → SEO → AdSense 变现 → 上线后运维。凡纯静态不涉及的服务端/容器小节，保留编号并注明「本项目不涉及」。

**文件清单（真实文件，逐个列出）**：

| 文件 | 作用 | 是否需上传到生产 |
|------|------|------------------|
| `index.html` | 页面骨架、meta/OG、内联 favicon、加载三个脚本 | ✅ 必须 |
| `style.css` | 全部样式（三色报纸风、落章动效、响应式） | ✅ 必须 |
| `app.js` | 主逻辑：排期、问答、猜名容错、分享卡 canvas、`SITE_URL`/`EPOCH0` | ✅ 必须 |
| `people.js` | 人物库数据（111 人，写入 `window.DP_PEOPLE`） | ✅ 必须 |
| `questions.js` | 问题库与分类（写入 `window.DP_QUESTIONS` / `DP_CATS`） | ✅ 必须 |
| `DEPLOY.md` | 旧版简版部署说明（本文件是其从 0 扩写版） | ❌ 不上传 |
| `DEPLOY-FULL.md` | 本文件 | ❌ 不上传 |
| `DESCRIPTION.md` / `PLAYBOOK.md` / `MARKETING.md` | 产品/策划/营销文档 | ❌ 不上传 |
| `test/data.mjs` | 数据一致性测试（纯 Node） | ❌ 不上传 |
| `test/smoke.mjs` | Playwright 冒烟测试（截图） | ❌ 不上传 |
| `test/qa-extra.mjs` | 对抗性验收测试（Playwright） | ❌ 不上传 |
| `test/screenshots/` | 测试输出截图目录 | ❌ 不上传 |

生产环境只需要 5 个文件：`index.html`、`style.css`、`app.js`、`people.js`、`questions.js`。favicon 已作为 `data:image/svg+xml` 内联在 `index.html` 第 11 行，**不需要**额外的 favicon 文件。

> 全文约定：**仓库根** = `/home/user/claude-test`（monorepo）；**本项目目录** = `/home/user/claude-test/projects/daily-person`，相对仓库根为 `projects/daily-person`。命令若从仓库根执行会注明「在仓库根」，若从项目目录执行会注明「在项目目录」。

---

## 1. 从零准备环境

### 1.1 安装 Node.js（LTS，≥18；本仓库实测 v22）

本项目**运行不需要 Node**（纯静态，浏览器直开即可）。装 Node 是为了：跑本地静态服务器（`npx serve`）、跑自带测试（`node test/*.mjs`）、用命令行工具部署（`wrangler` / `vercel`）。装 LTS 版本即可，≥18 都行，本仓库实测在 v22 下全绿。

**macOS（推荐 Homebrew）**：

```bash
# 没装 Homebrew 先装（官网一行脚本）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node        # 装最新版
```

或用 nvm（可切多版本，跨平台通用）：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# 关掉终端重开，或 source ~/.zshrc
nvm install --lts        # 装最新 LTS
nvm use --lts
```

**Windows（winget，Win10/11 自带）**：

```powershell
winget install OpenJS.NodeJS.LTS
```

**Linux（nvm，推荐；发行版无关）**：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install --lts
nvm use --lts
```

或 Debian/Ubuntu 用 NodeSource：

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**验证**（三平台通用）：

```bash
node -v
npm -v
```

期望输出（版本号只要大版本 ≥18 即可，本仓库实测）：

```
v22.22.2
10.9.7
```

### 1.2 安装并配置 Git

- **macOS**：`brew install git`（或首次运行 `git` 会提示装 Xcode Command Line Tools）
- **Windows**：`winget install Git.Git`
- **Linux**：`sudo apt-get install -y git`（Debian/Ubuntu）

配置身份（提交记录会用到，全局一次即可）：

```bash
git config --global user.name "你的名字"
git config --global user.email "ericgu050714@gmail.com"
git config --global init.defaultBranch main
```

验证：

```bash
git --version          # 例：git version 2.43.0
git config --global user.name    # 回显你的名字
```

### 1.3 需要注册的账号

逐个列出，用途 + 是否免费：

| 账号 | 用途 | 是否免费 |
|------|------|----------|
| **GitHub**（github.com） | 托管代码；连 Git 自动部署；GitHub Pages 备选托管 | 免费 |
| **Cloudflare**（dash.cloudflare.com） | 主推托管平台 Cloudflare Pages + 全球 CDN + DNS + 自动 HTTPS | 免费额度足够 |
| **域名注册商**（任选：Cloudflare Registrar / Namecheap / 阿里云 / Porkbun） | 买正式域名替换占位域名 | 付费（约 ¥60–120/年，`.com`） |
| **Vercel**（vercel.com）或 **Netlify**（netlify.com） | 备选托管方案 B | 免费额度足够 |
| **Google AdSense**（adsense.google.com） | 变现（揭晓页广告位），需内容量过审，建议上线两周后申请 | 免费申请，按分成 |
| **Google Search Console**（search.google.com/search-console） | SEO：提交 sitemap、验证域名 | 免费 |

后端平台（Fly.io / Railway）、微信/抖音开放平台：**本项目不涉及**（纯静态，无服务端、非小游戏）。

### 1.4 取得代码

本项目在 monorepo `ERICYOOOOOO/claude-test` 的 `projects/daily-person` 子目录。

**方式一：克隆整个 monorepo**（最简单）：

```bash
cd ~/                                   # 或任意你想放代码的父目录
git clone https://github.com/ERICYOOOOOO/claude-test.git
cd claude-test/projects/daily-person    # 这就是本项目目录
ls
```

期望 `ls` 看到：

```
DEPLOY.md  DESCRIPTION.md  MARKETING.md  PLAYBOOK.md
app.js  index.html  people.js  questions.js  style.css  test
```

**方式二：只取本项目目录**（monorepo 很大时，用 sparse-checkout）：

```bash
cd ~/
git clone --no-checkout --filter=blob:none https://github.com/ERICYOOOOOO/claude-test.git
cd claude-test
git sparse-checkout init --cone
git sparse-checkout set projects/daily-person
git checkout main
cd projects/daily-person
```

后续所有命令，除非注明「在仓库根」，都在 `projects/daily-person` 目录里执行。

---

## 2. 本地运行与自验

### 2.1 直接浏览器打开 `index.html`（`file://`）

在项目目录里双击 `index.html`，或：

```bash
# macOS
open index.html
# Linux
xdg-open index.html
# Windows (PowerShell)
start index.html
```

`file://` 下**能玩到完整功能**：数据全内嵌、无 fetch，所以问答、猜名容错、翻辞条页、连胜、档案、跨午夜换题、复制战绩、存 PNG 分享卡都正常。

`file://` 下**唯一需要留意**：`navigator.clipboard` 在部分浏览器对 `file://` 源受限，「复制战绩」可能回退到旧式 `execCommand` 复制（`app.js` 已内置 `legacyCopy` 兜底，见 `copyShare()` 第 466 行）。要 100% 还原线上体验，走下一步的本地服务器。

### 2.2 起本地静态服务器

任选其一。**在项目目录执行**：

```bash
# 方式 A：Node（无需预装，npx 现拉现用）
npx serve .
# 输出里会给地址，通常是 http://localhost:3000

# 方式 B：Python3（很多系统自带）
python3 -m http.server 8000
# 访问 http://localhost:8000
```

浏览器打开对应地址即可，比 `file://` 更贴近生产（同源、`http://`，clipboard/存图行为一致）。

### 2.3 构建项目 —— 本项目不涉及

本项目**无构建步骤**：没有 `package.json`、没有 `build.js`、不需要打包/编译。上传的就是源码本身。凡本指南提到「构建项目重跑 build.js」的地方，本项目一律跳过。

### 2.4 后端起服 —— 本项目不涉及

纯客户端，无 `server.mjs`、无 SSE、无 API。本项目不涉及。

### 2.5 小游戏（微信/抖音）导入 —— 本项目不涉及

本项目是 H5 静态网页，无 `wechat-minigame/` 目录，不走小游戏发布流程。本项目不涉及。

### 2.6 运行自带测试

测试分两类。**纯 Node 测试**无需浏览器；**Playwright 测试**需要 Chromium。

**（a）纯 Node：数据一致性**（从**仓库根**运行）：

```bash
node projects/daily-person/test/data.mjs
```

它断言：111 人属性齐全合法、无重名、别名索引无冲突、每人对全部 46 问都有确定布尔答案、生卒年合理（寿命 ≤ 122、卒年不在未来、在世者不标死于非命/身后成名）、每题有区分度、题库结构合法。期望结尾打印 `全部通过 ✔  人物 111 / 问题 46`、退出码 0。

**（b）语法自检**（快速确认三个脚本无语法错）：

```bash
node --check projects/daily-person/app.js
node --check projects/daily-person/people.js
node --check projects/daily-person/questions.js
```

三条都无输出即通过。

**（c）Playwright 冒烟 + 对抗性验收**。这两个用到 `import { chromium } from "playwright"`，需要 Playwright 及其 Chromium：

```bash
# 本仓库/本容器已预装 Chromium，位于 /opt/pw-browsers/chromium，无需再下载。
# 一般机器首次需装（约 150MB）：
npx playwright install chromium
# 若报找不到 playwright 包，先在仓库根：npm i -D playwright

# 从仓库根运行（注意从根，脚本内以此定位 index.html）：
node projects/daily-person/test/smoke.mjs
node projects/daily-person/test/qa-extra.mjs
```

`smoke.mjs` 覆盖：双日种子稳定、问答落章、模糊猜名容错、分享文本/PNG、双视口截图；`qa-extra.mjs` 覆盖：全库 46 问答案向量两两不同（任何一期可被纯逻辑锁定）、排期 111 天不重复、猜名边界、练习不碰连胜、跨午夜换期、全程零 console error。截图落在 `projects/daily-person/test/screenshots/`。

期望：两个脚本结尾都无 `FAIL:`，即视为 ALL GREEN。每条断言以 `  ok:` 前缀逐行打印，末行是各脚本自己的通过提示：

```
  ok: ...
  ok: ...
冒烟测试全部通过 ✔        # smoke.mjs 末行
QA 对抗测试全部通过 ✔     # qa-extra.mjs 末行
```

（`data.mjs` 用 `failures` 计数，非 0 会以错误退出；CI 里可用 `&& echo PASS || echo FAIL` 判定。）

---

## 3. 上线前必改（精确到文件 + 常量/行）

以下每处都从真实源码核对。**⚠️ 标注的两处为硬门槛，不改会导致分享卡带占位域名、期号错位。**

| # | 文件 | 位置（常量/行/选择器） | 现值 | 改成 |
|---|------|------------------------|------|------|
| 1 ⚠️ | `app.js` | 第 11 行 `var SITE_URL` | `"meiri-yiren.pages.dev"` | 你的正式域名，如 `"meiriyiren.com"`（不带 `https://`、不带末尾斜杠） |
| 2 ⚠️ | `app.js` | 第 13 行 `var EPOCH0` | `Math.floor(Date.UTC(2026, 6, 4) / 86400000)`（第 1 期 = 2026-07-04） | 把 `(2026, 6, 4)` 改成真实上线日；月份从 0 计（6 = 7 月）。**上线后永不再改**，否则全部期号错位 |
| 3 | `index.html` | 第 6 行 `<title>` | `每日一人 · 用是/否问题猜出今天这位人物` | 可保留；如需带品牌关键词自行微调 |
| 4 | `index.html` | 第 7 行 `<meta name="description">` | `每天一位名人。你只能问是/否问题…` | 可保留；确认无占位域名混入 |
| 5 | `index.html` | 第 8–9 行 `og:title` / `og:description` | `每日一人` / `每天一位历史人物，只能问是/否问题。今天你几问破解？` | 可保留 |
| 6 | `index.html` | `<head>` 内（第 10 行 `og:type` 之后） | **当前没有** `canonical` / `og:url` / `og:image` | **新增**三行（见下方代码），把 URL 换成正式域名 |

**#6 需要新增的三行**（贴到 `index.html` 第 10 行 `<meta property="og:type" content="website">` 之后、第 12 行 `<link rel="stylesheet">` 之前）。把 `meiriyiren.com` 换成你的正式域名：

```html
<link rel="canonical" href="https://meiriyiren.com/">
<meta property="og:url" content="https://meiriyiren.com/">
<meta property="og:image" content="https://meiriyiren.com/og.png">
```

> 说明：`og:image` 需要一张 1200×630（或复用竖版分享卡的思路另做一张横版）预览图 `og.png` 放到站点根目录。若暂时没有，可**先删掉 `og:image` 那一行**（缺图不会报错，只是社交平台展示纯文字卡），上线后补。favicon 已内联在第 11 行，无需改动。

**注意**：`SITE_URL` 在 `app.js` 两处被用到，改一处（第 11 行常量）即两处同步生效：

- 第 461 行 `shareText()`：复制的文本战绩第 4 行就是 `SITE_URL`；
- 第 575 行 `drawShareCard()`：`ctx.fillText(SITE_URL, W / 2, H - 96)` 画在 PNG 分享卡底部。

**改完如何验证**：

```bash
# 语法没写坏
node --check projects/daily-person/app.js
# 逻辑/排期没被 EPOCH0 改动破坏
node projects/daily-person/test/qa-extra.mjs
```

再本地起服（2.2）打开 → 随便问三题 → 猜中翻到辞条页 → 点「复制战绩」，粘贴出来确认第 4 行是你的正式域名；点「保存图片」，打开 PNG 确认底部域名正确、报头「第 N 期」的 N 与你预期的上线日期号一致。

---

## 4. 部署（主链路，≥2 方案，主推 Cloudflare Pages）

本项目纯静态，走静态托管。下面给 4 个方案：**主推 A（Cloudflare Pages）**，B（Vercel/Netlify）、C（GitHub Pages）、D（自建 Nginx）。

> 关键前提：所有资源都用**相对路径**（`index.html` 里 `href="style.css"`、`<script src="app.js">`），因此**必须把这 5 个文件放在部署根目录**，而不是让它们停留在 `/projects/daily-person/` 子路径下。下面每个方案都说明了怎么把子目录映射为站点根。

### 方案 A：Cloudflare Pages（推荐，免费，自带全球 CDN + 自动 HTTPS）

#### 路线①：连 Git（网页操作，推送即部署）

1. 先把代码推到 GitHub（若还没推）。在**仓库根**：
   ```bash
   git add -A && git commit -m "daily-person: 上线前改域名与 EPOCH0"
   git push origin main
   ```
2. 登录 `dash.cloudflare.com` → 左侧 **Workers & Pages** → **Create application** → **Pages** 标签 → **Connect to Git**。
3. 授权 GitHub，选仓库 `ERICYOOOOOO/claude-test`。
4. 在构建设置里，**这是 monorepo 的关键**，按下表精确填写：

   | 字段 | 填什么 | 说明 |
   |------|--------|------|
   | Production branch | `main` | |
   | Framework preset | `None` | 纯静态无框架 |
   | **Build command** | 留空 | 本项目无构建 |
   | **Build output directory** | `projects/daily-person` | 让这个子目录成为站点根，5 个文件正好在此根下 |
   | Root directory (Advanced) | 留空（默认仓库根） | 若填了 `projects/daily-person`，则 Build output 改填 `.` |

   > 两种等价填法二选一：(a) Root 留空 + Output `projects/daily-person`；(b) Root 填 `projects/daily-person` + Output `.`。**不要两个都填子目录**，否则路径叠加成 `projects/daily-person/projects/daily-person` 找不到文件。
5. **Save and Deploy**。约 1 分钟后拿到 `https://<项目名>.pages.dev` 临时域名。以后 `git push` 到 `main` 自动重新部署。

#### 路线②：命令行 wrangler 直传（不连 Git，一条命令上线）

```bash
# 全局装 wrangler
npm i -g wrangler
# 首次登录（浏览器授权）
wrangler login

# 在仓库根执行；直接把子目录当站点根上传
wrangler pages deploy projects/daily-person --project-name=meiri-yiren
```

期望输出末尾给出一个 `https://<hash>.meiri-yiren.pages.dev` 部署 URL，打开即线上。以后每次改完重跑这条命令即可。

### 方案 B：Vercel（备选）

**命令行**（在仓库根）：

```bash
npm i -g vercel
vercel login
# 首次会问一串问题；把 root 设为项目子目录
vercel --cwd projects/daily-person
# 预览无误后正式发布：
vercel --cwd projects/daily-person --prod
```

若走 Vercel 网页连 Git：Import 仓库后，在 **Root Directory** 填 `projects/daily-person`，Framework Preset 选 **Other**，Build/Output 全留空。

Vercel 需要一个配置文件把缓存头一并带上（缓存策略见第 6 节，此处给完整文件）。**完整文件内容，放置路径 `projects/daily-person/vercel.json`**：

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
      "source": "/(.*)\\.(js|css)",
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

**备选 Netlify**：网页 **Add new site → Import** 选仓库，**Base directory** 填 `projects/daily-person`，Build command 留空，**Publish directory** 填 `projects/daily-person`（或 Base 填了就填 `.`）。或命令行 `npm i -g netlify-cli && netlify deploy --dir=projects/daily-person --prod`。缓存头用 `_headers` 文件（见第 6 节，Netlify 与 Cloudflare Pages 共用同一份 `_headers`）。

### 方案 C：GitHub Pages（免费，无构建可直接用）

本项目无构建，最简单是**网页操作**：

1. GitHub 仓库 → **Settings** → **Pages**。
2. **Build and deployment** → Source 选 **Deploy from a branch**。
3. Branch 选 `main`，文件夹下拉里 GitHub Pages 只提供 `/ (root)` 或 `/docs` 两个选项——**没有任意子目录选项**。因此对 monorepo 子目录，两条路：
   - **（推荐）另建一个独立仓库**，把 5 个文件放独立仓库根目录，Pages 选 `/ (root)`；
   - **或**用 Actions 工作流把子目录发布为 Pages（下面给完整 workflow）。

**完整 workflow 文件内容**（即使本项目无构建，也用它把子目录发布为 Pages；把 `path` 指向子目录即可）。**放置路径 `.github/workflows/deploy.yml`（相对仓库根，在仓库根的 `.github/workflows/` 下）**：

```yaml
name: Deploy daily-person to GitHub Pages

on:
  push:
    branches: [ main ]
    paths:
      - 'projects/daily-person/**'
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

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      # 本项目无构建步骤；此步仅做数据一致性自检，失败即中断部署。
      - name: Data test (no build)
        run: node projects/daily-person/test/data.mjs

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact (只上传项目子目录作为站点根)
        uses: actions/upload-pages-artifact@v3
        with:
          path: projects/daily-person

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

推送后到 **Settings → Pages** 把 Source 切成 **GitHub Actions**。站点地址形如 `https://<用户名>.github.io/<仓库名>/`。

> **子目录相对路径坑**：若 Pages 部署在 `https://<user>.github.io/<repo>/`（带子路径），本项目的相对路径 `style.css` 会被解析为 `.../<repo>/style.css`，**正常**（因为 artifact 根就是项目目录）。但如果你误把整个仓库当根发布，相对路径会错位。用上面这个 workflow（`path: projects/daily-person`）就没这问题。绑自定义域名（第 5 节）后站点在根路径，更省心。

### 方案 D：自建 Nginx（可选，自己有 VPS 时）

把 5 个文件传到服务器，例如 `/var/www/daily-person/`：

```bash
# 本地在仓库根，rsync 上传 5 个文件（排除 test 与 md）
rsync -av --include='index.html' --include='style.css' --include='app.js' \
  --include='people.js' --include='questions.js' --exclude='*' \
  projects/daily-person/ user@your-server:/var/www/daily-person/
```

**完整 Nginx server 块，放置路径 `/etc/nginx/sites-available/daily-person`（服务器上），然后 `ln -s` 到 `sites-enabled/`**：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name meiriyiren.com www.meiriyiren.com;

    root /var/www/daily-person;
    index index.html;

    # HTML：每日题/逻辑常更新，即时回源，不缓存
    location = / {
        add_header Cache-Control "no-cache, must-revalidate";
    }
    location ~* \.html$ {
        add_header Cache-Control "no-cache, must-revalidate";
    }

    # CSS/JS：未做文件名指纹，中等缓存 1 小时
    location ~* \.(?:css|js)$ {
        add_header Cache-Control "public, max-age=3600";
    }

    # 图片/OG：1 天
    location ~* \.(?:png|jpg|jpeg|svg|webp|ico)$ {
        add_header Cache-Control "public, max-age=86400";
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
```

启用并重载：

```bash
sudo ln -s /etc/nginx/sites-available/daily-person /etc/nginx/sites-enabled/
sudo nginx -t          # 期望：syntax is ok / test is successful
sudo systemctl reload nginx
```

HTTPS 用 certbot 签证（见第 5 节）。

### 后端 / 小游戏部署 —— 本项目不涉及

本项目无后端（不涉及 Fly.io/Railway/systemd/SSE/持久卷）、非小游戏（不涉及微信/抖音发布）。本项目不涉及。

---

## 5. 自定义域名 + DNS + HTTPS

`meiri-yiren.pages.dev` 是占位/临时域名，正式上线**必须**换成你买的正式域名（也要同步改 `app.js` 第 11 行 `SITE_URL`，见第 3 节）。

### 5.1 买域名

任选注册商：Cloudflare Registrar（成本价、与 Pages 同账号最省事）、Namecheap、Porkbun、阿里云。以 `.com` 为例约 ¥60–120/年。买完把域名的 DNS 托管交给你要用的平台（主推交给 Cloudflare）。

### 5.2 各平台绑定域名步骤

- **Cloudflare Pages（方案 A）**：Pages 项目 → **Custom domains** → **Set up a custom domain** → 输入 `meiriyiren.com` → 若域名 DNS 已在同一个 Cloudflare 账号，会**自动创建 CNAME 记录并自动签发证书**，无需手填。想要 `www` 一并生效，再加一次 `www.meiriyiren.com`。
- **Vercel**：项目 → **Settings → Domains** → 添加 `meiriyiren.com`，按提示加 DNS 记录（见下表）。
- **Netlify**：**Domain settings → Add custom domain**，按提示加记录。
- **GitHub Pages**：**Settings → Pages → Custom domain** 填 `meiriyiren.com`，仓库会生成一个 `CNAME` 文件；再按下表加 4 条 A 记录（根域）+ 1 条 CNAME（www）。**注意**：若用方案 C 的 Actions 发布，把 `CNAME` 文件放进 `projects/daily-person/`（会随 artifact 上传成站点根的 `CNAME`）。
- **自建 Nginx（方案 D）**：把域名 A 记录指向服务器公网 IP 即可（见下表最后一行）。

### 5.3 DNS 记录表（真实值）

| 平台 | 类型 | 主机名 | 值 | 说明 |
|------|------|--------|-----|------|
| Cloudflare Pages | CNAME | `@`（根） | `<项目名>.pages.dev` | 同账号绑定时 Cloudflare 自动创建，通常无需手填 |
| Cloudflare Pages | CNAME | `www` | `<项目名>.pages.dev` | 同上 |
| Vercel | A | `@` | `76.76.21.21` | 根域 |
| Vercel | CNAME | `www` | `cname.vercel-dns.com` | www 子域 |
| GitHub Pages | A | `@` | `185.199.108.153` | 4 条 A 记录之一 |
| GitHub Pages | A | `@` | `185.199.109.153` | |
| GitHub Pages | A | `@` | `185.199.110.153` | |
| GitHub Pages | A | `@` | `185.199.111.153` | |
| GitHub Pages | CNAME | `www` | `<你的 GitHub 用户名>.github.io` | 例（本仓库 owner）：`ericyoooooo.github.io` |
| 自建 Nginx | A | `@` | 你的服务器公网 IP | |
| 自建 Nginx | A | `www` | 你的服务器公网 IP | |

改完 DNS 后用 `dig meiriyiren.com +short` 验证解析生效（可能要等几分钟到几小时）。

### 5.4 HTTPS 自动签发

- Cloudflare Pages / Vercel / Netlify / GitHub Pages：**证书全自动签发续期**，绑定域名后等几分钟到 24 小时，访问 `https://meiriyiren.com` 出现锁标即可。GitHub Pages 记得勾 **Enforce HTTPS**。
- 自建 Nginx：用 certbot 签 Let's Encrypt 证书（自动续期）：
  ```bash
  sudo apt-get install -y certbot python3-certbot-nginx
  sudo certbot --nginx -d meiriyiren.com -d www.meiriyiren.com
  # 按提示选 redirect（自动把 http 跳 https）
  sudo certbot renew --dry-run    # 验证自动续期可用
  ```

微信/内嵌浏览器：本项目虽非小游戏，但分享卡会在微信群/朋友圈被打开——微信内置浏览器**强制 HTTPS**，非 HTTPS 链接会被拦或降权。所以正式域名务必上 HTTPS（上面各托管平台默认满足）。

---

## 6. 缓存策略（可照抄配置全文）

**目标缓存头**（依据：每日换题+逻辑常更新的 HTML 要即时回源；CSS/JS 未做文件名指纹，不能超长缓存）：

| 资源 | Cache-Control | 理由 |
|------|---------------|------|
| `index.html` / 根 `/` | `no-cache, must-revalidate` | 每日题、逻辑更新要立刻生效 |
| `app.js` / `style.css` / `people.js` / `questions.js` | `public, max-age=3600`（1 小时） | 未做 `app.v2.js` 式指纹，超长缓存会让老用户卡在旧版；如需长缓存，先把引用改成带版本名再放大此值 |
| `og.png` 等图片 | `public, max-age=86400`（1 天） | 变化少 |

### 6.1 Cloudflare Pages / Netlify —— `_headers` 全文

**完整文件内容，放置路径 `projects/daily-person/_headers`**（放在站点根，即项目目录下；Cloudflare Pages 与 Netlify 通用同一语法）：

```
/*.html
  Cache-Control: no-cache, must-revalidate

/
  Cache-Control: no-cache, must-revalidate

/*.js
  Cache-Control: public, max-age=3600

/*.css
  Cache-Control: public, max-age=3600

/*.png
  Cache-Control: public, max-age=86400
/*.jpg
  Cache-Control: public, max-age=86400
/*.svg
  Cache-Control: public, max-age=86400
```

> 注意：`_headers` 本身要随站点上传。方案 A 路线②的 `wrangler pages deploy projects/daily-person` 会连它一起传（它在项目目录里）。

### 6.2 Vercel —— `vercel.json` 的 headers 段

见第 4 节方案 B 已给出的 `projects/daily-person/vercel.json` 全文，其中 `headers` 数组就是缓存策略，无需重复添加。

### 6.3 Nginx —— location 段

见第 4 节方案 D 的 server 块，其中 `location ~* \.(?:css|js)$` 等三段即缓存策略，已含在内。

**验证缓存头**（上线后任一方案通用）：

```bash
curl -I https://meiriyiren.com/ | grep -i cache-control
# 期望：cache-control: no-cache, must-revalidate
curl -I https://meiriyiren.com/app.js | grep -i cache-control
# 期望：cache-control: public, max-age=3600
```

---

## 7. SEO 上线

本项目是单页应用（无多页路由），SEO 面很小，给最小集即可。

### 7.1 robots.txt / sitemap.xml

本项目无构建脚本自动生成，手写两个静态文件放站点根。

**完整文件内容，放置路径 `projects/daily-person/robots.txt`**：

```
User-agent: *
Allow: /
Sitemap: https://meiriyiren.com/sitemap.xml
```

**完整文件内容，放置路径 `projects/daily-person/sitemap.xml`**（单页站点只有首页一个 URL）：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://meiriyiren.com/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

上线后验证返回 200：

```bash
curl -I https://meiriyiren.com/robots.txt     # 期望 200
curl -I https://meiriyiren.com/sitemap.xml    # 期望 200
```

### 7.2 Google Search Console

1. `search.google.com/search-console` → **Add property** → 选 **Domain**（推荐）或 **URL prefix**，输入 `meiriyiren.com`。
2. 按提示验证：Domain 方式加一条 TXT 记录到 DNS（Cloudflare 里加），或 URL prefix 方式上传 HTML 验证文件到站点根。
3. 验证通过后 → 左侧 **Sitemaps** → 提交 `https://meiriyiren.com/sitemap.xml`。

### 7.3 Bing Webmaster

`bing.com/webmasters` → **Import** → 直接从 Google Search Console 导入已验证的站点与 sitemap，一键完成。

### 7.4 OG 卡图调试

改完 `index.html` 的 `og:*`（第 3 节 #6）后，用各平台调试器强制抓取、确认卡片：

- Facebook/通用：`developers.facebook.com/tools/debug/`（输入 URL → **Scrape Again** 刷新缓存）
- X/Twitter：历史 Card Validator 已并入，直接发一条含链接的草稿预览；
- Telegram：把链接发给 `@WebpageBot` 触发刷新。

> OG 缓存很顽固，改图后务必在调试器点「重新抓取」，否则社交平台仍显示旧卡（见第 11 节故障表）。

### 7.5 未来长尾（V2，来自 MARKETING.md）

MARKETING 提到 V2 可用构建脚本为每位人物生成静态辞条页 `/p/libai.html` 吃长尾词。本项目当前**无此构建**，属未来项，此处仅记录不落地。

---

## 8. 变现挂点激活

### 8.1 AdSense

**门槛**：AdSense 要求有一定原创内容量。建议按 MARKETING.md 的节奏——**上线两周后**再申请（届时档案页已积累十几期「辞条」内容页价值），过审率更高。

**ads.txt**（授权你的 AdSense 账号在本站投放，放站点根）。**完整文件内容，放置路径 `projects/daily-person/ads.txt`**（把 `pub-0000000000000000` 换成你 AdSense 后台的 Publisher ID）：

```
google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0
```

上线后验证：`curl -I https://meiriyiren.com/ads.txt` 期望 200。

**广告位替换位置**：本项目**唯一广告挂点**是辞条页（揭晓后才出现，不打扰游戏中的玩家）——`index.html` 第 112–115 行的 `<aside class="ad-slot">`：

```html
<!-- index.html 第 112–115 行现状 -->
<aside class="ad-slot" aria-label="推广">
  <p class="ad-slot-tag">自推广</p>
  <p>觉得今天这位有意思？把这页发给一个会喜欢 TA 的人。</p>
</aside>
```

接入时**保留 `<aside class="ad-slot">` 容器本身**（版面样式靠它撑住），把内部两个 `<p>` 换成 AdSense 广告单元代码。同时在 `index.html` `<head>` 里加一次 AdSense 全站脚本（AdSense 后台「获取代码」会给，形如 `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX" crossorigin="anonymous"></script>`）。替换后示例：

```html
<aside class="ad-slot" aria-label="推广">
  <ins class="adsbygoogle"
       style="display:block"
       data-ad-client="ca-pub-0000000000000000"
       data-ad-slot="1234567890"
       data-ad-format="auto"
       data-full-width-responsive="true"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</aside>
```

> 本项目无构建，改一次 `index.html` = 全站生效（就一个页面）。**克制原则**（MARKETING.md 红线）：游戏中界面永远零广告；只在揭晓页投一个 responsive 展示/原生位；**拒绝锚定广告与插页**——辞典的庄重感是本产品最大差异化资产。

### 8.2 联盟/其它

MARKETING.md 提到的「关注公众号换练习码」属运营手段（非广告 SDK），无代码挂点，此处不落地。激励视频需要后端配券，MARKETING 明确列入 V2，纯静态版**不涉及**。

### 8.3 小游戏流量主/激励视频 —— 本项目不涉及

本项目非小游戏，无 `adUnitId`、无激励视频、无诱导分享合规红线场景。本项目不涉及。

---

## 9. 上线后自检清单

逐项勾选：

- [ ] iOS Safari 真机打开正式域名，能问答、翻辞条、存 PNG；
- [ ] Android Chrome 真机同上；
- [ ] `https://meiriyiren.com` 与 `https://www.meiriyiren.com` 都能访问且是 HTTPS（锁标）；
- [ ] 复制战绩，粘贴出来第 4 行是正式域名（不是 `meiri-yiren.pages.dev`）；
- [ ] 保存的 PNG 分享卡底部域名正确、报头「第 N 期」的 N 与上线日算出的期号一致、**卡面无人名**（零剧透）；
- [ ] OG 调试器（Facebook/Telegram）拉到正确的标题/描述/卡图；
- [ ] 手机改时区 / 蹲点跨午夜：过零点后 30s 内底部弹「新的一期已经开始」墨条，点刷新换到新人物、期号 +1；
- [ ] 猜名容错：故意打错一个字母、用别名（如「孔明」）、用英文名，能命中；
- [ ] Lighthouse 移动端 Performance ≥ 95（Chrome DevTools → Lighthouse → Mobile）；
- [ ] `curl -I` 确认 HTML `no-cache`、JS/CSS `max-age=3600`（第 6 节）。

后端 SSE 实时互见 / 同出口 IP 限流 429 / 平台重启墓地编号连续 —— **本项目不涉及**（无后端）。
小游戏震动/高刷计时/切后台跨天/激励视频无填充 —— **本项目不涉及**（非小游戏）。

---

## 10. 持续更新与运维

**每周补人的确切流程**（依据 PLAYBOOK.md 第九节 + DEPLOY.md）：

1. 在 `projects/daily-person/people.js` 的人物数组**尾部 push** 新人物对象（**绝不插入中间**，否则固定种子洗牌的 `PERM` 排期表会对已发行期号错位）；补全全部属性，口径对齐 PLAYBOOK.md 第三节；
2. 跑数据一致性测试（在仓库根）：
   ```bash
   node projects/daily-person/test/data.mjs      # 必须无 FAIL
   node projects/daily-person/test/qa-extra.mjs  # 必须无 FAIL（校验 46 问答案向量仍两两不同）
   ```
3. 重新部署：
   - Cloudflare Pages 连 Git / GitHub Pages Actions：`git commit && git push origin main` 自动触发；
   - wrangler 直传：重跑 `wrangler pages deploy projects/daily-person --project-name=meiri-yiren`；
4. 老玩家无需迁移：`localStorage`（`dailyperson.v1`）只存期号与问题 id，补人不影响存档。

**其它运维**：

- **数据更新**（在世人物去世、别名回填）同上流程；`EPOCH0`（`app.js:13`）**永不改**；
- **回滚**：Cloudflare Pages / Vercel / Netlify 后台每次部署都有历史版本，一键 rollback；GitHub Pages 用 `git revert` 后重推；
- 无后端，故无服务端日志/进程监控/备份 cron —— **本项目不涉及**；托管平台自带的访问分析（Cloudflare Web Analytics，免费、无 cookie）足够看流量。

---

## 11. 故障排查表

| 症状 | 可能原因 | 解决 |
|------|----------|------|
| 部署后页面空白 / 样式/脚本 404 | 5 个文件没在部署根目录（monorepo 子目录没映射对） | 方案 A Output 填 `projects/daily-person`；GitHub Pages 用 workflow 的 `path: projects/daily-person`；确认 `style.css`/`app.js` 相对路径能解析到站点根 |
| 分享文本/PNG 底部还是 `meiri-yiren.pages.dev` | `app.js:11` `SITE_URL` 没改 | 改成正式域名，重新部署；两处用途（`shareText` 第 461 行、canvas `fillText` 第 575 行）会同步 |
| 上线后期号「第 N 期」不对/全体错位 | `app.js:13` `EPOCH0` 被改过或首日设错 | 上线前一次性定好 `Date.UTC(年,月-1,日)`，之后永不动 |
| 改了 CSS/JS，用户仍见旧版 | JS/CSS 被缓存（默认或 CDN） | 已设 `max-age=3600`；紧急发版可在 CDN 后台 Purge cache，或把 `index.html` 里引用改成 `app.v2.js` 之类带版本名 |
| 社交平台分享卡还是旧图/无图 | OG 缓存顽固；或没加 `og:image` | 在 Facebook/Telegram 调试器点「重新抓取」；确认 `index.html` 已加 `og:url`/`og:image`（第 3 节 #6）且图片 URL 返回 200 |
| GitHub Pages 站点在 `/<repo>/` 子路径下资源 404 | 把整个仓库当根发布，相对路径错位 | 用第 4 节方案 C 的 workflow（artifact 根 = 项目目录），或绑自定义域名让站点落在根路径 |
| `file://` 下「复制战绩」偶尔失败 | 浏览器对 `file://` 源限制 `navigator.clipboard` | 属正常；线上 `https://` 无此问题；本地测试改用 `npx serve .`（第 2.2 节） |
| 跨午夜没换题 | 页面一直开着未刷新 | 已内置：过零点 30s 内弹墨条提示刷新；手动刷新即换到当天人物 |
| 两字中文名打错一字猜不中（如「李白」→「李百」） | 编辑距离容错对两字名刻意不生效（防误报） | 属设计取舍；由别名兜底（「李太白」/「Li Bai」），补人时给足别名 |
| `node test/*.mjs` 报找不到 playwright | Playwright 未装 | `npx playwright install chromium`（本容器已预装于 `/opt/pw-browsers/chromium`）；纯 Node 的 `data.mjs` 不需要它 |
| 微信里打开链接被拦/降权 | 非 HTTPS | 正式域名务必上 HTTPS（各托管平台默认签发；自建用 certbot） |

后端相关坑（SSE 被代理缓冲、机器休眠断流、`TRUST_PROXY` 冷却桶）—— **本项目不涉及**（无后端）。
小游戏相关坑（微信内 `navigator.vibrate` 不可用）—— **本项目不涉及**（非小游戏）。

---

*本文件基于真实源码核对：`app.js` 第 11 行 `SITE_URL="meiri-yiren.pages.dev"`、第 13 行 `EPOCH0=Date.UTC(2026,6,4)`、第 461/575 行 `SITE_URL` 两处用途、`index.html` 第 112 行 `.ad-slot`、canvas `share-canvas` 1080×1350、`localStorage` 键 `dailyperson.v1`、111 人、5 个生产文件、无构建/无后端。上线前请务必完成第 3 节两处 ⚠️ 必改项。*
