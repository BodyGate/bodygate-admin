param(
  [int]$Port = 3000,
  [string]$Hostname = "0.0.0.0",
  [int]$RestartDelaySeconds = 5,
  [string]$LogDirectory = ""
)

# NOT "Stop": with 2>&1 redirection PowerShell wraps every line a native
# command writes to stderr into a terminating error under "Stop" - even a
# harmless npm/Next.js warning. That would silently kill this loop the
# moment `npm run start` printed a stray stderr line.
$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if ([string]::IsNullOrWhiteSpace($LogDirectory)) {
  $LogDirectory = Join-Path $Root "logs"
}

New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null

$env:PORT = $Port.ToString()
$env:HOSTNAME = $Hostname
$env:NODE_ENV = "production"

function Write-BodyGateLog {
  param([string]$LogFile, [string]$Message)
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $LogFile -Value "[$stamp] $Message"
}

# This script ONLY runs the already-built server and restarts it if it
# crashes. It never touches git, npm ci or npm build - updating the code is
# a separate, deliberate step (scripts/deploy-bodygate.ps1). Keeping the two
# apart means a broken update can never turn into a silent restart-every-5-
# seconds outage again: if there is no working build, this loop just keeps
# restarting whatever build IS on disk, which is either "fine" or "the same
# known failure that was already visible five seconds ago" - never worse.
while ($true) {
  $logFile = Join-Path $LogDirectory ("bodygate-admin-{0}.log" -f (Get-Date -Format "yyyyMMdd"))

  Write-BodyGateLog -LogFile $logFile -Message "Starting BodyGate Admin on ${Hostname}:${Port}"

  & npm.cmd run start -- --hostname $Hostname --port $Port 2>&1 | Tee-Object -FilePath $logFile -Append
  $exitCode = $LASTEXITCODE

  Write-BodyGateLog -LogFile $logFile -Message "BodyGate Admin stopped with exit code $exitCode. Restarting in $RestartDelaySeconds seconds."
  Start-Sleep -Seconds $RestartDelaySeconds
}
