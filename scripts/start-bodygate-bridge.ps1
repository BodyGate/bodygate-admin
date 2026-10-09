param(
    [string]$BridgePath = "C:\BodyGateBridge_Releases\V3.9.4-alerts\BodyGateBridge.exe",
    [string]$EnvFile = "C:\bodygate-admin\.env.local",
    [string]$LogDirectory = "C:\bodygate-admin\logs"
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null

function Write-BridgeLog {
    param([string]$Message)

    $logFile = Join-Path $LogDirectory (
        "bodygate-bridge-{0}.log" -f (Get-Date -Format "yyyyMMdd")
    )

    "[{0}] {1}" -f (
        Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    ), $Message | Out-File `
        -FilePath $logFile `
        -Append `
        -Encoding utf8
}

function Read-EnvValue {
    param(
        [string]$Path,
        [string]$Name
    )

    if (-not (Test-Path $Path)) {
        throw "File di configurazione non trovato: $Path"
    }

    foreach ($line in Get-Content $Path) {
        $trimmed = $line.Trim()

        if (
            $trimmed.Length -eq 0 -or
            $trimmed.StartsWith("#")
        ) {
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

# Never exit on a missing exe/key: the scheduled task would end and nothing
# restarts it. Keep retrying so the bridge comes up as soon as it is fixed.
$machineKey = $null
while ($true) {
    if (-not (Test-Path $BridgePath)) {
        Write-BridgeLog "ERRORE: eseguibile non trovato: $BridgePath. Riprovo tra 30 secondi."
    }
    else {
        try {
            $machineKey = Read-EnvValue `
                -Path $EnvFile `
                -Name "BODYGATE_MACHINE_KEY"
        }
        catch {
            Write-BridgeLog "ERRORE: $($_.Exception.Message). Riprovo tra 30 secondi."
        }

        if (-not [string]::IsNullOrWhiteSpace($machineKey)) {
            break
        }

        Write-BridgeLog "ERRORE: BODYGATE_MACHINE_KEY non configurata. Riprovo tra 30 secondi."
    }

    Start-Sleep -Seconds 30
}

while ($true) {
    # A bridge still running when this script starts is an orphan: the task
    # was ended/restarted (schtasks /End only stops this script, not the child
    # exe) and nobody supervises it. Waiting for it would make every restart a
    # no-op while a stuck bridge keeps holding port 5050, so terminate it and
    # start a fresh instance. Any BodyGateBridge.exe is stopped, whatever its
    # path, because an older release would also hold the port.
    $existingBridges = @(
        Get-CimInstance Win32_Process `
            -Filter "Name = 'BodyGateBridge.exe'" `
            -ErrorAction SilentlyContinue
    )

    if ($existingBridges.Count -gt 0) {
        foreach ($existingBridge in $existingBridges) {
            Write-BridgeLog (
                "Bridge orfano trovato. PID: {0}. Lo termino per avviare un'istanza pulita." -f
                $existingBridge.ProcessId
            )

            Stop-Process `
                -Id $existingBridge.ProcessId `
                -Force `
                -ErrorAction SilentlyContinue

            Wait-Process `
                -Id $existingBridge.ProcessId `
                -Timeout 10 `
                -ErrorAction SilentlyContinue
        }

        # If a process refused to die this retries (and logs) every 3s, not in a hot loop.
        Start-Sleep -Seconds 3
        continue
    }

    try {
        $env:BODYGATE_MACHINE_KEY = $machineKey

        # Optional: ntfy alerts topic. Kept out of the source tree (the repo may
        # be public); without it the bridge simply runs with alerts disabled.
        try {
            $ntfyTopic = Read-EnvValue `
                -Path $EnvFile `
                -Name "BODYGATE_NTFY_TOPIC"
        }
        catch {
            $ntfyTopic = $null
        }

        if (-not [string]::IsNullOrWhiteSpace($ntfyTopic)) {
            $env:BODYGATE_NTFY_TOPIC = $ntfyTopic
        }
        else {
            Write-BridgeLog "ATTENZIONE: BODYGATE_NTFY_TOPIC non presente in .env.local, alert ntfy disattivati."
        }

        Write-BridgeLog "Avvio Bridge ufficiale: $BridgePath"

        $process = Start-Process `
            -FilePath $BridgePath `
            -WorkingDirectory (Split-Path $BridgePath) `
            -PassThru

        Write-BridgeLog "Bridge avviato. PID: $($process.Id)"

        Wait-Process `
            -Id $process.Id `
            -ErrorAction SilentlyContinue

        Write-BridgeLog "Bridge terminato. Riavvio tra 3 secondi."
    }
    catch {
        Write-BridgeLog "ERRORE: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds 3
}
