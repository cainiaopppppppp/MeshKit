# Docker 部署指南

本文档适用于 MeshKit 1.1.0 的 Docker 部署。当前 Docker 化的服务包括：

- `web`: Web 前端静态站点，通过 Nginx 提供访问。
- `signaling`: WebSocket + PeerJS signaling 服务。

Desktop 是 Electron 桌面应用，不通过 Docker 运行。

## 快速启动

在仓库根目录执行：

```bash
docker compose up -d --build
```

默认访问地址：

| 服务 | 地址 |
| --- | --- |
| Web 页面 | `http://localhost:3000` |
| WebSocket signaling | `ws://localhost:7000/ws` |
| PeerJS 服务 | `http://localhost:8000/peerjs` |

查看状态和日志：

```bash
docker compose ps
docker compose logs -f
docker compose logs -f signaling
docker compose logs -f web
```

停止服务：

```bash
docker compose down
```

## Compose 服务

`docker-compose.yml` 包含两个服务。

`signaling`:

- 镜像名为 `meshkit-signaling:1.1.0`。
- 暴露 `7000` 和 `8000`。
- 提供 `/healthz` 健康检查。
- 通过环境变量控制端口和过期清理时间。

`web`:

- 镜像名为 `meshkit-web:1.1.0`。
- 暴露宿主机 `3000` 到容器 `80`。
- 依赖 `signaling` 健康后启动。
- 提供 `/healthz` 健康检查。

## 环境变量

`signaling` 支持以下环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | 服务监听地址 |
| `WS_PORT` | `7000` | WebSocket 端口 |
| `PEER_PORT` | `8000` | PeerJS 端口 |
| `DEVICE_STALE_TIME` | `45000` | 设备过期时间，毫秒 |
| `ROOM_STALE_TIME` | `3600000` | 房间过期时间，毫秒 |
| `CLEANUP_INTERVAL` | `5000` | 清理任务间隔，毫秒 |

如果宿主机端口冲突，可以只修改左侧端口映射，例如：

```yaml
ports:
  - "3001:80"
  - "7001:7000"
  - "8001:8000"
```

同时需要在前端连接配置中使用新的宿主机端口。

## 单独构建镜像

构建 signaling：

```bash
docker build -t meshkit-signaling:1.1.0 -f apps/signaling/Dockerfile .
```

构建 Web：

```bash
docker build -t meshkit-web:1.1.0 -f packages/web/Dockerfile .
```

## 单独运行容器

运行 signaling：

```bash
docker run -d \
  --name meshkit-signaling \
  -p 7000:7000 \
  -p 8000:8000 \
  -e NODE_ENV=production \
  -e HOST=0.0.0.0 \
  -e WS_PORT=7000 \
  -e PEER_PORT=8000 \
  -e DEVICE_STALE_TIME=45000 \
  -e ROOM_STALE_TIME=3600000 \
  -e CLEANUP_INTERVAL=5000 \
  --restart unless-stopped \
  meshkit-signaling:1.1.0
```

运行 Web：

```bash
docker run -d \
  --name meshkit-web \
  -p 3000:80 \
  --restart unless-stopped \
  meshkit-web:1.1.0
```

## 局域网访问

局域网设备访问时，不要使用 `localhost`，应使用部署机器的局域网 IP，例如：

```text
http://192.168.1.20:3000
ws://192.168.1.20:7000/ws
http://192.168.1.20:8000/peerjs
```

同时确认：

- 宿主机防火墙允许 `3000`、`7000`、`8000`。
- 手机或另一台电脑与宿主机处于同一网络，或网络之间可互相访问。
- 浏览器中的 signaling 和 PeerJS 地址填写的是宿主机 IP。

## HTTPS 建议

默认 Docker Web 镜像提供 HTTP。如果要放到公开网络、使用自定义域名，或想减少浏览器权限问题，可以在 Docker 前面增加 HTTPS 反向代理，例如 Caddy、Nginx Proxy Manager、Traefik 或自维护 Nginx。

放到公开网络时还需要额外考虑：

- 邀请链接不要公开暴露给不认识的人。
- signaling 服务没有账号体系，建议通过网络层限制访问范围。
- 复杂 NAT 环境下可能需要 STUN/TURN 方案。

## 升级

仓库更新后，推荐重新构建镜像：

```bash
docker compose down
docker compose up -d --build
```

仅刷新镜像：

```bash
docker compose build
docker compose up -d
```

## 排查

Web 页面打不开：

```bash
docker compose ps
docker compose logs -f web
```

Web 能打开，但设备发现或 RTC 不通：

- 检查 `7000` 和 `8000` 端口是否映射成功。
- 检查前端连接地址是否使用了正确的宿主机 IP。
- 检查防火墙是否拦截。
- 确认 signaling 容器健康。

手动检查健康接口：

```bash
docker exec -it meshkit-signaling sh
wget -q -O - http://127.0.0.1:7000/healthz
wget -q -O - http://127.0.0.1:8000/healthz

docker exec -it meshkit-web sh
wget -q -O - http://127.0.0.1/healthz
```

重建后页面仍是旧内容：

```bash
docker compose up -d --build
```

然后在浏览器中强制刷新页面。

## 相关文档

- [README](../README.md)
- [用户指南](./USER_GUIDE.md)
- [版本发布说明](./VERSION_RELEASE.md)
