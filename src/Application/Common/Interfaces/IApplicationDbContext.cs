using Cookmate.Domain.Entities;

namespace Cookmate.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Recipe> Recipes { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
