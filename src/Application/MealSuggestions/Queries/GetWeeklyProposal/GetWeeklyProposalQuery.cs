using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.MealSuggestions.Queries.BrowseMealSuggestions;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.MealSuggestions.Queries.GetWeeklyProposal;

/// <summary>
/// The HelloFresh-style "this week" proposal: one suggested dish per weekday
/// (Mon–Sun). Selection is delegated to <see cref="ISuggestionSelectionStrategy"/>
/// (v1 = stable-random seeded by the week, so it doesn't reshuffle on reload).
/// </summary>
public record GetWeeklyProposalQuery : IRequest<WeeklyProposalDto>;

public class GetWeeklyProposalQueryHandler : IRequestHandler<GetWeeklyProposalQuery, WeeklyProposalDto>
{
    private const int DaysPerWeek = 7;

    private readonly IApplicationDbContext _context;
    private readonly ISuggestionSelectionStrategy _strategy;
    private readonly TimeProvider _timeProvider;

    public GetWeeklyProposalQueryHandler(
        IApplicationDbContext context,
        ISuggestionSelectionStrategy strategy,
        TimeProvider timeProvider)
    {
        _context = context;
        _strategy = strategy;
        _timeProvider = timeProvider;
    }

    public async Task<WeeklyProposalDto> Handle(GetWeeklyProposalQuery request, CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(_timeProvider.GetLocalNow().DateTime);
        var daysSinceMonday = ((int)today.DayOfWeek + 6) % 7;
        var weekStart = today.AddDays(-daysSinceMonday);

        var pool = await _context.MealSuggestions
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var picked = _strategy.Pick(pool, weekStart, DaysPerWeek);

        var sourceNames = await _context.SuggestionSources
            .AsNoTracking()
            .ToDictionaryAsync(s => s.Id, s => s.Name, cancellationToken);

        var days = new List<WeeklyProposalDayDto>(DaysPerWeek);
        for (var i = 0; i < DaysPerWeek; i++)
        {
            var suggestion = i < picked.Count ? picked[i] : null;
            days.Add(new WeeklyProposalDayDto
            {
                Date = weekStart.AddDays(i),
                Suggestion = suggestion is null ? null : new MealSuggestionDto
                {
                    Id = suggestion.Id,
                    Title = suggestion.Title,
                    Summary = suggestion.Summary,
                    SourceUrl = suggestion.SourceUrl,
                    SourceId = suggestion.SourceId,
                    SourceName = sourceNames.GetValueOrDefault(suggestion.SourceId),
                    BaseServings = suggestion.BaseServings,
                    TotalTimeMinutes = suggestion.TotalTimeMinutes,
                    Tags = suggestion.Tags,
                    HarvestedOn = suggestion.HarvestedOn,
                    ImageUrl = suggestion.ImageStorageKey is null
                        ? null
                        : $"/api/MealSuggestions/{suggestion.Id}/image",
                },
            });
        }

        return new WeeklyProposalDto { WeekStart = weekStart, Days = days };
    }
}

public record WeeklyProposalDto
{
    public DateOnly WeekStart { get; init; }

    public IReadOnlyList<WeeklyProposalDayDto> Days { get; init; } = [];
}

public record WeeklyProposalDayDto
{
    public DateOnly Date { get; init; }

    public MealSuggestionDto? Suggestion { get; init; }
}
