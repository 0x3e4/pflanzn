# Changelog

All notable changes to Pflanzn will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Pl@ntNet link next to a plant's species, in `PLANTNET_LANGUAGE`.
- The AI care helper looks at the three latest photos and the plant's notes, fertilizing, location, watering plan and last advice, and uses facts from the species' Pl@ntNet page. Answers come in four sections: diagnosis, likely causes, what to do now, what to watch for.
- With Claude or OpenAI, the care helper can also search the web; Claude also reads pages (`CARE_WEB_SEARCH`, on by default). OpenAI care advice now uses the Responses API.

### Changed
- Care advice in the activity feed shows its sections as headings and the steps as a numbered list; it opens on the diagnosis, the rest is one tap away.
- Floor plan: markers that would overlap are shown as one, with a count, led by the plant that needs water most; tap it to zoom in. Markers get smaller on phone-sized plans, and the zoom buttons (now with a reset) sit top right, clear of the bottom navigation.

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
- Care help and AI descriptions with Claude failed since the anthropic SDK 1.x bump (`temperature` is no longer accepted).
- The OpenAI provider failed on every request since the openai SDK 1.x bump (`openai.ChatCompletion` was removed).
- Long care advice was cut off; the answer limit is higher now.
- After editing a plant, its page showed "Water today" until reloaded (the update didn't return the last watering).

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