using Cookmate.Application.Common.Interfaces;
using Cookmate.Application.MealSuggestions.Queries.BrowseMealSuggestions;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.MealSuggestions.Queries.GetWeeklyIdeas;

/// <summary>
/// The HelloFresh-style "this week" offering: a selection of up to <see cref="Count"/>
/// <b>main-course</b> suggestions, drawn from the whole catalog and shuffled with a
/// week-based seed so the set (and its order) is stable within the ISO week but changes
/// every week. Main courses are detected from the scraped category tags
/// ("hoofdgerecht" across dagelijksekost / AH / libelle).
/// </summary>
public record GetWeeklyIdeasQuery : IRequest<IReadOnlyList<MealSuggestionDto>>
{
    public int Count { get; init; } = 50;
}

public class GetWeeklyIdeasQueryHandler : IRequestHandler<GetWeeklyIdeasQuery, IReadOnlyList<MealSuggestionDto>>
{
    // Lower-cased category tags that mark a main course, across the supported sources.
    private static readonly string[] MainCourseTags =
        ["hoofdgerecht", "hoofdgerechten", "hoofdschotel", "main course", "main dish", "main"];

    private readonly IApplicationDbContext _context;
    private readonly TimeProvider _timeProvider;

    public GetWeeklyIdeasQueryHandler(IApplicationDbContext context, TimeProvider timeProvider)
    {
        _context = context;
        _timeProvider = timeProvider;
    }

    public async Task<IReadOnlyList<MealSuggestionDto>> Handle(GetWeeklyIdeasQuery request, CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(_timeProvider.GetLocalNow().DateTime);
        var daysSinceMonday = ((int)today.DayOfWeek + 6) % 7;
        var weekStart = today.AddDays(-daysSinceMonday);

        // Pull id + tags only (cheap), then keep the main courses.
        var candidates = await _context.MealSuggestions
            .AsNoTracking()
            .Select(s => new { s.Id, Tags = s.Tags })
            .ToListAsync(cancellationToken);

        var mainIds = candidates
            .Where(c => c.Tags.Any(IsMainCourseTag))
            .Select(c => c.Id)
            .ToList();

        if (mainIds.Count == 0) return [];

        // Deterministic weekly shuffle: order by id first so the result is independent of
        // the DB's row order, then reorder by a week-seeded random key.
        var rng = new Random(weekStart.DayNumber);
        var picked = mainIds
            .OrderBy(id => id)
            .Select(id => (Id: id, Key: rng.Next()))
            .OrderBy(x => x.Key)
            .Select(x => x.Id)
            .Take(Math.Clamp(request.Count, 1, 200))
            .ToList();

        var rows = await _context.MealSuggestions
            .AsNoTracking()
            .Where(s => picked.Contains(s.Id))
            .Select(s => new
            {
                s.Id,
                s.Title,
                s.Summary,
                s.SourceUrl,
                s.SourceId,
                SourceName = _context.SuggestionSources
                    .Where(src => src.Id == s.SourceId)
                    .Select(src => src.Name)
                    .FirstOrDefault(),
                s.BaseServings,
                s.TotalTimeMinutes,
                Tags = s.Tags.ToList(),
                s.HarvestedOn,
                HasImage = s.ImageStorageKey != null,
            })
            .ToListAsync(cancellationToken);

        var byId = rows.ToDictionary(r => r.Id);

        // Preserve the shuffled order.
        return picked
            .Where(byId.ContainsKey)
            .Select(id => byId[id])
            .Select(s => new MealSuggestionDto
            {
                Id = s.Id,
                Title = s.Title,
                Summary = s.Summary,
                SourceUrl = s.SourceUrl,
                SourceId = s.SourceId,
                SourceName = s.SourceName,
                BaseServings = s.BaseServings,
                TotalTimeMinutes = s.TotalTimeMinutes,
                Tags = s.Tags,
                HarvestedOn = s.HarvestedOn,
                ImageUrl = s.HasImage ? $"/api/MealSuggestions/{s.Id}/image" : null,
            })
            .ToList();
    }

    private static bool IsMainCourseTag(string tag) =>
        MainCourseTags.Any(k => tag.Contains(k, StringComparison.OrdinalIgnoreCase));
}
