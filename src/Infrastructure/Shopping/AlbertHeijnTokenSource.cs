using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;

namespace Cookmate.Infrastructure.Shopping;

/// <summary>
/// Mints anonymous bearer tokens for AH's mobile API. The web `/zoeken/api/...`
/// endpoint requires a browser session and returns 403 without one; the mobile
/// API issues anonymous tokens to anyone who asks, which is the legitimate
/// path for non-authenticated read access.
///
/// Singleton so the token is shared across requests. Refreshed shortly before
/// expiry (default lifetime ~7200s) and on 401 from a downstream call.
/// </summary>
public sealed class AlbertHeijnTokenSource
{
    private const string HttpClientName = "ah-mobile";
    private const string TokenEndpoint = "/mobile-auth/v1/auth/token/anonymous";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly IHttpClientFactory _factory;
    private readonly ILogger<AlbertHeijnTokenSource> _logger;
    private readonly SemaphoreSlim _gate = new(1, 1);

    private string? _token;
    private DateTimeOffset _expiresAt;

    public AlbertHeijnTokenSource(IHttpClientFactory factory, ILogger<AlbertHeijnTokenSource> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public Task<string?> GetAsync(CancellationToken cancellationToken) =>
        EnsureFreshAsync(forceRefresh: false, cancellationToken);

    public Task<string?> RefreshAsync(CancellationToken cancellationToken) =>
        EnsureFreshAsync(forceRefresh: true, cancellationToken);

    private async Task<string?> EnsureFreshAsync(bool forceRefresh, CancellationToken cancellationToken)
    {
        if (!forceRefresh && _token is not null && DateTimeOffset.UtcNow < _expiresAt)
        {
            return _token;
        }

        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (!forceRefresh && _token is not null && DateTimeOffset.UtcNow < _expiresAt)
            {
                return _token;
            }

            return await FetchLockedAsync(cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<string?> FetchLockedAsync(CancellationToken cancellationToken)
    {
        try
        {
            var http = _factory.CreateClient(HttpClientName);
            using var content = new StringContent("{\"clientId\":\"appie\"}", Encoding.UTF8, "application/json");
            using var response = await http.PostAsync(TokenEndpoint, content, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogInformation(
                    "AH anonymous token fetch returned {Status}", (int)response.StatusCode);
                _token = null;
                return null;
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var payload = await JsonSerializer.DeserializeAsync<TokenResponse>(
                stream, JsonOptions, cancellationToken);

            if (string.IsNullOrEmpty(payload?.AccessToken))
            {
                _logger.LogWarning("AH anonymous token response missing access_token");
                _token = null;
                return null;
            }

            _token = payload.AccessToken;
            // Refresh a minute before AH says it expires to avoid mid-request rotation.
            var lifetime = payload.ExpiresIn > 120 ? payload.ExpiresIn - 60 : 60;
            _expiresAt = DateTimeOffset.UtcNow.AddSeconds(lifetime);
            return _token;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AH anonymous token fetch failed");
            _token = null;
            return null;
        }
    }

    private record TokenResponse
    {
        [JsonPropertyName("access_token")]
        public string? AccessToken { get; init; }

        [JsonPropertyName("expires_in")]
        public int ExpiresIn { get; init; }
    }

    public static string ClientName => HttpClientName;
}
