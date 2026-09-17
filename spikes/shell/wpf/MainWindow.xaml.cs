using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using ShellSpike.Experimental;
using ShellSpike.Interop;
using ShellSpike.Services;

namespace ShellSpike;

public partial class MainWindow : Window
{
    // Hotkey ids are process-local and arrive back as WM_HOTKEY wParam.
    private const int HotkeyIdToggleActive = 0xA001;
    private const int HotkeyIdToggleLayoutEdit = 0xA002;
    private const int HotkeyIdToggleClickThrough = 0xA003;

    // Virtual key codes.
    private const uint VK_D = 0x44;
    private const uint VK_L = 0x4C;
    private const uint VK_T = 0x54;

    private const double DefaultInset = 24.0;

    private IntPtr _hwnd = IntPtr.Zero;
    private HwndSource? _source;

    private ShellState _state = ShellState.Passive;
    private bool _clickThrough;
    private bool _suppressToggleEvents;

    private readonly bool[] _hotkeyRegistered = new bool[3];

    public MainWindow()
    {
        InitializeComponent();
    }

    // ---------------------------------------------------------------------
    // Lifetime
    // ---------------------------------------------------------------------

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);

        _hwnd = new WindowInteropHelper(this).Handle;
        _source = HwndSource.FromHwnd(_hwnd);
        _source?.AddHook(WndProc);

        ApplyBaseExStyles();
        RestorePlacement();
        RegisterHotkeys();

        ApplyState(ShellState.Passive, save: false);
    }

    protected override void OnClosed(EventArgs e)
    {
        SavePlacement();
        UnregisterHotkeys();
        _source?.RemoveHook(WndProc);
        _source = null;
        base.OnClosed(e);
    }

    // ---------------------------------------------------------------------
    // Window styles
    // ---------------------------------------------------------------------

    /// <summary>
    /// Styles that hold in every state:
    ///   WS_EX_TOOLWINDOW  -> out of Alt+Tab and out of the taskbar (the switcher policy)
    ///   not WS_EX_APPWINDOW -> make sure nothing re-adds it
    /// WS_EX_LAYERED is already set by WPF because AllowsTransparency="True";
    /// it is deliberately not touched here.
    /// </summary>
    private void ApplyBaseExStyles()
    {
        if (_hwnd == IntPtr.Zero)
        {
            return;
        }

        NativeMethods.AddExStyle(_hwnd, NativeMethods.WS_EX_TOOLWINDOW);
        NativeMethods.RemoveExStyle(_hwnd, NativeMethods.WS_EX_APPWINDOW);

        // WS_EX_TOOLWINDOW only takes effect on the next frame change.
        NativeMethods.SetWindowPos(
            _hwnd, IntPtr.Zero, 0, 0, 0, 0,
            NativeMethods.SWP_NOMOVE | NativeMethods.SWP_NOSIZE |
            NativeMethods.SWP_NOZORDER | NativeMethods.SWP_NOACTIVATE |
            NativeMethods.SWP_FRAMECHANGED);
    }

    // ---------------------------------------------------------------------
    // State machine
    // ---------------------------------------------------------------------

    private void ApplyState(ShellState next, bool save = true)
    {
        ShellState previous = _state;
        _state = next;

        if (_hwnd != IntPtr.Zero)
        {
            switch (next)
            {
                case ShellState.Passive:
                    // Never becomes the foreground window.
                    NativeMethods.AddExStyle(_hwnd, NativeMethods.WS_EX_NOACTIVATE);
                    ApplyClickThroughStyle(_clickThrough);
                    NativeMethods.NotifyFrameChanged(_hwnd);
                    NativeMethods.SendToBottom(_hwnd);
                    break;

                case ShellState.Active:
                case ShellState.LayoutEdit:
                    // Focusable and clickable. Click-through is meaningless here and is
                    // forced off so the surface cannot become unreachable.
                    NativeMethods.RemoveExStyle(_hwnd, NativeMethods.WS_EX_NOACTIVATE);
                    ApplyClickThroughStyle(false);
                    NativeMethods.NotifyFrameChanged(_hwnd);
                    NativeMethods.SetWindowPos(
                        _hwnd, NativeMethods.HWND_TOP, 0, 0, 0, 0,
                        NativeMethods.SWP_NOMOVE | NativeMethods.SWP_NOSIZE |
                        NativeMethods.SWP_NOACTIVATE);
                    Activate();
                    break;
            }
        }

        SyncToggles();

        // Leaving LAYOUT EDIT re-locks the position and persists it.
        if (save && previous == ShellState.LayoutEdit && next != ShellState.LayoutEdit)
        {
            SavePlacement();
        }
    }

    private void SyncToggles()
    {
        _suppressToggleEvents = true;
        try
        {
            // Checked == ACTIVE (including while in LAYOUT EDIT, which is an active surface).
            StateToggle.IsChecked = _state != ShellState.Passive;
            LayoutEditToggle.IsChecked = _state == ShellState.LayoutEdit;
        }
        finally
        {
            _suppressToggleEvents = false;
        }
    }

    /// <summary>
    /// The [ACTIVE / PASSIVE] shortcut. It never lands in LAYOUT EDIT, and leaving
    /// LAYOUT EDIT through it lands in ACTIVE - identical to the Tauri `toggle_active`.
    /// </summary>
    private void ToggleActivePassive()
        => ApplyState(_state switch
        {
            ShellState.Active => ShellState.Passive,
            ShellState.LayoutEdit => ShellState.Active,
            _ => ShellState.Active,
        });

    private void ToggleLayoutEdit()
        => ApplyState(_state == ShellState.LayoutEdit ? ShellState.Active : ShellState.LayoutEdit);

    // ---------------------------------------------------------------------
    // Click-through
    // ---------------------------------------------------------------------

    private void ApplyClickThroughStyle(bool on)
    {
        if (_hwnd == IntPtr.Zero)
        {
            return;
        }

        NativeMethods.SetExStyleBit(_hwnd, NativeMethods.WS_EX_TRANSPARENT, on);
    }

    /// <summary>
    /// Click-through is only meaningful in PASSIVE. There is no on-surface control for it
    /// because the shared UI spec fixes the surface to exactly two toggles, and because a
    /// click-through window cannot be clicked to turn itself back off. Global shortcut only.
    /// </summary>
    private void ToggleClickThrough()
    {
        if (_state != ShellState.Passive)
        {
            return;
        }

        // In-memory only. The window POSITION is the one and only thing this spike
        // is allowed to write to disk, so nothing is persisted here.
        _clickThrough = !_clickThrough;
        ApplyClickThroughStyle(_clickThrough);
        NativeMethods.NotifyFrameChanged(_hwnd);
    }

    // ---------------------------------------------------------------------
    // Global shortcuts
    // ---------------------------------------------------------------------

    private void RegisterHotkeys()
    {
        if (_hwnd == IntPtr.Zero)
        {
            return;
        }

        const uint mods = NativeMethods.MOD_CONTROL | NativeMethods.MOD_ALT | NativeMethods.MOD_NOREPEAT;

        // A failed RegisterHotKey means another process already owns the combination.
        // It is recorded, not thrown: the on-surface toggles still work.
        _hotkeyRegistered[0] = NativeMethods.RegisterHotKey(_hwnd, HotkeyIdToggleActive, mods, VK_D);
        _hotkeyRegistered[1] = NativeMethods.RegisterHotKey(_hwnd, HotkeyIdToggleLayoutEdit, mods, VK_L);
        _hotkeyRegistered[2] = NativeMethods.RegisterHotKey(_hwnd, HotkeyIdToggleClickThrough, mods, VK_T);
    }

    private void UnregisterHotkeys()
    {
        if (_hwnd == IntPtr.Zero)
        {
            return;
        }

        if (_hotkeyRegistered[0]) NativeMethods.UnregisterHotKey(_hwnd, HotkeyIdToggleActive);
        if (_hotkeyRegistered[1]) NativeMethods.UnregisterHotKey(_hwnd, HotkeyIdToggleLayoutEdit);
        if (_hotkeyRegistered[2]) NativeMethods.UnregisterHotKey(_hwnd, HotkeyIdToggleClickThrough);

        Array.Clear(_hotkeyRegistered);
    }

    // ---------------------------------------------------------------------
    // Window procedure hook
    // ---------------------------------------------------------------------

    private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        switch (msg)
        {
            case NativeMethods.WM_WINDOWPOSCHANGING:
                // Re-assert bottom-of-Z every time anything tries to reposition us.
                if (_state == ShellState.Passive)
                {
                    NativeMethods.WINDOWPOS wp = Marshal.PtrToStructure<NativeMethods.WINDOWPOS>(lParam);
                    wp.hwndInsertAfter = NativeMethods.HWND_BOTTOM;
                    wp.flags &= ~NativeMethods.SWP_NOZORDER;
                    wp.flags |= NativeMethods.SWP_NOACTIVATE;
                    Marshal.StructureToPtr(wp, lParam, fDeleteOld: false);
                }

                break;

            case NativeMethods.WM_MOUSEACTIVATE:
                // Clicks reach the controls, but the click never activates the window.
                if (_state == ShellState.Passive)
                {
                    handled = true;
                    return new IntPtr(NativeMethods.MA_NOACTIVATE);
                }

                break;

            case NativeMethods.WM_ACTIVATE:
                // Something activated us anyway (task switcher, SetForegroundWindow from
                // another process). Drop straight back to the bottom.
                if (_state == ShellState.Passive &&
                    ((int)wParam & 0xFFFF) != NativeMethods.WA_INACTIVE)
                {
                    NativeMethods.SendToBottom(_hwnd);
                }

                break;

            case NativeMethods.WM_DISPLAYCHANGE:
                // Resolution or monitor layout changed: make sure we are still on-screen.
                EnsureOnScreen();
                break;

            case NativeMethods.WM_HOTKEY:
                switch ((int)wParam)
                {
                    case HotkeyIdToggleActive:
                        ToggleActivePassive();
                        handled = true;
                        break;

                    case HotkeyIdToggleLayoutEdit:
                        ToggleLayoutEdit();
                        handled = true;
                        break;

                    case HotkeyIdToggleClickThrough:
                        ToggleClickThrough();
                        handled = true;
                        break;
                }

                break;
        }

        return IntPtr.Zero;
    }

    // ---------------------------------------------------------------------
    // Position: default, restore, save
    // ---------------------------------------------------------------------

    private void RestorePlacement()
    {
        // EXPERIMENTAL, OPT-IN, OFF BY DEFAULT. The monitor-normalized restore only runs when
        // SHELLSPIKE_EXPERIMENT_MONITOR_NORMALIZED=1; with the variable unset this whole
        // condition short-circuits and the default path below is exactly what it always was.
        bool restoredByExperiment =
            MonitorNormalizedPlacementExperiment.IsRestoreEnabled &&
            MonitorNormalizedPlacementExperiment.TryRestore(this);

        if (!restoredByExperiment)
        {
            // DEFAULT PATH - window.json, unchanged.
            WindowPlacement? saved = WindowPlacementStore.Load();

            if (saved is not null && IsPlacementVisible(saved.Left, saved.Top))
            {
                Left = saved.Left;
                Top = saved.Top;
            }
            else
            {
                MoveToDefaultPosition();
            }
        }

        // Click-through always starts off; it is never restored from disk.
        _clickThrough = false;
    }

    /// <summary>Work-area bottom-right, inset 24px from both edges.</summary>
    private void MoveToDefaultPosition()
    {
        Rect work = SystemParameters.WorkArea;
        Left = work.Right - Width - DefaultInset;
        Top = work.Bottom - Height - DefaultInset;
    }

    /// <summary>
    /// A saved position is only reused when a meaningful part of the window still lands
    /// inside the virtual screen - otherwise an unplugged monitor strands the window.
    /// </summary>
    private static bool IsPlacementVisible(double left, double top)
    {
        var virtualScreen = new Rect(
            SystemParameters.VirtualScreenLeft,
            SystemParameters.VirtualScreenTop,
            SystemParameters.VirtualScreenWidth,
            SystemParameters.VirtualScreenHeight);

        var candidate = new Rect(left, top, 320, 240);
        Rect overlap = Rect.Intersect(virtualScreen, candidate);

        if (overlap.IsEmpty)
        {
            return false;
        }

        // Require at least a 48x48 corner to remain grabbable.
        return overlap.Width >= 48 && overlap.Height >= 48;
    }

    private void EnsureOnScreen()
    {
        if (!IsPlacementVisible(Left, Top))
        {
            MoveToDefaultPosition();
            SavePlacement();
        }
    }

    private void SavePlacement()
    {
        // DEFAULT PATH - window.json, DIPs, unchanged.
        WindowPlacementStore.Save(new WindowPlacement
        {
            Left = Left,
            Top = Top,
        });

        // EXPERIMENTAL, ADDITIVE: writes a SECOND file (window-normalized.experimental.json).
        // Its return value is ignored on purpose - the experiment must never be able to affect
        // the default save above. It is never read back unless the opt-in variable is set.
        MonitorNormalizedPlacementExperiment.TrySave(this);
    }

    // ---------------------------------------------------------------------
    // Input
    // ---------------------------------------------------------------------

    private void RootSurface_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        // Dragging is allowed in LAYOUT EDIT and nowhere else.
        if (_state != ShellState.LayoutEdit)
        {
            return;
        }

        if (e.ButtonState != MouseButtonState.Pressed)
        {
            return;
        }

        try
        {
            DragMove();
        }
        catch (InvalidOperationException)
        {
            // DragMove throws if the button was already released. Nothing to recover.
        }
    }

    private void StateToggle_Changed(object sender, RoutedEventArgs e)
    {
        if (_suppressToggleEvents)
        {
            return;
        }

        // Leaving LAYOUT EDIT through this toggle lands in ACTIVE, not PASSIVE, so the
        // on-surface control and the global shortcut agree with each other and with Tauri.
        // It still counts as leaving LAYOUT EDIT, so the position is saved.
        if (_state == ShellState.LayoutEdit)
        {
            ApplyState(ShellState.Active);
            return;
        }

        ApplyState(StateToggle.IsChecked == true ? ShellState.Active : ShellState.Passive);
    }

    private void LayoutEditToggle_Changed(object sender, RoutedEventArgs e)
    {
        if (_suppressToggleEvents)
        {
            return;
        }

        ApplyState(LayoutEditToggle.IsChecked == true ? ShellState.LayoutEdit : ShellState.Active);
    }
}
