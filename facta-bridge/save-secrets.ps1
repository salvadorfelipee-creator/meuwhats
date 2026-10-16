$ErrorActionPreference = "Stop"

if (-not $env:NEW_FACTA_USER -or -not $env:NEW_FACTA_PASS -or -not $env:NEW_BRIDGE_SECRET) {
    throw "Credenciais temporárias ausentes."
}

[Environment]::SetEnvironmentVariable("FACTA_USERNAME", $env:NEW_FACTA_USER, "User")
[Environment]::SetEnvironmentVariable("FACTA_PASSWORD", $env:NEW_FACTA_PASS, "User")
[Environment]::SetEnvironmentVariable("FACTA_BRIDGE_SECRET", $env:NEW_BRIDGE_SECRET, "User")
[Environment]::SetEnvironmentVariable("FACTA_ENV", "production", "User")

Write-Output "Credenciais da ponte salvas no perfil do Windows."
