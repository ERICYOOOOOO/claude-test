# Flatline · 全栈部署详解（从 0 到上线）

> 本指南假设你是全新电脑、什么都没装。跟着从上到下逐条照抄即可把 `flatline.day` 送上线。
> 目录约定：**仓库根** = `/home/user/claude-test`；**项目目录** = `/home/user/claude-test/projects/flatline`。
> 下文命令若写“在仓库根执行”，指你的终端当前目录是仓库根；写“在项目目录执行”同理。

---

## 0. 这是什么 / 架构判定

**产品**：Flatline 是一台伪装成医院监护仪的“每日镇定测试”。45 秒 14 拍，该点时点、该按住时别松、出现假提示时忍住不动；机器逐拍采样你的迟疑与多余动作，最后把整局渲染成一条心电图——稳的人得一条平线盖章 `🫀 RESTING`，崩的人得一记猩红尖峰盖章 `CODE BLUE · 第 N 拍`。传播点是那张**零剧透的心电图分享卡**：看的人只知道“这个人第 7 拍没绷住”，不知道题目，只能自己点进来试（详见 `DESCRIPTION.md` / `MARKETING.md`）。每日一题、全球同题（按玩家**本地日期**取种子，类 Wordle）。

**架构判定：纯静态单页（static）。** 依据（均来自源码核对）：
- 全部逻辑在客户端 `app.js` 里跑，无任何网络请求——`grep` 全文只有 `AudioContext`（`app.js:147` 声音合成），**没有 `fetch` / `XMLHttpRequest` / `import` / `require`**，无 API、无后端、无字体/图片外链。
- 数据只存在浏览器 `localStorage`，键名 `flatline.v1`（`app.js:49`），连胜/最佳/历史波形都在本机，无账号无追踪。
- 每日题目由**纯函数**根据本地日期算出的整数种子生成（`todayIdx()` @ `app.js:44`、`genDefs(seed)` @ `app.js:83`），无需服务端下发。
- 结论：**零构建、零后端、托管成本 ≈ 0**；唯一“动态”是 HTML 需要能即时更新（每日题/逻辑常改），所以缓存策略上 HTML 不缓存、静态资源短缓存（见 §6）。

**文件清单表**（逐个核对自项目目录）：

| 文件 | 作用 | 是否需上传到生产 |
|---|---|---|
| `index.html` | 单页骨架、`<meta>`（含 OG）、三块屏（开始/游戏/结算）、结算屏预留广告位 `#adSlot`、引 `style.css`+`app.js` | 是 |
| `style.css` | 全部样式（监护仪外观、扫描线、波形容器等），无外链字体 | 是 |
| `app.js` | 全部逻辑：种子/拍型生成、判定评分、canvas 波形、分享文本/PNG 导出、localStorage 存档 | 是 |
| `og.png` | 社交分享卡缩略图（1200×630），**需你先玩一局在结算屏“存图”导出再改名放根目录**；`index.html:12` 的 `og:image` 已指向它 | 是（强烈建议，缺了社交预览无图） |
| `DEPLOY.md` | 旧版简版部署备忘（本指南是它的完整扩写版） | 否 |
| `DESCRIPTION.md` | 产品文案（中/英 blurb） | 否 |
| `PLAYBOOK.md` | 数值与视觉唯一事实源（体验/评分/拍型设计） | 否 |
| `MARKETING.md` | 冷启动渠道 + 变现（AdSense/赞助位）指南 | 否 |
| `test/smoke.mjs` | Playwright 冒烟测试（一局到结算、分享、容错、375px 视口） | 否 |
| `test/qa-extra.mjs` | Playwright 对抗性测试（时钟注入换题、连胜、PNG 像素解码、320px） | 否 |
| `test/screenshots/` | 测试跑出来的截图产物目录 | 否 |

**要上传到生产的，只有 4 个文件：`index.html`、`style.css`、`app.js`、`og.png`。** 其余全是文档与测试，不进生产。

---

## 1. 从零准备环境

### 1.1 安装 Node.js（LTS，≥18；本仓库实测 v22）

本项目**运行不需要 Node**（生产就是静态文件），但你需要 Node 来：起本地静态服务器、跑 Playwright 测试、用命令行部署工具（wrangler/vercel）。装 LTS（≥18，推荐 20/22）。

- **macOS（推荐 Homebrew）**
  ```bash
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  brew install node
  ```
  或用 nvm（多版本管理，更省心）：
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  # 关掉终端重开，或 source ~/.zshrc
  nvm install --lts
  nvm use --lts
  ```

- **Windows（推荐 winget）**
  ```powershell
  winget install OpenJS.NodeJS.LTS
  ```
  装完关掉 PowerShell 重开让 PATH 生效。

- **Linux（推荐 nvm；或 NodeSource apt）**
  ```bash
  # 方式一：nvm（不需 sudo，推荐）
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  source ~/.bashrc
  nvm install --lts && nvm use --lts

  # 方式二：NodeSource（系统级，需 sudo，示例装 22.x）
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```

**验证**（三平台通用）：
```bash
node -v      # 期望类似：v22.22.2（≥ v18 即可）
npm -v       # 期望类似：10.9.x
```
只要 `node -v` 打出 `v18` 及以上就算过关。

### 1.2 安装并配置 Git

- macOS：`brew install git`（或首次 `git --version` 会触发 Xcode CLT 安装）
- Windows：`winget install Git.Git`
- Linux：`sudo apt-get install -y git`

配置身份（提交记录用；换成你自己的）：
```bash
git config --global user.name "你的名字"
git config --global user.email "ericgu050714@gmail.com"
git config --global init.defaultBranch main
git --version    # 期望：git version 2.4x.x
```

### 1.3 需要注册的账号

| 账号 | 用途 | 是否免费 |
|---|---|---|
| **GitHub** | 存代码、连 Cloudflare Pages 自动部署、（可选）GitHub Pages 托管 | 免费 |
| **Cloudflare**（主推托管） | Cloudflare Pages 静态托管 + 全球 CDN + 自定义域名 + 自动 HTTPS | 免费额度足够 |
| **域名注册商**（任选其一：Cloudflare Registrar / Namecheap / 阿里云 / GoDaddy） | 购买并解析 `flatline.day`（`.day` 是 Google 管理的 TLD，强制 HTTPS/HSTS 预加载） | 域名年费（`.day` 约 ￥100–200/年），不免费 |
| Vercel / Netlify（备选托管） | 备选静态托管方案 B | 免费额度足够 |
| **Google AdSense**（变现，体量起来再开） | 结算屏广告位（见 §8，`MARKETING.md` 有开通门槛） | 免费，但有审核门槛 |
| 后端平台 / 微信·抖音开放平台 | 本项目不涉及（纯静态、无小游戏包） | — |

### 1.4 取得代码

**方式一：clone 整个 monorepo（最简单）**
```bash
git clone http://local_proxy@127.0.0.1:41729/git/ERICYOOOOOO/claude-test.git
cd claude-test/projects/flatline
pwd    # 期望：.../claude-test/projects/flatline
```
> 上面是本环境的 origin 地址；如果你的仓库在 github.com，改成 `git clone git@github.com:<你的用户名>/claude-test.git`。

**方式二：只想单独部署本项目（把三/四个文件拎出来单独建仓）**——见 §4 方案 C。生产其实只需要 `index.html`、`style.css`、`app.js`、`og.png` 这四个文件，你可以只复制它们：
```bash
mkdir -p ~/flatline-site
cp index.html style.css app.js og.png ~/flatline-site/   # og.png 生成后再复制，见 §2/§3
cd ~/flatline-site
```

---

## 2. 本地运行与自验

### 2.1 直接双击 `index.html`（file://）

因为是纯静态、无网络请求，**从 `file://` 直接打开就能完整玩**：开始屏、逐拍判定、CODE BLUE、结算、复制战报、存图、练习模式、localStorage 存档全部可用（测试文件就是用 `file://` 跑的，见 `test/smoke.mjs` 的 `URL = 'file://' + INDEX`）。

macOS：`open index.html`；Linux：`xdg-open index.html`；Windows：`start index.html`。

**唯一要注意**：某些浏览器对 `file://` 下的剪贴板 API 更严格，“复制战报”可能退化。生产是 `https://`，不受影响。要 100% 还原生产体验，用下面的本地服务器。

### 2.2 起本地静态服务器（推荐用来自测）

在**项目目录**执行任选其一：
```bash
# 方式一：Node（无需预装，npx 现下现用）
npx serve .
# 输出里会给出 http://localhost:3000

# 方式二：Python3（多数系统自带）
python3 -m http.server 8000
# 然后浏览器访问 http://localhost:8000
```
打开地址应立即看到监护仪开机屏（顶栏 `FLATLINE`、跑动的 62 BPM 闲置波形、`按下任意处 开始`）。按空格或点击任意处即可开局。

### 2.3 【构建项目】

**本项目不涉及**——零构建。没有 `package.json`、没有 `build.js`、没有打包步骤，生产文件就是仓库里的原始文件。

### 2.4 【后端项目】

**本项目不涉及**——无服务端、无 SSE、无 API。全部逻辑在浏览器内。

### 2.5 【小游戏】

**本项目不涉及**——无 `wechat-minigame/` 目录、无微信/抖音 adapter。这是 H5 单页；若未来要上小游戏平台需另做适配层，当前仓库没有。

### 2.6 运行自带测试（Playwright）

测试用 **Playwright + Chromium**，从**仓库根**运行。

**准备 Chromium**：
> 注意：两个测试脚本都**硬编码**了浏览器路径 `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`（`test/smoke.mjs:72`、`test/qa-extra.mjs:142`），**并不读取 `PLAYWRIGHT_BROWSERS_PATH` 环境变量**。所以设不设那个环境变量都不影响这两个脚本。

- 本仓库环境已内置 `/opt/pw-browsers/chromium`，脚本里写死的就是这个路径，**开箱即用、无需设任何环境变量**。唯一前置条件是装好 `playwright` 这个 npm 包（脚本 `import { chromium } from 'playwright'`；本仓库根有 `package.json` 但未声明该依赖，需在仓库根 `npm i -D playwright` 或全局装）。
- 一般机器（自己的电脑）**没有** `/opt/pw-browsers/chromium` 这个路径，直接跑会因写死的 `executablePath` 指向不存在的文件而失败。两种改法任选其一：
  ```bash
  # 改法一（推荐）：让 Playwright 自己下浏览器，然后把两个脚本里
  #   chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  # 改成不带 executablePath 的 chromium.launch()，由 Playwright 自动定位。
  npm i -D playwright
  npx playwright install chromium

  # 改法二：不改脚本，把本机实际 Chromium 路径软链到脚本写死的位置
  #   sudo mkdir -p /opt/pw-browsers && sudo ln -s "$(npx playwright ...)" /opt/pw-browsers/chromium
  ```

**逐条运行**（在仓库根，路径相对仓库根）：
```bash
# 冒烟测试：零 console 报错、完整一局到结算、分享文本/PNG、localStorage 容错、快速连点不双计、reduced-motion、375px 视口
node projects/flatline/test/smoke.mjs

# 对抗性 QA：时钟注入(期号/拍序/午夜滚动)、连胜结转/断裂/归零、练习不入档、PNG 像素级解码、触屏+键盘不双计、声音开关持久化、320px 极窄视口
node projects/flatline/test/qa-extra.mjs
```
**期望结果**：每条以一堆 `  PASS xxx` 结尾，最后汇总 `failures = 0`（俗称 ALL GREEN）。任意 `FAIL` 都表示回归，先修再部署。截图会落在 `projects/flatline/test/screenshots/`。

---

## 3. 上线前必改（精确到文件 + 常量/行）

**若你的最终域名就是 `flatline.day`，本节唯一必做的是生成并放好 `og.png`（下表最后一行）。** 换域名时才需要改域名相关几处。所有“现值”均来自源码核对。

| 文件 | 位置（常量名/行号/选择器） | 现值 | 改成 |
|---|---|---|---|
| `app.js` | `const DOMAIN`（**第 32 行**） | `'flatline.day'` | 你的域名，如 `'你的域名.com'` |
| `index.html` | 结算屏自推广位 `<aside class="promo" id="adSlot">` 内 `<span class="domain">`（**第 97 行**） | `flatline.day` | 你的域名 |
| `index.html` | 底部 footer `<span class="domain">`（**第 102 行**） | `flatline.day` | 你的域名 |
| `index.html` | `og:image`（**第 12 行**） | `content="og.png"` | 保持 `og.png`（相对路径即可）；生成方法见下 |
| —（canonical） | `index.html` `<head>` | **当前无 `<link rel="canonical">`** | 可选新增（见下“可选补强”） |
| —（og:url） | `index.html` `<head>` | **当前无 `og:url`** | 可选新增（见下“可选补强”） |

> `DOMAIN` 常量被用在两处产物里：分享文本末尾（`app.js:375` 拼进战报）与导出 PNG 卡右下角水印（`app.js:481`）。所以改 `app.js:32` 一处，战报文本和卡面水印同时生效。

**换域名后如何验证**：
```bash
cd /home/user/claude-test/projects/flatline
grep -rn "flatline.day" index.html app.js   # 期望：除非你没改，否则查无残留旧域名
```
再本地起服（§2.2）玩一局到结算，点“复制战报”粘到记事本，确认末行是新域名；点“存图”打开 PNG，确认右下角水印是新域名。

### 生成 `og.png`（必做，社交预览的门面）

1. 本地起服（§2.2），玩一局——**建议故意崩出一张 `CODE BLUE` 卡，悬念更强**（`DEPLOY.md` 的老建议）。
2. 结算屏点“**存图**”，浏览器会下载一张 `flatline-<期号>.png`（文件名来自 `app.js:878`），尺寸即社交卡尺寸。
3. 把它改名为 `og.png`，放到**项目根目录**（与 `index.html` 同级）：
   ```bash
   mv ~/Downloads/flatline-*.png /home/user/claude-test/projects/flatline/og.png
   ```
4. 验证尺寸应为 **1200×630**：
   ```bash
   # macOS
   sips -g pixelWidth -g pixelHeight /home/user/claude-test/projects/flatline/og.png
   # Linux（需 imagemagick）
   identify /home/user/claude-test/projects/flatline/og.png
   # 期望：1200 x 630
   ```

### 可选补强（推荐，但不改也能上线）

当前 `<head>` 只有 `og:title` / `og:description` / `og:type` / `og:image`，**没有 canonical 和 og:url**。加上能让搜索引擎/社交平台更稳地识别规范地址。若要加，在 `index.html` 的 `<head>` 里（`og:image` 那行附近，约第 12–13 行之间）插入：
```html
<link rel="canonical" href="https://flatline.day/">
<meta property="og:url" content="https://flatline.day/">
<meta name="twitter:card" content="summary_large_image">
```
换域名时同步把这里的 `flatline.day` 改掉。加完本地起服，`curl -s http://localhost:8000 | grep -i canonical` 能看到即可。

---

## 4. 部署（主链路，≥2 方案，主推 Cloudflare Pages）

本项目是纯静态，用静态托管方案。下面 A/B/C/D 四选一，**主推 A（Cloudflare Pages）**。

### 方案 A：Cloudflare Pages（推荐：免费、全球 CDN、自定义域名最顺、`.day` 域名同厂最省事）

#### 路线①：连 Git（网页操作，自动持续部署）

1. 先把仓库推到 GitHub（若还没有）：
   ```bash
   cd /home/user/claude-test
   git remote -v            # 确认 origin；若要推到自己的 GitHub，改 remote：
   # git remote set-url origin git@github.com:<你的用户名>/claude-test.git
   git add -A && git commit -m "flatline: ready to deploy" && git push
   ```
2. 打开 Cloudflare Dashboard → 左侧 **Workers & Pages** → **Create** → 选 **Pages** 标签 → **Connect to Git**。
3. 授权 GitHub，选中 `claude-test` 仓库，**Begin setup**。
4. **构建设置（monorepo 子目录的关键填法）**：
   - **Framework preset**：选 `None`
   - **Build command**：**留空**（本项目零构建）
   - **Build output directory**：填 `projects/flatline`
     - 这一步是 monorepo 的要害：告诉 Pages “把 `projects/flatline` 这个子目录当站点根”，于是 `projects/flatline/index.html` 就成了首页。
     - 如果你是“只把四个文件单独建仓”（§1.4 方式二），这里改填 `/` 或 `.`。
   - （Root directory / 高级：一般保持仓库根即可，不用改。）
5. **Save and Deploy**。等 1–2 分钟，拿到 `https://<项目名>.pages.dev`。先自测一局。
6. 之后每次 `git push` 到默认分支，Pages 自动重新部署，无需再操作。

#### 路线②：命令行 wrangler 直传（不连 Git，一条命令上线）

```bash
npm i -g wrangler
wrangler login          # 浏览器授权 Cloudflare
cd /home/user/claude-test/projects/flatline
wrangler pages deploy . --project-name=flatline
```
- `.` 表示把当前项目目录整包上传（含 `index.html`/`style.css`/`app.js`/`og.png`，也会带上文档/测试——无所谓，静态托管只是多放几个不被引用的文件；想更干净就先把四个文件复制到临时目录再 `deploy` 那个目录）。
- 首次会提示创建项目 `flatline`，回车确认。完成后同样给 `*.pages.dev` 地址。

### 方案 B：Vercel（备选）

```bash
npm i -g vercel
cd /home/user/claude-test/projects/flatline
vercel            # 首次会问一串：Framework 选 Other，Build Command 留空，Output Directory 填 .
vercel --prod     # 上生产
```
Vercel 纯静态其实不需要配置文件，但如果你想显式锁定缓存头（见 §6），在**项目目录**放一个 `vercel.json`：

**文件：`/home/user/claude-test/projects/flatline/vercel.json`**
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "headers": [
    {
      "source": "/index.html",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    },
    {
      "source": "/",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
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

> 备选 Netlify：`npm i -g netlify-cli && netlify deploy --prod --dir=.`。配置文件如下。

**文件：`/home/user/claude-test/projects/flatline/netlify.toml`**
```toml
[build]
  publish = "."
  command = ""

# 缓存头见 §6 的 _headers 文件（Netlify 优先读 _headers）
```

### 方案 C：GitHub Pages（无构建，适合“四文件单独建仓”）

因为是纯静态零构建，GitHub Pages 直接托管即可，**无需 Actions 工作流**（工作流仅在有构建步骤时才需要）。步骤：

1. 新建一个仓库（如 `flatline`），把 4 个文件放进仓库**根目录**：
   ```bash
   mkdir flatline && cd flatline && git init
   cp /home/user/claude-test/projects/flatline/{index.html,style.css,app.js,og.png} .
   git add -A && git commit -m "flatline site"
   git branch -M main
   git remote add origin git@github.com:<你的用户名>/flatline.git
   git push -u origin main
   ```
2. 仓库 **Settings → Pages → Build and deployment → Source** 选 `Deploy from a branch`，Branch 选 `main` `/ (root)`，Save。等 1 分钟得到 `https://<你的用户名>.github.io/flatline/`。
3. 自定义域名与 DNS 见 §5。

**（可选）若你坚持从 monorepo 子目录用 Actions 发 Pages**（例如不想单独建仓），给出完整工作流。注意本项目无构建，工作流只是把子目录当产物上传：

**文件：`/home/user/claude-test/.github/workflows/deploy.yml`**
```yaml
name: Deploy Flatline to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - "projects/flatline/**"
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
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      # 本项目零构建；如未来加了 build.js，取消下一行注释并在 projects/flatline 下运行
      # - run: node build.js
      #   working-directory: projects/flatline

      - name: Upload artifact (only the flatline site dir)
        uses: actions/upload-pages-artifact@v3
        with:
          path: projects/flatline

      - name: Deploy to GitHub Pages
        id: deploy
        uses: actions/deploy-pages@v4
```
把它提交到仓库根，然后 **Settings → Pages → Source** 改选 `GitHub Actions`。之后推代码即自动发。

### 方案 D（可选）：自建 Nginx（自有 VPS）

把 4 个文件传到服务器（如 `/var/www/flatline`），配一个 server 块。

**文件：`/etc/nginx/sites-available/flatline`**
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name flatline.day www.flatline.day;
    root /var/www/flatline;
    index index.html;

    # HTML：每日题/逻辑常更新，即时回源，不缓存
    location = /index.html {
        add_header Cache-Control "public, max-age=0, must-revalidate";
    }
    location = / {
        add_header Cache-Control "public, max-age=0, must-revalidate";
    }
    # CSS/JS：短缓存（未做文件名指纹，勿超长）
    location ~* \.(?:css|js)$ {
        add_header Cache-Control "public, max-age=3600";
    }
    # 图片/OG：一天
    location ~* \.(?:png|jpg|jpeg|svg|webp|ico)$ {
        add_header Cache-Control "public, max-age=86400";
    }

    location / { try_files $uri $uri/ =404; }
}
```
启用并签 HTTPS：
```bash
sudo ln -s /etc/nginx/sites-available/flatline /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d flatline.day -d www.flatline.day    # 自动改 443 + 证书 + 跳转
```

**后端 / 小游戏方案**：本项目不涉及（纯静态，无服务端进程、无容器、无小游戏包）。

---

## 5. 自定义域名 + DNS + HTTPS

### 5.1 买域名

在任一注册商买 `flatline.day`（`.day` 由 Google 运营，**强制 HTTPS**，天然进 HSTS 预加载列表——这对本项目正好，无需自己配跳转就享受全站加密）。**最省心的组合是：在 Cloudflare Registrar 买域名 + 用 Cloudflare Pages 托管**，DNS 自动打通。

### 5.2 各平台绑定域名

- **Cloudflare Pages（方案 A）**：Pages 项目 → **Custom domains** → **Set up a domain** → 输入 `flatline.day`（再加一次 `www.flatline.day`）。
  - 域名 DNS 就在 Cloudflare：自动加好 CNAME，一分钟生效，证书自动签。
  - 域名在别处：按提示把 `CNAME flatline.day → <项目>.pages.dev` 加到你的 DNS（根域用 CNAME flattening / ALIAS，见下表）。
- **Vercel（方案 B）**：Project → Settings → Domains → 加 `flatline.day`，按提示配 A/CNAME（见下表）。
- **GitHub Pages（方案 C）**：Settings → Pages → Custom domain 填 `flatline.day`，仓库自动生成 `CNAME` 文件；DNS 按下表配 4 条 A + www 的 CNAME；勾选 **Enforce HTTPS**。

### 5.3 DNS 记录表（按你选的平台取用真实值）

| 类型 | 主机名 | 值 | 说明 |
|---|---|---|---|
| CNAME | `flatline.day`（根域） | `<项目>.pages.dev` | Cloudflare Pages；根域靠 Cloudflare CNAME flattening 自动处理 |
| CNAME | `www` | `<项目>.pages.dev` | Cloudflare Pages 的 www |
| A | `flatline.day`（根域） | `76.76.21.21` | Vercel 根域（二选一，用 A） |
| CNAME | `www` | `cname.vercel-dns.com` | Vercel 的 www |
| A | `flatline.day`（根域） | `185.199.108.153` | GitHub Pages 根域（4 条 A，全配） |
| A | `flatline.day`（根域） | `185.199.109.153` | GitHub Pages 根域 |
| A | `flatline.day`（根域） | `185.199.110.153` | GitHub Pages 根域 |
| A | `flatline.day`（根域） | `185.199.111.153` | GitHub Pages 根域 |
| CNAME | `www` | `<你的用户名>.github.io` | GitHub Pages 的 www |
| A | `flatline.day`（根域） | `<你的 VPS IP>` | 自建 Nginx（方案 D） |

> 只填你实际用的那套；不要把 Cloudflare/Vercel/GitHub 的记录混着加。

### 5.4 HTTPS

- Cloudflare Pages / Vercel / Netlify / GitHub Pages：证书**全自动签发与续期**，你不用管。
- 自建 Nginx：`certbot`（§4 方案 D）签发，自带 cron 自动续期。
- `.day` 是 HSTS 预加载 TLD，浏览器一律走 HTTPS——本项目无内嵌浏览器/小游戏 WebView 需求，天然满足“强制 HTTPS”。（若未来进微信/抖音内嵌浏览器，也是强制 HTTPS，正好合规。）

---

## 6. 缓存策略（给可照抄的配置全文）

**目标头**（依据 `DEPLOY.md` 与源码事实：HTML 每日换题/逻辑常改必须即时回源；CSS/JS 未做文件名指纹，切忌超长缓存否则用户吃旧版；图片/OG 一天）：

| 资源 | Cache-Control | 原因 |
|---|---|---|
| `index.html` / `/` | `public, max-age=0, must-revalidate` | 每日题按本地日期换、逻辑常更新，即时回源 |
| `style.css` / `app.js` | `public, max-age=3600` | 未做指纹文件名；1 小时短缓存。日后若上 `immutable` 必须先把引用改成 `app.v2.js` 之类带版本名 |
| `og.png` 及图片 | `public, max-age=86400` | 一天足够；卡图很少变 |

> Cloudflare Pages / Vercel 的默认头已接近上述；GitHub Pages 固定 `max-age=600`（10 分钟），可接受。本项目**零运行时请求**（无 API/字体/图片外链），CDN 费用 ≈ 0，唯一重复流量是 HTML 的回源校验，可忽略。

**Cloudflare Pages / Netlify 用同一个 `_headers` 文件**（放站点根 = 项目目录）：

**文件：`/home/user/claude-test/projects/flatline/_headers`**
```
/index.html
  Cache-Control: public, max-age=0, must-revalidate
/
  Cache-Control: public, max-age=0, must-revalidate
/*.css
  Cache-Control: public, max-age=3600
/*.js
  Cache-Control: public, max-age=3600
/og.png
  Cache-Control: public, max-age=86400
/*.png
  Cache-Control: public, max-age=86400
```
> Cloudflare Pages 和 Netlify 都会自动识别站点根下的 `_headers`。用方案 A 路线①时，因为 Build output directory = `projects/flatline`，这个文件正好在站点根，会被读到。

**Vercel**：用 §4 方案 B 里给出的 `vercel.json` 的 `headers` 段（已含上述三档缓存），此处不重复。

**Nginx**：用 §4 方案 D server 块里的三个 `location`（已含 HTML no-cache / CSS·JS 3600 / 图片 86400），此处不重复。

---

## 7. SEO 上线

本项目是单页玩具站，SEO 只需最小集（不是内容站，无需大 sitemap）。

- **robots.txt / sitemap.xml**：本项目**无 `build.js`，不自动生成**。单页站可选手写一份极简的放站点根（项目目录）：

  **文件：`/home/user/claude-test/projects/flatline/robots.txt`**
  ```
  User-agent: *
  Allow: /
  Sitemap: https://flatline.day/sitemap.xml
  ```
  **文件：`/home/user/claude-test/projects/flatline/sitemap.xml`**
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>https://flatline.day/</loc>
      <changefreq>daily</changefreq>
      <priority>1.0</priority>
    </url>
  </urlset>
  ```
  换域名时同步改里面的 `flatline.day`。部署后 `curl -s https://flatline.day/robots.txt` 应回 200 并打出上面内容。

- **Google Search Console**：https://search.google.com/search-console → 添加资源 → 选“网域”填 `flatline.day` → 按提示在 DNS 加一条 TXT 验证记录 → 验证通过后左侧 **Sitemaps** 提交 `https://flatline.day/sitemap.xml`。
- **Bing Webmaster Tools**：https://www.bing.com/webmasters → **Import from Google Search Console** 一键导入，省去重复验证。
- **OG 卡图调试**（确认 `og.png` 生效）：
  - X/Twitter：https://cards-dev.twitter.com/validator
  - Facebook：https://developers.facebook.com/tools/debug/（改了 OG 后点 “Scrape Again” 强刷缓存）
  - Telegram：把链接发给 [@WebpageBot](https://t.me/WebpageBot) 让它刷新预览
  - 期望：显示 1200×630 的心电图卡、标题“Flatline — 每日镇定监护”。

---

## 8. 变现挂点激活

变现只走一个位置：**结算屏底部的 `#adSlot`**。核对自源码：`index.html:97` 是 `<aside class="promo" id="adSlot">`，其上方 `index.html:89–96` 有一段注释写明了 AdSense 激活步骤；`MARKETING.md` §广告 明确“游戏进行中/开始屏永不出广告，一个广告位就是上限”。

**开通门槛**（`MARKETING.md`，三条同时满足再开，早开伤留存）：日均 UV 稳定 > 2,000 持续两周；次日回访 > 25%；HN/Reddit 首发流量峰已过（首发期页面必须绝对干净）。

**AdSense 激活步骤（照抄）**：
1. AdSense 后台 → 添加站点 `flatline.day` → 通过审核（本页语义化 HTML + meta 齐全，通过率高）。
2. 在站点根放 `ads.txt`（把 `pub-XXXXXXXXXXXXXXXX` 换成你 AdSense 后台的 Publisher ID）：

   **文件：`/home/user/claude-test/projects/flatline/ads.txt`**
   ```
   google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
   ```
3. 把 `index.html:97` 的 `.promo` **内部内容**换成官方广告单元，保留 `<aside class="promo" id="adSlot">` 容器与配色。即把这一行：
   ```html
   <aside class="promo" id="adSlot"><p>做这台监护仪的人还在做别的怪东西 → <span class="domain">flatline.day</span></p></aside>
   ```
   改成（`ca-pub-...` 和 `data-ad-slot` 用你的真实值）：
   ```html
   <aside class="promo" id="adSlot">
     <ins class="adsbygoogle"
          style="display:block"
          data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
          data-ad-slot="1234567890"
          data-ad-format="auto"
          data-full-width-responsive="true"></ins>
     <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
   </aside>
   ```
4. 在 `index.html` 的 `</body>`（`<script src="app.js"></script>` 在第 106 行、`</body>` 在第 107 行，插到两者之间）加载 AdSense 脚本——**这是全站唯一允许的外部脚本**，加载失败必须静默（AdSense 默认如此）：
   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
   ```
5. 铁律（来自源码注释 + `MARKETING.md`）：广告只在**结算屏底部**这一处；游戏进行中/开始屏永不出广告；一个广告位就是上限。
6. 观察一周：若分享率（复制+存图 ÷ 结算 PV）下跌超 15%，撤广告改走单行赞助位（“本台监护仪由 XX 供电”，报价 = 日 UV × ¥0.05）。

> 因为本项目**零构建**，这些改动就是直接改 `index.html` 再重新部署（§4）——没有“改模板重跑 build.js”这一步。
>
> **联盟/其他**：`MARKETING.md` 建议不买量（LTV≈0，增长只靠分享卡回流）；后续路线是波形皮肤本地解锁码内购（仍零后端）等。
>
> **小游戏流量主 / 激励视频**：本项目不涉及（无小游戏包）。若未来上小游戏平台，发奖须以平台激励视频回调 `res.isEnded === true` 为准、严禁诱导分享——但当前仓库没有这层，无需处理。

---

## 9. 上线后自检清单

- [ ] 真机 iOS Safari + Android Chrome 各打一局：触控判定、`SND` 声音开关、复制战报、存图、练习模式
- [ ] `https://flatline.day` 与 `https://www.flatline.day`（如启用）都能开，且自动 HTTPS
- [ ] OG 卡：用 X/Telegram/Facebook 调试器确认 `og.png`（1200×630）正确显示
- [ ] 跨时区/跨午夜换题：改设备时区或系统日期，刷新后确认期号（`#N`）随**本地日期**变化（这是 `todayIdx()`/`issueOf()` 的语义，`qa-extra.mjs` 有时钟注入测试覆盖）
- [ ] Lighthouse 移动端 Performance ≥ 95（本页无外部资源，达不到就是回归）
- [ ] localStorage 持久：打完当天刷新，开始屏应变“今日已完成”态（迷你波形+连稳天数）
- [ ] 分享文本末行域名 = 生产域名；导出 PNG 右下角水印 = 生产域名
- [ ] `curl -sI https://flatline.day/` 看 `Cache-Control` 是否 `max-age=0, must-revalidate`；`app.js` 是 `max-age=3600`
- 【后端实时/限流/编号连续】本项目不涉及
- 【小游戏震动/高刷/激励视频】本项目不涉及

---

## 10. 持续更新与运维

**日常更新流程（改数值/文案/逻辑）**：
```bash
cd /home/user/claude-test/projects/flatline
# 1. 改 app.js / index.html / style.css（数值先改 PLAYBOOK.md 再落代码——它是唯一事实源）
# 2. 本地自测
python3 -m http.server 8000        # 打开 http://localhost:8000 玩一局
# 3. 跑测试（仓库根），必须 ALL GREEN
cd /home/user/claude-test
# 脚本已硬编码 executablePath=/opt/pw-browsers/chromium，本仓库环境开箱即用；
# 只需装好 playwright 包（npm i -D playwright）。自己的电脑没有这个路径，
# 需按 §2.6 把两个脚本的 executablePath 去掉再 npx playwright install chromium。
node projects/flatline/test/smoke.mjs
node projects/flatline/test/qa-extra.mjs
# 4. 重新部署
git add -A && git commit -m "flatline: tweak" && git push   # 方案 A 路线①/方案 C(Actions) 自动发
# 或 wrangler pages deploy projects/flatline --project-name=flatline   # 方案 A 路线②
```

> **无 build.js**，所以“改数据 → 重跑 build” 这一步在本项目不存在——直接改文件即部署。

**改静态资源后要小心缓存**：因为 `style.css`/`app.js` 是固定文件名 + 1 小时缓存，改完最多 1 小时内老用户可能仍吃旧版；要立即全量生效，把 `index.html` 里的引用改成带版本名（如 `app.js` → `app.v2.js` 并同步重命名文件），破缓存。

**备份/日志/监控/回滚**：
- 本项目无用户数据落服务器（全在用户本机 localStorage），**无需数据库备份**。
- 代码回滚：`git revert <commit>` 后 push，或在 Cloudflare Pages 后台点历史部署 **Rollback**。
- 监控：Cloudflare Web Analytics（无 cookie、一行脚本，但要权衡“首发期页面绝对干净”的原则，`MARKETING.md`）；或纯看托管平台自带的请求量图。
- 【后端日志/监控】本项目不涉及。

---

## 11. 故障排查表

| 症状 | 可能原因 | 解决 |
|---|---|---|
| `file://` 下“复制战报”不生效 | 浏览器对 `file://` 的 Clipboard API 更严格 | 用本地服务器（`npx serve .` / `python3 -m http.server`）或直接看生产 `https://`；`app.js:867` 有降级路径，生产不受影响 |
| 社交预览没图 / 图是旧的 | 忘了生成 `og.png` 放根目录；或平台缓存了旧 OG | 先按 §3 生成 1200×630 的 `og.png`；再用 Facebook 调试器 “Scrape Again”、Telegram @WebpageBot 强刷缓存 |
| 改了 CSS/JS 但用户还看到旧版 | `style.css`/`app.js` 固定文件名 + `max-age=3600`，且未做指纹 | 等 1 小时；或改引用为 `app.v2.js` 破缓存（§6/§10），切勿给这两个文件上超长 `immutable` |
| GitHub Pages 子目录下资源 404 / 样式丢失 | 站点在 `/flatline/` 子路径，但引用是相对路径本应没事——若你手改成了绝对路径 `/style.css` 就会 404 | 保持 HTML 里 `href="style.css"`、`src="app.js"` 相对引用（当前就是相对的，别改成 `/开头`）；或用自定义域名让站点落在根路径 |
| 期号/题目跨午夜没换、或不同时区看到同一题 | 对种子逻辑的误解 | 这是设计：种子按**本地日期**取（`todayIdx()` @ `app.js:44`），跨本地午夜才换题、同一时区同题、不同时区可能差一天，属正常；`qa-extra.mjs` 有覆盖 |
| 部署后首页显示的是仓库 README / 目录列表 | Cloudflare Pages 的 **Build output directory** 没填 `projects/flatline` | 到 Pages 项目 Settings → Builds 把 Output directory 改成 `projects/flatline`（monorepo 子目录关键项，§4 方案 A） |
| `flatline.day` 打不开但 `www` 能开（或反之） | 根域/www 只配了一个 | 按 §5.3 把根域和 `www` 两条记录都配上；平台 Custom domains 里两个都加 |
| Lighthouse Performance < 95 | 引入了外部脚本/图片/字体，或加了广告 | 保持零外链（唯一例外是 AdSense 脚本，且它本就会拖分）；首发期别挂广告（§8/`MARKETING.md`） |
| 声音开关点了没反应 / 首次无声 | 浏览器要求用户手势后才允许 `AudioContext` 出声 | 正常：`app.js:147` 的 `AudioContext` 需用户交互后才 resume，点一下开局即恢复；`SND` 键切换静音并持久化到 `flatline.v1` |
| 换了域名但分享卡/战报还是旧域名 | 只改了 `index.html` 没改 `app.js:32` 的 `DOMAIN` | 三处都改（`app.js:32`、`index.html:97`、`index.html:102`），`grep -rn "旧域名"` 确认无残留（§3） |
| 【后端 SSE 被代理缓冲 / 机器休眠断流 / TRUST_PROXY】 | — | 本项目不涉及（无后端） |
| 【小游戏 微信内 navigator.vibrate 不可用】 | — | 本项目不涉及；且本项目源码本就未用 `navigator.vibrate`（声音走 `AudioContext`），无此隐患 |
