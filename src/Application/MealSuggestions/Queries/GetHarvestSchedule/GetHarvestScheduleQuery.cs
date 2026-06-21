using Cookmate.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.MealSuggestions.Queries.GetHarvestSchedule;

/// <summary>The current automatic-harvest schedule (singleton), with sensible defaults when unset.</summary>
public record GetHarvestScheduleQuery : IRequest<HarvestScheduleDto>;

public class GetHarvestScheduleQueryHandler : IRequestHandler<GetHarvestScheduleQuery, HarvestScheduleDto>
{
    private readonly IApplicationDbContext _context;

    public GetHarvestScheduleQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<HarvestScheduleDto> Handle(GetHarvestScheduleQuery request, CancellationToken cancellationToken)
    {
        var schedule = await _context.HarvestSchedules.AsNoTracking().FirstOrDefaultAsync(cancellationToken);

        return schedule is null
            ? new HarvestScheduleDto { Enabled = true, DayOfWeek = (int)DayOfWeek.Monday, TimeOfDay = "03:00" }
            : new HarvestScheduleDto
            {
                Enabled = schedule.Enabled,
                DayOfWeek = (int)schedule.DayOfWeek,
                TimeOfDay = schedule.TimeOfDay.ToString("HH:mm"),
            };
    }
}

public record HarvestScheduleDto
{
    public bool Enabled { get; init; }

    /// <summary>0 = Sunday … 6 = Saturday (matches System.DayOfWeek).</summary>
    public int DayOfWeek { get; init; }

    /// <summary>Local time "HH:mm".</summary>
    public string TimeOfDay { get; init; } = "03:00";
}
