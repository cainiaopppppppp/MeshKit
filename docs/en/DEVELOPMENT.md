# Development Guide

[简体中文](../DEVELOPMENT.md) | English

This document is for people developing or packaging the MeshKit open-source project. For feature usage, see [User Guide](./USER_GUIDE.md). For code structure, see [Architecture](./ARCHITECTURE.md).

## Requirements

- Node.js 18 or later.
- pnpm 8 or later.
- Git.
- Electron Builder dependencies available on the current system when building Desktop installers.
- Docker 24 and Docker Compose Plugin 2 for Docker deployment testing.

## Install Dependencies

```bash
pnpm install
```

The core package is used by both Web and Desktop. On first run or after modifying core, build it first:

```bash
pnpm --filter core build
```

## Common Development Commands

```bash
pnpm dev
```

`pnpm dev` starts development tasks through Turborepo. You can also start modules separately:

```bash
pnpm dev:signaling
pnpm dev:web
pnpm dev:desktop
```

Common checks and builds:

```bash
pnpm --filter web type-check
pnpm --filter web build
pnpm --filter desktop build:main
pnpm --filter desktop build:preload
pnpm --filter desktop build:renderer
pnpm --filter desktop build:web-share
pnpm --filter desktop type-check
```

Desktop installers:

```bash
pnpm --filter desktop release:win
pnpm --filter desktop release:mac
```

`release:win` builds Windows installers. `release:mac` builds macOS DMG/ZIP and should be run on macOS.

Docker local deployment:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f
```

## Suggested Development Order

When changing shared logic:

1. Modify `packages/core`.
2. Run `pnpm --filter core build`.
3. Verify browser behavior in `packages/web`.
4. Verify Electron renderer and local service behavior in `packages/desktop`.

When changing pure Web pages:

1. Modify `packages/web/src`.
2. Run `pnpm --filter web type-check`.
3. Run `pnpm --filter desktop build:web-share` to ensure Desktop embedded share page is updated.

When changing Desktop main process:

1. Modify `packages/desktop/src/main` or `packages/desktop/src/preload`.
2. Run `pnpm --filter desktop build:main` and `pnpm --filter desktop build:preload`.
3. Start Desktop to verify window behavior, IPC, and local services.

## Code Organization

```text
packages/core/src      Shared logic that should stay runtime-agnostic
packages/web/src       Web pages, components, hooks, state, and utilities
packages/desktop/src   Electron main, preload, renderer
apps/signaling/src     Signaling server
docs/                  Documentation
```

Keep boundaries clear:

- Do not put Electron APIs into core.
- Do not put browser UI state into signaling.
- Do not let signaling store file contents.
- Put shared types in core first.

## Git Commit Suggestions

If one development session contains many changes, split commits by topic:

```bash
git status --short
git add README.md README.en.md docs/
git commit -m "docs: add bilingual MeshKit documentation"

git add packages/web/public packages/desktop/build
git commit -m "chore: update MeshKit app icons"

git add packages/web/src packages/desktop/src
git commit -m "feat: add MeshKit brand icon to app headers"
```

Interactive staging can help select exact chunks:

```bash
git add -p
git diff --cached
git commit -m "feat: describe the change"
```

Do not commit local credentials such as `.codex/auth.json`, `.ssh/config`, `.env`, private keys, or personal cache files.

## Debugging

### WebRTC

- Open `chrome://webrtc-internals` in the browser to inspect connection state.
- Confirm signaling address, PeerJS address, ports, and firewall settings.
- Pickup-code pages can use Refresh RTC to rebuild connections.

### Web

- Use browser DevTools to inspect console, network, and storage.
- If the page does not use the latest core logic, rebuild core first.

### Desktop

- Start Desktop with `pnpm dev:desktop`.
- View main process logs in the terminal.
- Open Chromium DevTools in renderer for page logs.
- If the shared web page is outdated, run `pnpm --filter desktop build:web-share`.
- On macOS, AirPlay Receiver may occupy `7000`; built-in services will search for available ports starting from defaults.

### Docker

- `docker compose ps` checks container status.
- `docker compose logs -f signaling` checks signaling logs.
- `docker compose logs -f web` checks Web static site logs.
- `/healthz` checks service health inside containers.

## Regression Checklist

Before release or merge, check at least:

- Peer-to-peer file send, receive, cancel, and completion.
- Pickup-code creation, joining, QR code, invite link, and Refresh RTC.
- Notes Wall creation, joining, password, sharing, and owner destruction.
- Encrypted Chat creation, joining, password, sharing, and owner destruction.
- Desktop invite link import and navigation on Windows and macOS.
- MeshKit icons, titles, and favicon in Web and Desktop.
- Docker `web` and `signaling` health checks.
