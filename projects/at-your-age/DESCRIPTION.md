# At Your Age（同龄羞辱）— 产品描述

输入出生日期，得到精确到天的年龄（`31 years and 19 days`），然后被告知：**在你这个精确年龄，莫扎特已经死了 6 年。**

受不了？点一下那个大红开关，它 180 毫秒翻成绿色的 HEAL 面：**在你这个年纪，摩西奶奶还要再等 45 年才拿起画笔。**

这就是全部玩法——也是全部传播机制。一暴一治的情绪落差让每张卡都自带「你也去测测」的钩子。

## 它有什么

- **精确到天的年龄计算**：闰年安全、2/29 生日处理、未来/远古/不存在日期均有干燥友好的报错。
- **215 条人工核对的里程碑**（ROAST 110 / HEAL 105，189 位人物）：只收广为人知、可由公开出生与事件日期复核的事实。
- **动态文案引擎**：按你与里程碑的天数差自动选句式——比你小的人用「That's 12 years and 19 days younger than you are right now」，还没到的用「You have N years to do something comparable」，死亡条目动态计算「had been dead for …」。差值精确到年 + 天，疼得很具体。
- **ROAST/HEAL 一键翻转**：页面最显眼的控件，180ms 3D 翻面，全站强调色同拍红绿互换。
- **another one**：种子化轮换 + localStorage 去重，全库看完自动重轮。
- **分享卡**：1080×1350 canvas PNG（瑞士编辑风：白底、巨型数字、模式色带、域名脚注）+ 一键复制文本版。
- **SEO 长尾**：`build.js` 生成 189 张 `What had X done by age N?` 静态人物页 + 名录 + sitemap。
- 纯静态、零依赖、零请求、file:// 可开；生日只留在浏览器里。

## 设计

瑞士编辑/杂志内页：纯白 `#ffffff`、近黑 `#111111`、猩红 `#e0332b`、暖绿 `#2e7d4f`，系统无衬线栈，桌面端 ≥120px 的 tabular-nums 年龄数字，2px 墨线分区，大量留白。文案克制毒舌与克制温柔，全站没有一个感叹号。

## English blurb

**At Your Age** — enter your birthday, get your age to the exact day, and find out what people had already done by then. Roast mode: "By your exact age, Mozart had been dead for 6 years." Can't take it? Flip the big red switch — Heal mode: "At your age, Grandma Moses wouldn't pick up a brush for another 45 years." 215 hand-checked milestones, one merciless number, two ways to feel about it. Static, private, no sign-up; your birthday never leaves the browser.
