$ErrorActionPreference = "Stop"
$ngrokExe = "C:\Users\Salvador\AppData\Local\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe"

if (-not (Test-Path -LiteralPath $ngrokExe)) {
    throw "ngrok não encontrado em $ngrokExe"
}

& $ngrokExe http --domain=anatomist-upward-flashy.ngrok-free.dev 8787
