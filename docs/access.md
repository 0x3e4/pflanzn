# Access & Visibility

## Sign-in modes

`AUTH_MODE` decides how people sign in:

| Mode | How it works |
| --- | --- |
| `no` | No accounts. Everyone who reaches the app can read and edit. For a private network only. |
| `local` | Accounts in Pflanzn: JWT, Argon2 password hashes, Redis-backed sessions with theft detection (IP and browser are checked). The first admin comes from `ADMIN_USER`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`. |
| `oidc` | Sign-in through your identity provider (authentik, Keycloak, Zitadel, …) with `OIDC_PROVIDER_URL`, `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET`. Accounts are matched by email, verified by default (`OIDC_REQUIRE_VERIFIED_EMAIL`). |

Admins manage users under Manage → Users.

## Who can read the collection

With accounts, `SHOW_PROTECTED_VIEW` decides what anonymous visitors see:

| Reader | `AUTH_MODE=no` | `local` / `oidc`, `SHOW_PROTECTED_VIEW=true` (default) | `local` / `oidc`, `SHOW_PROTECTED_VIEW=false` |
| --- | --- | --- | --- |
| Logged-in user | — | Read and edit everything | Read and edit everything |
| Share-link viewer | — (sharing needs auth) | Read-only | Read-only (existing links work; new ones can't be created in this mode) |
| Anonymous visitor | Read and edit everything | Login screen, no data | Read-only |

Plants, tags, notes, care advice and statistics have no visibility of their own: whoever may read
the collection sees all of them. Photos follow the same rules. Read-only visitors don't see editing
controls; each page shows a "Sign in to …" line instead.

## Share links

Under Manage → Share you create token links to a read-only view of the collection, for a friend
who waters while you are away or for showing off. A link can expire after a set time or never,
and can be deleted at any time.

## Locations

Locations carry a visibility status, set in the *Visibility* field of a location's page:

| Status | Visible to |
| --- | --- |
| `private` (default) | Logged-in users only |
| `shared` | Logged-in users and share-link viewers |
| `public` | Everyone who may read the collection, including anonymous visitors when `SHOW_PROTECTED_VIEW=false` |

A location's photos, tags, notes and harvest times are hidden along with it. With `AUTH_MODE=no`
there are no logins, so every location is visible to everyone regardless of its status.

> [!NOTE]
> Until 1.0.6 the status was only a label and was not enforced, so every location was visible to
> share-link viewers. Locations created through the app were always `private`, which means they
> disappear from share links after upgrading until you set them to `shared` or `public`.

The installed PWA keeps viewed photos in its offline cache for up to 30 days, so a location made
private later may still show on a device that already loaded it.

## Audit log

Every write and every sign-in event is recorded in an immutable log (`AUDIT_ENABLED`). Admins read
it under Manage → Audit, with filters for action, entity, user and date, and a free-text search.
Writes made through [MCP](mcp.md) are logged with the account and the plants they touched.
