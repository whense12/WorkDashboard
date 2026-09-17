using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using ShellSpike.Interop;

namespace ShellSpike.Experimental;

/// <summary>
/// EXPERIMENTAL — monitor-normalized save/restore.
///
/// This is an EXPERIMENT, not a contract, and it is ADDITIVE:
/// the prototype's measured behaviour is still <c>window.json</c> + the 48x48 virtual-screen
/// check in <c>MainWindow</c>. Nothing here replaces that. SAVE runs alongside the default save
/// (it only writes a second file). RESTORE is OPT-IN and off unless the environment variable
/// <c>SHELLSPIKE_EXPERIMENT_MONITOR_NORMALIZED=1</c> is set, so the default startup path is
/// byte-for-byte the behaviour that was measured before.
///
/// THE DIP / PHYSICAL-PIXEL BOUNDARY (the thing this experiment is here to measure):
///   * <c>Window.Left</c> / <c>Window.Top</c> / <c>Window.Width</c> / <c>Window.Height</c> are DIPs.
///   * <c>GetMonitorInfoW</c>, <c>GetWindowRect</c> are PHYSICAL PIXELS.
///   * Every crossing below is an explicit, commented conversion. None is implicit.
///
/// NOT TESTED. Nothing in this file has ever run: the build host is a headless Linux
/// container with no monitors, no Win32 and no window. Compilation is the only evidence.
/// </summary>
internal static class MonitorNormalizedPlacementExperiment
{
    private const string EnableRestoreVariable = "SHELLSPIKE_EXPERIMENT_MONITOR_NORMALIZED";

    /// <summary>
    /// Opt-in switch for the EXPERIMENTAL restore path. Default OFF: unset means the prototype
    /// restores exactly the way it did before this experiment existed.
    /// </summary>
    internal static bool IsRestoreEnabled
    {
        get
        {
            try
            {
                return string.Equals(
                    Environment.GetEnvironmentVariable(EnableRestoreVariable)?.Trim(),
                    "1",
                    StringComparison.Ordinal);
            }
            catch (Exception)
            {
                return false;
            }
        }
    }

    // -----------------------------------------------------------------------
    // SAVE
    // -----------------------------------------------------------------------

    /// <summary>
    /// EXPERIMENTAL. Writes the normalized record for the monitor the widget currently sits on.
    /// Returns false whenever anything is unavailable; the caller ignores the result, because
    /// the default <c>window.json</c> save is the one that matters.
    /// </summary>
    internal static bool TrySave(Window window)
    {
        try
        {
            IntPtr hwnd = new WindowInteropHelper(window).Handle;
            if (hwnd == IntPtr.Zero)
            {
                return false;
            }

            // Which monitor is the widget on? MONITOR_DEFAULTTONEAREST so a partly off-screen
            // widget still resolves to the monitor it overlaps most.
            IntPtr hMonitor = MonitorNativeMethods.MonitorFromWindow(
                hwnd, MonitorNativeMethods.MONITOR_DEFAULTTONEAREST);

            if (!MonitorNativeMethods.TryGetMonitorInfo(hMonitor, out MonitorNativeMethods.MONITORINFOEXW info))
            {
                return false;
            }

            // PHYSICAL px, both of them - same Win32 source, so they are directly comparable
            // and no DIP conversion happens on the save path at all.
            if (!MonitorNativeMethods.GetWindowRect(hwnd, out MonitorNativeMethods.RECT windowRect))
            {
                return false;
            }

            MonitorNativeMethods.RECT work = info.rcWork; // PHYSICAL px

            // Normalize the origin against (work area size - widget size), PHYSICAL px on both
            // sides of the division, so the ratio is dimensionless and DPI-independent.
            double spanX = work.Width - windowRect.Width;
            double spanY = work.Height - windowRect.Height;

            double normX = spanX > 0 ? (windowRect.left - work.left) / spanX : 0.0;
            double normY = spanY > 0 ? (windowRect.top - work.top) / spanY : 0.0;

            // Widget size is recorded in DIPs (the WPF side of the boundary) because the
            // record has to mean the same thing on a machine with a different scale factor.
            var record = new MonitorNormalizedPlacement
            {
                MonitorId = info.szDevice ?? string.Empty,
                NormX = MonitorNormalizedPlacementStore.Normalize(normX),
                NormY = MonitorNormalizedPlacementStore.Normalize(normY),
                WidthDip = ToDipExtent(window.Width, window.ActualWidth),
                HeightDip = ToDipExtent(window.Height, window.ActualHeight),
            };

            if (string.IsNullOrEmpty(record.MonitorId) || record.WidthDip < 1 || record.HeightDip < 1)
            {
                return false;
            }

            return MonitorNormalizedPlacementStore.Save(record);
        }
        catch (Exception)
        {
            // The experiment must never be able to break the default save.
            return false;
        }
    }

    /// <summary>DIP extent, preferring the explicit Width/Height over the measured one.</summary>
    private static int ToDipExtent(double declared, double actual)
    {
        double value = double.IsNaN(declared) || declared <= 0 ? actual : declared;
        if (double.IsNaN(value) || double.IsInfinity(value) || value <= 0)
        {
            return 0;
        }

        return (int)Math.Round(value, MidpointRounding.AwayFromZero);
    }

    // -----------------------------------------------------------------------
    // RESTORE
    // -----------------------------------------------------------------------

    /// <summary>
    /// EXPERIMENTAL. Recomputes the origin from the record against the CURRENT work area and
    /// the CURRENT DPI of the target monitor, then clamps the widget fully inside it.
    /// Returns false if there is nothing usable, in which case the caller falls back to the
    /// default (unchanged) restore path.
    /// </summary>
    internal static bool TryRestore(Window window)
    {
        try
        {
            IntPtr hwnd = new WindowInteropHelper(window).Handle;
            if (hwnd == IntPtr.Zero)
            {
                return false;
            }

            MonitorNormalizedPlacement? record = MonitorNormalizedPlacementStore.Load();
            if (record is null)
            {
                return false;
            }

            // Look the monitor up by the id that was stored. If that device name is gone
            // (monitor unplugged), fall back to the PRIMARY monitor's visible area.
            IntPtr hMonitor = MonitorNativeMethods.FindMonitorByDeviceName(record.MonitorId);
            if (hMonitor == IntPtr.Zero)
            {
                hMonitor = MonitorNativeMethods.GetPrimaryMonitor();
            }

            if (!MonitorNativeMethods.TryGetMonitorInfo(hMonitor, out MonitorNativeMethods.MONITORINFOEXW info))
            {
                return false;
            }

            MonitorNativeMethods.RECT work = info.rcWork; // PHYSICAL px, CURRENT work area

            // CURRENT DPI of the TARGET monitor - not of the window, which may still be on a
            // different monitor at this point and therefore on a different scale.
            (double dpiX, double dpiY) = MonitorNativeMethods.GetMonitorDpiOrDefault(hMonitor);

            // CROSSING THE BOUNDARY (DIP -> PHYSICAL): the widget size travels as DIPs in the
            // record and has to become physical px to be placed inside a physical work area.
            double widgetPhysicalWidth = record.WidthDip * dpiX / MonitorNativeMethods.DefaultDpi;
            double widgetPhysicalHeight = record.HeightDip * dpiY / MonitorNativeMethods.DefaultDpi;

            double spanX = work.Width - widgetPhysicalWidth;
            double spanY = work.Height - widgetPhysicalHeight;

            // PHYSICAL px origin.
            double physicalX = work.left + (spanX > 0 ? record.NormX * spanX : 0.0);
            double physicalY = work.top + (spanY > 0 ? record.NormY * spanY : 0.0);

            // Clamp so the widget stays fully on that monitor. When the widget is wider than
            // the work area the max bound is below the min bound, so min wins and the widget
            // is pinned to the work-area origin rather than pushed off the left/top edge.
            physicalX = Clamp(physicalX, work.left, Math.Max(work.left, work.right - widgetPhysicalWidth));
            physicalY = Clamp(physicalY, work.top, Math.Max(work.top, work.bottom - widgetPhysicalHeight));

            // CROSSING THE BOUNDARY (PHYSICAL -> DIP): Window.Left/Top are DIPs, so the physical
            // origin must be divided by the scale before it is assigned.
            Point dip = PhysicalToDip(hwnd, physicalX, physicalY, dpiX, dpiY);

            window.Left = dip.X; // DIP
            window.Top = dip.Y;  // DIP
            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }

    private static double Clamp(double value, double min, double max)
        => value < min ? min : (value > max ? max : value);

    /// <summary>
    /// PHYSICAL px -> DIP for assignment to <c>Window.Left</c>/<c>Top</c>.
    ///
    /// Preferred source is the window's own <c>CompositionTarget.TransformFromDevice</c>, because
    /// that is the matrix WPF itself uses to map this HWND's device pixels onto its logical
    /// units; using anything else risks disagreeing with WPF by a scale factor.
    ///
    /// KNOWN HAZARD, NOT TESTED: that matrix belongs to the monitor the window is on NOW. When
    /// the restore target is a monitor with a different scale, the conversion is done with the
    /// source monitor's scale and the window only settles after Windows sends WM_DPICHANGED for
    /// the move. This is exactly the DIP/physical seam the spike is measuring; it is recorded,
    /// not papered over. The <c>dpiX</c>/<c>dpiY</c> fallback below is the target monitor's own
    /// scale and is used only when no composition target exists yet.
    /// </summary>
    private static Point PhysicalToDip(IntPtr hwnd, double physicalX, double physicalY, double dpiX, double dpiY)
    {
        HwndSource? source = HwndSource.FromHwnd(hwnd);
        CompositionTarget? target = source?.CompositionTarget;

        if (target is not null)
        {
            return target.TransformFromDevice.Transform(new Point(physicalX, physicalY));
        }

        return new Point(
            physicalX * MonitorNativeMethods.DefaultDpi / dpiX,
            physicalY * MonitorNativeMethods.DefaultDpi / dpiY);
    }
}
