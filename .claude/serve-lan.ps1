# Igual que serve.ps1, pero escucha en TODAS las interfaces (0.0.0.0), no
# solo localhost -- para poder abrir /v3/ desde el movil en la misma Wi-Fi
# durante el desarrollo de la Fase 3+ (V3-DESIGN.md). Requiere, UNA SOLA VEZ
# por maquina, un url ACL (ver comentario mas abajo) porque HttpListener no
# deja escuchar en 0.0.0.0 sin permisos elevados o esa reserva.
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://+:8734/')
try {
  $listener.Start()
} catch {
  Write-Host "No se pudo escuchar en todas las interfaces (0.0.0.0:8734)."
  Write-Host "Ejecuta UNA VEZ, en un PowerShell como Administrador:"
  Write-Host "  netsh http add urlacl url=http://+:8734/ user=$env:USERDOMAIN\$env:USERNAME"
  Write-Host "Y si el movil sigue sin conectar, la regla de firewall (tambien como Administrador):"
  Write-Host "  New-NetFirewallRule -DisplayName 'Japon v3 dev server' -Direction Inbound -LocalPort 8734 -Protocol TCP -Action Allow -Profile Private"
  exit 1
}
$root = Split-Path $PSScriptRoot -Parent
$ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi' -ErrorAction SilentlyContinue).IPAddress
if (-not $ip) { $ip = '<tu-ip-de-wifi>' }
Write-Host "Sirviendo en http://localhost:8734/  y  http://$ip`:8734/"
Write-Host "Desde el movil (misma Wi-Fi): http://$ip`:8734/v3/index.html"
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path.EndsWith('/')) { $path = $path + 'index.html' }
    $file = Join-Path $root ($path.TrimStart('/') -replace '/', '\')
    if ((Test-Path $file) -and (Get-Item $file).PSIsContainer -eq $false) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $mime = @{'.html'='text/html; charset=utf-8'; '.js'='text/javascript'; '.css'='text/css'; '.json'='application/json'; '.png'='image/png'; '.svg'='image/svg+xml'; '.pdf'='application/pdf'}[$ext]
      if (-not $mime) { $mime = 'application/octet-stream' }
      $ctx.Response.ContentType = $mime
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  } catch { }
}
