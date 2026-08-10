$ErrorActionPreference = "Stop"

$expectedHash = "83BB1CFFE0480CB2F410E126427700821BD2D3F90775744B21D539932583A087"
$sourceRelease = "C:\BodyGate-Launcher-Platinum\releases\1.1.0-platinum-rc1"
$sourceExe = Join-Path $sourceRelease "BodyGate.exe"
$officialRelease = "C:\BodyGate-Launcher-Platinum\releases\1.1.0"
$officialExe = Join-Path $officialRelease "BodyGate.exe"

$desktop = [Environment]::GetFolderPath("Desktop")
$officialShortcut = Join-Path $desktop "BodyGate.lnk"
$testShortcut = Join-Path $desktop "BodyGate Platinum TEST.lnk"
$legacyShortcut = Join-Path $desktop "BodyGate Legacy (rollback).lnk"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = "C:\BodyGate-Backups\launcher-promotion-$timestamp"

Write-Host "`n=== PROMOZIONE BODYGATE LAUNCHER PLATINUM ===" -ForegroundColor Cyan

if (-not (Test-Path $sourceExe)) {
    throw "Launcher Platinum RC1 non trovato: $sourceExe"
}

$sourceHash = (Get-FileHash $sourceExe -Algorithm SHA256).Hash
if ($sourceHash -ne $expectedHash) {
    throw "Hash RC1 non valido. Atteso: $expectedHash - Rilevato: $sourceHash"
}

New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

$shell = New-Object -ComObject WScript.Shell

$legacyTarget = $null
$legacyArguments = ""
$legacyWorkingDirectory = ""

if (Test-Path $officialShortcut) {
    Copy-Item $officialShortcut (Join-Path $backupRoot "BodyGate-original.lnk") -Force

    $oldShortcut = $shell.CreateShortcut($officialShortcut)
    $legacyTarget = $oldShortcut.TargetPath
    $legacyArguments = $oldShortcut.Arguments
    $legacyWorkingDirectory = $oldShortcut.WorkingDirectory

    Write-Host "Collegamento originale salvato." -ForegroundColor Green
}

if (Test-Path $testShortcut) {
    Copy-Item $testShortcut (Join-Path $backupRoot "BodyGate-Platinum-TEST.lnk") -Force
}

if (Test-Path $officialRelease) {
    $existingExe = Join-Path $officialRelease "BodyGate.exe"

    if (Test-Path $existingExe) {
        $existingHash = (Get-FileHash $existingExe -Algorithm SHA256).Hash

        if ($existingHash -ne $expectedHash) {
            $archivedRelease = "$officialRelease.backup-$timestamp"
            Move-Item $officialRelease $archivedRelease
            Write-Host "Release 1.1.0 precedente archiviata: $archivedRelease" -ForegroundColor Yellow
        }
    }
}

if (-not (Test-Path $officialRelease)) {
    Copy-Item $sourceRelease $officialRelease -Recurse -Force
}

$officialHash = (Get-FileHash $officialExe -Algorithm SHA256).Hash
if ($officialHash -ne $expectedHash) {
    throw "Verifica hash release ufficiale fallita."
}

$releaseInfo = @"
BodyGate Launcher Platinum
Official version: 1.1.0
Certified: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Source RC: 1.1.0-platinum-rc1
Executable: $officialExe
SHA256: $officialHash
Cold boot tests: 3 PASS
Official scheduled tasks:
- BodyGate Admin
- BodyGate Bridge
Rollback shortcut:
- BodyGate Legacy (rollback)
"@

Set-Content `
    -Path (Join-Path $officialRelease "release-info.txt") `
    -Value $releaseInfo `
    -Encoding utf8

if ($legacyTarget -and (Test-Path $legacyTarget)) {
    $rollback = $shell.CreateShortcut($legacyShortcut)
    $rollback.TargetPath = $legacyTarget
    $rollback.Arguments = $legacyArguments
    $rollback.WorkingDirectory = $legacyWorkingDirectory
    $rollback.IconLocation = "$legacyTarget,0"
    $rollback.Description = "Launcher BodyGate precedente - usare solo per rollback"
    $rollback.Save()

    Write-Host "Creato collegamento di rollback." -ForegroundColor Green
}

$newShortcut = $shell.CreateShortcut($officialShortcut)
$newShortcut.TargetPath = $officialExe
$newShortcut.WorkingDirectory = $officialRelease
$newShortcut.IconLocation = "$officialExe,0"
$newShortcut.Description = "BodyGate Launcher Platinum 1.1.0"
$newShortcut.Save()

if (Test-Path $testShortcut) {
    Remove-Item $testShortcut -Force
}

$verifyShortcut = $shell.CreateShortcut($officialShortcut)

if ($verifyShortcut.TargetPath -ne $officialExe) {
    throw "Il collegamento ufficiale non punta alla release Platinum."
}

Write-Host "`n=== PROMOZIONE COMPLETATA ===" -ForegroundColor Green
Write-Host "Launcher ufficiale: $officialExe" -ForegroundColor Yellow
Write-Host "Collegamento desktop: $officialShortcut" -ForegroundColor Yellow
Write-Host "Rollback: $legacyShortcut" -ForegroundColor Yellow
Write-Host "Backup: $backupRoot" -ForegroundColor Yellow
Write-Host "SHA256: $officialHash" -ForegroundColor Yellow
Write-Host "`nNessun servizio è stato arrestato o modificato." -ForegroundColor Green
