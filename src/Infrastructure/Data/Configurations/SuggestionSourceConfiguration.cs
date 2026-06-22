using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookmate.Infrastructure.Data.Configurations;

public class SuggestionSourceConfiguration : IEntityTypeConfiguration<SuggestionSource>
{
    public void Configure(EntityTypeBuilder<SuggestionSource> builder)
    {
        builder.ToTable("SuggestionSources");

        builder.Property(s => s.Name)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(s => s.Host)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(s => s.Enabled)
            .IsRequired();

        builder.Property(s => s.FaviconStorageKey)
            .HasMaxLength(200);

        builder.PrimitiveCollection(s => s.ListingUrls)
            .HasField("_listingUrls")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .HasColumnType("text[]")
            .HasDefaultValueSql("ARRAY[]::text[]");
    }
}
