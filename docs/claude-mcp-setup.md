# Configure the HAProxy Editor MCP server in Claude Code

HAProxy Editor exposes a remote Streamable HTTP MCP server protected by OAuth. This guide configures it for the current user in Claude Code.

## Prerequisites

- Claude Code is installed.
- You can configure the Keycloak `internal` realm, or a Keycloak administrator can complete that section for you.

## Configure Keycloak

Configure the client in the `internal` realm at `https://auth.elyspio.fr/realms/internal`.

### Create the public client

Create an OpenID Connect client with these settings:

| Setting | Value |
|---|---|
| Client ID | `i-shared-mcp` |
| Client authentication | Off |
| Standard flow | On |
| Direct access grants | Off |
| Implicit flow | Off |
| Service account roles | Off |
| Consent required | On |
| PKCE method | `S256` |
| Valid redirect URI | `http://localhost:8080/callback` |
| Web origins | Empty |

The redirect URI must be exact; do not add a wildcard. This is a public native client, so do not create or distribute a client secret. Loopback HTTP is expected because OAuth protects the authorization code with PKCE.

### Create and assign the manager role

Under **Clients > i-shared-mcp > Roles**, create the client role:

```text
haproxy:quickmap:manage
```

Assign this role to each user or group allowed to manage HAProxy exposures. Keycloak must emit it under the MCP client in `resource_access`:

```json
{
  "resource_access": {
    "i-shared-mcp": {
      "roles": ["haproxy:quickmap:manage"]
    }
  }
}
```

### Create the OAuth scope and audience

Create a client scope named `haproxy:quickmap:manage`, then:

1. Enable **Include in token scope**.
2. Add an **Audience** protocol mapper with **Included Custom Audience** set to `https://api.haproxy.system.elylan/mcp`.
3. Add the `i-shared-mcp` client role `haproxy:quickmap:manage` to the scope's role scope mappings.
4. Link the scope to `i-shared-mcp` as an **Optional** client scope.
5. In the client's dedicated scope, turn **Full scope allowed** off.

Use Keycloak's client-scope evaluator with an authorized user and the `haproxy:quickmap:manage` scope. The access token must contain:

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

## Register the server

Run:

```bash
claude mcp add --transport http \
  --scope user \
  --client-id i-shared-mcp \
  --callback-port 8080 \
  haproxy-editor https://api.haproxy.system.elylan/mcp
```

This creates a user-scoped configuration, so the server is available from every Claude Code project. The OAuth client is public; do not provide a client secret.

## Authenticate

Run:

```bash
claude mcp login haproxy-editor
```

Complete the Keycloak sign-in and consent flow in the browser. Alternatively, run `/mcp` inside Claude Code, select `haproxy-editor`, and authenticate when prompted.

## Verify the connection

Run:

```bash
claude mcp get haproxy-editor
claude mcp list
```

The server should be connected and expose the `haproxy-editor_*` tools. You can then ask Claude to list, inspect, create, update, delete, or review the history of managed HAProxy exposures.

## Troubleshooting

- `redirect_uri` error: ensure Keycloak contains the exact URI `http://localhost:8080/callback` and port `8080` is available locally.
- `401 Unauthorized`: reauthenticate with `claude mcp logout haproxy-editor`, followed by `claude mcp login haproxy-editor`.
- `403 Forbidden`: ask a Keycloak administrator to verify the client role and optional scope `haproxy:quickmap:manage` for your account.
- Connection failure: verify that `https://api.haproxy.system.elylan/mcp` is reachable from your network.

For server-side Keycloak, OAuth, and API configuration, see [MCP OAuth setup](mcp-oauth.md). For general client behavior, see the [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).
