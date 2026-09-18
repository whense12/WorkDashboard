using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;

using ShellSpike.Experimental;
using ShellSpike.Interop;

namespace ShellSpike.Probe;

/// <summary>
/// Spike A - headless Win32 primitive probe, WPF/.NET side.
///
/// The counterpart of <c>tauri/src-tauri/src/win32_probe.rs</c>, with the same check names so
/// the two CI artifacts can be read side by side. The goal is NOT to pick a winner between the
/// two prototypes; it is to stop the shell interop from resting on `dotnet build` alone.
///
/// What it covers, all of which works without an interactive desktop: a hidden top-level HWND,
/// comctl32 subclass attach / callback actually invoked / remove, the WPF prototype's own
/// <c>HwndSource.AddHook</c> mechanism, a <c>SetWindowLongPtrW</c> extended-style roundtrip,
/// <c>SetWindowPos(HWND_BOTTOM)</c>, <c>RegisterHotKey</c>, monitor enumeration,
/// <c>GetMonitorInfoW</c>, <c>GetDpiForWindow</c> / <c>GetDpiForMonitor</c>, and the
/// monitor-normalized placement arithmetic including its byte contract with the Rust side.
///
/// What it does NOT cover, and never reports as PASS: click-through, focus steal, real Z-order
/// against another application, a global hotkey actually firing, Win+D, monitor hotplug, DPI
/// changes. Those stay NOT TESTED in spikes/shell/acceptance.md.
///
/// Exit codes: 0 = no FAIL, 1 = at least one primitive failed, 2 = bad arguments.
/// </summary>
internal static class Program
{
    private const string ClassName = "WorkDashboardSpikeAWin32ProbeWpf";
    private static readonly IntPtr ProbeSubclassId = new(0x5052_4F42); // 'PROB'
    private const int HotkeyId = 0x5A1;

    /// <summary>Incremented by the comctl32 subclass every time it sees WM_PROBE_PING.</summary>
    private static int _subclassHits;

    /// <summary>Incremented by the HwndSource hook every time it sees WM_PROBE_PING.</summary>
    private static int _hookHits;

    [STAThread]
    private static int Main(string[] args)
    {
        string? outFile = null;
        for (int i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--out":
                    if (i + 1 >= args.Length)
                    {
                        Console.Error.WriteLine("Win32Probe: --out needs a path");
                        return 2;
                    }

                    outFile = args[++i];
                    break;
                case "-h":
                case "--help":
                    Console.WriteLine("usage: Win32Probe [--out <file>]");
                    return 0;
                default:
                    Console.Error.WriteLine($"Win32Probe: unknown argument \"{args[i]}\"");
                    return 2;
            }
        }

        var report = new Report();
        if (!OperatingSystem.IsWindows())
        {
            report.NotApplicable("process.module_handle", "not running on Windows");
            report.Note("this build is not executing on Windows; no Win32 call was attempted");
        }
        else
        {
            Run(report);
        }

        string body = report.ToText();
        Console.WriteLine("# Spike A - WPF/Win32 headless probe");
        Console.WriteLine();
        Console.WriteLine("Measured on this machine, now. Interactive-desktop behaviour (click-through,");
        Console.WriteLine("focus steal, a hotkey actually firing, Win+D, monitor hotplug, DPI changes) is");
        Console.WriteLine("NOT part of this probe and stays NOT TESTED in spikes/shell/acceptance.md.");
        Console.WriteLine();
        Console.Write(body);

        if (outFile is not null)
        {
            try
            {
                string doc =
                    "# Spike A - WPF/Win32 headless probe\n\n" +
                    "Interactive-desktop behaviour is out of scope here and stays `NOT TESTED`.\n\n" +
                    "```\n" + body + "```\n";
                File.WriteAllText(outFile, doc);
            }
            catch (Exception e)
            {
                Console.Error.WriteLine($"Win32Probe: could not write {outFile}: {e.Message}");
                return 1;
            }
        }

        if (report.Failures > 0)
        {
            Console.Error.WriteLine($"Win32Probe: {report.Failures} primitive(s) FAILED");
            return 1;
        }

        return 0;
    }

    private static void Run(Report report)
    {
        IntPtr hInstance = ProbeNativeMethods.GetModuleHandleW(null);
        report.Record("process.module_handle", hInstance != IntPtr.Zero,
            hInstance != IntPtr.Zero ? "GetModuleHandleW(NULL) ok" : ProbeNativeMethods.LastError());
        if (hInstance == IntPtr.Zero)
        {
            return;
        }

        string image = ProbeNativeMethods.ModulePath(null);
        if (image.Length > 0)
        {
            report.Note($"running image: {image}");
        }

        // The window procedure must outlive the window that stores its function pointer, so it
        // is a local held until the end of this method (GC.KeepAlive below).
        ProbeNativeMethods.WndProcDelegate wndProc = ProbeWndProc;
        var classNamePtr = Marshal.StringToHGlobalUni(ClassName);
        ushort atom;
        try
        {
            var wc = new ProbeNativeMethods.WNDCLASSEXW
            {
                cbSize = Marshal.SizeOf<ProbeNativeMethods.WNDCLASSEXW>(),
                lpfnWndProc = Marshal.GetFunctionPointerForDelegate(wndProc),
                hInstance = hInstance,
                lpszClassName = classNamePtr,
            };
            atom = ProbeNativeMethods.RegisterClassExW(ref wc);
        }
        finally
        {
            // RegisterClassExW copies the name, so the buffer can go immediately after.
            Marshal.FreeHGlobal(classNamePtr);
        }

        report.Record("hwnd.register_class", atom != 0,
            atom != 0 ? "RegisterClassExW ok" : $"RegisterClassExW failed: {ProbeNativeMethods.LastError()}");
        if (atom == 0)
        {
            GC.KeepAlive(wndProc);
            return;
        }

        // WS_POPUP and no WS_VISIBLE: a real top-level window that is never shown.
        IntPtr hwnd = ProbeNativeMethods.CreateWindowExW(
            (uint)(NativeMethods.WS_EX_TOOLWINDOW | NativeMethods.WS_EX_NOACTIVATE),
            ClassName,
            "SpikeA Win32 probe (hidden, WPF side)",
            ProbeNativeMethods.WS_POPUP | ProbeNativeMethods.WS_CLIPCHILDREN,
            ProbeNativeMethods.CW_USEDEFAULT, ProbeNativeMethods.CW_USEDEFAULT, 320, 240,
            IntPtr.Zero, IntPtr.Zero, hInstance, IntPtr.Zero);

        report.Record("hwnd.create_hidden_toplevel", hwnd != IntPtr.Zero,
            hwnd != IntPtr.Zero
                ? "CreateWindowExW(WS_POPUP, not visible) ok"
                : $"CreateWindowExW failed: {ProbeNativeMethods.LastError()}");
        if (hwnd == IntPtr.Zero)
        {
            ProbeNativeMethods.UnregisterClassW(ClassName, hInstance);
            GC.KeepAlive(wndProc);
            return;
        }

        ProbeSubclass(report, hwnd);
        ProbeHwndSourceHook(report);
        ProbeExStyles(report, hwnd);
        ProbeZOrder(report, hwnd);
        ProbeHotkey(report, hwnd);

        if (!MonitorNativeMethods.GetWindowRect(hwnd, out MonitorNativeMethods.RECT rect))
        {
            report.Record("hwnd.get_window_rect", false, ProbeNativeMethods.LastError());
        }
        else
        {
            report.Record("hwnd.get_window_rect", true,
                $"({rect.left}, {rect.top}) {rect.Width}x{rect.Height}");
        }

        // The byte contract with the Rust writer needs no display device at all, so it runs
        // before anything monitor-dependent.
        ProbeByteContract(report);

        bool hasDisplay = ProbeMonitors(report, hwnd, out MonitorNativeMethods.MONITORINFOEXW info, out uint dpi);
        if (hasDisplay)
        {
            ProbePlacement(report, rect, info, dpi);
        }
        else
        {
            // No display device is a measurement gap, not an implementation failure.
            foreach (string name in new[]
                     {
                         "monitor.get_monitor_info",
                         "monitor.find_by_device_name",
                         "dpi.get_dpi_for_window",
                         "dpi.get_dpi_for_monitor",
                         "placement.capture",
                         "placement.resolve_on_monitor",
                         "placement.unknown_monitor_falls_back",
                     })
            {
                report.NotTested(name, "this runner reports no display device");
            }

            report.NotTested("placement.physical_monitor_hotplug",
                "needs a monitor to be physically unplugged; acceptance.md E8");
        }

        bool destroyed = ProbeNativeMethods.DestroyWindow(hwnd);
        report.Record("hwnd.destroy", destroyed,
            destroyed ? "DestroyWindow ok" : ProbeNativeMethods.LastError());
        bool unregistered = ProbeNativeMethods.UnregisterClassW(ClassName, hInstance);
        report.Record("hwnd.unregister_class", unregistered,
            unregistered ? "UnregisterClassW ok" : ProbeNativeMethods.LastError());

        GC.KeepAlive(wndProc);
    }

    /// The probe needs a window, not behaviour, so everything goes to DefWindowProcW.
    private static IntPtr ProbeWndProc(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam)
        => ProbeNativeMethods.DefWindowProcW(hWnd, msg, wParam, lParam);

    // -----------------------------------------------------------------------
    // comctl32 subclassing - the primitive the Tauri side ships in win_shell.rs
    // -----------------------------------------------------------------------

    private static void ProbeSubclass(Report report, IntPtr hwnd)
    {
        _subclassHits = 0;
        ProbeNativeMethods.SubclassProcDelegate proc = CountingSubclassProc;

        bool attached = ProbeNativeMethods.SetWindowSubclass(hwnd, proc, ProbeSubclassId, IntPtr.Zero);
        report.Record("subclass.attach", attached,
            attached ? "SetWindowSubclass ok (comctl32)" : $"SetWindowSubclass failed: {ProbeNativeMethods.LastError()}");

        string comctl = ProbeNativeMethods.ModulePath("comctl32.dll");
        if (comctl.Length > 0)
        {
            report.Note($"comctl32 in use: {comctl}");
        }

        if (!attached)
        {
            report.NotApplicable("subclass.callback_invoked", "attach failed, so invocation was never attempted");
            report.NotApplicable("subclass.callback_repeats", "attach failed");
            report.NotApplicable("subclass.remove", "attach failed");
            report.NotApplicable("subclass.remove_stops_callback", "attach failed");
            GC.KeepAlive(proc);
            return;
        }

        // SendMessageW is synchronous, so the counter is already updated when it returns.
        ProbeNativeMethods.SendMessageW(hwnd, ProbeNativeMethods.WM_PROBE_PING, IntPtr.Zero, IntPtr.Zero);
        int afterOne = Volatile.Read(ref _subclassHits);
        report.Record("subclass.callback_invoked", afterOne == 1,
            $"counter after 1 ping = {afterOne} (expected 1)");

        ProbeNativeMethods.SendMessageW(hwnd, ProbeNativeMethods.WM_PROBE_PING, IntPtr.Zero, IntPtr.Zero);
        ProbeNativeMethods.SendMessageW(hwnd, ProbeNativeMethods.WM_PROBE_PING, IntPtr.Zero, IntPtr.Zero);
        int afterThree = Volatile.Read(ref _subclassHits);
        report.Record("subclass.callback_repeats", afterThree == 3,
            $"counter after 3 pings = {afterThree} (expected 3)");

        bool removed = ProbeNativeMethods.RemoveWindowSubclass(hwnd, proc, ProbeSubclassId);
        report.Record("subclass.remove", removed,
            removed ? "RemoveWindowSubclass ok" : $"RemoveWindowSubclass failed: {ProbeNativeMethods.LastError()}");

        int beforeSilent = Volatile.Read(ref _subclassHits);
        ProbeNativeMethods.SendMessageW(hwnd, ProbeNativeMethods.WM_PROBE_PING, IntPtr.Zero, IntPtr.Zero);
        int afterSilent = Volatile.Read(ref _subclassHits);
        report.Record("subclass.remove_stops_callback", removed && afterSilent == beforeSilent,
            $"counter {beforeSilent} -> {afterSilent} (expected unchanged)");

        GC.KeepAlive(proc);
    }

    private static IntPtr CountingSubclassProc(
        IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam, IntPtr id, IntPtr refData)
    {
        if (msg == ProbeNativeMethods.WM_PROBE_PING)
        {
            Interlocked.Increment(ref _subclassHits);
        }

        return ProbeNativeMethods.DefSubclassProc(hWnd, msg, wParam, lParam);
    }

    // -----------------------------------------------------------------------
    // HwndSource.AddHook - what the WPF prototype actually uses (MainWindow.xaml.cs)
    // -----------------------------------------------------------------------

    private static void ProbeHwndSourceHook(Report report)
    {
        _hookHits = 0;
        HwndSource? source = null;
        HwndSourceHook hook = CountingHook;
        try
        {
            var parameters = new HwndSourceParameters("SpikeA probe HwndSource")
            {
                WindowStyle = unchecked((int)ProbeNativeMethods.WS_POPUP),
                ExtendedWindowStyle = NativeMethods.WS_EX_TOOLWINDOW | NativeMethods.WS_EX_NOACTIVATE,
                Width = 320,
                Height = 240,
                PositionX = 0,
                PositionY = 0,
            };
            source = new HwndSource(parameters);
            report.Record("hwndsource.create", source.Handle != IntPtr.Zero,
                $"HwndSource handle = 0x{source.Handle.ToInt64():X}");

            source.AddHook(hook);
            ProbeNativeMethods.SendMessageW(source.Handle, ProbeNativeMethods.WM_PROBE_PING, IntPtr.Zero, IntPtr.Zero);
            int afterOne = Volatile.Read(ref _hookHits);
            report.Record("hwndsource.hook_invoked", afterOne == 1,
                $"counter after 1 ping = {afterOne} (expected 1) - this is the mechanism MainWindow.xaml.cs uses");

            source.RemoveHook(hook);
            int before = Volatile.Read(ref _hookHits);
            ProbeNativeMethods.SendMessageW(source.Handle, ProbeNativeMethods.WM_PROBE_PING, IntPtr.Zero, IntPtr.Zero);
            int after = Volatile.Read(ref _hookHits);
            report.Record("hwndsource.hook_removed", after == before,
                $"counter {before} -> {after} (expected unchanged)");
        }
        catch (Exception e)
        {
            report.Record("hwndsource.create", false, $"{e.GetType().Name}: {e.Message}");
            report.NotApplicable("hwndsource.hook_invoked", "HwndSource could not be created");
            report.NotApplicable("hwndsource.hook_removed", "HwndSource could not be created");
        }
        finally
        {
            source?.Dispose();
            GC.KeepAlive(hook);
        }
    }

    private static IntPtr CountingHook(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg == ProbeNativeMethods.WM_PROBE_PING)
        {
            Interlocked.Increment(ref _hookHits);
        }

        return IntPtr.Zero;
    }

    // -----------------------------------------------------------------------
    // Extended styles, Z-order, hotkey
    // -----------------------------------------------------------------------

    private static void ProbeExStyles(Report report, IntPtr hwnd)
    {
        // Through the prototype's own helper first: that is the declaration that has to bind.
        int original = NativeMethods.GetWindowLong(hwnd, NativeMethods.GWL_EXSTYLE);
        bool transparentAbsent = (original & NativeMethods.WS_EX_TRANSPARENT) == 0;
        NativeMethods.AddExStyle(hwnd, NativeMethods.WS_EX_TRANSPARENT);
        bool set = NativeMethods.HasExStyle(hwnd, NativeMethods.WS_EX_TRANSPARENT);
        int afterSet = NativeMethods.GetWindowLong(hwnd, NativeMethods.GWL_EXSTYLE);
        report.Record("exstyle.set_and_read_back", transparentAbsent && set,
            $"0x{original:X} -> 0x{afterSet:X}, WS_EX_TRANSPARENT absent before = {transparentAbsent}, set after = {set} (NativeMethods.SetWindowLong -> SetWindowLongPtrW on x64)");

        NativeMethods.RemoveExStyle(hwnd, NativeMethods.WS_EX_TRANSPARENT);
        int restored = NativeMethods.GetWindowLong(hwnd, NativeMethods.GWL_EXSTYLE);
        report.Record("exstyle.restore", restored == original,
            $"restored 0x{restored:X}, original 0x{original:X}");

        // Then the raw 64-bit entry point the acceptance condition names, so both paths are
        // covered rather than only the helper. WS_EX_APPWINDOW is used because the probe
        // window does NOT already carry it - setting a bit that is already present would make
        // the roundtrip pass without proving anything.
        IntPtr raw = ProbeNativeMethods.GetWindowLongPtrW(hwnd, ProbeNativeMethods.GWL_EXSTYLE);
        bool absentBefore = (raw.ToInt64() & NativeMethods.WS_EX_APPWINDOW) == 0;
        IntPtr target = new(raw.ToInt64() | NativeMethods.WS_EX_APPWINDOW);
        ProbeNativeMethods.SetWindowLongPtrW(hwnd, ProbeNativeMethods.GWL_EXSTYLE, target);
        IntPtr readBack = ProbeNativeMethods.GetWindowLongPtrW(hwnd, ProbeNativeMethods.GWL_EXSTYLE);
        bool bitSet = (readBack.ToInt64() & NativeMethods.WS_EX_APPWINDOW) != 0;
        ProbeNativeMethods.SetWindowLongPtrW(hwnd, ProbeNativeMethods.GWL_EXSTYLE, raw);
        IntPtr rawRestored = ProbeNativeMethods.GetWindowLongPtrW(hwnd, ProbeNativeMethods.GWL_EXSTYLE);
        report.Record("exstyle.setwindowlongptr_roundtrip", absentBefore && bitSet && rawRestored == raw,
            $"0x{raw.ToInt64():X} -> 0x{readBack.ToInt64():X} -> 0x{rawRestored.ToInt64():X}, WS_EX_APPWINDOW absent before = {absentBefore}, set after = {bitSet}");
    }

    private static void ProbeZOrder(Report report, IntPtr hwnd)
    {
        bool ok = NativeMethods.SetWindowPos(
            hwnd, NativeMethods.HWND_BOTTOM, 0, 0, 0, 0,
            NativeMethods.SWP_NOMOVE | NativeMethods.SWP_NOSIZE | NativeMethods.SWP_NOACTIVATE);
        report.Record("zorder.setwindowpos_hwnd_bottom", ok,
            ok ? "SetWindowPos(HWND_BOTTOM, NOACTIVATE) ok" : ProbeNativeMethods.LastError());
        report.NotTested("zorder.observed_behind_other_app",
            "needs an interactive desktop and a second application; acceptance.md B5 / C1-C4");
    }

    private static void ProbeHotkey(Report report, IntPtr hwnd)
    {
        // Deliberately NOT the product's Ctrl+Alt+D: whether that specific combination is free
        // on a given machine is not what is being measured. VK_F24 with every modifier is the
        // least likely to collide, so a failure here means the API itself is unreachable.
        uint mods = NativeMethods.MOD_CONTROL | NativeMethods.MOD_ALT | NativeMethods.MOD_SHIFT
                    | NativeMethods.MOD_WIN | NativeMethods.MOD_NOREPEAT;
        bool registered = NativeMethods.RegisterHotKey(hwnd, HotkeyId, mods, ProbeNativeMethods.VK_F24);
        report.Record("hotkey.register", registered,
            registered
                ? "RegisterHotKey(Ctrl+Alt+Shift+Win+F24) ok"
                : $"RegisterHotKey failed: {ProbeNativeMethods.LastError()}");

        if (registered)
        {
            bool unregistered = NativeMethods.UnregisterHotKey(hwnd, HotkeyId);
            report.Record("hotkey.unregister", unregistered,
                unregistered ? "UnregisterHotKey ok" : ProbeNativeMethods.LastError());
        }
        else
        {
            report.NotApplicable("hotkey.unregister", "registration failed");
        }

        report.NotTested("hotkey.actually_fires",
            "needs a real key press on an interactive desktop; acceptance.md B8 / F5");
    }

    // -----------------------------------------------------------------------
    // Monitors and DPI
    // -----------------------------------------------------------------------

    private static bool ProbeMonitors(
        Report report, IntPtr hwnd, out MonitorNativeMethods.MONITORINFOEXW info, out uint dpi)
    {
        info = default;
        dpi = 0;

        int count = 0;
        bool Callback(IntPtr h, IntPtr hdc, ref MonitorNativeMethods.RECT clip, IntPtr data)
        {
            count++;
            return true;
        }

        MonitorNativeMethods.MonitorEnumProc proc = Callback;
        bool enumerated = MonitorNativeMethods.EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, proc, IntPtr.Zero);
        GC.KeepAlive(proc);
        report.Record("monitor.enumerate", enumerated,
            $"EnumDisplayMonitors returned {enumerated}, monitors = {count}");
        if (!enumerated || count < 1)
        {
            return false;
        }

        IntPtr hMonitor = MonitorNativeMethods.MonitorFromWindow(
            hwnd, MonitorNativeMethods.MONITOR_DEFAULTTONEAREST);
        bool gotInfo = MonitorNativeMethods.TryGetMonitorInfo(hMonitor, out info);
        MonitorNativeMethods.RECT work = info.rcWork;
        report.Record("monitor.get_monitor_info", gotInfo && work.Width > 0 && work.Height > 0,
            $"szDevice = \"{info.szDevice}\", rcWork = ({work.left}, {work.top}, {work.right}, {work.bottom}) -> {work.Width}x{work.Height}");

        // The restore path looks the monitor up again by its device name; if that roundtrip is
        // broken every restore silently falls back to the primary monitor.
        IntPtr found = gotInfo ? MonitorNativeMethods.FindMonitorByDeviceName(info.szDevice) : IntPtr.Zero;
        report.Record("monitor.find_by_device_name", gotInfo && found == hMonitor,
            $"FindMonitorByDeviceName(\"{info.szDevice}\") == MonitorFromWindow -> {found == hMonitor}");

        dpi = ProbeNativeMethods.GetDpiForWindow(hwnd);
        report.Record("dpi.get_dpi_for_window", dpi > 0, $"GetDpiForWindow = {dpi}");

        (double dpiX, double dpiY) = MonitorNativeMethods.GetMonitorDpiOrDefault(hMonitor);
        report.Record("dpi.get_dpi_for_monitor", dpiX > 0 && dpiY > 0,
            $"GetDpiForMonitor (shcore) = {dpiX}x{dpiY}");
        report.Note($"this runner reports {dpi} DPI; DPI *changes* (125/150/175%) still need a real desktop and stay NOT TESTED");

        return true;
    }

    // -----------------------------------------------------------------------
    // Monitor-normalized placement
    // -----------------------------------------------------------------------

    /// <summary>
    /// The byte contract between this writer and the Rust one. Both are hand-pinned to the
    /// same bytes and neither had ever been executed; this is the first time the C# half runs.
    /// No display device is involved, so it is checkable anywhere.
    /// </summary>
    private static void ProbeByteContract(Report report)
    {
        const string expected =
            "{\n" +
            "  \"schema\": 1,\n" +
            "  \"monitorId\": \"\\\\\\\\.\\\\DISPLAY1\",\n" +
            "  \"normX\": 0.5,\n" +
            "  \"normY\": 1.0,\n" +
            "  \"widthDip\": 320,\n" +
            "  \"heightDip\": 240\n" +
            "}";
        string actual = MonitorNormalizedPlacementStore.Serialize(new MonitorNormalizedPlacement
        {
            MonitorId = @"\\.\DISPLAY1",
            NormX = 0.5,
            NormY = 1.0,
            WidthDip = 320,
            HeightDip = 240,
        });
        report.Record("placement.canonical_json_matches_rust_golden", actual == expected,
            actual == expected
                ? "byte-identical to monitor_placement.rs::canonical_json_is_byte_stable"
                : $"MISMATCH - got {actual.Replace("\n", "\\n")}");

        // The float renderings the Rust golden test pins, reproduced by FormatNormalized.
        (double Value, string Want)[] floats =
        {
            (0.0, "0.0"), (1.0, "1.0"), (0.5, "0.5"),
            (0.7333, "0.7333"), (0.000009, "9e-6"), (0.00001, "0.00001"),
        };
        var badFloats = new List<string>();
        foreach ((double v, string want) in floats)
        {
            string line = MonitorNormalizedPlacementStore.Serialize(new MonitorNormalizedPlacement
            {
                MonitorId = "m",
                NormX = v,
                NormY = 0.0,
                WidthDip = 320,
                HeightDip = 240,
            });
            if (!line.Contains($"  \"normX\": {want},", StringComparison.Ordinal))
            {
                badFloats.Add($"{v} != {want}");
            }
        }

        report.Record("placement.float_rendering_matches_rust", badFloats.Count == 0,
            badFloats.Count == 0
                ? "0.0 / 1.0 / 0.5 / 0.7333 / 9e-6 / 0.00001 all render as serde_json does"
                : "mismatches: " + string.Join(", ", badFloats));
    }

    /// <summary>
    /// The monitor-normalized placement arithmetic on the real geometry of this machine.
    /// Same maths as MonitorNormalizedPlacementExperiment.TrySave / TryRestore, physical px on
    /// both sides, reproduced here because those methods need a WPF <c>Window</c>.
    /// </summary>
    private static void ProbePlacement(
        Report report, MonitorNativeMethods.RECT rect,
        MonitorNativeMethods.MONITORINFOEXW info, uint dpi)
    {
        MonitorNativeMethods.RECT work = info.rcWork;
        double spanX = work.Width - rect.Width;
        double spanY = work.Height - rect.Height;
        double normX = MonitorNormalizedPlacementStore.Normalize(
            spanX > 0 ? (rect.left - work.left) / spanX : 0.0);
        double normY = MonitorNormalizedPlacementStore.Normalize(
            spanY > 0 ? (rect.top - work.top) / spanY : 0.0);

        bool captureSane = normX is >= 0.0 and <= 1.0
                           && normY is >= 0.0 and <= 1.0
                           && !string.IsNullOrEmpty(info.szDevice);
        report.Record("placement.capture", captureSane,
            $"monitorId = \"{info.szDevice}\", normX = {normX}, normY = {normY}");

        // RESTORE side, still in physical px (the DIP conversion is WPF-Window-bound and stays
        // out of the probe). Every normal in 0..1 must land the widget fully inside rcWork.
        double dpiScale = (dpi == 0 ? 96.0 : dpi) / MonitorNativeMethods.DefaultDpi;
        double widgetW = 320 * dpiScale;
        double widgetH = 240 * dpiScale;
        var escaped = new List<string>();
        foreach (double n in new[] { 0.0, 0.5, 1.0, normX })
        {
            (double x, double y) = Resolve(work, n, n, widgetW, widgetH);
            if (!Inside(x, y, widgetW, widgetH, work))
            {
                escaped.Add($"n={n} -> ({x}, {y})");
            }
        }

        report.Record("placement.resolve_on_monitor", escaped.Count == 0,
            escaped.Count == 0
                ? $"normals 0.0 / 0.5 / 1.0 / {normX} all land fully inside rcWork at {widgetW}x{widgetH} physical px"
                : "escaped rcWork: " + string.Join(", ", escaped));

        // A monitorId that is not present any more must fall back to the PRIMARY monitor and
        // still land on-screen. The physical unplug stays NOT TESTED; the fallback does not.
        IntPtr ghost = MonitorNativeMethods.FindMonitorByDeviceName(@"\\.\DISPLAY_THAT_DOES_NOT_EXIST");
        if (ghost != IntPtr.Zero)
        {
            report.Record("placement.unknown_monitor_falls_back", false,
                "a monitor called DISPLAY_THAT_DOES_NOT_EXIST was found, which invalidates the check");
        }
        else if (!MonitorNativeMethods.TryGetMonitorInfo(
                     MonitorNativeMethods.GetPrimaryMonitor(),
                     out MonitorNativeMethods.MONITORINFOEXW primary))
        {
            report.Record("placement.unknown_monitor_falls_back", false,
                "GetPrimaryMonitor / GetMonitorInfoW gave nothing to fall back to");
        }
        else
        {
            (double x, double y) = Resolve(primary.rcWork, 1.0, 1.0, widgetW, widgetH);
            bool inside = Inside(x, y, widgetW, widgetH, primary.rcWork);
            report.Record("placement.unknown_monitor_falls_back", inside,
                $"unknown id -> primary \"{primary.szDevice}\", resolved ({x}, {y}), on-screen = {inside}");
        }

        report.NotTested("placement.physical_monitor_hotplug",
            "needs a monitor to be physically unplugged; acceptance.md E8");
    }

    /// <summary>
    /// The restore arithmetic of MonitorNormalizedPlacementExperiment.TryRestore, physical px.
    /// </summary>
    private static (double X, double Y) Resolve(
        MonitorNativeMethods.RECT work, double normX, double normY, double widgetW, double widgetH)
    {
        double spanX = work.Width - widgetW;
        double spanY = work.Height - widgetH;
        double x = work.left + (spanX > 0 ? normX * spanX : 0.0);
        double y = work.top + (spanY > 0 ? normY * spanY : 0.0);
        x = Clamp(x, work.left, Math.Max(work.left, work.right - widgetW));
        y = Clamp(y, work.top, Math.Max(work.top, work.bottom - widgetH));
        return (x, y);
    }

    private static bool Inside(
        double x, double y, double w, double h, MonitorNativeMethods.RECT work)
    {
        bool fitsX = work.Width < w ? x == work.left : x >= work.left && x + w <= work.right;
        bool fitsY = work.Height < h ? y == work.top : y >= work.top && y + h <= work.bottom;
        return fitsX && fitsY;
    }

    private static double Clamp(double value, double min, double max)
        => value < min ? min : (value > max ? max : value);
}
