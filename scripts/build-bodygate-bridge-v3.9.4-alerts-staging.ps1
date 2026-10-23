$ErrorActionPreference = "Stop"

$Root = "C:\bodygate-admin"
$SourceDir = Join-Path $Root "bridge\bridge-v2"
$SourceProgram = Join-Path $SourceDir "Program.cs"

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$StageRoot = "C:\BodyGateBridge_Builds\V3.9.4-alerts-$Timestamp"
$StageProject = Join-Path $StageRoot "src"
$ReleaseDir = "C:\BodyGateBridge_Releases\V3.9.4-alerts"

function Step([string]$Text) {
    Write-Host "`n=== $Text ===" -ForegroundColor Cyan
}

Step "PRE-CHECK"

if (-not (Test-Path -LiteralPath $SourceProgram)) {
    throw "Program.cs non trovato: $SourceProgram"
}

$csproj = Get-ChildItem -LiteralPath $SourceDir -Filter "*.csproj" -File |
    Select-Object -First 1

if (-not $csproj) {
    throw "Nessun file .csproj trovato in $SourceDir"
}

Write-Host "Sorgente: $SourceProgram"
Write-Host "Project:  $($csproj.FullName)"
Write-Host "Staging:  $StageProject"
Write-Host "Release:  $ReleaseDir"

# A differenza della V3.9.3, il sorgente in git e' gia' allineato ai valori di
# produzione (100 ms / 0 ms) e contiene gia' il codice degli alert ntfy: non
# serve alcuna patch di staging, solo pubblicare cio' che e' su git.
$sourceText = Get-Content -LiteralPath $SourceProgram -Raw

$requiredPatterns = @(
    'V3.9.4-ALERTS',
    'BODYGATE_MACHINE_KEY',
    'x-bodygate-machine-key',
    'private static readonly int PollIntervalMs = 100;',
    'private static readonly int OpenDelayAfterBadgeMs = 0;',
    'Timeout = TimeSpan.FromSeconds(5)',
    'BODYGATE_NTFY_TOPIC',
    'class DnakeDbIncompleteException',
    'private static void CheckStaleAccessAlert()',
    'private static void NotifyPollFailed(Exception error)'
)

foreach ($pattern in $requiredPatterns) {
    if (-not $sourceText.Contains($pattern)) {
        throw "Pre-check fallito: pattern atteso non trovato: $pattern"
    }
}

$sourceHash = (Get-FileHash -LiteralPath $SourceProgram -Algorithm SHA256).Hash

Write-Host "SHA256 Program.cs: $sourceHash" -ForegroundColor Yellow

Step "COPIA STAGING"

New-Item -ItemType Directory -Path $StageProject -Force | Out-Null

Get-ChildItem -LiteralPath $SourceDir -Force |
    Where-Object { $_.Name -notin @("bin", "obj") } |
    ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $StageProject -Recurse -Force
    }

$StageProgram = Join-Path $StageProject "Program.cs"

if (-not (Test-Path -LiteralPath $StageProgram)) {
    throw "Program.cs staging non creato."
}

Write-Host "Machine auth: PRESERVATA" -ForegroundColor Green
Write-Host "Polling:      100 ms (allineato a produzione)" -ForegroundColor Green
Write-Host "Open delay:   0 ms (allineato a produzione)" -ForegroundColor Green
Write-Host "API timeout:  5 s INVARIATO" -ForegroundColor Green
Write-Host "Alert ntfy:   PRESENTI" -ForegroundColor Green

Step "PUBLISH IN CARTELLA TEMPORANEA"

$TempPublish = Join-Path $StageRoot "publish"

Push-Location $StageProject
try {
    & dotnet publish $csproj.Name `
        -c Release `
        -r win-x64 `
        --self-contained true `
        -o $TempPublish

    if ($LASTEXITCODE -ne 0) {
        throw "dotnet publish fallito."
    }
}
finally {
    Pop-Location
}

$PublishedExe = Join-Path $TempPublish "BodyGateBridge.exe"

if (-not (Test-Path -LiteralPath $PublishedExe)) {
    throw "BodyGateBridge.exe non trovato dopo publish."
}

Step "PREPARAZIONE RELEASE SEPARATA"

if (Test-Path -LiteralPath $ReleaseDir) {
    $ExistingBackup = "$ReleaseDir.before-$Timestamp"
    Move-Item -LiteralPath $ReleaseDir -Destination $ExistingBackup
    Write-Host "Release precedente V3.9.4 spostata in: $ExistingBackup" -ForegroundColor Yellow
}

New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null

Get-ChildItem -LiteralPath $TempPublish -Force |
    Copy-Item -Destination $ReleaseDir -Recurse -Force

$ReleaseExe = Join-Path $ReleaseDir "BodyGateBridge.exe"
$ReleaseDll = Join-Path $ReleaseDir "BodyGateBridge.dll"
$ReleaseHash = (Get-FileHash -LiteralPath $ReleaseExe -Algorithm SHA256).Hash
$ReleaseDllHash = (Get-FileHash -LiteralPath $ReleaseDll -Algorithm SHA256).Hash

Step "RISULTATO"

Write-Host "V3.9.4 ALERTS CREATA." -ForegroundColor Green
Write-Host "Release:  $ReleaseDir" -ForegroundColor Green
Write-Host "EXE:      $ReleaseExe" -ForegroundColor Green
Write-Host "SHA256 EXE: $ReleaseHash" -ForegroundColor Yellow
Write-Host "SHA256 DLL: $ReleaseDllHash" -ForegroundColor Yellow

Write-Host ""
Write-Host "IMPORTANTE:" -ForegroundColor Yellow
Write-Host "- Il Bridge attualmente in esecuzione NON e' stato fermato." -ForegroundColor Yellow
Write-Host "- Il task 'BodyGate Bridge' NON e' stato modificato." -ForegroundColor Yellow
Write-Host "- V3.9.3 resta intatta per rollback." -ForegroundColor Yellow
Write-Host "- NON avviare ancora manualmente V3.9.4." -ForegroundColor Yellow
Write-Host "- Aggiorna ExpectedNewHash/ExpectedNewDllHash negli script verify/switch con i valori sopra." -ForegroundColor Yellow
