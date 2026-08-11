# HAProxy Editor

HAProxy Editor is a full-stack application for exploring, validating, and editing HAProxy configuration through a web UI.

This root README is intentionally short and acts as an entry point to the project documentation.

## Documentation map

- [`Haproxy.Editor.Deployment/README.md`](Haproxy.Editor.Deployment/README.md) — deployment assets, container build files, and delivery-oriented notes
- [`Haproxy.Editor.Api/README.md`](Haproxy.Editor.Api/README.md) — backend architecture, API layers, configuration, and commands
- [`Haproxy.Editor.Front/README.md`](Haproxy.Editor.Front/README.md) — frontend stack, structure, and development workflow
- [`docs/claude-mcp-setup.md`](docs/claude-mcp-setup.md) — configure the remote MCP server in Claude Code

## Repository overview

```text
.
├─ Haproxy.Editor.Api/         # ASP.NET Core backend and supporting projects
├─ Haproxy.Editor.AppHost/     # Aspire orchestration for local development
├─ Haproxy.Editor.Deployment/  # Container build and deployment assets
├─ Haproxy.Editor.Front/       # React + TypeScript frontend
├─ aspire.config.json
└─ Haproxy.Editor.slnx
```

## Quick start

### Prerequisites

- .NET SDK 10
- Node.js
- `pnpm`
- Docker

### Run the local stack

From the repository root:

```powershell
dotnet run --project .\Haproxy.Editor.AppHost\Haproxy.Editor.AppHost.csproj
```

This starts:

- the HAProxy container,
- the API,
- and the frontend.

## Main capabilities

- Visual editing of globals, defaults, frontends, backends, ACLs, and routing rules
- Validation and save workflows backed by HAProxy transactions
- Dashboard snapshots and raw diagnostic views
- Separation between backend contracts, business logic, adapters, and UI

For implementation details, use the folder-specific READMEs linked above.
