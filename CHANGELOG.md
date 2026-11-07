# Changelog

All notable changes to Pflanzn will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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