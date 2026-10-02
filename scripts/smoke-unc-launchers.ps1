$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$shareName = 'SigAssistSmoke' + [Guid]::NewGuid().ToString('N')
$testRoot = Join-Path $env:TEMP $shareName
$source = Join-Path $testRoot 'source folder !'
$demo = Join-Path $source 'windows-demo'
$legacy = Join-Path $testRoot 'legacy folder !'
$incomplete = Join-Path $testRoot 'incomplete folder !'
$shareCreated = $false

function Test-BrowserLauncher([string]$Launcher, [string]$ExpectedMarker = 'Prebuilt page found:', [int]$ExpectedExit = 0) {
    $info = [System.Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $env:ComSpec
    $info.Arguments = "/d /s /c `"`"$Launcher`" --check`""
    $info.WorkingDirectory = $env:SystemRoot
    $info.UseShellExecute = $false
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    # No Node/npm or PowerShell executable is available to these launchers.
    $info.EnvironmentVariables['PATH'] = "$env:SystemRoot\System32"
    $process = [System.Diagnostics.Process]::Start($info)
    try {
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(10000)) { $process.Kill(); throw 'Browser launcher did not exit.' }
        $out = $stdout.Result
        $err = $stderr.Result
        if ($process.ExitCode -ne $ExpectedExit -or $err -or $out -notmatch [regex]::Escape($ExpectedMarker)) {
            throw "Browser launcher failed: $out $err"
        }
        if ($ExpectedExit -eq 0 -and $out -match '\[ERROR\]|UNC paths are not supported|CMD does not support UNC paths') {
            throw "Browser launcher reports a startup error: $out"
        }
        Write-Host "PASS: UNC launcher with no Node/npm/PowerShell on PATH, expected output '$ExpectedMarker': $Launcher"
    } finally { $process.Dispose() }
}

try {
    New-Item -ItemType Directory -Path $demo, $legacy, $incomplete, (Join-Path $source 'windows') -Force | Out-Null
    Copy-Item (Join-Path $root 'start-windows.bat'), (Join-Path $root 'preview-windows.bat') $source
    foreach ($filename in @('Start-Sig-Assist.bat', 'Start-Iguana-Connector.bat', 'Serve-Demo.ps1', 'index.html')) {
        Copy-Item (Join-Path $root "windows-demo/$filename") $demo
    }
    # Provide an offline executable beside the connector; PATH still has no Node.
    Copy-Item (Get-Command node.exe).Source (Join-Path $demo 'node.exe')
    Copy-Item (Join-Path $root 'windows/Start-Sig-Assist.cmd') (Join-Path $source 'windows')
    Copy-Item (Join-Path $root 'windows/Start-Sig-Assist.cmd') $demo
    Copy-Item (Join-Path $root 'windows/Start-Sig-Assist.cmd') $incomplete
    # Exercise the actual shipped CMD/BAT/page combination, not a copied mock.
    Expand-Archive -Path (Join-Path $root 'windows-demo/Sig-Assist-Windows-Demo.zip') -DestinationPath $legacy
    if ((Get-Service LanmanServer).Status -ne 'Running') { Start-Service LanmanServer }
    New-SmbShare -Name $shareName -Path $testRoot -FullAccess "$env:USERDOMAIN\$env:USERNAME" | Out-Null
    $shareCreated = $true
    $unc = "\\$env:COMPUTERNAME\$shareName"
    Test-BrowserLauncher "$unc\source folder !\windows-demo\Start-Sig-Assist.bat"
    Test-BrowserLauncher "$unc\source folder !\windows-demo\Start-Iguana-Connector.bat" 'Using Node.js:'
    Test-BrowserLauncher "$unc\source folder !\start-windows.bat"
    Test-BrowserLauncher "$unc\source folder !\preview-windows.bat"
    Test-BrowserLauncher "$unc\source folder !\windows\Start-Sig-Assist.cmd"
    Test-BrowserLauncher "$unc\source folder !\windows-demo\Start-Sig-Assist.cmd"
    Test-BrowserLauncher "$unc\legacy folder !\Start-Sig-Assist.cmd"
    Test-BrowserLauncher "$unc\incomplete folder !\Start-Sig-Assist.cmd" 'The prebuilt browser launcher is missing.' 1
    # Exercise the full Edge workflow at the UNC file URL while the share exists.
    & node (Join-Path $root 'scripts/smoke-browser.mjs') --file "$unc\source folder !\windows-demo\index.html"
    if ($LASTEXITCODE -ne 0) { throw 'Direct UNC file browser workflow failed.' }
} finally {
    if ($shareCreated) {
        Get-SmbMapping -ErrorAction SilentlyContinue | Where-Object { $_.RemotePath -like "\\$env:COMPUTERNAME\$shareName*" } | Remove-SmbMapping -Force -ErrorAction SilentlyContinue
        Remove-SmbShare -Name $shareName -Force -Confirm:$false
    }
    if (Test-Path $testRoot) { Remove-Item $testRoot -Recurse -Force }
}
