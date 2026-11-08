# Configuration

Everything is set through environment variables in `.env`, read by the **backend** at runtime. The
frontend fetches its settings from `GET /api/config`, so the prebuilt images work in every setup
without a rebuild. A change needs a restart of the backend, not a new image. The full annotated list
is in [`.env.example`](https://github.com/0x3e4/pflanzn/blob/main/.env.example).

## General

| Variable | Default | What it controls |
| --- | --- | --- |
| `SECRET_KEY` | — | Signs sessions and tokens. Set a long random value. |
| `TZ` | `UTC` | Time zone for dates and the watering schedule. |
| `LOCALE` | `en-US` | Date and number format in the app. |
| `DOMAIN` | — | The public URL, for example `https://plants.example.com`. Links, OAuth and MCP are built from it. |

## Authentication

| Variable | Default | What it controls |
| --- | --- | --- |
| `AUTH_MODE` | `no` | `no` (open), `local` (accounts in Pflanzn) or `oidc` (your identity provider). See [Access & Visibility](access.md). |
| `SHOW_PROTECTED_VIEW` | `true` | With accounts: `true` shows anonymous visitors the login screen, `false` lets them read. |
| `ADMIN_USER`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | — | The first admin account, created on start when there is none. |
| `OIDC_NAME` | — | Name on the sign-in button. |
| `OIDC_PROVIDER_URL` | — | Issuer URL of your identity provider. |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | — | The client at your identity provider. |
| `OIDC_REQUIRE_VERIFIED_EMAIL` | `true` | Refuse logins unless the provider says the email is verified. authentik 2025.10 and later sends `false` by default: map a verified claim there, or set this to `false` if users cannot change their own email. |

## Database and cache

| Variable | Default | What it controls |
| --- | --- | --- |
| `DB_HOST`, `DB_PORT` | `pflanzn-mariadb-1`, `3306` | MariaDB server. |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | `pflanzn`, —, `plants_db` | Database account and name. |
| `DB_ROOT_PASSWORD` | — | Used by the MariaDB container on first start. |
| `REDIS_URL` | `redis://pflanzn-redis-1:6379/0` | Sessions and OAuth state. |

## Features

| Variable | Default | What it controls |
| --- | --- | --- |
| `ENABLE_LOCATIONS` | `false` | The [locations](guide/locations.md) section. |
| `AUDIT_ENABLED` | `true` | The audit log under Manage → Audit. |
| `MAX_UPLOAD_MB` | `30` | Largest accepted upload. Match `client_max_body_size` in your reverse proxy. |
| `ENABLE_API_DOCS` | `false` | Swagger UI at `/api/docs`, ReDoc and `/openapi.json`. They map the whole API, so leave them off in production. |

Floor plans are switched on by an admin in the app (Manage → Floor plans), not here.

## AI and identification

| Variable | Default | What it controls |
| --- | --- | --- |
| `AI_ENABLED` | `true` | Master switch: `false` turns off AI texts, identification and MCP. |
| `LLM_ENABLED` | `true` | AI care advice and descriptions. Needs a provider key. |
| `LLM_LANGUAGE` | `german` | Language of the AI texts. |
| `CARE_WEB_SEARCH` | `true` | Claude and OpenAI may search the web for care advice (extra cost per request). |
| `PLANTNET_API_KEY` | — | Species identification through Pl@ntNet. |
| `PLANTNET_LANGUAGE` | `en` | Language of the Pl@ntNet species links. |

The provider keys are listed under [Identification & AI](guide/ai.md#providers). The MCP
variables are explained in the [MCP guide](mcp.md#enabling-the-server).

## Weather

| Variable | Default | What it controls |
| --- | --- | --- |
| `WEATHER_ENABLED` | `true` | The rain check that waters outdoor plants automatically. Uses Open-Meteo, no key needed. |
| `WEATHER_CHECK_INTERVAL_HOURS` | `1` | How often the rain check runs. |
| `WEATHER_RAINFALL_THRESHOLD_MM` | `10.0` | Rain above this counts as watering for plants marked *reaches rain*. |
| `OPENWEATHERMAP_API_KEY` | — | Optional: shows the current weather. |

## Frontend container

These are set on the **frontend** container, not the backend.

| Variable | Default | What it controls |
| --- | --- | --- |
| `DOCS_UPSTREAM` | `http://docs:80` | Where `/docs/` is forwarded, see [Documentation site](getting-started.md#documentation-site). |
| `DOCS_RESOLVER` | `127.0.0.11` | DNS server nginx uses to find the docs container (Docker's own by default). |

> [!NOTE]
> Older `VITE_*` names (`VITE_DOMAIN`, `VITE_AUTH_MODE`, …) still work as fallbacks, but they are
> misleading: the backend reads these variables at runtime, Vite never sees them. New deployments
> should use the names without the prefix.
