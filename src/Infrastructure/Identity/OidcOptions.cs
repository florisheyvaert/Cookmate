namespace Cookmate.Infrastructure.Identity;

/// <summary>
/// Configuration for external OpenID Connect login providers, bound from the
/// <c>Authentication:Oidc</c> configuration section. The integration is generic:
/// Authentik is the first provider, but Google/Microsoft/etc. can be added later
/// purely through configuration — no code change. Secrets belong in user-secrets
/// or Key Vault, never in appsettings.json.
/// </summary>
public class OidcOptions
{
    public const string SectionName = "Authentication:Oidc";

    public List<OidcProviderOptions> Providers { get; set; } = new();
}

public class OidcProviderOptions
{
    /// <summary>
    /// Unique key for this provider. Used both as the ASP.NET authentication
    /// scheme name and in the public URL (e.g. <c>authentik</c> →
    /// <c>/api/ExternalLogin/authentik/challenge</c>). Keep it URL-safe.
    /// </summary>
    public string Scheme { get; set; } = string.Empty;

    /// <summary>Human label rendered on the SPA sign-in button (e.g. "Authentik").</summary>
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>OIDC authority (issuer) URL, e.g. <c>https://auth.example/application/o/cookmate/</c>.</summary>
    public string Authority { get; set; } = string.Empty;

    public string ClientId { get; set; } = string.Empty;

    public string ClientSecret { get; set; } = string.Empty;

    /// <summary>Requested scopes. Defaults cover identity + email for account matching.</summary>
    public List<string> Scopes { get; set; } = new() { "openid", "profile", "email" };

    /// <summary>
    /// When true (default), auto-provisioning/linking requires the provider to
    /// assert <c>email_verified</c>. Guards against account takeover via a forged
    /// e-mail claim. Only relax this for an IdP you fully trust that omits the claim.
    /// </summary>
    public bool RequireVerifiedEmail { get; set; } = true;

    /// <summary>Set false to register the provider config but keep it disabled.</summary>
    public bool Enabled { get; set; } = true;
}
