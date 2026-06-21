using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookmate.Infrastructure.Data.Configurations;

public class IgnoredIngredientConfiguration : IEntityTypeConfiguration<IgnoredIngredient>
{
    public void Configure(EntityTypeBuilder<IgnoredIngredient> builder)
    {
        builder.ToTable("IgnoredIngredients");

        builder.Property(i => i.NormalizedName)
            .IsRequired()
            .HasMaxLength(200);

        builder.HasIndex(i => i.NormalizedName).IsUnique();
    }
}
