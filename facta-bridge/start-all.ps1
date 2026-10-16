$ErrorActionPreference = "Stop"
$bridgeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $bridgeDir "logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$bridge = Start-Process powershell.exe -WindowStyle Hidden -PassThru -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $bridgeDir "start.ps1")
)
Start-Sleep -Seconds 2
if ($bridge.HasExited) { throw "A ponte Facta não iniciou. Verifique as variáveis de ambiente." }

& (Join-Path $bridgeDir "start-tunnel.ps1")
