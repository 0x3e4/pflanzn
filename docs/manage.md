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
| **Customize** | everyone | Your own settings, stored with your account. See [Customize](#customize) below. |
| **Weather** | everyone | Weather zones (a place with coordinates) for [rain watering](guide/plants.md#rain-counts-as-watering), the latest weather checks and the plants watered by rain. |
| **Integrations** | admins | [Notifications](notifications.md) (where they go, reminders on or off, the daily watering digest and its time, *Send a test*), how many Pl@ntNet identifications are left today, and the configured AI providers with their models. |
| **Share** | admins | Read-only [share links](access.md#share-links), with or without an expiry. Needs accounts and `SHOW_PROTECTED_VIEW=true`. |
| **Floor plans** | members | Upload and order [floor plans](guide/locations.md#floor-plans); an admin switches the feature on here. |
| **MCP** | members | The [MCP](mcp.md) server address, how to connect a client, and the apps you connected (revoke them here). Shown with `MCP_ENABLED=true`. |
| **Support** | everyone | Version, links to the docs, what's new and the source, and ways to support the project. |

On a desktop Manage is wider than the other pages (up to 1760px), so the tables have room on
large, 2K and 4K screens; the settings forms keep a reading width.

## Customize

Everyone's own settings. With accounts they are stored with your account and follow you to other
devices (on the next sign-in or reload); with `AUTH_MODE=no` they stay in the browser. Changes apply
at once.

| Group | Settings |
| --- | --- |
| **Appearance** | Theme: *System* (follows the device), *Light* or *Dark*; the sun/moon button in the navigation switches it too. Density: *Compact* makes tables and list rows tighter and grid cards smaller. *Reduce motion* turns off animations and transitions (they are also off when the device asks for less motion). |
| **Start page and lists** | The page the app opens with: Home, Plants or Locations (after sign-in, too). The view (grid or list) and sort that Plants and Locations start with on a device, and widescreen by default. Changing view or sort on the page itself is remembered on that device; a new default here also applies on the device you set it on. |
| **Home** | Which Home sections are shown: Coming up, Reminders, the figures, Recently photographed, Lately, Care rhythm and Areas. |
| **Activity feed** | Which types a plant's activity feed shows at first (at least one). The chips above the feed still change it, remembered per browser. |
| **Date and time** | Date format (the server's `LOCALE` or English, German, French, Italian, Spanish or Dutch variants), a 24- or 12-hour clock, and the first day of the week in the calendars. Times stay in the server's `TZ`. |
| **Photos** | Image quality. *Automatic* lets the browser pick the size by screen: the 300px preview on ordinary screens, the 800px one on HiDPI, 2K and 4K screens, and the full size for the main photo when that is sharper. *Data saver* always loads the smallest; *High* loads larger previews and the full-size main photo. Uploads are stored the same way regardless (WebP, at most 2000px wide); full-screen always shows that size. |
| **AI** | The AI provider the AI buttons use without asking. Shown only with more than one provider configured. |

*Logout* at the bottom signs you out and removes the app's offline copies from the browser.
