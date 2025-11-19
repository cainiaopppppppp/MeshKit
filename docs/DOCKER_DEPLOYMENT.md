# MeshKit Docker 部署指南

本文档详细说明如何使用 Docker 部署 MeshKit 项目。

## 目录

- [快速开始](#快速开始)
- [使用 Docker Compose](#使用-docker-compose)
- [单独部署各服务](#单独部署各服务)
- [生产环境配置](#生产环境配置)
- [常见问题](#常见问题)

---

## 快速开始

### 前置要求

- Docker 20.10+
- Docker Compose 1.29+

### 一键部署（推荐）

使用 Docker Compose 同时启动信令服务器和 Web 应用：

```bash
# 克隆项目
git clone https://github.com/cainiaopppppppp/p2p_claude.git
cd p2p_claude

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

启动后访问：
- Web 应用: http://localhost:3000
- 信令服务器 WebSocket: ws://localhost:7000
- PeerJS 服务器: http://localhost:8000

---

## 使用 Docker Compose

### docker-compose.yml 配置

项目根目录的 `docker-compose.yml` 包含了完整的服务配置。

### 常用命令

```bash
# 启动服务（后台运行）
docker-compose up -d

# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f signaling
docker-compose logs -f web

# 重启服务
docker-compose restart

# 停止服务
docker-compose stop

# 停止并删除容器
docker-compose down

# 停止并删除容器、网络、镜像
docker-compose down --rmi all

# 重新构建镜像
docker-compose build

# 重新构建并启动
docker-compose up -d --build
```

### 修改端口

如果默认端口被占用，可以修改 `docker-compose.yml`：

```yaml
services:
  signaling:
    ports:
      - "7001:7000"  # 改为 7001
      - "8001:8000"  # 改为 8001

  web:
    ports:
      - "3001:80"    # 改为 3001
```

### 环境变量

可以通过环境变量配置信令服务器：

```yaml
services:
  signaling:
    environment:
      - NODE_ENV=production
      - WS_PORT=7000
      - PEER_PORT=8000
      - LOG_LEVEL=info  # 日志级别：debug, info, warn, error
```

---

## 单独部署各服务

### 1. 部署信令服务器

#### 构建镜像

```bash
# 在项目根目录执行
docker build -t meshkit-signaling -f apps/signaling/Dockerfile .
```

#### 运行容器

```bash
docker run -d \
  --name meshkit-signaling \
  -p 7000:7000 \
  -p 8000:8000 \
  -e NODE_ENV=production \
  -e WS_PORT=7000 \
  -e PEER_PORT=8000 \
  --restart unless-stopped \
  meshkit-signaling
```

#### 查看日志

```bash
docker logs -f meshkit-signaling
```

#### 停止和删除

```bash
docker stop meshkit-signaling
docker rm meshkit-signaling
```

### 2. 部署 Web 应用

#### 构建镜像

```bash
# 在项目根目录执行
docker build -t meshkit-web -f packages/web/Dockerfile .
```

#### 运行容器

```bash
docker run -d \
  --name meshkit-web \
  -p 3000:80 \
  --restart unless-stopped \
  meshkit-web
```

#### 自定义 Nginx 配置

如果需要自定义 Nginx 配置，可以挂载配置文件：

```bash
docker run -d \
  --name meshkit-web \
  -p 3000:80 \
  -v $(pwd)/packages/web/nginx.conf:/etc/nginx/conf.d/default.conf:ro \
  --restart unless-stopped \
  meshkit-web
```

---

## 生产环境配置（可选）

本项目主要面向本地和局域网使用场景。如需在生产环境部署，包括 HTTPS 配置、反向代理、防火墙设置等，请自行配置。

---

## 常见问题

### 1. 构建失败：pnpm install 超时

**解决方案：增加构建超时时间**

```bash
# 使用 --build-arg 传递参数
docker build --build-arg BUILD_TIMEOUT=600 -t meshkit-signaling -f apps/signaling/Dockerfile .
```

或修改 Dockerfile 添加国内镜像源：

```dockerfile
# 在 Dockerfile 中添加
RUN pnpm config set registry https://registry.npmmirror.com
```

### 2. 容器启动失败

**检查日志：**

```bash
docker logs meshkit-signaling
docker logs meshkit-web
```

**检查端口占用：**

```bash
# Linux/Mac
lsof -i :7000
lsof -i :8000
lsof -i :3000

# Windows
netstat -ano | findstr :7000
netstat -ano | findstr :8000
netstat -ano | findstr :3000
```

### 3. Web 应用无法连接到信令服务器

**原因：** 客户端无法访问信令服务器地址

**解决方案：**

1. 检查防火墙规则
2. 确保信令服务器端口已开放
3. 在 Web 应用设置页面配置正确的服务器地址

### 4. 跨域问题

如果遇到 CORS 错误，需要在信令服务器添加 CORS 支持。

修改 `apps/signaling/src/index.ts`：

```typescript
import cors from 'cors';

app.use(cors({
  origin: '*', // 生产环境应该设置具体域名
  credentials: true
}));
```

### 5. Docker 镜像太大

**优化建议：**

1. 使用 `.dockerignore` 排除不必要的文件
2. 使用多阶段构建
3. 清理构建缓存

```bash
# 清理未使用的镜像
docker image prune -a

# 查看镜像大小
docker images | grep meshkit
```

### 6. 重启后容器未自动启动

**解决方案：** 使用 `--restart` 参数

```bash
docker run -d --restart unless-stopped ...
```

或在 docker-compose.yml 中添加：

```yaml
services:
  signaling:
    restart: always  # 或 unless-stopped
```

---

---

## 升级和维护

### 升级应用

```bash
# 拉取最新代码
git pull

# 重新构建镜像
docker-compose build

# 停止旧容器
docker-compose down

# 启动新容器
docker-compose up -d
```

### 备份和恢复

```bash
# 备份容器
docker commit meshkit-signaling meshkit-signaling-backup
docker commit meshkit-web meshkit-web-backup

# 导出镜像
docker save meshkit-signaling > meshkit-signaling.tar
docker save meshkit-web > meshkit-web.tar

# 导入镜像
docker load < meshkit-signaling.tar
docker load < meshkit-web.tar
```

---

## 总结

通过 Docker 部署 MeshKit 具有以下优势：

1. **环境一致性** - 开发和测试环境完全一致
2. **快速部署** - 一键启动所有服务
3. **易于维护** - 统一的容器管理
4. **可移植性** - 可在任何支持 Docker 的平台运行
5. **隔离性** - 服务之间相互隔离，互不影响

本项目主要面向本地和局域网使用场景，适合开发、测试和小范围协作使用。
