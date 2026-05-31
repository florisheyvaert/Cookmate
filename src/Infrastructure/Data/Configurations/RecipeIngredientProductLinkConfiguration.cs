using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookmate.Infrastructure.Data.Configurations;

public class RecipeIngredientProductLinkConfiguration : IEntityTypeConfiguration<RecipeIngredientProductLink>
{
    public void Configure(EntityTypeBuilder<RecipeIngredientProductLink> builder)
    {
        builder.ToTable("RecipeIngredientProductLinks");

        builder.Property(l => l.StoreCode)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(l => l.DefaultPackQuantity)
            .HasPrecision(12, 4)
            .IsRequired();

        builder.Property(l => l.UserNote).HasMaxLength(500);

        // Multiple products per ingredient per store are allowed. Dedup is
        // on (IngredientId, GroceryProductId) — the same product can't be
        // linked twice to the same ingredient.
        builder.HasIndex(l => new { l.IngredientId, l.StoreCode });
        builder.HasIndex(l => new { l.IngredientId, l.GroceryProductId }).IsUnique();

        builder.HasOne<Ingredient>()
            .WithMany()
            .HasForeignKey(l => l.IngredientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(l => l.Product)
            .WithMany()
            .HasForeignKey(l => l.GroceryProductId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
