param(
  [string]$TaskName = "BodyGate Admin",
  [int]$Port = 3000,
  [string]$Hostname = "0.0.0.0",
  [string]$LogDirectory = ""
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$StartScript = Join-Path $PSScriptRoot "start-bodygate.ps1"

if ([string]::IsNullOrWhiteSpace($LogDirectory)) {
  $LogDirectory = Join-Path $Root "logs"
}

$argument = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$StartScript`"",
  "-Port", $Port,
  "-Hostname", "`"$Hostname`"",
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

Write-Host "Scheduled task '$TaskName' installed."
Write-Host "Logs: $LogDirectory"
