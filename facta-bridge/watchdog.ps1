# Mantém a ponte da Facta e o túnel (ngrok) de pé: se a porta 8787 não responde, sobe a ponte; se o ngrok
# não está rodando, sobe o túnel. Roda sozinho pelo Agendador de Tarefas (ver README / registrar-tarefa.ps1).
$bridgeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ouvindo = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
if (-not $ouvindo) {
    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",(Join-Path $bridgeDir "start.ps1"))
}
if (-not (Get-Process ngrok -ErrorAction SilentlyContinue)) {
    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",(Join-Path $bridgeDir "start-tunnel.ps1"))
}
