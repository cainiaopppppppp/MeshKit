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
COPY packages/web/package.json ./packages/web/
COPY packages/core/package.json ./packages/core/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY packages/web ./packages/web
COPY packages/core ./packages/core

# 构建 core 包
RUN pnpm --filter @meshkit/core build

# 构建 Web 应用
RUN pnpm --filter @meshkit/web build

# Stage 2: 运行阶段（使用 Nginx 提供静态文件服务）
FROM nginx:alpine

# 复制构建产物到 Nginx 目录
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
