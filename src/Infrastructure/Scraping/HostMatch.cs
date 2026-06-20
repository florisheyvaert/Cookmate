namespace Cookmate.Infrastructure.Scraping;

internal static class HostMatch
{
    /// <summary>True when <paramref name="host"/> equals or is a subdomain of <paramref name="registered"/>.</summary>
    public static bool Matches(string host, string registered)
    {
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(registered)) return false;

        var h = host.Trim().ToLowerInvariant();
        var r = registered.Trim().ToLowerInvariant();
        return h == r || h.EndsWith("." + r, StringComparison.Ordinal);
    }
}
