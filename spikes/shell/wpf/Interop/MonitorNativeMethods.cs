using System.Runtime.InteropServices;

namespace ShellSpike.Interop;

/// <summary>
/// EXPERIMENTAL SUPPORT — raw Win32 monitor geometry.
///
/// Added for the monitor-normalized placement EXPERIMENT only
/// (<see cref="ShellSpike.Experimental.MonitorNormalizedPlacementExperiment"/>).
/// It is deliberately a separate file from <see cref="NativeMethods"/>, which holds the
/// pre-existing shell interop: nothing in the default save/restore path calls anything here.
///
/// Everything this file returns is in PHYSICAL PIXELS (the Win32 side of the boundary).
/// WPF's <c>Window.Left</c>/<c>Top</c> are DIPs. The conversion is done explicitly in the
/// experiment file and is commented there; no value crosses the boundary implicitly.
/// </summary>
internal static class MonitorNativeMethods
{
    // ---- MonitorFromWindow / MonitorFromPoint flags -------------------------
    internal const uint MONITOR_DEFAULTTONULL    = 0x00000000;
    internal const uint MONITOR_DEFAULTTOPRIMARY = 0x00000001;
    internal const uint MONITOR_DEFAULTTONEAREST = 0x00000002;

    /// <summary>CCHDEVICENAME — the fixed WCHAR count of MONITORINFOEXW.szDevice.</summary>
    internal const int CCHDEVICENAME = 32;

    /// <summary>MONITOR_DPI_TYPE.MDT_EFFECTIVE_DPI — the scale the user sees.</summary>
    internal const int MDT_EFFECTIVE_DPI = 0;

    /// <summary>The DPI Windows calls 100%. Physical px = DIP * dpi / 96.</summary>
    internal const double DefaultDpi = 96.0;

    [StructLayout(LayoutKind.Sequential)]
    internal struct RECT
    {
        public int left;
        public int top;
        public int right;
        public int bottom;

        internal int Width => right - left;
        internal int Height => bottom - top;
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct POINT
    {
        public int x;
        public int y;
    }

    /// <summary>
    /// MONITORINFOEXW. The W form is required: szDevice is the per-monitor device name
    /// (for example <c>\\.\DISPLAY1</c>) used as the record's stable monitorId.
    /// </summary>
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    internal struct MONITORINFOEXW
    {
        public int cbSize;
        public RECT rcMonitor;  // physical px, whole monitor
        public RECT rcWork;     // physical px, work area (taskbar excluded)
        public uint dwFlags;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCHDEVICENAME)]
        public string szDevice;
    }

    internal delegate bool MonitorEnumProc(IntPtr hMonitor, IntPtr hdc, ref RECT lprcClip, IntPtr dwData);

    // ---- Imports ------------------------------------------------------------

    [DllImport("user32.dll", SetLastError = true)]
    internal static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

    [DllImport("user32.dll", SetLastError = true)]
    internal static extern IntPtr MonitorFromPoint(POINT pt, uint dwFlags);

    [DllImport("user32.dll", EntryPoint = "GetMonitorInfoW", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool GetMonitorInfoW(IntPtr hMonitor, ref MONITORINFOEXW lpmi);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr lprcClip, MonitorEnumProc lpfnEnum, IntPtr dwData);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    /// <summary>
    /// shcore!GetDpiForMonitor. Returns the effective DPI of a SPECIFIC monitor, which is
    /// what the restore path needs: the target monitor is not necessarily the one the window
    /// is on right now, so the window's own DPI is the wrong number to scale with.
    /// </summary>
    [DllImport("shcore.dll")]
    internal static extern int GetDpiForMonitor(IntPtr hmonitor, int dpiType, out uint dpiX, out uint dpiY);

    // ---- Small helpers ------------------------------------------------------

    /// <summary>Fills MONITORINFOEXW (cbSize set for you). All rects are physical px.</summary>
    internal static bool TryGetMonitorInfo(IntPtr hMonitor, out MONITORINFOEXW info)
    {
        info = default;
        if (hMonitor == IntPtr.Zero)
        {
            return false;
        }

        info.cbSize = Marshal.SizeOf<MONITORINFOEXW>();
        info.szDevice = string.Empty;
        return GetMonitorInfoW(hMonitor, ref info);
    }

    /// <summary>
    /// Effective DPI of one monitor. Falls back to 96 when shcore is unavailable or the
    /// call fails, so a missing API degrades to 100% rather than throwing.
    /// </summary>
    internal static (double DpiX, double DpiY) GetMonitorDpiOrDefault(IntPtr hMonitor)
    {
        try
        {
            if (hMonitor != IntPtr.Zero &&
                GetDpiForMonitor(hMonitor, MDT_EFFECTIVE_DPI, out uint dpiX, out uint dpiY) == 0 &&
                dpiX > 0 && dpiY > 0)
            {
                return (dpiX, dpiY);
            }
        }
        catch (DllNotFoundException)
        {
            // shcore.dll is Windows 8.1+. Fall through to 96.
        }
        catch (EntryPointNotFoundException)
        {
            // Fall through to 96.
        }

        return (DefaultDpi, DefaultDpi);
    }

    /// <summary>
    /// Looks a monitor up by MONITORINFOEXW.szDevice. Returns IntPtr.Zero when that device
    /// name is not present any more (monitor unplugged, or renumbered).
    /// </summary>
    internal static IntPtr FindMonitorByDeviceName(string deviceName)
    {
        if (string.IsNullOrEmpty(deviceName))
        {
            return IntPtr.Zero;
        }

        IntPtr found = IntPtr.Zero;

        bool Callback(IntPtr hMonitor, IntPtr hdc, ref RECT clip, IntPtr data)
        {
            if (found != IntPtr.Zero)
            {
                return false;
            }

            if (TryGetMonitorInfo(hMonitor, out MONITORINFOEXW info) &&
                string.Equals(info.szDevice, deviceName, StringComparison.Ordinal))
            {
                found = hMonitor;
                return false; // stop enumerating
            }

            return true;
        }

        MonitorEnumProc proc = Callback;
        EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, proc, IntPtr.Zero);
        GC.KeepAlive(proc);

        return found;
    }

    /// <summary>The primary monitor, via the origin of the virtual screen.</summary>
    internal static IntPtr GetPrimaryMonitor()
        => MonitorFromPoint(new POINT { x = 0, y = 0 }, MONITOR_DEFAULTTOPRIMARY);
}
