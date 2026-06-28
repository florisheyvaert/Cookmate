using System.Net;
using System.Net.Http;
using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Constants;
using Cookmate.Infrastructure.Data;
using Cookmate.Infrastructure.Data.Interceptors;
using Cookmate.Infrastructure.Identity;
using Cookmate.Infrastructure.Scraping;
using Cookmate.Infrastructure.Scraping.Discovery;
using Cookmate.Infrastructure.Shopping;
using Cookmate.Infrastructure.Storage;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace Microsoft.Extensions.DependencyInjection;

public static class DependencyInjection
{
    public static void AddInfrastructureServices(this IHostApplicationBuilder builder)
    {
        var connectionString = builder.Configuration.GetConnectionString(Services.Database);
        Guard.Against.Null(connectionString, message: $"Connection string '{Services.Database}' not found.");

        builder.Services.AddScoped<ISaveChangesInterceptor, AuditableEntityInterceptor>();
        builder.Services.AddScoped<ISaveChangesInterceptor, DispatchDomainEventsInterceptor>();

        builder.Services.AddDbContext<ApplicationDbContext>((sp, options) =>
        {
            options.AddInterceptors(sp.GetServices<ISaveChangesInterceptor>());
            options.UseNpgsql(connectionString);
            options.ConfigureWarnings(warnings => warnings.Ignore(RelationalEventId.PendingModelChangesWarning));
        });

        builder.EnrichNpgsqlDbContext<ApplicationDbContext>();

        builder.Services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<ApplicationDbContext>());

        builder.Services.AddScoped<ApplicationDbContextInitialiser>();

        // Both schemes registered. Cookies for the React SPA (?useCookies=true on login),
        // bearer for the future mobile app. Keep the AuthenticationBuilder itself
        // (AddIdentityCookies returns a narrower IdentityCookiesBuilder) so the OIDC
        // providers below can be added to it.
        var authBuilder = builder.Services.AddAuthentication();
        authBuilder
            .AddBearerToken(IdentityConstants.BearerScheme)
            .AddIdentityCookies();

        // External OpenID Connect providers (Authentik first; generic over N providers
        // via config). Each handler signs in to Identity's external cookie; the
        // ExternalLogin endpoints then exchange that for a real Identity session and
        // auto-provision/link a local account. Local password login keeps working
        // untouched. Secrets come from user-secrets / Key Vault, not appsettings.json.
        var oidcOptions = new OidcOptions();
        builder.Configuration.GetSection(OidcOptions.SectionName).Bind(oidcOptions);
        builder.Services.Configure<OidcOptions>(builder.Configuration.GetSection(OidcOptions.SectionName));

        foreach (var provider in oidcOptions.Providers.Where(p => p.IsUsable))
        {
            authBuilder.AddOpenIdConnect(provider.Scheme, provider.DisplayName, options =>
            {
                // The OIDC handler parks the external identity in Identity's external
                // cookie; SignInManager.GetExternalLoginInfoAsync reads it in the callback.
                options.SignInScheme = IdentityConstants.ExternalScheme;

                options.Authority = provider.Authority;
                options.ClientId = provider.ClientId;
                options.ClientSecret = provider.ClientSecret;

                // Authorization-code flow with PKCE — the secure default for a
                // confidential web client.
                options.ResponseType = "code";
                options.UsePkce = true;
                options.SaveTokens = true;
                options.GetClaimsFromUserInfoEndpoint = true;

                options.Scope.Clear();
                foreach (var scope in provider.Scopes)
                    options.Scope.Add(scope);

                // Callback lives under /api so Vite's dev proxy (which only forwards
                // /api) carries the redirect back from the IdP. This exact path must be
                // registered as a redirect URI in the provider (e.g. Authentik).
                options.CallbackPath = $"/api/auth/{provider.Scheme}/signin-callback";

                // Dev runs over http (Vite proxy); prod terminates TLS at the reverse
                // proxy. SameAsRequest keeps the correlation/nonce cookies usable in both.
                // Fully qualified: System.Net (imported above) also defines SameSiteMode.
                options.CorrelationCookie.SameSite = Microsoft.AspNetCore.Http.SameSiteMode.Lax;
                options.CorrelationCookie.SecurePolicy = Microsoft.AspNetCore.Http.CookieSecurePolicy.SameAsRequest;
                options.NonceCookie.SameSite = Microsoft.AspNetCore.Http.SameSiteMode.Lax;
                options.NonceCookie.SecurePolicy = Microsoft.AspNetCore.Http.CookieSecurePolicy.SameAsRequest;

                // Read the standard OIDC email/name claims directly.
                options.TokenValidationParameters.NameClaimType = "email";
                options.ClaimActions.MapJsonKey("email_verified", "email_verified");
            });
        }

        // Default policy accepts either scheme so RequireAuthorization() works for both.
        // Named policies must specify schemes too — without them the framework
        // falls back to the (unset) DefaultChallengeScheme and throws on 401.
        builder.Services.AddAuthorizationBuilder()
            .SetDefaultPolicy(new AuthorizationPolicyBuilder(
                    IdentityConstants.BearerScheme,
                    IdentityConstants.ApplicationScheme)
                .RequireAuthenticatedUser()
                .Build())
            .AddPolicy(Roles.Administrator, new AuthorizationPolicyBuilder(
                    IdentityConstants.BearerScheme,
                    IdentityConstants.ApplicationScheme)
                .RequireAuthenticatedUser()
                .RequireRole(Roles.Administrator)
                .Build());

        // Personal-app password rules: minimum 8 characters, no enforced complexity.
        // Encourages passphrases over forced symbol-soup.
        builder.Services.Configure<IdentityOptions>(o =>
        {
            o.Password.RequiredLength = 8;
            o.Password.RequireUppercase = false;
            o.Password.RequireLowercase = false;
            o.Password.RequireDigit = false;
            o.Password.RequireNonAlphanumeric = false;
            o.User.RequireUniqueEmail = true;
        });

        builder.Services
            .AddIdentityCore<ApplicationUser>()
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddApiEndpoints();

        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddTransient<IIdentityService, IdentityService>();

        builder.Services.Configure<FileStorageOptions>(
            builder.Configuration.GetSection(FileStorageOptions.SectionName));
        builder.Services.AddSingleton<IFileStorage, LocalFileStorage>();

        // Recipe scraping & discovery. The generic JSON-LD scraper and listing-page
        // discoverer are the defaults; per-host implementations (e.g. dagelijksekost)
        // register as IHostRecipeScraper / IHostRecipeUrlDiscoverer and the registries
        // prefer them by host. Import and the weekly harvest both go through the registry.
        void ConfigureScraperClient(HttpClient client)
        {
            client.Timeout = TimeSpan.FromSeconds(15);
            // A browser User-Agent: some sites (e.g. ah.be) return 403 to non-browser
            // clients on their recipe HTML. Public recipe pages are fine to read this way.
            client.DefaultRequestHeaders.UserAgent.ParseAdd(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36");
            client.DefaultRequestHeaders.Accept.ParseAdd("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("nl-BE,nl;q=0.9,en;q=0.8");
        }

        // Follow redirects and persist cookies across them: some sites (e.g.
        // libelle-lekker.be) gate recipe pages behind a silent SSO/consent bounce that
        // only completes when the guest cookies set mid-redirect are sent back. Also
        // decompress like a browser.
        static HttpMessageHandler ScraperHandler() => new HttpClientHandler
        {
            AllowAutoRedirect = true,
            MaxAutomaticRedirections = 20,
            UseCookies = true,
            CookieContainer = new CookieContainer(),
            AutomaticDecompression = DecompressionMethods.All,
        };

        // Space requests per host so a harvest reads at a human pace instead of a
        // bot-like burst (which gets the IP 403'd by Akamai on ah.be).
        builder.Services.Configure<ScraperThrottleOptions>(
            builder.Configuration.GetSection(ScraperThrottleOptions.SectionName));
        builder.Services.AddSingleton<ScraperThrottle>();
        builder.Services.AddTransient<ThrottlingScraperHandler>();

        builder.Services.AddHttpClient<JsonLdRecipeScraper>(ConfigureScraperClient)
            .ConfigurePrimaryHttpMessageHandler(ScraperHandler)
            .AddHttpMessageHandler<ThrottlingScraperHandler>();
        builder.Services.AddHttpClient<IHostRecipeScraper, DagelijkseKostScraper>(ConfigureScraperClient)
            .ConfigurePrimaryHttpMessageHandler(ScraperHandler)
            .AddHttpMessageHandler<ThrottlingScraperHandler>();
        builder.Services.AddHttpClient<IHostRecipeScraper, LibelleLekkerScraper>(ConfigureScraperClient)
            .ConfigurePrimaryHttpMessageHandler(ScraperHandler)
            .AddHttpMessageHandler<ThrottlingScraperHandler>();
        builder.Services.AddHttpClient<ListingPageDiscoverer>(ConfigureScraperClient)
            .ConfigurePrimaryHttpMessageHandler(ScraperHandler)
            .AddHttpMessageHandler<ThrottlingScraperHandler>();
        builder.Services.AddHttpClient<IHostRecipeUrlDiscoverer, DagelijkseKostDiscoverer>(ConfigureScraperClient)
            .ConfigurePrimaryHttpMessageHandler(ScraperHandler)
            .AddHttpMessageHandler<ThrottlingScraperHandler>();
        builder.Services.AddHttpClient<IHostRecipeUrlDiscoverer, AlbertHeijnDiscoverer>(ConfigureScraperClient)
            .ConfigurePrimaryHttpMessageHandler(ScraperHandler)
            .AddHttpMessageHandler<ThrottlingScraperHandler>();
        builder.Services.AddHttpClient<IHostRecipeUrlDiscoverer, LibelleLekkerDiscoverer>(ConfigureScraperClient)
            .ConfigurePrimaryHttpMessageHandler(ScraperHandler)
            .AddHttpMessageHandler<ThrottlingScraperHandler>();

        // Downloads a source's favicon (from its home page) when a source is created/edited.
        builder.Services.AddHttpClient<IFaviconFetcher, FaviconFetcher>(ConfigureScraperClient)
            .ConfigurePrimaryHttpMessageHandler(ScraperHandler)
            .AddHttpMessageHandler<ThrottlingScraperHandler>();

        builder.Services.AddTransient<IRecipeScraperRegistry, RecipeScraperRegistry>();
        builder.Services.AddTransient<IRecipeUrlDiscovererRegistry, RecipeUrlDiscovererRegistry>();
        builder.Services.AddSingleton<ISuggestionSelectionStrategy, StableRandomSuggestionSelectionStrategy>();

        // Weekly harvest job (manual per-source runs go through the same command).
        builder.Services.AddHostedService<MealSuggestionHarvestService>();

        builder.Services.AddHttpClient<IImageDownloader, HttpImageDownloader>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(20);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Cookmate/1.0");
            client.DefaultRequestHeaders.Accept.ParseAdd("image/*");
        });

        // Grocery stores. AH's web product search is gated by a browser
        // session (403 without cookies); the mobile API issues anonymous
        // bearer tokens and returns the same data, so we go through there.
        // The token source is singleton so the bearer is shared across
        // requests and refreshed on its own.
        //
        // Headers: AH's mobile API rejects calls without `x-application` and
        // a recognisable mobile UA (returns 500). `x-dynatrace` is a tracing
        // tag the real app sends — we copy a stable value, which AH appears
        // to accept indefinitely.
        builder.Services.AddHttpClient(AlbertHeijnTokenSource.ClientName, client =>
        {
            client.BaseAddress = new Uri("https://api.ah.be");
            client.Timeout = TimeSpan.FromSeconds(15);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Appie/8.22.3 Model/phone Android/7.0-API24");
            client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
            client.DefaultRequestHeaders.Add("x-application", "AHWEBSHOP");
            client.DefaultRequestHeaders.Add(
                "x-dynatrace",
                "MT_3_4_772337796_1_fae7f753-3422-4a18-83c1-b8e8d21caace_0_1589_109");
        });
        builder.Services.AddSingleton<AlbertHeijnTokenSource>();
        builder.Services.AddTransient<AlbertHeijnStore>();
        builder.Services.AddTransient<IGroceryStore>(sp => sp.GetRequiredService<AlbertHeijnStore>());
        // Promotions come from the ah.be website (curated weekly bonus folder), not the mobile
        // API — the site shows what the customer actually sees. Requires headless Chromium.
        builder.Services.AddTransient<IStorePromotionSource, AlbertHeijnWebPromotionSource>();
        builder.Services.AddTransient<IGroceryStoreRegistry, GroceryStoreRegistry>();
    }
}
