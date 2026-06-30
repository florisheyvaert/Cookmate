using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookmate.Infrastructure.Data.Configurations;

public class StorePromotionSettingConfiguration : IEntityTypeConfiguration<StorePromotionSetting>
{
    public void Configure(EntityTypeBuilder<StorePromotionSetting> builder)
    {
        builder.ToTable("StorePromotionSettings");

        builder.Property(s => s.StoreCode).IsRequired().HasMaxLength(64);
        builder.Property(s => s.Enabled).IsRequired();

        // One row per store.
        builder.HasIndex(s => s.StoreCode).IsUnique();
    }
}
