# At Your Age — 营销与变现指南

核心资产：**一张会翻面的卡**。所有渠道的动作都指向同一件事——让人看到别人的暴击卡，忍不住输入自己的生日。

---

## 1. TikTok / Shorts / 视频号：「输入你的生日」挑战

**格式 A · 单人反应（15s，冷启动主力）**
1. 0–2s 钩子字幕：`this site just told me the meanest thing`（中文区：`这个网站骂我骂得好精确`）
2. 2–6s 录屏输入生日 → 巨型数字弹出 → ROAST 判词特写（镜头怼「12 years and 19 days」）
3. 6–9s 本人表情崩坏 / 沉默凝视
4. 9–13s 手指点向大红开关 → 180ms 翻绿 → HEAL 判词 → 表情缓和
5. 13–15s 结尾字幕：`roast or heal. link in bio.`
- 发布语：`I was doing fine until it counted the days` + #amibehindinlife #birthdaychallenge

**格式 B · 双人对测（情侣/同事/母女）**：轮流输生日，比谁的 ROAST 更狠；年长者最后翻 HEAL 反杀（"Grandma Moses says I'm 45 years early"）。冲突+反转，完播率高。

**格式 C · 街采**：路人报年龄 → 主持人现场念判词 → 拍第一反应。取材权侧写：判词全是公共事实，无版权物料。

拍摄要点：判词文字必须占满屏、逐字可读；翻转瞬间必须入镜（它是记忆点）；结尾永远给站名。

## 2. X / 小红书帖子模板

**X（英文）**
```
this website calculated my age to the day and then said:

"{ROAST 判词原文}"

there's a heal mode. I am not ready for the heal mode.
{link}
```
```
day N of asking strangers their birthday so a website can hurt them precisely — {link}
```

**小红书（中文，配 ROAST 卡 + HEAL 卡两图）**
```
标题：被一个网站精确到天地羞辱了
正文：输了个生日，它告诉我莫扎特在我这个年纪已经去世 6 年。
点了一下那个红色开关，它又说摩西奶奶还要 45 年才拿起画笔。
行吧，原谅它了。链接在评论区。
#自嘲 #年龄焦虑 #35岁 #人生进度条
```

**节点日历**：毕业季（am I behind 峰值）、高考出分、新年/跨年（"又老一岁"）、生日月征集（"评论区报生日，替你测"）。

## 3. SEO 关键词矩阵

| 层 | 词型 | 承接页 |
|---|---|---|
| 情绪词 | `am I behind in life` / `is 30 too late to start over` / `feeling behind at 25` | 首页（meta 已含 "how far behind are you, exactly"）|
| 长尾·人物×年龄 | `what did mozart do by age 25` / `what had einstein done by 30` / `famous people who succeeded after 50` | `people/<slug>.html` ×189 |
| 工具词 | `age calculator in days` / `exact age in days` / `how many days old am I` | 首页 |
| 对照词 | `late bloomers in history` / `youngest person to ever …` | `people/index.html` 名录 |

打法：Search Console 观察 impression 起量的人物 → 优先给这些页补条目和导语；每月按搜索需求补一批人物（每位人物 = 一张新 sitemap URL）。内链已闭环（首页 ↔ 人物页 ↔ 名录）。

## 4. 联盟变现（克制挂法）

场景天然对口「觉得落后 → 想学点什么」。原则：**只在 HEAL 模式的结果下方出现**（情绪出口，不在伤口上撒盐），一行文字链，不放横幅。

- 承接品类：在线课程/技能平台的 CPA（Coursera、Skillshare、Udemy、MasterClass、Codecademy 等联盟计划均按注册/订阅计费）。
- 文案与产品同声调，例如：
  `Grandma Moses started at 76. If you want to start tonight → [course platform]`（affiliate 链接 + `rel="sponsored"`，旁注 "ad"）。
- 实现：在 `index.html` 的 adslot 内按 `body[data-mode="heal"]` 显示该行（现版本留白，接入时 10 行 JS）。
- 红线：不挂理财/保健品/算命类；affiliate 一律标注；ROAST 面永远不带广告——暴击必须纯粹，才有人转发。

## 5. AdSense 激活步骤

1. 绑定正式域名并部署（AdSense 不收 file://，需真实流量域名）。
2. adsense.google.com → Sites → 添加域名，站点根注入验证 `<meta>`（放 `index.html` head）。
3. 通过审核后建 **Display ad** 单元（Responsive）。
4. 打开 `index.html` 搜 `AD SLOT` 注释，把 `<p class="adcopy">` 换成 AdSense `<ins class="adsbygoogle">` + 附带 script；保持容器 `max-height≈120px`，勿动周边留白。
5. 人物页如需广告：在 `build.js` 的 `pageShell` footer 前加同一单元（建议先只开首页，观察 CLS 与美学损伤）。
6. `ads.txt` 放站点根：`google.com, pub-XXXX, DIRECT, f08c47fec0942fa0`。
7. 预期：工具型 $1–3 RPM，AdSense 是地板不是天花板——真正的变现是流量 → 联盟/下一个付费产品。

## 6. 一句话定位（对外统一口径）

> The internet's most precise way to feel behind — and the fastest way to feel better about it.
