using Cookmate.Application.Common.Interfaces;

namespace Cookmate.Application.Recipes.Commands.DeleteRecipe;

public record DeleteRecipeCommand(int Id) : IRequest;

public class DeleteRecipeCommandHandler : IRequestHandler<DeleteRecipeCommand>
{
    private readonly IApplicationDbContext _context;

    public DeleteRecipeCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task Handle(DeleteRecipeCommand request, CancellationToken cancellationToken)
    {
        var recipe = await _context.Recipes
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, recipe);

        _context.Recipes.Remove(recipe);

        await _context.SaveChangesAsync(cancellationToken);
    }
}
