# MCP Server

Pflanzn ships a built-in **Model Context Protocol (MCP)** server, so an AI assistant like Claude
(claude.ai, Claude Desktop, the Claude Code CLI) or any other MCP client can work with your plant
collection in plain language. Instead of opening the app to check what is due, you ask your assistant
"*which plants need water today?*", and it reads Pflanzn directly. If you allow it, it also logs
the watering for you.

The server is mounted at **`/api/mcp`** on the same host as the rest of Pflanzn. It has 15 tools:
seven that read (plants, photos, tags, the care log, collection figures, garden locations) and
eight that write (log waterings and fertilizing, add notes and care advice, create and edit plants,
set tags, archive). **No tool deletes anything.**

Authentication is **OAuth 2.1**, with no static API key. Pflanzn runs its own authorization server
with Dynamic Client Registration, Authorization Code and PKCE. By default you sign in with your
normal Pflanzn login. You can also send the sign-in to another provider, or use an external
OAuth/OIDC server like authentik. Every connection is tied to a real Pflanzn account, and every write
lands in the audit log.

You'll find the server URL for your instance, with a copy button, under **Manage → MCP**. That page
also checks that OAuth discovery reaches the backend and lists the connected apps, which you can
revoke there.

## Enabling the server

MCP is off by default. Two switches turn it on, both backend environment variables. Changing them
needs a backend restart but no image rebuild.

| Variable | Default | What it controls |
| --- | --- | --- |
| `MCP_ENABLED` | `false` | Turns the server on. |
| `AI_ENABLED` | `true` | Master switch for every AI feature. `false` turns MCP off too. |
| `DOMAIN` | — | The public URL of your instance. OAuth metadata and redirects are built from it; without it, the request's own URL is used. |
| `MCP_OAUTH_ISSUER` | — | Use an external OAuth/OIDC server instead of the built-in one. See [External OAuth server](#external-oauth-server). |
| `MCP_OAUTH_AUDIENCE` | — | Required with `MCP_OAUTH_ISSUER`: the client ID the tokens are issued for. |
| `MCP_LOGIN_PROVIDER` | — | Sign in to the built-in server with another provider instead of the app login: `oidc` or `github`. |
| `MCP_LOGIN_NAME` | — | Name on the sign-in button, for example `authentik`. |
| `MCP_LOGIN_OIDC_URL` | — | `oidc` only: the issuer URL, discovered via `/.well-known/openid-configuration`. |
| `MCP_LOGIN_CLIENT_ID` | — | Client ID at that provider. |
| `MCP_LOGIN_CLIENT_SECRET` | — | Client secret at that provider. |

### Reverse proxy

MCP clients discover the authorization server through two well-known documents. Your reverse proxy
has to send these to the backend, next to `/api`:

| Path | To |
| --- | --- |
| `/api/` | backend `:8000` |
| `/.well-known/oauth-*` | backend `:8000` |

If they end up at the frontend instead, Manage → MCP shows a warning. The full proxy examples
are in the [README](../README.md#reverse-proxy).

## How sign-in works

There are three modes. Pflanzn picks one from your configuration.

**Built-in (default).** Pflanzn is the authorization server. Your MCP client registers itself, you
are sent to Pflanzn's consent page, and you approve with your normal login. Access tokens last one
hour and refresh tokens 30 days. Clients that register but never get approved are removed after a
day. Registration is rate-limited (20 per hour per IP, 200 per hour in total).

**Built-in with a separate login.** Same as above, but the consent page signs you in with
`MCP_LOGIN_PROVIDER` instead of the app login. That is useful when the app uses local accounts but
you want MCP behind your identity provider, or the other way round. Register an app at the provider
with this callback:

```text
https://<your-host>/api/oauth/login/callback
```

For **GitHub**, create an OAuth App under *Settings → Developer settings → OAuth Apps* with that
callback, then set `MCP_LOGIN_PROVIDER=github`, `MCP_LOGIN_CLIENT_ID` and `MCP_LOGIN_CLIENT_SECRET`.
For any **OIDC** provider (authentik, Keycloak, Zitadel, Auth0, Google), register a client with the
callback and the `openid email profile` scopes, then set `MCP_LOGIN_PROVIDER=oidc`,
`MCP_LOGIN_OIDC_URL` and the client credentials. Accounts are matched to Pflanzn users by verified email.

**External OAuth server.** With `MCP_OAUTH_ISSUER` set, Pflanzn doesn't issue tokens. It checks
tokens from that server, which your MCP client gets directly. Set `MCP_OAUTH_AUDIENCE` to the
client ID the tokens are issued for. The token's email must belong to a Pflanzn account, and with
`OIDC_REQUIRE_VERIFIED_EMAIL` it must be verified. A token carrying `pflanzn:read` or
`pflanzn:write` scopes is limited to them. A plain OIDC token gets read and write access.

> [!WARNING]
> **Without sign-in (`AUTH_MODE=no`)**
> When the app itself runs without accounts and no external server is set, the MCP endpoint is open
> too: every caller can read **and** write, without a token. Manage → MCP warns about it. Only run
> it like that on a private network.

## Connecting a client

### Claude (claude.ai and Claude Desktop)

Open **Settings → Connectors → Add custom connector**, give it the name `Pflanzn` and the URL
`https://<your-host>/api/mcp`. Leave the OAuth Client ID and Secret fields **empty**, since Pflanzn
registers the client by itself. Click *Add*: a browser window opens Pflanzn's consent page. Sign in,
decide whether Claude may make changes, and click *Allow*.

### Claude Code

```bash
claude mcp add --transport http pflanzn https://<your-host>/api/mcp
```

On the first call Claude Code opens the browser for the same consent page. In Claude Code you can
also run `/mcp` to see the connection and sign in again.

### Other clients

Any client that speaks Streamable HTTP and MCP authorization works the same way: point it at
`https://<your-host>/api/mcp`. For a client without OAuth support, the `mcp-remote` bridge
runs the flow for it (it needs Node.js):

```json
{
  "mcpServers": {
    "pflanzn": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://<your-host>/api/mcp"]
    }
  }
}
```

The server answers with plain JSON responses and keeps no session, so there is no SSE stream to keep
open.

## Read and write

Reading is always granted. Writing is a choice you make on the consent page: the box *Make changes*
gives the client the `pflanzn:write` scope. Leave it unticked and the client only ever sees the read
tools. To change it later, revoke the app under Manage → MCP and connect it again.

The assistant picks the tools on its own from your question. You never name one yourself.

| Tool | Access | What it does |
| --- | --- | --- |
| `list_plants` | read | Plants with tags, outdoor flags, watering schedule and last watering and fertilizing. Filters by name, tag, indoor/outdoor and "needs water". |
| `get_plant` | read | One plant in full: description, tags, recent waterings, fertilizing, notes, latest care advice, photo ids. |
| `get_plant_photo` | read | A photo of a plant, so the assistant can look at it. |
| `list_tags` | read | All tags with the number of plants using each. |
| `get_overview` | read | Collection figures, the plants longest without water, and the latest rain check. |
| `get_recent_activity` | read | The care log of the last N days, for all plants or one. |
| `list_locations` | read | Garden locations with coordinates and descriptions (when locations are enabled). |
| `water_plants` | **write** | Log a watering for one or more plants, now or at a given time. |
| `fertilize_plants` | **write** | Log fertilizing for one or more plants. |
| `add_plant_note` | **write** | Add a note to a plant's timeline. |
| `add_care_advice` | **write** | Save care advice the assistant wrote, into the plant's care advice history. |
| `create_plant` | **write** | Add a plant with species, description, tags and watering interval. Photos are added in the app. |
| `update_plant` | **write** | Change name, species, description, outdoor/rain flags or watering interval. |
| `set_plant_tags` | **write** | Replace a plant's tags. Missing tags are created. |
| `set_plant_archived` | **write** | Archive a plant with a reason, or restore it. Its history stays. |

Every write is recorded in the audit log with the account, the tool and the plants it touched.

## Care advice from your assistant

The MCP tools never call Pflanzn's own AI provider. Your assistant reads what it needs (`get_plant`,
`get_plant_photo`, `get_recent_activity`), writes the advice with its own reasoning, and saves it
with `add_care_advice`. It then shows up on the plant page under *Care advice*, next to the
advice Pflanzn generated itself. This works without `LLM_PROVIDER` or any API key on the server.

## Example prompts

- *Which plants need water today?*
- *I just watered the monstera and both ficus, log that.*
- *Show me the latest photo of the peace lily. Does it look healthy?*
- *What did I do in the garden last week?*
- *Add a new plant: Calathea orbifolia, tag it living room, water every 5 days.*
- *Look at the rubber plant's history and photo, write care advice and save it.*
- *Archive the basil, it didn't survive the winter.*

> [!TIP]
> **Keep it behind TLS**
> OAuth only protects the tokens if the connection is encrypted. Run Pflanzn behind HTTPS, and if
> you don't need MCP from outside, restrict `/api/mcp` at the reverse proxy.
