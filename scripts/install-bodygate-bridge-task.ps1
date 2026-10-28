param(
  [string]$TaskName = "BodyGate Bridge",
  [string]$LogDirectory = "",
  [switch]$Force
)

# Registra il task pianificato che esegue scripts/start-bodygate-bridge.ps1: e' l'UNICO
# modo previsto di avviare il bridge (all'avvio del PC e dal Launcher). Lo script
# legge .env.local, imposta formato registro/IP del pannello, chiude le copie
# rimaste attive e riavvia il bridge se si ferma.
#
# Non avvia il task e non tocca un bridge gia' in esecuzione: l'avvio e' un passo
# separato (Start-ScheduledTask) da fare quando si decide.
#
# Eseguire come Amministratore.

$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "ERRORE: serve PowerShell avviato come Amministratore. Nulla e' stato modificato."
  exit 1
}

$Root = Split-Path -Parent $PSScriptRoot
$StartScript = Join-Path $PSScriptRoot "start-bodygate-bridge.ps1"

if ([string]::IsNullOrWhiteSpace($LogDirectory)) {
  $LogDirectory = Join-Path $Root "logs"
}

if (-not (Test-Path $StartScript)) {
  Write-Host "ERRORE: script non trovato: $StartScript"
  exit 1
}

# Due supervisori dello stesso bridge si chiuderebbero a vicenda l'eseguibile in
# un ciclo senza fine: se esiste gia' un task che esegue lo stesso script, con un
# altro nome, ci si ferma e lo si dice.
$existing = @(
  Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object {
    (($_.Actions | ForEach-Object { "$($_.Arguments)" }) -join " ") -like "*start-bodygate-bridge.ps1*"
  }
)

$conflict = $existing | Where-Object { $_.TaskName -ne $TaskName }
if ($conflict) {
  Write-Host "ERRORE: esiste gia' un task che avvia il bridge con un altro nome: $($conflict.TaskName -join ', ')."
  Write-Host "Riesegui con -TaskName `"<nome>`" per aggiornarlo, oppure eliminalo (Unregister-ScheduledTask) prima. Nulla e' stato modificato."
  exit 1
}

$sameName = $existing | Where-Object { $_.TaskName -eq $TaskName }
if ($sameName -and -not $Force) {
  Write-Host "Il task '$TaskName' esiste gia' e punta allo stesso script. Nulla da fare (usa -Force per ri-registrarlo)."
  exit 0
}

$argument = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$StartScript`"",
  "-LogDirectory", "`"$LogDirectory`""
) -join " "

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argument -WorkingDirectory $Root
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Days 0) `
  -MultipleInstances IgnoreNew `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Force | Out-Null

Write-Host "Task '$TaskName' registrato (non avviato)."
Write-Host "Script: $StartScript"
Write-Host "Log: $LogDirectory"
Write-Host "Per avviarlo: Start-ScheduledTask -TaskName `"$TaskName`""
