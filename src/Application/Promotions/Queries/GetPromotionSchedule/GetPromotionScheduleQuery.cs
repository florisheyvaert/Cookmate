using Cookmate.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Promotions.Queries.GetPromotionSchedule;

/// <summary>The current automatic promotion-refresh schedule (singleton), with sensible defaults when unset.</summary>
public record GetPromotionScheduleQuery : IRequest<PromotionScheduleDto>;

public class GetPromotionScheduleQueryHandler : IRequestHandler<GetPromotionScheduleQuery, PromotionScheduleDto>
{
    private readonly IApplicationDbContext _context;

    public GetPromotionScheduleQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<PromotionScheduleDto> Handle(GetPromotionScheduleQuery request, CancellationToken cancellationToken)
    {
        var schedule = await _context.PromotionRefreshSchedules.AsNoTracking().FirstOrDefaultAsync(cancellationToken);

        return schedule is null
            ? new PromotionScheduleDto { Enabled = true, DayOfWeek = (int)DayOfWeek.Wednesday, TimeOfDay = "06:00" }
            : new PromotionScheduleDto
            {
                Enabled = schedule.Enabled,
                DayOfWeek = (int)schedule.DayOfWeek,
                TimeOfDay = schedule.TimeOfDay.ToString("HH:mm"),
            };
    }
}

public record PromotionScheduleDto
{
    public bool Enabled { get; init; }

    /// <summary>0 = Sunday … 6 = Saturday (matches System.DayOfWeek).</summary>
    public int DayOfWeek { get; init; }

    /// <summary>Local time "HH:mm".</summary>
    public string TimeOfDay { get; init; } = "06:00";
}
