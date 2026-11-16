# Architecture

Pflanzn is a React single-page app talking to a FastAPI backend. The backend stores everything in
MariaDB and on disk, keeps sessions and OAuth state in Redis, and reaches out to Pl@ntNet, an AI
provider, the weather services and Apprise only when those features are on.

| Part | What it does |
| --- | --- |
| **Frontend** | React 19 PWA, served by nginx on port 8080. Reads its settings from `/api/config`. Also the gateway: forwards `/api`, `/mcp` and `/.well-known/oauth-*` to the backend and `/docs/` to the docs container. |
| **Backend** | FastAPI on Python 3.14, port 8000: the REST API under `/api`, the MCP server at `/mcp` (and the older `/api/mcp`) with its OAuth server, two background loops (the rain check, and once a minute the notifications) and the image pipeline. |
| **MariaDB** | Plants, waterings, notes and reminders, care advice, users, app settings, the audit log. New tables and columns are added on start. |
| **Redis** | Sessions (with theft detection), OAuth requests and codes, rate limits, the Pl@ntNet species facts (a week) and today's identification allowance, and which day's watering digest went out. |
| **Uploads** | Photos on disk under `plants/`, `identifications/` and `locations/`, each stored as WebP in three sizes, and floor plans under `floorplans/`. |
| **Apprise** | Optional. Receives reminders and the watering digest from the backend and sends them on. See [Notifications](notifications.md). |
| **Docs** | This site, built with MkDocs Material and served by nginx on port 80. Optional. |

## Requests

```text
Browser ──► reverse proxy ──► frontend :8080 ─┬─ the app
                                              ├─ /api/*, /mcp, /.well-known/oauth-* ──► backend :8000 ─┬─ MariaDB
                                              │                                                         ├─ Redis
                                              │                                                         ├─ uploads (disk)
                                              │                                                         ├─ Pl@ntNet, GBIF, AI, Open-Meteo
                                              │                                                         └─ Apprise ──► Telegram, ntfy, mail, …
                                              └─ /docs/* ──► docs :80
```

Only the frontend needs to be reachable by the reverse proxy. Backend and docs sit on the stack's
own network; MariaDB and Redis on an internal one without internet access.

## Images

Every upload, whether JPG, PNG, WebP or HEIC, is converted with Pillow and pillow-heif into three
WebP files: `thumb` (300 px), `medium` (800 px) and `original` (2000 px). The app asks for the size
it needs with `?size=…`, so lists load thumbnails and the full photo loads only when opened.
Identification uploads are converted to JPEG for Pl@ntNet.

## Offline

The app is a PWA built with vite-plugin-pwa and Workbox. Uploaded photos are cached on first view
(cache first, up to 30 days). Plants, locations, profile and statistics come from the network first
and fall back to the cache only when the network fails, so a change always shows at once. Floor
plans are never cached.

## Tech stack

| Component | Technology |
| --- | --- |
| Backend | Python 3.14, FastAPI, SQLAlchemy, Uvicorn, Poetry |
| Database | MariaDB |
| Cache | Redis |
| Frontend | React 19, TypeScript 6, Vite 8, React Router 7, pnpm |
| Serving | nginx alpine (multi-stage Dockerfiles) |
| Auth | JWT (HS256), Argon2, OIDC (authlib), OAuth 2.1 for MCP |
| Identification | Pl@ntNet |
| Species facts | Pl@ntNet species pages, GBIF (family, genus) |
| AI | OpenAI, Claude, Mistral, Hugging Face, Ollama (each optional; several at once) |
| Weather | Open-Meteo (rain, no key), OpenWeatherMap (optional, current weather) |
| Notifications | Apprise API (optional) |
| Docs | MkDocs Material |
| Deployment | Docker Compose, images on GHCR built by GitHub Actions |
