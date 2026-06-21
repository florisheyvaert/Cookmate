using Cookmate.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Cookmate.Application.MealSuggestions.Commands.DeleteSuggestionSource;

public record DeleteSuggestionSourceCommand(int Id) : IRequest;

public class DeleteSuggestionSourceCommandHandler : IRequestHandler<DeleteSuggestionSourceCommand>
{
    private readonly IApplicationDbContext _context;

    public DeleteSuggestionSourceCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task Handle(DeleteSuggestionSourceCommand request, CancellationToken cancellationToken)
    {
        var source = await _context.SuggestionSources
            .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, source);

        _context.SuggestionSources.Remove(source);

        await _context.SaveChangesAsync(cancellationToken);
    }
}
