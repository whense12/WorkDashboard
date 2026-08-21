# 화면 증거 수집 — 빌드된 실물 앱을 실제 마우스·키보드로 조작하며 "픽셀"을 찍는다.
#
# '창이 존재한다'(실행 확인 단계)와 '보이고 눌리고 저장되고 꺼진다'는 다른 명제다.
# 사용자가 보고한 모든 불만 항목을 러너 화면에서 실제 입력 장치로 재연하고,
# 단계마다 스크린샷(사람 눈용)과 기계 게이트(빌드 차단용)를 남긴다.
#   A 렌더링   : 세 조각의 화면 픽셀이 검정/균일이면 실패
#   B 클릭반응 : 빈 날짜 더블클릭에 화면이 안 바뀌면 실패 ('눌러도 무반응' 검출)
#   C 저장     : 이름을 붙여넣고 파란 저장 버튼을 눌러 폼이 닫히지 않으면 실패
#   D 토글     : 미니 [업체별] 탭 클릭에 화면이 안 바뀌면 실패
#   E 설정     : 설정 버튼 클릭으로 좁은 조각이 넓어지지 않으면 실패 (모달 열림의 물증)
#   F 닫기     : Escape 로 설정이 닫혀 원래 크기로 돌아오지 않으면 실패
#   G 종료     : 세 조각을 Alt+F4 로 거뒀는데 프로세스가 살아 있으면 실패
#   H 구버전정리: 프로세스가 살아 있는 채 새로 실행했을 때 이전 PID 가 살아 있으면 실패
# 캡처는 CopyFromScreen(사용자가 보는 그대로)이 증거이고, PrintWindow 는 보조다.
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

function Save-PrintWindow([IntPtr]$hwnd, [string]$path) {
  $r = Get-Rect $hwnd
  $w = [Math]::Max(1, $r.Right - $r.Left); $h = [Math]::Max(1, $r.Bottom - $r.Top)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $hdc = $g.GetHdc()
  $ok = [W32P]::PrintWindow($hwnd, $hdc, 2)  # PW_RENDERFULLCONTENT
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

function Hit-Title([int]$x, [int]$y) {
  $pt = New-Object W32P+POINT; $pt.X = $x; $pt.Y = $y
  $root = [W32P]::GetAncestor([W32P]::WindowFromPoint($pt), 2)
  $sb = New-Object System.Text.StringBuilder 512
  [void][W32P]::GetWindowTextW($root, $sb, 512)
  return $sb.ToString()
}

# ==== 1. 세 조각을 찾고, 어느 모드로 붙었는지 기록한다 ====
# 부모가 WorkerW(배경화면 계층)면 바닥 모드(파일 뒤), 부모가 없으면 아이콘-위 모드.
$pieces = @{}
$modeLines = @()
foreach ($k in @('cal', 'mini', 'status')) {
  $p = Get-Piece $k
  if (-not $p) { Write-Host "::error::($k) 창을 찾지 못했습니다."; exit 1 }
  $pieces[$k] = $p.Key
  $r = Get-Rect $p.Key
  $par = [W32P]::GetParent($p.Key)
  $parClass = ''
  if ($par -ne [IntPtr]::Zero) {
    $sb = New-Object System.Text.StringBuilder 256
    [void][W32P]::GetClassNameW($par, $sb, 256)
    $parClass = $sb.ToString()
  }
  $mode = if ($parClass -eq 'WorkerW') { '바닥(파일 뒤)' } elseif ($parClass -eq '') { '아이콘 위' } else { "기타($parClass)" }
  $line = "($k) rect=$($r.Left),$($r.Top),$($r.Right),$($r.Bottom) 모드=$mode"
  Write-Host $line
  $modeLines += $line
}
$modeLines -join "`n" | Set-Content -Path "$OutDir/모드.txt" -Encoding utf8

# 앱이 남긴 바닥 모드 판단 기록을 증거로 복사한다 — '왜 이 모드가 됐는가'의 원문.
$floorLog = Join-Path $env:LOCALAPPDATA 'kr.go.goseong.work-calendar-helper/floor.log'
if (Test-Path $floorLog) {
  Copy-Item $floorLog "$OutDir/floor.log"
  Write-Host "--- floor.log ---"
  Get-Content $floorLog | ForEach-Object { Write-Host $_ }
  Write-Host "-----------------"
} else {
  Write-Host "floor.log 없음 — 앱이 바닥 모드 판단 기록을 남기지 않았다."
}

# ==== 2. 렌더링 증거 + 게이트 A ====
Save-Screen "$OutDir/1-바탕화면-전체.png"
foreach ($k in @('cal', 'mini', 'status')) {
  Save-ScreenCrop "$OutDir/1-바탕화면-전체.png" (Get-Rect $pieces[$k]) "$OutDir/1-조각-$k.png"
  [void](Save-PrintWindow $pieces[$k] "$OutDir/보조-printwindow-$k.png")
  $s = Get-Stats "$OutDir/1-조각-$k.png"
  Write-Host "($k) 평균밝기 $($s.Avg), 검정 $($s.DarkPct)%"
  if ($s.Avg -lt 50 -or $s.DarkPct -gt 60) {
    $failures.Add("A: ($k) 조각이 화면에 그려지지 않았습니다 (검정/균일).")
  }
}
if ($failures.Count -gt 0) {
  foreach ($f in $failures) { Write-Host "::error::$f" }
  exit 1  # 안 그려지는 화면에서는 이후 조작 증명이 무의미하다.
}

# ==== 3. 빈 날짜 더블클릭 + 게이트 B ====
$cr = Get-Rect $pieces['cal']
$cx = [int]($cr.Left + 0.42 * ($cr.Right - $cr.Left))
$cy = [int]($cr.Top + 0.58 * ($cr.Bottom - $cr.Top))
Write-Host "더블클릭 지점 ($cx,$cy) 의 창: '$(Hit-Title $cx $cy)'"
Click $cx $cy 2
Start-Sleep -Seconds 3
Save-Screen "$OutDir/2-더블클릭-후-전체.png"
Save-ScreenCrop "$OutDir/2-더블클릭-후-전체.png" (Get-Rect $pieces['cal']) "$OutDir/2-일정추가-폼.png"
$d = Get-DiffPct "$OutDir/1-조각-cal.png" "$OutDir/2-일정추가-폼.png"
Write-Host "더블클릭 전후 변화: $d%"
if ($d -lt 2) { $failures.Add("B: 더블클릭에 화면이 반응하지 않았습니다 ($d%).") }

# ==== 4. 이름 붙여넣기 → 파란 저장 버튼 클릭 + 게이트 C ====
Set-Clipboard -Value '현장확인'
[System.Windows.Forms.SendKeys]::SendWait('^v')
Start-Sleep -Milliseconds 800
Save-Screen "$OutDir/3-이름입력-전체.png"
Save-ScreenCrop "$OutDir/3-이름입력-전체.png" (Get-Rect $pieces['cal']) "$OutDir/3-이름입력.png"
$blob = Find-BlueBlob "$OutDir/3-이름입력.png" 0.78
if (-not $blob) {
  $failures.Add("C: 저장 버튼(파란 띠)을 화면에서 찾지 못했습니다.")
} else {
  $bx = $cr.Left + $blob.X; $by = $cr.Top + $blob.Y
  Write-Host "저장 버튼 추정 ($bx,$by), 띠 길이 $($blob.Len)px"
  Click $bx $by 1
  Start-Sleep -Seconds 3
  Save-Screen "$OutDir/4-저장후-전체.png"
  Save-ScreenCrop "$OutDir/4-저장후-전체.png" (Get-Rect $pieces['cal']) "$OutDir/4-저장후-달력.png"
  $d = Get-DiffPct "$OutDir/3-이름입력.png" "$OutDir/4-저장후-달력.png"
  Write-Host "저장 전후 변화: $d%  (폼이 닫히고 달력에 일정이 실려야 한다)"
  if ($d -lt 5) { $failures.Add("C: 저장 버튼을 눌러도 폼이 닫히지 않았습니다 ($d%).") }
}

# ==== 5. 미니 [업체별] 토글 + 게이트 D ====
# 지난 실행의 실측: 상단+20px 는 탭 버튼의 윗변 경계에 걸려 호버조차 안 떴다.
# 버튼 세로 중심(+30px)을 누르고, 첫 클릭이 창 활성화로 소비되는 환경까지 대비해
# 카드 목록의 빈 자리를 먼저 한 번 눌러 조각을 깨운다.
$mr = Get-Rect $pieces['mini']
Save-Screen "$OutDir/틈-전체.png"
Save-ScreenCrop "$OutDir/틈-전체.png" $mr "$OutDir/5-미니-토글전.png"
Click ([int]($mr.Left + 0.5 * ($mr.Right - $mr.Left))) ([int]($mr.Top + 0.62 * ($mr.Bottom - $mr.Top))) 1
Start-Sleep -Milliseconds 500
$tx = [int]($mr.Left + 0.29 * ($mr.Right - $mr.Left)); $ty = $mr.Top + 30
Write-Host "토글 클릭 지점 ($tx,$ty) 의 창: '$(Hit-Title $tx $ty)'"
Click $tx $ty 1
Start-Sleep -Seconds 2
Save-Screen "$OutDir/5-토글후-전체.png"
Save-ScreenCrop "$OutDir/5-토글후-전체.png" (Get-Rect $pieces['mini']) "$OutDir/5-미니-업체별.png"
$d = Get-DiffPct "$OutDir/5-미니-토글전.png" "$OutDir/5-미니-업체별.png"
Write-Host "토글 전후 변화: $d%"
if ($d -lt 2) { $failures.Add("D: [업체별] 토글에 화면이 반응하지 않았습니다 ($d%).") }

# ==== 6. 설정 열기(조각이 넓어짐) + 게이트 E — 제목의 버전은 스크린샷으로 남는다 ====
# 좁은 조각은 모달이 열리면 680 논리폭으로 잠깐 넓어진다. 오른쪽 일부가 화면 밖으로
# 나가도 모달 제목(버전 표시)은 왼쪽에 있어 스크린샷에 남는다. 조각을 옮기면
# 달력과 겹쳐 클릭이 엉뚱한 창에 갈 수 있으므로 옮기지 않는다.
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
$wClosed = $mr3.Right - $mr3.Left
Write-Host "Escape 후 조각 폭: $wClosed"
if ($wClosed -gt $wBefore + 50) { $failures.Add("F: Escape 로 설정이 닫히지 않았습니다.") }

# ==== 7.5 '바닥'의 사용상 핵심: 다른 프로그램이 조각 위에 온다 + 게이트 I ====
# 메모장을 실제로 띄워 달력 한가운데에 겹친다. (1) 메모장이 달력을 덮어야 하고,
# (2) 달력의 다른 자리를 클릭해도 달력이 메모장 위로 떠오르지 않아야 한다.
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
  Save-Screen "$OutDir/8-메모장이-달력을-덮음.png"
  $pt = New-Object W32P+POINT; $pt.X = $ncx; $pt.Y = $ncy
  $hit1 = [W32P]::GetAncestor([W32P]::WindowFromPoint($pt), 2)
  if ($hit1 -ne $np.MainWindowHandle) {
    $failures.Add("I: 메모장을 달력 위에 놓았는데 달력이 메모장을 가립니다 — 조각이 바닥이 아닙니다.")
  } else {
    # 달력의 메모장 밖 자리를 실제로 클릭해도(활성화) 조각이 위로 떠오르면 안 된다.
    Click ($cr2.Left + 40) ($cr2.Bottom - 60) 1
    Start-Sleep -Milliseconds 900
    $hit2 = [W32P]::GetAncestor([W32P]::WindowFromPoint($pt), 2)
    Save-Screen "$OutDir/9-달력-클릭후에도-메모장이-위.png"
    if ($hit2 -ne $np.MainWindowHandle) {
      $failures.Add("I: 달력을 클릭하자 조각이 메모장 위로 떠올랐습니다 — 항상-아래가 깨졌습니다.")
    } else {
      Write-Host "겹침 확인 — 조각은 클릭해도 다른 프로그램 아래에 머문다."
    }
  }
  Stop-Process -Name notepad -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 800
}

# ==== 8. 세 조각 Alt+F4 → 앱 스스로 종료 + 게이트 G ====
# 각 조각의 상호작용 없는 자리를 클릭해 포커스를 준 뒤 Alt+F4.
$safe = @{
  cal    = @{ fx = 0.48; dy = 25 }   # 헤더의 안내 문구 자리
  status = @{ fx = 0.30; dy = 14 }   # '현황' 제목 자리
  mini   = @{ fx = 0.55; dy = 20 }   # 탭과 D-day 사이 빈 자리
}
foreach ($k in @('cal', 'status', 'mini')) {
  $r = Get-Rect $pieces[$k]
  Click ([int]($r.Left + $safe[$k].fx * ($r.Right - $r.Left))) ($r.Top + $safe[$k].dy) 1
  Start-Sleep -Milliseconds 400
  [System.Windows.Forms.SendKeys]::SendWait('%{F4}')
  Start-Sleep -Milliseconds 900
}
Start-Sleep -Seconds 6
$alive = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
if ($alive) {
  $failures.Add("G: 세 조각을 Alt+F4 로 거뒀는데 앱이 종료되지 않았습니다.")
  Stop-Process -Name $ProcessName -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
} else {
  Write-Host "종료 확인 — 마지막 조각을 거두자 프로세스가 스스로 끝났다."
}

# ==== 9. 구버전 정리: 살아 있는 채 새로 실행하면 이전 PID 가 죽는다 + 게이트 H ====
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
    Save-Screen "$OutDir/7-재실행-후-전체.png"
    Write-Host "이전 PID $oldPid 생존: $([bool]$oldAlive) / 현재 프로세스 $($now.Count)개 / 창: $titles"
    if ($oldAlive) { $failures.Add("H: 새 실행이 이전 프로세스($oldPid)를 정리하지 못했습니다 — '재설치해도 구식 화면' 원인.") }
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
Write-Host "화면 증거 수집 완료 — 렌더링·더블클릭·저장·토글·설정·닫기·종료·구버전정리 게이트 전부 통과."
exit 0
