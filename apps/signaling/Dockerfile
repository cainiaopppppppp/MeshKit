FROM node:18-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

COPY apps/signaling/package.json ./apps/signaling/
COPY packages/core/package.json ./packages/core/

RUN pnpm install --frozen-lockfile

COPY apps/signaling ./apps/signaling
COPY packages/core ./packages/core

RUN pnpm --filter @meshkit/core build

FROM node:18-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/turbo.json ./
COPY --from=builder /app/apps/signaling ./apps/signaling
COPY --from=builder /app/packages/core ./packages/core

RUN pnpm install --prod --frozen-lockfile

EXPOSE 7000 8000

ENV NODE_ENV=production
ENV WS_PORT=7000
ENV PEER_PORT=8000

CMD ["pnpm", "--filter", "signaling", "start"]
