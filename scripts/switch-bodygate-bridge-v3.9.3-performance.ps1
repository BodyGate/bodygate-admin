$ErrorActionPreference = "Stop"

$Root = "C:\bodygate-admin"
$TaskName = "BodyGate Bridge"
$StartupScript = Join-Path $Root "scripts\start-bodygate-bridge.ps1"

$OldExe = "C:\BodyGateBridge_Releases\V3.9.2-machine-auth\BodyGateBridge.exe"
$NewExe = "C:\BodyGateBridge_Releases\V3.9.3-performance\BodyGateBridge.exe"
$NewDll = "C:\BodyGateBridge_Releases\V3.9.3-performance\BodyGateBridge.dll"
# IMPORTANT: keep in sync with $ExpectedHash in
# verify-bodygate-bridge-v3.9.3-performance.ps1 — both must match the hash of
# the currently built BodyGateBridge.exe, recomputed after every source
# change (e.g. the Pooling=False disk-fill fix), or this script aborts.
#
# NOTE: with `dotnet publish --self-contained` (non single-file),
# BodyGateBridge.exe is just the native apphost stub — its bytes do not
# change when Program.cs changes, so $ExpectedNewHash alone never actually
# detects a source change. $ExpectedNewDllHash, pinned against
# BodyGateBridge.dll (the real compiled IL), is the check that matters.
$ExpectedNewHash = "7E6B846E389E9483B1D7AD915527849CBD6959EE5B878D2889FB0AECDCC27537"
$ExpectedNewDllHash = "9CC50F5E1A59D692A6A5DDAD9B1340901FD982614EEC7F8A5AC0E8B3DE5D9948"

$BridgeStatusUrl = "http://127.0.0.1:5050/status"
$BodyGateHealthUrl = "http://127.0.0.1:3000/api/health"

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = "C:\BodyGate-Backups\bridge-switch-v3.9.3-$Timestamp"
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
    try {
        & schtasks.exe /End /TN $TaskName | Out-Host
    } catch {}

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

    Write-Host "`n*** ROLLBACK AUTOMATICO A V3.9.2 ***" -ForegroundColor Yellow

    try { Stop-BridgeTaskAndProcess } catch {}

    Restore-OldStartup

    try {
        Start-BridgeTask

        $oldProc = Wait-BridgeProcess -ExpectedExe $OldExe -Seconds 45

        if (-not $oldProc) {
            Write-Host "Rollback: processo V3.9.2 non rilevato entro 45 secondi." -ForegroundColor Red
            return
        }

        $status = Wait-BridgeStatus -Seconds 45

        if ($status) {
            Write-Host "ROLLBACK COMPLETATO: V3.9.2 ONLINE." -ForegroundColor Green
            Write-Host "PID: $($oldProc.ProcessId)" -ForegroundColor Green
        } else {
            Write-Host "V3.9.2 riavviata, ma /status non ha risposto entro 45 secondi." -ForegroundColor Red
        }
    }
    catch {
        Write-Host "Errore durante rollback: $($_.Exception.Message)" -ForegroundColor Red
    }
}

try {
    Step "PRE-CHECK"

    if (-not (Test-Path -LiteralPath $StartupScript)) {
        throw "Startup script non trovato: $StartupScript"
    }

    if (-not (Test-Path -LiteralPath $OldExe)) {
        throw "V3.9.2 non trovata: $OldExe"
    }

    if (-not (Test-Path -LiteralPath $NewExe)) {
        throw "V3.9.3 non trovata: $NewExe"
    }

    $newHash = (Get-FileHash -LiteralPath $NewExe -Algorithm SHA256).Hash
    if ($newHash -ne $ExpectedNewHash) {
        throw "Hash V3.9.3 non corrispondente a quello verificato."
    }

    if (-not (Test-Path -LiteralPath $NewDll)) {
        throw "V3.9.3 DLL non trovata: $NewDll"
    }

    $newDllHash = (Get-FileHash -LiteralPath $NewDll -Algorithm SHA256).Hash
    if ($newDllHash -ne $ExpectedNewDllHash) {
        throw "Hash DLL V3.9.3 non corrispondente a quello verificato. L'exe da solo non basta a garantire che il codice compilato sia quello atteso."
    }

    $bodyGateHealth = Invoke-WebRequest -Uri $BodyGateHealthUrl -UseBasicParsing -TimeoutSec 3
    if ($bodyGateHealth.StatusCode -ne 200) {
        throw "BodyGate Admin non è HTTP 200."
    }

    Write-Host "BodyGate Admin: HTTP 200" -ForegroundColor Green
    Write-Host "V3.9.3 hash: OK" -ForegroundColor Green

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

    Step "PREPARAZIONE STARTUP V3.9.3"

    $candidate = $startupText.Replace($OldExe, $NewExe)

    if (([regex]::Matches($candidate, $newEscaped)).Count -ne 1) {
        throw "Validazione startup V3.9.3 fallita."
    }

    $CandidatePath = Join-Path $BackupDir "start-bodygate-bridge.v3.9.3.candidate.ps1"

    [System.IO.File]::WriteAllText(
        $CandidatePath,
        $candidate,
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Host "Candidate validato: $CandidatePath" -ForegroundColor Green

    $SwitchStarted = $true

    Step "STOP V3.9.2"
    Stop-BridgeTaskAndProcess

    Step "INSTALLAZIONE STARTUP V3.9.3"
    Copy-Item -LiteralPath $CandidatePath -Destination $StartupScript -Force

    Step "AVVIO V3.9.3"
    Start-BridgeTask

    $newProc = Wait-BridgeProcess -ExpectedExe $NewExe -Seconds 45

    if (-not $newProc) {
        throw "V3.9.3 non rilevata come processo entro 45 secondi."
    }

    Write-Host "V3.9.3 processo rilevato. PID: $($newProc.ProcessId)" -ForegroundColor Green

    $status = Wait-BridgeStatus -Seconds 45

    if (-not $status) {
        throw "V3.9.3 avviata ma /status non risponde HTTP 200."
    }

    Step "VERIFICA PARAMETRI RUNTIME"

    $statusText = $status.Content
    Write-Host $statusText

    if ($statusText -notmatch '100') {
        throw "/status non mostra il polling 100 ms atteso."
    }

    if ($statusText -notmatch '0') {
        throw "/status non mostra il delay 0 ms atteso."
    }

    Step "RISULTATO"

    Write-Host "SWITCH V3.9.3 COMPLETATO." -ForegroundColor Green
    Write-Host "Processo: $($newProc.ExecutablePath)" -ForegroundColor Green
    Write-Host "PID:      $($newProc.ProcessId)" -ForegroundColor Green
    Write-Host "Bridge /status: HTTP 200" -ForegroundColor Green
    Write-Host "Polling: 100 ms" -ForegroundColor Green
    Write-Host "Open delay: 0 ms" -ForegroundColor Green
    Write-Host "V3.9.2 resta disponibile per rollback." -ForegroundColor Yellow
}
catch {
    Write-Host "`nERRORE SWITCH: $($_.Exception.Message)" -ForegroundColor Red
    Rollback
    throw
}
