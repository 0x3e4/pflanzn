# Changelog

All notable changes to Pflanzn will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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