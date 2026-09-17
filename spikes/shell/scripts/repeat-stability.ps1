<#
    repeat-stability.ps1

    Spike A 6단계: 반복 안정성. 실패 횟수와 예외를 센다.
    "대체로 됨" 같은 표현을 쓰지 않기 위해, 매 회차의 성공/실패를 기계적으로 기록한다.

    측정 대상 (두 후보 공통 단축키):
        Ctrl+Alt+D  ACTIVE <-> PASSIVE
        Ctrl+Alt+T  click-through on/off  (PASSIVE 에서만 유효)
        Ctrl+Alt+L  LAYOUT EDIT

    판정 방법: 단축키를 보낸 뒤 대상 창의 확장 스타일(WS_EX_NOACTIVATE / WS_EX_TRANSPARENT)을
    읽어 기대값과 대조한다. 화면을 눈으로 보는 대신 실제 창 상태를 읽는다.

    사용법:
        .\repeat-stability.ps1 -WindowTitle "WorkDashboard Shell Spike (WPF)" -Iterations 100
        .\repeat-stability.ps1 -WindowTitle "SpikeA Shell (Tauri)"           -Iterations 100

    작성 환경 주의: Linux 컨테이너에서 작성했고 문법 검사만 거쳤다. Windows 에서 실행된 적 없다. NOT TESTED.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string] $WindowTitle,
    [int] $Iterations = 100,
    [int] $SettleMs = 150,
    [string] $OutFile = (Join-Path $PSScriptRoot '..\results\STABILITY.md')
)

$ErrorActionPreference = 'Continue'

$interop = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class W
{
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr FindWindowW(string cls, string title);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr GetWindowLongPtrW(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    public const int GWL_EXSTYLE = -20;
    public const int WS_EX_TRANSPARENT = 0x00000020;
    public const int WS_EX_NOACTIVATE  = 0x08000000;

    public static long ExStyle(IntPtr h) { return GetWindowLongPtrW(h, GWL_EXSTYLE).ToInt64(); }
}
'@

try { Add-Type -TypeDefinition $interop -Language CSharp -ErrorAction Stop }
catch { Write-Error "interop 준비 실패: $($_.Exception.Message)"; exit 1 }

$hwnd = [W]::FindWindowW($null, $WindowTitle)
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Error "창을 찾지 못했다: '$WindowTitle'. 앱을 먼저 실행하라."
    exit 1
}
Write-Host "대상 HWND: $hwnd"

Add-Type -AssemblyName System.Windows.Forms

function Send-Chord { param([string] $Keys) [System.Windows.Forms.SendKeys]::SendWait($Keys); Start-Sleep -Milliseconds $SettleMs }

function Invoke-Trial {
    param([string] $Name, [string] $Chord, [scriptblock] $Expect, [int] $Count)
    $fail = 0
    $exceptions = @()
    for ($i = 1; $i -le $Count; $i++) {
        try {
            Send-Chord $Chord
            if (-not [W]::IsWindow($hwnd)) { $fail++; $exceptions += "회차 ${i}: 창이 사라짐"; continue }
            $ex = [W]::ExStyle($hwnd)
            if (-not (& $Expect $ex $i)) { $fail++; $exceptions += "회차 ${i}: 기대 상태 불일치 (exstyle=0x$('{0:X}' -f $ex))" }
        } catch {
            $fail++
            $exceptions += "회차 ${i}: 예외 $($_.Exception.Message)"
        }
    }
    [pscustomobject]@{ Name = $Name; Total = $Count; Fail = $fail; Exceptions = $exceptions }
}

$results = @()

# ACTIVE <-> PASSIVE: 홀수 회차는 한쪽, 짝수 회차는 반대쪽. WS_EX_NOACTIVATE 가 토글돼야 한다.
$results += Invoke-Trial -Name 'ACTIVE <-> PASSIVE (Ctrl+Alt+D)' -Chord '^%d' -Count $Iterations -Expect {
    param($ex, $i)
    $noact = ($ex -band [W]::WS_EX_NOACTIVATE) -ne 0
    # 홀수 회차 = PASSIVE 에서 벗어남(NOACTIVATE 꺼짐), 짝수 회차 = PASSIVE 복귀(켜짐)
    if ($i % 2 -eq 1) { -not $noact } else { $noact }
}

# click-through: PASSIVE 에서만 유효하므로 먼저 PASSIVE 로 맞춘다.
Send-Chord '^%d'
$exNow = [W]::ExStyle($hwnd)
if (($exNow -band [W]::WS_EX_NOACTIVATE) -eq 0) { Send-Chord '^%d' }

$results += Invoke-Trial -Name 'click-through on/off (Ctrl+Alt+T)' -Chord '^%t' -Count $Iterations -Expect {
    param($ex, $i)
    $transparent = ($ex -band [W]::WS_EX_TRANSPARENT) -ne 0
    if ($i % 2 -eq 1) { $transparent } else { -not $transparent }
}

# global shortcut 자체가 계속 살아 있는지: LAYOUT EDIT 토글을 반복하고 창이 살아있는지만 본다.
$results += Invoke-Trial -Name 'global shortcut 반응 (Ctrl+Alt+L)' -Chord '^%l' -Count $Iterations -Expect {
    param($ex, $i) [W]::IsWindow($hwnd)
}

# ---- 출력 ----
$sb = [System.Text.StringBuilder]::new()
$null = $sb.AppendLine("## $WindowTitle")
$null = $sb.AppendLine()
$null = $sb.AppendLine("측정 시각: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') / 회차당 정착 대기 ${SettleMs}ms")
$null = $sb.AppendLine()
$null = $sb.AppendLine('| 시험 | 총 회차 | 실패 | 판정 |')
$null = $sb.AppendLine('|---|---|---|---|')
foreach ($r in $results) {
    $verdict = if ($r.Fail -eq 0) { 'PASS' } else { 'FAIL' }
    $null = $sb.AppendLine("| $($r.Name) | $($r.Total) | $($r.Fail) | $verdict |")
}
$null = $sb.AppendLine()
foreach ($r in $results) {
    if ($r.Exceptions.Count -gt 0) {
        $null = $sb.AppendLine("### $($r.Name) — 실패 상세")
        $null = $sb.AppendLine()
        foreach ($e in $r.Exceptions) { $null = $sb.AppendLine("- $e") }
        $null = $sb.AppendLine()
    }
}

$dir = Split-Path -Parent $OutFile
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
if (-not (Test-Path $OutFile)) {
    "# 반복 안정성`n`n실패 0회일 때만 PASS 다. 부분 성공을 PASS 로 적지 않는다.`n" | Set-Content -Path $OutFile -Encoding utf8
}
Add-Content -Path $OutFile -Value $sb.ToString() -Encoding utf8
Write-Host "appended to $OutFile"

foreach ($r in $results) { Write-Host ("  {0}: {1}/{2} 실패" -f $r.Name, $r.Fail, $r.Total) }
