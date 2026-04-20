using Cookmate.Domain.Enums;

namespace Cookmate.Application.Common.Interfaces;

public interface IImageDownloader
{
    /// <summary>
    /// Downloads an image from the given URL and persists it via <see cref="IFileStorage"/>.
    /// Returns null if the URL can't be fetched, the content type isn't an allowed image,
    /// or the size exceeds the configured cap. Doesn't throw — import flow stays best-effort.
    /// </summary>
    Task<DownloadedMedia?> DownloadAsync(Uri url, CancellationToken cancellationToken);
}

public record DownloadedMedia(string StorageKey, MediaType Type);
