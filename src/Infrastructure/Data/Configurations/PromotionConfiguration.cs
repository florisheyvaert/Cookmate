using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookmate.Infrastructure.Data.Configurations;

public class PromotionConfiguration : IEntityTypeConfiguration<Promotion>
{
    public void Configure(EntityTypeBuilder<Promotion> builder)
    {
        builder.ToTable("Promotions");

        builder.Property(p => p.StoreCode)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(p => p.Sku)
            .IsRequired()
            .HasMaxLength(64);

        builder.Property(p => p.Name).IsRequired().HasMaxLength(300);
        builder.Property(p => p.BrandOrSubtitle).HasMaxLength(200);
        builder.Property(p => p.ImageUrl).HasMaxLength(500);
        builder.Property(p => p.PackSize).HasMaxLength(100);
        builder.Property(p => p.CanonicalUrl).HasMaxLength(500);
        builder.Property(p => p.DiscountLabel).HasMaxLength(200);
        builder.Property(p => p.Currency).HasMaxLength(8);

        builder.Property(p => p.OriginalPrice).HasPrecision(12, 2);
        builder.Property(p => p.PromoPrice).HasPrecision(12, 2);

        // One promo per SKU per store per bonus week; refresh upserts on this key
        // (the same product can be on bonus in two visible weeks at once).
        builder.HasIndex(p => new { p.StoreCode, p.Sku, p.ValidFrom }).IsUnique();

        // Listing a week + pruning expired promos query by store + dates.
        builder.HasIndex(p => new { p.StoreCode, p.ValidFrom });
        builder.HasIndex(p => new { p.StoreCode, p.ValidTo });
    }
}
