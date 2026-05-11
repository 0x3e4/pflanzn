# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Pflanzn, please report it **privately** to:

**[security@pflanzn.app](mailto:security@pflanzn.app)**

Do **not** open a public GitHub issue, pull request, or discussion thread for
security reports — premature disclosure may put users at risk before a fix is
available.

### What to include

A useful report contains:

- A description of the vulnerability and its potential impact
- The affected component (backend, frontend) and version (from the GitHub
  release tag, the deployed image tag, or `GET /openapi.json` → `info.version`)
- Steps to reproduce, ideally a minimal proof-of-concept
- Your assessment of severity (CVSS vector is welcome but not required)
- Whether the vulnerability is already public or known to be exploited
- How you would like to be credited in the eventual advisory (or anonymous)

### What to expect

- **Acknowledgement** within 3 business days
- **Initial triage** (severity, affected versions, scope) within 7 business days
- **Status updates** at least every 14 days while the report is open
- A **GitHub Security Advisory** published in this repository once a fix is available

Disclosure is coordinated with the reporter. Typical embargo windows are
30–90 days from triage, longer if a fix requires upstream coordination.
Critical issues with active exploitation may be disclosed faster after a fix
is shipped.

## Supported Versions

Security fixes are issued **only for the latest released major.minor line**.
There are no backports to older minors, and no extended support for older
majors — not even for critical vulnerabilities. To stay protected, keep
running the most recent release.

| Version              | Supported |
|----------------------|-----------|
| Latest `X.Y.*`       | yes       |
| Any older `X.Y.*`    | no        |

Container images: pin to the explicit semver tag (e.g.
`ghcr.io/0x3e4/pflanzn-{backend,frontend}:1.0.0`) and bump the pin when a new
release ships. `:latest` tracks `main` and is **not** a supported channel for
production.

## Scope

In scope:

- Backend API (FastAPI) — including auth (`local` / `oidc` / `no` modes),
  JWT + Redis session handling with theft detection, share-link tokens,
  and the image upload/serve pipeline
- Frontend (React SPA served by nginx) — including the PWA service worker
  and runtime config delivery via `/api/config`
- Container images published to `ghcr.io/0x3e4/pflanzn-*`
- Weather auto-watering loop and any code that performs outbound calls on
  behalf of the user (PlantNet, LLM providers, Open-Meteo, OpenWeatherMap)

Out of scope:

- Vulnerabilities in upstream services (PlantNet, Open-Meteo, OpenWeatherMap,
  OpenAI, Anthropic, Mistral, HuggingFace, Ollama) — report those to the
  respective project
- Vulnerabilities in third-party dependencies without a concrete exploit path
  in Pflanzn — report upstream
- Self-XSS, missing security headers without a concrete exploit path,
  and social-engineering reports targeting maintainers
- Issues that require an already-privileged admin account — Pflanzn trusts
  its configured operator by design
- Anything reachable only with `AUTH_MODE=no`, which is documented as an
  open-access mode for trusted networks

## Safe Harbor

Good-faith security research conducted under this policy is authorized. We
will not pursue legal action against researchers who:

- Report privately as described above
- Avoid privacy violations, service disruption, and data destruction
- Do not access or modify data beyond what is needed to demonstrate the issue
- Give us reasonable time to fix before any public disclosure