# Stage 1: 构建阶段
FROM node:18-alpine AS builder

# 安装 pnpm
RUN npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 复制根目录的 package.json 和 pnpm 配置
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# 复制所有 package.json 文件
COPY apps/signaling/package.json ./apps/signaling/
COPY packages/core/package.json ./packages/core/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY apps/signaling ./apps/signaling
COPY packages/core ./packages/core

# 构建 core 包
RUN pnpm --filter @meshkit/core build

# 构建信令服务器
RUN pnpm --filter signaling build

# Stage 2: 运行阶段
FROM node:18-alpine

# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /app

# 从构建阶段复制必要文件
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/turbo.json ./
COPY --from=builder /app/apps/signaling ./apps/signaling
COPY --from=builder /app/packages/core ./packages/core

# 只安装生产依赖
RUN pnpm install --prod --frozen-lockfile

# 暴露端口
EXPOSE 7000 8000

# 设置环境变量
ENV NODE_ENV=production
ENV WS_PORT=7000
ENV PEER_PORT=8000

# 启动服务
CMD ["pnpm", "--filter", "signaling", "start"]
