# The Last Sentence — 部署指南

服务端是零依赖 Node 单文件（`server.mjs`），任何能跑 Node ≥18 且能挂持久卷的平台都行。
**关键约束：只能跑 1 个实例**（状态在内存里，多实例会分裂世界）。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | 8787 | 监听端口（`0` = 随机，平台一般会注入） |
| `HOST` | 0.0.0.0 | 监听地址 |
| `HISTORY_FILE` | `./history.jsonl` | 追加日志路径，**必须指向持久卷** |
| `COOLDOWN_MS` | 10000 | 提交冷却 |
| `TRUST_PROXY` | 关 | 设为 `1` 时取 `X-Forwarded-For` 首跳作为限流 IP。**上任何反向代理平台都必须设**，否则全站共享一个冷却桶 |

本地跑：

```bash
node server.mjs
# → http://127.0.0.1:8787
```

---

## 路线 A：Fly.io（推荐，免费额度可跑）

单机 shared-cpu-1x + 1GB 卷即可。三个文件放进项目根（`Dockerfile`、`fly.toml` 内容如下，自建）：

```dockerfile
# Dockerfile
FROM node:22-alpine
WORKDIR /app
COPY server.mjs index.html style.css app.js ./
EXPOSE 8787
CMD ["node", "server.mjs"]
```

```toml
# fly.toml
app = "the-last-sentence"        # 换成你的应用名
primary_region = "iad"

[env]
  PORT = "8787"
  TRUST_PROXY = "1"
  HISTORY_FILE = "/data/history.jsonl"

[mounts]
  source = "tls_data"
  destination = "/data"

[http_service]
  internal_port = 8787
  force_https = true
  auto_stop_machines = "off"     # 世界不能睡觉：SSE 长连接 + 计时连续性
  auto_start_machines = true
  min_machines_running = 1

[[http_service.checks]]
  interval = "30s"
  timeout = "5s"
  method = "GET"
  path = "/"
```

```bash
fly launch --no-deploy            # 用上面的 fly.toml，不要让它改
fly volumes create tls_data --size 1 --region iad
fly deploy
fly scale count 1                 # 强制单实例（重要）
```

验证：`fly ssh console` → `tail /data/history.jsonl`；`fly apps restart` 后墓地应原样恢复。

注意：
- `auto_stop_machines = "off"`——机器一停，SSE 全断、"当前句已存活"叙事中断。免费额度内单台常驻可接受。
- 备份：`fly ssh sftp get /data/history.jsonl ./backup/`，建议每日 cron。

## 路线 B：Railway（免掉 Dockerfile，5 美元/月内）

1. 新建项目 → Deploy from GitHub repo（或 `railway init` + `railway up`）。
2. Railway 检测到 Node 后，把 **Start Command** 设为 `node server.mjs`（Settings → Deploy）。
   仓库无 package.json 也可：Custom Start Command 直接生效；若平台坚持要 package.json，加一个只有 `{"name":"tls","scripts":{"start":"node server.mjs"}}` 的最小文件。
3. Settings → **Volumes** → New Volume，Mount path 填 `/data`。
4. Variables：`HISTORY_FILE=/data/history.jsonl`、`TRUST_PROXY=1`（`PORT` Railway 自动注入，服务器已读取）。
5. Settings → **Replicas = 1**（勿开水平扩容）。
6. Networking → Generate Domain，得到 `*.up.railway.app`。

验证同 Fly：重启服务，墓地与总数应无损。

## 路线 C：过渡方案 —— 纯前端 demo 当预告页（零成本）

`index.html + style.css + app.js` 三个文件扔到任意静态托管（Netlify Drop / GitHub Pages / Cloudflare Pages）。
前端探测不到真后端（`/` 的 `X-App: last-sentence` 响应头缺失）会在 3.5s 内自动进入 **offline demo**：
横幅注明 offline demo、12 条预置墓碑、本地可自娱覆盖。

用法：
- 上线前 24–72h 挂预告页攒关注（配合 MARKETING.md 的 D1 推文）。
- 正式后端就绪后，把同一域名切到 Fly/Railway 即可，前端文件不变（同一套代码自动变成 live 模式）。
- 也可长期作为降级页：后端故障时把 DNS 切回静态托管，产品退化为 demo 而非白屏。

## 上线后必查

- [ ] 两个不同网络的设备互相能实时看到覆盖（SSE 正常穿透平台代理）。
- [ ] 同一 Wi-Fi 下第二次提交拿到 429（`TRUST_PROXY` 生效；若两台设备共享冷却属正常——同一出口 IP）。
- [ ] 平台重启一次，`#N` 与墓地连续。
- [ ] `app.js` 的 `SITE_URL` 兜底与 OG 标签换成正式域名。
- [ ] 每日备份 `history.jsonl`。
