using System.Globalization;
using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.MealSuggestions.Commands.UpdateHarvestSchedule;

/// <summary>Sets the automatic weekly-harvest schedule (singleton row, created on first save).</summary>
public record UpdateHarvestScheduleCommand : IRequest
{
    public bool Enabled { get; init; } = true;

    /// <summary>0 = Sunday … 6 = Saturday.</summary>
    public int DayOfWeek { get; init; } = (int)System.DayOfWeek.Monday;

    /// <summary>Local time "HH:mm".</summary>
    public string TimeOfDay { get; init; } = "03:00";
}

public class UpdateHarvestScheduleCommandHandler : IRequestHandler<UpdateHarvestScheduleCommand>
{
    private readonly IApplicationDbContext _context;

    public UpdateHarvestScheduleCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task Handle(UpdateHarvestScheduleCommand request, CancellationToken cancellationToken)
    {
        var time = TimeOnly.ParseExact(request.TimeOfDay, "HH:mm", CultureInfo.InvariantCulture);
        var day = (DayOfWeek)request.DayOfWeek;

        var schedule = await _context.HarvestSchedules.FirstOrDefaultAsync(cancellationToken);
        if (schedule is null)
        {
            schedule = new HarvestSchedule(request.Enabled, day, time);
            _context.HarvestSchedules.Add(schedule);
        }
        else
        {
            schedule.Set(request.Enabled, day, time);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}
