using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookmate.Infrastructure.Data.Configurations;

public class HarvestScheduleConfiguration : IEntityTypeConfiguration<HarvestSchedule>
{
    public void Configure(EntityTypeBuilder<HarvestSchedule> builder)
    {
        builder.ToTable("HarvestSchedules");

        builder.Property(s => s.Enabled).IsRequired();
        builder.Property(s => s.DayOfWeek).IsRequired();
        builder.Property(s => s.TimeOfDay).IsRequired();
    }
}
