using Cookmate.Application.Common.Interfaces;

namespace Cookmate.Application.MealPlanning.Queries.GetMealTextSuggestions;

/// <summary>
/// Distinct previously-used free-text meal descriptions, for the autocomplete
/// when filling in a day ("kies uit de vorige opties").
/// </summary>
public record GetMealTextSuggestionsQuery : IRequest<IReadOnlyList<string>>
{
    public string? Query { get; init; }
}

public class GetMealTextSuggestionsQueryHandler : IRequestHandler<GetMealTextSuggestionsQuery, IReadOnlyList<string>>
{
    private const int MaxResults = 20;

    private readonly IApplicationDbContext _context;

    public GetMealTextSuggestionsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<string>> Handle(GetMealTextSuggestionsQuery request, CancellationToken cancellationToken)
    {
        var entries = _context.MealEntries
            .AsNoTracking()
            .Where(e => e.FreeText != null);

        if (!string.IsNullOrWhiteSpace(request.Query))
        {
            var prefix = request.Query.Trim().ToLower();
            entries = entries.Where(e => e.FreeText!.ToLower().StartsWith(prefix));
        }

        return await entries
            .Select(e => e.FreeText!)
            .Distinct()
            .OrderBy(t => t)
            .Take(MaxResults)
            .ToListAsync(cancellationToken);
    }
}
