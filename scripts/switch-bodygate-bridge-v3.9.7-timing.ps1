$ErrorActionPreference = "Stop"

# Switch V3.9.6-txt -> V3.9.7-timing: stesso bridge, con i tempi di ogni accesso nel log
# (coda, BodyGate, tornello, totale) e in /status. Rollback automatico a V3.9.6.

$Root = "C:\bodygate-admin"
$TaskName = "BodyGate Bridge"
$StartupScript = Join-Path $Root "scripts\start-bodygate-bridge.ps1"

$OldExe = "C:\BodyGateBridge_Releases\V3.9.6-txt\BodyGateBridge.exe"
$NewExe = "C:\BodyGateBridge_Releases\V3.9.7-timing\BodyGateBridge.exe"
$NewDll = "C:\BodyGateBridge_Releases\V3.9.7-timing\BodyGateBridge.dll"
$ManifestPath = "C:\BodyGateBridge_Releases\V3.9.7-timing\release-manifest.json"
if (-not (Test-Path -LiteralPath $ManifestPath)) { throw "Manifest non trovato: $ManifestPath (esegui prima lo script di build)." }
$Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$ExpectedNewHash = $Manifest.exeSha256
$ExpectedNewDllHash = $Manifest.dllSha256

$BridgeStatusUrl = "http://127.0.0.1:5050/status"
$BodyGateHealthUrl = "http://127.0.0.1:3000/api/health"

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = "C:\BodyGate-Backups\bridge-switch-v3.9.7-$Timestamp"
$StartupBackup = Join-Path $BackupDir "start-bodygate-bridge.before.ps1"

$SwitchStarted = $false

function Step([string]$Text) {
    Write-Host "`n=== $Text ===" -ForegroundColor Cyan
}

function Wait-BridgeProcess([string]$ExpectedExe, [int]$Seconds = 45) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    $expected = [System.IO.Path]::GetFullPath($ExpectedExe)

    while ((Get-Date) -lt $deadline) {
        $proc = Get-CimInstance Win32_Process |
            Where-Object {
                $_.Name -eq "BodyGateBridge.exe" -and
                $_.ExecutablePath -and
                ([System.IO.Path]::GetFullPath($_.ExecutablePath) -eq $expected)
            } |
            Select-Object -First 1

        if ($proc) {
            return $proc
        }

        Start-Sleep -Milliseconds 500
    }

    return $null
}

function Wait-BridgeStatus([int]$Seconds = 45) {
    $deadline = (Get-Date).AddSeconds($Seconds)

    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $BridgeStatusUrl -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200) {
                return $r
            }
        } catch {}

        Start-Sleep -Milliseconds 500
    }

    return $null
}

function Stop-BridgeTaskAndProcess {
    & schtasks.exe /End /TN $TaskName | Out-Host

    Start-Sleep -Seconds 2

    $procs = Get-CimInstance Win32_Process |
        Where-Object { $_.Name -eq "BodyGateBridge.exe" }

    foreach ($proc in $procs) {
        try {
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
            Write-Host "Terminato BodyGateBridge.exe PID $($proc.ProcessId)" -ForegroundColor Yellow
        } catch {
            Write-Host "Impossibile terminare PID $($proc.ProcessId): $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    Start-Sleep -Seconds 2
}

function Start-BridgeTask {
    & schtasks.exe /Run /TN $TaskName | Out-Host

    if ($LASTEXITCODE -ne 0) {
        throw "Impossibile avviare il task '$TaskName'."
    }
}

function Restore-OldStartup {
    if (Test-Path -LiteralPath $StartupBackup) {
        Copy-Item -LiteralPath $StartupBackup -Destination $StartupScript -Force
    }
}

function Rollback {
    if (-not $SwitchStarted) {
        return
    }

    Write-Host "`n*** ROLLBACK AUTOMATICO A V3.9.6 ***" -ForegroundColor Yellow

    try { Stop-BridgeTaskAndProcess } catch {}

    Restore-OldStartup

    try {
        Start-BridgeTask

        $oldProc = Wait-BridgeProcess -ExpectedExe $OldExe -Seconds 45

        if (-not $oldProc) {
            Write-Host "Rollback: processo V3.9.6 non rilevato entro 45 secondi." -ForegroundColor Red
            return
        }

        $status = Wait-BridgeStatus -Seconds 45

        if ($status) {
            Write-Host "ROLLBACK COMPLETATO: V3.9.6 ONLINE." -ForegroundColor Green
            Write-Host "PID: $($oldProc.ProcessId)" -ForegroundColor Green
        } else {
            Write-Host "V3.9.6 riavviata, ma /status non ha risposto entro 45 secondi." -ForegroundColor Red
        }
    }
    catch {
        Write-Host "Errore durante rollback: $($_.Exception.Message)" -ForegroundColor Red
    }
}

try {
    Step "PRE-CHECK"

    $identity = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    if (-not $identity.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
        throw "Questa sessione PowerShell non e' elevata (Amministratore). Il task pianificato '$TaskName' non e' gestibile senza privilegi elevati: riesegui questo script da un PowerShell 'Esegui come amministratore'."
    }

    if (-not (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue)) {
        throw "Task pianificato '$TaskName' non trovato anche in sessione elevata: controlla il nome esatto del task prima di procedere."
    }

    if (-not (Test-Path -LiteralPath $StartupScript)) {
        throw "Startup script non trovato: $StartupScript"
    }

    if (-not (Test-Path -LiteralPath $OldExe)) {
        throw "V3.9.6 non trovata: $OldExe"
    }

    if (-not (Test-Path -LiteralPath $NewExe)) {
        throw "V3.9.7 non trovata: $NewExe"
    }

    $newHash = (Get-FileHash -LiteralPath $NewExe -Algorithm SHA256).Hash
    if ($newHash -ne $ExpectedNewHash) {
        throw "Hash V3.9.7 non corrispondente a quello verificato."
    }

    if (-not (Test-Path -LiteralPath $NewDll)) {
        throw "V3.9.7 DLL non trovata: $NewDll"
    }

    $newDllHash = (Get-FileHash -LiteralPath $NewDll -Algorithm SHA256).Hash
    if ($newDllHash -ne $ExpectedNewDllHash) {
        throw "Hash DLL V3.9.7 non corrispondente a quello verificato. L'exe da solo non basta a garantire che il codice compilato sia quello atteso."
    }

    $bodyGateHealth = Invoke-WebRequest -Uri $BodyGateHealthUrl -UseBasicParsing -TimeoutSec 3
    if ($bodyGateHealth.StatusCode -ne 200) {
        throw "BodyGate Admin non e' HTTP 200."
    }

    Write-Host "BodyGate Admin: HTTP 200" -ForegroundColor Green
    Write-Host "V3.9.7 hash: OK" -ForegroundColor Green

    $startupText = Get-Content -LiteralPath $StartupScript -Raw

    $oldEscaped = [regex]::Escape($OldExe)
    $newEscaped = [regex]::Escape($NewExe)

    $oldCount = ([regex]::Matches($startupText, $oldEscaped)).Count
    $newCount = ([regex]::Matches($startupText, $newEscaped)).Count

    if ($oldCount -ne 1 -or $newCount -ne 0) {
        throw "BridgePath inatteso nello startup script (old=$oldCount, new=$newCount). Nessuna modifica eseguita."
    }

    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Copy-Item -LiteralPath $StartupScript -Destination $StartupBackup -Force

    Write-Host "Backup startup: $StartupBackup" -ForegroundColor Yellow

    Step "PREPARAZIONE STARTUP V3.9.7"

    $candidate = $startupText.Replace($OldExe, $NewExe)

    if (([regex]::Matches($candidate, $newEscaped)).Count -ne 1) {
        throw "Validazione startup V3.9.7 fallita."
    }

    $CandidatePath = Join-Path $BackupDir "start-bodygate-bridge.v3.9.7.candidate.ps1"

    [System.IO.File]::WriteAllText(
        $CandidatePath,
        $candidate,
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Host "Candidate validato: $CandidatePath" -ForegroundColor Green

    $SwitchStarted = $true

    Step "STOP V3.9.6"
    Stop-BridgeTaskAndProcess

    Step "INSTALLAZIONE STARTUP V3.9.7"
    Copy-Item -LiteralPath $CandidatePath -Destination $StartupScript -Force

    Step "AVVIO V3.9.7"
    Start-BridgeTask

    $newProc = Wait-BridgeProcess -ExpectedExe $NewExe -Seconds 45

    if (-not $newProc) {
        throw "V3.9.7 non rilevata come processo entro 45 secondi."
    }

    Write-Host "V3.9.7 processo rilevato. PID: $($newProc.ProcessId)" -ForegroundColor Green

    $status = Wait-BridgeStatus -Seconds 45

    if (-not $status) {
        throw "V3.9.7 avviata ma /status non risponde HTTP 200."
    }

    Step "VERIFICA PARAMETRI RUNTIME"

    # Lascia al polling il tempo di leggere il registro almeno una volta.
    Start-Sleep -Seconds 5
    $status = Wait-BridgeStatus -Seconds 15
    $statusText = $status.Content
    Write-Host $statusText

    if ($statusText -notmatch '"version"\s*:\s*"V3\.9\.7-TIMING"') {
        throw "/status non mostra la versione V3.9.7-TIMING."
    }

    if ($statusText -notmatch '"mode"\s*:\s*"dnake-(txt|sql)-polling"') {
        throw "/status non mostra la lettura del registro del DNake (mode=dnake-txt-polling o dnake-sql-polling)."
    }

    if ($statusText -notmatch '"pollHealthy"\s*:\s*true') {
        throw "/status: il polling del DNake non e' sano (pollHealthy=false). Controlla lastPollError."
    }

    Step "RISULTATO"

    Write-Host "SWITCH V3.9.7 COMPLETATO." -ForegroundColor Green
    Write-Host "Processo: $($newProc.ExecutablePath)" -ForegroundColor Green
    Write-Host "PID:      $($newProc.ProcessId)" -ForegroundColor Green
    Write-Host "Bridge /status: HTTP 200, polling DNake sano" -ForegroundColor Green
    Write-Host "Prova ora con un badge al tornello." -ForegroundColor Yellow
    Write-Host "V3.9.6 resta disponibile per rollback." -ForegroundColor Yellow
}
catch {
    Write-Host "`nERRORE SWITCH: $($_.Exception.Message)" -ForegroundColor Red
    Rollback
    throw
}
