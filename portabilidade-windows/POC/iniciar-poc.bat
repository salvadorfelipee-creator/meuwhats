@echo off
setlocal enabledelayedexpansion
set "SCRIPT_DIR=%~dp0"

if not exist "%SCRIPT_DIR%.env.poc" (
  echo [POC] .env.poc nao existe ainda, copiando de .env.poc.example
  copy /y "%SCRIPT_DIR%.env.poc.example" "%SCRIPT_DIR%.env.poc" >nul
)

for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%SCRIPT_DIR%.env.poc") do (
  set "%%A=%%B"
)

echo [POC] Launcher rodando a partir de: %SCRIPT_DIR%
echo [POC] Diretorio atual (CWD) neste momento: %CD%
echo [POC] (propositalmente pode ser diferente do SCRIPT_DIR - prova que %%~dp0 resolve certo)

node "%SCRIPT_DIR%poc-app.js"

endlocal
