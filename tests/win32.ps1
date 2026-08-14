# E2E 에서 앱 바깥에서 확인해야 하는 것 — 창 속성과 레지스트리.
# 확인하려고 앱에 테스트 전용 권한이나 명령을 추가하지 않으려고 Win32 를 직접 부른다.
#
# 창은 제목이 아니라 **프로세스 이름**으로 찾는다. 창 제목이 한글이라 인자로 넘기면
# 콘솔 코드페이지에 따라 깨진다. 본 창과 도우미 창은 도우미 제목에만 있는 ASCII
# 문자열 'D-day' 로 구분한다.
param(
  [Parameter(Mandatory = $true)][ValidateSet('topmost', 'move', 'rect', 'autostart', 'listwindows')][string]$Action,
  [ValidateSet('main', 'helper')][string]$Kind = 'main',
  [int]$X = 0,
  [int]$Y = 0
)

$ErrorActionPreference = 'Stop'
$ProcessName = 'work-calendar-helper'

Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class W32 {
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }

  public static List<KeyValuePair<IntPtr,string>> WindowsOf(uint[] pids) {
    var res = new List<KeyValuePair<IntPtr,string>>();
    EnumWindows((h, p) => {
      if (!IsWindowVisible(h)) return true;
      uint wp; GetWindowThreadProcessId(h, out wp);
      if (Array.IndexOf(pids, wp) < 0) return true;
      var sb = new StringBuilder(512);
      GetWindowTextW(h, sb, 512);
      var t = sb.ToString();
      if (t.Length > 0) res.Add(new KeyValuePair<IntPtr,string>(h, t));
      return true;
    }, IntPtr.Zero);
    return res;
  }
}
"@

function Get-AppWindows {
  $procs = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
  if (-not $procs) { return @() }
  return [W32]::WindowsOf([uint32[]]($procs | ForEach-Object { $_.Id }))
}

function Get-Target([string]$kind) {
  $all = Get-AppWindows
  if ($all.Count -eq 0) { return $null }
  # 도우미 창 제목에만 ASCII 'D-day' 가 들어 있다.
  if ($kind -eq 'helper') { return ($all | Where-Object { $_.Value -like '*D-day*' } | Select-Object -First 1) }
  return ($all | Where-Object { $_.Value -notlike '*D-day*' } | Select-Object -First 1)
}

switch ($Action) {
  'topmost' {
    $w = Get-Target $Kind
    if (-not $w) { Write-Output 'NOWINDOW'; break }
    # GWL_EXSTYLE = -20, WS_EX_TOPMOST = 0x8
    Write-Output ((([W32]::GetWindowLong($w.Key, -20)) -band 0x8) -ne 0)
  }
  'move' {
    $w = Get-Target $Kind
    if (-not $w) { Write-Output 'NOWINDOW'; break }
    # SWP_NOSIZE 0x1 | SWP_NOZORDER 0x4 | SWP_NOACTIVATE 0x10
    [void][W32]::SetWindowPos($w.Key, [IntPtr]::Zero, $X, $Y, 0, 0, 0x15)
    Start-Sleep -Milliseconds 400
    $r = New-Object W32+RECT
    [void][W32]::GetWindowRect($w.Key, [ref]$r)
    Write-Output "$($r.Left),$($r.Top)"
  }
  'rect' {
    $w = Get-Target $Kind
    if (-not $w) { Write-Output 'NOWINDOW'; break }
    $r = New-Object W32+RECT
    [void][W32]::GetWindowRect($w.Key, [ref]$r)
    Write-Output "$($r.Left),$($r.Top)"
  }
  'autostart' {
    # 자동 실행 플러그인은 HKCU 의 Run 키에 항목을 만든다.
    $k = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
    if (-not (Test-Path $k)) { Write-Output 'NONE'; break }
    $names = (Get-Item $k).GetValueNames()
    if ($names.Count -eq 0) { Write-Output 'NONE' } else { Write-Output ($names -join ';') }
  }
  'listwindows' {
    $all = Get-AppWindows
    if ($all.Count -eq 0) { Write-Output 'NONE' } else { Write-Output (($all | ForEach-Object { $_.Value }) -join '|') }
  }
}
