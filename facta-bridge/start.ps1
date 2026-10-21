$ErrorActionPreference = "Stop"
$bridgeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $bridgeDir ".env"

if (Test-Path -LiteralPath $envFile) {
    Get-Content -LiteralPath $envFile | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $parts = $line.Split("=", 2)
        if ($parts.Count -eq 2) { [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1], "Process") }
    }
}

@("FACTA_USERNAME", "FACTA_PASSWORD", "FACTA_BRIDGE_SECRET", "FACTA_ENV") | ForEach-Object {
    if (-not [Environment]::GetEnvironmentVariable($_, "Process")) {
        $savedValue = [Environment]::GetEnvironmentVariable($_, "User")
        if ($savedValue) { [Environment]::SetEnvironmentVariable($_, $savedValue, "Process") }
    }
}

$logDir = Join-Path $bridgeDir "logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
& node (Join-Path $bridgeDir "server.js") *>> (Join-Path $logDir "bridge.out.log")
