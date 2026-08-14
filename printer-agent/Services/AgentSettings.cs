using System.IO;
using System.Security.Cryptography;
using System.Text.Json;

namespace TokyoSushi.PrintAgent.Services;

public sealed class AgentSettings
{
    public string ApiKey { get; init; } = CreateApiKey();
    public string? SelectedPrinter { get; set; }
    public string PaperWidth { get; set; } = "80";
    public int PrintMargin { get; set; } = 3;
    public int PrintFontSize { get; set; } = 9;
    public int? MarginLeft { get; set; }
    public int? MarginRight { get; set; }
    public int? MarginTop { get; set; }
    public int? MarginBottom { get; set; }
    public bool StartWithWindows { get; set; } = true;
    public bool StartMinimized { get; set; }

    private static string CreateApiKey()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }

    public static AgentSettings Load()
    {
        var path = FilePath();
        try
        {
            if (File.Exists(path))
            {
                var settings = JsonSerializer.Deserialize<AgentSettings>(File.ReadAllText(path));
                if (settings is not null && !string.IsNullOrWhiteSpace(settings.ApiKey)) return settings;
            }
        }
        catch
        {
            // A new local key is safer than silently accepting a corrupted file.
        }

        var created = new AgentSettings();
        created.Save();
        return created;
    }

    public void Save()
    {
        var path = FilePath();
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));
    }

    private static string FilePath() => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "TokyoSushi", "PrintAgent", "settings.json");
}
