# Getting Started

Pflanzn runs as a few containers: the **backend** (FastAPI), the **frontend** (the app, served by
nginx), **MariaDB** and **Redis**. A fifth, the **docs** container, serves this site and is
optional. Prebuilt images are published to the GitHub Container Registry, so there is nothing to
build.

## Requirements

- Docker with Docker Compose
- A domain and a reverse proxy with TLS (Caddy, nginx, Traefik), if the app is reachable from outside

## Quick start

```bash
git clone https://github.com/0x3e4/pflanzn.git
cd pflanzn
cp .env.example .env
cp docker-compose.yml.example docker-compose.yml
# Edit .env: at least SECRET_KEY, DOMAIN, the database passwords and AUTH_MODE
docker compose up -d
```

The compose file is gitignored, so your changes to it stay out of the repository. All settings are
in [`.env.example`](https://github.com/0x3e4/pflanzn/blob/main/.env.example). The most important
ones are explained under [Configuration](configuration.md).

With `AUTH_MODE=local`, set `ADMIN_USER`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` before the first start.
The backend then creates that admin account.

## Reverse proxy

> [!IMPORTANT]
> The frontend container only serves the app. It does **not** forward the API. Opening `:4173`
> directly loads the interface, but every `/api` call gets `index.html` back and no data shows up.

Put a reverse proxy in front that routes:

| Path | Target |
| --- | --- |
| `/api/*` | backend `:8000` |
| `/mcp`, `/.well-known/oauth-*` | backend `:8000` (only needed for [MCP](mcp.md)) |
| everything else | frontend `:4173` |

Caddy:

```caddyfile
plants.example.com {
    @backend path /api /api/* /mcp /mcp/ /.well-known/oauth-*
    reverse_proxy @backend localhost:8000
    reverse_proxy localhost:4173
}
```

nginx:

```nginx
location ~ ^/(api(/|$)|mcp/?$|\.well-known/oauth-) {
    proxy_pass http://localhost:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 30m;   # match MAX_UPLOAD_MB
    proxy_read_timeout 300s;    # AI care advice with web search can take minutes
}

location / {
    proxy_pass http://localhost:4173;
    proxy_set_header Host $host;
}
```

## Documentation site

This site comes as its own image, `ghcr.io/0x3e4/pflanzn-docs`. It can be served two ways, and
both work at once:

- **Under the app at `/docs`.** The frontend forwards `/docs/` to the container named `docs` on the
  same Docker network. Add the service from the compose example and the docs are at
  `https://plants.example.com/docs/`. The reverse proxy needs no change, because `/docs` already
  goes to the frontend. Without a docs container, `/docs` redirects to the docs on GitHub.
- **On its own domain.** Route a domain like `docs.example.com` straight to the docs container on
  port 80.

```yaml
  docs:
    image: ghcr.io/0x3e4/pflanzn-docs:latest
    pull_policy: always
    restart: always
    # Only for a separate docs domain; /docs in the app needs no port.
    # ports:
    #   - "4174:80"
    networks:
      - default
```

If the docs container has another name or runs elsewhere, set `DOCS_UPSTREAM` on the frontend
(default `http://docs:80`). Outside Docker, `DOCS_RESOLVER` names the DNS server nginx uses to find
it (default `127.0.0.11`, Docker's own).

## Images and updates

Images are built on every push to `main` and on every version tag:

| Image | Contents |
| --- | --- |
| `ghcr.io/0x3e4/pflanzn-backend` | The API, the weather loop and the image pipeline |
| `ghcr.io/0x3e4/pflanzn-frontend` | The app, served by nginx on port 4173 |
| `ghcr.io/0x3e4/pflanzn-docs` | This documentation, served by nginx on port 80 |

`main` builds get the `latest` and `main-<sha>` tags; releases get `X.Y.Z`, `X.Y` and `X`. For
production, pin an explicit version. Updating is a pull and a restart:

```bash
docker compose pull
docker compose up -d
```

The database schema updates itself on start. Check the [Changelog](changelog.md) for anything
that needs your attention.

## Local development

```bash
# Frontend (Node 24 or newer)
cd frontend
pnpm install
pnpm run dev          # Vite dev server with hot reload
pnpm run build        # type check and production build
pnpm test             # Vitest

# Backend
cd backend
poetry install
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
poetry run pytest tests/ -v

# This documentation (from the repository root, with Python 3.14)
poetry -P docs install
poetry -P docs run mkdocs serve
```
