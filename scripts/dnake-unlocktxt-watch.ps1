<#
.SYNOPSIS
  Fase 0 (sola lettura): osserva /data/unlock.txt del DNake nuovo mentre si passano i badge.

.DESCRIPTION
  Controlla il file con HEAD ogni -IntervalMs e lo scarica solo quando cambiano
  Last-Modified o Content-Length (piu' un controllo di sicurezza ogni -SafetyGetSeconds).
  Per ogni riga nuova stampa: ora di rilevamento, ora scritta dal DNake, ritardo
  (indicativo: dipende dagli orologi di PC e DNake), tipo e numero.

  Formato riga (piu' recente in cima):  ,,-1,<tipo>,<numero>,-1,-1,<AAAA-MM-GG hh:mm:ss>,-1

  Serve a rispondere: la riga compare subito? i badge non registrati nel DNake compaiono?
  lo stesso numero e' sempre uguale? due passaggi ravvicinati compaiono entrambi?
  Non modifica nulla. Rapporto: Desktop\dnake-fase0-watch.txt
#>
param(
    [string]$DnakeIp = "192.168.1.58",
    [int]$IntervalMs = 250,
    [double]$Minutes = 5,
    [int]$SafetyGetSeconds = 5,
    [switch]$ShowFullNumbers
)

$ErrorActionPreference = "Stop"
$url = "http://$DnakeIp/data/unlock.txt"
$report = Join-Path ([Environment]::GetFolderPath("Desktop")) "dnake-fase0-watch.txt"

function Write-Report([string]$Text) {
    Write-Host $Text
    Add-Content -Path $report -Value $Text -Encoding UTF8
}

function Invoke-Http([string]$Method) {
    $request = [System.Net.HttpWebRequest]::Create($url)
    $request.Method = $Method
    $request.Timeout = 4000
    $request.ReadWriteTimeout = 4000
    $response = $request.GetResponse()

    try {
        $body = $null
        if ($Method -eq "GET") {
            $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
            $body = $reader.ReadToEnd()
            $reader.Close()
        }

        return [pscustomobject]@{
            Length       = $response.ContentLength
            LastModified = $response.Headers["Last-Modified"]
            Body         = $body
        }
    }
    finally {
        $response.Close()
    }
}

# Una riga valida ha 9 campi e una data plausibile; le righe con orologio non
# impostato (1970) o malformate si ignorano.
function ConvertFrom-UnlockLine([string]$Line) {
    $fields = $Line.Trim().Split(",")
    if ($fields.Count -lt 9) { return $null }

    $time = [datetime]::MinValue
    if (-not [datetime]::TryParseExact($fields[7], "yyyy-MM-dd HH:mm:ss", $null, [System.Globalization.DateTimeStyles]::None, [ref]$time)) {
        return $null
    }
    if ($time.Year -lt 2020) { return $null }

    return [pscustomobject]@{
        Type   = $fields[3]
        Number = $fields[4]
        Time   = $time
        Key    = "$($fields[7])|$($fields[3])|$($fields[4])"
    }
}

function ConvertFrom-UnlockText([string]$Text) {
    $rows = @()
    foreach ($line in ($Text -split "`n")) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $row = ConvertFrom-UnlockLine $line
        if ($null -ne $row) { $rows += $row }
    }
    return , $rows
}

# Righe nuove = quelle in cima prima di ritrovare la testa del file precedente
# (3 righe consecutive). Due passaggi dello stesso badge nello stesso secondo
# restano distinguibili perche' contano come righe separate.
function Get-NewRows($Previous, $Current) {
    if ($Previous.Count -eq 0) { return @() }

    $headSize = [Math]::Min(3, $Previous.Count)

    for ($offset = 0; $offset -le $Current.Count - $headSize; $offset++) {
        $match = $true
        for ($i = 0; $i -lt $headSize; $i++) {
            if ($Current[$offset + $i].Key -ne $Previous[$i].Key) { $match = $false; break }
        }
        if ($match) {
            if ($offset -eq 0) { return @() }
            return $Current[0..($offset - 1)]
        }
    }

    # Testa non ritrovata: il registro e' stato svuotato o e' ruotato di molto.
    return $Current
}

function Format-Number([string]$Number) {
    if ($ShowFullNumbers -or $Number.Length -le 4) { return $Number }
    return $Number.Substring(0, 2) + ("*" * ($Number.Length - 4)) + $Number.Substring($Number.Length - 2)
}

Set-Content -Path $report -Value "BodyGate - fase 0 DNake: osservazione $url - $(Get-Date -Format s)" -Encoding UTF8
Write-Report "Controllo ogni $IntervalMs ms per $Minutes minuti. Passa i badge e annota l'ora di ciascuno (e se e' registrato nel DNake)."

$first = Invoke-Http "GET"
$previous = ConvertFrom-UnlockText $first.Body
$lastLength = $first.Length
$lastModified = $first.LastModified
$lastGet = Get-Date
$checks = 0
$gets = 1
$errors = 0
$found = 0

Write-Report ("Partenza: {0} righe valide, Length={1}, Last-Modified={2}" -f $previous.Count, $lastLength, $lastModified)

$end = (Get-Date).AddMinutes($Minutes)

while ((Get-Date) -lt $end) {
    try {
        $head = Invoke-Http "HEAD"
        $checks++
        $changed = ($head.Length -ne $lastLength) -or ($head.LastModified -ne $lastModified)
        $safetyDue = ((Get-Date) - $lastGet).TotalSeconds -ge $SafetyGetSeconds

        if ($changed -or $safetyDue) {
            $detected = Get-Date
            $full = Invoke-Http "GET"
            $gets++
            $lastGet = Get-Date
            $current = ConvertFrom-UnlockText $full.Body
            $new = Get-NewRows $previous $current

            foreach ($row in $new) {
                $found++
                $delay = ($detected - $row.Time).TotalSeconds
                Write-Report ("{0}  NUOVA RIGA: scritta {1}  ritardo ~{2:N1} s  tipo={3}  numero={4}{5}" -f `
                        $detected.ToString("HH:mm:ss.fff"), $row.Time.ToString("HH:mm:ss"), $delay, $row.Type, (Format-Number $row.Number),
                    $(if ($changed) { "" } else { "  (trovata dal controllo di sicurezza: HEAD non ha visto il cambio)" }))
            }

            $previous = $current
            $lastLength = $full.Length
            $lastModified = $full.LastModified
        }
    }
    catch {
        $errors++
        Write-Report ("{0}  ERRORE: {1}" -f (Get-Date).ToString("HH:mm:ss.fff"), $_.Exception.Message)
    }

    Start-Sleep -Milliseconds $IntervalMs
}

Write-Report ""
Write-Report ("Fine. Controlli HEAD={0}  scaricamenti={1}  righe nuove={2}  errori={3}" -f $checks, $gets, $found, $errors)
Write-Host "Rapporto salvato in: $report"
