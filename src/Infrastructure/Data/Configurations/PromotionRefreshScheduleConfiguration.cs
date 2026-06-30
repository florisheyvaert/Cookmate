using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cookmate.Infrastructure.Data.Configurations;

public class PromotionRefreshScheduleConfiguration : IEntityTypeConfiguration<PromotionRefreshSchedule>
{
    public void Configure(EntityTypeBuilder<PromotionRefreshSchedule> builder)
    {
        builder.ToTable("PromotionRefreshSchedules");

        builder.Property(s => s.Enabled).IsRequired();
        builder.Property(s => s.DayOfWeek).IsRequired();
        builder.Property(s => s.TimeOfDay).IsRequired();
    }
}
