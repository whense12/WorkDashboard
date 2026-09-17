using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ShellSpike.Services;

/// <summary>
/// Persisted window position. This is the only FILE this spike writes:
/// two coordinates and nothing else. No preferences, no product data, no database.
/// Click-through lives in memory only, exactly as it does on the Tauri side.
/// </summary>
internal sealed class WindowPlacement
{
    [JsonPropertyName("left")]
    public double Left { get; set; }

    [JsonPropertyName("top")]
    public double Top { get; set; }
}

/// <summary>
/// Reads/writes the placement file under
/// %APPDATA%\WorkDashboard.ShellSpike\window.json
/// </summary>
internal static class WindowPlacementStore
{
    private const string FolderName = "WorkDashboard.ShellSpike";
    private const string FileName = "window.json";

    private static readonly JsonSerializerOptions Options = new()
    {
        WriteIndented = true,
    };

    internal static string DirectoryPath =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            FolderName);

    internal static string FilePath => Path.Combine(DirectoryPath, FileName);

    /// <summary>Returns null when there is no usable saved placement.</summary>
    internal static WindowPlacement? Load()
    {
        try
        {
            if (!File.Exists(FilePath))
            {
                return null;
            }

            string json = File.ReadAllText(FilePath, Encoding.UTF8);
            if (string.IsNullOrWhiteSpace(json))
            {
                return null;
            }

            WindowPlacement? placement = JsonSerializer.Deserialize<WindowPlacement>(json, Options);
            if (placement is null)
            {
                return null;
            }

            if (double.IsNaN(placement.Left) || double.IsNaN(placement.Top) ||
                double.IsInfinity(placement.Left) || double.IsInfinity(placement.Top))
            {
                return null;
            }

            return placement;
        }
        catch (Exception)
        {
            // A corrupt or unreadable settings file must never stop the window appearing.
            return null;
        }
    }

    internal static bool Save(WindowPlacement placement)
    {
        try
        {
            Directory.CreateDirectory(DirectoryPath);
            string json = JsonSerializer.Serialize(placement, Options);

            // Write to a temp file then move, so a crash mid-write cannot truncate the file.
            string tmp = FilePath + ".tmp";
            File.WriteAllText(tmp, json, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
            File.Move(tmp, FilePath, overwrite: true);
            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }
}
