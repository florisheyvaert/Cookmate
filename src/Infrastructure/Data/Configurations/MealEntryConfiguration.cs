using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookmate.Infrastructure.Data.Configurations;

public class MealEntryConfiguration : IEntityTypeConfiguration<MealEntry>
{
    public void Configure(EntityTypeBuilder<MealEntry> builder)
    {
        builder.ToTable("MealEntries");

        builder.Property(e => e.Date)
            .IsRequired();

        builder.Property(e => e.Slot)
            .IsRequired();

        builder.Property(e => e.FreeText)
            .HasMaxLength(200);

        builder.Property(e => e.Notes)
            .HasMaxLength(500);

        // Range queries fetch a week/month at a time.
        builder.HasIndex(e => e.Date);

        // Optional recipe link. Deleting a recipe detaches the entry (RecipeId
        // becomes null) rather than blocking the delete.
        builder.HasOne<Recipe>()
            .WithMany()
            .HasForeignKey(e => e.RecipeId)
            .OnDelete(DeleteBehavior.SetNull);

        // Optional suggestion link (kept so a planned suggestion can show its photo).
        // Deleting the suggestion just detaches the entry.
        builder.HasOne<MealSuggestion>()
            .WithMany()
            .HasForeignKey(e => e.MealSuggestionId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
