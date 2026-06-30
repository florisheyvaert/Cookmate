using System.Reflection;
using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Entities;
using Cookmate.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Infrastructure.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<Recipe> Recipes => Set<Recipe>();

    public DbSet<GroceryProduct> GroceryProducts => Set<GroceryProduct>();

    public DbSet<Promotion> Promotions => Set<Promotion>();

    public DbSet<RecipeIngredientProductLink> RecipeIngredientProductLinks => Set<RecipeIngredientProductLink>();

    public DbSet<IngredientProductPreference> IngredientProductPreferences => Set<IngredientProductPreference>();

    public DbSet<IgnoredIngredient> IgnoredIngredients => Set<IgnoredIngredient>();

    public DbSet<ShoppingCartItem> ShoppingCartItems => Set<ShoppingCartItem>();

    public DbSet<MealEntry> MealEntries => Set<MealEntry>();

    public DbSet<SuggestionSource> SuggestionSources => Set<SuggestionSource>();

    public DbSet<MealSuggestion> MealSuggestions => Set<MealSuggestion>();

    public DbSet<IntegrationRun> IntegrationRuns => Set<IntegrationRun>();

    public DbSet<HarvestSchedule> HarvestSchedules => Set<HarvestSchedule>();

    public DbSet<StorePromotionSetting> StorePromotionSettings => Set<StorePromotionSetting>();

    public DbSet<PromotionRefreshSchedule> PromotionRefreshSchedules => Set<PromotionRefreshSchedule>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
    }
}
