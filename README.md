<p align="center"><img width="120" src="./frontend/public/logo_transparent.png"></p>
<h2 align="center">Pflanzn</h2>

<div align="center">

[![Sponsor](https://img.shields.io/badge/sponsor-30363D?style=for-the-badge&logo=GitHub-Sponsors)](https://ko-fi.com/0x3e4)
![Status](https://img.shields.io/badge/status-active-success?style=for-the-badge)

</div>

<div align="center">

![](./docs/images/pflanzn-home.png)

</div>

## About

Pflanzn is a self-hostable **plant management app** for tracking your collection, watering schedules, and species identification. Built as a PWA with mobile-first design and offline read access for cached data.

**Core Features:**
- Catalog plants with photos, species info, and care notes
- Track watering and fertilizing schedules with calendar view
- Identify species via PlantNet API
- AI-powered care advice (supports OpenAI, Claude, Mistral, HuggingFace, Ollama)
- Organize plants by location with GPS coordinates and interactive map
- Automatic weather-based watering for outdoor plants (Open-Meteo / OpenWeatherMap)
- GPS-based location detection for quick coordinate entry
- Zoomable fullsize photo viewer (scroll wheel, pinch-to-zoom)
- Share your collection via token-based links
- Dark and light theme with full theming support

No telemetry. No tracking. No ads.

## Demo

A public demo is available at **[pflanzn.app](https://pflanzn.app)** — login with `admin` / `admin`. Data resets every 4 hours.

<div align="center">

|         |         |
|:-------:|:-------:|
| ![](./docs/images/pflanzn-plants.png) | ![](./docs/images/pflanzn-plant.png) |
| ![](./docs/images/planzn-identification.png) | ![](./docs/images/pflanzn-home.png) |

</div>

## Getting Started

Deployment is designed to be simple using Docker.

```bash
cp .env.example .env
# Edit .env with your settings (database, API keys, domain, etc.)
docker-compose up -d
```

The app will be available at the domain you configured in `VITE_DOMAIN`.

See [.env.example](.env.example) for all available settings including database, Redis, auth mode (`no`, `local`, `oidc`), API keys, domain, and timezone.

## Development

### Frontend

```bash
cd frontend
npm install
npm run dev          # Dev server with hot reload
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run tests
npm run test:watch   # Tests in watch mode
```

### Backend

The backend runs in Docker with auto-reload. For manual setup:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Run tests:

```bash
cd backend
pytest tests/ -v
```

### Linting

Pre-commit hooks (husky + lint-staged) run ESLint and Prettier automatically on staged files.

Backend uses ruff:

```bash
ruff check backend/app/ --fix
```

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, PWA (Workbox)
- **Backend:** Python, FastAPI, SQLAlchemy
- **Database:** MariaDB
- **Cache:** Redis

<br>

<div align="center">

Made with <3 in Austria

<a href='https://ko-fi.com/0x3e4' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi1.png' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
</div>