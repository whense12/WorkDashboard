# E2E 에서 앱 바깥에서 확인해야 하는 것들 — 창 속성과 레지스트리.
# 앱에 테스트용 권한이나 명령을 추가하지 않으려고 Win32 를 직접 부른다.
param([Parameter(Mandatory = $true)][string]$Action, [string]$Title = '', [int]$X = 0, [int]$Y = 0)

$ErrorActionPreference = 'Stop'

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class W32 {
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr FindWindow(string c, string n);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

function Find-AppWindow([string]$needle) {
  $found = [IntPtr]::Zero
  $cb = [W32+EnumProc] {
    param($h, $p)
    if (-not [W32]::IsWindowVisible($h)) { return $true }
    $sb = New-Object System.Text.StringBuilder 512
    [void][W32]::GetWindowText($h, $sb, 512)
    if ($sb.ToString() -like "*$needle*") { $script:found = $h; return $false }
    return $true
  }
  [void][W32]::EnumWindows($cb, [IntPtr]::Zero)
  return $script:found
}

switch ($Action) {
  'topmost' {
    # WS_EX_TOPMOST = 0x8, GWL_EXSTYLE = -20
    $h = Find-AppWindow $Title
    if ($h -eq [IntPtr]::Zero) { Write-Output 'NOWINDOW'; break }
    $ex = [W32]::GetWindowLong($h, -20)
    Write-Output (($ex -band 0x8) -ne 0)
  }
  'move' {
    $h = Find-AppWindow $Title
    if ($h -eq [IntPtr]::Zero) { Write-Output 'NOWINDOW'; break }
    # SWP_NOSIZE 0x1 | SWP_NOZORDER 0x4 | SWP_NOACTIVATE 0x10
    [void][W32]::SetWindowPos($h, [IntPtr]::Zero, $X, $Y, 0, 0, 0x15)
    Start-Sleep -Milliseconds 300
    $r = New-Object W32+RECT
    [void][W32]::GetWindowRect($h, [ref]$r)
    Write-Output "$($r.Left),$($r.Top)"
  }
  'rect' {
    $h = Find-AppWindow $Title
    if ($h -eq [IntPtr]::Zero) { Write-Output 'NOWINDOW'; break }
    $r = New-Object W32+RECT
    [void][W32]::GetWindowRect($h, [ref]$r)
    Write-Output "$($r.Left),$($r.Top)"
  }
  'autostart' {
    # 자동 실행 플러그인은 HKCU 의 Run 키에 항목을 만든다.
    $k = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
    $names = (Get-Item $k).GetValueNames() | Where-Object { $_ -like '*work-calendar*' -or $_ -like '*업체별*' }
    if ($names) { Write-Output ($names -join ';') } else { Write-Output 'NONE' }
  }
  'listwindows' {
    $out = @()
    $cb = [W32+EnumProc] {
      param($h, $p)
      if ([W32]::IsWindowVisible($h)) {
        $sb = New-Object System.Text.StringBuilder 512
        [void][W32]::GetWindowText($h, $sb, 512)
        $t = $sb.ToString()
        if ($t) { $script:out += $t }
      }
      return $true
    }
    [void][W32]::EnumWindows($cb, [IntPtr]::Zero)
    Write-Output ($script:out -join '|')
  }
  default { throw "unknown action: $Action" }
}
