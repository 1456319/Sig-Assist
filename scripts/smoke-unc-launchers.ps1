$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$shareName = 'SigAssistSmoke' + [Guid]::NewGuid().ToString('N')
$testRoot = Join-Path $env:TEMP $shareName
$source = Join-Path $testRoot 'source folder !'
$demo = Join-Path $source 'windows-demo'
$legacy = Join-Path $testRoot 'legacy folder !'
$shareCreated = $false

function Test-Launcher([string]$Launcher, [string]$ExpectedPage) {
    $reservation = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $reservation.Start()
    $port = $reservation.LocalEndpoint.Port
    $reservation.Stop()
    $info = [System.Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $env:ComSpec
    $info.Arguments = "/d /s /c `"`"$Launcher`" -NoBrowser -Port $port`""
    $info.WorkingDirectory = $env:SystemRoot
    $info.UseShellExecute = $false
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    # Reproduce a workstation without Node/npm; PowerShell and CMD remain available.
    $info.EnvironmentVariables['PATH'] = "$env:SystemRoot\System32;$env:SystemRoot\System32\WindowsPowerShell\v1.0"
    $process = [System.Diagnostics.Process]::Start($info)
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    try {
        $response = $null
        $deadline = [DateTime]::UtcNow.AddSeconds(30)
        while ([DateTime]::UtcNow -lt $deadline) {
            if ($process.HasExited) { throw "Launcher exited: $($stdout.Result) $($stderr.Result)" }
            try {
                $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$port/" -TimeoutSec 2
                break
            } catch { Start-Sleep -Milliseconds 200 }
        }
        if (-not $response) { throw "Launcher did not become ready: $Launcher" }
        if ($response.Content -cne [System.IO.File]::ReadAllText($ExpectedPage)) {
            throw "Launcher served the wrong or incomplete page: $Launcher"
        }
        Write-Host "PASS: CMD launcher from UNC path with spaces and !, without Node/npm: $Launcher"
    } finally {
        if (-not $process.HasExited) {
            & "$env:SystemRoot\System32\taskkill.exe" /PID $process.Id /T /F | Out-Null
            $process.WaitForExit(10000) | Out-Null
        }
        $out = $stdout.Result
        $err = $stderr.Result
        Write-Host $out
        if ($err) { Write-Host $err }
        if ($out -match 'UNC paths are not supported|CMD does not support UNC paths|\[ERROR\]') {
            throw "Launcher still reports a startup failure: $out"
        }
        $process.Dispose()
    }
}

try {
    New-Item -ItemType Directory -Path $demo, (Join-Path $legacy 'app') -Force | Out-Null
    Copy-Item (Join-Path $root 'start-windows.bat'), (Join-Path $root 'preview-windows.bat') $source
    foreach ($filename in @('Start-Sig-Assist.bat', 'Serve-Demo.ps1', 'index.html')) {
        Copy-Item (Join-Path $root "windows-demo/$filename") $demo
    }
    Copy-Item (Join-Path $root 'windows/Start-Sig-Assist.cmd'), (Join-Path $root 'windows/serve.ps1') $legacy
    Copy-Item (Join-Path $root 'dist/*') (Join-Path $legacy 'app') -Recurse
    if ((Get-Service LanmanServer).Status -ne 'Running') { Start-Service LanmanServer }
    New-SmbShare -Name $shareName -Path $testRoot -FullAccess "$env:USERDOMAIN\$env:USERNAME" | Out-Null
    $shareCreated = $true
    $unc = "\\localhost\$shareName"
    $page = Join-Path $demo 'index.html'
    Test-Launcher "$unc\source folder !\windows-demo\Start-Sig-Assist.bat" $page
    Test-Launcher "$unc\source folder !\start-windows.bat" $page
    Test-Launcher "$unc\source folder !\preview-windows.bat" $page
    Test-Launcher "$unc\legacy folder !\Start-Sig-Assist.cmd" (Join-Path $legacy 'app/index.html')
} finally {
    if ($shareCreated) {
        Get-SmbMapping -ErrorAction SilentlyContinue | Where-Object { $_.RemotePath -like "\\localhost\$shareName*" } | Remove-SmbMapping -Force -ErrorAction SilentlyContinue
        Remove-SmbShare -Name $shareName -Force -Confirm:$false
    }
    if (Test-Path $testRoot) { Remove-Item $testRoot -Recurse -Force }
}
