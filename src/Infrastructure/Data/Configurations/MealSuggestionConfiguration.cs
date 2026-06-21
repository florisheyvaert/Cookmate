using Cookmate.Domain.Entities;
using Cookmate.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookmate.Infrastructure.Data.Configurations;

public class MealSuggestionConfiguration : IEntityTypeConfiguration<MealSuggestion>
{
    public void Configure(EntityTypeBuilder<MealSuggestion> builder)
    {
        builder.ToTable("MealSuggestions");

        builder.Property(s => s.Title)
            .IsRequired()
            .HasMaxLength(300);

        builder.Property(s => s.Summary)
            .HasMaxLength(2000);

        builder.Property(s => s.SourceUrl)
            .IsRequired()
            .HasMaxLength(2048);

        builder.Property(s => s.ImageStorageKey)
            .HasMaxLength(400);

        builder.Property(s => s.BaseServings)
            .IsRequired();

        builder.Property(s => s.HarvestedOn)
            .IsRequired();

        // Unique on the canonical recipe URL — the dedup key for harvesting.
        builder.HasIndex(s => s.SourceUrl).IsUnique();

        // Browse orders by harvest date.
        builder.HasIndex(s => s.HarvestedOn);

        builder.PrimitiveCollection(s => s.Tags)
            .HasField("_tags")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .HasColumnType("text[]")
            .HasDefaultValueSql("ARRAY[]::text[]");

        // Self-contained scraped payload kept as JSON so promoting to a recipe later
        // needs no re-scrape.
        builder.Property(s => s.Ingredients)
            .HasField("_ingredients")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .HasColumnType("jsonb")
            .HasConversion(JsonbColumn.Converter<SuggestionIngredient>(), JsonbColumn.Comparer<SuggestionIngredient>());

        builder.Property(s => s.Steps)
            .HasField("_steps")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .HasColumnType("jsonb")
            .HasConversion(JsonbColumn.Converter<string>(), JsonbColumn.Comparer<string>());

        // Deleting a source removes its suggestions.
        builder.HasOne<SuggestionSource>()
            .WithMany()
            .HasForeignKey(s => s.SourceId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
