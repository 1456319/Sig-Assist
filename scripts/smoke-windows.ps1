$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$serverScript = Join-Path $root 'windows-demo/Serve-Demo.ps1'
$server = Start-Process powershell.exe -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$serverScript`"", '-Port', '4187', '-NoBrowser') -PassThru
try {
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        if ($server.HasExited) { throw 'Demo server exited before it became ready.' }
        try {
            $health = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:4187/__health' -TimeoutSec 2
            if ($health.Content -eq 'Sig-Assist ready') { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 200 }
    }
    if (-not $ready) { throw 'Demo server did not become ready.' }
    $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:4187/' -TimeoutSec 10
    $expected = [System.IO.File]::ReadAllText((Join-Path $root 'windows-demo/index.html'))
    if ($response.Content -cne $expected) { throw 'Server returned a truncated or different build.' }
    if (-not $response.Content.Contains('Load demo queue')) { throw 'Demo queue UI is absent from the build.' }
    if ($response.Content -match '<script[^>]+src=|<link[^>]+href=') { throw 'Build still requires external assets.' }
    $head = Invoke-WebRequest -UseBasicParsing -Method Head -Uri 'http://localhost:4187/' -TimeoutSec 10
    if ($head.StatusCode -ne 200) { throw 'HEAD request failed.' }
    Write-Host 'Windows PowerShell 5.1 launch and full offline page smoke check passed.'
} finally {
    if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force }
}
