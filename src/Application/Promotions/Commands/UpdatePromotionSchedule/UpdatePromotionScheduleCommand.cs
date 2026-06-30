using System.Globalization;
using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.Promotions.Commands.UpdatePromotionSchedule;

/// <summary>Sets the automatic promotion-refresh schedule (singleton row, created on first save).</summary>
public record UpdatePromotionScheduleCommand : IRequest
{
    public bool Enabled { get; init; } = true;

    /// <summary>0 = Sunday … 6 = Saturday.</summary>
    public int DayOfWeek { get; init; } = (int)System.DayOfWeek.Wednesday;

    /// <summary>Local time "HH:mm".</summary>
    public string TimeOfDay { get; init; } = "06:00";
}

public class UpdatePromotionScheduleCommandHandler : IRequestHandler<UpdatePromotionScheduleCommand>
{
    private readonly IApplicationDbContext _context;

    public UpdatePromotionScheduleCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task Handle(UpdatePromotionScheduleCommand request, CancellationToken cancellationToken)
    {
        var time = TimeOnly.ParseExact(request.TimeOfDay, "HH:mm", CultureInfo.InvariantCulture);
        var day = (DayOfWeek)request.DayOfWeek;

        var schedule = await _context.PromotionRefreshSchedules.FirstOrDefaultAsync(cancellationToken);
        if (schedule is null)
        {
            schedule = new PromotionRefreshSchedule(request.Enabled, day, time);
            _context.PromotionRefreshSchedules.Add(schedule);
        }
        else
        {
            schedule.Set(request.Enabled, day, time);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}
