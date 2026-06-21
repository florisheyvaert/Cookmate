using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookmate.Infrastructure.Data.Configurations;

public class SuggestionHarvestRunConfiguration : IEntityTypeConfiguration<SuggestionHarvestRun>
{
    public void Configure(EntityTypeBuilder<SuggestionHarvestRun> builder)
    {
        builder.ToTable("SuggestionHarvestRuns");

        builder.Property(r => r.Trigger).IsRequired();
        builder.Property(r => r.Status).IsRequired();
        builder.Property(r => r.StartedAt).IsRequired();

        // Diagnostics list ordered newest-first.
        builder.HasIndex(r => r.StartedAt);
        builder.HasIndex(r => r.SourceId);

        // Full per-source / per-URL report, persisted whole.
        builder.Property(r => r.Sources)
            .HasField("_sources")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .HasColumnType("jsonb")
            .HasConversion(JsonbColumn.Converter<HarvestSourceLog>(), JsonbColumn.Comparer<HarvestSourceLog>());
    }
}
