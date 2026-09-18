<#
.SYNOPSIS
    Host-independent self-test for inspect-exe-manifest.ps1's reporting and matching logic.

.DESCRIPTION
    inspect-exe-manifest.ps1 has two halves:

      1. the Win32 interop (LoadLibraryExW / EnumResourceNamesW / FindResourceW ...) that pulls
         RT_MANIFEST out of a real PE file, and
      2. the reporting half - the report scaffolding, the well-formed-XML check, the
         "## required declarations" matching table, and the exit codes.

    Half 1 can only run on Windows. On Linux every read throws, the script takes its
    "no RT_MANIFEST resource could be read" branch and exits 1 before the table is ever
    emitted - so on a Linux host the matching table and RESULT: PASS are unreachable and must
    NOT be recorded as verified.

    This self-test exercises half 2 anywhere, by pre-registering a SpikeA.ManifestReader whose
    two static methods return canned data. inspect-exe-manifest.ps1 already guards its own
    Add-Type with `if (-not ('SpikeA.ManifestReader' -as [type]))`, so nothing in that script
    has to change: the stub simply wins the race, and the rest of the script runs verbatim.

    SCOPE - read this before quoting the result anywhere:
      * PASS here means the table, the XML check and the exit codes behave as specified.
      * It says NOTHING about whether a manifest is really embedded in any .exe. That is the
        interop's job and it stays NOT TESTED until the Windows CI job runs.

.OUTPUTS
    Exit code 0 when every case passes; 1 otherwise, with the failures listed.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$target = Join-Path $PSScriptRoot 'inspect-exe-manifest.ps1'
if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    Write-Host "::error::selftest: script under test not found: $target"
    exit 1
}

if ('SpikeA.ManifestReader' -as [type]) {
    # The real type is already loaded in this session; the stub could not take effect and the
    # results below would silently be about something else.
    Write-Host '::error::selftest: SpikeA.ManifestReader is already loaded - run this in a fresh pwsh.'
    exit 1
}

Add-Type -Language CSharp -TypeDefinition @'
namespace SpikeA
{
    /// <summary>Stand-in for the real reader. Same surface, no Win32.</summary>
    public static class ManifestReader
    {
        public static string Manifest = null;
        public static int[] Ids = new int[0];

        public static int[] ManifestIds(string path) { return Ids; }

        public static string Read(string path, int resourceId)
        {
            if (Manifest == null)
            {
                throw new System.InvalidOperationException("selftest stub: no RT_MANIFEST with id " + resourceId);
            }
            return Manifest;
        }
    }
}
'@

$work = Join-Path ([System.IO.Path]::GetTempPath()) ("spikea-selftest-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null

$failures = [System.Collections.Generic.List[string]]::new()
$checks = 0

function New-FakeExe {
    param([string] $Name, [string] $Bytes)
    $p = Join-Path $work $Name
    Set-Content -LiteralPath $p -Value $Bytes -NoNewline -Encoding utf8
    return $p
}

function Invoke-Target {
    param([string] $ExePath, [string[]] $Require, [string] $OutFile)
    $global:LASTEXITCODE = 0
    if ($OutFile) {
        $out = & $target -ExePath $ExePath -Require $Require -Label 'selftest' -OutFile $OutFile 6>&1
    } else {
        $out = & $target -ExePath $ExePath -Require $Require -Label 'selftest' 6>&1
    }
    return [pscustomobject]@{ Code = $LASTEXITCODE; Text = (($out | ForEach-Object { [string]$_ }) -join "`n") }
}

function Assert-True {
    param([string] $Case, [string] $What, [bool] $Condition)
    $script:checks++
    if ($Condition) {
        Write-Host ("  ok   {0}: {1}" -f $Case, $What)
    } else {
        Write-Host ("  FAIL {0}: {1}" -f $Case, $What)
        $failures.Add(("{0}: {1}" -f $Case, $What)) | Out-Null
    }
}

$goodXml = '<?xml version="1.0" encoding="utf-8"?>' + "`n" +
           '<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">' + "`n" +
           '  <dependency><dependentAssembly><assemblyIdentity type="win32"' + "`n" +
           '    name="Microsoft.Windows.Common-Controls" version="6.0.0.0"' + "`n" +
           '    processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*" />' + "`n" +
           '  </dependentAssembly></dependency>' + "`n" +
           '  <application><windowsSettings>' + "`n" +
           '    <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness>' + "`n" +
           '    <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>' + "`n" +
           '  </windowsSettings></application>' + "`n" +
           '</assembly>'

Write-Host '# selftest - inspect-exe-manifest.ps1 reporting half'
Write-Host ''
Write-Host ('script under test: {0}' -f $target)
Write-Host ''

try {
    # --- case 1: every required declaration present -> the table renders and exit 0 ------------
    Write-Host 'case 1 - all required declarations present'
    [SpikeA.ManifestReader]::Manifest = $goodXml
    [SpikeA.ManifestReader]::Ids = @(1)
    $exe = New-FakeExe -Name 'good.bin' -Bytes $goodXml
    $report = Join-Path $work 'good.md'
    $r = Invoke-Target -ExePath $exe -Require @('Microsoft.Windows.Common-Controls', '6.0.0.0', 'PerMonitorV2', 'true/pm') -OutFile $report

    Assert-True 'case1' 'exit code is 0' ($r.Code -eq 0)
    Assert-True 'case1' 'the "## required declarations" table is emitted' ($r.Text -match '(?m)^## required declarations$')
    Assert-True 'case1' 'the table header row is emitted' ($r.Text -match [regex]::Escape('| declaration | in RT_MANIFEST resource | in raw file bytes |'))
    Assert-True 'case1' 'a row is emitted for every -Require string' (
        ($r.Text -match [regex]::Escape('| `Microsoft.Windows.Common-Controls` | PASS |')) -and
        ($r.Text -match [regex]::Escape('| `6.0.0.0` | PASS |')) -and
        ($r.Text -match [regex]::Escape('| `PerMonitorV2` | PASS |')) -and
        ($r.Text -match [regex]::Escape('| `true/pm` | PASS |')))
    Assert-True 'case1' 'well-formed XML is reported True' ($r.Text -match '(?m)^well-formed XML: True$')
    Assert-True 'case1' 'RESULT: PASS is reported' ($r.Text -match '(?m)^RESULT: PASS - ')
    Assert-True 'case1' 'no ::error:: annotation is emitted' (-not ($r.Text -match '::error::'))
    Assert-True 'case1' '-OutFile report was written' (Test-Path -LiteralPath $report -PathType Leaf)
    Assert-True 'case1' '-OutFile content matches the console report' (
        ((Get-Content -LiteralPath $report -Raw) -replace "`r`n", "`n").TrimEnd() -eq $r.Text.TrimEnd())

    # --- case 2: one declaration missing -> table still renders, exit 1 ------------------------
    Write-Host 'case 2 - one required declaration missing'
    $r = Invoke-Target -ExePath $exe -Require @('PerMonitorV2', 'requireAdministrator')
    Assert-True 'case2' 'exit code is 1' ($r.Code -eq 1)
    Assert-True 'case2' 'the present declaration is marked PASS' ($r.Text -match [regex]::Escape('| `PerMonitorV2` | PASS |'))
    Assert-True 'case2' 'the absent declaration is marked FAIL' ($r.Text -match [regex]::Escape('| `requireAdministrator` | FAIL |'))
    Assert-True 'case2' 'RESULT: FAIL names the missing declaration' ($r.Text -match '(?m)^RESULT: FAIL - missing from the embedded manifest: requireAdministrator$')
    Assert-True 'case2' 'a ::error:: annotation is emitted for CI' ($r.Text -match '::error::inspect-exe-manifest: missing from the embedded manifest')

    # --- case 3: resource hit / raw-byte miss must be distinguishable --------------------------
    # The raw byte scan is corroboration only, so a needle present in the resource but absent
    # from the file bytes must still PASS, with the raw column reading "no".
    Write-Host 'case 3 - present in the resource but not in the raw file bytes'
    $decoy = New-FakeExe -Name 'decoy.bin' -Bytes 'MZ this file does not contain the needle'
    $r = Invoke-Target -ExePath $decoy -Require @('PerMonitorV2')
    Assert-True 'case3' 'exit code is 0 (the resource is the proof, not the byte scan)' ($r.Code -eq 0)
    Assert-True 'case3' 'raw-bytes column reads "no" while the resource column reads PASS' ($r.Text -match [regex]::Escape('| `PerMonitorV2` | PASS | no |'))

    # --- case 4: malformed XML fails even when every string is present ------------------------
    Write-Host 'case 4 - manifest is not well-formed XML'
    [SpikeA.ManifestReader]::Manifest = '<assembly><application>PerMonitorV2 true/pm</assembly>'
    $bad = New-FakeExe -Name 'badxml.bin' -Bytes 'PerMonitorV2 true/pm'
    $r = Invoke-Target -ExePath $bad -Require @('PerMonitorV2', 'true/pm')
    Assert-True 'case4' 'exit code is 1' ($r.Code -eq 1)
    Assert-True 'case4' 'well-formed XML is reported False with a reason' ($r.Text -match '(?m)^well-formed XML: False - .+')
    Assert-True 'case4' 'every -Require string still matched' (
        ($r.Text -match [regex]::Escape('| `PerMonitorV2` | PASS |')) -and
        ($r.Text -match [regex]::Escape('| `true/pm` | PASS |')))
    Assert-True 'case4' 'RESULT: FAIL blames well-formed XML' ($r.Text -match [regex]::Escape('RESULT: FAIL - missing from the embedded manifest: (well-formed XML)'))

    # --- case 5: no readable RT_MANIFEST -> the pre-table failure branch -----------------------
    # This is the branch - and the ONLY branch - that a Linux host reaches with the real reader.
    Write-Host 'case 5 - no RT_MANIFEST resource can be read'
    [SpikeA.ManifestReader]::Manifest = $null
    [SpikeA.ManifestReader]::Ids = @()
    $r = Invoke-Target -ExePath $exe -Require @('PerMonitorV2')
    Assert-True 'case5' 'exit code is 1' ($r.Code -eq 1)
    Assert-True 'case5' 'RESULT: FAIL says the manifest is not embedded' ($r.Text -match '(?m)^RESULT: FAIL - no RT_MANIFEST resource could be read from this executable\.$')
    Assert-True 'case5' 'the declarations table is NOT emitted on this branch' (-not ($r.Text -match '(?m)^## required declarations$'))
    Assert-True 'case5' 'a ::error:: annotation is emitted for CI' ($r.Text -match '::error::inspect-exe-manifest: no RT_MANIFEST resource')

    # --- case 6: a missing file is rejected before anything else ------------------------------
    Write-Host 'case 6 - the executable does not exist'
    $r = Invoke-Target -ExePath (Join-Path $work 'not-here.bin') -Require @('PerMonitorV2')
    Assert-True 'case6' 'exit code is 1' ($r.Code -eq 1)
    Assert-True 'case6' 'the error names the missing file' ($r.Text -match '::error::inspect-exe-manifest: no such file')
} finally {
    Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ''
if ($failures.Count -gt 0) {
    Write-Host ("RESULT: FAIL - {0} of {1} checks failed:" -f $failures.Count, $checks)
    foreach ($f in $failures) { Write-Host "  - $f" }
    Write-Host '::error::selftest-inspect-exe-manifest: reporting half is broken'
    exit 1
}

Write-Host ("RESULT: PASS - {0}/{0} checks passed." -f $checks)
Write-Host ''
Write-Host 'Scope note: this covers the report, the XML check, the matching table and the exit'
Write-Host 'codes only. The Win32 interop that reads RT_MANIFEST out of a real PE file is NOT'
Write-Host 'exercised here and stays NOT TESTED until the Windows CI job runs.'
exit 0
