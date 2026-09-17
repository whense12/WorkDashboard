<#
    collect-windows-env.ps1

    Spike A 1단계: Windows 실행 환경을 측정해 results/WINDOWS_ENVIRONMENT.md 로 쓴다.
    환경 정보만 수집한다. 제품 관련 추론을 적지 않는다.

    사용법 (Windows PowerShell 또는 pwsh):
        cd spikes\shell\scripts
        .\collect-windows-env.ps1

    작성 환경 주의: 이 스크립트는 Linux 컨테이너에서 작성됐고 문법 검사만 거쳤다.
    Windows 에서 실행된 적이 없다.  NOT TESTED.
#>

[CmdletBinding()]
param(
    [string] $OutFile = (Join-Path $PSScriptRoot '..\results\WINDOWS_ENVIRONMENT.md')
)

$ErrorActionPreference = 'Continue'

function Get-ValueOrUnknown {
    param([scriptblock] $Block)
    try {
        $v = & $Block
        if ($null -eq $v -or "$v".Trim() -eq '') { return 'UNKNOWN' }
        return "$v".Trim()
    } catch {
        return "UNKNOWN (조회 실패: $($_.Exception.Message))"
    }
}

# ---- 모니터별 해상도 / DPI -------------------------------------------------
# GetDpiForMonitor 는 Win8.1+ (shcore.dll). 실패하면 UNKNOWN 으로 남긴다.
$monitorCode = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class MonInfo
{
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct MONITORINFOEXW
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string szDevice;
    }

    public delegate bool MonitorEnumProc(IntPtr hMonitor, IntPtr hdc, ref RECT rect, IntPtr data);

    [DllImport("user32.dll")]
    public static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr clip, MonitorEnumProc proc, IntPtr data);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern bool GetMonitorInfoW(IntPtr hMonitor, ref MONITORINFOEXW info);

    [DllImport("shcore.dll")]
    public static extern int GetDpiForMonitor(IntPtr hMonitor, int dpiType, out uint dpiX, out uint dpiY);

    public static List<string> Collect()
    {
        var rows = new List<string>();
        MonitorEnumProc cb = (IntPtr hMon, IntPtr hdc, ref RECT r, IntPtr d) =>
        {
            var mi = new MONITORINFOEXW();
            mi.cbSize = Marshal.SizeOf(typeof(MONITORINFOEXW));
            string name = "UNKNOWN";
            string bounds = "UNKNOWN";
            string work = "UNKNOWN";
            bool primary = false;
            if (GetMonitorInfoW(hMon, ref mi))
            {
                name = mi.szDevice;
                bounds = (mi.rcMonitor.Right - mi.rcMonitor.Left) + "x" + (mi.rcMonitor.Bottom - mi.rcMonitor.Top)
                       + " @ (" + mi.rcMonitor.Left + "," + mi.rcMonitor.Top + ")";
                work = (mi.rcWork.Right - mi.rcWork.Left) + "x" + (mi.rcWork.Bottom - mi.rcWork.Top);
                primary = (mi.dwFlags & 1u) != 0u;
            }
            string dpi = "UNKNOWN";
            try
            {
                uint dx, dy;
                // 0 = MDT_EFFECTIVE_DPI
                if (GetDpiForMonitor(hMon, 0, out dx, out dy) == 0)
                {
                    int pct = (int)Math.Round(dx * 100.0 / 96.0);
                    dpi = dx + "x" + dy + " (" + pct + "%)";
                }
            }
            catch { }
            rows.Add(name + "|" + bounds + "|" + work + "|" + dpi + "|" + (primary ? "primary" : "secondary"));
            return true;
        };
        EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, cb, IntPtr.Zero);
        return rows;
    }
}
'@

$monitorRows = @()
try {
    Add-Type -TypeDefinition $monitorCode -Language CSharp -ErrorAction Stop
    $monitorRows = [MonInfo]::Collect()
} catch {
    Write-Warning "모니터 정보 수집 실패: $($_.Exception.Message)"
}

# ---- WebView2 런타임 -------------------------------------------------------
function Get-WebView2Version {
    $guid = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
    $paths = @(
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$guid",
        "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\$guid",
        "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\$guid"
    )
    foreach ($p in $paths) {
        try {
            $pv = (Get-ItemProperty -Path $p -Name pv -ErrorAction Stop).pv
            if ($pv) { return "$pv  (출처: $p)" }
        } catch { }
    }
    return 'UNKNOWN (EdgeUpdate 레지스트리 키 없음 — 런타임 미설치일 수 있음)'
}

# ---- 수집 ------------------------------------------------------------------
$os       = Get-ValueOrUnknown { (Get-CimInstance Win32_OperatingSystem).Caption }
$ver      = Get-ValueOrUnknown { (Get-CimInstance Win32_OperatingSystem).Version }
$build    = Get-ValueOrUnknown { (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion').CurrentBuild }
$ubr      = Get-ValueOrUnknown { (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion').UBR }
$display  = Get-ValueOrUnknown { (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion').DisplayVersion }
$cpu      = Get-ValueOrUnknown { (Get-CimInstance Win32_Processor | Select-Object -First 1).Name }
$cores    = Get-ValueOrUnknown { $c = Get-CimInstance Win32_Processor | Select-Object -First 1; "$($c.NumberOfCores) cores / $($c.NumberOfLogicalProcessors) threads" }
$ramBytes = Get-ValueOrUnknown { (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory }
$ram      = if ($ramBytes -match '^\d+$') { "{0:N1} GB" -f ($ramBytes / 1GB) } else { $ramBytes }
$gpu      = Get-ValueOrUnknown { (Get-CimInstance Win32_VideoController | ForEach-Object { "$($_.Name) (driver $($_.DriverVersion))" }) -join '; ' }

$nodeV    = Get-ValueOrUnknown { (& node --version) 2>$null }
$cargoV   = Get-ValueOrUnknown { (& cargo --version) 2>$null }
$rustcV   = Get-ValueOrUnknown { (& rustc --version) 2>$null }
$dotnetV  = Get-ValueOrUnknown { (& dotnet --version) 2>$null }
$dotnetSdks = Get-ValueOrUnknown { ((& dotnet --list-sdks) 2>$null) -join '; ' }
$wv2      = Get-WebView2Version

# ---- 출력 ------------------------------------------------------------------
$sb = [System.Text.StringBuilder]::new()
$null = $sb.AppendLine('# Windows 실행 환경 (측정값)')
$null = $sb.AppendLine()
$null = $sb.AppendLine('`spikes/shell/scripts/collect-windows-env.ps1` 이 생성했다. 환경 정보만 담는다.')
$null = $sb.AppendLine()
$null = $sb.AppendLine("수집 시각: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')")
$null = $sb.AppendLine("호스트명: $env:COMPUTERNAME")
$null = $sb.AppendLine()
$null = $sb.AppendLine('## 시스템')
$null = $sb.AppendLine()
$null = $sb.AppendLine('| 항목 | 값 |')
$null = $sb.AppendLine('|---|---|')
$null = $sb.AppendLine("| OS | $os |")
$null = $sb.AppendLine("| 버전 | $ver (DisplayVersion $display) |")
$null = $sb.AppendLine("| Build | $build.$ubr |")
$null = $sb.AppendLine("| CPU | $cpu |")
$null = $sb.AppendLine("| 코어 | $cores |")
$null = $sb.AppendLine("| RAM | $ram |")
$null = $sb.AppendLine("| GPU | $gpu |")
$null = $sb.AppendLine()
$null = $sb.AppendLine('## 모니터')
$null = $sb.AppendLine()
if ($monitorRows.Count -gt 0) {
    $null = $sb.AppendLine("모니터 수: $($monitorRows.Count)")
    $null = $sb.AppendLine()
    $null = $sb.AppendLine('| 장치 | 해상도 @ 위치 | 작업영역 | DPI (배율) | 구분 |')
    $null = $sb.AppendLine('|---|---|---|---|---|')
    foreach ($row in $monitorRows) {
        $p = $row -split '\|'
        $null = $sb.AppendLine("| $($p[0]) | $($p[1]) | $($p[2]) | $($p[3]) | $($p[4]) |")
    }
} else {
    $null = $sb.AppendLine('모니터 수: UNKNOWN (수집 실패)')
}
$null = $sb.AppendLine()
$null = $sb.AppendLine('## 툴체인')
$null = $sb.AppendLine()
$null = $sb.AppendLine('| 항목 | 값 |')
$null = $sb.AppendLine('|---|---|')
$null = $sb.AppendLine("| Node | $nodeV |")
$null = $sb.AppendLine("| Rust | $rustcV |")
$null = $sb.AppendLine("| Cargo | $cargoV |")
$null = $sb.AppendLine("| .NET SDK | $dotnetV |")
$null = $sb.AppendLine("| .NET SDK 목록 | $dotnetSdks |")
$null = $sb.AppendLine("| WebView2 runtime | $wv2 |")
$null = $sb.AppendLine()

$dir = Split-Path -Parent $OutFile
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$sb.ToString() | Set-Content -Path $OutFile -Encoding utf8
Write-Host "wrote $OutFile"
