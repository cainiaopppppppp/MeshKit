# Version Release Notes

[简体中文](../VERSION_RELEASE.md) | English

This document records the current MeshKit version changes and the recommended checklist for future releases.

## Current Version

- Project version: `1.1.0`
- Scope: root, core, web, desktop, signaling, Docker images
- Main changes: unified MeshKit icons, improved sharing experience, organized file transfer and room collaboration flows

## MeshKit 1.1.0 Highlights

### Branding and Visuals

- Web and Desktop use a unified MeshKit icon.
- Web favicon, apple touch icon, and Desktop build icons are aligned.
- Desktop window title is updated to MeshKit Desktop.
- Desktop supports Windows and macOS packaging.
- Main page narrow-screen and mobile layouts were organized.

### Sharing

- File Transfer, Notes Wall, and Encrypted Chat all support invite links.
- Share dialogs support QR display and QR download.
- Devices with system share support can call native sharing.
- Desktop can import complete invite links shared from Web.
- Desktop jumps to the matching feature page after import.

### File Transfer

- Peer-to-peer transfer supports receiver file-list confirmation.
- Peer-to-peer transfer supports receiver completion after saving.
- Peer-to-peer transfer supports sender cancellation.
- Pickup-code mode supports 6-digit pickup codes, invite links, and QR codes.
- Pickup-code mode supports receiver completion confirmation.
- Receivers are notified when the sender cancels pickup-code sharing.
- Active transfers restrict page leaving to reduce interruption.
- Pickup-code pages provide Refresh RTC.

### Notes Wall and Encrypted Chat

- Recent rooms are supported.
- Owner information is shown.
- Only the owner can destroy rooms.
- Other members are notified and leave after room destruction.
- Sharing entry is unified as link, QR code, and QR download.

### Docker

- `web` and `signaling` image versions are aligned to `1.1.0`.
- Compose exposes Web, WebSocket, and PeerJS ports by default.
- Web and signaling both include health checks.

## Pre-release Checks

### Version Numbers

Confirm these files have consistent versions:

- `package.json`
- `packages/core/package.json`
- `packages/web/package.json`
- `packages/desktop/package.json`
- `apps/signaling/package.json`
- `docker-compose.yml`

### Icon Assets

Confirm these assets are synchronized:

- `packages/web/public/meshkit-icon.png`
- `packages/web/public/favicon.png`
- `packages/web/public/favicon.ico`
- `packages/web/public/apple-touch-icon.png`
- `packages/desktop/src/renderer/assets/meshkit-icon.png`
- `packages/desktop/src/renderer/public/meshkit-icon.png`
- `packages/desktop/src/renderer/public/favicon.ico`
- `packages/desktop/build/icon.png`
- `packages/desktop/build/icon.ico`
- `packages/desktop/build/icon.icns`, when releasing macOS packages

### Recommended Commands

```bash
pnpm --filter core build
pnpm --filter web type-check
pnpm --filter web build
pnpm --filter desktop build:main
pnpm --filter desktop build:preload
pnpm --filter desktop build:renderer
pnpm --filter desktop build:web-share
pnpm --filter desktop type-check
```

Docker:

```bash
docker compose config
docker compose up -d --build
docker compose ps
```

Desktop installers:

```bash
pnpm --filter desktop release:win
pnpm --filter desktop release:mac
```

`release:win` generates Windows NSIS/Portable packages. `release:mac` generates macOS DMG/ZIP and should be run on macOS.

## Manual Regression Checklist

File Transfer:

- Peer-to-peer send, receive, cancel, and completion.
- Multi-file and single-file transfer.
- Pickup-code generation, input, invite link, and QR code.
- Receiver notification after sender cancellation.
- Refresh RTC during RTC errors.

Notes Wall:

- Create and join rooms.
- Room password verification.
- Add, edit, delete, and sync notes.
- Share links and QR codes.
- Non-owners cannot destroy rooms.
- Members leave after owner destruction.

Encrypted Chat:

- Create and join rooms.
- Room password verification.
- Send and receive messages.
- Share links and QR codes.
- Non-owners cannot destroy rooms.
- Members leave after owner destruction.

Desktop:

- Windows installer starts and opens Share Hub.
- macOS DMG/ZIP starts and opens Share Hub.
- Brand icon appears on first screen.
- Import pickup-code invite links.
- Import Notes Wall invite links.
- Import Encrypted Chat invite links.
- Local sharing services are accessible by LAN devices.
- On macOS, if default `7000` is occupied, later available ports are used automatically.

Docker:

- Web page is accessible.
- signaling `/healthz` is healthy.
- PeerJS `/healthz` is healthy.
- LAN devices can access Web through the host IP.

## Suggested Commit Split

If changes are large, split by topic:

```bash
git add README.md README.en.md docs/
git commit -m "docs: add bilingual MeshKit documentation"

git add packages/web/public packages/desktop/build packages/desktop/src/renderer/public
git commit -m "chore: update MeshKit icons"

git add packages/web/src packages/desktop/src
git commit -m "feat: align MeshKit app branding"
```

Before committing:

```bash
git status --short
git diff --cached
```

Do not commit local credentials, SSH config, API tokens, `.env`, or personal cache files.

## Release Note Template

```markdown
## MeshKit 1.1.0

### Added
- Unified MeshKit brand icons for Web and Desktop.
- File Transfer, Notes Wall, and Encrypted Chat support invite links and QR codes.
- Desktop supports Windows/macOS, invite link import, and navigation to matching pages.

### Improved
- Completed confirmation, cancellation, and completion flows for peer-to-peer and pickup-code transfer.
- Improved mobile and narrow-screen layouts.
- Updated Docker images and health checks.

### Notes
- Share invite links only with trusted people.
- LAN deployment needs Web, WebSocket, and PeerJS ports allowed by firewall.
```
