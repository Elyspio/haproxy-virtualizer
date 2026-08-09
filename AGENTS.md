# AGENTS instructions for `haproxy-virtualizer`

This file is for Codex-style agents working in this repository. Prefer non-destructive investigation. Starting and stopping the Aspire stack is allowed and expected when a change needs runtime verification.

## Build, test, and lint commands

### Backend (`Haproxy.Editor.Api`)

- SDK is pinned in `Haproxy.Editor.Api\global.json` to .NET `9.0.0` with roll-forward enabled.
- Build the .NET projects from the repo root with:
  - `dotnet build .\Haproxy.Editor.slnx`
- Run all backend tests with:
  - `dotnet test .\Haproxy.Editor.slnx`
- Run a single backend test with:
  - `dotnet test .\Haproxy.Editor.Api\Haproxy.Editor.Core.Tests\Haproxy.Editor.Core.Tests.csproj --filter "FullyQualifiedName~HaproxyServiceTests.SaveConfig_commits_transaction_after_resource_creation"`
- There is no dedicated backend lint command checked into this repository.

### Frontend (`Haproxy.Editor.Front`)

- Use `pnpm`; the repo includes `pnpm-lock.yaml` and the Aspire AppHost config uses `.WithPnpm()`.
- Run frontend lint with:
  - `pnpm lint`
- Run all frontend tests with:
  - `pnpm test -- --run`
- Run a single frontend test file with:
  - `pnpm test -- --run tests/units/config.reducer.test.ts`
- Build the frontend with:
  - `pnpm build`
- Never hand-edit `Haproxy.Editor.Front\src\core\apis\generated\*`.
- Refresh the generated frontend API client from the backend Swagger endpoint with:
  - `pnpm refresh:api`
- Before running `pnpm refresh:api`, ask the user to rebuild or restart the backend so the Swagger document is current.

### End-to-end tests (`Haproxy.Editor.Front`)

- The Playwright suite boots the real Aspire stack (MongoDB, Keycloak, HAProxy, the API and the Vite frontend). Docker must be running.
- Run it from `Haproxy.Editor.Front` with:
  - `pnpm test:e2e`
- The suite is intentionally separate from `dotnet test .\Haproxy.Editor.slnx` because container startup makes it much slower than the unit and integration suites.
- `Haproxy.Editor.AppHost\haproxy` holds a real production configuration. Playwright copies it to a temporary directory and re-points the container bind mount there, so a test run never edits the tracked `haproxy.cfg`. Keep that behaviour when adding tests.

### Local orchestration

- Aspire may be started and stopped freely for verification: `aspire run` from the repo root, or by running `Haproxy.Editor.AppHost`.
- Before starting a stack, check whether one is already running, and prefer reusing it over starting a duplicate.
- Stop what you started once the verification is done.

## High-level architecture

- `Haproxy.Editor.AppHost` is the top-level orchestrator. It starts:
  - an HAProxy container mounted from `Haproxy.Editor.AppHost\haproxy`
  - the ASP.NET Core API project
  - the Vite frontend app
- Startup order is intentional: the API waits for the HAProxy container, and the frontend waits for the API.

- `Haproxy.Editor.Api` is split into layers:
  - `Haproxy.Editor.Abstractions`: shared contracts, config objects, and snapshot models
  - `Haproxy.Editor.Core`: business logic, especially `HaproxyService`
  - `Haproxy.Editor.Adapters.Haproxy`: the HAProxy Data Plane integration and generated client
  - `Haproxy.Editor.WebApi`: minimal API host, auth, Swagger, CORS, and endpoint mapping

- Backend composition is module-based rather than wiring everything directly in `Program.cs`.
  - `Program.cs` calls `builder.AddModule<...>()`
  - each `*Module.cs` registers a slice of the application
  - `CoreModule` and adapter modules use assembly scanning to register services/adapters

- The API surface is intentionally narrow. `HaproxyEndpoints` exposes authenticated `/haproxy` endpoints for:
  - config read
  - config write
  - config validation
  - dashboard snapshot read

- `HaproxyService` is the main backend orchestrator. It translates HAProxy Data Plane resources into shared snapshot models and uses transaction-based writes for save/validate flows.

- `Haproxy.Editor.Front` is a React + Redux Toolkit + Inversify app.
  - React Router is assembled in `src\view\App.tsx`
  - the Redux store is created in `src\store\store.shared.ts`
  - DI is assembled in `src\core\di`
  - API-facing services live in `src\core\services`

- Frontend state is organized by modules under `src\store\modules\auth`, `config`, and `dashboard`.
  - async behavior is handled through custom thunk helpers in `src\store\utils\utils.actions.ts`
  - services are resolved from the Inversify container through thunk `extraArgument`, not imported ad hoc in reducers/components

- Runtime frontend config is read from `window["haproxy-editor"]`.
  - `config.endpoints.apiUrl` is used by `src\core\apis\api.ts`
  - the router and Redux store are also attached to the same window namespace for app-wide access

## Key conventions

- Prefer extending existing module registration instead of manual one-off DI wiring.
  - Backend additions should usually go into an existing `*Module.cs`
  - frontend services/apis should be bound in `src\core\di\api.di.ts` or `services.di.ts`

- Treat the shared snapshot types as the contract between layers.
  - backend models under `Haproxy.Editor.Abstractions\Data`
  - frontend state/types mirror those shapes in `src\store\modules\config` and `dashboard`

- Backend writes and validations follow a transaction pattern against the HAProxy Data Plane API.
  - validate starts a transaction, applies changes, and deletes the transaction
  - save starts a transaction, applies changes, and commits it
  - keep new write flows consistent with that pattern

- Frontend async actions should follow the existing helper pattern instead of raw `createAsyncThunk`.
  - use `createAsyncActionGenerator(...)`
  - resolve services with `getService(ServiceClass, extra)`
  - keep side effects in thunk actions and service classes, not inside React components

- Keep generated clients as generated code.
  - do not hand-edit `Haproxy.Editor.Api\Haproxy.Editor.Adapters.Haproxy\Connected Services\Haproxy\HaproxyClient.cs`
  - do not hand-edit `Haproxy.Editor.Front\src\core\apis\generated\*`
  - if the frontend API surface changes, ask the user to rebuild or restart the backend first, then regenerate it with `pnpm refresh:api`

- Frontend routing is centralized in `src\config\view.config.ts`. Add or change routes there rather than scattering hard-coded paths through components.

- The Vite dev server proxies `/api` to `https://localhost:7252` and strips the `/api` prefix. Keep that in mind when debugging frontend-to-API traffic locally.

## Codex-specific working style

- Verify behaviour changes against a running stack rather than reasoning about them. Start Aspire when needed and stop it afterwards.
- Before regenerating frontend API clients, stop and ask the user to rebuild or restart the backend; only then run `pnpm refresh:api`.
