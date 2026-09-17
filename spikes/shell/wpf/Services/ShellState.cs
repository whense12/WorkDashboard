namespace ShellSpike.Services;

/// <summary>
/// The three states the spike measures. Exactly these, nothing else.
/// </summary>
internal enum ShellState
{
    /// <summary>Default. No focus steal, bottom of Z-order, drag disabled.</summary>
    Passive = 0,

    /// <summary>Clickable and focusable, drag still disabled.</summary>
    Active = 1,

    /// <summary>The only state in which the window may be dragged.</summary>
    LayoutEdit = 2,
}
