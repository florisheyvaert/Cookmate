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

        builder.Property(p => p.DiscountLabel).HasMaxLength(200);
        builder.Property(p => p.Currency).HasMaxLength(8);

        builder.Property(p => p.OriginalPrice).HasPrecision(12, 2);
        builder.Property(p => p.PromoPrice).HasPrecision(12, 2);

        // One current promo per SKU per store; refresh upserts on this key.
        builder.HasIndex(p => new { p.StoreCode, p.Sku }).IsUnique();

        // Pruning expired promos queries by store + end date.
        builder.HasIndex(p => new { p.StoreCode, p.ValidTo });
    }
}
