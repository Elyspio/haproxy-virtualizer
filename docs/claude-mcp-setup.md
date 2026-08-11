# Configure the HAProxy Editor MCP server in Claude Code

HAProxy Editor exposes a remote Streamable HTTP MCP server protected by OAuth. This guide configures it for the current user in Claude Code.

## Prerequisites

- Claude Code is installed.
- Your Keycloak account has the `haproxy:quickmap:manage` role for the `i-shared-mcp` client.
- Keycloak allows the redirect URI `http://localhost:8080/callback` for that client.

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
