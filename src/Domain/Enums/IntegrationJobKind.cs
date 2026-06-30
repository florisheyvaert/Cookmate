namespace Cookmate.Domain.Enums;

/// <summary>Which external pull an <see cref="Entities.IntegrationRun"/> represents.</summary>
public enum IntegrationJobKind
{
    /// <summary>Scraping meal suggestions from a recipe site.</summary>
    Recipes = 0,

    /// <summary>Refreshing a store's current promotions ("bonus").</summary>
    Promotions = 1,
}
