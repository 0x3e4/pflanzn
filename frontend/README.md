# Pflanzn Frontend

React-based single-page application for the Pflanzn plant management system. Built as a Progressive Web App (PWA) with mobile-first responsive design and offline support.

## Tech Stack

- **Framework:** React 19 with TypeScript 6
- **Build Tool:** Vite 8
- **Routing:** React Router v7
- **HTTP Client:** Axios with auth interceptors
- **PWA:** vite-plugin-pwa + Workbox (CacheFirst for images, StaleWhileRevalidate for API, NetworkFirst for navigation)
- **Testing:** Vitest + @testing-library/react (jsdom)
- **Linting:** ESLint + Prettier (enforced via Husky pre-commit hooks)
- **Production serving:** nginx (multi-stage Dockerfile — `builder` runs `vite build`, `runtime` is nginx alpine serving `dist/` on port 4173). Cache headers in [nginx.conf](nginx.conf): immutable for hashed `/assets/*`, no-cache for `sw.js` / `manifest.webmanifest` so PWA updates propagate

## Development

```bash
pnpm install
pnpm run dev          # Vite dev server with hot reload
pnpm run build        # TypeScript check + production build
pnpm run lint         # ESLint
pnpm test             # Run tests
pnpm run test:watch   # Tests in watch mode
```

Requires Node >= 24.

## Project Structure

```
src/
├── pages/              # Route-level components
│   ├── Home.tsx
│   ├── Plants.tsx
│   ├── PlantDetails.tsx
│   ├── Locations.tsx
│   ├── LocationDetails.tsx
│   ├── Login.tsx
│   ├── Manage.tsx
│   └── About.tsx
├── components/         # Reusable UI components
│   ├── Navbar.tsx, BottomNav.tsx, Footer.tsx
│   ├── Calendar.tsx, LocationCalendar.tsx
│   ├── TimelineImages.tsx, LocationTimelineImages.tsx
│   ├── MapPanel.tsx, StaticLeafletMap.tsx
│   ├── WeatherPanel.tsx, StatisticsPanel.tsx
│   ├── LocationsPanel.tsx, PlantsPanel.tsx, UsersPanel.tsx
│   ├── TagsPanel.tsx, SharePanel.tsx, IdentificationsPanel.tsx, WateringsPanel.tsx
│   ├── ErrorBoundary.tsx, OfflineBanner.tsx, LoadingOverlay.tsx
│   └── ...
├── context/            # React Context providers
│   ├── AuthContext.tsx
│   └── ShareContext.tsx
├── services/           # API client and CRUD modules
│   ├── apiClient.ts          # Axios instance with token refresh
│   ├── PlantService.ts
│   ├── LocationService.ts
│   ├── WeatherService.ts
│   ├── UserService.ts
│   ├── TagService.ts
│   ├── ShareService.ts
│   └── StatisticService.ts
├── hooks/              # Custom React hooks
│   ├── useModalA11y.ts       # Modal keyboard accessibility
│   ├── useOnlineStatus.ts    # Online/offline detection
│   ├── usePullToRefresh.ts   # Pull-to-refresh gesture
│   └── useTheme.ts           # Dark/light theme toggle
├── types/              # TypeScript interfaces
├── styles/             # Component CSS files
├── config/             # App configuration
└── test/               # Test files
```

## Key Conventions

- Functional components with hooks only (no class components)
- State management via React Context API (no Redux)
- CSS variables for theming (dark/light mode), 768px responsive breakpoint
- All modals use `useModalA11y` hook for keyboard accessibility
- Configuration is fetched from the backend at startup via `GET /api/config` and read through `useConfig()` (`AUTH_MODE`, `ENABLE_LOCATIONS`, `SHOW_PROTECTED_VIEW`, `DOMAIN`, …); `import.meta.env` is not used. Legacy `VITE_*` env names still resolve as backend fallbacks but are deprecated.
