namespace Cookmate.Domain.Entities;

public class RecipeMedia : BaseEntity
{
    public int RecipeId { get; private set; }

    public string LocalPath { get; private set; } = string.Empty;

    public MediaType Type { get; private set; }

    public string? Caption { get; private set; }

    public int Order { get; private set; }

    private RecipeMedia() { }

    internal RecipeMedia(string localPath, MediaType type, int order, string? caption = null)
    {
        if (string.IsNullOrWhiteSpace(localPath))
        {
            throw new ArgumentException("Local path is required.", nameof(localPath));
        }

        LocalPath = localPath.Trim();
        Type = type;
        Order = order;
        Caption = string.IsNullOrWhiteSpace(caption) ? null : caption.Trim();
    }

    public void SetCaption(string? caption) =>
        Caption = string.IsNullOrWhiteSpace(caption) ? null : caption.Trim();

    internal void SetOrder(int order) => Order = order;
}
