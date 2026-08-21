# 화면 증거 수집 — 빌드된 실물 앱의 "픽셀"을 찍는다.
#
# '창이 존재한다'(실행 확인 단계)와 '화면에 실제로 그려져 보인다'는 다른 명제다.
# 여기서는 러너의 화면 전체를 그대로 캡처해 사람이 눈으로 볼 수 있는 증거를 남기고,
# 두 가지를 기계로도 게이트한다.
#   게이트 A(렌더링): 세 조각의 화면 영역이 검정/균일이 아니어야 한다.
#   게이트 B(반응):   달력의 빈 날짜를 실제 마우스로 더블클릭하면 화면이 바뀌어야
#                     한다(일정 추가 폼이 열린다). 안 바뀌면 '눌러도 무반응'이다.
# 캡처는 CopyFromScreen(사용자가 보는 그대로)을 증거로 삼고, 보조로 PrintWindow
# (합성 우회 렌더)를 함께 남겨 실패 시 어느 층이 문제인지 가릴 수 있게 한다.
param(
  [string]$ProcessName = 'work-calendar-helper',
  [string]$OutDir = 'proof'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class W32P {
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern IntPtr GetDesktopWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }

  public static List<KeyValuePair<IntPtr,string>> WindowsOf(uint[] pids) {
    var res = new List<KeyValuePair<IntPtr,string>>();
    EnumChildWindows(GetDesktopWindow(), (h, p) => {
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

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Get-Piece([string]$kind) {
  $procs = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
  if (-not $procs) { return $null }
  $all = [W32P]::WindowsOf([uint32[]]($procs | ForEach-Object { $_.Id }))
  return ($all | Where-Object { $_.Value -like "*($kind)*" } | Select-Object -First 1)
}

function Get-Rect([IntPtr]$hwnd) {
  $r = New-Object W32P+RECT
  [void][W32P]::GetWindowRect($hwnd, [ref]$r)
  return $r
}

function Save-Screen([string]$path) {
  $vs = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $bmp = New-Object System.Drawing.Bitmap $vs.Width, $vs.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($vs.Location, [System.Drawing.Point]::Empty, $vs.Size)
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

function Save-ScreenCrop([string]$screenPath, [W32P+RECT]$r, [string]$path) {
  $src = [System.Drawing.Bitmap]::FromFile($screenPath)
  $w = [Math]::Max(1, $r.Right - $r.Left); $h = [Math]::Max(1, $r.Bottom - $r.Top)
  $x = [Math]::Max(0, $r.Left); $y = [Math]::Max(0, $r.Top)
  $w = [Math]::Min($w, $src.Width - $x); $h = [Math]::Min($h, $src.Height - $y)
  $crop = $src.Clone((New-Object System.Drawing.Rectangle $x, $y, $w, $h), $src.PixelFormat)
  $crop.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $crop.Dispose(); $src.Dispose()
}

function Save-PrintWindow([IntPtr]$hwnd, [string]$path) {
  $r = Get-Rect $hwnd
  $w = [Math]::Max(1, $r.Right - $r.Left); $h = [Math]::Max(1, $r.Bottom - $r.Top)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $hdc = $g.GetHdc()
  # PW_RENDERFULLCONTENT(2) — WebView2 내용까지 그린다.
  $ok = [W32P]::PrintWindow($hwnd, $hdc, 2)
  $g.ReleaseHdc($hdc); $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  return $ok
}

# 밝기·검정 비율 표본 조사. GetPixel 이 느려 성긴 격자로만 본다.
function Get-Stats([string]$path) {
  $bmp = [System.Drawing.Bitmap]::FromFile($path)
  $n = 0; $dark = 0; [double]$sum = 0
  for ($y = 0; $y -lt $bmp.Height; $y += 4) {
    for ($x = 0; $x -lt $bmp.Width; $x += 4) {
      $c = $bmp.GetPixel($x, $y)
      $b = ($c.R + $c.G + $c.B) / 3.0
      $sum += $b; $n++
      if ($b -lt 25) { $dark++ }
    }
  }
  $bmp.Dispose()
  return @{ Avg = [Math]::Round($sum / $n, 1); DarkPct = [Math]::Round(100.0 * $dark / $n, 1) }
}

function Get-DiffPct([string]$a, [string]$b) {
  $ba = [System.Drawing.Bitmap]::FromFile($a); $bb = [System.Drawing.Bitmap]::FromFile($b)
  $w = [Math]::Min($ba.Width, $bb.Width); $h = [Math]::Min($ba.Height, $bb.Height)
  $n = 0; $diff = 0
  for ($y = 0; $y -lt $h; $y += 2) {
    for ($x = 0; $x -lt $w; $x += 2) {
      $ca = $ba.GetPixel($x, $y); $cb = $bb.GetPixel($x, $y)
      $d = [Math]::Abs($ca.R - $cb.R) + [Math]::Abs($ca.G - $cb.G) + [Math]::Abs($ca.B - $cb.B)
      $n++; if ($d -gt 30) { $diff++ }
    }
  }
  $ba.Dispose(); $bb.Dispose()
  return [Math]::Round(100.0 * $diff / $n, 1)
}

Add-Type -AssemblyName System.Windows.Forms

# ---- 1. 세 조각을 찾는다 ----
$pieces = @{}
foreach ($k in @('cal', 'mini', 'status')) {
  $p = Get-Piece $k
  if (-not $p) { Write-Host "::error::($k) 창을 찾지 못했습니다."; exit 1 }
  $pieces[$k] = $p.Key
  $r = Get-Rect $p.Key
  Write-Host "($k) hwnd=$($p.Key) rect=$($r.Left),$($r.Top),$($r.Right),$($r.Bottom)"
}

# ---- 2. 화면 전체 + 조각별 캡처 ----
Save-Screen "$OutDir/1-바탕화면-전체.png"
foreach ($k in @('cal', 'mini', 'status')) {
  Save-ScreenCrop "$OutDir/1-바탕화면-전체.png" (Get-Rect $pieces[$k]) "$OutDir/1-조각-$k.png"
  [void](Save-PrintWindow $pieces[$k] "$OutDir/보조-printwindow-$k.png")
}

# ---- 게이트 A: 조각이 화면에 실제로 그려져 있는가 ----
$fail = $false
foreach ($k in @('cal', 'mini', 'status')) {
  $s = Get-Stats "$OutDir/1-조각-$k.png"
  $ps = Get-Stats "$OutDir/보조-printwindow-$k.png"
  Write-Host "($k) 화면: 평균밝기 $($s.Avg), 검정 $($s.DarkPct)% / PrintWindow: 평균밝기 $($ps.Avg), 검정 $($ps.DarkPct)%"
  if ($s.Avg -lt 50 -or $s.DarkPct -gt 60) {
    Write-Host "::error::($k) 조각의 화면 픽셀이 검정/균일에 가깝습니다 — 창은 있지만 그려지지 않고 있습니다."
    $fail = $true
  }
}
if ($fail) { exit 1 }

# ---- 3. 실제 마우스로 달력의 빈 날짜를 더블클릭한다 ----
$cr = Get-Rect $pieces['cal']
$cx = [int]($cr.Left + 0.42 * ($cr.Right - $cr.Left))
$cy = [int]($cr.Top + 0.58 * ($cr.Bottom - $cr.Top))
$pt = New-Object W32P+POINT; $pt.X = $cx; $pt.Y = $cy
$hitRoot = [W32P]::GetAncestor([W32P]::WindowFromPoint($pt), 2)
$sb = New-Object System.Text.StringBuilder 512
[void][W32P]::GetWindowTextW($hitRoot, $sb, 512)
Write-Host "클릭 지점 ($cx,$cy) 에 실제로 놓인 창: '$($sb.ToString())'"

[void][W32P]::SetCursorPos($cx, $cy)
Start-Sleep -Milliseconds 200
foreach ($i in 1..2) {
  [W32P]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero)  # LEFTDOWN
  [W32P]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)  # LEFTUP
  Start-Sleep -Milliseconds 80
}
Start-Sleep -Seconds 3

Save-Screen "$OutDir/2-더블클릭-후-전체.png"
Save-ScreenCrop "$OutDir/2-더블클릭-후-전체.png" (Get-Rect $pieces['cal']) "$OutDir/2-조각-cal-더블클릭후.png"

# ---- 게이트 B: 더블클릭에 화면이 반응했는가 ----
$d = Get-DiffPct "$OutDir/1-조각-cal.png" "$OutDir/2-조각-cal-더블클릭후.png"
Write-Host "더블클릭 전후 달력 픽셀 변화: $d%"
if ($d -lt 2) {
  Write-Host "::error::빈 날짜를 더블클릭해도 화면이 바뀌지 않았습니다 — '눌러도 무반응' 상태입니다. 클릭 지점의 창: '$($sb.ToString())'"
  exit 1
}

Write-Host "화면 증거 수집 완료 — 렌더링·클릭 반응 게이트 통과."
exit 0
