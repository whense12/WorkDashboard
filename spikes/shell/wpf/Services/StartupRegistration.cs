using Microsoft.Win32;

namespace ShellSpike.Services;

/// <summary>
/// Run-at-startup via HKCU\Software\Microsoft\Windows\CurrentVersion\Run.
/// Per-user, needs no elevation. Written for completeness; it cannot be
/// exercised on the Linux build host.
/// </summary>
internal static class StartupRegistration
{
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "WorkDashboardShellSpike";

    private static string? ExecutablePath => Environment.ProcessPath;

    internal static bool IsRegistered()
    {
        try
        {
            using RegistryKey? key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: false);
            return key?.GetValue(ValueName) is string s && !string.IsNullOrWhiteSpace(s);
        }
        catch (Exception)
        {
            return false;
        }
    }

    internal static bool Register()
    {
        try
        {
            string? exe = ExecutablePath;
            if (string.IsNullOrWhiteSpace(exe))
            {
                return false;
            }

            using RegistryKey key = Registry.CurrentUser.CreateSubKey(RunKeyPath, writable: true);
            // Quoted so a path containing spaces still parses.
            key.SetValue(ValueName, "\"" + exe + "\"", RegistryValueKind.String);
            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }

    internal static bool Unregister()
    {
        try
        {
            using RegistryKey? key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: true);
            if (key is null)
            {
                return true;
            }

            if (key.GetValue(ValueName) is not null)
            {
                key.DeleteValue(ValueName, throwOnMissingValue: false);
            }

            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }

    internal static bool SetRegistered(bool on) => on ? Register() : Unregister();
}
