$ErrorActionPreference = "Stop"

$Root = "C:\bodygate-admin"
$SourceDir = Join-Path $Root "bridge\bridge-v2"
$SourceProgram = Join-Path $SourceDir "Program.cs"

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$StageRoot = "C:\BodyGateBridge_Builds\V3.9.3-performance-$Timestamp"
$StageProject = Join-Path $StageRoot "src"
$ReleaseDir = "C:\BodyGateBridge_Releases\V3.9.3-performance"

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

$sourceText = Get-Content -LiteralPath $SourceProgram -Raw

$requiredPatterns = @(
    'BODYGATE_MACHINE_KEY',
    'x-bodygate-machine-key',
    'private static readonly int PollIntervalMs = 200;',
    'private static readonly int OpenDelayAfterBadgeMs = 50;',
    'Timeout = TimeSpan.FromSeconds(5)'
)

foreach ($pattern in $requiredPatterns) {
    if (-not $sourceText.Contains($pattern)) {
        throw "Pre-check fallito: pattern atteso non trovato: $pattern"
    }
}

$sourceHash = (Get-FileHash -LiteralPath $SourceProgram -Algorithm SHA256).Hash

Write-Host "SHA256 Program.cs base: $sourceHash" -ForegroundColor Yellow

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

Step "PATCH STAGING V3.9.3"

$candidate = Get-Content -LiteralPath $StageProgram -Raw

function Replace-Once {
    param(
        [string]$Text,
        [string]$Old,
        [string]$New,
        [string]$Description
    )

    $count = ([regex]::Matches($Text, [regex]::Escape($Old))).Count

    if ($count -ne 1) {
        throw "${Description}: trovate $count occorrenze invece di 1."
    }

    return $Text.Replace($Old, $New)
}

$candidate = Replace-Once `
    -Text $candidate `
    -Old 'private static readonly string Version = "V3.9-DNAKE-SQL-QR-PRODUCTION";' `
    -New 'private static readonly string Version = "V3.9.3-PERFORMANCE-MACHINE-AUTH";' `
    -Description "Version"

$candidate = Replace-Once `
    -Text $candidate `
    -Old 'private static readonly int PollIntervalMs = 200;' `
    -New 'private static readonly int PollIntervalMs = 100;' `
    -Description "PollIntervalMs"

$candidate = Replace-Once `
    -Text $candidate `
    -Old 'private static readonly int OpenDelayAfterBadgeMs = 50;' `
    -New 'private static readonly int OpenDelayAfterBadgeMs = 0;' `
    -Description "OpenDelayAfterBadgeMs"

[System.IO.File]::WriteAllText(
    $StageProgram,
    $candidate,
    [System.Text.UTF8Encoding]::new($false)
)

Step "VALIDAZIONE CANDIDATO"

$check = Get-Content -LiteralPath $StageProgram -Raw

$mustExist = @(
    'V3.9.3-PERFORMANCE-MACHINE-AUTH',
    'BODYGATE_MACHINE_KEY',
    'x-bodygate-machine-key',
    'private static readonly int PollIntervalMs = 100;',
    'private static readonly int OpenDelayAfterBadgeMs = 0;',
    'Timeout = TimeSpan.FromSeconds(5)',
    'http://127.0.0.1:3000/api/access/check',
    'http://127.0.0.1:3000/api/access/log'
)

foreach ($pattern in $mustExist) {
    if (-not $check.Contains($pattern)) {
        throw "Validazione candidato fallita: $pattern"
    }
}

Write-Host "Machine auth: PRESERVATA" -ForegroundColor Green
Write-Host "Polling:      100 ms" -ForegroundColor Green
Write-Host "Open delay:   0 ms" -ForegroundColor Green
Write-Host "API timeout:  5 s INVARIATO" -ForegroundColor Green

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
    Write-Host "Release precedente V3.9.3 spostata in: $ExistingBackup" -ForegroundColor Yellow
}

New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null

Get-ChildItem -LiteralPath $TempPublish -Force |
    Copy-Item -Destination $ReleaseDir -Recurse -Force

$ReleaseExe = Join-Path $ReleaseDir "BodyGateBridge.exe"
$ReleaseHash = (Get-FileHash -LiteralPath $ReleaseExe -Algorithm SHA256).Hash

Step "RISULTATO"

Write-Host "V3.9.3 PERFORMANCE CREATA." -ForegroundColor Green
Write-Host "Release: $ReleaseDir" -ForegroundColor Green
Write-Host "EXE:     $ReleaseExe" -ForegroundColor Green
Write-Host "SHA256:  $ReleaseHash" -ForegroundColor Yellow

Write-Host ""
Write-Host "IMPORTANTE:" -ForegroundColor Yellow
Write-Host "- Il Bridge attualmente in esecuzione NON è stato fermato." -ForegroundColor Yellow
Write-Host "- Il task 'BodyGate Bridge' NON è stato modificato." -ForegroundColor Yellow
Write-Host "- V3.9.2 resta intatta per rollback." -ForegroundColor Yellow
Write-Host "- NON avviare ancora manualmente V3.9.3." -ForegroundColor Yellow
