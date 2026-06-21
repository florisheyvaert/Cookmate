using System.Globalization;

namespace Cookmate.Application.MealSuggestions.Commands.UpdateHarvestSchedule;

public class UpdateHarvestScheduleCommandValidator : AbstractValidator<UpdateHarvestScheduleCommand>
{
    public UpdateHarvestScheduleCommandValidator()
    {
        RuleFor(x => x.DayOfWeek)
            .InclusiveBetween(0, 6).WithMessage("Day of week must be 0 (Sunday) to 6 (Saturday).");

        RuleFor(x => x.TimeOfDay)
            .Must(BeAValidTime).WithMessage("Time must be in HH:mm format.");
    }

    private static bool BeAValidTime(string value) =>
        TimeOnly.TryParseExact(value, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
}
