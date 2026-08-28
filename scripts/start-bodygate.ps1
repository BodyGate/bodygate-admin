param(
  [int]$Port = 3000,
  [string]$Hostname = "0.0.0.0",
  [int]$RestartDelaySeconds = 5,
  [string]$LogDirectory = "",
  [string]$GitBranch = "main"
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

function Write-BodyGateLog {
  param([string]$LogFile, [string]$Message)
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $LogFile -Value "[$stamp] $Message"
}

# Pulls the latest code from $GitBranch (fast-forward only, never rewrites or
# discards local state) and rebuilds only when there is actually a new commit
# to run. On any failure it logs and falls through to start the server with
# whatever build is already on disk, so a network blip or a bad commit never
# takes the reception PC offline.
function Update-BodyGateCode {
  param([string]$LogFile)

  try {
    $beforeCommit = (& git rev-parse HEAD).Trim()

    Write-BodyGateLog -LogFile $LogFile -Message "Controllo aggiornamenti (git fetch origin $GitBranch)..."
    & git fetch origin $GitBranch --quiet 2>&1 | Out-Null
    & git merge --ff-only "origin/$GitBranch" 2>&1 | Tee-Object -FilePath $LogFile -Append | Out-Null

    $afterCommit = (& git rev-parse HEAD).Trim()

    if ($afterCommit -eq $beforeCommit) {
      Write-BodyGateLog -LogFile $LogFile -Message "Nessun aggiornamento disponibile (commit corrente: $afterCommit)."
      return
    }

    Write-BodyGateLog -LogFile $LogFile -Message "Codice aggiornato da $beforeCommit a $afterCommit. Installazione dipendenze..."
    & npm.cmd ci --no-audit --no-fund 2>&1 | Tee-Object -FilePath $LogFile -Append | Out-Null

    Write-BodyGateLog -LogFile $LogFile -Message "Compilazione build di produzione..."
    & npm.cmd run build 2>&1 | Tee-Object -FilePath $LogFile -Append | Out-Null

    Write-BodyGateLog -LogFile $LogFile -Message "Aggiornamento completato: ora in esecuzione $afterCommit."
  }
  catch {
    Write-BodyGateLog -LogFile $LogFile -Message "ERRORE durante l'aggiornamento, avvio con la build esistente: $($_.Exception.Message)"
  }
}

while ($true) {
  $logFile = Join-Path $LogDirectory ("bodygate-admin-{0}.log" -f (Get-Date -Format "yyyyMMdd"))

  Update-BodyGateCode -LogFile $logFile

  Write-BodyGateLog -LogFile $logFile -Message "Starting BodyGate Admin on ${Hostname}:${Port}"

  & npm.cmd run start -- --hostname $Hostname --port $Port 2>&1 | Tee-Object -FilePath $logFile -Append
  $exitCode = $LASTEXITCODE

  Write-BodyGateLog -LogFile $logFile -Message "BodyGate Admin stopped with exit code $exitCode. Restarting in $RestartDelaySeconds seconds."
  Start-Sleep -Seconds $RestartDelaySeconds
}
