# Pflanzn Frontend

React-based single-page application for the Pflanzn plant management system. Built as a Progressive Web App (PWA) with mobile-first responsive design and offline support.

## Tech Stack

- **Framework:** React 19 with TypeScript 5.9
- **Build Tool:** Vite 7.3
- **Routing:** React Router v7
- **HTTP Client:** Axios with auth interceptors
- **PWA:** vite-plugin-pwa + Workbox (CacheFirst for images, StaleWhileRevalidate for API, NetworkFirst for navigation)
- **Testing:** Vitest + @testing-library/react (jsdom)
- **Linting:** ESLint + Prettier (enforced via Husky pre-commit hooks)

## Development

```bash
npm install
npm run dev          # Vite dev server with hot reload
npm run build        # TypeScript check + production build
npm run lint         # ESLint
npm test             # Run tests
npm run test:watch   # Tests in watch mode
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
│   ├── TagsPanel.tsx, SharePanel.tsx, IdentificationsPanel.tsx
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
- Feature flags via environment variables (`VITE_AUTH_MODE`, `VITE_ENABLE_LOCATIONS`, etc.)
