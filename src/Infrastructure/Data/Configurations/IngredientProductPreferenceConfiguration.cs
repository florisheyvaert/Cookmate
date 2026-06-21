using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookmate.Infrastructure.Data.Configurations;

public class IngredientProductPreferenceConfiguration : IEntityTypeConfiguration<IngredientProductPreference>
{
    public void Configure(EntityTypeBuilder<IngredientProductPreference> builder)
    {
        builder.ToTable("IngredientProductPreferences");

        builder.Property(p => p.NormalizedName)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(p => p.StoreCode)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(p => p.DefaultPackQuantity)
            .HasPrecision(12, 4);

        // One remembered product per ingredient name per store.
        builder.HasIndex(p => new { p.NormalizedName, p.StoreCode }).IsUnique();

        builder.HasOne(p => p.Product)
            .WithMany()
            .HasForeignKey(p => p.GroceryProductId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
