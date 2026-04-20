using Cookmate.Infrastructure.Data;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.AddServiceDefaults();

builder.AddKeyVaultIfConfigured();
builder.AddApplicationServices();
builder.AddInfrastructureServices();
builder.AddWebServices();

var app = builder.Build();

// Apply EF migrations + seed identity in every environment so containers come up clean.
await app.InitialiseDatabaseAsync();

if (!app.Environment.IsDevelopment())
{
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

// No HTTPS redirect at the app layer: in dev the Vite proxy hits http; in prod a
// reverse proxy (nginx in docker-compose, Azure Container Apps, etc.) terminates TLS
// upstream and forwards to the API over http inside the network.

// No CORS in dev: the React app talks to the API through Vite's same-origin proxy.
// In prod the SPA and API are intended to share an origin (reverse proxy / static files).
// If a real cross-origin scenario ever appears, add a policy with explicit origins +
// AllowCredentials() — never AllowAnyOrigin() with credentials.

app.UseFileServer();

app.MapOpenApi();
app.MapScalarApiReference();

app.UseExceptionHandler(options => { });

app.Map("/", () => Results.Redirect("/scalar"));

app.MapDefaultEndpoints();
app.MapEndpoints(typeof(Program).Assembly);


app.Run();
