using System.Globalization;
using System.IO;
using System.Text;
using System.Text.Json;

namespace ShellSpike.Experimental;

/// <summary>
/// EXPERIMENTAL record — monitor-normalized widget placement.
///
/// This is NOT the prototype's placement format. The default path is still
/// <c>window.json</c> (<see cref="ShellSpike.Services.WindowPlacementStore"/>) and is untouched.
/// This record lives in its own file and exists only to measure whether a
/// monitor-normalized placement can be expressed identically on WPF and on Tauri.
/// </summary>
internal sealed class MonitorNormalizedPlacement
{
    internal const int CurrentSchema = 1;

    /// <summary>Stable per-monitor identifier: MONITORINFOEXW.szDevice, e.g. <c>\\.\DISPLAY1</c>.</summary>
    public string MonitorId { get; set; } = string.Empty;

    /// <summary>0..1 — widget left inside (work area width - widget width). PHYSICAL-px derived.</summary>
    public double NormX { get; set; }

    /// <summary>0..1 — widget top inside (work area height - widget height). PHYSICAL-px derived.</summary>
    public double NormY { get; set; }

    /// <summary>Widget width in DIPs (the WPF side of the boundary). 320 for this spike.</summary>
    public int WidthDip { get; set; }

    /// <summary>Widget height in DIPs (the WPF side of the boundary). 240 for this spike.</summary>
    public int HeightDip { get; set; }
}

/// <summary>
/// EXPERIMENTAL — reads/writes
/// <c>%APPDATA%\WorkDashboard.ShellSpike\window-normalized.experimental.json</c>.
///
/// The JSON is written by hand rather than through <see cref="JsonSerializer"/> because the
/// experiment's requirement is BYTE-compatible output with the Rust/serde_json side, and the
/// two stacks do not agree by default:
///
///   * <c>Utf8JsonWriter</c> with <c>WriteIndented</c> emits <see cref="Environment.NewLine"/>
///     (CRLF on Windows); <c>serde_json::to_string_pretty</c> always emits LF.
///   * .NET writes the double 0.0 as <c>0</c> and 1.0 as <c>1</c>; serde_json (ryu) writes
///     <c>0.0</c> and <c>1.0</c>, and drops into exponent form (<c>1e-6</c>) below 1e-5
///     where .NET's fixed formats do not.
///   * <c>JavaScriptEncoder.Default</c> escapes far more characters than serde does.
///
/// So this writer pins an explicit byte contract, which the Tauri side has to match:
///   - UTF-8, no BOM, LF line endings, two-space indent, no trailing newline
///   - key order: schema, monitorId, normX, normY, widthDip, heightDip
///   - schema/widthDip/heightDip are integers
///   - normX/normY are rounded to 6 decimals and printed the way ryu prints them
///     (fixed-point with 1..6 decimals; exponent form only below 1e-5)
///   - strings escape only <c>"</c>, <c>\</c> and control characters (serde's rule)
/// The READER is deliberately tolerant: it accepts any JSON number form, so a file written
/// by a differently-formatted producer still loads.
///
/// NOT TESTED: no file written by the Tauri prototype exists in this container, so the
/// byte-for-byte match between the two producers has not been observed, only specified.
/// </summary>
internal static class MonitorNormalizedPlacementStore
{
    private const string FolderName = "WorkDashboard.ShellSpike";
    private const string FileName = "window-normalized.experimental.json";

    /// <summary>Decimals kept for normX/normY. 1e-6 of a 4K width is well under one pixel.</summary>
    private const int NormalizedDecimals = 6;

    internal static string DirectoryPath =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            FolderName);

    internal static string FilePath => Path.Combine(DirectoryPath, FileName);

    /// <summary>Clamp to 0..1 and round to the byte contract's precision.</summary>
    internal static double Normalize(double value)
    {
        if (double.IsNaN(value))
        {
            return 0.0;
        }

        if (value < 0.0) value = 0.0;
        if (value > 1.0) value = 1.0;

        return Math.Round(value, NormalizedDecimals, MidpointRounding.AwayFromZero);
    }

    /// <summary>
    /// Reproduces, for the 0..1 values this record can hold, exactly what
    /// <c>serde_json</c> (ryu) prints for the same double. MEASURED against
    /// <c>serde_json 1.0.151</c> in this container, not assumed:
    ///
    ///   * fixed-point with at least one decimal, so 0 -&gt; <c>0.0</c> and 1 -&gt; <c>1.0</c>
    ///     (.NET's own shortest form would print <c>0</c> and <c>1</c>);
    ///   * trailing zeros suppressed, so 0.7333 -&gt; <c>0.7333</c>;
    ///   * ryu switches to exponent notation once the value drops below 1e-5
    ///     (measured: 0.00001 -&gt; <c>0.00001</c>, but 9e-6 -&gt; <c>9e-6</c>, 1e-6 -&gt; <c>1e-6</c>).
    ///     After the 6-decimal rounding above, every such value is exactly k*1e-6 for
    ///     k = 1..9, so the branch is closed-form.
    /// </summary>
    private static string FormatNormalized(double value)
    {
        double v = Normalize(value);

        if (v <= 0.0)
        {
            return "0.0";
        }

        if (v < 1e-5)
        {
            int k = (int)Math.Round(v * 1_000_000.0, MidpointRounding.AwayFromZero);
            if (k <= 0)
            {
                return "0.0";
            }

            if (k < 10)
            {
                return k.ToString(CultureInfo.InvariantCulture) + "e-6";
            }
        }

        return v.ToString("0.0#####", CultureInfo.InvariantCulture);
    }

    /// <summary>serde_json's string escaping rule, nothing broader.</summary>
    private static string EscapeJsonString(string value)
    {
        var sb = new StringBuilder(value.Length + 8);
        foreach (char c in value)
        {
            switch (c)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\b': sb.Append("\\b"); break;
                case '\f': sb.Append("\\f"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (c < 0x20)
                    {
                        sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                    }
                    else
                    {
                        sb.Append(c);
                    }

                    break;
            }
        }

        return sb.ToString();
    }

    /// <summary>The exact bytes (as text) this experiment agrees to produce.</summary>
    internal static string Serialize(MonitorNormalizedPlacement record)
    {
        var sb = new StringBuilder(160);
        sb.Append("{\n");
        sb.Append("  \"schema\": ")
          .Append(MonitorNormalizedPlacement.CurrentSchema.ToString(CultureInfo.InvariantCulture))
          .Append(",\n");
        sb.Append("  \"monitorId\": \"").Append(EscapeJsonString(record.MonitorId)).Append("\",\n");
        sb.Append("  \"normX\": ").Append(FormatNormalized(record.NormX)).Append(",\n");
        sb.Append("  \"normY\": ").Append(FormatNormalized(record.NormY)).Append(",\n");
        sb.Append("  \"widthDip\": ")
          .Append(record.WidthDip.ToString(CultureInfo.InvariantCulture))
          .Append(",\n");
        sb.Append("  \"heightDip\": ")
          .Append(record.HeightDip.ToString(CultureInfo.InvariantCulture))
          .Append('\n');
        sb.Append('}');
        return sb.ToString();
    }

    /// <summary>Returns null when there is no usable experimental record.</summary>
    internal static MonitorNormalizedPlacement? Load()
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

            using JsonDocument doc = JsonDocument.Parse(json);
            JsonElement root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            if (!root.TryGetProperty("schema", out JsonElement schema) ||
                schema.ValueKind != JsonValueKind.Number ||
                !schema.TryGetInt32(out int schemaValue) ||
                schemaValue != MonitorNormalizedPlacement.CurrentSchema)
            {
                return null;
            }

            if (!root.TryGetProperty("monitorId", out JsonElement monitorId) ||
                monitorId.ValueKind != JsonValueKind.String)
            {
                return null;
            }

            string? id = monitorId.GetString();
            if (string.IsNullOrEmpty(id))
            {
                return null;
            }

            if (!TryReadFinite(root, "normX", out double normX) ||
                !TryReadFinite(root, "normY", out double normY) ||
                !TryReadFinite(root, "widthDip", out double widthDip) ||
                !TryReadFinite(root, "heightDip", out double heightDip))
            {
                return null;
            }

            if (widthDip < 1 || heightDip < 1)
            {
                return null;
            }

            return new MonitorNormalizedPlacement
            {
                MonitorId = id,
                NormX = Normalize(normX),
                NormY = Normalize(normY),
                WidthDip = (int)Math.Round(widthDip, MidpointRounding.AwayFromZero),
                HeightDip = (int)Math.Round(heightDip, MidpointRounding.AwayFromZero),
            };
        }
        catch (Exception)
        {
            // A corrupt experimental file must never affect the default path.
            return null;
        }
    }

    private static bool TryReadFinite(JsonElement root, string name, out double value)
    {
        value = 0.0;

        if (!root.TryGetProperty(name, out JsonElement element) ||
            element.ValueKind != JsonValueKind.Number ||
            !element.TryGetDouble(out double parsed) ||
            double.IsNaN(parsed) || double.IsInfinity(parsed))
        {
            return false;
        }

        value = parsed;
        return true;
    }

    internal static bool Save(MonitorNormalizedPlacement record)
    {
        try
        {
            Directory.CreateDirectory(DirectoryPath);

            // UTF-8 without BOM, and the string already carries LF only.
            byte[] bytes = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false)
                .GetBytes(Serialize(record));

            string tmp = FilePath + ".tmp";
            File.WriteAllBytes(tmp, bytes);
            File.Move(tmp, FilePath, overwrite: true);
            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }
}
