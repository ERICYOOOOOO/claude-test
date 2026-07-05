# 体内时钟 Body Clock · 全栈部署详解（从 0 到上线）

> 本指南假设你是一台全新的电脑，什么都没装：没有 Node、没有 Git、没有任何账号。跟着从上往下逐条照抄，就能把 H5 版推上全球 CDN、绑好自定义域名和 HTTPS，并把同一套判定逻辑打包成微信 / 抖音小游戏提审。命令可以直接复制粘贴，配置文件都给了完整内容和确切放置路径。

---

## 0. 这是什么 / 架构判定

**产品**：每日掐秒游戏。屏幕给一个目标时长（如 7.00 秒），按住表盘、心里数、松开——朱红秒针回摆指向你的误差（毫秒级）。每日一题、全球同题、三次机会取最好；误差越小称号越高（原子钟 ⚛️ → 日晷 🌞）。核心传播资产是"误差数字"本身：它是一句不需要上下文就能被理解、且能立刻被反驳（"不可能，我来"）的炫耀货币，和 Wordle 的绿黄格同构。详见 `DESCRIPTION.md` / `PLAYBOOK.md`。

**架构判定：纯静态 + 小游戏容器（static-minigame），无构建、无后端。**

判定依据（全部来自读源码）：

- 逻辑全在客户端。判定 / 称号 / 种子出题 / 连胜 / 分享文本全部是 `shared/core.js` 里的纯函数（不碰 DOM、不碰网络、不碰存储）。
- 数据只存本机。存档在 `localStorage['bodyclock.v1']`（见 `app.js:10` `var LS_KEY = 'bodyclock.v1'`），没有任何服务端、没有账号体系、没有网络请求。
- 没有构建步骤。项目里**没有** `build.js`、**没有** `package.json`（项目目录内）、**没有**任何打包器；`index.html` 直接用 `<script src="shared/core.js">` + `<script src="app.js">` 引原始文件，`file://` 双击即可跑。
- 没有后端。项目里**没有** `server.mjs` / Express / SSE / 数据库。托管成本≈0（静态托管免费额度足够）。
- 小游戏端是"客户端容器"而非服务器：`wechat-minigame/` 里 `game.js` 跑 Canvas 主循环，平台 API 全部收敛在 `adapter.js`，`shared/core.js` 是 H5 那份的**逐字节副本**。

**文件清单表**（逐个列出真实文件；"是否上生产"指 H5 静态托管要不要传）：

| 文件 | 作用 | 是否上传到 H5 生产 |
|---|---|---|
| `index.html` | H5 页面结构、`<meta>`、表盘/结算/设置/广告位 DOM | ✅ 必须 |
| `style.css` | 全部样式（精钢深灰 + 表盘灰白 + 朱红，299 行） | ✅ 必须 |
| `app.js` | H5 主逻辑：DOM、按住/松开采样、动效、持久化、分享卡、激励视频占位（745 行） | ✅ 必须 |
| `shared/core.js` | 三端共用纯函数核心（种子/判定/称号/连胜/分享/角度，UMD） | ✅ 必须 |
| `wechat-minigame/game.js` | 小游戏 Canvas 主循环 | ❌ 小游戏专用，H5 不传 |
| `wechat-minigame/adapter.js` | `wx.`/`tt.` 全部封装（自动探测微信/抖音） | ❌ 小游戏专用 |
| `wechat-minigame/shared/core.js` | `shared/core.js` 的逐字节副本（小游戏目录不能 require 包外文件） | ❌ 小游戏专用 |
| `wechat-minigame/game.json` | 小游戏窗口配置（竖屏、隐藏状态栏） | ❌ 小游戏专用 |
| `wechat-minigame/project.config.json` | 微信开发者工具项目配置（含 appid） | ❌ 小游戏专用 |
| `test/core.mjs` | Node 直测 core（40 项，含副本一致性校验） | ❌ 仅本地/CI |
| `test/smoke.mjs` | Playwright 冒烟（48 项） | ❌ 仅本地/CI |
| `test/qa-extra.mjs` | 对抗性 QA 附加测试（作弊面/状态机/跨天） | ❌ 仅本地/CI |
| `test/screenshots/*.png` | 测试落盘的素材截图 | ❌ 仅本地 |
| `DESCRIPTION.md` / `PLAYBOOK.md` / `MARKETING.md` / `DEPLOY.md` | 文档 | ❌ 不传 |

> 结论：**H5 上生产只需要 4 个文件**——`index.html`、`style.css`、`app.js`、`shared/core.js`（`shared/` 目录结构要保留，因为 HTML 里是 `href="style.css"`、`src="shared/core.js"` 相对路径引用）。

---

## 1. 从零准备环境

### 1.1 安装 Node.js（LTS，≥18；本项目用 v22 验证过）

本项目 H5 上线**不需要** Node（纯静态）。Node 只用于两件事：跑本地测试（`test/*.mjs`）和用命令行工具部署（`wrangler` / `vercel` / `netlify`）。装上准没错。

**macOS（推荐 Homebrew）**：
```bash
# 没装 Homebrew 先装（官网一行脚本）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node        # 装当前 LTS
```
或用 nvm（多版本管理，跨平台一致）：
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# 重开终端后：
nvm install --lts
nvm use --lts
```

**Windows（winget，Win10/11 自带）**：
```powershell
winget install OpenJS.NodeJS.LTS
```

**Linux（Debian/Ubuntu，NodeSource）**：
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```
或 Linux 上同样推荐 nvm（同上 macOS 的 nvm 段）。

**验证**（两条都要出版本号）：
```bash
node -v
npm -v
```
期望输出类似：
```
v22.22.2
10.9.0
```
只要 `node -v` ≥ `v18` 即可（本仓库在 `v22.22.2` 下测试全绿）。

### 1.2 安装并配置 Git

- macOS：`brew install git`（或装 Xcode Command Line Tools：`xcode-select --install`）
- Windows：`winget install Git.Git`
- Linux：`sudo apt-get install -y git`

配置提交身份（一次性，全局）：
```bash
git config --global user.name "你的名字"
git config --global user.email "ericgu050714@gmail.com"
```
验证：
```bash
git --version          # 期望 git version 2.x
git config --global --get user.email
```

### 1.3 需要注册的账号（逐个：用途 + 是否免费）

| 账号 | 用途 | 是否免费 | 何时需要 |
|---|---|---|---|
| **GitHub** | 存代码、CI、可选 GitHub Pages 托管 | 免费 | 一定要（连 Git 部署都靠它） |
| **Cloudflare** | 主推 H5 托管（Pages）+ 全球 CDN + DNS + HTTPS | 免费 | H5 上线（主推） |
| **Vercel** 或 **Netlify** | 备选 H5 托管 | 免费 | 二选一，可选 |
| **域名注册商**（Cloudflare Registrar / Namecheap / 阿里云万网） | 买 `bodyclock.fun` | 域名年费（约 ¥40–200/年，`.fun` 常有 1 美元首年） | 想要自定义域名 |
| **Google AdSense** | H5 网页广告变现 | 免费申请（有内容/流量门槛） | 想接网页广告时 |
| **微信公众平台**（mp.weixin.qq.com） | 微信小游戏 appid、流量主激励视频 | 免费（企业主体才能开流量主） | 上微信小游戏 |
| **字节跳动开放平台**（developer.open-douyin.com） | 抖音小游戏、流量变现、录屏分享 | 免费 | 上抖音小游戏 |

国内合规提醒：国内传播需要**已备案的域名 + HTTPS**——微信内置浏览器对非 HTTPS / 未备案域名有拦截/风险提示。备案在域名注册商（阿里云/腾讯云）处办理，周期通常 1–3 周，可与开发并行。

### 1.4 取得代码

本项目在一个 monorepo（`claude-test`）的 `projects/body-clock/` 子目录里。

**方式 A：克隆整个仓库**
```bash
git clone <你的仓库地址> claude-test
cd claude-test/projects/body-clock
pwd     # 应显示 .../claude-test/projects/body-clock
```

**方式 B：只取本项目目录（sparse checkout，省流量）**
```bash
git clone --no-checkout --filter=blob:none <你的仓库地址> claude-test
cd claude-test
git sparse-checkout init --cone
git sparse-checkout set projects/body-clock
git checkout
cd projects/body-clock
```

> 下文所有命令，除非特别标注"（仓库根）"，**默认工作目录都是 `projects/body-clock/`**（即本项目目录）。凡写"仓库根"处，指 `claude-test/`。

---

## 2. 本地运行与自验

### 2.1 直接浏览器打开 `index.html`（`file://`）

双击 `index.html`，或：
```bash
# macOS
open index.html
# Linux
xdg-open index.html
# Windows
start index.html
```
**能玩到**：完整核心循环——看目标、按住表盘、松开揭晓误差与称号、三次机会、结算、复制战报、保存 PNG、练习模式、设置里开关声音/干扰、"模拟看完"激励视频发奖、跨午夜换题（30 秒轮询 + 页面可见性检测）。全部逻辑和存档都在本机，`file://` 下**都正常**。

**`file://` 下需注意**：`navigator.clipboard` 在某些浏览器的 `file://` 上下文受限——"复制战报"会自动降级到 `document.execCommand('copy')`（`app.js` 的 `legacyCopy`），仍能复制。要 100% 还原线上体验（尤其剪贴板、后续 Service Worker/OG 抓取），用下面的本地服务器。

### 2.2 起本地静态服务器

```bash
# 方式一：Node（推荐，零全局安装）
npx serve .
# 输出里找 Local: http://localhost:3000

# 方式二：Python3（自带）
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

### 2.3 构建项目

**本项目不涉及**。没有 `build.js`、没有打包步骤——`index.html` 直接引 `style.css`、`shared/core.js`、`app.js` 原始文件。"构建产物"就是这 4 个源文件本身，改完即生效，无需编译。

### 2.4 后端起服

**本项目不涉及**。纯前端、零后端、无 `server.mjs`、无任何 API/SSE/数据库。所有状态在浏览器 `localStorage`。

### 2.5 小游戏：微信开发者工具导入 `wechat-minigame/`（从 0）

1. 到 [mp.weixin.qq.com](https://mp.weixin.qq.com) 底部下载**微信开发者工具**（稳定版），安装。
2. 同步 core 副本（**每次改过 `shared/core.js` 后必做**，详见 §3 与 §10）：
   ```bash
   cp shared/core.js wechat-minigame/shared/core.js
   node test/core.mjs      # 第 [7] 组会校验两份逐字节一致
   ```
3. 打开开发者工具 → 顶部选"小游戏" →「导入项目」→ 目录选 `projects/body-clock/wechat-minigame/`。
4. AppID：有正式号就填正式 appid；没有先点"测试号"。`project.config.json` 里已预填 `"appid": "touristappid"`（游客态），可先跑起来。
5. 点"编译"，模拟器里应能：看目标 → 按住 → 松开 → 误差/称号 → 三次结算。**真机预览必测**：震动手感、iOS 高刷屏计时、切后台回前台跨天。

### 2.6 运行自带测试

测试分两类：Node 直测（免浏览器）和 Playwright 冒烟（要 Chromium）。

**A. Node 直测 core（不需要任何依赖）**
```bash
node test/core.mjs
```
期望输出（尾部）：
```
  PASS wechat-minigame/shared/core.js 与 shared/core.js 逐字节一致

共 40 项: 40 通过, 0 失败
```
退出码 0 = 全绿。这 40 项覆盖：种子→目标分布/稳定性、称号 12 边界、连胜 8 场景、垃圾容错、分享文本格式、微信副本一致性。

**B. Playwright 冒烟 + 对抗性 QA（需要 Chromium）**

这两个用例文件 `import { chromium } from 'playwright'`，要先在**仓库根**装依赖：
```bash
# 在仓库根 claude-test/ 执行（package.json 里已声明 playwright ^1.61.1）
cd ../../          # 从 projects/body-clock 回到仓库根
npm install
# 首次还需下载 Chromium 浏览器二进制：
npx playwright install chromium
```
> 本仓库的 CI 机器已把 Chromium 预置在 `/opt/pw-browsers/`（含 `chromium-1194`），那种环境用 `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` 指过去即可，无需重新下载。一般自己的机器就用上面的 `npx playwright install chromium`。

跑测试（回到项目目录或用绝对/相对路径）：
```bash
cd projects/body-clock
node test/smoke.mjs
node test/qa-extra.mjs
```
`smoke.mjs` 期望尾部：
```
共 48 项: 48 通过, 0 失败
```
`qa-extra.mjs` 同样以 `共 N 项: N 通过, 0 失败` 收尾并 `process.exit(0)`。smoke 覆盖：零 console error、真实 mouse.down/up 掐秒的误差量级与称号一致性、3 次锁定、分享文本/PNG、激励视频占位发奖、练习隔离、时钟注入跨天、375/320px 无横滚、垃圾存档、reduced-motion。qa-extra 覆盖：逐档称号边界、切后台/多指/右键/超时/跨天等作弊面、状态机恢复。

**交付前质量门**：`core.mjs` 40 项 + `smoke.mjs` 48 项全绿，才算可上线。

---

## 3. 上线前必改（精确到文件 + 常量/行）

下面每一处的"现值"都是从源码逐字读到的真实值。

| # | 文件 | 位置（常量名/行号/选择器） | 现值 | 改成 |
|---|---|---|---|---|
| 1 | `app.js` | 第 9 行 `var DOMAIN` | `'bodyclock.fun'` | 你的真实域名（分享卡回流位、PNG 底部、复制战报尾行都用它） |
| 2 | `index.html` | 第 122 行 footer `<span class="num">` | `bodyclock.fun` | 同上真实域名（页脚展示） |
| 3 | `index.html` | 缺失：`<link rel="canonical">` | **当前没有** | 新增 `<link rel="canonical" href="https://你的域名/">`（见下方补丁） |
| 4 | `index.html` | 缺失：`og:url` | **当前没有 `og:url`** | 新增 `<meta property="og:url" content="https://你的域名/">` |
| 5 | `index.html` | 缺失：`og:image` | **当前没有 `og:image`** | 新增 `<meta property="og:image" content="https://你的域名/og.png">`（配一张 1200×630 分享图放站点根） |
| 6 | `wechat-minigame/game.js` | 第 16 行 `AD_UNIT_RETRY` | `'adunit-xxxxxxxxxxxxxxxx'` | 流量主后台创建的"再来一次机会"激励视频广告位 ID |
| 7 | `wechat-minigame/game.js` | 第 17 行 `AD_UNIT_DISTORTION` | `'adunit-yyyyyyyyyyyyyyyy'` | 流量主后台创建的"解锁干扰模式"激励视频广告位 ID |
| 8 | `wechat-minigame/project.config.json` | 第 3 行 `"appid"` | `"touristappid"` | 你申请到的真实小游戏 appid |
| 9 | `index.html` | 第 114–116 行 `<aside class="ad-slot">` | 自推广文案 | （接 AdSense 时）换成广告单元代码，见 §8 |

> 注意 `app.js` 第 8 行 `var core = window.BodyClockCore;`、第 10 行 `var LS_KEY = 'bodyclock.v1';` **不要动**——`DOMAIN` 是第 9 行，别改错行。存档键 `bodyclock.v1` 改了会导致老用户存档丢失。

**#3/#4/#5 的确切补丁**（把这几行加进 `index.html` `<head>` 里，紧挨现有的 og 标签，即当前第 8–11 行附近）：
```html
<link rel="canonical" href="https://bodyclock.fun/">
<meta property="og:url" content="https://bodyclock.fun/">
<meta property="og:image" content="https://bodyclock.fun/og.png">
```
（把 `bodyclock.fun` 换成你的真实域名；`og.png` 是一张 1200×630 的分享封面，放在与 `index.html` 同级的站点根目录。）

**改完如何验证**：

- #1/#2：本地起服（§2.2），打完一天，点"复制战报"，粘出来的尾行应是你的新域名；点"保存图片"，PNG 底部一行应是新域名。也可以在浏览器控制台跑：
  ```js
  window.__bc.shareText()   // 返回的字符串尾行应含新域名
  ```
- #3/#4/#5：`curl -s https://你的域名/ | grep -E 'canonical|og:url|og:image'` 应打印出你填的三行；再把首页 URL 贴进 §7 的 OG 调试器，卡图/标题应正确。
- #6/#7：微信开发者工具真机预览，结算屏点"看视频 · 再来一次机会"，应真的拉起激励视频（未开通流量主时 `adapter.js` 会走 `onFail` 静默，不卡死）。
- #8：开发者工具项目详情里 AppID 应显示为你的正式号，不再是 `touristappid`。

---

## 4. 部署（主链路，≥2 方案，主推 Cloudflare Pages）

本项目 H5 是纯静态四文件，用静态托管方案。下面给 A/B/C/D 四个方案，**主推 A（Cloudflare Pages）**：免费、全球 CDN、自带 HTTPS、DNS 也在同一家最省心。

> Monorepo 关键点：本项目在子目录 `projects/body-clock/`。所有平台都要把"根目录/输出目录"指到这个子目录，否则会把整个 monorepo 当站点。且本项目**无构建**，Build command 留空即可。

### 方案 A：Cloudflare Pages（主推）

**路线 ①：连 Git（网页操作，每次 push 自动部署）**

1. 先把代码推到 GitHub（若还没）：
   ```bash
   # 仓库根
   git add -A && git commit -m "deploy body-clock"
   git push origin <你的分支>
   ```
2. 登录 [dash.cloudflare.com](https://dash.cloudflare.com) → 左侧 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
3. 授权并选中 `claude-test` 仓库 → **Begin setup**。
4. 构建设置按下表**精确填写**（monorepo 子目录 + 无构建是关键）：

   | 字段 | 填什么 | 说明 |
   |---|---|---|
   | Production branch | 你的部署分支（如 `main`） | |
   | Framework preset | **None** | 无框架 |
   | Build command | **留空** | 本项目无构建 |
   | Build output directory | `projects/body-clock` | **指到子目录**（相对仓库根） |
   | Root directory (Advanced) | 留空（或填 `/`） | 保持仓库根，让 output 走上面的相对路径 |

   > 说明：Cloudflare Pages 的 "Build output directory" 是相对仓库根的路径。无构建时，它直接把该目录当发布内容。这样 `test/`、`wechat-minigame/`、`*.md` 也会被一起传上去——它们无害（不会被 `index.html` 引用），若想干净可用方案 A 路线 ② 的命令行直传只传四文件目录。
5. **Save and Deploy**。首次部署完会给一个 `<项目名>.pages.dev` 的地址，打开即线上。

**路线 ②：命令行 wrangler 直传（只传要上线的文件，最干净）**

```bash
# 安装 wrangler（全局）
npm i -g wrangler
# 登录（弹浏览器授权）
wrangler login
```
本项目根目录直接就是要发布的内容（四文件 + shared/ 目录都在这），直传：
```bash
# 在 projects/body-clock 目录
wrangler pages deploy . --project-name=body-clock
```
> 想只传纯净的四文件，先拷一份到临时目录再传：
> ```bash
> rm -rf /tmp/bodyclock-dist && mkdir -p /tmp/bodyclock-dist/shared
> cp index.html style.css app.js /tmp/bodyclock-dist/
> cp shared/core.js /tmp/bodyclock-dist/shared/
> # 若已做了 og.png / _headers 也一并拷进去
> wrangler pages deploy /tmp/bodyclock-dist --project-name=body-clock
> ```
期望输出末尾出现 `✨ Deployment complete! Take a peek over at https://xxxx.body-clock.pages.dev`。

### 方案 B：Vercel（或 Netlify）

**Vercel（命令行）**：
```bash
npm i -g vercel
cd projects/body-clock
vercel            # 首次交互式：登录 → 关联/新建项目 → 确认目录
vercel --prod     # 正式部署
```
在 `projects/body-clock/` 下新建 `vercel.json`（完整内容，缓存头见 §6 会再扩展；此处最小可用版）：

文件路径：`projects/body-clock/vercel.json`
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "trailingSlash": false
}
```
> 若通过 Vercel 网页版连 Git 部署 monorepo：项目设置里把 **Root Directory** 设为 `projects/body-clock`，Framework Preset 选 **Other**，Build/Output 全部留空（无构建）。

**Netlify（命令行）**：
```bash
npm i -g netlify-cli
cd projects/body-clock
netlify deploy            # 预览
netlify deploy --prod     # 正式
```
在 `projects/body-clock/` 下新建 `netlify.toml`（完整内容）：

文件路径：`projects/body-clock/netlify.toml`
```toml
[build]
  publish = "."
  command = ""

# 缓存头在 §6 补全；这里先给可用骨架
[[headers]]
  for = "/*.html"
  [headers.values]
    Cache-Control = "no-cache, must-revalidate"
```
> Netlify 网页版连 Git：Base directory 填 `projects/body-clock`，Publish directory 填 `projects/body-clock`（或相对 base 的 `.`），Build command 留空。

### 方案 C：GitHub Pages（无构建，网页操作 + 可选 Actions）

本项目无构建，最简单是让 Actions 把子目录作为 artifact 发布（因为 Pages 原生只认仓库根或 `/docs`，子目录 monorepo 用 Actions 最干净）。

**路线①：纯网页（把整仓库当站点，适合项目在仓库根时）** — 本项目在子目录，**不推荐**，跳过。

**路线②：GitHub Actions 发布子目录（推荐）**

在**仓库根**新建工作流文件（完整内容）：

文件路径：`.github/workflows/deploy.yml`（相对仓库根，绝对路径 `/home/user/claude-test/.github/workflows/deploy.yml`）
```yaml
name: Deploy body-clock to GitHub Pages

on:
  push:
    branches: [ main ]          # 改成你的部署分支
    paths:
      - 'projects/body-clock/**'
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

      # 本项目无构建，但同步 core 副本 + 跑 core 测试作为守门（可选但推荐）
      - name: Sync core copy & run core tests
        working-directory: projects/body-clock
        run: |
          cp shared/core.js wechat-minigame/shared/core.js
          node test/core.mjs

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: projects/body-clock          # 只发布本项目目录

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```
然后在 GitHub 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。push 到部署分支后，Actions 跑完会给出 `https://<user>.github.io/<repo>/` 地址。

> GitHub Pages 子目录部署的**相对路径陷阱**：如果站点最终挂在 `https://<user>.github.io/claude-test/` 这种带子路径的 URL 下，本项目的相对引用（`href="style.css"`、`src="shared/core.js"`、`src="app.js"`）仍然正常，因为它们是**相对当前 HTML 的相对路径**。但绝不要把它们改成以 `/` 开头的绝对路径（会 404）。绑自定义顶级域名（§5）后站点在根路径 `/`，这个问题彻底消失——**强烈建议绑定自定义域名**。

### 方案 D：自建 Nginx（可选）

把四文件（含 `shared/` 目录）传到服务器 `/var/www/bodyclock/`，Nginx server 块（完整内容）：

文件路径：`/etc/nginx/sites-available/bodyclock.conf`
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name bodyclock.fun www.bodyclock.fun;

    root /var/www/bodyclock;
    index index.html;

    # SPA 不需要 try_files 回退，这是多资源静态站，直接找文件即可
    location / {
        try_files $uri $uri/ =404;
    }

    # 缓存策略见 §6，此处先给核心三类
    location = /index.html {
        add_header Cache-Control "no-cache, must-revalidate";
    }
    location ~* \.(?:css|js)$ {
        add_header Cache-Control "public, max-age=3600";
    }
    location ~* \.(?:png|jpg|jpeg|svg|ico)$ {
        add_header Cache-Control "public, max-age=86400";
    }
}
```
启用 + HTTPS（certbot）：
```bash
sudo ln -s /etc/nginx/sites-available/bodyclock.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bodyclock.fun -d www.bodyclock.fun
```

### 小游戏发布（H5 用上面静态方案；小游戏独立走容器）

微信小游戏 H5 端上静态、小游戏端上平台容器，两者互不影响。完整微信流程：

1. **申请 appid**：[mp.weixin.qq.com](https://mp.weixin.qq.com) 注册**小程序**账号（个人/企业主体都能发小游戏；**只有企业主体能开流量主广告**）。服务类目选**游戏 → 休闲游戏**。「开发 → 开发管理 → 开发设置」拿 appid，填进 `project.config.json`（§3 #8）。
2. **同步 core 副本**（改过 `shared/core.js` 才需要，但发布前建议跑一次守门）：
   ```bash
   cp shared/core.js wechat-minigame/shared/core.js
   node test/core.mjs
   ```
3. **开发者工具导入**：`wechat-minigame/` 目录，编译 → 真机预览（震动/高刷/跨天必测）。
4. **广告位**：企业主体注册用户满平台门槛后，「流量主」开通 → 创建两个**激励式视频广告位** → ID 填进 `game.js` 第 16/17 行（§3 #6/#7）。所有 `wx.` 都在 `adapter.js`：`createRewardedVideo`（`onClose` 的 `res.isEnded` 才发奖）、`shareAppMessage`、`vibrateShort({type:'light'})`、`getStorageSync/setStorageSync`。
5. **上传 → 提交审核**：开发者工具"上传"填版本号/备注 → mp 后台"版本管理"提交审核 → 通过后"发布"。
6. **类目 / 版号注意**：休闲游戏类目按平台**当期**政策自查——无版号小游戏有阶段性备案通道，提审前务必看"社区—公告"当日口径（规则常变）。分享文案避免"分享后获得××"（本作分享无奖励，合规）。"全球同题"在审核语境下建议写"每日同题"，避免境外服务联想。

**抖音差异**（同一份 `wechat-minigame/` 代码可直接提审）：

- `adapter.js` 第 11–17 行自动探测全局对象：`tt` 存在 → 抖音，`wx` 存在 → 微信。无需改代码。
- 在 [字节开放平台](https://developer.open-douyin.com) 创建小游戏，用"抖音开发者工具"导入同一目录。
- 震动：抖音 `tt.vibrateShort()` 不支持 `type` 参数（`adapter.js` 传了会被忽略，无副作用）。
- 激励视频 `adUnitId` 在字节"流量变现"后台创建。
- **录屏分享（抖音核心传播能力）**：抖音 `tt.shareAppMessage` 多一个 `channel: 'video'`，可拉起录屏发布抖音视频；建议接 `tt.getGameRecorderManager` 录"按住→揭晓"10 秒片段——干扰模式 + 翻车瞬间是天然短视频素材。
- 群能力（`wx.getGroupCloudStorage` 好友 PK 榜）仅微信侧有，抖音无对应。

---

## 5. 自定义域名 + DNS + HTTPS

### 5.1 买域名

在 Cloudflare Registrar（买完 DNS 就在同一家，最省事）、Namecheap、或国内阿里云/腾讯云买 `bodyclock.fun`。**国内传播必须走已备案域名**（备案在阿里云/腾讯云办，1–3 周），否则微信内置浏览器拦截。

### 5.2 各平台绑定域名步骤

- **Cloudflare Pages（主推）**：项目 → **Custom domains** → **Set up a domain** → 输入 `bodyclock.fun` → 若域名 DNS 已托管在 Cloudflare，会**自动加 CNAME 记录**并签发证书，几分钟生效。同理再加 `www.bodyclock.fun`。
- **Vercel**：项目 → **Settings → Domains** → 加 `bodyclock.fun`，按提示在 DNS 处加记录。
- **Netlify**：**Site settings → Domain management → Add custom domain**。
- **GitHub Pages**：**Settings → Pages → Custom domain** 填 `bodyclock.fun` → 会在仓库发布内容里生成 `CNAME` 文件（Actions 部署时该文件要在 `projects/body-clock/` 里；可手动新建 `projects/body-clock/CNAME` 内容为一行 `bodyclock.fun`）→ 勾选 **Enforce HTTPS**。

### 5.3 DNS 记录表（真实值）

在你的 DNS 托管处（推荐 Cloudflare DNS）按所选托管平台加记录：

| 托管平台 | 类型 | 主机名 | 值 | 说明 |
|---|---|---|---|---|
| **Cloudflare Pages** | CNAME | `bodyclock.fun`（@） | `<项目名>.pages.dev` | 同家托管时面板自动加，通常无需手填 |
| | CNAME | `www` | `<项目名>.pages.dev` | www 子域 |
| **GitHub Pages** | A | `@` | `185.199.108.153` | 4 条 A 记录（apex） |
| | A | `@` | `185.199.109.153` | |
| | A | `@` | `185.199.110.153` | |
| | A | `@` | `185.199.111.153` | |
| | CNAME | `www` | `<user>.github.io` | 注意是 `github.io` 不带仓库名 |
| **Vercel** | A | `@` | `76.76.21.21` | apex |
| | CNAME | `www` | `cname.vercel-dns.com` | |
| **Netlify** | A | `@` | `75.2.60.5` | 或用 Netlify DNS 的 ALIAS/ANAME |
| | CNAME | `www` | `<site>.netlify.app` | |

> 用 Cloudflare 代理（橙色云）时，apex 的 CNAME flattening 会自动处理，直接 CNAME 到平台域名即可。

### 5.4 HTTPS 自动签发

Cloudflare Pages / Vercel / Netlify / GitHub Pages **全部自动签发并续期 Let's Encrypt / 平台证书**，你只需在面板勾选"强制 HTTPS"（GitHub Pages 是 Enforce HTTPS）。自建 Nginx 用 §4 方案 D 的 `certbot` 命令签发，certbot 会装自动续期定时任务。

**国内 / 内嵌浏览器强制 HTTPS**：微信小游戏容器要求所有网络请求为 HTTPS（本作无网络请求，天然满足）；微信/抖音内置浏览器打开 H5 时，非 HTTPS 会有安全提示甚至拦截——**H5 必须上 HTTPS**。

---

## 6. 缓存策略（可照抄配置全文）

目标头（本项目特性：每日题 + 逻辑常更新，HTML 要即时回源；CSS/JS **未做文件名指纹**（引用是裸 `style.css`/`app.js`），所以不能超长缓存，否则改了逻辑用户拿到旧版）：

| 资源 | Cache-Control | 原因 |
|---|---|---|
| `*.html` | `no-cache, must-revalidate` | 每日题/逻辑常更，必须回源校验 |
| `*.css` / `*.js` | `public, max-age=3600` | 1 小时；无指纹，勿超长。若要长缓存需先把引用改成 `app.v2.js` 之类带版本名 |
| `*.png`/`*.jpg`/`*.svg`/`*.ico`（含 OG 图） | `public, max-age=86400` | 图片 1 天 |

**Cloudflare Pages / Netlify 的 `_headers`**（完整内容）：

文件路径：`projects/body-clock/_headers`（放站点根，随发布内容一起上传）
```
/*.html
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

/*.ico
  Cache-Control: public, max-age=86400
```

**Vercel 的 `vercel.json` headers 段**（完整文件，替换 §4 的最小版）：

文件路径：`projects/body-clock/vercel.json`
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
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
      "source": "/(.*)\\.(png|jpg|jpeg|svg|ico)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=86400" }
      ]
    }
  ]
}
```

**Nginx location 段**（完整内容，替换/合并进 §4 方案 D 的 server 块）：

文件路径：`/etc/nginx/sites-available/bodyclock.conf`（server 块内）
```nginx
    location = /index.html {
        add_header Cache-Control "no-cache, must-revalidate";
    }
    location ~* \.html$ {
        add_header Cache-Control "no-cache, must-revalidate";
    }
    location ~* \.(?:css|js)$ {
        add_header Cache-Control "public, max-age=3600";
    }
    location ~* \.(?:png|jpe?g|svg|ico)$ {
        add_header Cache-Control "public, max-age=86400";
    }
```
改完 `sudo nginx -t && sudo systemctl reload nginx`。

**验证缓存头**：
```bash
curl -sI https://bodyclock.fun/ | grep -i cache-control
# 期望: cache-control: no-cache, must-revalidate
curl -sI https://bodyclock.fun/app.js | grep -i cache-control
# 期望: cache-control: public, max-age=3600
```

---

## 7. SEO 上线

本项目是单页小游戏，SEO 给最小可用集即可（它不靠搜索引擎流量，靠社交裂变，所以 **OG 卡图比 sitemap 更重要**）。

**`robots.txt`**（完整内容）：

文件路径：`projects/body-clock/robots.txt`
```
User-agent: *
Allow: /

Sitemap: https://bodyclock.fun/sitemap.xml
```

**`sitemap.xml`**（完整内容，单页站点就一条）：

文件路径：`projects/body-clock/sitemap.xml`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://bodyclock.fun/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```
> 本项目无 `build.js`，这两个文件**手写并随四文件一起上传**即可（不是生成的）。验证 200：`curl -sI https://bodyclock.fun/robots.txt` 和 `/sitemap.xml` 应返回 `200`。

**Google Search Console**：
1. [search.google.com/search-console](https://search.google.com/search-console) → 添加资源 → 选"网域"（Domain）→ 填 `bodyclock.fun` → 按提示在 DNS 加一条 TXT 记录验证。
2. 验证通过后 → **Sitemaps** → 提交 `https://bodyclock.fun/sitemap.xml`。

**Bing Webmaster Tools**：[bing.com/webmasters](https://www.bing.com/webmasters) → **Import from Google Search Console**（一键导入，省去重复验证）。

**OG 卡图调试**（本作最关键的一步——分享到群/微博/Telegram 要出正确卡图，依赖 §3 补的 `og:image`）：
- Facebook / 通用：[developers.facebook.com/tools/debug](https://developers.facebook.com/tools/debug/) 输 URL → **Scrape Again** 刷新缓存。
- X（Twitter）：[cards-dev.twitter.com/validator](https://cards-dev.twitter.com/validator)。
- Telegram：直接把链接发给 [@WebpageBot](https://t.me/webpagebot) 让它刷新缓存。
- 微信内：分享一次链接看卡片；微信卡片缓存较顽固，改图后需**换带参数的 URL**（如 `?v=2`）强制刷新。

---

## 8. 变现挂点激活

### 8.1 H5 网页广告（Google AdSense）

- **申请门槛**：站点要有实质内容、一定访问量、绑定自定义域名并上 HTTPS；提交后人工审核数天到数周。
- **`ads.txt`**（申请通过后，把发布商 ID 换成你自己的，放**站点根**）：

  文件路径：`projects/body-clock/ads.txt`
  ```
  google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0
  ```
  （`pub-0000...` 换成 AdSense 里你的 Publisher ID；`f08c47fec0942fa0` 是 Google 的固定 TAG-ID，照抄。）

- **把预留广告位换成广告代码**：`index.html` 第 114–116 行有预留位——
  ```html
  <aside class="ad-slot" aria-label="推广位">
    <span class="micro">明天换一道题 · 把连胜守住</span>
  </aside>
  ```
  审核通过后，把 `<aside class="ad-slot">…</aside>` 内部换成 AdSense 单元代码（建议 300×100，结果页下方，勿加动画）。本项目**无构建**，直接改 `index.html` 这一处、重新部署即全站生效（单页站，一处即全部）。审核通过前保持自推广样式。

### 8.2 小游戏激励视频（微信流量主 / 抖音流量变现）

- **申请与填写位置**：企业主体在微信"流量主"或抖音"流量变现"后台创建两个**激励式视频广告位**，把 `adUnitId` 填进 `wechat-minigame/game.js` 第 16 行 `AD_UNIT_RETRY`、第 17 行 `AD_UNIT_DISTORTION`（§3 #6/#7）。两个挂点：结算屏"再来一次机会"（今日 +1 次，每天限 1 次）、"解锁干扰模式 ★"（一次性）。
- **合规红线（必须遵守）**：
  - **发奖以 `res.isEnded === true` 为准**——`adapter.js` 的 `createRewardedVideo` 已实现：`onClose(res => { if (!res || res.isEnded) onReward() })`。**不得"关闭广告也发奖"**。
  - **诱导分享红线**：分享按钮文案不得出现"分享后获得××"。本作分享无任何奖励，合规。
  - 无广告填充时（`onError`）按钮不能卡死——`adapter.js` 走 `onFail` 静默，下次仍可点。

### 8.3 联盟 / 其它

参见 `MARKETING.md`：核心传播资产是"误差数字"，渠道以抖音话题 #你的体内时钟准吗 和微信群 PK 话术为主，非广告联盟型。此处不涉及独立联盟挂点。

---

## 9. 上线后自检清单

- [ ] **真机 iOS Safari**：按住/松开手感、秒针回摆、误差数字入场动画正常。
- [ ] **真机 Android Chrome**：同上；`navigator.vibrate` 有震动反馈。
- [ ] **HTTPS 生效**：`https://bodyclock.fun` 绿锁，`http://` 自动跳 `https://`。
- [ ] **www 与裸域都可达**：`https://www.bodyclock.fun` 和 `https://bodyclock.fun` 都能开。
- [ ] **OG 卡图正确**：分享到微信/X/Telegram，标题+描述+封面图（§3 补的 `og:image`）都对。
- [ ] **跨时区/跨午夜换题**：改设备时区，期号（`issue-no`）随本地日期变；23:59 等到 00:00 自动换新题（30s 轮询 + visibilitychange）。
- [ ] **Lighthouse 移动端 Performance ≥ 95**：Chrome DevTools → Lighthouse → Mobile 跑一遍。
- [ ] **复制战报 / 保存 PNG**：文本尾行域名正确；PNG 底部域名正确、表盘针角与误差一致。
- [ ] **练习模式隔离**：练习成绩不写入每日、不影响连胜、不占三次机会。
- [ ] **垃圾存档容错**：手动往 `localStorage['bodyclock.v1']` 塞乱数据，刷新不白屏不 NaN（`normalizeState` 兜底）。
- [ ] **零 console error**：DevTools Console 无红字（smoke 测试也守这条）。

**小游戏专项**：
- [ ] 震动手感（微信 `type:'light'`；抖音无 type）。
- [ ] iOS 高刷屏计时准确（120Hz 屏上误差量级正常）。
- [ ] 切后台跨天：压后台过午夜再回来，`onShow → checkDay` 换新题不卡死。
- [ ] 激励视频**无填充也不卡死**（`onError → onFail` 静默）；看完才发奖。

---

## 10. 持续更新与运维

**改数据 / 逻辑的标准流程**（本项目无构建，核心是"改一处 core → 同步副本 → 测试 → 部署"）：

1. 改逻辑：只改 `shared/core.js`（种子/称号/连胜/分享等纯函数一处生效三端）。改样式改 `style.css`，改交互改 `app.js` / `wechat-minigame/game.js`。
2. **同步 core 副本（改过 `shared/core.js` 必做）**：
   ```bash
   cp shared/core.js wechat-minigame/shared/core.js
   ```
3. **跑测试守门**：
   ```bash
   node test/core.mjs      # 期望 共 40 项: 40 通过, 0 失败（含副本逐字节一致校验）
   node test/smoke.mjs     # 期望 共 48 项: 48 通过, 0 失败（需 Playwright）
   ```
   `core.mjs` 第 [7] 组会在副本不一致时直接 FAIL 并提示 `运行 cp shared/core.js wechat-minigame/shared/core.js`——这是防止两端逻辑漂移的最后一道闸。
4. **部署**：
   - H5：`git push`（连 Git 的 Cloudflare/Vercel/Netlify/GitHub Actions 自动重部署），或 `wrangler pages deploy . --project-name=body-clock` 手动直传。
   - 小游戏：开发者工具重新"上传" → mp/字节后台提交审核 → 发布。
5. **改了 CSS/JS 但用户拿到旧版？** 见 §6——HTML 是 `no-cache` 会即时回源，但 CSS/JS 有 1 小时缓存；急更时可在 Cloudflare 面板 **Purge Cache**，或把引用改成带版本名（`app.v2.js`）。

**日志 / 监控 / 回滚**：纯静态无服务端日志。用托管平台自带的分析（Cloudflare Web Analytics 免费、无 cookie）。回滚：Cloudflare Pages / Vercel / Netlify 每次部署都有历史版本，面板一键 **Rollback** 到上一个部署。备份：源码在 Git 即是备份，无数据库、无用户数据需备份（存档在各用户本机 `localStorage`）。

---

## 11. 故障排查表

| 症状 | 可能原因 | 解决 |
|---|---|---|
| `file://` 下"复制战报"没反应 | `navigator.clipboard` 在 `file://` 受限 | 已自动降级 `document.execCommand`（`legacyCopy`）；用 `npx serve .` 起 http 即完全正常 |
| 分享到微信/X 卡图是旧的或没图 | 未配 `og:image`（§3 #5 现缺失）/ 平台缓存了旧抓取 | 先补 `og:image`；再用 §7 的 OG 调试器 **Scrape Again**；微信端换带 `?v=2` 参数的 URL 强制刷新 |
| 改了 `app.js`/`style.css`，用户还是旧版 | CSS/JS 有 1 小时 `max-age`（§6，且无文件名指纹） | 等缓存过期 / 面板 Purge Cache / 把引用改成 `app.v2.js` 带版本名 |
| GitHub Pages 上样式/脚本 404 | 站点挂在 `/<repo>/` 子路径，且有人把相对路径改成了 `/style.css` 绝对路径 | 保持相对路径（`href="style.css"`）；**最好绑自定义域名**让站点在根路径 `/`（§5） |
| 分享战报域名还是 `bodyclock.fun` 占位 | 忘改 `app.js:9` `DOMAIN` | 改第 9 行为真实域名，`window.__bc.shareText()` 复验（§3 #1） |
| 小游戏点激励视频卡住/报错 | `adUnitId` 还是占位（`adunit-xxxx…`）或流量主未开通 | 填真实 ID（§3 #6/#7）；未开通时 `adapter` 走 `onFail` 静默不发奖，属预期 |
| 微信小游戏里没有震动 | iOS 微信内 H5 `navigator.vibrate` 不可用 | 已 try/catch 静默（`app.js` `vibrate`）；小游戏端走 `wx/tt.vibrateShort`，正常 |
| 跨午夜没换题 | 设备时钟/时区异常，或页面一直在后台 | 前台 30s 轮询 `checkDay` + `visibilitychange` 回前台补检；本地可用 `window.__bc.setNow(ms)` 注入时钟复现 |
| 微信/抖音内打开 H5 有安全提示 | 非 HTTPS 或域名未备案 | 上 HTTPS（§5.4）+ 国内用已备案域名 |
| `node test/smoke.mjs` 报 `Cannot find package 'playwright'` | 没在仓库根 `npm install` | 仓库根 `npm install && npx playwright install chromium`（§2.6） |
| `node test/core.mjs` 第 [7] 组 FAIL | 改了 `shared/core.js` 没同步副本 | `cp shared/core.js wechat-minigame/shared/core.js` 后重跑（§10） |
| 存档乱码后白屏/NaN | 理论上不会——`normalizeState` 兜底任何垃圾输入 | 若复现，清 `localStorage['bodyclock.v1']` 后刷新；并作为 bug 上报 |

---

_本指南所有源码事实（文件、常量、行号、现值）均来自对 `projects/body-clock/` 的逐文件通读；测试期望值来自实跑 `node test/core.mjs`（40 项全绿）。上线前请以 §3 的必改表逐条核对。_
