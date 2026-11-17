# Local preview server for the portfolio (no installs needed).
# Usage (from this folder):   powershell -ExecutionPolicy Bypass -File .\serve.ps1
# Then open http://localhost:8080/  — press Ctrl+C in this window to stop.
# Opening index.html directly also works; a server is only needed for embedded YouTube players.
param([int]$Port = 8080, [switch]$NoBrowser)

$root = (Resolve-Path $PSScriptRoot).Path.TrimEnd('\') + '\'
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'
  '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'; '.mp4' = 'video/mp4'; '.pdf' = 'application/pdf'; '.md' = 'text/plain; charset=utf-8'
}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/  (Ctrl+C to stop)"
if (-not $NoBrowser) { Start-Process "http://localhost:$Port/" }
$buffer = New-Object byte[] 262144
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    $fs = $null
    try {
      $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
      if ([string]::IsNullOrEmpty($rel) -or $rel.EndsWith('/')) { $rel = $rel + 'index.html' }
      $file = [IO.Path]::GetFullPath((Join-Path $root $rel))
      if (-not $file.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $file -PathType Leaf)) {
        $res.StatusCode = 404
        continue
      }
      $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
      $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $res.AddHeader('Accept-Ranges', 'bytes')
      $res.AddHeader('Cache-Control', 'no-cache')
      $fs = [IO.File]::OpenRead($file)
      $len = $fs.Length; $start = [long]0; $end = $len - 1
      $range = $req.Headers['Range']
      if ($range -and $range -match '^bytes=(\d*)-(\d*)$') {
        if ($Matches[1] -ne '') { $start = [long]$Matches[1]; if ($Matches[2] -ne '') { $end = [Math]::Min([long]$Matches[2], $len - 1) } }
        elseif ($Matches[2] -ne '') { $start = [Math]::Max([long]0, $len - [long]$Matches[2]) }
        if ($start -gt $end) { $res.StatusCode = 416; $res.AddHeader('Content-Range', "bytes */$len"); continue }
        $res.StatusCode = 206
        $res.AddHeader('Content-Range', "bytes $start-$end/$len")
      }
      $res.ContentLength64 = $end - $start + 1
      if ($req.HttpMethod -eq 'HEAD') { continue }
      [void]$fs.Seek($start, 'Begin')
      $remaining = $end - $start + 1
      while ($remaining -gt 0) {
        $n = $fs.Read($buffer, 0, [int][Math]::Min($buffer.Length, $remaining))
        if ($n -le 0) { break }
        $res.OutputStream.Write($buffer, 0, $n)
        $remaining -= $n
      }
    } catch {
      # client aborted (e.g. video seek) — ignore
    } finally {
      if ($fs) { $fs.Dispose() }
      try { $res.Close() } catch {}
    }
  }
} finally {
  $listener.Stop()
}
