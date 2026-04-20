using Cookmate.Application.Common.Interfaces;
using Cookmate.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace Cookmate.Infrastructure.Scraping;

public class HttpImageDownloader : IImageDownloader
{
    public const long MaxBytes = 50L * 1024 * 1024;

    private static readonly IReadOnlyDictionary<string, (MediaType Type, string Extension)> AllowedTypes
        = new Dictionary<string, (MediaType, string)>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = (MediaType.Photo, ".jpg"),
            ["image/jpg"] = (MediaType.Photo, ".jpg"),
            ["image/png"] = (MediaType.Photo, ".png"),
            ["image/webp"] = (MediaType.Photo, ".webp"),
        };

    private readonly HttpClient _http;
    private readonly IFileStorage _storage;
    private readonly ILogger<HttpImageDownloader> _logger;

    public HttpImageDownloader(HttpClient http, IFileStorage storage, ILogger<HttpImageDownloader> logger)
    {
        _http = http;
        _storage = storage;
        _logger = logger;
    }

    public async Task<DownloadedMedia?> DownloadAsync(Uri url, CancellationToken cancellationToken)
    {
        try
        {
            using var response = await _http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Image fetch returned {Status} for {Url}", (int)response.StatusCode, url);
                return null;
            }

            var contentType = response.Content.Headers.ContentType?.MediaType ?? string.Empty;
            if (!AllowedTypes.TryGetValue(contentType, out var mapping))
            {
                _logger.LogInformation("Unsupported image content type '{ContentType}' for {Url}", contentType, url);
                return null;
            }

            if (response.Content.Headers.ContentLength is { } length && length > MaxBytes)
            {
                _logger.LogInformation("Image too large ({Bytes} bytes) for {Url}", length, url);
                return null;
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var key = await _storage.SaveAsync(stream, mapping.Extension, cancellationToken);
            return new DownloadedMedia(key, mapping.Type);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Image download failed for {Url}", url);
            return null;
        }
    }
}
