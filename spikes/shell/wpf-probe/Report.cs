namespace ShellSpike.Probe;

/// <summary>
/// The spike's result vocabulary, unchanged: PASS / FAIL / NOT TESTED / NOT APPLICABLE.
/// <c>NotTested</c> exists so the probe can name a primitive it deliberately did not attempt
/// - it needs an interactive desktop - without dressing it up as a pass.
/// </summary>
internal enum Verdict
{
    Pass,
    Fail,
    NotTested,
    NotApplicable,
}

internal static class VerdictText
{
    internal static string Label(this Verdict v) => v switch
    {
        Verdict.Pass => "PASS",
        Verdict.Fail => "FAIL",
        Verdict.NotTested => "NOT TESTED",
        _ => "NOT APPLICABLE",
    };
}

internal sealed record Check(string Name, Verdict Verdict, string Detail);

/// <summary>
/// One probe run. Mirrors the Rust side's <c>win32_probe::Report</c>, including the check
/// names, so the two artifacts can be read side by side.
/// </summary>
internal sealed class Report
{
    private readonly List<Check> _checks = new();
    private readonly List<string> _notes = new();

    internal IReadOnlyList<Check> Checks => _checks;

    internal void Record(string name, bool ok, string detail)
        => _checks.Add(new Check(name, ok ? Verdict.Pass : Verdict.Fail, detail));

    internal void NotTested(string name, string detail)
        => _checks.Add(new Check(name, Verdict.NotTested, detail));

    internal void NotApplicable(string name, string detail)
        => _checks.Add(new Check(name, Verdict.NotApplicable, detail));

    internal void Note(string text) => _notes.Add(text);

    internal int Count(Verdict v) => _checks.Count(c => c.Verdict == v);

    internal int Failures => Count(Verdict.Fail);

    internal string ToText()
    {
        int width = Math.Max(4, _checks.Count == 0 ? 4 : _checks.Max(c => c.Name.Length));
        var sb = new System.Text.StringBuilder();
        foreach (Check c in _checks)
        {
            sb.Append(c.Verdict.Label().PadRight(14))
              .Append(' ')
              .Append(c.Name.PadRight(width))
              .Append("  ")
              .Append(c.Detail)
              .Append('\n');
        }

        if (_notes.Count > 0)
        {
            sb.Append('\n');
            foreach (string n in _notes)
            {
                sb.Append("note: ").Append(n).Append('\n');
            }
        }

        sb.Append('\n')
          .Append($"summary: {Count(Verdict.Pass)} PASS, {Count(Verdict.Fail)} FAIL, ")
          .Append($"{Count(Verdict.NotTested)} NOT TESTED, {Count(Verdict.NotApplicable)} NOT APPLICABLE")
          .Append('\n');
        return sb.ToString();
    }
}
