using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookmate.Infrastructure.Data.Configurations;

public class GroceryProductConfiguration : IEntityTypeConfiguration<GroceryProduct>
{
    public void Configure(EntityTypeBuilder<GroceryProduct> builder)
    {
        builder.ToTable("GroceryProducts");

        builder.Property(p => p.StoreCode)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(p => p.Sku)
            .IsRequired()
            .HasMaxLength(64);

        builder.Property(p => p.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(p => p.BrandOrSubtitle).HasMaxLength(200);
        builder.Property(p => p.ImageUrl).HasMaxLength(2048);
        builder.Property(p => p.CanonicalUrl).HasMaxLength(2048);
        builder.Property(p => p.Currency).HasMaxLength(8);

        builder.Property(p => p.UnitPrice)
            .HasPrecision(12, 2);

        builder.HasIndex(p => new { p.StoreCode, p.Sku }).IsUnique();

        builder.OwnsOne(p => p.PackSize, q =>
        {
            q.Property(p => p.Amount)
                .HasColumnName("PackSizeAmount")
                .HasPrecision(12, 4)
                .IsRequired();

            q.Property(p => p.Unit)
                .HasColumnName("PackSizeUnit")
                .HasMaxLength(50)
                .IsRequired();
        });

        builder.Navigation(p => p.PackSize).IsRequired();
    }
}
