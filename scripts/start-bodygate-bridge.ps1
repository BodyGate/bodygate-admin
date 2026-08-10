param(
    [string]$BridgePath = "C:\BodyGateBridge_Releases\V3.9.3-performance\BodyGateBridge.exe",
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

if (-not (Test-Path $BridgePath)) {
    Write-BridgeLog "ERRORE: eseguibile non trovato: $BridgePath"
    throw "BodyGate Bridge non trovato."
}

$machineKey = Read-EnvValue `
    -Path $EnvFile `
    -Name "BODYGATE_MACHINE_KEY"

if ([string]::IsNullOrWhiteSpace($machineKey)) {
    Write-BridgeLog "ERRORE: BODYGATE_MACHINE_KEY non configurata."
    throw "BODYGATE_MACHINE_KEY non configurata."
}

$expectedPath = [System.IO.Path]::GetFullPath($BridgePath)

while ($true) {
    $existingBridge = Get-CimInstance Win32_Process `
        -Filter "Name = 'BodyGateBridge.exe'" `
        -ErrorAction SilentlyContinue |
    Where-Object {
        $_.ExecutablePath -and
        [System.IO.Path]::GetFullPath($_.ExecutablePath) -eq $expectedPath
    } |
    Select-Object -First 1

    if ($existingBridge) {
        Write-BridgeLog (
            "Bridge già attivo. PID: {0}. Attendo la sua chiusura." -f
            $existingBridge.ProcessId
        )

        Wait-Process `
            -Id $existingBridge.ProcessId `
            -ErrorAction SilentlyContinue

        Write-BridgeLog "Bridge arrestato. Riavvio tra 3 secondi."
        Start-Sleep -Seconds 3
        continue
    }

    try {
        $env:BODYGATE_MACHINE_KEY = $machineKey

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
