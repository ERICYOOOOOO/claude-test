# 全局质量基准（5 个项目共用）

本文件是 5 个入选项目的统一质量红线。任何一条不满足即视为未完成。

## 一、技术架构红线

- **纯静态、零后端**：全部逻辑跑在客户端；数据内嵌在 JS 里（不用 fetch 加载本地 JSON，保证 file:// 也能打开）。这是"不需要用户量也能盈利"的成本前提——托管费为零。
- **零外部依赖**：不引 CDN 脚本、不引 Google Fonts、不引任何框架。系统字体栈 + 手写 CSS/JS。单页总重 < 150KB（不含截图）。
- **每日种子**（每日型玩法）：`seed = Math.floor((Date.now() - tzOffset) / 86400000)`，以用户本地日期为准（与 Wordle 一致），谜题/内容由种子确定性生成，全球同一天同题。
- **localStorage 持久化**：连胜、历史、设置。必须容忍损坏数据（try/catch + 版本号 + 回退默认值）。
- **移动优先响应式**：375px 宽起可用，触控目标 ≥ 44px，禁横向滚动。桌面端优雅放大。
- **可访问性**：语义化 HTML、焦点可见、关键操作可键盘完成、prefers-reduced-motion 降级动画。

## 二、美学红线（防 AI 味）

**禁止出现**：紫蓝渐变背景、玻璃拟态卡片、默认 Tailwind 色、emoji 堆砌的文案、"Welcome to XXX!" 式开场白、居中大 hero + 三列 feature 卡的模板布局、圆角+阴影全家桶。

**必须做到**：
- 每个项目一个**独立且强烈的艺术方向**（见各项目 playbook），从配色、字阶、间距到微交互都服务于这个方向。
- 文案**克制、干燥、有性格**——像一个真人写的，一句能砍就砍。中文产品页禁用"立即体验""开启你的旅程"这类营销腔。
- 排版有真实层级：字号来自一个明确的比例阶（如 1.25 模数），间距来自 4/8px 体系。
- 动效全部指定时长与缓动（如 `cubic-bezier(0.16, 1, 0.3, 1)`，180–320ms），有目的（反馈/引导/惊喜），60fps（只动 transform/opacity）。
- 空状态、错误态、加载态都有设计，不出现浏览器默认样式的裸元素。

## 三、交互红线

- 首屏 0 说明书即可开始：玩法通过第一次交互本身教会用户。
- 每一次用户输入都有 <100ms 的即时反馈（视觉或触觉）。
- 分享卡是一等公民：一键复制（文本格式）+ 一键存图（canvas 导出 PNG），卡面信息零剧透、有炫耀点、带回流链接位。
- 结束态必须给"明天再来"或"再试一次"的明确钩子。

## 四、验证协议（每个项目必须通过）

1. `node --check` 全部 JS 文件语法通过（内联脚本抽出检查或用 new Function 方式校验）。
2. Playwright 冒烟（从仓库根运行，`chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`）：
   - file:// 打开 index.html，**零 console error**（收集 `page.on('console')` 与 `pageerror`）；
   - 桌面 1280×800 与移动 375×667 各截一张图存 `test/screenshots/`；
   - 脚本化走完核心循环（点击/输入到结束态），断言关键 DOM 出现；
   - 分享卡生成成功（断言 canvas/文本产出非空）。
3. 边界用例：本地日期跨午夜、localStorage 为垃圾值、连点/快速重复输入、375px 视口、prefers-reduced-motion。
4. 测试脚本保留在 `projects/<slug>/test/smoke.mjs`，可重复运行。

## 五、目录规范

```
projects/<slug>/
  PLAYBOOK.md      计划书 + playbook（中文）
  DESCRIPTION.md   产品描述（中文 + 一段英文 blurb）
  DEPLOY.md        部署指南
  MARKETING.md     营销宣传 + 广告指南
  index.html / style.css / app.js …（产品本体，静态可直接部署）
  test/smoke.mjs   冒烟测试
  test/screenshots/
```

## 六、变现挂点

- 页面预留 1 个**不破坏美学**的广告位（结束态/结果页下方，注释标明 AdSense 激活方法），默认渲染成极简"自推广位"。
- 工具类项目内置 SEO：语义化标题层级、meta description、OG 标签、（如适用）构建脚本生成长尾静态页。
- 分享卡底部固定域名位（品牌回流）。
