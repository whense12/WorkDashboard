<#
    measure-resources.ps1

    Spike A 7단계: 두 후보의 자원 사용을 같은 조건에서 관찰한다.
    정밀 benchmark 가 아니라 비교 관찰치다. 그 점을 출력에도 적는다.

    Tauri 는 프로세스가 여럿(주 프로세스 + WebView2 자식)이므로 프로세스 트리를 합산한다.
    WPF 는 단일 프로세스다. 합산 기준을 맞추지 않으면 비교가 성립하지 않는다.

    사용법:
        .\measure-resources.ps1 -ProcessName ShellSpike        -Label "WPF PASSIVE idle"
        .\measure-resources.ps1 -ProcessName spike-shell-tauri -Label "Tauri PASSIVE idle"

    작성 환경 주의: Linux 컨테이너에서 작성했고 문법 검사만 거쳤다. Windows 에서 실행된 적 없다. NOT TESTED.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string] $ProcessName,
    [Parameter(Mandatory = $true)] [string] $Label,
    [int] $StabilizeSeconds = 300,
    [int] $SampleSeconds = 60,
    [int] $SampleIntervalSeconds = 5,
    [string] $OutFile = (Join-Path $PSScriptRoot '..\results\RESOURCE.md')
)

$ErrorActionPreference = 'Stop'

function Get-ProcessTree {
    param([string] $Name)
    $roots = @(Get-Process -Name $Name -ErrorAction SilentlyContinue)
    if ($roots.Count -eq 0) { return @() }
    $all = @{}
    foreach ($r in $roots) { $all[$r.Id] = $r }
    # 자식 프로세스까지 훑는다 (WebView2 는 별도 프로세스로 뜬다).
    $changed = $true
    while ($changed) {
        $changed = $false
        $procs = Get-CimInstance Win32_Process
        foreach ($p in $procs) {
            if ($p.ParentProcessId -and $all.ContainsKey([int]$p.ParentProcessId) -and -not $all.ContainsKey([int]$p.ProcessId)) {
                $child = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue
                if ($child) { $all[[int]$p.ProcessId] = $child; $changed = $true }
            }
        }
    }
    return $all.Values
}

Write-Host "[$Label] '$ProcessName' 프로세스를 찾는다..."
$tree = Get-ProcessTree -Name $ProcessName
if ($tree.Count -eq 0) {
    Write-Error "프로세스 '$ProcessName' 을 찾지 못했다. 앱을 먼저 실행하라."
    exit 1
}
Write-Host "  프로세스 $($tree.Count)개: $(($tree | ForEach-Object { "$($_.ProcessName)#$($_.Id)" }) -join ', ')"

Write-Host "  $StabilizeSeconds 초 안정화 대기..."
Start-Sleep -Seconds $StabilizeSeconds

# CPU 는 프로세스 누적 CPU 시간의 델타로 구한다 (Get-Counter 는 로캘 의존이라 피한다).
$tree = Get-ProcessTree -Name $ProcessName
$cpuStart = ($tree | Measure-Object -Property TotalProcessorTime -Sum).Sum
if ($null -eq $cpuStart) { $cpuStart = [TimeSpan]::Zero }
$t0 = Get-Date

$wsSamples = @()
$pmSamples = @()
$elapsed = 0
while ($elapsed -lt $SampleSeconds) {
    Start-Sleep -Seconds $SampleIntervalSeconds
    $elapsed += $SampleIntervalSeconds
    $t = Get-ProcessTree -Name $ProcessName
    if ($t.Count -eq 0) { Write-Warning "  측정 중 프로세스가 사라졌다."; break }
    $wsSamples += (($t | Measure-Object -Property WorkingSet64 -Sum).Sum)
    $pmSamples += (($t | Measure-Object -Property PrivateMemorySize64 -Sum).Sum)
}

$tree = Get-ProcessTree -Name $ProcessName
$cpuEnd = ($tree | Measure-Object -Property TotalProcessorTime -Sum).Sum
if ($null -eq $cpuEnd) { $cpuEnd = $cpuStart }
$wall = (Get-Date) - $t0
$cpuDelta = $cpuEnd - $cpuStart
$cpuPct = if ($wall.TotalSeconds -gt 0) {
    [Math]::Round(100.0 * $cpuDelta.TotalSeconds / ($wall.TotalSeconds * [Environment]::ProcessorCount), 3)
} else { 0 }

function Fmt-MB { param($bytes) if ($null -eq $bytes) { 'UNKNOWN' } else { '{0:N1} MB' -f ($bytes / 1MB) } }

$wsAvg = if ($wsSamples.Count) { ($wsSamples | Measure-Object -Average).Average } else { $null }
$wsMax = if ($wsSamples.Count) { ($wsSamples | Measure-Object -Maximum).Maximum } else { $null }
$pmAvg = if ($pmSamples.Count) { ($pmSamples | Measure-Object -Average).Average } else { $null }
$pmMax = if ($pmSamples.Count) { ($pmSamples | Measure-Object -Maximum).Maximum } else { $null }

$line = @"

## $Label

- 측정 시각: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
- 프로세스: $($tree.Count)개 ($(($tree | ForEach-Object { $_.ProcessName }) -join ', '))
- 안정화: ${StabilizeSeconds}s / 표본: ${SampleSeconds}s, ${SampleIntervalSeconds}s 간격, $($wsSamples.Count) 표본

| 지표 | 평균 | 최대 |
|---|---|---|
| Working set (합산) | $(Fmt-MB $wsAvg) | $(Fmt-MB $wsMax) |
| Private bytes (합산) | $(Fmt-MB $pmAvg) | $(Fmt-MB $pmMax) |
| CPU (전 코어 대비) | ${cpuPct}% | — |

CPU 는 누적 프로세서 시간의 델타를 벽시계 시간 × 논리코어수로 나눈 값이다.
정밀 benchmark 가 아니라 **비교 관찰치**다.
"@

$dir = Split-Path -Parent $OutFile
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
if (-not (Test-Path $OutFile)) {
    @"
# 자원 사용 관찰치

정밀 benchmark 가 아니다. 같은 기계에서 같은 절차로 두 후보를 관찰한 값이다.
Tauri 는 프로세스 트리를 합산했고 WPF 는 단일 프로세스다.
"@ | Set-Content -Path $OutFile -Encoding utf8
}
Add-Content -Path $OutFile -Value $line -Encoding utf8
Write-Host "appended to $OutFile"
