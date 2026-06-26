# Cookmate

The project was generated using the [Clean.Architecture.Solution.Template](https://github.com/jasontaylordev/CleanArchitecture) version 10.8.0.

## Build

Run `dotnet build` to build the solution.

## Run

To run the application:

```bash
dotnet run --project .\src\AppHost
```

The Aspire dashboard will open automatically, showing the application URLs and logs.

## Authentication

Cookmate uses ASP.NET Core Identity for **local** email/password login (cookie for the
SPA, bearer for the future mobile app). On top of that it supports **external OpenID
Connect** providers — Authentik first, but the integration is generic so any OIDC
provider can be added purely through configuration.

External sign-in is **auto-provisioning**: the first successful OIDC login creates a
local account matched on the provider's **verified** email (`email_verified`), and links
an existing local account with the same email. Access control is therefore delegated to
the provider — a user Authentik does not let through never gets a token, so no account is
created. Local login remains available as a fallback.

### Configuring an OIDC provider (e.g. Authentik)

1. In Authentik, create an **OAuth2/OpenID Provider** + **Application**. Use a
   *confidential* client and request scopes `openid profile email`.
2. Register the **Redirect URI** as
   `{api-origin}/api/auth/{scheme}/signin-callback` — e.g.
   `http://localhost:5285/api/auth/authentik/signin-callback` in dev, or the public
   origin behind your reverse proxy in production. (The callback lives under `/api` so
   the Vite dev proxy carries the redirect.)
3. Provide the provider config. **Do not put secrets in `appsettings.json`** — use
   user-secrets (dev) or Key Vault (prod). The `Authentication:Oidc:Providers` array in
   `appsettings.json` is just an empty scaffold. Example with user-secrets (run from
   `src/Web`):

   ```bash
   dotnet user-secrets set "Authentication:Oidc:Providers:0:Scheme" "authentik"
   dotnet user-secrets set "Authentication:Oidc:Providers:0:DisplayName" "Authentik"
   dotnet user-secrets set "Authentication:Oidc:Providers:0:Authority" "https://auth.example/application/o/cookmate/"
   dotnet user-secrets set "Authentication:Oidc:Providers:0:ClientId" "<client-id>"
   dotnet user-secrets set "Authentication:Oidc:Providers:0:ClientSecret" "<client-secret>"
   ```

   Optional keys per provider: `Scopes` (defaults to `openid`/`profile`/`email`),
   `RequireVerifiedEmail` (default `true`), `Enabled` (default `true`).

The SPA's sign-in page renders a button per enabled provider automatically (via
`GET /api/ExternalLogin/providers`).

## Code Styles & Formatting

The template includes [EditorConfig](https://editorconfig.org/) support to help maintain consistent coding styles for multiple developers working on the same project across various editors and IDEs. The **.editorconfig** file defines the coding styles applicable to this solution.

## Code Scaffolding

The template includes support to scaffold new commands and queries.

Start in the `.\src\Application\` folder.

Create a new command:

```
dotnet new ca-usecase --name CreateTodoList --feature-name TodoLists --usecase-type command --return-type int
```

Create a new query:

```
dotnet new ca-usecase -n GetTodos -fn TodoLists -ut query -rt TodosVm
```

If you encounter the error *"No templates or subcommands found matching: 'ca-usecase'."*, install the template and try again:

```bash
dotnet new install Clean.Architecture.Solution.Template::10.8.0
```

## Test

The solution contains unit, integration, and functional tests.

To run the tests:
```bash
dotnet test
```

## Help
To learn more about the template go to the [project website](https://cleanarchitecture.jasontaylor.dev). Here you can find additional guidance, request new features, report a bug, and discuss the template with other users.