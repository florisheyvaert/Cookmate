using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Entities;

namespace Cookmate.Application.MealSuggestions.Commands.CreateSuggestionSource;

public record CreateSuggestionSourceCommand : IRequest<int>
{
    public string Name { get; init; } = string.Empty;

    public string Host { get; init; } = string.Empty;

    public bool Enabled { get; init; } = true;

    public IReadOnlyList<string> ListingUrls { get; init; } = [];

    public int? MaxPerRun { get; init; }
}

public class CreateSuggestionSourceCommandHandler : IRequestHandler<CreateSuggestionSourceCommand, int>
{
    private readonly IApplicationDbContext _context;

    public CreateSuggestionSourceCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<int> Handle(CreateSuggestionSourceCommand request, CancellationToken cancellationToken)
    {
        var source = new SuggestionSource(request.Name, request.Host);
        source.SetEnabled(request.Enabled);
        source.SetListingUrls(request.ListingUrls);
        source.SetMaxPerRun(request.MaxPerRun);

        _context.SuggestionSources.Add(source);
        await _context.SaveChangesAsync(cancellationToken);

        return source.Id;
    }
}
