using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Constants;
using Cookmate.Infrastructure.Data;
using Cookmate.Infrastructure.Data.Interceptors;
using Cookmate.Infrastructure.Identity;
using Cookmate.Infrastructure.Scraping;
using Cookmate.Infrastructure.Storage;
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
        // bearer for the future mobile app.
        builder.Services.AddAuthentication()
            .AddBearerToken(IdentityConstants.BearerScheme)
            .AddIdentityCookies();

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

        builder.Services.AddHttpClient<IRecipeScraper, JsonLdRecipeScraper>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(15);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Cookmate/1.0 (+https://github.com/)");
            client.DefaultRequestHeaders.Accept.ParseAdd("text/html,application/xhtml+xml");
        });

        builder.Services.AddHttpClient<IImageDownloader, HttpImageDownloader>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(20);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Cookmate/1.0");
            client.DefaultRequestHeaders.Accept.ParseAdd("image/*");
        });
    }
}
