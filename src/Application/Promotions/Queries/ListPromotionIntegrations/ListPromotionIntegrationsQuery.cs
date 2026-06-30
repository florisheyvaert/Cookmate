using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Promotions.Queries.ListPromotionIntegrations;

/// <summary>
/// Every store Cookmate can pull promotions from (the registered promotion sources),
/// each with its enabled toggle, last-refresh telemetry, and how many promos are cached.
/// Drives the Integrations screen. Stores without a settings row yet appear as off.
/// </summary>
public record ListPromotionIntegrationsQuery : IRequest<IReadOnlyList<PromotionIntegrationDto>>;

public class ListPromotionIntegrationsQueryHandler
    : IRequestHandler<ListPromotionIntegrationsQuery, IReadOnlyList<PromotionIntegrationDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IEnumerable<IStorePromotionSource> _sources;
    private readonly IEnumerable<IGroceryStore> _stores;

    public ListPromotionIntegrationsQueryHandler(
        IApplicationDbContext context,
        IEnumerable<IStorePromotionSource> sources,
        IEnumerable<IGroceryStore> stores)
    {
        _context = context;
        _sources = sources;
        _stores = stores;
    }

    public async Task<IReadOnlyList<PromotionIntegrationDto>> Handle(
        ListPromotionIntegrationsQuery request, CancellationToken cancellationToken)
    {
        var settings = await _context.StorePromotionSettings.AsNoTracking()
            .ToDictionaryAsync(s => s.StoreCode, cancellationToken);

        var counts = await _context.Promotions.AsNoTracking()
            .GroupBy(p => p.StoreCode)
            .Select(g => new { Code = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Code, x => x.Count, cancellationToken);

        var displayNameByCode = _stores
            .GroupBy(s => s.Code.ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.First().DisplayName);

        return _sources
            .Select(source =>
            {
                var code = source.Code.ToLowerInvariant();
                settings.TryGetValue(code, out var setting);
                return new PromotionIntegrationDto
                {
                    StoreCode = code,
                    DisplayName = displayNameByCode.TryGetValue(code, out var name) ? name : code,
                    Enabled = setting?.Enabled ?? false,
                    LastRunAt = setting?.LastRunAt,
                    LastRunStatus = setting?.LastRunStatus,
                    LastRunCount = setting?.LastRunCount,
                    PromotionCount = counts.TryGetValue(code, out var c) ? c : 0,
                };
            })
            .OrderBy(d => d.DisplayName)
            .ToList();
    }
}

public record PromotionIntegrationDto
{
    public string StoreCode { get; init; } = string.Empty;

    public string DisplayName { get; init; } = string.Empty;

    public bool Enabled { get; init; }

    public DateTimeOffset? LastRunAt { get; init; }

    public RunStatus? LastRunStatus { get; init; }

    public int? LastRunCount { get; init; }

    /// <summary>How many promotions are currently cached for this store.</summary>
    public int PromotionCount { get; init; }
}
