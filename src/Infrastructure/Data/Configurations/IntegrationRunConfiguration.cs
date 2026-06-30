using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookmate.Infrastructure.Data.Configurations;

public class IntegrationRunConfiguration : IEntityTypeConfiguration<IntegrationRun>
{
    public void Configure(EntityTypeBuilder<IntegrationRun> builder)
    {
        builder.ToTable("IntegrationRuns");

        builder.Property(r => r.Kind).IsRequired();
        builder.Property(r => r.Trigger).IsRequired();
        builder.Property(r => r.Status).IsRequired();
        builder.Property(r => r.StartedAt).IsRequired();

        // History is read per capability, newest-first.
        builder.HasIndex(r => new { r.Kind, r.StartedAt });
        builder.HasIndex(r => r.SourceId);

        // Full per-source / per-URL report, persisted whole.
        builder.Property(r => r.Sources)
            .HasField("_sources")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .HasColumnType("jsonb")
            .HasConversion(JsonbColumn.Converter<HarvestSourceLog>(), JsonbColumn.Comparer<HarvestSourceLog>());
    }
}
