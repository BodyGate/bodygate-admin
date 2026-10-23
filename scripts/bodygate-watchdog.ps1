param(
  [int]$IntervalSeconds = 120,
  [int]$FailureThreshold = 3,
  [string]$EnvFile = "",
  [string]$LogDirectory = ""
)

# Independent watchdog process: checks the admin server and the turnstile
# bridge on a schedule and pushes a Telegram alert the moment either one
# stops responding for FailureThreshold consecutive checks (default: ~6
# minutes), instead of the outage being discovered a week later by whoever
# happens to ask about the turnstile. Runs as its own scheduled task, so it
# keeps working even if BodyGate Admin itself is the thing that's down.
$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if ([string]::IsNullOrWhiteSpace($EnvFile)) {
  $EnvFile = Join-Path $Root ".env.local"
}
if ([string]::IsNullOrWhiteSpace($LogDirectory)) {
  $LogDirectory = Join-Path $Root "logs"
}
New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null

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

$BotToken = Read-EnvValue -Path $EnvFile -Name "TELEGRAM_BOT_TOKEN"
$ChatId = Read-EnvValue -Path $EnvFile -Name "TELEGRAM_CHAT_ID"

function Write-WatchdogLog {
  param([string]$Message)
  $logFile = Join-Path $LogDirectory ("bodygate-watchdog-{0}.log" -f (Get-Date -Format "yyyyMMdd"))
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $logFile -Value "[$stamp] $Message"
}

function Send-TelegramAlert {
  param([string]$Text)

  if (-not $BotToken -or -not $ChatId) {
    Write-WatchdogLog "ALERT (Telegram non configurato, non inviato): $Text"
    return
  }

  try {
    $uri = "https://api.telegram.org/bot$BotToken/sendMessage"
    Invoke-RestMethod -Uri $uri -Method Post -Body @{ chat_id = $ChatId; text = $Text } -TimeoutSec 10 | Out-Null
    Write-WatchdogLog "Alert Telegram inviato: $Text"
  }
  catch {
    Write-WatchdogLog "Errore invio Telegram: $($_.Exception.Message)"
  }
}

function Test-Endpoint {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
  }
  catch {
    return $false
  }
}

function Repair-Bridge {
  # start-bodygate-bridge.ps1 only restarts the bridge when its process exits, so a
  # bridge that is alive but unresponsive is never recovered by the launcher alone.
  # 1) kill the stuck process, 2) make sure the scheduled task (the launcher loop)
  # is actually running, and start it if it ended or was disabled.
  $stuck = Get-Process -Name "BodyGateBridge" -ErrorAction SilentlyContinue
  if ($stuck) {
    $stuck | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-WatchdogLog "Bridge bloccato: processo terminato."
    Send-TelegramAlert -Text "Bridge bloccato: processo terminato, riavvio automatico in corso."
  }

  $task = Get-ScheduledTask -TaskName "BodyGate Bridge" -ErrorAction SilentlyContinue
  if (-not $task) {
    Write-WatchdogLog "Task pianificato 'BodyGate Bridge' non trovato."
    return
  }

  if ($task.State -eq "Disabled") {
    Enable-ScheduledTask -TaskName "BodyGate Bridge" -ErrorAction SilentlyContinue | Out-Null
  }

  if ($task.State -ne "Running") {
    Start-ScheduledTask -TaskName "BodyGate Bridge" -ErrorAction SilentlyContinue
    Write-WatchdogLog "Task 'BodyGate Bridge' non attivo (stato $($task.State)): avviato."
    Send-TelegramAlert -Text "Task 'BodyGate Bridge' non era attivo: riavviato."
  }
}

function Test-BridgePolling {
  # The bridge answers /status even while it can no longer read the DNake (e.g. the
  # DNake serves a truncated unlock_sql.db and every poll fails), so a plain HTTP
  # check says "online" while no badge is processed. /status reports pollHealthy.
  # An endpoint that is down is handled by the other target; a bridge build that
  # doesn't report pollHealthy yet is treated as healthy.
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:5050/status" -UseBasicParsing -TimeoutSec 5
    $status = $response.Content | ConvertFrom-Json

    if ($null -eq $status.pollHealthy) {
      return $true
    }

    return [bool]$status.pollHealthy
  }
  catch {
    return $true
  }
}

# Restarting the bridge does not fix a DNake that serves a truncated database, so
# the polling target only alerts (no Repair).
$targets = @(
  @{ Name = "BodyGate Admin (server locale)"; Url = "http://127.0.0.1:3000/api/health"; Fails = 0; Alerted = $false },
  @{ Name = "BodyGate Bridge (tornello)"; Url = "http://127.0.0.1:5050/status"; Fails = 0; Alerted = $false; RepairAfter = 2; Repair = ${function:Repair-Bridge} },
  @{ Name = "BodyGate Bridge (lettura badge dal DNake)"; Url = "http://127.0.0.1:5050/status (pollHealthy)"; Fails = 0; Alerted = $false; Check = ${function:Test-BridgePolling} }
)

Write-WatchdogLog ("Watchdog avviato. Controllo ogni {0}s, soglia {1} controlli falliti (~{2}s prima dell'alert)." -f $IntervalSeconds, $FailureThreshold, ($IntervalSeconds * $FailureThreshold))

while ($true) {
  foreach ($target in $targets) {
    if ($target.Check) {
      $ok = & $target.Check
    }
    else {
      $ok = Test-Endpoint -Url $target.Url
    }

    if ($ok) {
      if ($target.Alerted) {
        Send-TelegramAlert -Text ("RIPRISTINATO: {0} risponde di nuovo ({1})." -f $target.Name, $target.Url)
      }
      $target.Fails = 0
      $target.Alerted = $false
    }
    else {
      $target.Fails += 1
      Write-WatchdogLog ("{0} non risponde (fallimento {1}/{2})." -f $target.Name, $target.Fails, $FailureThreshold)

      if ($target.Fails -ge $FailureThreshold -and -not $target.Alerted) {
        $downForSeconds = $FailureThreshold * $IntervalSeconds
        Send-TelegramAlert -Text ("GUASTO: {0} non risponde da almeno {1}s ({2}). Controlla il PC in reception." -f $target.Name, $downForSeconds, $target.Url)
        $target.Alerted = $true
      }

      # Self-heal the bridge on every failing check (not only the first), so a
      # single failed repair never leaves the turnstile down until someone notices.
      if ($target.Repair -and $target.Fails -ge $target.RepairAfter) {
        & $target.Repair
      }
    }
  }

  Start-Sleep -Seconds $IntervalSeconds
}
