# Overlap · 重叠时光

## 一句话

给异地恋和跨时区的人算一件事：**两个人每天到底有几个小时，是同时醒着、又都有空的。**

## 产品描述（中文）

选两座城市（330 个主要城市，支持中文名和别名搜索），各自设好睡眠和忙碌时段，Overlap 把未来 24 小时铺成一条双轨灯带：琥珀色是醒着有空，暗紫是忙，近黑是睡。两条轨道上唯一发暖光的区间，就是真正属于你们的时间。

它会告诉你三件事：

1. **一个数字** —— "You overlap for 2h 47m a day."，配一句不甜腻的判语（"2 hours is enough if you both show up."）；
2. **一个名字** —— 最长的重叠窗口自动命名："the goodnight window"、"morning coffee together"、"your sunrise, their midnight"，加上到下一个窗口的秒级倒计时；
3. **一个里程表** —— "hours awake together"：页面开着、两人都有空时真实累积；填上 "we met on" 那天，把过去的共同清醒小时一并算给你。数字只增不减，像一枚攒出来的纪念章。

一键存出 1080×1350 的夜空卡片，或复制文本版发给那个人。时区换算全部走系统 IANA 数据（Intl API），夏令时、半小时区、跨日界线自动正确。纯静态单页，无账号、无后端、无跟踪，城市、作息和计数器都只存在你自己的设备里。

## English blurb

**Overlap** is a long-distance time zone overlap calculator that answers the only question that matters: how many hours a day are you *both* awake and free? Pick two cities, set each person's sleep and busy hours, and get a glowing 24-hour dual-track view of your shared windows — each one named ("the goodnight window", "morning coffee together"), with a live countdown to the next one and an odometer of hours you've spent awake together since the day you met. Real IANA time zone math, DST handled. One static page, no account, no tracking; everything stays on your device. Save the night-sky card and send it to the person it's about.

## 关键规格

- 330 城市 → IANA 时区映射，中英文名 + 别名搜索
- 未来 24h × 15 分钟采样，Intl.DateTimeFormat 真实换算，DST/日界线/半小时区正确
- 重叠分档判语 × 5，窗口命名表 × 16，秒级倒计时
- localStorage 里程表（实测累积 + "we met on" 回填），损坏数据自动回退
- Canvas 分享卡 1080×1350 PNG + 文本版一键复制
- 纯静态零依赖，file:// 可直接打开，全页 <100KB
