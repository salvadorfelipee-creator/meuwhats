# Opcional: se a porta 8787 não responde, sobe a ponte local da Facta. Não é necessário em produção nem no lote
# offline (ambos usam FACTA_DIRECT=true) — ver docs/FACTA-PONTE-LOCAL.md.
$bridgeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ouvindo = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
if (-not $ouvindo) {
    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",(Join-Path $bridgeDir "start.ps1"))
}
