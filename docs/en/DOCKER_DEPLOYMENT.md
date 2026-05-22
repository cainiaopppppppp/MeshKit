# Docker Deployment Guide

[简体中文](../DOCKER_DEPLOYMENT.md) | English

This document applies to Docker deployment for MeshKit `1.1.0`. Current Dockerized services include:

- `web`: Web frontend static site served by Nginx.
- `signaling`: WebSocket + PeerJS signaling service.

Desktop is an Electron application and does not run through Docker.

## Quick Start

Run from the repository root:

```bash
docker compose up -d --build
```

Default endpoints:

| Service | Address |
| --- | --- |
| Web page | `http://localhost:3000` |
| WebSocket signaling | `ws://localhost:7000/ws` |
| PeerJS service | `http://localhost:8000/peerjs` |

Check status and logs:

```bash
docker compose ps
docker compose logs -f
docker compose logs -f signaling
docker compose logs -f web
```

Stop services:

```bash
docker compose down
```

## Compose Services

`docker-compose.yml` contains two services.

`signaling`:

- Image name: `meshkit-signaling:1.1.0`.
- Exposes `7000` and `8000`.
- Provides `/healthz` health check.
- Ports and stale cleanup timing are controlled by environment variables.

`web`:

- Image name: `meshkit-web:1.1.0`.
- Maps host `3000` to container `80`.
- Starts after `signaling` is healthy.
- Provides `/healthz` health check.

## Environment Variables

`signaling` supports:

| Variable | Default | Description |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Service listen address |
| `WS_PORT` | `7000` | WebSocket port |
| `PEER_PORT` | `8000` | PeerJS port |
| `DEVICE_STALE_TIME` | `45000` | Device stale time in milliseconds |
| `ROOM_STALE_TIME` | `3600000` | Room stale time in milliseconds |
| `CLEANUP_INTERVAL` | `5000` | Cleanup interval in milliseconds |

If host ports conflict, change only the left side of port mappings, for example:

```yaml
ports:
  - "3001:80"
  - "7001:7000"
  - "8001:8000"
```

The frontend connection settings must then use the new host ports.

## Build Images Separately

Build signaling:

```bash
docker build -t meshkit-signaling:1.1.0 -f apps/signaling/Dockerfile .
```

Build Web:

```bash
docker build -t meshkit-web:1.1.0 -f packages/web/Dockerfile .
```

## Run Containers Separately

Run signaling:

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

Run Web:

```bash
docker run -d \
  --name meshkit-web \
  -p 3000:80 \
  --restart unless-stopped \
  meshkit-web:1.1.0
```

## LAN Access

For LAN devices, do not use `localhost`. Use the deployment machine's LAN IP, for example:

```text
http://192.168.1.20:3000
ws://192.168.1.20:7000/ws
http://192.168.1.20:8000/peerjs
```

Also confirm:

- Host firewall allows `3000`, `7000`, and `8000`.
- Phones or other computers are on the same network as the host, or networks can reach each other.
- Browser signaling and PeerJS settings use the host IP.

## HTTPS Recommendation

The default Docker Web image provides HTTP. For public networks, custom domains, or fewer browser permission issues, add an HTTPS reverse proxy in front of Docker, such as Caddy, Nginx Proxy Manager, Traefik, or self-managed Nginx.

For public networks, also consider:

- Do not expose invite links publicly to people you do not know.
- The signaling service has no account system; restrict access at the network layer.
- Complex NAT environments may require STUN/TURN.

## Upgrade

After repository updates, rebuild images:

```bash
docker compose down
docker compose up -d --build
```

Only refresh images:

```bash
docker compose build
docker compose up -d
```

## Troubleshooting

Web page cannot open:

```bash
docker compose ps
docker compose logs -f web
```

Web opens but device discovery or RTC does not work:

- Check whether `7000` and `8000` are mapped successfully.
- Check whether frontend connection addresses use the correct host IP.
- Check firewall rules.
- Confirm the signaling container is healthy.

Manually check health endpoints:

```bash
docker exec -it meshkit-signaling sh
wget -q -O - http://127.0.0.1:7000/healthz
wget -q -O - http://127.0.0.1:8000/healthz

docker exec -it meshkit-web sh
wget -q -O - http://127.0.0.1/healthz
```

Page is still old after rebuild:

```bash
docker compose up -d --build
```

Then force-refresh in the browser.

## Related Documents

- [README](../../README.en.md)
- [User Guide](./USER_GUIDE.md)
- [Version Release Notes](./VERSION_RELEASE.md)
