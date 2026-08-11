# MCP OAuth setup

HAProxy Editor exposes its Streamable HTTP MCP server at:

```text
https://api.haproxy.system.elylan/mcp
```

The server uses the MCP SDK 2.x and automatically negotiates every SDK-supported revision. Clients implementing MCP `2026-07-28` use stateless `server/discover` and per-request metadata; older clients may continue to use the `initialize` handshake. The server does not emit `Mcp-Session-Id`.

## Managed-route API

The MCP surface contains seven tools:

- `haproxy-editor_discover`
- `haproxy-editor_list`
- `haproxy-editor_get`
- `haproxy-editor_create`
- `haproxy-editor_update`
- `haproxy-editor_delete`
- `haproxy-editor_history`

Tool results use native MCP structured content and advertise output schemas. Mutation tools carry MCP read-only, destructive, idempotent, and closed-world annotations so clients can apply their own permission prompts.

Only routes created through this managed subsystem can be updated or deleted. Any authenticated principal holding the manager role may mutate any managed route. Native HAProxy rules remain outside this CRUD surface.

Every mutation appends an immutable event to MongoDB collection `exposure_events`. `ExposureResource` contains `version`, `created: { at, by }`, and nullable `updated: { at, by }`; `updated` is `null` until the first replacement. Deleted routes disappear from list/get but remain available through history. The previous `exposures` collection is not migrated and can be removed manually because the old implementation was never deployed.

The equivalent REST escape hatch remains available under `/exposures`, including:

```text
GET /exposures/history?exposureId={guid}&cursor={opaque-cursor}&limit={1..100}
```

History is newest-first, defaults to 50 events, and returns at most 100 events per page.

The MCP server uses user-delegated OAuth through the internal Keycloak realm. Codex and Claude Code share one pre-registered public client:

| Setting | Value |
|---|---|
| Keycloak issuer | `https://auth.elyspio.fr/realms/internal` |
| OAuth client ID | `i-shared-mcp` |
| MCP resource/audience | `https://api.haproxy.system.elylan/mcp` |
| Required scope | `haproxy:quickmap:manage` |
| Required client role | `haproxy:quickmap:manage` |
| Protected-resource metadata | `https://api.haproxy.system.elylan/.well-known/oauth-protected-resource/mcp` |

The existing UI/API OIDC settings are separate. `McpOAuth` controls only the MCP and exposure-management endpoints.

## Configure Keycloak

Perform these steps in the `internal` realm.

### Create the public client

Create an OpenID Connect client with these settings:

- Client ID: `i-shared-mcp`
- Client authentication: **Off** (public client)
- Standard flow: **On**
- Direct access grants: **Off**
- Implicit flow: **Off**
- PKCE method: **S256**
- Consent required: **On**
- Web origins: leave empty

Register both redirect URIs:

```text
http://127.0.0.1:4321/callback/*
http://localhost:8080/callback
```

The first URI is deliberately restricted to one loopback address, port, and path prefix. Codex appends a server-specific callback identifier. Claude Code uses the second exact callback URI.

Loopback HTTP is expected for installed/native OAuth clients. The authorization code never leaves the workstation, is short-lived and single-use, and cannot be redeemed without the PKCE verifier held by the client. Do not replace these callbacks with self-signed HTTPS.

### Create the administrator role

Under the `i-shared-mcp` client, create this client role:

```text
haproxy:quickmap:manage
```

Assign it only to the users or administrator group allowed to manage HAProxy mappings. Keycloak emits client roles under:

```json
{
  "resource_access": {
    "i-shared-mcp": {
      "roles": ["haproxy:quickmap:manage"]
    }
  }
}
```

### Bind the scope to the MCP audience

Create an optional client scope named:

```text
haproxy:quickmap:manage
```

Configure it as follows:

1. Enable **Include in token scope**.
2. Add an **Audience** protocol mapper.
3. Set **Included Custom Audience** to `https://api.haproxy.system.elylan/mcp`.
4. Add the `i-shared-mcp` client role `haproxy:quickmap:manage` to the scope's role scope mappings.
5. Link the scope to `i-shared-mcp` as an **Optional** client scope.
6. On the client's dedicated scope, turn **Full scope allowed** off.

Use the Keycloak client-scope evaluator with an authorized user and the requested `haproxy:quickmap:manage` scope. The generated access token must contain all of:

```json
{
  "iss": "https://auth.elyspio.fr/realms/internal",
  "aud": "https://api.haproxy.system.elylan/mcp",
  "azp": "i-shared-mcp",
  "scope": "openid haproxy:quickmap:manage",
  "resource_access": {
    "i-shared-mcp": {
      "roles": ["haproxy:quickmap:manage"]
    }
  }
}
```

Keycloak currently does not bind RFC 8707 `resource` parameters into tokens itself. The optional scope and audience mapper above are Keycloak's documented compatibility mechanism: MCP clients still send the canonical `resource`, while the requested scope causes Keycloak to issue a token whose `aud` is that resource URL.

## Configure the API

The checked-in defaults are in `Haproxy.Editor.Api/Haproxy.Editor.WebApi/appsettings.json`:

```json
{
  "McpOAuth": {
    "Issuer": "https://auth.elyspio.fr/realms/internal/",
    "Resource": "https://api.haproxy.system.elylan/mcp",
    "MetadataPath": "/.well-known/oauth-protected-resource/mcp",
    "ClientId": "i-shared-mcp",
    "Scope": "haproxy:quickmap:manage",
    "Role": "haproxy:quickmap:manage"
  }
}
```

Deployment configuration can override these values with standard ASP.NET Core environment variables, for example:

```text
McpOAuth__Issuer
McpOAuth__Resource
McpOAuth__MetadataPath
McpOAuth__ClientId
McpOAuth__Scope
McpOAuth__Role
```

The API validates the token signature, issuer, lifetime, canonical resource audience, authorized client ID (`azp` or `client_id`), requested scope, and Keycloak client role. A missing or invalid token produces a `401` challenge containing `resource_metadata`; an authenticated token without the required client, scope, or role produces `403 insufficient_scope`.

## Configure Codex

Add this to `~/.codex/config.toml`:

```toml
mcp_oauth_callback_port = 4321
mcp_oauth_callback_url = "http://127.0.0.1:4321/callback"

[mcp_servers.haproxy-editor]
url = "https://api.haproxy.system.elylan/mcp"
auth = "oauth"
scopes = ["haproxy:quickmap:manage"]
oauth_resource = "https://api.haproxy.system.elylan/mcp"
```

Then authenticate:

```bash
codex mcp login haproxy-editor
```

Codex opens the system browser, stores the resulting OAuth credentials in its configured credential store, and attaches the access token to every MCP HTTP request.

JWT access tokens remain in the MCP client's native credential store. Do not put bearer tokens in a reusable agent skill or curl command checked into source control.

## Configure Claude Code

Register the server as a user-scoped HTTP MCP server:

```bash
claude mcp add --transport http \
  --scope user \
  --client-id i-shared-mcp \
  --callback-port 8080 \
  haproxy-editor https://api.haproxy.system.elylan/mcp
```

Do not provide a client secret. In Claude Code, run `/mcp`, select `haproxy-editor`, and authenticate in the browser.

## Verify discovery and challenges

Protected-resource metadata must be publicly readable:

```bash
curl -sS https://api.haproxy.system.elylan/.well-known/oauth-protected-resource/mcp
```

Expected shape:

```json
{
  "resource": "https://api.haproxy.system.elylan/mcp",
  "authorization_servers": ["https://auth.elyspio.fr/realms/internal"],
  "scopes_supported": ["haproxy:quickmap:manage"],
  "bearer_methods_supported": ["header"]
}
```

An unauthenticated request must return `401` and advertise the metadata document:

```bash
curl -i https://api.haproxy.system.elylan/mcp
```

The response must contain:

```text
WWW-Authenticate: Bearer resource_metadata="https://api.haproxy.system.elylan/.well-known/oauth-protected-resource/mcp", scope="haproxy:quickmap:manage"
```

## References

- [MCP 2026-07-28 overview](https://blog.cloudflare.com/mcp-v2/)
- [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [Keycloak MCP authorization-server integration](https://www.keycloak.org/securing-apps/mcp-authz-server)
- [OAuth for native applications (RFC 8252)](https://www.rfc-editor.org/rfc/rfc8252)
- [PKCE (RFC 7636)](https://www.rfc-editor.org/rfc/rfc7636)
- [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp)
- [Claude Code MCP authentication](https://code.claude.com/docs/en/mcp)
