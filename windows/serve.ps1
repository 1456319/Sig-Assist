param(
    [int]$Port = 4173,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'app'))
if (-not (Test-Path (Join-Path $root 'index.html'))) {
    throw 'The prebuilt app is missing. Extract the entire Windows demo ZIP before launching.'
}
$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.js' = 'application/javascript; charset=utf-8'
    '.css' = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.svg' = 'image/svg+xml'
    '.png' = 'image/png'
    '.ico' = 'image/x-icon'
    '.woff2' = 'font/woff2'
}
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
try {
    $listener.Start()
    $url = "http://127.0.0.1:$Port/"
    Write-Host "Sig-Assist is ready at $url"
    Write-Host 'Keep this window open. Close it to stop the demo.'
    if (-not $NoBrowser) { Start-Process $url }
    while ($true) {
        $client = $listener.AcceptTcpClient()
        $reader = $null
        try {
            $stream = $client.GetStream()
            $stream.ReadTimeout = 3000
            $stream.WriteTimeout = 3000
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $request = $reader.ReadLine()
            if (-not $request) { continue }
            $fields = $request.Split(' ')
            if ($fields.Length -lt 2) { continue }
            $headerLength = $request.Length
            do {
                $header = $reader.ReadLine()
                $headerLength += $header.Length
                if ($headerLength -gt 16384) { throw 'Request headers are too long.' }
            } while ($header)

            $status = '200 OK'
            $mime = 'text/plain; charset=utf-8'
            $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not found')
            if ($fields[0] -notin @('GET', 'HEAD')) {
                $status = '405 Method Not Allowed'
                $bytes = [System.Text.Encoding]::UTF8.GetBytes('Only GET and HEAD are supported.')
            } else {
                $relative = [System.Uri]::UnescapeDataString(($fields[1] -split '\?')[0]).TrimStart('/')
                if (-not $relative) { $relative = 'index.html' }
                $file = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
                if ($file.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $file -PathType Leaf)) {
                    $bytes = [System.IO.File]::ReadAllBytes($file)
                    $extension = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
                    $mime = $mimeTypes[$extension]
                    if (-not $mime) { $mime = 'application/octet-stream' }
                } else {
                    $status = '404 Not Found'
                }
            }
            $response = "HTTP/1.1 $status`r`nContent-Type: $mime`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
            $responseBytes = [System.Text.Encoding]::ASCII.GetBytes($response)
            $stream.Write($responseBytes, 0, $responseBytes.Length)
            if ($fields[0] -ne 'HEAD') { $stream.Write($bytes, 0, $bytes.Length) }
            $stream.Flush()
        } catch {
            # A browser may open and abandon a speculative connection.
            Write-Verbose $_.Exception.Message
        } finally {
            if ($reader) { $reader.Dispose() }
            $client.Close()
        }
    }
} finally {
    $listener.Stop()
}
