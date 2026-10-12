param(
    [string]$DnakeIp = "192.168.1.22",
    [string]$User = "admin",
    [string]$Password = "888888",
    # Senza -Execute fa solo login e controllo, non cancella niente.
    [switch]$Execute,
    # Salta la domanda di conferma (solo per prove automatiche).
    [switch]$Yes
)

# Svuota i registri di sblocco (unlock_logs) del DNake: lo stesso comando del
# pulsante "Elimina tutto" della pagina Logs del suo pannello web
# (POST webapi.cgi?api=unlock_logs, action=0, index=-1). Serve quando
# unlock_sql.db supera circa 284 KB: il mini_httpd del DNake lo consegna troncato
# e il bridge non legge piu' i badge. NON tocca utenti, badge, configurazione ne'
# i registri allarmi (alarm_logs): quelli sono un'altra API.
$ErrorActionPreference = "Stop"

$base = "http://$DnakeIp"
$apiUrl = "$base/cgi-bin/webapi.cgi?api=unlock_logs"
$dbUrl = "$base/data/unlock_sql.db"
$basicHeaders = @{
    Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${User}:$Password"))
}

function Get-Md5Hex([string]$Text) {
    $md5 = [Security.Cryptography.MD5]::Create()
    return ([BitConverter]::ToString($md5.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace("-", "")
}

function Get-DbInfo {
    try {
        $response = Invoke-WebRequest -Uri $dbUrl -Method Head -Headers $basicHeaders -UseBasicParsing -TimeoutSec 10
        $length = [string]($response.Headers["Content-Length"] | Select-Object -First 1)
        $modified = [string]($response.Headers["Last-Modified"] | Select-Object -First 1)
        return "Content-Length=$length  Last-Modified=$modified"
    }
    catch {
        return "non leggibile ($($_.Exception.Message))"
    }
}

function Read-ApiResult($Response) {
    try {
        $json = ([string]$Response.Content) | ConvertFrom-Json
        return [int]$json.result
    }
    catch {
        throw "Risposta del DNake non riconosciuta: $($Response.Content)"
    }
}

Write-Host "DNake: $base" -ForegroundColor Cyan
Write-Host "Database ora: $(Get-DbInfo)"

# Login: la password si manda come MD5 (come fa anche BodyGate in list-users).
$sessionId = $null

foreach ($hash in @((Get-Md5Hex $Password).ToLower(), (Get-Md5Hex $Password))) {
    try {
        $loginUrl = "$base/cgi-bin/webapi.cgi?api=login&username=$([uri]::EscapeDataString($User))&password=$hash"
        $login = Invoke-WebRequest -Uri $loginUrl -UseBasicParsing -TimeoutSec 10
        $cookies = ($login.Headers["Set-Cookie"] | ForEach-Object { $_ }) -join ";"

        if ($cookies -match "SessionID=([^;,\s]+)") {
            $sessionId = $Matches[1]
            break
        }
    }
    catch {
        # prova la variante successiva dell'hash
    }
}

if (-not $sessionId) {
    throw "Login al DNake non riuscito (utente $User). Non e' stato cancellato niente."
}

Write-Host "Login: OK" -ForegroundColor Green

$apiHeaders = @{ Cookie = "SessionID=$sessionId" }

if (-not $Execute) {
    Write-Host ""
    Write-Host "PROVA A SECCO: non e' stato cancellato niente." -ForegroundColor Yellow
    Write-Host "Per svuotare i registri di sblocco rilancia con -Execute." -ForegroundColor Yellow
    return
}

if (-not $Yes) {
    Write-Host ""
    Write-Host "Sto per CANCELLARE TUTTI i registri di sblocco del DNake (non utenti ne' badge)." -ForegroundColor Yellow
    $answer = Read-Host "Scrivi CANCELLA per confermare"

    if ($answer -ne "CANCELLA") {
        Write-Host "Annullato: non e' stato cancellato niente."
        return
    }
}

function Send-Action([string]$Body) {
    return Invoke-WebRequest -Uri $apiUrl -Method Post -Body $Body `
        -ContentType "application/x-www-form-urlencoded; charset=UTF-8" `
        -Headers $apiHeaders -UseBasicParsing -TimeoutSec 30
}

# action=0 (DEL), index=-1 (tutti). Risposta: 100 = occupato, riprova con
# action=3 (TABLE_WAIT); numero negativo = errore; altro = fatto.
$result = Read-ApiResult (Send-Action "action=0&index=-1")
Write-Host "Risposta del DNake alla cancellazione: $result"

$tries = 0

while ($result -eq 100 -and $tries -lt 60) {
    Start-Sleep -Milliseconds 500
    $tries++
    $result = Read-ApiResult (Send-Action "action=3")
    Write-Host "  attesa $tries : risposta $result"
}

if ($result -lt 0) {
    Write-Host "ERRORE: il DNake ha rifiutato la cancellazione (risposta $result)." -ForegroundColor Red
    return
}

if ($result -eq 100) {
    Write-Host "TIMEOUT: il DNake risulta ancora occupato dopo 30 secondi." -ForegroundColor Red
    return
}

Write-Host "Cancellazione accettata dal DNake." -ForegroundColor Green
Start-Sleep -Seconds 2
Write-Host "Database dopo: $(Get-DbInfo)"
Write-Host "Se Content-Length non e' sceso, il DNake aggiorna il file solo al prossimo evento: controlla di nuovo tra qualche minuto."
