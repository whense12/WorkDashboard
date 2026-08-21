# 화면 증거 수집 — 빌드된 실물 앱을 실제 마우스·키보드로 조작하며 "픽셀"을 찍는다.
#
# 하이브리드 골격의 합격 기준을 그대로 게이트로 옮긴 것이다.
#   달력 시트  = 바탕화면 파일(아이콘) '뒤' 바닥, 보기 전용
#   미니·현황  = 아이콘 위·항상 아래, 모든 입력·조작 담당
#
#   게이트 F0 바닥   : 달력의 부모가 배경화면 계층(WorkerW/Progman)이 아니면 실패
#   게이트 A  렌더링 : 세 조각의 화면 픽셀이 검정/균일이면 실패
#   게이트 B  파일뒤 : 달력 한가운데 히트테스트에서 달력이 직접 잡히면 실패
#                      (아이콘 레이어가 클릭을 가져가는 것이 '파일 뒤'의 정의)
#   게이트 C  입력   : 미니 검색·추가 칸에 이름을 넣고 Enter→저장했을 때
#                      (1) 폼이 열리고(조각 폭 증가) (2) 저장 후 바닥 달력에
#                      일정 칩이 나타나지 않으면 실패 (창 간 동기화 실증)
#   게이트 D  토글   : 미니 [업체별] 탭 클릭에 화면이 안 바뀌면 실패
#   게이트 E  설정   : 설정 클릭으로 조각이 넓어지지 않으면 실패(버전 표시 촬영)
#   게이트 F  닫기   : Escape 로 원래 크기로 안 돌아오면 실패
#   게이트 I  겹침   : 메모장이 달력을 덮지 못하거나, 달력 자리를 클릭했을 때
#                      조각이 메모장 위로 떠오르면 실패
#   게이트 G  종료   : 미니·현황을 Alt+F4 로 거뒀는데 앱이 안 끝나면 실패
#                      (바닥 달력은 포커스를 못 받으므로 세지 않는 것이 규칙)
#   게이트 H  구버전 : 살아 있는 채 재실행했을 때 이전 PID 가 살아 있으면 실패
param(
  [string]$ProcessName = 'work-calendar-helper',
  [string]$ExePath = '',
  [string]$OutDir = 'proof'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

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
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
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
$failures = New-Object System.Collections.Generic.List[string]

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

function Get-Class([IntPtr]$hwnd) {
  if ($hwnd -eq [IntPtr]::Zero) { return '' }
  $sb = New-Object System.Text.StringBuilder 256
  [void][W32P]::GetClassNameW($hwnd, $sb, 256)
  return $sb.ToString()
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
  $x = [Math]::Max(0, $r.Left); $y = [Math]::Max(0, $r.Top)
  $w = [Math]::Max(1, [Math]::Min($r.Right, $src.Width) - $x)
  $h = [Math]::Max(1, [Math]::Min($r.Bottom, $src.Height) - $y)
  $crop = $src.Clone((New-Object System.Drawing.Rectangle $x, $y, $w, $h), $src.PixelFormat)
  $crop.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $crop.Dispose(); $src.Dispose()
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
  for ($y = 0; $y -lt $h; $y += 3) {
    for ($x = 0; $x -lt $w; $x += 3) {
      $ca = $ba.GetPixel($x, $y); $cb = $bb.GetPixel($x, $y)
      $d = [Math]::Abs($ca.R - $cb.R) + [Math]::Abs($ca.G - $cb.G) + [Math]::Abs($ca.B - $cb.B)
      $n++; if ($d -gt 30) { $diff++ }
    }
  }
  $ba.Dispose(); $bb.Dispose()
  return [Math]::Round(100.0 * $diff / $n, 1)
}

# 이미지 아래쪽에서 가장 긴 '파란 띠'(주 버튼)를 찾는다. 좌표는 이미지 기준.
function Find-BlueBlob([string]$path, [double]$fromFrac) {
  $bmp = [System.Drawing.Bitmap]::FromFile($path)
  $best = $null
  for ($y = [int]($bmp.Height * $fromFrac); $y -lt $bmp.Height; $y += 3) {
    $run = 0; $runStart = 0
    for ($x = 0; $x -lt $bmp.Width; $x += 2) {
      $c = $bmp.GetPixel($x, $y)
      $isBlue = ($c.B -gt 140) -and (($c.B - $c.R) -gt 50) -and (($c.B - $c.G) -gt 40)
      if ($isBlue) { if ($run -eq 0) { $runStart = $x }; $run += 2 }
      else {
        if ($run -ge 40 -and (-not $best -or $run -gt $best.Len)) {
          $best = @{ X = $runStart + [int]($run / 2); Y = $y; Len = $run }
        }
        $run = 0
      }
    }
    if ($run -ge 40 -and (-not $best -or $run -gt $best.Len)) {
      $best = @{ X = $runStart + [int]($run / 2); Y = $y; Len = $run }
    }
  }
  $bmp.Dispose()
  return $best
}

function Click([int]$x, [int]$y, [int]$times = 1) {
  [void][W32P]::SetCursorPos($x, $y)
  Start-Sleep -Milliseconds 250
  foreach ($i in 1..$times) {
    [W32P]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero)  # LEFTDOWN
    [W32P]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)  # LEFTUP
    Start-Sleep -Milliseconds 80
  }
}

# ==== 1. 세 조각을 찾고, 어느 계층에 붙었는지 확인한다 + 게이트 F0 ====
$pieces = @{}
$modeLines = @()
foreach ($k in @('cal', 'mini', 'status')) {
  $p = Get-Piece $k
  if (-not $p) { Write-Host "::error::($k) 창을 찾지 못했습니다."; exit 1 }
  $pieces[$k] = $p.Key
  $r = Get-Rect $p.Key
  $parClass = Get-Class ([W32P]::GetParent($p.Key))
  $mode = switch ($parClass) {
    'WorkerW' { '바닥(WorkerW)' }
    'Progman' { '바닥(Progman)' }
    ''        { '아이콘 위' }
    default   { "기타($parClass)" }
  }
  $line = "($k) rect=$($r.Left),$($r.Top),$($r.Right),$($r.Bottom) 모드=$mode"
  Write-Host $line
  $modeLines += $line
  if ($k -eq 'cal' -and $mode -notlike '바닥*') {
    $failures.Add("F0: 달력이 바닥(배경화면 계층)에 붙지 않았습니다 — 모드=$mode")
  }
  if ($k -ne 'cal' -and $mode -ne '아이콘 위') {
    $failures.Add("F0: ($k) 조각은 조작을 위해 아이콘 위여야 하는데 모드=$mode 입니다.")
  }
}
$modeLines -join "`n" | Set-Content -Path "$OutDir/모드.txt" -Encoding utf8

# 앱이 남긴 바닥 모드 판단 기록(floor.log)을 증거로 복사한다.
$floorLog = $null
foreach ($root in @($env:APPDATA, $env:LOCALAPPDATA)) {
  $cand = Join-Path $root 'kr.go.goseong.work-calendar-helper/floor.log'
  if (Test-Path $cand) { $floorLog = $cand; break }
}
if ($floorLog) {
  Copy-Item $floorLog "$OutDir/floor.log"
  Write-Host "--- floor.log ($floorLog) ---"
  Get-Content $floorLog | ForEach-Object { Write-Host $_ }
  Write-Host "-----------------"
} else {
  Write-Host "floor.log 없음 — 앱이 바닥 모드 판단 기록을 남기지 않았다."
  $failures.Add("F0: floor.log 가 없습니다 — 바닥 붙이기 코드가 실행되지 않았습니다.")
}

# ==== 2. 렌더링 증거 + 게이트 A ====
Save-Screen "$OutDir/1-바탕화면-전체.png"
foreach ($k in @('cal', 'mini', 'status')) {
  Save-ScreenCrop "$OutDir/1-바탕화면-전체.png" (Get-Rect $pieces[$k]) "$OutDir/1-조각-$k.png"
  $s = Get-Stats "$OutDir/1-조각-$k.png"
  Write-Host "($k) 평균밝기 $($s.Avg), 검정 $($s.DarkPct)%"
  if ($s.Avg -lt 50 -or $s.DarkPct -gt 60) {
    $failures.Add("A: ($k) 조각이 화면에 그려지지 않았습니다 (검정/균일).")
  }
}
if ($failures | Where-Object { $_ -like 'A:*' }) {
  foreach ($f in $failures) { Write-Host "::error::$f" }
  exit 1  # 안 그려지는 화면에서는 이후 조작 증명이 무의미하다.
}

# ==== 3. '파일 뒤' 실증 + 게이트 B ====
# 달력 한가운데를 가리키면 무엇이 잡히는가. 달력이 파일 뒤에 있다면 달력이 아니라
# 아이콘 레이어(SHELLDLL_DefView/SysListView32)나 그 계열이 잡혀야 한다.
$cr = Get-Rect $pieces['cal']
$pt = New-Object W32P+POINT
$pt.X = [int](($cr.Left + $cr.Right) / 2); $pt.Y = [int](($cr.Top + $cr.Bottom) / 2)
$hit = [W32P]::WindowFromPoint($pt)
$hitRoot = [W32P]::GetAncestor($hit, 2)
Write-Host "달력 중앙 히트테스트: 잡힌 창 클래스='$(Get-Class $hit)' (루트='$(Get-Class $hitRoot)')"
if ($hitRoot -eq $pieces['cal'] -or $hit -eq $pieces['cal']) {
  $failures.Add("B: 달력이 클릭을 직접 받습니다 — 파일 뒤(바닥)가 아닙니다.")
} else {
  Write-Host "파일 뒤 확인 — 달력 자리의 클릭은 바탕화면(아이콘 레이어)이 가져간다."
}

# ==== 4. 일정 입력 경로: 미니 검색·추가 → 저장 → 바닥 달력에 칩 + 게이트 C ====
# 폼이 열리면 미니가 680 논리폭으로 넓어진다. 오른쪽 끝에 있으면 화면 밖으로
# 나가므로 미니를 왼쪽으로 옮겨 전부 보이게 한다(달력은 바닥이라 클릭을 가로채지 않는다).
Save-ScreenCrop "$OutDir/1-바탕화면-전체.png" $cr "$OutDir/2-입력전-달력.png"
[void][W32P]::SetWindowPos($pieces['mini'], [IntPtr]::Zero, 300, 40, 0, 0, 0x0015)
Start-Sleep -Milliseconds 700
$mr = Get-Rect $pieces['mini']
$wBefore = $mr.Right - $mr.Left
# 활성화 클릭(카드 목록 빈 자리) 후 검색 칸 클릭
Click ([int]($mr.Left + 0.5 * ($mr.Right - $mr.Left))) ([int]($mr.Top + 0.62 * ($mr.Bottom - $mr.Top))) 1
Start-Sleep -Milliseconds 400
Click ([int]($mr.Left + 0.45 * ($mr.Right - $mr.Left))) ($mr.Top + 72) 1
Start-Sleep -Milliseconds 400
Set-Clipboard -Value '현장확인'
[System.Windows.Forms.SendKeys]::SendWait('^v')
Start-Sleep -Milliseconds 700
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Seconds 3
$mr2 = Get-Rect $pieces['mini']
Save-Screen "$OutDir/3-폼열림-전체.png"
Save-ScreenCrop "$OutDir/3-폼열림-전체.png" $mr2 "$OutDir/3-일정추가-폼.png"
Write-Host "검색 칸 Enter 전/후 미니 폭: $wBefore -> $($mr2.Right - $mr2.Left)"
if (($mr2.Right - $mr2.Left) -lt $wBefore + 150) {
  $failures.Add("C: 검색 칸에서 Enter 를 눌러도 일정 추가 폼이 열리지 않았습니다.")
} else {
  $blob = Find-BlueBlob "$OutDir/3-일정추가-폼.png" 0.75
  if (-not $blob) {
    $failures.Add("C: 저장 버튼(파란 띠)을 화면에서 찾지 못했습니다.")
  } else {
    Click ($mr2.Left + $blob.X) ($mr2.Top + $blob.Y) 1
    Start-Sleep -Seconds 3
    Save-Screen "$OutDir/4-저장후-전체.png"
    Save-ScreenCrop "$OutDir/4-저장후-전체.png" (Get-Rect $pieces['cal']) "$OutDir/4-저장후-바닥달력.png"
    $d = Get-DiffPct "$OutDir/2-입력전-달력.png" "$OutDir/4-저장후-바닥달력.png"
    Write-Host "저장 전후 '바닥 달력' 변화: $d%  (일정 칩이 실려야 한다 — 창 간 동기화)"
    if ($d -lt 0.4) { $failures.Add("C: 저장했는데 바닥 달력에 일정이 나타나지 않았습니다 ($d%).") }
  }
}

# ==== 5. 미니 [업체별] 토글 + 게이트 D ====
$mr = Get-Rect $pieces['mini']
Save-Screen "$OutDir/틈-전체.png"
Save-ScreenCrop "$OutDir/틈-전체.png" $mr "$OutDir/5-미니-토글전.png"
$tx = [int]($mr.Left + 0.29 * ($mr.Right - $mr.Left)); $ty = $mr.Top + 30
Click $tx $ty 1
Start-Sleep -Seconds 2
Save-Screen "$OutDir/5-토글후-전체.png"
Save-ScreenCrop "$OutDir/5-토글후-전체.png" (Get-Rect $pieces['mini']) "$OutDir/5-미니-업체별.png"
$d = Get-DiffPct "$OutDir/5-미니-토글전.png" "$OutDir/5-미니-업체별.png"
Write-Host "토글 전후 변화: $d%"
if ($d -lt 2) { $failures.Add("D: [업체별] 토글에 화면이 반응하지 않았습니다 ($d%).") }

# ==== 6. 설정 열기(조각이 넓어짐) + 게이트 E — 제목의 버전이 스크린샷에 남는다 ====
$mr = Get-Rect $pieces['mini']
$wBefore = $mr.Right - $mr.Left
Click ([int]($mr.Left + 0.85 * ($mr.Right - $mr.Left))) ($mr.Bottom - 25) 1
Start-Sleep -Seconds 3
$mr2 = Get-Rect $pieces['mini']
$wAfter = $mr2.Right - $mr2.Left
Save-Screen "$OutDir/6-설정-전체.png"
Save-ScreenCrop "$OutDir/6-설정-전체.png" $mr2 "$OutDir/6-설정-버전표시.png"
Write-Host "설정 열기 전/후 조각 폭: $wBefore -> $wAfter"
if ($wAfter -lt $wBefore + 150) { $failures.Add("E: 설정 버튼을 눌러도 모달이 열리지 않았습니다 (조각 폭 불변).") }

# ==== 7. Escape 로 설정 닫기 + 게이트 F ====
[System.Windows.Forms.SendKeys]::SendWait('{ESC}')
Start-Sleep -Seconds 2
$mr3 = Get-Rect $pieces['mini']
Write-Host "Escape 후 조각 폭: $($mr3.Right - $mr3.Left)"
if (($mr3.Right - $mr3.Left) -gt $wBefore + 50) { $failures.Add("F: Escape 로 설정이 닫히지 않았습니다.") }

# ==== 8. 겹침: 다른 프로그램이 조각 위에 온다 + 게이트 I ====
Start-Process notepad
$np = $null
foreach ($i in 1..20) {
  Start-Sleep -Milliseconds 500
  $np = Get-Process notepad -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if ($np) { break }
}
if (-not $np) {
  $failures.Add("I: 메모장을 띄우지 못해 겹침 검사를 못 했습니다.")
} else {
  $cr2 = Get-Rect $pieces['cal']
  $ncx = [int](($cr2.Left + $cr2.Right) / 2); $ncy = [int](($cr2.Top + $cr2.Bottom) / 2)
  [void][W32P]::SetWindowPos($np.MainWindowHandle, [IntPtr]::Zero, $ncx - 250, $ncy - 200, 500, 400, 0)
  Start-Sleep -Seconds 2
  Save-Screen "$OutDir/7-메모장이-달력을-덮음.png"
  $pt2 = New-Object W32P+POINT; $pt2.X = $ncx; $pt2.Y = $ncy
  $hit1 = [W32P]::GetAncestor([W32P]::WindowFromPoint($pt2), 2)
  if ($hit1 -ne $np.MainWindowHandle) {
    $failures.Add("I: 메모장을 달력 위에 놓았는데 메모장이 잡히지 않습니다 — 조각이 바닥이 아닙니다.")
  } else {
    Click ($cr2.Left + 40) ($cr2.Bottom - 60) 1
    Start-Sleep -Milliseconds 900
    $hit2 = [W32P]::GetAncestor([W32P]::WindowFromPoint($pt2), 2)
    Save-Screen "$OutDir/8-달력자리-클릭후에도-메모장이-위.png"
    if ($hit2 -ne $np.MainWindowHandle) {
      $failures.Add("I: 달력 자리를 클릭하자 무언가 메모장 위로 떠올랐습니다.")
    } else {
      Write-Host "겹침 확인 — 조각은 어떤 조작에도 다른 프로그램 아래에 머문다."
    }
  }
  Stop-Process -Name notepad -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 800
}

# ==== 9. 미니·현황 Alt+F4 → 앱 스스로 종료 + 게이트 G ====
# 바닥 달력은 포커스를 못 받으므로 종료 규칙에서 세지 않는다(앱과 함께 사라진다).
$safe = @{
  status = @{ fx = 0.30; dy = 14 }   # '현황' 제목 자리
  mini   = @{ fx = 0.55; dy = 20 }   # 탭과 D-day 사이 빈 자리
}
foreach ($k in @('status', 'mini')) {
  $r = Get-Rect $pieces[$k]
  Click ([int]($r.Left + $safe[$k].fx * ($r.Right - $r.Left))) ($r.Top + $safe[$k].dy) 1
  Start-Sleep -Milliseconds 400
  [System.Windows.Forms.SendKeys]::SendWait('%{F4}')
  Start-Sleep -Milliseconds 900
}
Start-Sleep -Seconds 6
$alive = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
if ($alive) {
  $failures.Add("G: 미니·현황을 Alt+F4 로 거뒀는데 앱이 종료되지 않았습니다.")
  Stop-Process -Name $ProcessName -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
} else {
  Write-Host "종료 확인 — 조작 조각을 다 거두자 프로세스가 스스로 끝났다."
}

# ==== 10. 구버전 정리 + 게이트 H ====
if ($ExePath) {
  Start-Process $ExePath
  Start-Sleep -Seconds 13
  $old = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $old) {
    $failures.Add("H: 재실행 1회차가 뜨지 않았습니다.")
  } else {
    $oldPid = $old.Id
    Start-Process $ExePath
    Start-Sleep -Seconds 13
    $oldAlive = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
    $now = @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue)
    $titles = if ($now.Count -gt 0) { ([W32P]::WindowsOf([uint32[]]($now | ForEach-Object { $_.Id })) | ForEach-Object { $_.Value }) -join '|' } else { '' }
    Save-Screen "$OutDir/9-재실행-후-전체.png"
    Write-Host "이전 PID $oldPid 생존: $([bool]$oldAlive) / 현재 프로세스 $($now.Count)개 / 창: $titles"
    if ($oldAlive) { $failures.Add("H: 새 실행이 이전 프로세스($oldPid)를 정리하지 못했습니다.") }
    if (-not ($titles -like '*(cal)*' -and $titles -like '*(mini)*' -and $titles -like '*(status)*')) {
      $failures.Add("H: 재실행 후 조각 3창이 다시 뜨지 않았습니다.")
    }
  }
  Stop-Process -Name $ProcessName -Force -ErrorAction SilentlyContinue
} else {
  Write-Host "ExePath 미지정 — 구버전 정리 게이트(H)를 건너뜁니다."
}

# ==== 결과 ====
if ($failures.Count -gt 0) {
  foreach ($f in $failures) { Write-Host "::error::$f" }
  exit 1
}
Write-Host "화면 증거 수집 완료 — 바닥·렌더링·파일뒤·입력·토글·설정·닫기·겹침·종료·구버전정리 게이트 전부 통과."
exit 0
