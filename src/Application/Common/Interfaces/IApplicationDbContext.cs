using Cookmate.Domain.Entities;

namespace Cookmate.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Recipe> Recipes { get; }

    DbSet<GroceryProduct> GroceryProducts { get; }

    DbSet<RecipeIngredientProductLink> RecipeIngredientProductLinks { get; }

    DbSet<MealEntry> MealEntries { get; }

    DbSet<SuggestionSource> SuggestionSources { get; }

    DbSet<MealSuggestion> MealSuggestions { get; }

    DbSet<SuggestionHarvestRun> SuggestionHarvestRuns { get; }

    DbSet<HarvestSchedule> HarvestSchedules { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
