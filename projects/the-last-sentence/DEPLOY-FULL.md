# The Last Sentence 最后一句话 · 全栈部署详解（从 0 到上线）

> 本指南假设你是一台全新的电脑，什么都没装：没有 Node、没有 Git、没有任何账号。跟着从上到下逐条照抄即可把这个"全世界共享一句话"的真·全栈应用送上线并长期运营。所有涉及源码的常量名、行号、端口、环境变量、生成物，都来自本项目真实文件（`server.mjs` / `app.js` / `index.html`），可放心照抄。

---

## 0. 这是什么 / 架构判定

**产品一句话**：全世界共享一个文本框。此刻只有一句话是"活着"的，页面正中一个毫秒级计时器在数它已经活了多久；任何人写下新句子（≤120 字符）就覆盖它，旧句坠入下方无限滚动的墓地，墓碑上刻着它活了多少毫秒（`survived 9ms` 和 `survived 3h 12m 44.108s` 同样值得截图）。没有账号、没有点赞、没有算法，只有一个问题：你的句子能活多久。传播资产只有两样——**极端的存活时长**和**序号的整数关口**（`#10,000`），所有物料围绕"截图墓碑"这个动作。

**架构判定：含后端的真·全栈应用（fullstack-backend）**。依据：
- 产品本体是**共享状态**——所有浏览器实时看同一句话、同一个计时器。这个状态活在服务器内存里，靠 SSE（Server-Sent Events）广播给所有人。这不是纯静态项目，**不能**只丢到 CDN 上。
- 后端是**零依赖 Node 单文件** `server.mjs`：仅用 `node:http` + `node:fs` + `node:path` + `node:url`，无框架、无 npm 依赖、无数据库。持久化就是往一个 JSONL 文本文件追加行。
- 前端是三个静态文件（`index.html` / `style.css` / `app.js`），无框架无 CDN。它有一个**降级机制**：探测不到真后端（响应缺 `X-App: last-sentence` 头）时，3.5 秒内自动进入自带的 offline demo（12 条预置墓碑），因此前端三文件也可以单独当预告页/降级页。
- **关键约束：只能跑 1 个实例**。状态在内存，多实例会分裂成互不相通的多个世界。任何横向扩容都是错的。

**文件清单表**

| 文件 | 作用 | 是否需上传到生产 |
|---|---|---|
| `server.mjs` | 零依赖后端：静态服务 + SSE 广播 + POST /say + 按 IP 限流 + JSONL 持久化恢复 | ✅ 必须（后端入口） |
| `index.html` | 前端骨架、OG 标签、广告位、demo 横幅节点 | ✅ 必须 |
| `style.css` | 全部样式（纪念碑美学，近黑 `#111110` + 琥珀 `#d8a03d`） | ✅ 必须 |
| `app.js` | 前端逻辑：SSE 接收、打字机/下坠动效、计时器、限流倒计时、offline demo | ✅ 必须 |
| `history.jsonl` | **运行时自动生成**的追加日志，每句一行，重启靠它恢复墓地/总数/当前句 | ⚠️ 不在仓库里，运行时生成，**必须放在持久卷上并每日备份** |
| `test/smoke.mjs` | 冒烟测试（44 项断言，需 Playwright） | ❌ 不上传 |
| `test/qa-extra.mjs` | 对抗性 QA 测试（并发/恶意负载/断线重连等，需 Playwright） | ❌ 不上传 |
| `test/screenshots/` | 测试产出的评审截图 | ❌ 不上传 |
| `DESCRIPTION.md` / `PLAYBOOK.md` / `MARKETING.md` / `DEPLOY.md` | 产品、玩法、宣发、简版部署文档 | ❌ 不上传 |

> 注意：本项目目录里**没有** `package.json`（仓库根有一个，仅为跑测试装 Playwright）。后端零依赖，`node server.mjs` 直接可跑。某些平台坚持要 `package.json` 时，第 4 章会给最小文件全文。

---

## 1. 从零准备环境

### 1.1 安装 Node.js（LTS，本项目要求 ≥18；仓库实测 v22）

后端只用 Node 内置模块，任何 ≥18 的版本都行。下面三平台任选其一。

**macOS（推荐 nvm，可多版本切换）**
```bash
# 装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# 重开终端后
nvm install --lts
nvm use --lts
```
或用 Homebrew：
```bash
brew install node
```

**Windows（winget，Win10/11 自带）**
```powershell
winget install OpenJS.NodeJS.LTS
```
装完关闭并重开 PowerShell。

**Linux（nvm，最省心）**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# 重开终端
nvm install --lts && nvm use --lts
```
或用 NodeSource（Debian/Ubuntu 系统级安装）：
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**验证**（三平台通用）：
```bash
node -v
npm -v
```
期望输出类似：
```
v22.22.2
10.9.3
```
只要 `node -v` 是 `v18.x` 或更高即可。

### 1.2 安装并配置 Git

- macOS：`brew install git`（或首次运行 `git` 会提示安装 Xcode Command Line Tools）。
- Windows：`winget install Git.Git`。
- Linux：`sudo apt-get install -y git`。

配置身份（换成你自己的）：
```bash
git config --global user.name "你的名字"
git config --global user.email "you@example.com"
```
验证：
```bash
git --version          # 期望 git version 2.x
git config --global user.name   # 回显你刚设的名字
```

### 1.3 需要注册的账号

| 账号 | 用途 | 是否免费 |
|---|---|---|
| **GitHub** | 存代码、CI、可选 GitHub Pages（仅能挂 demo 预告页，不能跑后端） | 免费 |
| **Fly.io**（主推后端平台） | 跑 `server.mjs`：单机 + 持久卷 + 全球 Anycast + 自动 HTTPS | 有免费额度，超出按量付费；需绑卡 |
| **Railway**（备选后端平台） | 免 Dockerfile 部署 Node + 挂卷 | 有试用额度，之后约 $5/月起 |
| **域名注册商**（Cloudflare Registrar / Namecheap / 阿里云等） | 买正式域名 | 域名本身收费（约 $10/年起） |
| **Cloudflare**（可选） | DNS 托管 + 反代 demo 预告页；或做正式域名的橙云代理 | 免费 |
| **Google AdSense**（可选，变现） | 广告位变现（见第 8 章，需站点有内容与流量后申请） | 免费申请，审核制 |

> 纯后端上线**不需要** Vercel/Netlify/Cloudflare Pages 账号——那些是静态托管，只能承载 demo 预告页（方案见 4.4）。

### 1.4 取得代码

本项目在一个 monorepo 里，路径是 `projects/the-last-sentence/`。

**方式 A：克隆整个仓库**
```bash
git clone https://github.com/ERICYOOOOOO/claude-test.git
cd claude-test/projects/the-last-sentence
```
（把 `ERICYOOOOOO/claude-test` 换成你自己 fork/仓库的 `owner/repo`。）

**方式 B：只取本项目目录（sparse checkout，省带宽）**
```bash
git clone --filter=blob:none --sparse https://github.com/ERICYOOOOOO/claude-test.git
cd claude-test
git sparse-checkout set projects/the-last-sentence
cd projects/the-last-sentence
```

此后本指南所有相对路径都以**项目目录** `.../projects/the-last-sentence/` 为基准，涉及仓库根时会明确写"（仓库根）"。当前目录确认：
```bash
pwd     # 结尾应是 /projects/the-last-sentence
ls      # 应看到 app.js index.html server.mjs style.css test/ 等
```

---

## 2. 本地运行与自验

### 2.1 直接用浏览器打开 index.html（file://）

双击 `index.html`，或：
```bash
# macOS
open index.html
# Linux
xdg-open index.html
# Windows
start index.html
```
你会看到：顶部一条 **offline demo** 横幅、12 条预置墓碑、一句预置的"活着的句子"和跳动的计时器。**能玩到**：本地自娱式覆盖（写一句会本地覆盖、计时归零、旧句进墓地）、复制墓碑文案、10 秒冷却。**不能玩到**：真实的全球共享——`file://` 下没有后端，你写的东西不会离开这一页（横幅已写明）。原因见 `app.js:420`：`if (HTTP) { ...connect() } else enterDemo();`——`file://` 协议直接进 demo。

### 2.2 起本地静态服务器（只跑前端、仍是 demo）

如果只想在 `http://` 下看前端（仍无后端，会在 3.5s 后进 demo）：
```bash
npx serve .
# 或
python3 -m http.server 8000
```
访问 `http://localhost:3000`（serve）或 `http://localhost:8000`（python）。注意：这**不是**真后端，页面探测不到 `X-App: last-sentence` 头，3.5 秒后仍进 offline demo。要跑真后端见下。

### 2.3 【本项目重点】起真后端：node server.mjs

```bash
node server.mjs
```
期望输出（端口默认 8787，见 `server.mjs:20`）：
```
the last sentence — listening on http://127.0.0.1:8787 (sentence #1 is alive)
```
浏览器打开 **http://127.0.0.1:8787** ——现在是真 live 模式：右上角连接点变琥珀色显示 `live`，首句是创世句 `someone will overwrite this.`（见 `server.mjs:28` 的 `GENESIS`）。开两个浏览器窗口，在一个里提交，另一个会**实时**看到覆盖（SSE 广播）。

此时项目目录下会自动生成 `history.jsonl`（`server.mjs:22`，默认 `path.join(ROOT, 'history.jsonl')`）。

**用 curl 测三个端点：**

测 SSE 流 `GET /events`（会持续输出，`Ctrl-C` 停）：
```bash
curl -N http://127.0.0.1:8787/events
```
期望立刻收到一条快照事件，形如：
```
:welcome

event: state
data: {"current":{"text":"someone will overwrite this.","seq":1,"bornAt":...},"total":1,"graves":[],"now":...}
```
之后每 25 秒有一行 `:hb` 心跳（`server.mjs:118`）。

测提交 `POST /say`（另开一个终端）：
```bash
curl -s -X POST http://127.0.0.1:8787/say \
  -H 'Content-Type: application/json' \
  -d '{"text":"the tide forgets every name written in sand"}'
```
期望：
```json
{"ok":true,"seq":2,"cooldownMs":10000}
```
此时刚才 `curl -N /events` 那个终端会立刻多出一条 `event: overwrite`。

测冷却限流（同一 IP 10 秒内再发一次）：
```bash
curl -s -X POST http://127.0.0.1:8787/say \
  -H 'Content-Type: application/json' \
  -d '{"text":"too soon"}'
```
期望 HTTP 429：
```json
{"error":"cooldown","retryAfterMs":9xxx}
```

测校验：
```bash
# 空/纯空白 → 400 empty
curl -s -X POST http://127.0.0.1:8787/say -H 'Content-Type: application/json' -d '{"text":"   "}'
# 超 120 字符 → 400 too_long
curl -s -X POST http://127.0.0.1:8787/say -H 'Content-Type: application/json' -d "{\"text\":\"$(printf 'x%.0s' {1..121})\"}"
```

**用环境变量改配置**（`server.mjs:20-24`）：
```bash
PORT=9000 HOST=127.0.0.1 HISTORY_FILE=/tmp/tls.jsonl COOLDOWN_MS=3000 TRUST_PROXY=1 node server.mjs
```
| 环境变量 | 默认值 | 源码位置 | 说明 |
|---|---|---|---|
| `PORT` | `8787` | `server.mjs:20` | 监听端口（`0`=随机，平台常注入） |
| `HOST` | `0.0.0.0` | `server.mjs:21` | 监听地址 |
| `HISTORY_FILE` | `<项目目录>/history.jsonl` | `server.mjs:22` | JSONL 追加日志路径，**生产必须指向持久卷** |
| `COOLDOWN_MS` | `10000` | `server.mjs:23` | 每 IP 提交冷却毫秒 |
| `TRUST_PROXY` | 关（需 `=1` 开） | `server.mjs:24` | 设 `1` 时取 `X-Forwarded-For` 首跳为限流 IP，**任何反代平台必设** |

### 2.4 构建步骤

**本项目不涉及**：没有构建脚本，没有打包产物。`server.mjs` 直接跑，三个前端文件直接由后端静态服务（白名单见 `server.mjs:121-126`）。无需 `node build.js`、无 webpack/vite。

### 2.5 小游戏导入

**本项目不涉及**：这是网页应用，不是微信/抖音小游戏。

### 2.6 运行自带测试（需 Playwright）

测试用 Playwright 驱动 Chromium 跑端到端。**从仓库根运行**（测试文件内用 `path.resolve` 定位，工作目录建议仓库根）：

先装 Playwright（仓库根 `package.json` 已声明 `playwright ^1.61.1`）：
```bash
cd /path/to/claude-test        # 仓库根
npm install
```
再装浏览器二进制。本仓库环境的 Chromium 预置在 `/opt/pw-browsers/chromium`（测试里 `executablePath` 硬编码指向它，见 `smoke.mjs:79`）。**普通机器**上该路径不存在，需先装：
```bash
npx playwright install chromium
```
> 若你在普通机器上跑，`smoke.mjs:79` 的 `executablePath: '/opt/pw-browsers/chromium'` 会找不到文件而失败。两种解法：(a) 用系统包让该路径存在；(b) 临时把这行改成 `chromium.launch()`（去掉 `executablePath`，让 Playwright 用自己装的浏览器）。生产上线不依赖测试，改动仅为本地自验，别提交。

跑冒烟测试（44 项断言）：
```bash
node projects/the-last-sentence/test/smoke.mjs
```
期望结尾：
```
结果: 44 pass / 0 fail
```
它会启一个随机端口的临时 server（用临时 `history.jsonl`）、开桌面+手机两个 context，验证：语法检查、双端实时覆盖广播、毫秒计时格式、10s/IP 限流（前端倒计时 + 后端 429）、XSS 以纯文本呈现、脏词过滤、重启恢复墓地、file:// demo 零 console error、分享文案复制，并写出 `test/screenshots/desktop.png`、`mobile.png`、`demo-file.png`。

跑对抗性 QA 测试：
```bash
node projects/the-last-sentence/test/qa-extra.mjs
```
它额外覆盖：并发竞态串行化、恶意负载（121/120 字符、纯空白、零宽/RLO 双向控制符、emoji/中文/RTL、UTF-8 多字节分块边界）、SSE 断线重连、单 IP 洪水（1×200 + 9×429）、`history.jsonl` 损坏行恢复、计时精度、375px 无横向滚动，并另存 5 张 `qa-*.png`。期望同样全绿（`ALL GREEN` 语义即 `0 fail`）。

---

## 3. 上线前必改（精确到文件 + 常量/行）

下面每一处都用了从源码读到的真实常量名与现值。把 `thelastsentence.example` 换成你买的正式域名（下文示例用 `thelastsentence.com`，按需替换）。

| # | 文件 | 位置（常量/行/选择器） | 现值 | 改成 |
|---|---|---|---|---|
| 1 | `app.js` | 第 28 行 `SITE_URL` 兜底 | `const SITE_URL = HTTP ? location.origin : 'https://thelastsentence.example';` | 把 `thelastsentence.example` 换成 `thelastsentence.com`。（HTTP/HTTPS 访问时用 `location.origin` 自动取真实域名；这个兜底只在 `file://` 下生效，即别人保存整页离线打开时，复制的分享文案里带的链接。） |
| 2 | `index.html` | 第 9 行 `og:description` | `content="Right now, exactly one sentence is alive. Overwrite it."` | 可保留；如需带域名可自行调整（非必须） |
| 3 | `index.html` | `<head>` 内（当前**缺失**，需新增） | 无 `og:url` | 新增 `<meta property="og:url" content="https://thelastsentence.com/">` |
| 4 | `index.html` | `<head>` 内（当前**缺失**，需新增） | 无 `og:image` | 新增 `<meta property="og:image" content="https://thelastsentence.com/og.png">`（并把一张 1200×630 的 OG 卡图 `og.png` 放到能被服务的位置，见下方注意） |
| 5 | `index.html` | `<head>` 内（当前**缺失**，需新增） | 无 `<link rel="canonical">` | 新增 `<link rel="canonical" href="https://thelastsentence.com/">` |

> **重要事实核对**：现有 `index.html`（第 8–10 行）只有 `og:title` / `og:description` / `og:type` 三个 OG 标签，**没有** `og:url`、`og:image`，也没有 canonical。所以第 3/4/5 项是"新增"而非"替换"。图标是内嵌 SVG data URI（第 11 行），无需外部图片。

> **OG 图片与 CSP 的坑**：`server.mjs:213-214` 给静态页设了严格 CSP：`img-src 'self' data:`。若 `og.png` 由**本站**服务（同源），CSP 没问题；但社交平台抓 OG 图是服务端抓取，不受浏览器 CSP 限制，所以无论放哪都能抓。若你想让 `og.png` 由后端提供，需要在 `server.mjs:121` 的 `STATIC` 白名单里加一条（例如 `'/og.png': ['og.png', 'image/png']`）——当前白名单只有 `/`、`/index.html`、`/style.css`、`/app.js`。最省事的做法：把 OG 图托管在 CDN/图床，`og:image` 直接填那个绝对 URL。

**改完如何验证**：
- 第 1 项：`file://` 打开 `index.html`，复制任意墓碑，粘贴看链接是否是新域名。
- 第 3/4/5 项：`node server.mjs` 后 `curl -s http://127.0.0.1:8787/ | grep -E 'og:url|og:image|canonical'` 应看到新标签；上线后用第 7 章的 OG 调试器验证卡图。

**环境变量（部署平台设，不改源码）**——上线时在平台上设：`HISTORY_FILE=/data/history.jsonl`（持久卷）、`TRUST_PROXY=1`（在反代后必设，否则 `server.mjs:97-103` 的 `clientIp` 取到的是代理 IP，全站共用一个冷却桶）。`PORT` 一般由平台注入。

---

## 4. 部署（后端主链路，≥2 方案，主推 Fly.io）

本项目是含后端的全栈应用，**用后端方案取代静态方案**。核心不变量（所有方案通用）：
- **只跑 1 个实例**（内存态，多实例分裂世界）。
- **持久卷**挂到 `HISTORY_FILE` 指向的路径（否则每次重启墓地清零）。
- **`TRUST_PROXY=1`**（在任何反向代理后）。
- **auto_stop 必须 off**：SSE 是长连接、计时器要连续，机器一睡全断。
- **SSE 需关代理缓冲**（`proxy_buffering off` / 平台默认透传），否则事件被缓冲、覆盖不实时。

### 4.1 方案 A：Fly.io（主推，免费额度可跑）

单机 `shared-cpu-1x` + 1GB 卷即可。需要在**项目目录**新建两个文件。

**文件 1：`Dockerfile`**（放在 `projects/the-last-sentence/Dockerfile`）
```dockerfile
# Dockerfile — 零依赖，直接拷源码跑 node
FROM node:22-alpine
WORKDIR /app
# 只拷生产需要的四个文件（history.jsonl 在挂载卷 /data 上，不进镜像）
COPY server.mjs index.html style.css app.js ./
ENV PORT=8787
EXPOSE 8787
CMD ["node", "server.mjs"]
```

**文件 2：`fly.toml`**（放在 `projects/the-last-sentence/fly.toml`）
```toml
# fly.toml
app = "the-last-sentence"          # 换成你自己的全局唯一应用名
primary_region = "iad"             # 就近选：iad=美东 / lhr=伦敦 / nrt=东京 / hkg=香港

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8787"
  HOST = "0.0.0.0"
  TRUST_PROXY = "1"                # 在 Fly 代理后必须，否则全站共用一个冷却桶
  HISTORY_FILE = "/data/history.jsonl"   # 指向持久卷
  COOLDOWN_MS = "10000"

[mounts]
  source = "tls_data"              # 卷名，与下面 fly volumes create 一致
  destination = "/data"            # 挂到 /data，history.jsonl 落在这里

[http_service]
  internal_port = 8787
  force_https = true               # 自动 HTTP→HTTPS 跳转
  auto_stop_machines = "off"       # 世界不能睡：SSE 长连接 + 计时连续，绝不能自动停机
  auto_start_machines = true
  min_machines_running = 1         # 至少一台常驻

  [http_service.concurrency]
    type = "connections"
    hard_limit = 2000              # SSE 是长连接，放宽并发上限
    soft_limit = 1500

[[http_service.checks]]
  interval = "30s"
  timeout = "5s"
  grace_period = "10s"
  method = "GET"
  path = "/"
```
> Fly 默认不缓冲 HTTP 响应，SSE 可正常穿透——无需额外关缓冲配置。关键是 `auto_stop_machines = "off"` 与单实例。

**逐条命令**（在项目目录 `projects/the-last-sentence/` 下）：
```bash
# 1) 装 flyctl（三平台）
#    macOS/Linux:
curl -L https://fly.io/install.sh | sh
#    Windows (PowerShell):
#    pwsh -c "iwr https://fly.io/install.sh -useb | iex"

# 2) 登录（浏览器授权）
fly auth login

# 3) 创建 app（用当前目录的 fly.toml，不要让它覆盖你的配置）
fly launch --no-deploy --copy-config --name the-last-sentence --region iad

# 4) 创建 1GB 持久卷，卷名/区域要与 fly.toml 一致
fly volumes create tls_data --size 1 --region iad --yes

# 5) 部署
fly deploy

# 6) 强制单实例（最重要的一步，防止 Fly 起第二台）
fly scale count 1
```

**验证**：
```bash
fly open                                    # 浏览器打开线上地址
fly ssh console -C "tail -n 3 /data/history.jsonl"   # 看到追加的句子
fly apps restart the-last-sentence          # 重启一次
# 重启后再打开页面：#N 序号与墓地应原样恢复（持久卷生效）
fly logs                                     # 看运行日志
```
期望 `fly ssh console -C "cat /data/history.jsonl | wc -l"` 的行数 = 历史总句数（含创世句）。

### 4.2 方案 B：Railway（免 Dockerfile，约 $5/月内）

Railway 能直接识别 Node 项目，但本项目目录无 `package.json`，需补一个最小文件让平台知道启动命令。

**文件：`package.json`**（放在 `projects/the-last-sentence/package.json`）
```json
{
  "name": "the-last-sentence",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=18" },
  "scripts": {
    "start": "node server.mjs"
  }
}
```
> 这个文件不引入任何依赖，只声明 `start` 脚本和 Node 版本。加它是为了让 Railway/其它 PaaS 用 `npm start` 起服。加完记得重跑一次 `node projects/the-last-sentence/test/smoke.mjs` 确认没影响（应仍 44 pass）。

**逐步**：
1. 装 CLI 并登录：`npm i -g @railway/cli` → `railway login`。
2. 在项目目录 `railway init`（新建项目），或网页 New Project → Deploy from GitHub repo。
3. 若从 monorepo 部署：Settings → **Root Directory** 填 `projects/the-last-sentence`，让它只构建这个子目录。
4. Settings → Deploy → **Start Command** 填 `node server.mjs`（有了上面的 `package.json` 也可留空用默认 `npm start`）。
5. Settings → **Volumes** → New Volume，Mount path 填 `/data`。
6. Variables 加：`HISTORY_FILE=/data/history.jsonl`、`TRUST_PROXY=1`、`COOLDOWN_MS=10000`。（`PORT` 由 Railway 自动注入，`server.mjs:20` 会读取。）
7. Settings → **Replicas = 1**（绝不开水平扩容/自动扩缩）。
8. Settings → Networking → **Generate Domain**，得到 `*.up.railway.app`。
9. 部署：`railway up`（或 push 触发）。

**验证**：网页打开生成的域名进 live 模式；在 Railway 里 Restart 服务，墓地与总数应无损（卷生效）；两台不同网络的设备互相实时可见覆盖（SSE 穿透）。

### 4.3 方案 C：自建 VPS（systemd + Nginx 反代 + certbot）

适合已有一台 Linux 云主机（Ubuntu/Debian）。

**步骤 1：装 Node、拉代码、建数据目录**
```bash
# 装 Node LTS（NodeSource）
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx
# 拉代码
sudo mkdir -p /opt/tls && sudo chown $USER /opt/tls
git clone --filter=blob:none --sparse https://github.com/ERICYOOOOOO/claude-test.git /tmp/tls-src
cd /tmp/tls-src && git sparse-checkout set projects/the-last-sentence
cp -r /tmp/tls-src/projects/the-last-sentence/* /opt/tls/
# 数据目录（持久卷）
sudo mkdir -p /var/lib/tls && sudo chown $USER /var/lib/tls
```

**文件：systemd unit**（放在 `/etc/systemd/system/the-last-sentence.service`）
```ini
[Unit]
Description=The Last Sentence
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/tls
ExecStart=/usr/bin/node /opt/tls/server.mjs
Restart=always
RestartSec=2
Environment=PORT=8787
Environment=HOST=127.0.0.1
Environment=TRUST_PROXY=1
Environment=HISTORY_FILE=/var/lib/tls/history.jsonl
Environment=COOLDOWN_MS=10000
# 让 www-data 能写数据目录
ReadWritePaths=/var/lib/tls

[Install]
WantedBy=multi-user.target
```
启用：
```bash
sudo chown -R www-data:www-data /var/lib/tls
sudo systemctl daemon-reload
sudo systemctl enable --now the-last-sentence
sudo systemctl status the-last-sentence      # 期望 active (running)
curl -s http://127.0.0.1:8787/ | head -c 80  # 期望 HTML 开头
```

**文件：Nginx server 块**（放在 `/etc/nginx/sites-available/the-last-sentence`，然后 `ln -s` 到 `sites-enabled/`）
```nginx
server {
    listen 80;
    server_name thelastsentence.com www.thelastsentence.com;

    # 普通静态/接口
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # TRUST_PROXY=1 时后端取 X-Forwarded-For 首跳做限流 IP，必须透传真实客户端 IP
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSE 长连接：关缓冲 + 长超时，否则覆盖事件被缓冲、连接被掐断
    location /events {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Connection '';           # 保持长连接
        proxy_buffering off;                      # 关键：不缓冲，事件即时下发
        proxy_cache off;
        proxy_read_timeout 3600s;                 # SSE 可长时间无字节（心跳 25s，这里给足冗余）
        chunked_transfer_encoding on;
    }
}
```
启用并签证书：
```bash
sudo ln -s /etc/nginx/sites-available/the-last-sentence /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
# certbot 自动签发 + 配置 HTTPS + 自动续期
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d thelastsentence.com -d www.thelastsentence.com
```
certbot 会自动改写 server 块加 443/证书路径并设置续期定时器。验证：`curl -I https://thelastsentence.com/` 看到 `X-App: last-sentence` 头即后端在线。

**每日备份 `history.jsonl`（cron）**——这是产品的全部数据，务必备份。
**文件：备份脚本**（放在 `/opt/tls/backup.sh`，`chmod +x`）
```bash
#!/usr/bin/env bash
set -euo pipefail
SRC=/var/lib/tls/history.jsonl
DST=/var/backups/tls
mkdir -p "$DST"
cp "$SRC" "$DST/history-$(date +%F).jsonl"
# 只保留最近 30 天
find "$DST" -name 'history-*.jsonl' -mtime +30 -delete
```
装进 crontab（每天凌晨 3:15）：
```bash
sudo crontab -e
# 追加一行：
15 3 * * * /opt/tls/backup.sh >> /var/log/tls-backup.log 2>&1
```
> Fly/Railway 上等价备份：Fly 用 `fly ssh sftp get /data/history.jsonl ./backup/history-$(date +%F).jsonl` 放进本地 cron；Railway 用平台的卷快照或定期 `railway run cat /data/history.jsonl > backup.jsonl`。

### 4.4 方案 D：纯前端 demo 当预告页 / 降级页（零成本，过渡用）

后端还没就绪、或想先攒关注时，把 `index.html + style.css + app.js` 三个文件扔到任意静态托管，前端探测不到 `X-App: last-sentence` 头会在 **3.5 秒**（`app.js:356-364`）内自动进 offline demo：横幅注明 offline demo、12 条预置墓碑、本地可自娱覆盖。

命令行直传（以 Cloudflare Pages / Wrangler 为例）：
```bash
npm i -g wrangler
wrangler login
# 只传三个前端文件所在目录；在项目目录里执行，把它们放进一个干净子目录再传更保险
mkdir -p /tmp/tls-static && cp index.html style.css app.js /tmp/tls-static/
wrangler pages deploy /tmp/tls-static --project-name=the-last-sentence-demo
```
或 Netlify Drop：浏览器打开 https://app.netlify.com/drop 把这三个文件拖进去即得一个 `*.netlify.app` 地址。

**用途**：
- 上线前 24–72h 挂预告页攒关注（配合 `MARKETING.md` 的 D1 推文"the real one opens tomorrow"）。
- 正式后端就绪后，把同一自定义域名的 DNS 切到 Fly/Railway，前端文件一字不改（同一套代码自动从 demo 变 live）。
- 长期降级页：后端故障时把 DNS 切回静态托管，产品退化为 demo 而非白屏。

### 4.5 GitHub Pages（仅 demo 预告页，不能跑后端）

GitHub Pages 只托管静态文件，**无法**跑 `server.mjs`，因此只能承载 4.4 的 demo 预告页。若你想用它挂预告页，用下面的 workflow 从 monorepo 子目录里挑出三个前端文件发布。

**文件：`.github/workflows/deploy-demo.yml`**（放在**仓库根**的 `.github/workflows/deploy-demo.yml`）
```yaml
name: Deploy TLS demo to Pages
on:
  push:
    branches: [ main ]
    paths:
      - 'projects/the-last-sentence/index.html'
      - 'projects/the-last-sentence/style.css'
      - 'projects/the-last-sentence/app.js'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - name: Collect static files
        run: |
          mkdir -p _site
          cp projects/the-last-sentence/index.html _site/
          cp projects/the-last-sentence/style.css _site/
          cp projects/the-last-sentence/app.js _site/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
      - id: deploy
        uses: actions/deploy-pages@v4
```
仓库 Settings → Pages → Source 选 "GitHub Actions"。发布后地址为 `https://ERICYOOOOOO.github.io/claude-test/`。注意子目录相对路径：本项目 `index.html` 引用的是相对路径 `style.css` / `app.js`，在 `.../claude-test/` 子路径下也能正确解析（因为 workflow 把三文件放到了站点根 `_site/`，发布后它们在同一层）。

---

## 5. 自定义域名 + DNS + HTTPS

### 5.1 买域名

在 Cloudflare Registrar（无溢价、含隐私保护）/ Namecheap / 阿里云万网等注册商买一个域名，例如 `thelastsentence.com`。买完把域名的 DNS 托管交给你打算用的服务商（用 Cloudflare 管 DNS 最灵活）。

### 5.2 各平台绑定域名

**Fly.io**（主推）：
```bash
fly certs add thelastsentence.com
fly certs add www.thelastsentence.com
fly certs show thelastsentence.com     # 看它要求的 DNS 记录与签发状态
```
Fly 会给你一个 IPv4（`fly ips list` 里的 `v4`）和 IPv6。按下表配 DNS。证书由 Fly 自动签发（Let's Encrypt），几分钟内 `Status: Ready`。

**Railway**：Settings → Networking → Custom Domain 填 `thelastsentence.com`，它会给你一个 `CNAME` 目标（形如 `xxxx.up.railway.app`），照它填。

**自建 VPS**：DNS 直接指向你的服务器公网 IP（A 记录），HTTPS 由 5.1 的 certbot 签。

### 5.3 DNS 记录表（给真实值）

| 平台 | 类型 | 主机名 | 值 | 说明 |
|---|---|---|---|---|
| **Fly.io** 根域 | A | `@` | `fly ips list` 里的 IPv4 | Fly 分配的 Anycast IP |
| **Fly.io** 根域 | AAAA | `@` | `fly ips list` 里的 IPv6 | 同上（IPv6） |
| **Fly.io** www | CNAME | `www` | `<你的app>.fly.dev` | 指向 Fly 默认域 |
| **Railway** 根域 | CNAME/ALIAS | `@` | `<项目>.up.railway.app` | 根域需用支持 CNAME flattening 的 DNS（如 Cloudflare） |
| **Railway** www | CNAME | `www` | `<项目>.up.railway.app` | Railway 控制台给的目标 |
| **自建 VPS** 根域 | A | `@` | 你的服务器公网 IPv4 | 直连 |
| **自建 VPS** www | A / CNAME | `www` | 服务器 IP 或 `@` | 直连 |
| **GitHub Pages**（仅 demo）根域 | A | `@` | `185.199.108.153` `185.199.109.153` `185.199.110.153` `185.199.111.153` | 四条 A 记录 |
| **GitHub Pages**（仅 demo）www | CNAME | `www` | `ERICYOOOOOO.github.io` | 指向你的 pages 域 |
| **Cloudflare Pages**（仅 demo） | CNAME | `@`/`www` | `<项目>.pages.dev` | Cloudflare 自动配 |

> 用 Cloudflare 管 DNS 时，指向 Fly/Railway 的记录建议先用**灰云**（DNS only，不代理），确认证书签好、SSE 通了，再决定是否开橙云。开橙云（Cloudflare 代理）时务必确认 SSE 不被缓冲——Cloudflare 默认对 `text/event-stream` 不缓冲，但保险起见给 `/events` 建一条 Cache Rule "Bypass cache"。

### 5.4 HTTPS 自动签发

- Fly：`force_https = true`（fly.toml 已配）+ `fly certs add` 自动签，无需手动。
- Railway：自定义域绑定后自动签发。
- 自建 VPS：certbot（见 4.3）自动签 + 自动续期。

产品本身不涉及国内小游戏/内嵌浏览器，但若要在微信/QQ 内嵌浏览器里分享，域名必须是 HTTPS（现代内嵌浏览器对 `http://` 会拦或降权）——上面各方案默认都是 HTTPS，满足。

---

## 6. 缓存策略

本项目的 HTML/CSS/JS 由后端 `server.mjs` 直接服务，静态响应已在 `server.mjs:208-215` 设了 `Cache-Control: no-cache`。这对**当前架构是对的**：句子内容每时每刻在变，页面骨架也要能即时更新。但资产层（CSS/JS）目前**没有文件名指纹**（引用的是固定的 `style.css` / `app.js`），所以**绝不能**设超长缓存，否则用户会卡在旧版。

**目标响应头**：
- HTML（`/`、`/index.html`）：`no-cache`（每次回源校验）——`server.mjs` 已是此值。
- CSS/JS（`/style.css`、`/app.js`）：最多 `max-age=3600`（1 小时），因为没做指纹。若将来想上长缓存，需先把引用改成带版本的文件名（如 `app.v2.js`）再设 `max-age=31536000, immutable`。
- SSE（`/events`）：`no-cache, no-transform`——`server.mjs:194` 已设，别加任何缓存。
- 图片/OG（如自建 `og.png`）：`max-age=86400`（1 天）。

**若要在后端微调资产缓存**：把 `server.mjs:211` 的 `'Cache-Control': 'no-cache'` 按路径区分。参考改法（示意，改完重跑 smoke 测试）——对 `.css/.js` 返回 `max-age=3600`，对 HTML 保持 `no-cache`：
```js
// server.mjs handleStatic 内，替换固定的 'Cache-Control': 'no-cache'
const cache = file.endsWith('.html') ? 'no-cache' : 'public, max-age=3600';
// ...writeHead 里用 'Cache-Control': cache
```

**若在前面套了 CDN/静态托管（如 4.4 的 demo）**，用下面的配置文件控制头。

**文件：`_headers`（Cloudflare Pages / Netlify）**（放在被发布的**站点根**，即和 `index.html` 同级）
```
/*
  X-Content-Type-Options: nosniff

/index.html
  Cache-Control: no-cache, must-revalidate

/style.css
  Cache-Control: public, max-age=3600

/app.js
  Cache-Control: public, max-age=3600
```

**文件：`vercel.json`（Vercel headers 段）**（放在被发布的**站点根**）
```json
{
  "headers": [
    {
      "source": "/index.html",
      "headers": [{ "key": "Cache-Control", "value": "no-cache, must-revalidate" }]
    },
    {
      "source": "/(.*)\\.(css|js)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=3600" }]
    }
  ]
}
```

**Nginx location 段（自建反代加缓存头）**——插进 4.3 的 server 块：
```nginx
location = /index.html {
    proxy_pass http://127.0.0.1:8787;
    add_header Cache-Control "no-cache, must-revalidate" always;
}
location ~* \.(css|js)$ {
    proxy_pass http://127.0.0.1:8787;
    add_header Cache-Control "public, max-age=3600" always;
}
```

---

## 7. SEO 上线

这是个体验型产品而非内容站，SEO 给最小集即可，重点是**社交卡片（OG）**能出图——传播全靠"截图/转发链接"。

**robots.txt**：本项目**未内置**，建议加一份允许全量抓取。若走后端服务，需在 `server.mjs:121` 的 `STATIC` 白名单加 `'/robots.txt': ['robots.txt', 'text/plain; charset=utf-8']` 并放文件；若走 CDN/静态托管直接放站点根。
**文件：`robots.txt`**（站点根）
```
User-agent: *
Allow: /

Sitemap: https://thelastsentence.com/sitemap.xml
```

**sitemap.xml**：单页应用，一条即可。
**文件：`sitemap.xml`**（站点根，同样需要在后端加白名单或放 CDN 根）
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://thelastsentence.com/</loc>
    <changefreq>always</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```
验证：上线后 `curl -I https://thelastsentence.com/robots.txt` 与 `/sitemap.xml` 都应 200。

**Google Search Console**：
1. https://search.google.com/search-console 添加资源（选 "网域"，DNS TXT 验证；或 "网址前缀"）。
2. 按提示加一条 TXT 记录到 DNS，回到 GSC 点验证。
3. 左侧 Sitemap → 提交 `https://thelastsentence.com/sitemap.xml`。

**Bing Webmaster Tools**：https://www.bing.com/webmasters → Import from Google Search Console，一键导入，免重复验证。

**OG 卡图调试**（最重要，确认第 3 章新增的 `og:image` 出图）：
- Facebook Sharing Debugger：https://developers.facebook.com/tools/debug/ 输入域名，点 "Scrape Again" 刷新缓存。
- X/Twitter：把链接发一条草稿看预览（Card Validator 已下线，直接发帖预览）。
- Telegram：把链接发给 @WebpageBot 看它回的卡片。
> OG 卡不刷新是最常见的坑——各平台都缓存抓取结果，改完 `og:image` 后必须在对应调试器里强制重新抓取。

---

## 8. 变现挂点激活

前端已预留广告位：`index.html:72-74` 的 `<aside class="ad-slot">`，默认是一句自推广文案，注释（`index.html:69-71`）也写明了如何换 AdSense。

**Google AdSense 接入**：
1. 申请门槛：站点需有实质内容与一定自然流量，接入 AdSense 代码后提交审核（审核期数天到数周）。本产品页面内容极简，AdSense 对"内容单薄"较敏感，建议先攒流量、或考虑更适合工具/实验类站点的替代（如 Carbon Ads、赞助位、或直接不放广告靠周边/打赏）。
2. **文件：`ads.txt`**（放站点根，声明授权卖你广告位的商家，`pub-xxxx` 换成你的 AdSense 发布商 ID）：
```
google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0
```
   走后端服务时同样需要在 `server.mjs:121` 加 `'/ads.txt': ['ads.txt', 'text/plain; charset=utf-8']` 白名单；走 CDN 直接放根。
3. **换广告单元**：把 `index.html:72-74` 的
```html
<aside class="ad-slot">
  <p>this page holds one sentence at a time. everything else is a grave.</p>
</aside>
```
   替换成 AdSense 给的 `<ins class="adsbygoogle">` 单元 + loader `<script>`。**关键坑（CSP）**：`server.mjs:213-214` 的 CSP 是 `script-src 'self'; connect-src 'self'`，会**拦掉** AdSense 的外部脚本。必须同步放宽 CSP，例如把 `script-src` 加上 `https://pagead2.googlesyndication.com` 等 Google 域，`connect-src`、`img-src`、`frame-src` 同理。改完在浏览器控制台确认无 CSP 报错、广告能加载。因为页面骨架由后端统一下发，**改这一处 = 全站生效**（只有一个页面）。

**联盟/周边**：见 `MARKETING.md`——本产品定位是"截图值得发"的实验，官方立场是不买量、正式场合不占当前句。变现优先级低于口碑，谨慎放广告以免破坏纪念碑美学。

**小游戏流量主/激励视频**：本项目不涉及（非小游戏）。

---

## 9. 上线后自检清单

- [ ] 真机过一遍：iOS Safari + Android Chrome，375px 宽无横向滚动、输入框不被键盘遮挡、触控目标 ≥44px。
- [ ] `https://` 与 `https://www.` 都能开、自动跳 HTTPS。
- [ ] `curl -I https://你的域名/` 能看到 `X-App: last-sentence`（确认打到的是真后端而非静态降级）。
- [ ] OG 卡：在 Facebook Debugger / Telegram @WebpageBot 里能看到标题+图。
- [ ] 跨时区/跨午夜：换一台不同时区设备看同一句、同一计时（计时用服务器时钟，`app.js:344` 的 `clockOffset`，跨端一致）。
- [ ] Lighthouse 移动端 Performance ≥ 95（Chrome DevTools → Lighthouse）。
- [ ] **两台不同网络的设备实时互见**：A 提交，B 端 SSE 应立刻看到覆盖（证明平台代理没缓冲 SSE）。
- [ ] **同出口 IP 限流 429**：同一 Wi-Fi 下第二次快速提交应被拒（`TRUST_PROXY=1` 生效；同出口 IP 共享冷却属正常）。
- [ ] **平台重启后墓地/编号连续**：Restart 一次，`#N` 与墓地原样恢复（持久卷生效）。
- [ ] 脏词（如含 `fuck`）→ 显示为 `▓▓`；XSS 串（`<img src=x onerror=...>`）→ 以纯文本呈现无弹窗；纯空白 → 被拒；121 字符 → 被拒。
- [ ] `app.js:28` 的 `SITE_URL` 兜底与新增的 OG 标签已是正式域名。
- [ ] 每日 `history.jsonl` 备份 cron 已生效（`ls` 备份目录看到当天文件）。

---

## 10. 持续更新与运维

**改前端/后端 → 重新部署的流程**：
1. 在项目目录改代码（无构建步骤）。
2. 从仓库根跑测试：`node projects/the-last-sentence/test/smoke.mjs`（期望 44 pass）+ `node projects/the-last-sentence/test/qa-extra.mjs`（期望全绿）。
3. 部署：Fly `fly deploy`；Railway `railway up` 或 push；VPS `git pull && sudo systemctl restart the-last-sentence`。
4. 部署后立即 `curl -I https://你的域名/` 确认 `X-App` 头在、页面 live。

**备份**：每日 cron 拷 `history.jsonl`（4.3 给了脚本；Fly/Railway 等价命令见 4.3 末尾）。这是产品的**全部数据**。

**日志/监控**：Fly `fly logs`；Railway 控制台 Logs；VPS `journalctl -u the-last-sentence -f`。给主页配一个外部 uptime 监控（如 UptimeRobot 每分钟打 `/`），机器一旦停（SSE 全断）立刻报警——因为 `auto_stop=off`，正常不该停。

**回滚**：Fly `fly releases` 看历史、`fly deploy --image <旧版镜像>` 或 `fly releases rollback`；Railway 控制台 Deployments 点旧版 Redeploy；VPS `git checkout <旧commit> && systemctl restart`。数据（`history.jsonl`）与代码解耦，回滚代码不影响墓地。

**紧急内容下架**（`PLAYBOOK.md` 的 10 分钟 SLA）：停服 → 编辑 `history.jsonl` 对应行的 `text` 改为 `[removed]` → 重启（序号与毫秒时长完整保留）。Fly：`fly ssh console` 进容器编辑 `/data/history.jsonl` 后 `fly apps restart`。

**数据增长**：`history.jsonl` 约 150B/句，一百万句 ≈ 150MB，短期无虞（`PLAYBOOK.md` 第八节）。V2 才需按月分卷。

---

## 11. 故障排查表

| 症状 | 可能原因 | 解决 |
|---|---|---|
| 页面一直显示 `offline demo` 横幅 | 前端探测不到 `X-App: last-sentence`（打到的是静态托管，或后端没起/被 CDN 挡） | `curl -I https://域名/` 看有无 `X-App` 头；确认 DNS 指向后端而非静态托管；确认 `server.mjs` 在跑 |
| 覆盖不实时、要刷新才更新 | SSE 被反向代理/CDN 缓冲 | Nginx `/events` 加 `proxy_buffering off`（见 4.3）；Cloudflare 给 `/events` 设 Bypass cache；Fly 无需额外配置 |
| 提交总是很快 429，或所有人共享一个冷却 | `TRUST_PROXY` 未设 1，后端把代理 IP 当成所有人的 IP（`server.mjs:97-103`） | 平台设 `TRUST_PROXY=1`，并确保反代透传 `X-Forwarded-For`（Nginx 的 `proxy_add_x_forwarded_for`） |
| 重启后墓地清零、序号从 #1 重来 | `HISTORY_FILE` 没指向持久卷，写在了临时容器盘上 | 设 `HISTORY_FILE=/data/history.jsonl` 且 `/data` 是挂载的持久卷（Fly `[mounts]` / Railway Volume） |
| 隔一阵 SSE 断、计时器卡住 | 机器被自动停机（auto_stop） | Fly `auto_stop_machines = "off"` + `fly scale count 1`；Railway Replicas=1 且别设休眠 |
| 出现两个互不相通的"世界"、序号打架 | 跑了多实例（内存态被分裂） | 强制单实例：`fly scale count 1` / Railway Replicas=1 |
| `file://` 打开时某些功能怪（如剪贴板） | `file://` 无后端、部分浏览器 API 受限，只在 demo 模式 | 属预期；真功能需 `http(s)://` 下访问真后端 |
| CSS/JS 改了线上不更新 | 资产无文件名指纹 + 被超长缓存 | 保持 CSS/JS `max-age ≤ 3600`（第 6 章）；要长缓存先改引用为 `app.v2.js` 之类 |
| OG 卡改了不刷新 | 社交平台缓存了旧抓取 | 在 Facebook Debugger / Telegram @WebpageBot 强制重新抓取（第 7 章） |
| 接了 AdSense 但广告不显示、控制台报 CSP 错 | `server.mjs:213-214` 的 CSP 拦了外部脚本 | 放宽 CSP 的 `script-src`/`connect-src`/`img-src`/`frame-src` 加 Google 域（第 8 章） |
| GitHub Pages 子目录下 CSS/JS 404 | 相对路径在子路径下解析错 | workflow 已把三文件放到站点根 `_site/`（第 4.5），确保它们同级；别改成绝对路径 `/style.css` |
| 部署到 Railway 报缺 package.json / 不知道怎么启动 | 目录无 `package.json` | 加 4.2 的最小 `package.json`（含 `"start": "node server.mjs"`） |
| 跨午夜/跨时区计时不一致 | 误用了客户端本地时间 | 本项目已用服务器时钟（`now` + `clockOffset`，`app.js:344`）；若自改代码勿改回 `Date.now()` 直用 |

---

_本文档基于源码实测撰写：后端 `server.mjs`（零依赖，Node ≥18，默认端口 8787，env: PORT/HOST/HISTORY_FILE/COOLDOWN_MS/TRUST_PROXY），前端 `app.js`（`SITE_URL` 兜底在第 28 行）/ `index.html` / `style.css`，运行时生成 `history.jsonl`。上线三条铁律：单实例、持久卷、`TRUST_PROXY=1` + SSE 不缓冲 + auto_stop off。_
