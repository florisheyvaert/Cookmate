namespace Cookmate.Domain.Enums;

/// <summary>Where a shopping-cart item came from — for display ("from this week's bonus") and grouping.</summary>
public enum CartItemSource
{
    /// <summary>Added by hand (search-and-link or free text).</summary>
    Manual = 0,

    /// <summary>Added from a store promotion.</summary>
    Promotion = 1,

    /// <summary>Pulled in from the meal plan for a date range.</summary>
    MealPlan = 2,
}
