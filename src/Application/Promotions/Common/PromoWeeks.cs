namespace Cookmate.Application.Promotions.Common;

/// <summary>
/// Picks the "current" bonus week from a set of cached promo periods. The store keeps a
/// couple of visible weeks at once (this week + next); the default view is the week that
/// covers today, falling back to the next upcoming one, then the most recent.
/// </summary>
public static class PromoWeeks
{
    public static DateOnly? Current(IEnumerable<(DateOnly? From, DateOnly? To)> periods)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var weeks = periods
            .Where(p => p.From is not null)
            .Select(p => (From: p.From!.Value, p.To))
            .Distinct()
            .ToList();
        if (weeks.Count == 0) return null;

        var covering = weeks
            .Where(w => w.From <= today && (w.To is null || w.To >= today))
            .Select(w => w.From)
            .ToList();
        if (covering.Count > 0) return covering.Min();

        var upcoming = weeks.Where(w => w.From > today).Select(w => w.From).ToList();
        if (upcoming.Count > 0) return upcoming.Min();

        return weeks.Max(w => w.From);
    }
}
