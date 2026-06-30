using Cookmate.Domain.Entities;

namespace Cookmate.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Recipe> Recipes { get; }

    DbSet<GroceryProduct> GroceryProducts { get; }

    DbSet<Promotion> Promotions { get; }

    DbSet<RecipeIngredientProductLink> RecipeIngredientProductLinks { get; }

    DbSet<IngredientProductPreference> IngredientProductPreferences { get; }

    DbSet<IgnoredIngredient> IgnoredIngredients { get; }

    DbSet<ShoppingCartItem> ShoppingCartItems { get; }

    DbSet<MealEntry> MealEntries { get; }

    DbSet<SuggestionSource> SuggestionSources { get; }

    DbSet<MealSuggestion> MealSuggestions { get; }

    DbSet<IntegrationRun> IntegrationRuns { get; }

    DbSet<HarvestSchedule> HarvestSchedules { get; }

    DbSet<StorePromotionSetting> StorePromotionSettings { get; }

    DbSet<PromotionRefreshSchedule> PromotionRefreshSchedules { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
