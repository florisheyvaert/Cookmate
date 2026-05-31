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

    public DbSet<RecipeIngredientProductLink> RecipeIngredientProductLinks => Set<RecipeIngredientProductLink>();

    public DbSet<MealEntry> MealEntries => Set<MealEntry>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
    }
}
