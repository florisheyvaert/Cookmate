using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookmate.Infrastructure.Data.Configurations;

public class ShoppingCartItemConfiguration : IEntityTypeConfiguration<ShoppingCartItem>
{
    public void Configure(EntityTypeBuilder<ShoppingCartItem> builder)
    {
        builder.ToTable("ShoppingCartItems");

        builder.Property(i => i.DisplayName).IsRequired().HasMaxLength(300);
        builder.Property(i => i.NormalizedName).IsRequired().HasMaxLength(300);
        builder.Property(i => i.StoreCode).HasMaxLength(64);
        builder.Property(i => i.Sku).HasMaxLength(128);
        builder.Property(i => i.Category).HasMaxLength(120);
        builder.Property(i => i.Quantity).IsRequired();
        builder.Property(i => i.Source).IsRequired();

        // Fast lookup when deduping a linked product, and for the matching scan.
        builder.HasIndex(i => new { i.StoreCode, i.Sku });
        builder.HasIndex(i => i.NormalizedName);
    }
}
