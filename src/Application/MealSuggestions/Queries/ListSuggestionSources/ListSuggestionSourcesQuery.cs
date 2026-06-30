using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.MealSuggestions.Queries.ListSuggestionSources;

public record ListSuggestionSourcesQuery : IRequest<IReadOnlyList<SuggestionSourceDto>>;

public class ListSuggestionSourcesQueryHandler
    : IRequestHandler<ListSuggestionSourcesQuery, IReadOnlyList<SuggestionSourceDto>>
{
    private readonly IApplicationDbContext _context;

    public ListSuggestionSourcesQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<SuggestionSourceDto>> Handle(
        ListSuggestionSourcesQuery request, CancellationToken cancellationToken)
    {
        return await _context.SuggestionSources
            .AsNoTracking()
            .OrderBy(s => s.Name)
            .Select(s => new SuggestionSourceDto
            {
                Id = s.Id,
                Name = s.Name,
                Host = s.Host,
                Enabled = s.Enabled,
                ListingUrls = s.ListingUrls,
                MaxPerRun = s.MaxPerRun,
                LastRunAt = s.LastRunAt,
                LastRunStatus = s.LastRunStatus,
                LastRunCount = s.LastRunCount,
                FaviconUrl = s.FaviconStorageKey != null ? $"/api/SuggestionSources/{s.Id}/favicon" : null,
            })
            .ToListAsync(cancellationToken);
    }
}

public record SuggestionSourceDto
{
    public int Id { get; init; }

    public string Name { get; init; } = string.Empty;

    public string Host { get; init; } = string.Empty;

    public bool Enabled { get; init; }

    public IReadOnlyList<string> ListingUrls { get; init; } = [];

    public int? MaxPerRun { get; init; }

    public DateTimeOffset? LastRunAt { get; init; }

    public RunStatus? LastRunStatus { get; init; }

    public int? LastRunCount { get; init; }

    /// <summary>Relative URL of the locally-stored site favicon, or null when none.</summary>
    public string? FaviconUrl { get; init; }
}
