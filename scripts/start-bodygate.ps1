param(
  [int]$Port = 3000,
  [string]$Hostname = "0.0.0.0",
  [int]$RestartDelaySeconds = 5,
  [string]$LogDirectory = "",
  [string]$GitBranch = "main",
  [string]$EnvFile = ""
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if ([string]::IsNullOrWhiteSpace($LogDirectory)) {
  $LogDirectory = Join-Path $Root "logs"
}

if ([string]::IsNullOrWhiteSpace($EnvFile)) {
  $EnvFile = Join-Path $Root ".env.local"
}

New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null

$env:PORT = $Port.ToString()
$env:HOSTNAME = $Hostname
$env:NODE_ENV = "production"

# The scheduled task runs as SYSTEM, which has its own Windows profile and
# therefore never sees the interactive user's stored Git credentials (Git
# Credential Manager entries are DPAPI-encrypted to the signed-in user). With
# no credential available and no console attached, an authenticated `git
# fetch` would otherwise hang waiting for a username/password prompt that can
# never arrive. Failing fast here means a missing/invalid token is a clear,
# fast error in the log instead of a hung task.
$env:GIT_TERMINAL_PROMPT = "0"

function Write-BodyGateLog {
  param([string]$LogFile, [string]$Message)
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $LogFile -Value "[$stamp] $Message"
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

# Pulls the latest code from $GitBranch (fast-forward only, never rewrites or
# discards local state) and rebuilds only when there is actually a new commit
# to run. On any failure it logs and falls through to start the server with
# whatever build is already on disk, so a network blip or a bad commit never
# takes the reception PC offline.
function Update-BodyGateCode {
  param([string]$LogFile)

  # Local to this function only (PowerShell scoping reverts it automatically
  # on return): with the script-wide "Stop" preference, *any* line a native
  # command writes to stderr via `2>&1` - even a harmless npm/Next.js warning,
  # not just a real failure - is wrapped into a terminating error and aborts
  # the whole update mid-build. Exit codes are checked explicitly below
  # instead, which is the only reliable signal for native commands.
  $ErrorActionPreference = "Continue"
  $extraHeaderSet = $false

  try {
    $beforeCommit = (& git rev-parse HEAD).Trim()

    # SYSTEM has no usable Git credentials of its own (see note above on
    # GIT_TERMINAL_PROMPT), so authenticate this fetch with a token read from
    # .env.local instead of relying on any credential store. The header is
    # written to local git config only for the duration of the fetch, never
    # logged, and never passed as a command-line argument (which would be
    # visible to any process listing).
    $updateToken = Read-EnvValue -Path $EnvFile -Name "BODYGATE_GIT_UPDATE_TOKEN"

    if ($updateToken) {
      $basicAuth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("x-access-token:$updateToken"))
      & git config --local http.extraheader "AUTHORIZATION: basic $basicAuth" | Out-Null
      $extraHeaderSet = $true
    }
    else {
      Write-BodyGateLog -LogFile $LogFile -Message "AVVISO: BODYGATE_GIT_UPDATE_TOKEN non configurato in $EnvFile; il fetch procedera' senza autenticazione e fallira' su repository privati."
    }

    Write-BodyGateLog -LogFile $LogFile -Message "Controllo aggiornamenti (git fetch origin $GitBranch)..."
    $fetchOutput = & git fetch origin $GitBranch --quiet 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw "git fetch fallito (exit code $LASTEXITCODE): $($fetchOutput -join ' | ')"
    }

    $mergeOutput = & git merge --ff-only "origin/$GitBranch" 2>&1
    Add-Content -Path $LogFile -Value $mergeOutput
    if ($LASTEXITCODE -ne 0) {
      throw "git merge --ff-only fallito (exit code $LASTEXITCODE): $($mergeOutput -join ' | ')"
    }

    $afterCommit = (& git rev-parse HEAD).Trim()

    if ($afterCommit -eq $beforeCommit) {
      Write-BodyGateLog -LogFile $LogFile -Message "Nessun aggiornamento disponibile (commit corrente: $afterCommit)."
      return
    }

    Write-BodyGateLog -LogFile $LogFile -Message "Codice aggiornato da $beforeCommit a $afterCommit. Installazione dipendenze..."
    $ciOutput = & npm.cmd ci --no-audit --no-fund 2>&1
    Add-Content -Path $LogFile -Value $ciOutput
    if ($LASTEXITCODE -ne 0) {
      throw "npm ci fallito (exit code $LASTEXITCODE)"
    }

    Write-BodyGateLog -LogFile $LogFile -Message "Compilazione build di produzione..."
    $buildOutput = & npm.cmd run build 2>&1
    Add-Content -Path $LogFile -Value $buildOutput
    if ($LASTEXITCODE -ne 0) {
      throw "npm run build fallito (exit code $LASTEXITCODE)"
    }

    Write-BodyGateLog -LogFile $LogFile -Message "Aggiornamento completato: ora in esecuzione $afterCommit."
  }
  catch {
    Write-BodyGateLog -LogFile $LogFile -Message "ERRORE durante l'aggiornamento, avvio con la build esistente: $($_.Exception.Message)"
  }
  finally {
    if ($extraHeaderSet) {
      & git config --local --unset http.extraheader | Out-Null
    }
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
