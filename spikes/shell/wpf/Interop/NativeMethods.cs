using System.Runtime.InteropServices;

namespace ShellSpike.Interop;

/// <summary>
/// The whole Win32 P/Invoke surface the spike needs. Nothing here is product code;
/// it exists to measure what the Windows shell will and will not let a WPF window do.
/// </summary>
internal static class NativeMethods
{
    // ---- GetWindowLong / SetWindowLong indices -------------------------------
    internal const int GWL_EXSTYLE = -20;
    internal const int GWL_STYLE = -16;

    // ---- Extended window styles ---------------------------------------------
    internal const int WS_EX_TRANSPARENT = 0x00000020; // click-through
    internal const int WS_EX_TOOLWINDOW  = 0x00000080; // hides from Alt+Tab and taskbar
    internal const int WS_EX_APPWINDOW   = 0x00040000;
    internal const int WS_EX_NOACTIVATE  = 0x08000000; // never becomes the foreground window
    internal const int WS_EX_LAYERED     = 0x00080000;

    // ---- SetWindowPos -------------------------------------------------------
    internal static readonly IntPtr HWND_BOTTOM     = new(1);
    internal static readonly IntPtr HWND_TOP        = new(0);
    internal static readonly IntPtr HWND_TOPMOST    = new(-1);
    internal static readonly IntPtr HWND_NOTOPMOST  = new(-2);

    internal const uint SWP_NOSIZE         = 0x0001;
    internal const uint SWP_NOMOVE         = 0x0002;
    internal const uint SWP_NOZORDER       = 0x0004;
    internal const uint SWP_NOACTIVATE     = 0x0010;
    internal const uint SWP_FRAMECHANGED   = 0x0020;
    internal const uint SWP_SHOWWINDOW     = 0x0040;
    internal const uint SWP_NOOWNERZORDER  = 0x0200;

    // ---- Window messages ----------------------------------------------------
    internal const int WM_ACTIVATE          = 0x0006;
    internal const int WM_SETFOCUS          = 0x0007;
    internal const int WM_KILLFOCUS         = 0x0008;
    internal const int WM_WINDOWPOSCHANGING = 0x0046;
    internal const int WM_WINDOWPOSCHANGED  = 0x0047;
    internal const int WM_MOUSEACTIVATE     = 0x0021;
    internal const int WM_NCHITTEST         = 0x0084;
    internal const int WM_HOTKEY            = 0x0312;
    internal const int WM_DISPLAYCHANGE     = 0x007E;

    internal const int WA_INACTIVE = 0;

    // WM_MOUSEACTIVATE return values
    internal const int MA_ACTIVATE         = 1;
    internal const int MA_ACTIVATEANDEAT   = 2;
    internal const int MA_NOACTIVATE       = 3;
    internal const int MA_NOACTIVATEANDEAT = 4;

    // ---- RegisterHotKey modifiers ------------------------------------------
    internal const uint MOD_ALT      = 0x0001;
    internal const uint MOD_CONTROL  = 0x0002;
    internal const uint MOD_SHIFT    = 0x0004;
    internal const uint MOD_WIN      = 0x0008;
    internal const uint MOD_NOREPEAT = 0x4000;

    [StructLayout(LayoutKind.Sequential)]
    internal struct WINDOWPOS
    {
        public IntPtr hwnd;
        public IntPtr hwndInsertAfter;
        public int x;
        public int y;
        public int cx;
        public int cy;
        public uint flags;
    }

    // ---- Imports ------------------------------------------------------------

    [DllImport("user32.dll", EntryPoint = "GetWindowLongW", SetLastError = true)]
    private static extern int GetWindowLong32(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW", SetLastError = true)]
    private static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongW", SetLastError = true)]
    private static extern int SetWindowLong32(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)]
    private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

    /// <summary>
    /// 32/64-bit safe GetWindowLong. user32 only exports GetWindowLongPtrW on 64-bit,
    /// so the narrow entry point has to be used on x86.
    /// </summary>
    internal static int GetWindowLong(IntPtr hWnd, int nIndex)
        => IntPtr.Size == 8
            ? (int)(long)GetWindowLongPtr64(hWnd, nIndex)
            : GetWindowLong32(hWnd, nIndex);

    internal static int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong)
        => IntPtr.Size == 8
            ? (int)(long)SetWindowLongPtr64(hWnd, nIndex, new IntPtr(dwNewLong))
            : SetWindowLong32(hWnd, nIndex, dwNewLong);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool SetWindowPos(
        IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    // ---- Small helpers ------------------------------------------------------

    internal static void AddExStyle(IntPtr hWnd, int bits)
    {
        int cur = GetWindowLong(hWnd, GWL_EXSTYLE);
        SetWindowLong(hWnd, GWL_EXSTYLE, cur | bits);
    }

    internal static void RemoveExStyle(IntPtr hWnd, int bits)
    {
        int cur = GetWindowLong(hWnd, GWL_EXSTYLE);
        SetWindowLong(hWnd, GWL_EXSTYLE, cur & ~bits);
    }

    internal static void SetExStyleBit(IntPtr hWnd, int bit, bool on)
    {
        if (on) AddExStyle(hWnd, bit);
        else RemoveExStyle(hWnd, bit);
    }

    internal static bool HasExStyle(IntPtr hWnd, int bit)
        => (GetWindowLong(hWnd, GWL_EXSTYLE) & bit) == bit;

    /// <summary>Push the window to the bottom of the Z-order without activating it.</summary>
    internal static void SendToBottom(IntPtr hWnd)
        => SetWindowPos(hWnd, HWND_BOTTOM, 0, 0, 0, 0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOOWNERZORDER);

    /// <summary>
    /// A GWL_EXSTYLE write does not take effect until the next frame change, so every
    /// ex-style write site must follow up with this. SWP_NOZORDER is deliberate: this call
    /// must not compete with the separate SendToBottom / HWND_TOP call that follows it.
    /// </summary>
    internal static void NotifyFrameChanged(IntPtr hWnd)
        => SetWindowPos(hWnd, IntPtr.Zero, 0, 0, 0, 0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
}
