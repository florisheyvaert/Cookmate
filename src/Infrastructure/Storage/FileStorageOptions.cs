namespace Cookmate.Infrastructure.Storage;

public class FileStorageOptions
{
    public const string SectionName = "FileStorage";

    public string RootPath { get; set; } = "media";
}
