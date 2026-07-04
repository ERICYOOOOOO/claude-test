# The Last Sentence 最后一句话 — 产品描述

## 一句话

全世界共享一个文本框：你写下的句子会覆盖上一个人的，被覆盖的句子坠入墓地，墓碑上刻着它活了多少毫秒。

## 中文描述

此刻，全世界只有一句话是活着的。它巨大地悬在页面正中，下面是一个毫秒级跳动的计时器——它已经活了多久，所有人实时看着同一个数字在跳。

任何人都可以写下新的一句（120 字符以内）。提交的瞬间，旧句子被打上死亡时间戳，坠入下方无限滚动的墓地；你的句子上位，计时归零。每块墓碑只刻三样东西：句子原文、序号、存活时长——精确到毫秒。`survived 9ms` 和 `survived 3h 12m 44.108s` 同样值得截图。

没有账号，没有点赞，没有算法。只有一个问题：你的句子能活多久？

为防刷屏，每个 IP 每 10 秒只能提交一次；小词表脏词过滤 + 全量 HTML 转义。服务端是一个零依赖的 Node 单文件，状态追加写入 JSONL，重启后墓地无损恢复。断网或纯静态托管时自动进入离线 demo 模式（预置 12 条墓碑，可自娱）。

- 界面：英文。近黑纪念碑美学，衬线大字 + 等宽机器字，唯一强调色留给存活时长。
- 覆盖瞬间：旧句 400ms 下坠淡出，新句打字机浮现——每一次死亡都看得见。
- 分享：一键复制 `my sentence survived 4m 12.882s as #8,412 on the last sentence`；每块墓碑可单独复制。

## English blurb

**The Last Sentence** — the whole internet shares one text box. Right now exactly one sentence is alive, and a millisecond timer is counting how long it has survived. Write yours and it replaces whatever is there; the dead sentence falls into an endless graveyard below, its tombstone engraved with how long it lived — down to the millisecond. No accounts, no likes, no feed. One cooldown (10 seconds), one question: how long will your sentence live? Built as a single zero-dependency Node file plus three static files; works as a self-contained offline demo when there's no server at all.

## 关键数字

| 项 | 值 |
|---|---|
| 前端 | index.html + style.css + app.js，无框架无 CDN |
| 后端 | server.mjs，235 行，仅 node:http + node:fs |
| 句长上限 | 120 code points |
| 冷却 | 10s / IP（前端倒计时 + 后端 429） |
| 墓地 | 内存 + 快照保留最近 500 条；总数永久累计 |
| 持久化 | history.jsonl 追加写，重启恢复 |
| 测试 | test/smoke.mjs，44 项断言全绿 |
