$ErrorActionPreference = "Stop"

$ReleaseDir = "C:\BodyGateBridge_Releases\V3.9.3-performance"
$ReleaseExe = Join-Path $ReleaseDir "BodyGateBridge.exe"
$ReleaseDll = Join-Path $ReleaseDir "BodyGateBridge.dll"
# IMPORTANT: this hash is pinned to one specific build. Any source change to
# bridge/bridge-v2/Program.cs (e.g. the Pooling=False disk-fill fix) produces
# a different binary and a different hash. After rebuilding, recompute with
# Get-FileHash on the new BodyGateBridge.exe and update this constant (and
# $ExpectedNewHash in switch-bodygate-bridge-v3.9.3-performance.ps1) before
# running verify/switch, or both scripts will abort by design.
#
# NOTE: with `dotnet publish --self-contained` (non single-file),
# BodyGateBridge.exe is just the native apphost stub — its bytes do not
# change when Program.cs changes, so pinning only $ExpectedHash never
# actually detects a source change. $ExpectedDllHash, pinned against
# BodyGateBridge.dll (the real compiled IL), is the check that matters.
$ExpectedHash = "7E6B846E389E9483B1D7AD915527849CBD6959EE5B878D2889FB0AECDCC27537"
$ExpectedDllHash = "9CC50F5E1A59D692A6A5DDAD9B1340901FD982614EEC7F8A5AC0E8B3DE5D9948"

$BuildRoot = "C:\BodyGateBridge_Builds"

Write-Host "`n=== VERIFICA V3.9.3 PERFORMANCE ===" -ForegroundColor Cyan

if (-not (Test-Path -LiteralPath $ReleaseExe)) {
    throw "Release EXE non trovata: $ReleaseExe"
}

$hash = (Get-FileHash -LiteralPath $ReleaseExe -Algorithm SHA256).Hash

Write-Host "EXE:    $ReleaseExe"
Write-Host "SHA256: $hash"

if ($hash -ne $ExpectedHash) {
    throw "SHA256 diverso da quello prodotto durante la build."
}

Write-Host "Hash binario (exe, solo stub apphost): OK" -ForegroundColor Green

if (-not (Test-Path -LiteralPath $ReleaseDll)) {
    throw "Release DLL non trovata: $ReleaseDll"
}

$dllHash = (Get-FileHash -LiteralPath $ReleaseDll -Algorithm SHA256).Hash

Write-Host "DLL:    $ReleaseDll"
Write-Host "SHA256: $dllHash"

if ($dllHash -ne $ExpectedDllHash) {
    throw "SHA256 del DLL diverso da quello prodotto durante la build. L'exe da solo non basta a garantire che il codice compilato sia quello atteso."
}

Write-Host "Hash binario (dll, codice compilato reale): OK" -ForegroundColor Green

$stage = Get-ChildItem -LiteralPath $BuildRoot -Directory -Filter "V3.9.3-performance-*" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $stage) {
    throw "Cartella staging V3.9.3 non trovata."
}

$stageProgram = Join-Path $stage.FullName "src\Program.cs"

if (-not (Test-Path -LiteralPath $stageProgram)) {
    throw "Program.cs staging non trovato: $stageProgram"
}

$text = Get-Content -LiteralPath $stageProgram -Raw

$checks = [ordered]@{
    "Versione V3.9.3"       = 'V3.9.3-PERFORMANCE-MACHINE-AUTH'
    "Machine key"           = 'BODYGATE_MACHINE_KEY'
    "Machine header"        = 'x-bodygate-machine-key'
    "Polling 100 ms"        = 'private static readonly int PollIntervalMs = 100;'
    "Open delay 0 ms"       = 'private static readonly int OpenDelayAfterBadgeMs = 0;'
    "Timeout API 5 s"       = 'Timeout = TimeSpan.FromSeconds(5)'
    "Check API locale"      = 'http://127.0.0.1:3000/api/access/check'
    "Log API locale"        = 'http://127.0.0.1:3000/api/access/log'
}

foreach ($item in $checks.GetEnumerator()) {
    $ok = $text.Contains($item.Value)
    "{0,-24} {1}" -f $item.Key, $(if ($ok) { "OK" } else { "MANCANTE" })

    if (-not $ok) {
        throw "Verifica fallita: $($item.Key)"
    }
}

Write-Host "`n=== RELEASE ATTUALE DI ROLLBACK ===" -ForegroundColor Cyan

$oldExe = "C:\BodyGateBridge_Releases\V3.9.2-machine-auth\BodyGateBridge.exe"

Write-Host "V3.9.2 presente: $(Test-Path -LiteralPath $oldExe)"

if (-not (Test-Path -LiteralPath $oldExe)) {
    throw "V3.9.2 di rollback non trovata."
}

Get-Item -LiteralPath $oldExe |
    Select-Object FullName, Length, LastWriteTime |
    Format-List

Write-Host "`n=== TASK ATTUALE ===" -ForegroundColor Cyan

$task = Get-ScheduledTask -TaskName "BodyGate Bridge"
$task.Actions |
    Select-Object Execute, Arguments, WorkingDirectory |
    Format-List

Write-Host "`n=== PROCESSO ATTUALE ===" -ForegroundColor Cyan

Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq "BodyGateBridge.exe" } |
    Select-Object ProcessId, ExecutablePath, CreationDate |
    Format-List

Write-Host "`nVERIFICA V3.9.3 COMPLETATA: PRONTA PER SWITCH CONTROLLATO." -ForegroundColor Green
Write-Host "Nessun processo o task è stato modificato." -ForegroundColor Green
