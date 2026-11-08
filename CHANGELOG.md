# Changelog

All notable changes to Pflanzn will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed
- The frontend container is now the gateway: it forwards `/api`, `/mcp` and `/.well-known/oauth-*` to the backend and `/docs/` to the docs container, so the reverse proxy only needs the frontend (one `location /` block) and backend and docs need no published port. Upstreams are looked up per request, so a recreated backend is found again and the frontend starts without it. New frontend variables: `BACKEND_UPSTREAM` (default `http://pflanzn-backend:8000`), `TRUSTED_PROXIES` (whose `X-Forwarded-For` gives the client IP; default private networks), `MAX_UPLOAD_MB` and `UPSTREAM_RESOLVER`, which replaces `DOCS_RESOLVER`. **`DOCS_UPSTREAM` now defaults to `http://pflanzn-docs:80`**: give the docs service that alias (as in the compose example) or set it, otherwise `/docs` falls back to GitHub. A proxy that sends `/api` straight to the backend keeps working.
- Compose example: backend and docs get the aliases `pflanzn-backend` and `pflanzn-docs` and no published port; the frontend listens on `127.0.0.1:4173` and only gets `DOMAIN` and `MAX_UPLOAD_MB` instead of the whole `.env`; Redis moves to the internal network with the database.
- The MCP endpoint moves to `/mcp`, like Hecate's. `/api/mcp` keeps working, so existing connections stay connected; the OAuth metadata names whichever path the client used. **Reverse proxy:** forward `/mcp` to the backend as well (nginx: `location ~ ^/(api(/|$)|mcp/?$|\.well-known/oauth-)`), and don't rewrite it to `/api/mcp`.

### Fixed

### Security
- Location names (and the crop of a location) reached the map tooltips as HTML, so a member could put script into a name that ran for whoever hovered the marker, an admin included. They are text now. Leaflet, loaded from unpkg, is pinned with Subresource Integrity.
- With `AUTH_MODE=local` and `ADMIN_USER`/`ADMIN_PASSWORD` left empty (as in `.env.example`), the first start created an admin named "" with the password "". The backend now refuses to start until they are set, and an empty password never logs in. Check for such an account: `SELECT id FROM users WHERE username = '';`
- `/api/oauth/authorize` redirected malformed requests (wrong `response_type`, missing PKCE) to the client's `redirect_uri` before the user decided anything. Since anyone can register a client, that was an open redirect from your domain. Those errors are shown as a 400 now; redirects happen only after Allow or Deny.
- Plant and location photos and both identification uploads decoded images of any size up to Pillow's own limit (about 179 MP), so a small, highly compressed file could take more than a gigabyte of memory per request. They are capped at 64 MP before decoding now, like floor plans, and Pillow's global limit matches.
- Error responses no longer repeat the exception's text, which could carry the OpenWeatherMap API key (requests puts the full URL, `appid` included, into its errors), SQL or file paths. They say what failed and the kind of error, e.g. "Care helper failed (RateLimitError)"; the full text goes to the backend log. The OpenWeatherMap error is cleaned where it happens, so the key stays out of the log too. **If OpenWeatherMap ever failed on your instance, rotate the key.**
- `GET /api/config` (no login needed) named the admin account (`admin_user`), enough to keep it locked out with failed logins. It's gone; the users list, which only admins see, marks the default admin with `is_default_admin` instead.
- The OIDC login meant to use PKCE but didn't: the method was passed where authlib ignores it, so the identity provider got no challenge and no verifier was sent. It's on now. If your provider requires a fixed PKCE setting per client, allow S256.
- With `AUTH_MODE=no` and MCP on, any website a visitor opened could send write calls to `/mcp` as a plain-text POST (no CORS preflight). `/mcp` now requires `Content-Type: application/json`, which every MCP client sends.
- An `AUTH_MODE` that is none of `no`, `local`, `oidc` (a typo such as `locla`) skipped the SECRET_KEY check and the session binding while password login kept working. The backend now refuses to start with such a value.
- The MCP consent page showed only the host of a redirect address, so a native-app address like `x-evil://claude.ai/cb` read as "claude.ai". Addresses that aren't http(s) are shown with their scheme now.
- Signing out now deletes the app's offline copies of plants, locations, the profile, statistics and photos. Before, they stayed in the browser and could be read offline by the next person on a shared device.

## [2.1.0] - 2026-11-08

### Added
- Statistics, rebuilt: the watering status of the whole collection (overdue, due today and tomorrow, fine, no schedule; the due parts open the filtered plants list), a year of care as a calendar, waterings per week for twelve weeks split into by hand and by rain, plants per tag and top species as bars, the most cared-for plants of the last 90 days and the plants longest without water. Totals now include fertilizing and show the last 30 days against the 30 before. Every chart has a table view; colours are validated for colour-blind readers in both themes. New endpoint `GET /api/statistics/activity`.
- The plants list opens filtered from links: `?needs_water=1` and `?tag=<name>`.
- Documentation site (MkDocs Material, in the app's colours and fonts, light and dark): getting started, a user guide for plants, locations and AI, MCP, access, configuration, architecture and the changelog. It ships as its own image, `ghcr.io/0x3e4/pflanzn-docs`, and is served both at `{DOMAIN}/docs/` (the frontend forwards it to the docs container, or to the docs on GitHub when there is none) and on a domain of its own. The compose example has the new `docs` service; `DOCS_UPSTREAM` and `DOCS_RESOLVER` on the frontend point elsewhere if needed.
- The MCP guide has a screenshot of Manage → MCP, and the link there now opens `/docs/mcp/`.
- MCP guide ([docs/mcp.md](https://github.com/0x3e4/pflanzn/blob/main/docs/mcp.md)): enabling the server, the three sign-in modes, connecting Claude, Claude Code and other clients, every tool with its access, and example prompts. Manage → MCP links to it.
- Generating a plant's description with AI also asks for its usual watering interval and fills it in when the plant has none. An interval set by hand stays; the toast then names the suggestion. Works with every provider.

### Changed
- A warmer look: green-black grounds in the dark theme and warm cream in the light one instead of neutral grey, Alegreya for headings and the wordmark, and a few drawn leaves across the top of each page. Layout, watering blue and the status colours are unchanged; every text colour meets WCAG AA in both themes.
- README screenshots show the new look.
- A deeper forest green for buttons, the active tag and the camera button instead of the bright Material green; links and highlights in a soft sage.
- The installed app's title and status bar take the page ground instead of the old grey and green (manifest, `theme-color`), and loading placeholders are tinted to match.
- Home: the collection figures sit in one row under the plants that need water, so a short list leaves no hole.
- Plant cards show a long name on two lines before cutting it off; tall plant photos are cropped to a sensible height on the plant page.
- Phone: the tag filter on the plants list scrolls as one row.
- Plant page: every care advice sits in the Care advice block, the newest open and the earlier ones under "Earlier advice" with their dates, instead of scattered through the activity feed.
- Fonts (Alegreya, Inter) are bundled with the app instead of loaded from Google Fonts, so they also work offline.
- New frontend dependency releases are accepted after 7 days instead of 14 (`minimumReleaseAge` in `frontend/pnpm-workspace.yaml`).

### Fixed
- "Show older" in a plant's activity feed loads older entries from the server; before, only the newest 20 were ever reachable.
- A one-line plant description no longer leaves a large empty box under it.
- Date and time fields use the app's font instead of the browser's.
- The icon-only "Add a note" buttons have an accessible name.

### Removed
- Chart.js: the statistics charts are plain HTML now, which drops the library from the frontend bundle.

### Security
- Frontend build and test dependencies: follow-redirects 1.16.2, glob 14.0.3 and minimatch 11.0.3 (pnpm overrides). None of them ship in the image.

## [2.0.0] - 2026-11-07

### Added
- Pl@ntNet link next to a plant's species, in `PLANTNET_LANGUAGE`.
- The AI care helper looks at the three latest photos and the plant's notes, fertilizing, location, watering plan and last advice, and uses facts from the species' Pl@ntNet page. Answers come in four sections: diagnosis, likely causes, what to do now, what to watch for.
- With Claude or OpenAI, the care helper can also search the web; Claude also reads pages (`CARE_WEB_SEARCH`, on by default). OpenAI care advice now uses the Responses API.
- `CLAUDE_EFFORT` sets how hard Claude thinks (`low`, `medium`, `high`, `xhigh`, `max`); empty keeps the model's default.
- A plant without a description offers the one another plant of the same species already has, next to "Write with AI".

### Changed
- Care advice in the activity feed shows its sections as headings and the steps as a numbered list; it opens on the diagnosis, the rest is one tap away.
- Floor plan: markers that would overlap are shown as one, with a count, led by the plant that needs water most; tap it to zoom in. Markers get smaller on phone-sized plans, and the zoom buttons (now with a reset) sit top right, clear of the bottom navigation.
- Home shows what needs water today: the due plants with a Water button each and "Water all", what comes up next, the collection's figures and the latest photos. The species bar list and the autoplaying carousel are gone.
- Plant page: "Water now" is the one primary action, right under the name (under the photo on a phone), with Fertilize, Add photo and a More menu (identify, AI care advice, AI description, archive, delete) beside it. Watering at another time opens from "Watered earlier? Set the time". The header shows the watering status, the latest care advice has its own block, and the activity feed no longer scrolls inside a box.
- Plants list: square cards with the water, photo and identify buttons on the photo; two columns on a phone, with species and sort behind a Filter button.
- Location page: "Add photo" is the one primary action under the name, with "Add a harvest time" behind a disclosure, Identify crop and a More menu (AI description, archive, delete); the bottom button bar is gone. "Use my location" is a quiet button.
- Navigation: the links and the theme and camera icons sit together on the right, instead of the icons floating mid-bar.
- Signed-out visitors no longer see buttons that only answer "you must be logged in": each page shows one "Sign in to …" line instead, which returns to the page after signing in.
- The Plants and Locations lists and Home load each plant without its full watering, fertilizing, note and care advice history (`GET /api/plants/?summary=true`, with counts instead), so they stay quick as the history grows. Without the parameter the endpoint answers as before.
- Location tags, notes and harvest times are stored on the server, so they show on every device and for everyone with access. Until now they lived only in the browser they were entered in: the first visit to a location page with this version moves them to the server (signed in, once per browser; nothing is lost if it can't reach the server).
- Manage, Statistics: a row of figures instead of icon tiles, and the top species as a table beside the chart.
- Locations list: the same square cards, with the photo and identify buttons on the photo and two columns on a phone.
- Manage, Plants: restoring an archived plant looks different from archiving (an outline and its own icon), archived rows are muted, and the table buttons have names for screen readers.
- One watering-status colour everywhere: red means water now, amber means soon, neutral means fine (it was blue for overdue).
- Primary buttons use a deeper green with white text (white on #4caf50 was 2.8:1, below the 4.5:1 minimum). Watering is always blue, on every water button. Keyboard focus shows a light ring on every control. Labels use sentence case instead of spaced capitals, and the footer is a quiet line instead of a green band.

### Removed
- "Archive location" in the location page's More menu: it only said it wasn't available yet.
- The footer. About, GitHub and the version are at the bottom of the Manage menu; signed-out visitors find About in the navigation.

### Internal
- Backend: no more deprecated `datetime.utcnow()`, class-based Pydantic `Config` or `on_event("startup")`; ruff is clean.
- CSS: 83 paddings, margins and gaps that were 1–2px off the spacing scale (3, 5, 7, 9, 14, 15, 18, 25, 30px) now use it; the 10px values stay.
- Frontend: all tests pass (two sign-in tests assumed local auth without setting it); the plant page's activity feed no longer remounts on every render.

### Security
- A user could take over another account (including admin) by renaming themselves to its email.
- The PlantNet API key could appear in identify error messages and logs. **Rotate `PLANTNET_API_KEY`.**
- Share-link aliases no longer grant access; only the random token does.
- OIDC refresh tokens are now bound to the server and revoked on logout (one re-login for OIDC users).
- Startup refuses an unset or example `SECRET_KEY` when auth is enabled.
- Client IPs are no longer taken from client-supplied headers; client registration is capped.
- External MCP tokens require `MCP_OAUTH_AUDIENCE` and an asymmetric JWT signature.
- Weather zones are no longer visible to share-link viewers.
- Replaced python-jose with PyJWT (CVE-2024-33663, CVE-2026-85394); this also drops ecdsa (CVE-2024-23342, CVE-2026-33936).
- Bumped certifi to 2026.10.23 (GHSA-6q48-6c7w-9gw2) and vitest to 4.1.12 (@vitest/mocker).
- Frontend build and test dependencies: undici 7.30.1, zod 4.6.7, fast-uri 3.1.9 and serialize-javascript 7.1.4 (pnpm overrides). None of them ship in the image.

### Fixed
- The plant page's photo was forced square and stretched, with mismatched corners under its date caption (a card style leaked onto it).
- Identifying from a plant card no longer blanks the whole list while it runs; the identification dialog's close button no longer overlaps its title and is a real button.
- Uploading a photo or identifying a plant or crop showed no progress outside the plant page's AI actions; the loading overlay now appears for every upload and identification (cards, plant and location pages, the header camera).
- Signed-out visitors saw a plant's species as the page title instead of its name.
- "Due tomorrow" in amber was hard to read on the light theme.
- Care help and AI descriptions with Claude failed since the anthropic SDK 1.x bump (`temperature` is no longer accepted).
- The OpenAI provider failed on every request since the openai SDK 1.x bump (`openai.ChatCompletion` was removed).
- Long care advice was cut off; the answer limit is higher now.
- Generating a description with a newer Claude model saved an empty text: thinking used up the answer limit. The limit is higher now, and an empty answer is reported as an error.
- After editing a plant, its page showed "Water today" until reloaded (the update didn't return the last watering).
- "Water now" and "Fertilize" on the plant page also showed "Water today" until reloaded, and the new time an hour off when the browser's timezone differed from the server's.
- The note dialogs on the plant and location pages now close with Escape and return focus to their button.
- Manage → Plants could break when the sign-in state changed while it was open (a hook ran conditionally).
- More changes show without reloading the page: changing tags no longer blanks the care advice and outdoor settings; picking a species after identifying updates the page (and the card) once it's saved, with an error if it isn't; a new photo is shown right after uploading instead of the previous one; deleting a photo updates the activity feed and calendar; a saved profile shows its new name at once; refreshing a location after an edit no longer blanks the page.
- Lists and pages no longer show cached data when the server takes more than 3 seconds to answer; the cache is only used offline.
- Uploading the same photo twice in a row did nothing the second time.
- The calendars marked days one day off when the browser's timezone differed from the server's `TZ`.
- Pull to refresh reloaded the page twice.
- The identify button on location cards showed without a Pl@ntNet key.
- A white line ran along the bottom of every page (the focus ring of the page area after navigating).
- Location hashtags dropped umlauts (`#kr_uterbeet`), and a tag with capital letters couldn't be removed.

## [1.2.0] - 2026-10-22

### Added
- MCP endpoint (`MCP_ENABLED`) with built-in OAuth or an external OAuth server (`MCP_OAUTH_ISSUER`).
- Separate MCP sign-in via any OIDC provider or GitHub (`MCP_LOGIN_PROVIDER`).
- Floor plans: upload plans of your home, place plants on them and see which need water
  (third view on the Plants page). Admins switch it on under Manage → Floor plans; plans
  and their addresses are visible to signed-in members only.
- `AI_ENABLED` and `LLM_ENABLED` switches.
- List view for the Plants and Locations pages (grid/list toggle, remembered per device),
  built for phones: compact rows with thumbnail and quick water/upload buttons.
- Per-plant watering schedule ("water every N days") on the plant detail page and in the
  Add Plant dialog. Due plants show a badge and appear under the automatic `#needs_water`
  filter, which combines with a regular tag (e.g. `#office` + `#needs_water`). New "Due"
  sort option. MCP `list_plants` gains a `needs_water` filter.

### Changed
- Backend runs on Python 3.14 (image `python:3.14-slim`); dependency versions unchanged.
- Request bodies over `MAX_UPLOAD_MB` (default 30) are refused before they are parsed.
- Identification buttons are hidden without a PlantNet key.
- Login returns to the requested page (`?next=`).

### Fixed
- LLM endpoints returned 500 when no provider was configured; now 404.
- **Security:** frontend image updated to pnpm 10.34.7 (from 10.33.0) and nginx 1.31
  (mainline, from 1.30). pnpm 10.33.0 is affected by the advisories fixed in 10.34.x,
  including path traversal and lockfile integrity bypasses during install.

## [1.1.1] - 2026-10-19

### Added

### Changed

### Fixed
- Frontend container build. `pnpm-lock.yaml` still recorded the pre-bump vite range
  in its `overrides` block, which `pnpm install --frozen-lockfile` rejects.

## [1.1.0] - 2026-10-19

### Added
- `OIDC_REQUIRE_VERIFIED_EMAIL` (default `true`) controls whether OIDC logins need a
  verified email.
- *Visibility* field on the location detail page (`private` / `shared` / `public`).
- `GET /api/config` reports the running `version`.
- `ENABLE_API_DOCS` to turn Swagger UI, ReDoc and `/openapi.json` back on.

### Changed
- **Breaking for OIDC:** sign-in is refused unless the identity provider sends
  `email_verified=true`. authentik 2025.10 and later send `false` by default: map a
  verified claim in authentik, or set `OIDC_REQUIRE_VERIFIED_EMAIL=false` if your users
  cannot change their own email address at the IdP.
- Auth cookies now default to `SameSite=Lax` (previously `None` over HTTPS). Set
  `COOKIE_SAMESITE` only if the frontend and API are served from different sites.
- **Location visibility is now enforced** (see README → Access and visibility).
  `private` locations — the default, and every location created so far — are no
  longer shown to share-link viewers; set them to `shared` or `public` to keep sharing.
- API docs are off by default; set `ENABLE_API_DOCS=true` to enable them.

### Fixed

### Security
- Require a session or a valid share link to read plants, tags, locations and
  statistics when `SHOW_PROTECTED_VIEW=true`. These endpoints were readable anonymously.
- Lock an account for 15 minutes after 10 failed logins, and give unknown usernames the
  same response time as wrong passwords.
- Refuse upload paths that only share a name prefix with the upload folder (e.g.
  `uploads_backup`).
- Block cross-site form submissions from acting as a logged-in user (`SameSite=Lax`).
- Stop linking OIDC logins to existing accounts through unverified email addresses.
- Require a session or a valid share link to load uploaded photos when
  `SHOW_PROTECTED_VIEW=true`. `/api/uploads` previously served every file anonymously.
- Hide `private` locations and their photos from share-link viewers, and everything but
  `public` locations from anonymous visitors.
- Pin GitHub Actions to commit SHAs, so a moved or hijacked tag can't change what CI runs.

## [1.0.6] - 2026-08-21

### Added

### Changed

### Fixed

### Security
- Require admin authentication to create users. `POST /api/users/` accepted
  unauthenticated requests and honoured a client-supplied role, so anyone could
  create themselves an admin account and then simply log in.
- Restrict role changes to admins. Any authenticated user could previously promote
  themselves to admin via `PUT /api/users/{id}`.
- Require authentication for every state-changing endpoint across plants, tags and
  locations. These previously accepted anonymous writes and deletes whenever
  `AUTH_MODE` was `local` or `oidc`.
- Enforce share links as read-only. A share token no longer authorises writes.

## [1.0.5] - 2026-07-27

### Added

### Changed

### Fixed
- Fix plant identification failing on optimized photos

## [1.0.4] - 2026-07-24

### Added

### Changed
- Update backend and frontend dependencies

### Fixed
- Keep the sort direction toggle inline with its dropdown
- Fix the frontend container build failing on a stale lockfile

## [1.0.3] - 2026-06-25

### Added
- Remember plant and location filter and sort selections

### Changed
- Update backend and frontend dependencies

### Fixed

## [1.0.2] - 2026-06-07

### Added
- Admin audit log of write actions and auth events

### Changed

### Fixed

## [1.0.1] - 2026-06-06

### Added

### Changed
- Update backend and frontend dependencies

### Fixed
- Hecate badge now links to its scan page

## [1.0.0] - 2026-05-11

Initial tagged release. Establishes the baseline for the semantic versioning timeline.
All prior development history is captured in the git log; future changes will be
tracked here.

### Added
- Release pipeline with semver image tags and SECURITY policy

### Changed

### Fixed