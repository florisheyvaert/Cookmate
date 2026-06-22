namespace Cookmate.Application.Common.Interfaces;

/// <summary>
/// Downloads a website's favicon (from its main URL) and stores it locally,
/// returning the storage key — or null when none could be fetched. Best-effort:
/// never throws, so it can't block creating or editing a source.
/// </summary>
public interface IFaviconFetcher
{
    Task<string?> FetchAsync(string host, CancellationToken cancellationToken);
}
