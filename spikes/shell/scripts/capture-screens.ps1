<#
    capture-screens.ps1

    Spike A 8단계: 증거 스크린샷. 두 후보를 같은 조건에서 비교할 수 있게 파일명을 규칙화한다.

    캡처 대상 상태 (지시된 목록):
        desktop-passive / with-app / active / layout-edit / secondary-monitor / dpi-other

    사용법 (상태를 손으로 만든 뒤 한 장씩):
        .\capture-screens.ps1 -Platform tauri -State desktop-passive
        .\capture-screens.ps1 -Platform wpf   -State with-app -Note "Excel 편집 중"

    -Monitor 로 특정 모니터만, 생략하면 가상 화면 전체를 찍는다.

    작성 환경 주의: Linux 컨테이너에서 작성했고 문법 검사만 거쳤다. Windows 에서 실행된 적 없다. NOT TESTED.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [ValidateSet('tauri', 'wpf')] [string] $Platform,
    [Parameter(Mandatory = $true)]
    [ValidateSet('desktop-passive', 'with-app', 'active', 'layout-edit', 'secondary-monitor', 'dpi-other')]
    [string] $State,
    [int] $Monitor = -1,
    [string] $Note = '',
    [string] $OutDir = (Join-Path $PSScriptRoot '..\results\screenshots')
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$screens = [System.Windows.Forms.Screen]::AllScreens
if ($Monitor -ge 0) {
    if ($Monitor -ge $screens.Count) { Write-Error "모니터 인덱스 $Monitor 없음 (총 $($screens.Count)개)"; exit 1 }
    $bounds = $screens[$Monitor].Bounds
    $scope  = "monitor$Monitor"
} else {
    $bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
    $scope  = 'virtual'
}

$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
try {
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bmp.Size)
    } finally { $g.Dispose() }

    $name = "{0}-{1}-{2}.png" -f $Platform, $State, $scope
    $path = Join-Path $OutDir $name
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "saved $path  ($($bounds.Width)x$($bounds.Height))"
} finally { $bmp.Dispose() }

# 캡처 목록을 같은 폴더의 인덱스에 누적한다 — 두 후보 대조가 쉬워지도록.
$index = Join-Path $OutDir 'INDEX.md'
if (-not (Test-Path $index)) {
    "# 스크린샷 증거`n`n| 파일 | 플랫폼 | 상태 | 범위 | 모니터 수 | 시각 | 비고 |`n|---|---|---|---|---|---|---|`n" |
        Set-Content -Path $index -Encoding utf8
}
$row = "| $name | $Platform | $State | $scope | $($screens.Count) | $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | $Note |"
Add-Content -Path $index -Value $row -Encoding utf8
Write-Host "indexed in $index"
