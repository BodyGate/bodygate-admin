param(
    [string]$DnakeIp = "192.168.1.22",
    [string]$User = "admin",
    [string]$Password = "888888",
    # File con le variabili di BodyGate: se contiene DNAKE_USERNAME e
    # DNAKE_PASSWORD_MD5 (come usa BodyGate per collegarsi al DNake) vengono provate
    # per prime. Il valore non viene mai stampato.
    [string]$EnvFile = "",
    # Senza -Execute fa solo login e controllo, non cancella niente.
    [switch]$Execute,
    # Prove di sola lettura per capire perche' il DNake rifiuta un comando.
    [switch]$Diagnose,
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

$script:GoodCandidate = $null

function Get-Md5Hex([string]$Text) {
    $md5 = [Security.Cryptography.MD5]::Create()
    return ([BitConverter]::ToString($md5.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace("-", "")
}

function Read-EnvValue([string]$Path, [string]$Name) {
    if (-not $Path -or -not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()

        if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#")) {
            continue
        }

        $separator = $trimmed.IndexOf("=")

        if ($separator -le 0 -or $trimmed.Substring(0, $separator).Trim() -ne $Name) {
            continue
        }

        return $trimmed.Substring($separator + 1).Trim().Trim('"').Trim("'")
    }

    return $null
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

if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    $EnvFile = Join-Path (Split-Path -Parent $PSScriptRoot) ".env.local"
}

# Login: la password si manda come MD5 (come fa anche BodyGate in list-users).
# Ritorna il SessionID. La sessione del DNake e' breve: va chiamato subito prima
# di ogni comando, mai prima di una pausa (conferma, attese).
function Invoke-DnakeLogin([bool]$Verbose) {
    $candidates = @()
    $envUser = Read-EnvValue $EnvFile "DNAKE_USERNAME"
    $envHash = Read-EnvValue $EnvFile "DNAKE_PASSWORD_MD5"

    if ($envHash) {
        $candidates += @{ Label = "da .env.local (DNAKE_PASSWORD_MD5)"; User = $(if ($envUser) { $envUser } else { $User }); Hash = $envHash }
    }

    $candidates += @{ Label = "MD5 minuscolo della password indicata"; User = $User; Hash = (Get-Md5Hex $Password).ToLower() }
    $candidates += @{ Label = "MD5 maiuscolo della password indicata"; User = $User; Hash = (Get-Md5Hex $Password) }

    # Dopo il primo login verificato si usa solo quella combinazione.
    if ($script:GoodCandidate) {
        $candidates = @($script:GoodCandidate)
    }

    foreach ($candidate in $candidates) {
        try {
            $loginUrl = "$base/cgi-bin/webapi.cgi?api=login&username=$([uri]::EscapeDataString($candidate.User))&password=$($candidate.Hash)"
            $login = Invoke-WebRequest -Uri $loginUrl -UseBasicParsing -TimeoutSec 10 `
                -Headers @{ Accept = "application/json, text/plain, */*"; pragma = "no-cache" }
            $cookies = ($login.Headers["Set-Cookie"] | ForEach-Object { $_ }) -join ";"
            $hasCookie = $cookies -match "SessionID=([^;,\s]+)"
            $sid = $null

            if ($hasCookie) {
                $sid = $Matches[1]
            }

            $text = ([string]$login.Content).Trim()

            if ($text.Length -gt 160) { $text = $text.Substring(0, 160) }

            if ($Verbose) {
                Write-Host ("  login [{0}]: HTTP {1}, cookie SessionID: {2}, risposta: {3}" -f $candidate.Label, [int]$login.StatusCode, $(if ($hasCookie) { "si" } else { "no" }), $text)
            }

            if (-not $sid) {
                continue
            }

            if ($script:GoodCandidate) {
                return $sid
            }

            # Il DNake risponde 200 con un cookie anche a credenziali sbagliate:
            # la sessione va verificata con una lettura (solo codice HTTP).
            $valid = $false

            try {
                $check = Invoke-WebRequest -Uri "$base/cgi-bin/webapi.cgi?api=user" `
                    -Headers @{ Cookie = "SessionID=$sid"; Accept = "application/json, text/plain, */*"; pragma = "no-cache" } `
                    -UseBasicParsing -TimeoutSec 15
                $valid = ([int]$check.StatusCode -eq 200)
            }
            catch {
                $valid = $false
            }

            if ($Verbose) {
                Write-Host ("    sessione valida: {0}" -f $(if ($valid) { "si" } else { "NO (credenziali non accettate)" }))
            }

            if ($valid) {
                $script:GoodCandidate = $candidate
                return $sid
            }
        }
        catch {
            if ($Verbose) {
                Write-Host ("  login [{0}]: errore {1}" -f $candidate.Label, $_.Exception.Message)
            }
        }
    }

    return $null
}

function Get-ErrorBody($ErrorRecord) {
    try {
        $stream = $ErrorRecord.Exception.Response.GetResponseStream()
        $reader = New-Object IO.StreamReader($stream)
        $text = $reader.ReadToEnd()

        if ($text.Length -gt 300) { $text = $text.Substring(0, 300) }

        return $text
    }
    catch {
        return ""
    }
}

# Un comando al DNake con login fresco. Ritorna la risposta numerica "result".
# Su 401 ripete il login e riprova una volta.
function Send-Action([string]$Body, [bool]$FreshLogin) {
    for ($attempt = 1; $attempt -le 2; $attempt++) {
        $sid = Invoke-DnakeLogin $false

        if (-not $sid) {
            throw "Login al DNake non riuscito durante il comando."
        }

        try {
            $response = Invoke-WebRequest -Uri $apiUrl -Method Post -Body $Body `
                -ContentType "application/x-www-form-urlencoded; charset=UTF-8" `
                -Headers @{ Cookie = "SessionID=$sid"; Accept = "application/json, text/plain, */*"; pragma = "no-cache" } `
                -UseBasicParsing -TimeoutSec 30

            return Read-ApiResult $response
        }
        catch {
            $status = ""

            try { $status = [int]$_.Exception.Response.StatusCode } catch { }

            if ($status -eq 401 -and $attempt -eq 1) {
                Write-Host "  401 dal DNake: nuovo login e secondo tentativo..." -ForegroundColor Yellow
                continue
            }

            $detail = Get-ErrorBody $_
            throw "Il DNake ha rifiutato il comando (HTTP $status). $detail"
        }
    }
}

Write-Host "DNake: $base" -ForegroundColor Cyan
Write-Host "Database ora: $(Get-DbInfo)"

if ($Diagnose) {
    $sid = Invoke-DnakeLogin $true

    if (-not $sid) {
        throw "Login al DNake non riuscito."
    }

    $probeHeaders = @{ Cookie = "SessionID=$sid"; Accept = "application/json, text/plain, */*"; pragma = "no-cache" }

    function Show-Probe([string]$Label, [scriptblock]$Call, [int]$MaxChars) {
        try {
            $r = & $Call
            $t = ([string]$r.Content).Trim()

            if ($t.Length -gt $MaxChars) { $t = $t.Substring(0, $MaxChars) }

            Write-Host ("  {0}: HTTP {1}  {2}" -f $Label, [int]$r.StatusCode, $t)
        }
        catch {
            $st = ""

            try { $st = [int]$_.Exception.Response.StatusCode } catch { }

            Write-Host ("  {0}: errore HTTP {1}" -f $Label, $st)
        }
    }

    Write-Host "Prove di sola lettura (nessuna cancellazione):" -ForegroundColor Cyan
    # api=user: solo il codice HTTP, la risposta contiene i nomi degli utenti.
    Show-Probe "GET api=user (come fa BodyGate)" { Invoke-WebRequest -Uri "$base/cgi-bin/webapi.cgi?api=user" -Headers $probeHeaders -UseBasicParsing -TimeoutSec 15 } 0
    Show-Probe "GET api=unlock_logs" { Invoke-WebRequest -Uri $apiUrl -Headers $probeHeaders -UseBasicParsing -TimeoutSec 15 } 80
    Show-Probe "POST action=3 (urlencoded)" { Invoke-WebRequest -Uri $apiUrl -Method Post -Body "action=3" -ContentType "application/x-www-form-urlencoded; charset=UTF-8" -Headers $probeHeaders -UseBasicParsing -TimeoutSec 15 } 80

    $boundary = [guid]::NewGuid().ToString()
    $multipart = "--$boundary`r`nContent-Disposition: form-data; name=`"action`"`r`n`r`n3`r`n--$boundary--`r`n"
    Show-Probe "POST action=3 (multipart)" { Invoke-WebRequest -Uri $apiUrl -Method Post -Body $multipart -ContentType "multipart/form-data; boundary=$boundary" -Headers $probeHeaders -UseBasicParsing -TimeoutSec 15 } 80
    return
}

if (-not $Execute) {
    $sid = Invoke-DnakeLogin $true

    if (-not $sid) {
        throw "Login al DNake non riuscito. Non e' stato cancellato niente."
    }

    Write-Host "Login: OK" -ForegroundColor Green
    Write-Host ""
    Write-Host "PROVA A SECCO: non e' stato cancellato niente." -ForegroundColor Yellow
    Write-Host "Per svuotare i registri di sblocco rilancia con -Execute." -ForegroundColor Yellow
    return
}

# La conferma si chiede PRIMA del login: la sessione del DNake scade presto.
if (-not $Yes) {
    Write-Host ""
    Write-Host "Sto per CANCELLARE TUTTI i registri di sblocco del DNake (non utenti ne' badge)." -ForegroundColor Yellow
    $answer = Read-Host "Scrivi CANCELLA per confermare"

    if ($answer -cne "CANCELLA") {
        Write-Host "Annullato: non e' stato cancellato niente."
        return
    }
}

# action=0 (DEL), index=-1 (tutti). Risposta: 100 = occupato, riprova con
# action=3 (TABLE_WAIT); numero negativo = errore; altro = fatto.
$result = Send-Action "action=0&index=-1" $true
Write-Host "Risposta del DNake alla cancellazione: $result"

$tries = 0

while ($result -eq 100 -and $tries -lt 60) {
    Start-Sleep -Milliseconds 500
    $tries++
    $result = Send-Action "action=3" $true
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
