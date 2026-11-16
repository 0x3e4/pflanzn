# Manage

**Manage** (in the navigation, or *More* on a phone) holds your profile, the admin tools and the
settings. Which sections you see depends on your role: with `AUTH_MODE=no` there are no roles and
everyone sees everything; with accounts, the *Management* group and the admin settings are for
admins only.

On a phone the sections sit in a strip that scrolls sideways. Some sections can be opened directly
with `/manage?section=…`: `statistics`, `weather`, `integrations`, `floorplans`, `mcp`, `customize`
and `support`.

## Details

| Section | What it does |
| --- | --- |
| **Profile** | Your username and email. With `AUTH_MODE=local` you change them and your password here; with OIDC they come from your identity provider. Not shown with `AUTH_MODE=no`. |

## Management (admins)

| Section | What it does |
| --- | --- |
| **Statistics** | Totals, the watering status of the collection, a year of care, waterings per week, tags, species and the most cared-for plants. See [Statistics](guide/plants.md#statistics). |
| **Users** | Create, edit and delete accounts and set who is admin. The default admin from `ADMIN_USER` can't be changed here. Not shown with `AUTH_MODE=no`. |
| **Audit** | Every write and sign-in, newest first. Filter by action and entity (the lists offer what actually occurs in the log, including MCP tools), by date, or search path and user; open a row for its details. See [Audit log](access.md#audit-log). |
| **Plants** | All plants in a table: rename, edit tags, archive or restore, delete, open. |
| **Locations** | The same for locations (with `ENABLE_LOCATIONS=true`). |
| **Tags** | Create, rename and delete tags, and see or change which plants have a tag. |
| **Map** | Every location on one map (with `ENABLE_LOCATIONS=true`). |
| **Identification** | Past Pl@ntNet identifications with their photos and results, by day; delete the ones you don't need. |
| **Waterings** | The newest waterings, by hand and by rain, with batch delete, for cleaning up mistakes. |

## Settings

| Section | Who | What it does |
| --- | --- | --- |
| **Customize** | everyone | Layout defaults, e.g. widescreen by default for Plants and Locations. Stored with your account. |
| **Weather** | everyone | Weather zones (a place with coordinates) for [rain watering](guide/plants.md#rain-counts-as-watering), the latest weather checks and the plants watered by rain. |
| **Integrations** | admins | [Notifications](notifications.md) (where they go, reminders on or off, the daily watering digest and its time, *Send a test*), how many Pl@ntNet identifications are left today, and the configured AI providers with their models. |
| **Share** | admins | Read-only [share links](access.md#share-links), with or without an expiry. Needs accounts and `SHOW_PROTECTED_VIEW=true`. |
| **Floor plans** | members | Upload and order [floor plans](guide/locations.md#floor-plans); an admin switches the feature on here. |
| **MCP** | members | The [MCP](mcp.md) server address, how to connect a client, and the apps you connected (revoke them here). Shown with `MCP_ENABLED=true`. |
| **Support** | everyone | Version, links to the docs, what's new and the source, and ways to support the project. |

*Logout* at the bottom signs you out and removes the app's offline copies from the browser.
