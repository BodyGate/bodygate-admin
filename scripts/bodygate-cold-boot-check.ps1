$ErrorActionPreference = "Continue"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportRoot = "C:\BodyGate-Backups\cold-boot-tests"
$reportPath = Join-Path $reportRoot "cold-boot-$timestamp.txt"
New-Item -ItemType Directory -Path $reportRoot -Force | Out-Null

function Write-Report {
    param([string]$Text = "", [ConsoleColor]$Color = [ConsoleColor]::Gray)
    Write-Host $Text -ForegroundColor $Color
    $Text | Out-File $reportPath -Append -Encoding utf8
}

function Add-Section {
    param([string]$Title)
    Write-Report ""
    Write-Report ("=" * 64) Cyan
    Write-Report $Title Cyan
    Write-Report ("=" * 64) Cyan
}

function Test-HttpEndpoint {
    param([string]$Name, [string]$Url, [int]$TimeoutSeconds = 4)
    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSeconds -UseBasicParsing
        Write-Report ("PASS  {0}: HTTP {1} - {2}" -f $Name, $response.StatusCode, $Url) Green
        return $true
    }
    catch {
        Write-Report ("FAIL  {0}: {1} - {2}" -f $Name, $_.Exception.Message, $Url) Red
        return $false
    }
}

Write-Report "BODYGATE COLD BOOT VALIDATION"
Write-Report ("Generated: {0}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
Write-Report ("Computer: {0}" -f $env:COMPUTERNAME)
Write-Report ("User: {0}" -f $env:USERNAME)
Write-Report ("Report: {0}" -f $reportPath)

Add-Section "1. WINDOWS BOOT"
$os = Get-CimInstance Win32_OperatingSystem
$bootTime = $os.LastBootUpTime
$uptime = (Get-Date) - $bootTime
Write-Report ("Last boot: {0}" -f $bootTime)
Write-Report ("Uptime: {0:hh\:mm\:ss}" -f $uptime)
if ($uptime.TotalMinutes -le 15) {
    Write-Report "PASS  Test eseguito entro 15 minuti dal riavvio." Green
}
else {
    Write-Report "WARN  Il PC risulta avviato da oltre 15 minuti." Yellow
}

Add-Section "2. TASK SCHEDULER"
$taskNames = @("BodyGate Admin", "BodyGate Bridge")
$taskPass = $true
foreach ($taskName in $taskNames) {
    try {
        $task = Get-ScheduledTask -TaskName $taskName
        $info = Get-ScheduledTaskInfo -TaskName $taskName
        Write-Report ("Task: {0}" -f $taskName)
        Write-Report ("  State: {0}" -f $task.State)
        Write-Report ("  LastRunTime: {0}" -f $info.LastRunTime)
        Write-Report ("  LastTaskResult: {0}" -f $info.LastTaskResult)
        Write-Report ("  MultipleInstances: {0}" -f $task.Settings.MultipleInstances)
        Write-Report ("  RunAs: {0}" -f $task.Principal.UserId)
        $triggerTypes = @($task.Triggers | ForEach-Object { $_.CimClass.CimClassName })
        Write-Report ("  TriggerTypes: {0}" -f ($triggerTypes -join ", "))
        if ($task.State -eq "Running") {
            Write-Report ("PASS  {0} è Running." -f $taskName) Green
        }
        else {
            Write-Report ("FAIL  {0} non è Running." -f $taskName) Red
            $taskPass = $false
        }
    }
    catch {
        Write-Report ("FAIL  Task non trovato: {0} - {1}" -f $taskName, $_.Exception.Message) Red
        $taskPass = $false
    }
}

Add-Section "3. WAIT FOR SERVICES"
$deadline = (Get-Date).AddSeconds(120)
$serverOnline = $false
$bridgeOnline = $false
$attempt = 0
while ((Get-Date) -lt $deadline) {
    $attempt++
    try {
        $serverResponse = Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/health" -TimeoutSec 3 -UseBasicParsing
        $serverOnline = $serverResponse.StatusCode -eq 200
    }
    catch { $serverOnline = $false }

    try {
        $bridgeResponse = Invoke-WebRequest -Uri "http://127.0.0.1:5050/status" -TimeoutSec 3 -UseBasicParsing
        $bridgeOnline = $bridgeResponse.StatusCode -ge 200 -and $bridgeResponse.StatusCode -lt 400
    }
    catch { $bridgeOnline = $false }

    Write-Host ("Tentativo {0}: Server={1} Bridge={2}" -f $attempt, $serverOnline, $bridgeOnline)
    if ($serverOnline -and $bridgeOnline) { break }
    Start-Sleep -Seconds 3
}
if ($serverOnline) { Write-Report "PASS  BodyGate Server online entro 120 secondi." Green }
else { Write-Report "FAIL  BodyGate Server non online entro 120 secondi." Red }
if ($bridgeOnline) { Write-Report "PASS  DNake Bridge online entro 120 secondi." Green }
else { Write-Report "FAIL  DNake Bridge non online entro 120 secondi." Red }

Add-Section "4. HTTP ENDPOINTS"
$healthPass = Test-HttpEndpoint -Name "BodyGate health" -Url "http://127.0.0.1:3000/api/health"
$homePass = Test-HttpEndpoint -Name "BodyGate home" -Url "http://127.0.0.1:3000"
$bridgePass = Test-HttpEndpoint -Name "Bridge status" -Url "http://127.0.0.1:5050/status"

Add-Section "5. TCP PORTS"
$portPass = $true
foreach ($port in 3000, 5050) {
    $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($listeners) {
        foreach ($listener in $listeners) {
            Write-Report ("PASS  Porta {0} LISTEN su {1}; PID {2}" -f $port, $listener.LocalAddress, $listener.OwningProcess) Green
        }
    }
    else {
        Write-Report ("FAIL  Nessun listener sulla porta {0}." -f $port) Red
        $portPass = $false
    }
}

Add-Section "6. PROCESS INVENTORY"
$processes = Get-CimInstance Win32_Process |
    Where-Object {
        $_.Name -match "node|powershell|BodyGateBridge" -and
        ($_.CommandLine -match "bodygate-admin|BodyGateBridge" -or $_.ExecutablePath -match "BodyGateBridge")
    } |
    Select-Object ProcessId, ParentProcessId, Name, ExecutablePath, CommandLine

if ($processes) {
    $processes | Format-List | Out-String | ForEach-Object { Write-Report $_ }
}
else {
    Write-Report "FAIL  Nessun processo BodyGate rilevato." Red
}

$nextListeners = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (@($nextListeners).Count -eq 1) {
    Write-Report "PASS  Un solo listener effettivo su porta 3000." Green
}
elseif (@($nextListeners).Count -gt 1) {
    Write-Report ("FAIL  Rilevati {0} listener su porta 3000." -f @($nextListeners).Count) Red
}
else {
    Write-Report "FAIL  Nessun listener su porta 3000." Red
}

Add-Section "7. LAN ACCESS"
$ipv4Addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notmatch "^127\." -and $_.AddressState -eq "Preferred" } |
    Select-Object -ExpandProperty IPAddress -Unique
if ($ipv4Addresses) {
    foreach ($ip in $ipv4Addresses) {
        Test-HttpEndpoint -Name ("BodyGate LAN {0}" -f $ip) -Url ("http://{0}:3000/api/health" -f $ip) | Out-Null
    }
}
else {
    Write-Report "WARN  Nessun indirizzo IPv4 LAN rilevato." Yellow
}

Add-Section "8. PLATINUM LAUNCHER"
$launcherExe = "C:\BodyGate-Launcher-Platinum\releases\1.1.0-platinum-rc1\BodyGate.exe"
$shortcutPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "BodyGate Platinum TEST.lnk"
if (Test-Path $launcherExe) {
    $hash = Get-FileHash $launcherExe -Algorithm SHA256
    Write-Report ("PASS  Launcher presente: {0}" -f $launcherExe) Green
    Write-Report ("SHA256: {0}" -f $hash.Hash)
    if ($hash.Hash -eq "83BB1CFFE0480CB2F410E126427700821BD2D3F90775744B21D539932583A087") {
        Write-Report "PASS  Hash Launcher Platinum RC1 corrispondente." Green
    }
    else {
        Write-Report "FAIL  Hash Launcher diverso da quello certificato." Red
    }
}
else {
    Write-Report "FAIL  Eseguibile Launcher Platinum non trovato." Red
}

if (Test-Path $shortcutPath) {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    Write-Report ("Shortcut target: {0}" -f $shortcut.TargetPath)
    if ($shortcut.TargetPath -eq $launcherExe) {
        Write-Report "PASS  Collegamento TEST punta alla release Platinum RC1." Green
    }
    else {
        Write-Report "FAIL  Collegamento TEST punta a un percorso differente." Red
    }
}
else {
    Write-Report "FAIL  Collegamento BodyGate Platinum TEST non trovato." Red
}

Add-Section "9. AUTOMATIC RESULT"
$automaticPass = $taskPass -and $serverOnline -and $bridgeOnline -and $healthPass -and $homePass -and $bridgePass -and $portPass
if ($automaticPass) { Write-Report "AUTOMATIC RESULT: PASS" Green }
else { Write-Report "AUTOMATIC RESULT: FAIL" Red }

Write-Report ""
Write-Report "TEST MANUALI ANCORA NECESSARI:" Yellow
Write-Report "1. Aprire BodyGate Platinum TEST e verificare entrambi ONLINE."
Write-Report "2. Effettuare login dal PC."
Write-Report "3. Effettuare login dall'iPad tramite URL LAN."
Write-Report "4. Eseguire un accesso reale con badge o QR."
Write-Report "5. Confermare apertura tornello e registrazione log."
Write-Report ""
Write-Report ("Rapporto salvato in: {0}" -f $reportPath) Cyan

Write-Host "`nPremi INVIO per chiudere..." -ForegroundColor Yellow
[void](Read-Host)
