FROM node:20-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV WS_PORT=7000
ENV PEER_PORT=8000

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/signaling/package.json apps/signaling/package.json

RUN pnpm install --filter @meshkit/signaling --prod --frozen-lockfile

COPY apps/signaling apps/signaling

WORKDIR /app/apps/signaling

EXPOSE 7000 8000

CMD ["pnpm", "start"]
