using Cookmate.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Common;

/// <summary>
/// Resolves the small "source site" logo (favicon) shown in the corner of recipe/dish
/// thumbnails. A favicon lives on the <see cref="Domain.Entities.SuggestionSource"/> that
/// owns a host. Harvested suggestions know their owning source directly (by id); recipes
/// and meal-plan entries only carry a source URL, so those match on host. Load once per
/// query, then resolve each row in memory. Every resolver returns the relative favicon
/// endpoint URL, or null when the source is unknown or has no stored favicon.
/// </summary>
public sealed class SourceFaviconLookup
{
    private readonly Dictionary<string, int> _idByHost;
    private readonly HashSet<int> _faviconSourceIds;

    private SourceFaviconLookup(Dictionary<string, int> idByHost, HashSet<int> faviconSourceIds)
    {
        _idByHost = idByHost;
        _faviconSourceIds = faviconSourceIds;
    }

    public static async Task<SourceFaviconLookup> LoadAsync(
        IApplicationDbContext context, CancellationToken cancellationToken)
    {
        var rows = await context.SuggestionSources
            .AsNoTracking()
            .Where(s => s.FaviconStorageKey != null)
            .Select(s => new { s.Id, s.Host })
            .ToListAsync(cancellationToken);

        var idByHost = new Dictionary<string, int>();
        var ids = new HashSet<int>();
        foreach (var r in rows)
        {
            ids.Add(r.Id);
            // Host is stored normalised (lowercase, scheme-stripped); index it www-stripped
            // so a "www.ah.be" recipe URL still matches an "ah.be" source.
            idByHost[StripWww(r.Host)] = r.Id;
        }

        return new SourceFaviconLookup(idByHost, ids);
    }

    /// <summary>Favicon URL for a harvested suggestion, matched on its owning source id.</summary>
    public string? ForSourceId(int sourceId)
        => _faviconSourceIds.Contains(sourceId) ? FaviconUrl(sourceId) : null;

    /// <summary>Favicon URL for a full source URL (e.g. a recipe's), matched on host.</summary>
    public string? ForUrl(string? sourceUrl)
    {
        if (string.IsNullOrWhiteSpace(sourceUrl)) return null;
        if (!Uri.TryCreate(sourceUrl.Trim(), UriKind.Absolute, out var uri)) return null;
        return _idByHost.TryGetValue(StripWww(uri.Host), out var id) ? FaviconUrl(id) : null;
    }

    private static string FaviconUrl(int sourceId) => $"/api/SuggestionSources/{sourceId}/favicon";

    private static string StripWww(string host)
    {
        host = host.Trim().ToLowerInvariant();
        return host.StartsWith("www.") ? host["www.".Length..] : host;
    }
}
