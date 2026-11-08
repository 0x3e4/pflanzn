# Architecture

Pflanzn is a React single-page app talking to a FastAPI backend. The backend stores everything in
MariaDB and on disk, keeps sessions and OAuth state in Redis, and reaches out to Pl@ntNet, an AI
provider and the weather services only when those features are on.

| Part | What it does |
| --- | --- |
| **Frontend** | React 19 PWA, served by nginx on port 4173. Reads its settings from `/api/config`. Forwards `/docs/` to the docs container. |
| **Backend** | FastAPI on Python 3.14, port 8000: the REST API under `/api`, the MCP server at `/api/mcp` with its OAuth server, the weather loop and the image pipeline. |
| **MariaDB** | Plants, waterings, notes, care advice, users, the audit log. New tables and columns are added on start. |
| **Redis** | Sessions (with theft detection), OAuth requests and codes, rate limits. |
| **Uploads** | Photos on disk under `plants/`, `identifications/` and `locations/`, each stored as WebP in three sizes. |
| **Docs** | This site, built with MkDocs Material and served by nginx on port 80. Optional. |

## Requests

```text
Browser ──► reverse proxy ──┬─ /api/*, /.well-known/oauth-* ──► backend :8000 ──┬─ MariaDB
                            │                                                   ├─ Redis
                            │                                                   ├─ uploads (disk)
                            │                                                   └─ Pl@ntNet, AI provider, Open-Meteo
                            └─ everything else ─────────────► frontend :4173 ──── /docs/* ──► docs :80
```

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
| AI | OpenAI, Claude, Mistral, Hugging Face, Ollama (each optional) |
| Weather | Open-Meteo (rain, no key), OpenWeatherMap (optional, current weather) |
| Docs | MkDocs Material |
| Deployment | Docker Compose, images on GHCR built by GitHub Actions |
