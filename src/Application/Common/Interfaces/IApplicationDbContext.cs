using Cookmate.Domain.Entities;

namespace Cookmate.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Recipe> Recipes { get; }

    DbSet<GroceryProduct> GroceryProducts { get; }

    DbSet<RecipeIngredientProductLink> RecipeIngredientProductLinks { get; }

    DbSet<MealEntry> MealEntries { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
