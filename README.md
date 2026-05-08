<p align="center"><img width="120" src="./frontend/public/logo_transparent.png" alt="Pflanzn logo" /></p>

# Pflanzn

> Self-hostable plant management — track your collection, watering schedules, and species identification. Built as a PWA with mobile-first design and offline read access for cached data.

[![Sponsor](https://img.shields.io/badge/sponsor-Ko--fi-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/0x3e4)
![Status](https://img.shields.io/badge/status-active-success)
![Python](https://img.shields.io/badge/python-3.13-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![MariaDB](https://img.shields.io/badge/MariaDB-003545?logo=mariadb&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Workbox-5A0FC8?logo=pwa&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![Hecate](https://img.shields.io/endpoint?url=https%3A%2F%2Fhecate.pw%2Fapi%2Fv1%2Fscans%2Ftargets%2Fhttps%253A%252F%252Fgithub.com%252F0x3e4%252Fpflanzn%2Fshield)(https://hecate.pw/scans)

---

<p align="center">
  <img src="./docs/images/pflanzn-home.png" alt="Pflanzn home — recently captured plants, species snapshot, and overall counts" width="100%" />
</p>

<details>
<summary><strong>More screenshots</strong> — plants list, plant detail, identification</summary>

<br/>

<table>
  <tr>
    <td width="50%"><img src="./docs/images/pflanzn-plants.png" alt="Plants list with thumbnails and tags" /></td>
    <td width="50%"><img src="./docs/images/pflanzn-plant.png" alt="Plant detail with timeline and care advice" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Plants list</sub></td>
    <td align="center"><sub>Plant detail · timeline</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="./docs/images/planzn-identification.png" alt="Species identification via PlantNet" /></td>
    <td width="50%"></td>
  </tr>
  <tr>
    <td align="center"><sub>Species identification</sub></td>
    <td></td>
  </tr>
</table>

</details>

---

## Table of contents

- [Highlights](#highlights)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Local development](#local-development)
- [Configuration](#configuration)
- [Tech stack](#tech-stack)
- [Demo](#demo)
- [Support](#support)

---

## Highlights

|     |     |
| --- | --- |
| **Catalogue** | Plants with photos, species info, care notes; tags and locations with GPS coordinates and an interactive Leaflet map. |
| **Tracking** | Watering, fertilizing, image, and care-advice timelines with calendar view and per-activity colour coding. |
| **Identification** | One-shot PlantNet integration — accepts JPG / PNG / WebP / HEIC; the backend normalises uploads to JPEG before forwarding. |
| **AI care advice** | Optional integration with OpenAI, Claude, Mistral, HuggingFace, or a local Ollama instance — provider auto-detected from whichever API key is set. |
| **Auto-watering** | Outdoor plants with `reaches_rain=true` are auto-watered when Open-Meteo reports rainfall above your threshold. Optional OpenWeatherMap key for current-weather display. |
| **PWA** | Installable on phone or desktop; Workbox runtime caching (CacheFirst for images, StaleWhileRevalidate for API, NetworkFirst for navigation). |
| **Sharing** | Token-based public collection links with a dedicated read-only view. |
| **Auth modes** | `no` (open), `local` (JWT + Argon2 + Redis sessions with theft detection), or `oidc` (external IdP). |
| **No telemetry** | No tracking. No ads. |

---

## Architecture

```mermaid
flowchart LR
    User([User / Browser])

    subgraph Frontend["Frontend · React 19 / Vite / nginx :4173"]
        SPA[PWA SPA]
    end

    subgraph Backend["Backend · FastAPI / Python 3.13 :8000"]
        API[REST API]
        Weather[Weather loop]
        Image[Image pipeline]
    end

    Redis[("Redis<br/>sessions / OAuth state")]
    Maria[("MariaDB<br/>persistence")]
    Uploads[("Disk uploads<br/>plants/ identifications/ locations/<br/>WebP: thumb · medium · original")]

    PlantNet[("PlantNet<br/>identification")]
    LLM[("LLM providers (optional)<br/>OpenAI · Claude · Mistral<br/>HuggingFace · Ollama")]
    Meteo[("Open-Meteo<br/>rainfall (no key)")]
    OWM[("OpenWeatherMap<br/>(optional · current weather)")]

    User --> Frontend
    Frontend -->|/api| Backend
    Backend --> Redis
    Backend --> Maria
    Backend --> Uploads
    Backend --> PlantNet
    Backend --> LLM
    Weather --> Meteo
    Weather --> OWM
```

---

## Quick start

> [!NOTE]
> Requires Docker + Docker Compose. The compose file is gitignored — copy from the `.example` first.

```bash
cp .env.example .env
cp docker-compose.yml.example docker-compose.yml
# Edit .env with your settings (database, API keys, domain, etc.)
docker compose up -d --build
```

The app will be reachable at the domain you configured in `DOMAIN`. See [.env.example](.env.example) for all available settings.

Prebuilt images are also published to GHCR on every push to `main` ([build-images.yml](.github/workflows/build-images.yml)):

- `ghcr.io/0x3e4/pflanzn-backend`
- `ghcr.io/0x3e4/pflanzn-frontend` (multi-stage build → nginx alpine)

---

## Local development

### Frontend

```bash
cd frontend
pnpm install
pnpm run dev          # Vite dev server with hot reload
pnpm run build        # TypeScript check + production build
pnpm run lint         # ESLint
pnpm test             # Vitest
pnpm run test:watch   # Vitest in watch mode
```

Requires Node ≥ 24.

### Backend

The backend runs in Docker with `--reload`. For manual setup:

```bash
cd backend
poetry install
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Tests:

```bash
cd backend
poetry run pytest tests/ -v
```

### Linting

Pre-commit hooks (husky + lint-staged) run ESLint and Prettier on staged frontend files. The backend uses ruff:

```bash
poetry run ruff check backend/app/ --fix
```

---

## Configuration

Everything is driven through environment variables — see [.env.example](.env.example) for the full list. Frontend runtime configuration is fetched from `GET /api/config` so prebuilt images can be reconfigured per deployment without rebuilding.

| Category | Key variables |
| --- | --- |
| **General** | `SECRET_KEY`, `TZ`, `LOCALE`, `DOMAIN` |
| **Auth** | `AUTH_MODE` (`no` / `local` / `oidc`), `SHOW_PROTECTED_VIEW`, `ADMIN_USER`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` |
| **OIDC** | `OIDC_NAME`, `OIDC_PROVIDER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` |
| **Database** | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `DB_NAME` |
| **Redis** | `REDIS_URL` |
| **Features** | `ENABLE_LOCATIONS` |
| **Identification** | `PLANTNET_API_KEY`, `PLANTNET_LANGUAGE` |
| **AI providers (optional)** | `LLM_LANGUAGE`, `OPENAI_API_KEY` / `OPENAI_MODEL_NAME`, `CLAUDE_API_KEY` / `CLAUDE_MODEL_NAME`, `MISTRALAI_API_KEY` / `MISTRALAI_API_URL` / `MISTRALAI_MODEL_NAME`, `HUGGINGFACE_API_KEY` / `HUGGINGFACE_MODEL_NAME`, `OLLAMA_URL` / `OLLAMA_MODEL_NAME`. Provider auto-detected from whichever key is set; priority `openai > claude > mistralai > huggingface > ollama`. |
| **Weather** | `WEATHER_ENABLED`, `WEATHER_CHECK_INTERVAL_HOURS`, `WEATHER_RAINFALL_THRESHOLD_MM`, `OPENWEATHERMAP_API_KEY` (optional) |

> [!NOTE]
> Legacy `VITE_*` names (`VITE_DOMAIN`, `VITE_AUTH_MODE`, …) still resolve as fallbacks in the backend, but they're misleading — these vars are read by the **backend** at runtime and exposed to the frontend via `/api/config`. Vite itself never sees them, so the prefix carries no meaning. New deployments should use the unprefixed names.

---

## Tech stack

| Component | Technology |
| --- | --- |
| Backend | Python 3.13, FastAPI, SQLAlchemy ORM, Uvicorn, Poetry |
| Database | MariaDB |
| Cache | Redis (sessions, OAuth state) |
| Frontend | React 19, TypeScript 6, Vite 8, React Router v7, pnpm |
| Production serving | nginx alpine (multi-stage Dockerfile, served on port 4173) |
| Auth | JWT (HS256), Argon2, OIDC (authlib), Redis-backed sessions with IP + User-Agent theft detection |
| Identification | PlantNet (HEIC / WebP / PNG / JPG accepted; normalised to JPEG before forwarding) |
| AI care helper | OpenAI · Claude · Mistral · HuggingFace · Ollama (factory-pattern, each optional) |
| Weather | Open-Meteo (rainfall, no key); OpenWeatherMap (optional, current weather display) |
| PWA | vite-plugin-pwa + Workbox (CacheFirst / StaleWhileRevalidate / NetworkFirst) |
| Image pipeline | Pillow + pillow_heif → 3 WebP variants per upload (`thumb` 300px, `medium` 800px, `original` 2000px) served via `?size=…` |
| Deployment | Docker Compose; GHCR images via [GitHub Actions](.github/workflows/build-images.yml) |

---

## Demo

A public demo is available at **[pflanzn.app](https://pflanzn.app)** — login with `admin` / `admin`. Data resets every 4 hours.

---

## Support

Pflanzn is built and maintained as a labour of love. If it makes your plant-care routine easier, a small tip keeps the lights on:

<a href="https://ko-fi.com/0x3e4" target="_blank"><img height="36" src="https://storage.ko-fi.com/cdn/kofi1.png" alt="Buy me a coffee on Ko-fi" /></a>

A star on the [GitHub repo](https://github.com/0x3e4/pflanzn) is just as welcome — bug reports and pull requests too.

<br>

<div align="center">
Made with ❤ in Austria
</div>
