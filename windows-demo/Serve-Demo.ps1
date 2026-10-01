param(
    [int]$Port = 4173,
    [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
$indexPath = Join-Path $PSScriptRoot 'index.html'
if (-not (Test-Path -LiteralPath $indexPath)) {
    throw 'The prebuilt index.html is missing. Extract the complete Windows demo ZIP first.'
}
$page = [System.IO.File]::ReadAllBytes($indexPath)
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
try {
    $listener.Start()
} catch {
    throw "Cannot open localhost port $Port. Close any other Sig-Assist preview and try again. $($_.Exception.Message)"
}
try {
    $url = "http://localhost:$Port/"
    Write-Host "Sig-Assist is ready: $url"
    Write-Host 'Keep this window open during the demo. Close it to stop the app.'
    Write-Host 'No Iguana connection is made. Click Load demo queue to begin.'
    if (-not $NoBrowser) { Start-Process $url }
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $stream.ReadTimeout = 2000
            $stream.WriteTimeout = 10000
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $request = $reader.ReadLine()
            if (-not $request) { continue }
            $parts = $request.Split(' ')
            # Drain headers so clients can receive the entire response before disconnect.
            $headerCount = 0
            while ($reader.ReadLine()) {
                $headerCount++
                if ($headerCount -gt 100) { throw 'Request has too many headers.' }
            }
            $method = $parts[0]
            $path = $parts[1].Split('?')[0]
            $status = '200 OK'
            $mime = 'text/html; charset=utf-8'
            $body = $page
            if ($method -ne 'GET' -and $method -ne 'HEAD') {
                $status = '405 Method Not Allowed'
                $mime = 'text/plain; charset=utf-8'
                $body = [System.Text.Encoding]::UTF8.GetBytes('Only GET and HEAD are supported.')
            } elseif ($path -eq '/__health') {
                $mime = 'text/plain; charset=utf-8'
                $body = [System.Text.Encoding]::UTF8.GetBytes('Sig-Assist ready')
            } elseif ($path -eq '/favicon.ico') {
                $status = '204 No Content'
                $mime = 'image/x-icon'
                $body = [byte[]]@()
            } elseif ($path -ne '/' -and $path -ne '/index.html') {
                $status = '404 Not Found'
                $mime = 'text/plain; charset=utf-8'
                $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
            }
            $header = "HTTP/1.1 $status`r`nContent-Type: $mime`r`nContent-Length: $($body.Length)`r`nConnection: close`r`nCache-Control: no-store`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            if ($method -ne 'HEAD') { $stream.Write($body, 0, $body.Length) }
            $stream.Flush()
        } catch {
            # Browsers may close an idle preconnection; continue accepting requests.
            Write-Verbose "Request ended: $($_.Exception.Message)"
        } finally {
            $client.Dispose()
        }
    }
} finally {
    $listener.Stop()
}
