using System.Security.Claims;
using Cookmate.Domain.Constants;
using Cookmate.Infrastructure.Identity;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Cookmate.Web.Endpoints;

/// <summary>
/// External OpenID Connect sign-in (Authentik first, generic over configured
/// providers). The browser is sent on a full-page redirect: <c>challenge</c> kicks
/// off the OIDC flow, the provider returns to the handler's callback path, and
/// <c>callback</c> turns the external identity into a local Identity cookie session —
/// auto-provisioning or linking a local account by verified e-mail. Local password
/// login is unaffected; access control is delegated to the provider (no token ⇒ no
/// account ⇒ no access).
/// </summary>
public class ExternalLogin : IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        // All pre-login, so anonymous. (The default policy only applies to endpoints
        // that opt into authorization; AllowAnonymous keeps that explicit.)
        groupBuilder.MapGet(ListProviders, "providers").AllowAnonymous();
        groupBuilder.MapGet(Challenge, "{scheme}/challenge").AllowAnonymous();
        groupBuilder.MapGet(Callback, "{scheme}/callback").AllowAnonymous();
    }

    [EndpointSummary("List external login providers")]
    [EndpointDescription("Returns the enabled OIDC providers so the SPA can render a sign-in button per provider.")]
    public static Ok<IReadOnlyList<ExternalProviderDto>> ListProviders(IOptions<OidcOptions> oidcOptions)
    {
        var providers = oidcOptions.Value.Providers
            .Where(p => p.IsUsable)
            .Select(p => new ExternalProviderDto { Scheme = p.Scheme, DisplayName = p.DisplayName })
            .ToList();

        return TypedResults.Ok<IReadOnlyList<ExternalProviderDto>>(providers);
    }

    [EndpointSummary("Start external login")]
    [EndpointDescription("Challenges the configured OIDC provider, redirecting the browser to the identity provider.")]
    public static IResult Challenge(
        SignInManager<ApplicationUser> signInManager,
        IOptions<OidcOptions> oidcOptions,
        string scheme,
        string? returnUrl)
    {
        if (!oidcOptions.Value.Providers.Any(p => p.IsUsable && p.Scheme == scheme))
            return Results.NotFound();

        var safeReturn = SafeReturnUrl(returnUrl);

        // Where the OIDC handler returns once it has parked the external identity in
        // the external cookie. Kept under /api so the Vite dev proxy carries it.
        var callbackUrl =
            $"/api/ExternalLogin/{Uri.EscapeDataString(scheme)}/callback?returnUrl={Uri.EscapeDataString(safeReturn)}";

        var properties = signInManager.ConfigureExternalAuthenticationProperties(scheme, callbackUrl);
        return Results.Challenge(properties, [scheme]);
    }

    [EndpointSummary("External login callback")]
    [EndpointDescription("Completes external login: signs in an already-linked account, or auto-provisions/links a local account by verified e-mail, then redirects back to the SPA.")]
    public static async Task<IResult> Callback(
        SignInManager<ApplicationUser> signInManager,
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        IOptions<OidcOptions> oidcOptions,
        string scheme,
        string? returnUrl)
    {
        var safeReturn = SafeReturnUrl(returnUrl);

        var info = await signInManager.GetExternalLoginInfoAsync();
        if (info is null)
            return Results.Redirect("/login?error=external");

        // 1. Already linked → straight in.
        var signInResult = await signInManager.ExternalLoginSignInAsync(
            info.LoginProvider, info.ProviderKey, isPersistent: true, bypassTwoFactor: true);
        if (signInResult.Succeeded)
            return Results.Redirect(safeReturn);

        if (signInResult.IsLockedOut)
            return Results.Redirect("/login?error=lockedout");

        // 2. Not linked yet — match by e-mail from the external identity.
        var email = info.Principal.FindFirstValue(ClaimTypes.Email)
                    ?? info.Principal.FindFirstValue("email");
        if (string.IsNullOrWhiteSpace(email))
            return Results.Redirect("/login?error=email");

        // Auto-linking by e-mail is only safe when the provider vouches for it —
        // otherwise a forged e-mail claim could hijack an existing account.
        var provider = oidcOptions.Value.Providers.FirstOrDefault(p => p.Scheme == info.LoginProvider);
        if (provider?.RequireVerifiedEmail ?? true)
        {
            var verified = info.Principal.FindFirstValue("email_verified");
            if (!string.Equals(verified, "true", StringComparison.OrdinalIgnoreCase))
                return Results.Redirect("/login?error=unverified");
        }

        // 3. Find or auto-provision the local account, then link the external login.
        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            // First-run bootstrap: while the user table is empty, the first person
            // through the door becomes the administrator — whether they arrive via
            // POST /api/Setup or, as here, via OIDC during onboarding. Captured
            // before CreateAsync so the new account itself doesn't count.
            var isFirstUser = !await userManager.Users.AnyAsync();

            user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                // The provider verified the address; no local confirmation flow exists.
                EmailConfirmed = true,
            };

            var createResult = await userManager.CreateAsync(user);
            if (!createResult.Succeeded)
                return Results.Redirect("/login?error=provision");

            if (isFirstUser)
            {
                if (!await roleManager.RoleExistsAsync(Roles.Administrator))
                    await roleManager.CreateAsync(new IdentityRole(Roles.Administrator));
                await userManager.AddToRoleAsync(user, Roles.Administrator);
            }
        }

        var linkResult = await userManager.AddLoginAsync(
            user, new UserLoginInfo(info.LoginProvider, info.ProviderKey, info.ProviderDisplayName));
        if (!linkResult.Succeeded)
            return Results.Redirect("/login?error=link");

        await signInManager.SignInAsync(user, isPersistent: true);
        return Results.Redirect(safeReturn);
    }

    // ───────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Accepts only local relative paths, guarding against open redirects via a
    /// crafted <c>returnUrl</c>. Anything else collapses to the app root.
    /// </summary>
    private static string SafeReturnUrl(string? returnUrl)
    {
        if (!string.IsNullOrEmpty(returnUrl)
            && returnUrl.StartsWith('/')
            && !returnUrl.StartsWith("//")
            && !returnUrl.StartsWith("/\\"))
        {
            return returnUrl;
        }

        return "/";
    }
}

public record ExternalProviderDto
{
    public string Scheme { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
}
