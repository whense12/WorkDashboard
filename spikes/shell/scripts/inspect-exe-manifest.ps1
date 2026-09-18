<#
.SYNOPSIS
    Reads the RT_MANIFEST resource out of a real Windows .exe and checks what it declares.

.DESCRIPTION
    Spike A used to have no evidence that an application manifest was actually EMBEDDED in a
    produced binary - only that a manifest file existed in the source tree. Those are different
    claims: on a Linux cross build there is no resource compiler at all, and a mis-wired
    build.rs embeds nothing while still compiling.

    This script therefore opens the .exe as a resource-only module and pulls
    RT_MANIFEST (type 24) out of it with FindResource / LoadResource / LockResource. That is
    the same resource the Windows loader itself reads to build the activation context, so a
    successful read is proof of embedding. Every string passed in -Require must appear in it.

    A raw byte scan of the file is also reported, but only as corroboration - it can never be
    the proof, because a byte scan cannot tell an embedded resource from an unrelated blob.

.PARAMETER ExePath
    The executable to inspect.

.PARAMETER Require
    Substrings that must all be present in the extracted manifest. Matching is
    case-insensitive and ordinal.

.PARAMETER Label
    Short name for the report header, e.g. "Tauri" or "WPF".

.PARAMETER OutFile
    Optional path for a markdown report.

.OUTPUTS
    Exit code 0 when the manifest was read and every -Require string was found; 1 otherwise.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string]   $ExePath,
    [Parameter(Mandatory = $true)] [string[]] $Require,
    [string] $Label = 'exe',
    [string] $OutFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $ExePath -PathType Leaf)) {
    Write-Host "::error::inspect-exe-manifest: no such file: $ExePath"
    exit 1
}
$ExePath = (Resolve-Path -LiteralPath $ExePath).Path

# The interop lives in a C# here-string. This is a .ps1 file on purpose: a PowerShell
# here-string inside a YAML block scalar breaks the YAML the moment its terminator lands in
# column 0, so the workflow calls this script instead of inlining any of it.
if (-not ('SpikeA.ManifestReader' -as [type])) {
    Add-Type -Language CSharp -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

namespace SpikeA
{
    public static class ManifestReader
    {
        private const uint LOAD_LIBRARY_AS_DATAFILE = 0x00000002;
        private const uint LOAD_LIBRARY_AS_IMAGE_RESOURCE = 0x00000020;
        private static readonly IntPtr RT_MANIFEST = new IntPtr(24);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern IntPtr LoadLibraryExW(string lpLibFileName, IntPtr hFile, uint dwFlags);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool FreeLibrary(IntPtr hModule);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr FindResourceW(IntPtr hModule, IntPtr lpName, IntPtr lpType);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr LoadResource(IntPtr hModule, IntPtr hResInfo);

        [DllImport("kernel32.dll")]
        private static extern IntPtr LockResource(IntPtr hResData);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern uint SizeofResource(IntPtr hModule, IntPtr hResInfo);

        private delegate bool EnumResNameProc(IntPtr hModule, IntPtr lpType, IntPtr lpName, IntPtr lParam);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool EnumResourceNamesW(IntPtr hModule, IntPtr lpType, EnumResNameProc lpEnumFunc, IntPtr lParam);

        /// <summary>Resource ids that carry RT_MANIFEST in this module, in enumeration order.</summary>
        public static int[] ManifestIds(string path)
        {
            IntPtr module = LoadLibraryExW(path, IntPtr.Zero, LOAD_LIBRARY_AS_DATAFILE | LOAD_LIBRARY_AS_IMAGE_RESOURCE);
            if (module == IntPtr.Zero)
            {
                throw new InvalidOperationException("LoadLibraryExW failed: " + Marshal.GetLastWin32Error());
            }

            var ids = new List<int>();
            try
            {
                EnumResNameProc collect = delegate(IntPtr h, IntPtr type, IntPtr name, IntPtr param)
                {
                    // An integer id has its high bits clear; a string name would be a pointer.
                    long v = name.ToInt64();
                    if (v > 0 && v < 0x10000) { ids.Add((int)v); }
                    return true;
                };
                EnumResourceNamesW(module, RT_MANIFEST, collect, IntPtr.Zero);
                GC.KeepAlive(collect);
            }
            finally
            {
                FreeLibrary(module);
            }

            return ids.ToArray();
        }

        /// <summary>The RT_MANIFEST resource with the given id, decoded as UTF-8.</summary>
        public static string Read(string path, int resourceId)
        {
            IntPtr module = LoadLibraryExW(path, IntPtr.Zero, LOAD_LIBRARY_AS_DATAFILE | LOAD_LIBRARY_AS_IMAGE_RESOURCE);
            if (module == IntPtr.Zero)
            {
                throw new InvalidOperationException("LoadLibraryExW failed: " + Marshal.GetLastWin32Error());
            }

            try
            {
                IntPtr info = FindResourceW(module, new IntPtr(resourceId), RT_MANIFEST);
                if (info == IntPtr.Zero)
                {
                    throw new InvalidOperationException("no RT_MANIFEST with id " + resourceId);
                }

                uint size = SizeofResource(module, info);
                IntPtr data = LoadResource(module, info);
                if (size == 0 || data == IntPtr.Zero)
                {
                    throw new InvalidOperationException("RT_MANIFEST id " + resourceId + " is empty");
                }

                IntPtr raw = LockResource(data);
                if (raw == IntPtr.Zero)
                {
                    throw new InvalidOperationException("LockResource failed");
                }

                byte[] bytes = new byte[size];
                Marshal.Copy(raw, bytes, 0, (int)size);

                int start = 0;
                if (bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF)
                {
                    start = 3;
                }

                return new UTF8Encoding(false).GetString(bytes, start, bytes.Length - start);
            }
            finally
            {
                FreeLibrary(module);
            }
        }
    }
}
'@
}

$lines = [System.Collections.Generic.List[string]]::new()
function Emit([string] $text) {
    Write-Host $text
    $lines.Add($text) | Out-Null
}

Emit "# RT_MANIFEST inspection - $Label"
Emit ''
Emit "exe: $ExePath"
$fileInfo = Get-Item -LiteralPath $ExePath
Emit ("size: {0} bytes" -f $fileInfo.Length)
Emit ''

$ids = @()
try {
    $ids = [SpikeA.ManifestReader]::ManifestIds($ExePath)
} catch {
    Emit "EnumResourceNamesW failed: $($_.Exception.Message)"
}
Emit ("RT_MANIFEST resource ids present: {0}" -f (($ids | ForEach-Object { $_ }) -join ', '))

# Prefer the id the loader itself uses (CREATEPROCESS_MANIFEST_RESOURCE_ID = 1), then whatever
# else the binary actually carries.
$candidates = @(1) + @($ids | Where-Object { $_ -ne 1 })
$manifest = $null
$usedId = $null
foreach ($id in $candidates) {
    try {
        $manifest = [SpikeA.ManifestReader]::Read($ExePath, $id)
        $usedId = $id
        break
    } catch {
        Emit ("  id {0}: {1}" -f $id, $_.Exception.Message)
    }
}

if (-not $manifest) {
    Emit ''
    Emit 'RESULT: FAIL - no RT_MANIFEST resource could be read from this executable.'
    Emit 'The manifest is NOT embedded. This is a build-wiring failure, not a measurement gap.'
    if ($OutFile) { $lines | Set-Content -LiteralPath $OutFile -Encoding utf8 }
    Write-Host '::error::inspect-exe-manifest: no RT_MANIFEST resource in the executable'
    exit 1
}

Emit ("read RT_MANIFEST id {0}: {1} characters" -f $usedId, $manifest.Length)
Emit ''
Emit '## manifest as embedded in the exe'
Emit ''
Emit '```xml'
foreach ($l in ($manifest -split "`r?`n")) { Emit $l }
Emit '```'
Emit ''

# The embedded text must also be well-formed XML: a manifest the loader cannot parse makes the
# process fail to start with 0xC0000020, which no smoke test would explain.
$xmlOk = $false
$xmlWhy = ''
try {
    [void][xml]$manifest
    $xmlOk = $true
} catch {
    $xmlWhy = $_.Exception.Message
}
Emit ("well-formed XML: {0}{1}" -f $xmlOk, $(if ($xmlOk) { '' } else { " - $xmlWhy" }))

Emit ''
Emit '## required declarations'
Emit ''
Emit '| declaration | in RT_MANIFEST resource | in raw file bytes |'
Emit '|---|---|---|'

$rawText = [System.Text.Encoding]::ASCII.GetString([System.IO.File]::ReadAllBytes($ExePath))
$missing = @()
foreach ($needle in $Require) {
    $inResource = $manifest.IndexOf($needle, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
    $inRaw = $rawText.IndexOf($needle, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
    Emit ("| ``{0}`` | {1} | {2} |" -f $needle, $(if ($inResource) { 'PASS' } else { 'FAIL' }), $(if ($inRaw) { 'yes' } else { 'no' }))
    if (-not $inResource) { $missing += $needle }
}

Emit ''
if (-not $xmlOk) { $missing += '(well-formed XML)' }

if ($missing.Count -gt 0) {
    Emit ("RESULT: FAIL - missing from the embedded manifest: {0}" -f ($missing -join ', '))
    if ($OutFile) { $lines | Set-Content -LiteralPath $OutFile -Encoding utf8 }
    Write-Host ("::error::inspect-exe-manifest: missing from the embedded manifest: {0}" -f ($missing -join ', '))
    exit 1
}

Emit 'RESULT: PASS - every required declaration is present in the embedded RT_MANIFEST resource.'
Emit ''
Emit 'Scope note: this proves what the exe DECLARES. Whether per-monitor DPI and the comctl32 v6'
Emit 'activation context then behave correctly on a real desktop is a separate question and stays'
Emit 'NOT TESTED in spikes/shell/acceptance.md.'

if ($OutFile) { $lines | Set-Content -LiteralPath $OutFile -Encoding utf8 }
exit 0
