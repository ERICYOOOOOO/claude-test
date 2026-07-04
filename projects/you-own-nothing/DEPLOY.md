# You Own Nothing — 部署指南

纯静态三文件（index.html / style.css / app.js），无构建步骤、无环境变量、无后端。把目录扔上任何静态托管即是上线。

## 0. 上线前自检

```bash
# 从仓库根目录
node --check projects/you-own-nothing/app.js
node projects/you-own-nothing/test/smoke.mjs   # 需要 playwright + /opt/pw-browsers/chromium
```

全部 PASS 再继续。本地验收：直接双击 index.html（file:// 协议完整可用）。

## 1. 域名

建议 `youownnothing.rent`（.rent 顶级域本身就是梗的一部分；代码中 `app.js` 顶部的 `DOMAIN` 常量与分享卡、文本版、meta 标签保持一致，换域名时全局搜索 `youownnothing.rent` 一并替换）。

## 2. 托管（三选一，均为免费档）

### Cloudflare Pages（推荐：免费无限带宽，爆款不心疼）

```bash
npx wrangler pages deploy projects/you-own-nothing --project-name you-own-nothing
```

或在 Dashboard 里直接拖拽目录。绑定自定义域名后自动 HTTPS。

### Netlify

```bash
npx netlify-cli deploy --dir projects/you-own-nothing --prod
```

### GitHub Pages

把三个文件放进仓库（或用 `gh-pages` 分支），Settings → Pages 指向目录即可。注意 test/ 目录可以不发布。

## 3. 发布物清单

必须发布：`index.html`、`style.css`、`app.js`。
不要发布：`test/`、`*.md`（或无所谓，纯文本不碍事）。

## 4. 上线后配置

- **OG 图**：截一张公寓全景（test/screenshots/desktop-apartment.png 就很好），存为 `og.png` 放在根目录，并在 index.html `<head>` 中加 `<meta property="og:image" content="https://你的域名/og.png">`。社交平台展开率会显著提升。
- **AdSense（可选）**：结算页 `.ad-slot` 处有注释说明。原则：只在结算页、只此一个位、保持小票美学不被打破。见 MARKETING.md 的广告指南——默认建议保持"自嘲位"状态。
- **统计（可选）**：如需 PV 统计，用无 Cookie 的方案（Cloudflare Web Analytics / GoatCounter 一行脚本）。本品的可信度建立在"真的不采集任何东西"上，别用重型分析。

## 5. 缓存策略

三个文件都小，直接默认即可。若手动配：HTML `no-cache`，CSS/JS 可短缓存（1 小时），因为没有指纹文件名。

## 6. 回滚

静态站无状态，回滚 = 重新部署上一版目录。用户端 localStorage 结构带版本号（`yon-state-v1`），旧数据损坏会自动回退默认值，无需迁移考虑。
