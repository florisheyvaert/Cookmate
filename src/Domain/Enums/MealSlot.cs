namespace Cookmate.Domain.Enums;

/// <summary>
/// The time of day a planned meal is for. Dinner is the primary slot — the
/// app focuses on the evening meal, the other slots are optional extras.
/// </summary>
public enum MealSlot
{
    Dinner = 1,
    Breakfast = 2,
    Lunch = 3,
    Snack = 4
}
