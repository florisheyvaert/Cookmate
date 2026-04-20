# Cookmate

Cookmate is a personal recipe app for storing family recipes and curated recipes from the web, with the ability to scale servings, plan groceries, and (later) track pantry inventory.

## Vision

A "cooking buddy" that grows with the user: today it stores and scales recipes; tomorrow it suggests meals based on what's in the pantry and exports a shopping list to the user's preferred supermarket.

## Core Features (initial scope)

- **Recipe storage**: ingredients, quantities, steps, photos, and videos.
- **Local media**: photos and videos must be stored locally (ingested at recipe creation time, not hot-linked from external sites).
- **Editable recipes**: even recipes imported from the web (e.g. dagelijkse kost, Albert Heijn) can be edited — the user often tweaks them.
- **Servings scaling**: recipes are tied to a number of persons; changing the persons recalculates ingredient quantities proportionally.
- **Two source types**:
  - Family recipes (manually entered).
  - Recipes adapted from external sites — common sources are [Dagelijkse Kost (VRT)](https://dagelijksekost.vrt.be) and [Albert Heijn Allerhande](https://www.ah.nl/allerhande).

## Future Features (out of scope for MVP)

- **Pantry inventory** via barcode scanning on mobile.
- **Smart suggestions**: "buy one onion and you can make these 4 recipes."
- **Shopping cart export** to supermarket platforms. First target: **Albert Heijn** (primary store). Later: Lidl, Delhaize, Colruyt.
- **Mobile app** (the barcode scanner lives here).

## Architecture

Three components, built in this order:

1. **API** (.NET, start here)
2. **Web** (React, start here)
3. **Mobile app** (later — needed for barcode scanning)

### Principles

- **Clean Architecture** + **Domain-Driven Design**.
- API scaffolded from the **Jason Taylor Clean Architecture template** (`dotnet new ca-sln`).
- Domain layer owns recipe/ingredient/scaling logic; no framework dependencies.
- Local media storage abstracted behind an interface so the storage backend (filesystem / blob) can change without touching the domain.

### Tech Stack

| Layer  | Tech                                                                          |
|--------|-------------------------------------------------------------------------------|
| API    | .NET 10, Clean Architecture template by Jason Taylor, EF Core + PostgreSQL    |
| Web    | Vite + React 19 + TypeScript, Tailwind v4, React Router, TanStack Query, Motion |
| Mobile | TBD (later)                                                                   |

### Web design language

**Editorial cookbook**: warm cream paper (`--color-cream` #F5F0E8) on espresso ink, paprika accent (`--color-paprika` #E85A1A from the logo), chestnut secondary text. Typography pairs **Fraunces** (display + body, variable axes for soft/wonk character) with **JetBrains Mono** for measurements/eyebrows. Never use Inter/Roboto/system-ui in this project — the cookbook feel depends on the serif. Design tokens live in `src/Web.React/src/index.css` under `@theme`.

## Repository Layout

The .NET solution lives at the repository root — there is no `api/` wrapper folder. The React app is treated as just another project under `src/`, named `Web.React`.

```
/Cookmate.slnx                    — .NET solution (XML format)
/Directory.Build.props
/Directory.Packages.props          — central package management with transitive pinning
/global.json                       — pins SDK 10.0.201 (latestFeature roll-forward)
/src
  Domain                           — entities, value objects, domain events
  Application                      — use cases (CQRS via MediatR), validators
  Infrastructure                   — EF Core (PostgreSQL via Npgsql), identity, file storage
  Web                              — ASP.NET Core minimal API endpoints, Scalar (OpenAPI)
  AppHost                          — .NET Aspire orchestrator (Postgres + Web + Web.React in dev)
  ServiceDefaults, Shared          — Aspire defaults + shared service-name constants
  Web.React                        — Vite + React 19 + TS frontend (Web.React.esproj wraps it for VS Solution Explorer)
/tests
  Domain.UnitTests, Application.UnitTests,
  Application.FunctionalTests, Infrastructure.IntegrationTests, TestAppHost
/assets                            — logo, brand assets
```

### Scaffold notes

- Generated with `dotnet new ca-sln -n Cookmate -cf None -db postgresql` (template **Clean.Architecture.Solution.Template@10.8.0**, target framework **.NET 10**). Originally scaffolded into `api/`, then flattened to the repository root.
- Central package management is enabled with **transitive pinning** (`CentralPackageTransitivePinningEnabled=true`) so vulnerability-fixed versions of transitive deps stick.
- `System.Security.Cryptography.Xml` is pinned to `10.0.6` (advisories GHSA-37gx-xxp4-5rgx and GHSA-w3x6-4m5h-cxqf affect ≤10.0.5 — bump together if you hit the same warning later).
- To run: `dotnet run --project src/AppHost` (Aspire orchestrates Postgres + API + Vite dev server). In Visual Studio, set `AppHost` as the startup project and press F5 — one button starts the database, API, React dev server, and the Aspire dashboard. The dashboard surfaces both the Scalar API reference and the React app at their assigned URLs.
- The React app receives the API base URL via the `VITE_API_URL` environment variable, injected by the AppHost (`AddViteApp(Services.WebFrontend, "../Web.React")` in `src/AppHost/Program.cs`). `src/Web.React/vite.config.ts` reads it and configures the `/api` dev proxy automatically. When running the React app standalone (`cd src/Web.React && npm run dev`), it falls back to `http://localhost:5285` (the Web project's launchSettings http profile).

## Conventions

- Project, code, and documentation are **English**.
- Conversation with the maintainer may be Dutch — code stays English.
- Recipes themselves can be stored in any language (free-text fields).
