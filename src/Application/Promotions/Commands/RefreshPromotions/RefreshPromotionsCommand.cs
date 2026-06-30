using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.MealSuggestions.Common;
using Cookmate.Domain.Entities;
using Cookmate.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Promotions.Commands.RefreshPromotions;

/// <summary>
/// Pulls the current promotions ("bonus") for one store, or for every enabled store when
/// <see cref="StoreCode"/> is empty (the scheduled job). Refreshes the local cache:
/// upserts a <see cref="GroceryProduct"/> per promo SKU (so the SKU's metadata is known
/// to the cart) and a <see cref="Promotion"/> row, then drops promos that are no longer
/// on offer — a full snapshot replace, so running it again is idempotent. The whole outcome
/// is persisted as an <see cref="IntegrationRun"/> (<see cref="IntegrationJobKind.Promotions"/>)
/// for the history, mirroring how the meal harvest records its runs.
/// </summary>
public record RefreshPromotionsCommand : IRequest<IntegrationRunReport>
{
    /// <summary>A single store by code; empty/null refreshes every enabled store.</summary>
    public string? StoreCode { get; init; }

    public RunTrigger Trigger { get; init; } = RunTrigger.Manual;
}

public class RefreshPromotionsCommandHandler : IRequestHandler<RefreshPromotionsCommand, IntegrationRunReport>
{
    private readonly IApplicationDbContext _context;
    private readonly IEnumerable<IStorePromotionSource> _sources;
    private readonly TimeProvider _timeProvider;

    public RefreshPromotionsCommandHandler(
        IApplicationDbContext context,
        IEnumerable<IStorePromotionSource> sources,
        TimeProvider timeProvider)
    {
        _context = context;
        _sources = sources;
        _timeProvider = timeProvider;
    }

    public async Task<IntegrationRunReport> Handle(RefreshPromotionsCommand request, CancellationToken cancellationToken)
    {
        // Like the harvest, a refresh once started should run to completion regardless of
        // whether the HTTP caller is still listening, and persist progress as it goes.
        var ct = CancellationToken.None;
        var startedAt = _timeProvider.GetUtcNow();

        var code = (request.StoreCode ?? string.Empty).Trim().ToLowerInvariant();
        var settings = await _context.StorePromotionSettings.ToListAsync(ct);
        var settingByCode = settings.ToDictionary(s => s.StoreCode);

        // A single named store runs on demand regardless of its enabled flag (the "Run now"
        // button); an "all stores" run only touches stores the user has switched on.
        List<IStorePromotionSource> targets;
        if (code.Length > 0)
        {
            var source = _sources.FirstOrDefault(s => string.Equals(s.Code, code, StringComparison.OrdinalIgnoreCase));
            Guard.Against.NotFound(code, source);
            targets = [source];
        }
        else
        {
            targets = _sources
                .Where(s => settingByCode.TryGetValue(s.Code.ToLowerInvariant(), out var st) && st.Enabled)
                .ToList();
        }

        var run = new IntegrationRun(
            request.Trigger, startedAt,
            sourceId: null, kind: IntegrationJobKind.Promotions);
        _context.IntegrationRuns.Add(run);

        foreach (var source in targets)
        {
            var setting = EnsureSetting(settingByCode, source.Code);
            setting.MarkRunStarted(startedAt);
        }

        await _context.SaveChangesAsync(ct);

        var logs = new List<HarvestSourceLog>();
        try
        {
            foreach (var source in targets)
            {
                var log = await RefreshStoreAsync(source, ct);
                var setting = EnsureSetting(settingByCode, source.Code);
                setting.RecordRun(_timeProvider.GetUtcNow(), StatusOf(log), log.Inserted);
                logs.Add(log);

                run.UpdateProgress(logs);
                await _context.SaveChangesAsync(ct);
            }

            run.Complete(logs, _timeProvider.GetUtcNow());
            await _context.SaveChangesAsync(ct);
        }
        catch (Exception)
        {
            if (run.FinishedAt is null)
            {
                run.Complete(logs, _timeProvider.GetUtcNow());
                await _context.SaveChangesAsync(CancellationToken.None);
            }

            throw;
        }

        return IntegrationRunReport.From(run);
    }

    /// <summary>Refreshes one store's promo cache (snapshot replace) and returns its per-store log.</summary>
    private async Task<HarvestSourceLog> RefreshStoreAsync(IStorePromotionSource source, CancellationToken cancellationToken)
    {
        var code = source.Code.ToLowerInvariant();

        IReadOnlyList<StorePromotion> fresh;
        try
        {
            fresh = await source.GetPromotionsAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            return new HarvestSourceLog { SourceName = source.Code, Host = code, Error = Describe(ex) };
        }

        // Batch-load existing rows for this store so the upsert is a few queries, not N.
        var existingProducts = await _context.GroceryProducts
            .Where(p => p.StoreCode == code)
            .ToDictionaryAsync(p => p.Sku, cancellationToken);
        var existingPromotions = await _context.Promotions
            .Where(p => p.StoreCode == code)
            .ToListAsync(cancellationToken);
        var promotionBySku = existingPromotions.ToDictionary(p => p.Sku);

        var freshSkus = new HashSet<string>();
        foreach (var promo in fresh)
        {
            if (string.IsNullOrWhiteSpace(promo.Sku)) continue;
            freshSkus.Add(promo.Sku);

            if (!existingProducts.TryGetValue(promo.Sku, out var product))
            {
                product = new GroceryProduct(code, promo.Sku, promo.Name);
                _context.GroceryProducts.Add(product);
                existingProducts[promo.Sku] = product;
            }
            product.UpdateMetadata(
                promo.Name, promo.BrandOrSubtitle, promo.ImageUrl, promo.CanonicalUrl,
                promo.PackSize, promo.OriginalPrice, promo.Currency);

            if (!promotionBySku.TryGetValue(promo.Sku, out var promotion))
            {
                promotion = new Promotion(code, promo.Sku);
                _context.Promotions.Add(promotion);
                promotionBySku[promo.Sku] = promotion;
            }
            promotion.Update(
                promo.DiscountLabel, promo.OriginalPrice, promo.PromoPrice,
                promo.Currency, promo.ValidFrom, promo.ValidTo);
        }

        // Drop promos that are no longer on offer (the snapshot is authoritative).
        var stale = existingPromotions.Where(p => !freshSkus.Contains(p.Sku)).ToList();
        if (stale.Count > 0) _context.Promotions.RemoveRange(stale);

        // "Inserted" reads as the size of the fresh snapshot now cached for this store —
        // the number the user cares about ("88 promos"). A zero-promo response is treated
        // as a failure, since a healthy bonus pull is never empty.
        return new HarvestSourceLog
        {
            SourceName = source.Code,
            Host = code,
            Discovered = fresh.Count,
            Inserted = freshSkus.Count,
            Failed = freshSkus.Count == 0 ? 1 : 0,
            Error = freshSkus.Count == 0 ? "No promotions returned by the store." : null,
        };
    }

    private StorePromotionSetting EnsureSetting(Dictionary<string, StorePromotionSetting> byCode, string storeCode)
    {
        var code = storeCode.ToLowerInvariant();
        if (byCode.TryGetValue(code, out var setting)) return setting;

        setting = new StorePromotionSetting(code);
        _context.StorePromotionSettings.Add(setting);
        byCode[code] = setting;
        return setting;
    }

    private static RunStatus StatusOf(HarvestSourceLog log) =>
        log.Error is null ? RunStatus.Succeeded : RunStatus.Failed;

    private static string Describe(Exception ex) =>
        $"{ex.GetType().Name}: {ex.Message}";
}
