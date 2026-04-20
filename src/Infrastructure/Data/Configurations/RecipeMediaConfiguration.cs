using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookmate.Infrastructure.Data.Configurations;

public class RecipeMediaConfiguration : IEntityTypeConfiguration<RecipeMedia>
{
    public void Configure(EntityTypeBuilder<RecipeMedia> builder)
    {
        builder.ToTable("RecipeMedia");

        builder.Property(m => m.LocalPath)
            .IsRequired()
            .HasMaxLength(1024);

        builder.Property(m => m.Type)
            .IsRequired()
            .HasConversion<int>();

        builder.Property(m => m.Caption)
            .HasMaxLength(500);

        builder.Property(m => m.Order)
            .IsRequired();
    }
}
