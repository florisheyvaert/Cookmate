namespace Cookmate.Domain.Entities;

/// <summary>
/// Singleton setting for the automatic weekly harvest: whether it runs, and on which
/// weekday + local time. The background service reads this each tick; the user edits it
/// from the Manage Sources screen.
/// </summary>
public class HarvestSchedule : BaseAuditableEntity
{
    public bool Enabled { get; private set; } = true;

    public DayOfWeek DayOfWeek { get; private set; } = DayOfWeek.Monday;

    /// <summary>Local time of day to run.</summary>
    public TimeOnly TimeOfDay { get; private set; } = new(3, 0);

    private HarvestSchedule() { }

    public HarvestSchedule(bool enabled, DayOfWeek dayOfWeek, TimeOnly timeOfDay)
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
