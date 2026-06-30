namespace Cookmate.Domain.Entities;

/// <summary>
/// Singleton setting for the automatic promotion refresh: whether it runs, and on which
/// weekday + local time. One schedule drives every enabled store (a store opts in via its
/// <see cref="StorePromotionSetting"/>). The background service reads this each tick; the
/// user edits it from the Integrations screen. Default Wednesday morning, when most chains'
/// weekly bonus assortment has rolled over.
/// </summary>
public class PromotionRefreshSchedule : BaseAuditableEntity
{
    public bool Enabled { get; private set; } = true;

    public DayOfWeek DayOfWeek { get; private set; } = DayOfWeek.Wednesday;

    /// <summary>Local time of day to run.</summary>
    public TimeOnly TimeOfDay { get; private set; } = new(6, 0);

    private PromotionRefreshSchedule() { }

    public PromotionRefreshSchedule(bool enabled, DayOfWeek dayOfWeek, TimeOnly timeOfDay)
    {
        Set(enabled, dayOfWeek, timeOfDay);
    }

    public void Set(bool enabled, DayOfWeek dayOfWeek, TimeOnly timeOfDay)
    {
        if (dayOfWeek is < DayOfWeek.Sunday or > DayOfWeek.Saturday)
        {
            throw new ArgumentOutOfRangeException(nameof(dayOfWeek));
        }

        Enabled = enabled;
        DayOfWeek = dayOfWeek;
        TimeOfDay = timeOfDay;
    }
}
