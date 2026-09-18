using System.Runtime.InteropServices;

namespace ShellSpike.Probe;

/// <summary>
/// The extra Win32 surface the PROBE needs and the prototype does not have.
///
/// The prototype hooks its window through <c>HwndSource.AddHook</c>, so it never declares the
/// comctl32 subclass API; and it never creates a raw window, because WPF does that for it.
/// Those declarations live here rather than in <c>wpf/Interop/</c>, so nothing in the
/// prototype's own interop surface changes for the sake of measuring it.
/// </summary>
internal static class ProbeNativeMethods
{
    internal const int GWL_EXSTYLE = -20;

    internal const uint WS_POPUP = 0x80000000;
    internal const uint WS_CLIPCHILDREN = 0x02000000;

    internal const int CW_USEDEFAULT = unchecked((int)0x80000000);

    /// <summary>WM_APP + 0x51. Reserved for the application, so nothing else can send it.</summary>
    internal const int WM_PROBE_PING = 0x8000 + 0x51;

    internal const int WM_NCDESTROY = 0x0082;

    /// <summary>VK_F24 - the least likely global hotkey to already be taken.</summary>
    internal const uint VK_F24 = 0x87;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    internal struct WNDCLASSEXW
    {
        public int cbSize;
        public uint style;
        public IntPtr lpfnWndProc;
        public int cbClsExtra;
        public int cbWndExtra;
        public IntPtr hInstance;
        public IntPtr hIcon;
        public IntPtr hCursor;
        public IntPtr hbrBackground;
        public IntPtr lpszMenuName;
        public IntPtr lpszClassName;
        public IntPtr hIconSm;
    }

    internal delegate IntPtr WndProcDelegate(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);

    /// <summary>SUBCLASSPROC - the comctl32 subclass callback signature.</summary>
    internal delegate IntPtr SubclassProcDelegate(
        IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam, IntPtr uIdSubclass, IntPtr dwRefData);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    internal static extern IntPtr GetModuleHandleW(string? lpModuleName);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    internal static extern int GetModuleFileNameW(IntPtr hModule, [Out] char[] lpFilename, int nSize);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    internal static extern ushort RegisterClassExW(ref WNDCLASSEXW lpwcx);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    internal static extern IntPtr CreateWindowExW(
        uint dwExStyle, string lpClassName, string lpWindowName, uint dwStyle,
        int x, int y, int nWidth, int nHeight,
        IntPtr hWndParent, IntPtr hMenu, IntPtr hInstance, IntPtr lpParam);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool DestroyWindow(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool UnregisterClassW(string lpClassName, IntPtr hInstance);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    internal static extern IntPtr DefWindowProcW(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    internal static extern IntPtr SendMessageW(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);

    /// <summary>
    /// The 64-bit entry point the task names explicitly. <c>NativeMethods.SetWindowLong</c>
    /// routes here on x64; this declaration exists so the probe can also call it directly and
    /// report the raw isize roundtrip.
    /// </summary>
    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)]
    internal static extern IntPtr SetWindowLongPtrW(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW", SetLastError = true)]
    internal static extern IntPtr GetWindowLongPtrW(IntPtr hWnd, int nIndex);

    /// <summary>user32!GetDpiForWindow - Windows 10 1607+.</summary>
    [DllImport("user32.dll", SetLastError = true)]
    internal static extern uint GetDpiForWindow(IntPtr hWnd);

    // ---- comctl32 subclassing ----------------------------------------------
    // Reachable only because app.manifest declares the Common-Controls 6.0.0.0 dependency.

    [DllImport("comctl32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool SetWindowSubclass(
        IntPtr hWnd, SubclassProcDelegate pfnSubclass, IntPtr uIdSubclass, IntPtr dwRefData);

    [DllImport("comctl32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool RemoveWindowSubclass(
        IntPtr hWnd, SubclassProcDelegate pfnSubclass, IntPtr uIdSubclass);

    [DllImport("comctl32.dll")]
    internal static extern IntPtr DefSubclassProc(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);

    internal static string ModulePath(string? module)
    {
        IntPtr handle = GetModuleHandleW(module);
        if (handle == IntPtr.Zero)
        {
            return string.Empty;
        }

        var buf = new char[520];
        int n = GetModuleFileNameW(handle, buf, buf.Length);
        return n <= 0 ? string.Empty : new string(buf, 0, Math.Min(n, buf.Length));
    }

    internal static string LastError()
        => new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error()).Message;
}
