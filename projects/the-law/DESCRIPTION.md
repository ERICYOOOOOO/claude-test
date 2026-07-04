# 今日之律 The Law — 产品描述

## 一句话

每天全球一条隐藏法则，作用于 1–20 的数字三元组。你提交实验换取 ✓ 或 ✗，归纳出规律，再接受 8 题终审——用的实验越少，越体面。

## 它是什么

一份每天送达的保密卷宗。卷宗里有一条法则，被涂黑了。

你唯一的工具是实验：提交任意三个数（如 2 · 4 · 6），档案立刻盖章——墨绿 ✓ 合法，或印泥红 ✗ 非法。实验不限次数，但每一次都会印在你的战报上。

自认为想通了，就点「参加终审」：系统出 8 个你没见过的三元组，正例负例各半，专挑规则边界上最容易归纳错的地方。由你逐一裁定合法与否。判对 7 题以上，卷宗盖上 CRACKED；8/8，完美破解。

然后法则揭晓，你会知道自己是真想通了，还是碰巧对了。

## 为什么好玩

这是 Wason 2-4-6 实验和桌游 Zendo 的每日版。乐趣不在算，在于**归纳**：连续几个 ✗ 之后突然想通、一发命中的那个瞬间。经典陷阱是你只提交能"验证"自己假设的样本，从不提交能"证伪"它的——今日之律每天教你一次什么叫科学方法。

- **全球同题**：种子按日期生成，今天所有人破解同一条法则。
- **零剧透战报**：分享卡只有 ✓/✗ 轨迹格和实验次数，不含任何数字——敢晒，不怕剧透。
- **难度曲线**：周一最易，周六是地狱日。39 个参数化规则模板、三档难度。
- **连胜与档案**：localStorage 记录连胜；当日完成后开放往期档案练习。

## 技术形态

纯静态单页，零依赖、零后端、零外链，总重约 60KB，file:// 也能打开。规则判定器与终审出题器共用同一个纯函数，终审 8 题由当日种子确定性生成。

## English blurb

**The Law** is a daily inductive-reasoning puzzle in the lineage of Wason's 2-4-6 task and the tabletop game Zendo. Each day, one hidden rule governs number triples (a, b, c) from 1–20 — the same rule for everyone on Earth. Probe it with experiments and get an instant ✓ or ✗ stamp for each. When you think you've induced the rule, face the Final Review: 8 unseen triples, half legal, half near-miss traps, and you play judge. Score 7/8 to crack the case. Share a spoiler-free report card — just your ✓/✗ trail and experiment count. Fewer experiments, more glory. Pure static page, no backend, no tracking, works offline.
