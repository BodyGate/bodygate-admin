<#
.SYNOPSIS
  Fase 0: prove di sola lettura sul DNake nuovo, prima della messa in servizio.

.DESCRIPTION
  -Mode File    controlla come il DNake serve /data/unlock_sql.db (HEAD, dimensione,
                ETag, Last-Modified, Range) e se cambia nel tempo. Non modifica nulla.
  -Mode Listen  ascolta sulla porta indicata e stampa/salva ogni richiesta che il DNake
                invia (Evento HTTP): metodo, URL, intestazioni, corpo. Serve a capire
                se l'evento arriva e se contiene il numero del badge.
                Richiede PowerShell come amministratore e una regola firewall sulla porta.

  Il rapporto viene scritto in %USERPROFILE%\Desktop\dnake-fase0-<modo>.txt.
#>
param(
    [ValidateSet("File", "Listen")]
    [string]$Mode = "File",
    [string]$DnakeIp = "192.168.1.58",
    [int]$Port = 8089,
    [int]$Samples = 5,
    [int]$IntervalSeconds = 3
)

$ErrorActionPreference = "Stop"
$report = Join-Path ([Environment]::GetFolderPath("Desktop")) "dnake-fase0-$($Mode.ToLower()).txt"

function Write-Report([string]$Text) {
    Write-Host $Text
    Add-Content -Path $report -Value $Text -Encoding UTF8
}

function Invoke-Head([string]$Url) {
    $request = [System.Net.HttpWebRequest]::Create($Url)
    $request.Method = "HEAD"
    $request.Timeout = 5000

    try {
        $response = $request.GetResponse()
    }
    catch [System.Net.WebException] {
        if ($null -eq $_.Exception.Response) { throw }
        $response = $_.Exception.Response
    }

    try {
        return [pscustomobject]@{
            Status        = [int]$response.StatusCode
            Length        = $response.ContentLength
            ETag          = $response.Headers["ETag"]
            LastModified  = $response.Headers["Last-Modified"]
            AcceptRanges  = $response.Headers["Accept-Ranges"]
            Server        = $response.Headers["Server"]
        }
    }
    finally {
        $response.Close()
    }
}

Set-Content -Path $report -Value "BodyGate - fase 0 DNake ($Mode) - $(Get-Date -Format s)" -Encoding UTF8

if ($Mode -eq "File") {
    $url = "http://$DnakeIp/data/unlock_sql.db"
    Write-Report "URL: $url"
    Write-Report "Campioni: $Samples ogni $IntervalSeconds s"

    for ($i = 1; $i -le $Samples; $i++) {
        try {
            $watch = [System.Diagnostics.Stopwatch]::StartNew()
            $head = Invoke-Head $url
            $watch.Stop()
            Write-Report ("#{0} HTTP {1}  Length={2}  ETag={3}  Last-Modified={4}  Accept-Ranges={5}  Server={6}  ({7} ms)" -f `
                    $i, $head.Status, $head.Length, $head.ETag, $head.LastModified, $head.AcceptRanges, $head.Server, $watch.ElapsedMilliseconds)
        }
        catch {
            Write-Report ("#{0} ERRORE: {1}" -f $i, $_.Exception.Message)
        }

        if ($i -lt $Samples) { Start-Sleep -Seconds $IntervalSeconds }
    }

    Write-Report ""
    Write-Report "Lettura: Length costante e < 290816 = file piccolo; ETag/Last-Modified presenti = il controllo leggero (HEAD) e' possibile; cambiano dopo un passaggio badge = il controllo funziona."
    Write-Report "Ripeti con -Samples 20 passando un badge durante la prova."
}
else {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Serve PowerShell come amministratore per ascoltare sulla porta $Port."
    }

    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://+:$Port/")
    $listener.Start()
    Write-Report "In ascolto su http://<IP-PC>:$Port/ - Ctrl+C per fermare. Imposta questo URL in Avanzate > Evento HTTP del DNake e passa un badge."

    try {
        while ($listener.IsListening) {
            $context = $listener.GetContext()
            $req = $context.Request
            $body = ""
            if ($req.HasEntityBody) {
                $reader = New-Object System.IO.StreamReader($req.InputStream, $req.ContentEncoding)
                $body = $reader.ReadToEnd()
                $reader.Close()
            }

            Write-Report ("--- {0}  da {1}" -f (Get-Date -Format "HH:mm:ss.fff"), $req.RemoteEndPoint)
            Write-Report ("{0} {1}" -f $req.HttpMethod, $req.Url.PathAndQuery)
            foreach ($key in $req.Headers.AllKeys) {
                Write-Report ("  {0}: {1}" -f $key, $req.Headers[$key])
            }
            if ($body) { Write-Report "  CORPO: $body" }

            $bytes = [Text.Encoding]::UTF8.GetBytes("OK")
            $context.Response.StatusCode = 200
            $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            $context.Response.Close()
        }
    }
    finally {
        $listener.Stop()
    }
}

Write-Host "Rapporto salvato in: $report"
