param(
  [int]$Port = 3000,
  [string]$Hostname = "0.0.0.0",
  [int]$RestartDelaySeconds = 5,
  [string]$LogDirectory = ""
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if ([string]::IsNullOrWhiteSpace($LogDirectory)) {
  $LogDirectory = Join-Path $Root "logs"
}

New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null

$env:PORT = $Port.ToString()
$env:HOSTNAME = $Hostname
$env:NODE_ENV = "production"

while ($true) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $logFile = Join-Path $LogDirectory ("bodygate-admin-{0}.log" -f (Get-Date -Format "yyyyMMdd"))
  Add-Content -Path $logFile -Value "[$stamp] Starting BodyGate Admin on ${Hostname}:${Port}"

  & npm.cmd run start -- --hostname $Hostname --port $Port 2>&1 | Tee-Object -FilePath $logFile -Append
  $exitCode = $LASTEXITCODE

  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $logFile -Value "[$stamp] BodyGate Admin stopped with exit code $exitCode. Restarting in $RestartDelaySeconds seconds."
  Start-Sleep -Seconds $RestartDelaySeconds
}
