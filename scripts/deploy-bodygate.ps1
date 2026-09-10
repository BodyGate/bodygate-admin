param(
  [string]$GitBranch = "main",
  [string]$LogDirectory = "",
  [string]$EnvFile = ""
)

# Controlled deploy: run this manually (or from a schedule YOU choose) when
# you actually want to ship a new version. It is the only place that touches
# git/npm ci/npm build. scripts/start-bodygate.ps1's restart loop never runs
# this - so a broken update can no longer turn into a multi-day outage that
# nobody notices, because a failed deploy here leaves the running service
# completely untouched.
$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if ([string]::IsNullOrWhiteSpace($LogDirectory)) {
  $LogDirectory = Join-Path $Root "logs"
}
if ([string]::IsNullOrWhiteSpace($EnvFile)) {
  $EnvFile = Join-Path $Root ".env.local"
}
New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null

# SYSTEM (or whatever account runs this) has no interactive Git credentials
# of its own, so authenticate with a token from .env.local instead of
# relying on a credential store, and fail fast rather than hang on a prompt
# that can never arrive.
$env:GIT_TERMINAL_PROMPT = "0"

$logFile = Join-Path $LogDirectory ("bodygate-deploy-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))

function Write-DeployLog {
  param([string]$Message)
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $line = "[$stamp] $Message"
  Write-Host $line
  Add-Content -Path $logFile -Value $line
}

function Read-EnvValue {
  param([string]$Path, [string]$Name)

  if (-not (Test-Path $Path)) {
    return $null
  }

  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()

    if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#")) {
      continue
    }

    $separator = $trimmed.IndexOf("=")
    if ($separator -le 0) {
      continue
    }

    $variableName = $trimmed.Substring(0, $separator).Trim()
    if ($variableName -ne $Name) {
      continue
    }

    $value = $trimmed.Substring($separator + 1).Trim()
    return $value.Trim('"').Trim("'")
  }

  return $null
}

Write-DeployLog "=== DEPLOY CONTROLLATO: inizio (branch $GitBranch) ==="

$extraHeaderSet = $false
$serviceStopped = $false

try {
  $beforeCommit = (& git rev-parse HEAD).Trim()

  $updateToken = Read-EnvValue -Path $EnvFile -Name "BODYGATE_GIT_UPDATE_TOKEN"

  if ($updateToken) {
    $basicAuth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("x-access-token:$updateToken"))
    & git config --local http.extraheader "AUTHORIZATION: basic $basicAuth" | Out-Null
    $extraHeaderSet = $true
  }
  else {
    Write-DeployLog "AVVISO: BODYGATE_GIT_UPDATE_TOKEN non configurato in $EnvFile; il fetch procede senza autenticazione e fallira' su repository privati."
  }

  Write-DeployLog "git fetch origin $GitBranch..."
  $fetchOutput = & git fetch origin $GitBranch --quiet 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "git fetch fallito (exit code $LASTEXITCODE): $($fetchOutput -join ' | ')"
  }

  $mergeOutput = & git merge --ff-only "origin/$GitBranch" 2>&1
  Add-Content -Path $logFile -Value $mergeOutput
  if ($LASTEXITCODE -ne 0) {
    throw "git merge --ff-only fallito (exit code $LASTEXITCODE): $($mergeOutput -join ' | ')"
  }

  $afterCommit = (& git rev-parse HEAD).Trim()

  if ($afterCommit -eq $beforeCommit) {
    Write-DeployLog "Nessun nuovo commit (attuale: $afterCommit). Deploy non necessario."
  }
  else {
    Write-DeployLog "Codice aggiornato da $beforeCommit a $afterCommit."

    # Il vecchio processo Node.js tiene aperti dei binari nativi (es.
    # next-swc.win32-x64-msvc.node): su Windows `npm ci`/`npm run build`
    # falliscono con EPERM/unlink se lanciati mentre il servizio gira ancora.
    # Va quindi fermato PRIMA di installare/compilare, non dopo.
    Write-DeployLog "Arresto del servizio BodyGate Admin per liberare i file..."
    Get-ScheduledTask -TaskName "BodyGate Admin" -ErrorAction SilentlyContinue | Stop-ScheduledTask -ErrorAction SilentlyContinue
    $serviceStopped = $true
    Start-Sleep -Seconds 3

    $nodeModulesPath = Join-Path $Root "node_modules"
    $nodeModulesBackup = Join-Path $Root "node_modules.backup"
    $nextPath = Join-Path $Root ".next"
    $nextBackup = Join-Path $Root ".next.backup"

    # `npm ci` deletes node_modules itself before reinstalling, and a failed
    # `npm run build` can leave .next half-written - so a mid-update failure
    # (e.g. a network blip during npm ci) could otherwise leave neither a
    # working install nor a working build on disk, and the restart below
    # would just bring the service back up broken. Move the last known-good
    # node_modules/.next aside first so they can be restored on failure,
    # instead of restarting on whatever half-finished state npm/next left.
    Remove-Item -Recurse -Force $nodeModulesBackup, $nextBackup -ErrorAction SilentlyContinue
    if (Test-Path $nodeModulesPath) { Rename-Item -Path $nodeModulesPath -NewName "node_modules.backup" }
    if (Test-Path $nextPath) { Rename-Item -Path $nextPath -NewName ".next.backup" }

    $buildSucceeded = $false

    try {
      Write-DeployLog "Installazione dipendenze..."
      $ciOutput = & npm.cmd ci --no-audit --no-fund 2>&1
      Add-Content -Path $logFile -Value $ciOutput
      if ($LASTEXITCODE -ne 0) {
        throw "npm ci fallito (exit code $LASTEXITCODE)"
      }

      Write-DeployLog "Compilazione build di produzione..."
      $buildOutput = & npm.cmd run build 2>&1
      Add-Content -Path $logFile -Value $buildOutput
      if ($LASTEXITCODE -ne 0) {
        throw "npm run build fallito (exit code $LASTEXITCODE)"
      }

      Write-DeployLog "Build completata su $afterCommit."
      $buildSucceeded = $true
    }
    finally {
      if ($buildSucceeded) {
        Write-DeployLog "Nuova build valida: rimuovo il backup della versione precedente."
        Remove-Item -Recurse -Force $nodeModulesBackup, $nextBackup -ErrorAction SilentlyContinue
      }
      else {
        Write-DeployLog "Aggiornamento fallito: ripristino l'ultima build funzionante prima di riavviare."
        Remove-Item -Recurse -Force $nodeModulesPath, $nextPath -ErrorAction SilentlyContinue
        if (Test-Path $nodeModulesBackup) { Rename-Item -Path $nodeModulesBackup -NewName "node_modules" }
        if (Test-Path $nextBackup) { Rename-Item -Path $nextBackup -NewName ".next" }
      }

      # Riavvia SEMPRE, che la build sia riuscita o fallita: un servizio
      # fermo per un deploy fallito sarebbe l'esatta interruzione silenziosa
      # che questa separazione degli script doveva eliminare. Grazie al
      # backup/ripristino sopra, in caso di fallimento riparte esattamente
      # sull'ultima build che funzionava, non su uno stato a meta'.
      Write-DeployLog "Riavvio il servizio BodyGate Admin..."
      Get-ScheduledTask -TaskName "BodyGate Admin" -ErrorAction SilentlyContinue | Start-ScheduledTask -ErrorAction SilentlyContinue
    }
  }

  Write-DeployLog "=== DEPLOY CONTROLLATO: completato con successo ==="
}
catch {
  Write-DeployLog "ERRORE DEPLOY: $($_.Exception.Message)"
  if ($serviceStopped) {
    Write-DeployLog "Il servizio e' stato riavviato con l'ultima build funzionante precedente (ripristinata automaticamente)."
  }
  else {
    Write-DeployLog "Il servizio in esecuzione NON e' stato toccato: l'errore e' avvenuto prima dell'arresto (es. git fetch/merge)."
  }
  exit 1
}
finally {
  if ($extraHeaderSet) {
    & git config --local --unset http.extraheader | Out-Null
  }
}
