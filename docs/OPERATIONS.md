# Deploy e gestione del PC di reception

Questo documento nasce dalla diagnosi e risoluzione di un'interruzione reale
in produzione: il tornello fisico era attivo ma il server locale BodyGate
Admin era fermo da ~7 giorni a causa di un meccanismo di auto-update rotto
(`node_modules` corrotti, build di produzione mancante), con conseguente
mancata registrazione/autorizzazione silenziosa degli ingressi in palestra.

## Due istanze distinte, stesso codice

| | Produzione (Vercel) | Locale (PC reception) |
|---|---|---|
| URL | `bodygate-admin.vercel.app` | `http://localhost:3000` (LAN, usato anche dall'iPad in reception) |
| Deploy | automatico su push a `main` | **manuale**, via `scripts/deploy-bodygate.ps1` |
| Perché serve | accesso remoto/da qualsiasi dispositivo | comunica in LAN con l'hardware di controllo accessi (vedi `HARDWARE.md`) |

Le due istanze devono girare sullo **stesso commit** il più possibile.
`/api/health` espone `commit` / `commit_short` proprio per poterlo verificare
a colpo d'occhio confrontando le due URL.

## I tre script PowerShell (`scripts/`)

Sono deliberatamente separati per evitare che un aggiornamento rotto diventi
un'interruzione silenziosa (la causa originale del guasto diagnosticato):

- **`start-bodygate.ps1`** — loop di solo avvio/riavvio. Esegue `npm run start`
  sulla build già presente su disco e la riavvia se crasha. Non tocca mai
  git/npm ci/npm build. Gira come Scheduled Task **"BodyGate Admin"**,
  avviato al boot.
- **`deploy-bodygate.ps1`** — l'unico script che aggiorna il codice:
  `git fetch` → `git merge --ff-only origin/main` → (solo se c'è un nuovo
  commit) ferma il servizio → `npm ci` → `npm run build` → riavvia il
  servizio. Va lanciato manualmente quando si decide di aggiornare.
- **`bodygate-watchdog.ps1`** — processo indipendente che ogni 2 minuti
  controlla `http://127.0.0.1:3000/api/health` (server) e
  `http://127.0.0.1:5050/status` (bridge tornello) e manda un alert Telegram
  se uno dei due non risponde per 3 controlli di fila (~6 minuti). Gira come
  proprio Scheduled Task, così funziona anche se BodyGate Admin stesso è giù.

## Procedura di deploy manuale sul PC della palestra

```powershell
cd C:\bodygate-admin
.\scripts\deploy-bodygate.ps1
```

Lo script si occupa da solo di fermare il servizio prima di
`npm ci`/`npm run build` e di riavviarlo al termine (build riuscita o
fallita — vedi nota sotto).

Se serve farlo a mano passo-passo (es. per debug):

```powershell
Get-ScheduledTask -TaskName "BodyGate Admin" | Stop-ScheduledTask
Start-Sleep -Seconds 3
npm ci --no-audit --no-fund
npm run build
Get-ScheduledTask -TaskName "BodyGate Admin" | Start-ScheduledTask
```

Poi verificare:

```powershell
(Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing).Content
```

e confrontare `commit_short` con l'ultimo commit di `origin/main`
(`git log origin/main --oneline -1`).

### Perché bisogna fermare il servizio PRIMA della build

Su Windows, il processo Node.js del servizio in esecuzione tiene alcuni
file nativi aperti (es. `next-swc.win32-x64-msvc.node`). Se si lancia
`npm ci`/`npm run build` mentre il vecchio servizio gira ancora, Windows
rifiuta di sostituire quei file (`EPERM: operation not permitted, unlink`).
`deploy-bodygate.ps1` ferma quindi lo Scheduled Task **prima** di
`npm ci`/`npm run build` e lo riavvia sempre al termine, così il servizio
non resta mai fermo in caso di errore di build.

Prima di installare/compilare, lo script mette da parte `node_modules` e
`.next` correnti (rinominandoli in `node_modules.backup` / `.next.backup`):
`npm ci` cancella `node_modules` per conto suo e una build fallita può
lasciare `.next` a metà, quindi se l'aggiornamento fallisce lo script
ripristina automaticamente questo backup prima di riavviare — il servizio
riparte sempre sull'ultima build che funzionava davvero, mai su uno stato
a metà installazione/compilazione.

## Timeout attesi

Una build pulita (`npm run build`) su questo PC impiega tipicamente
**2.5–3 minuti** durante la fase "Creating an optimized production build...".
Non è un blocco: è normale. Va invece considerata bloccata se il processo
`node.exe` scompare da Task Manager senza che sia comparso
`✓ Compiled successfully` o un errore nel terminale.

## Telegram alerting (watchdog)

`bodygate-watchdog.ps1` legge `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` da
`.env.local`. Se non configurati, si limita a loggare l'alert localmente
senza inviarlo (nessun errore bloccante).

### Auto-riparazione del Bridge

Il Bridge non deve restare bloccato in modo silenzioso. Tre livelli:

1. **Bridge** (`Program.cs`): esce da solo se il thread HTTP muore o se il
   polling DNake non gira da più di 90s.
2. **Launcher** (`start-bodygate-bridge.ps1`): rilancia il Bridge quando il
   processo esce. All'avvio termina qualsiasi `BodyGateBridge.exe` ancora in
   esecuzione (orfano): `schtasks /End` ferma solo lo script, non l'exe, quindi
   prima un "Riavvia" dal launcher lasciava vivo il vecchio Bridge (log:
   "Bridge già attivo ... Attendo la sua chiusura"). Se mancano eseguibile o `BODYGATE_MACHINE_KEY` riprova ogni
   30s invece di terminare.
3. **Watchdog**: dopo 2 controlli falliti su `:5050/status` termina il processo
   `BodyGateBridge.exe` e, se il task `BodyGate Bridge` non è `Running`, lo
   riabilita/avvia. Ripete a ogni controllo finché il Bridge non risponde.


### Bridge fermo: "Error while copying content to a stream" (database DNake troncato)

Sintomo: il Bridge è vivo, `/status` risponde, ma non registra nessun accesso
(`lastProcessedEventKey` vuoto) e `bridge.log` è pieno di
`Error while copying content to a stream`. Un riavvio non serve.

Causa (confermata il 2026-10-09): il bridge scarica per intero
`http://192.168.1.22/data/unlock_sql.db` dal DNake. Quando il file supera circa
284 KB il `mini_httpd` del DNake lo consegna **troncato** (osservato: 290816
byte consegnati su `Content-Length: 311296`). Il client .NET rifiuta la risposta
incompleta; `curl` la accetta in silenzio (exit code 18), per questo a mano
sembra funzionare. Controllo:

```powershell
curl.exe -s -D - -o NUL -u admin:<password> http://192.168.1.22/data/unlock_sql.db
```

`Content-Length` va confrontato con i byte realmente scaricati
(`-w "%{size_download}"`, poi `$LASTEXITCODE`: 18 = troncato).

Rimedio: svuotare i registri/record di sblocco dal pannello web del DNake (mai il
reset di fabbrica: cancella badge e configurazione). Poi verificare che
`Content-Length` sia sceso e che il bridge scriva "Polling DNake ripreso".

Dal Bridge V3.9.4 in poi (sorgente: `bridge/bridge-v2/Program.cs`):

- riconosce il file troncato (`DnakeDbIncompleteException`) e lo scrive nel log
  con l'errore interno, una volta ogni 30s con il conteggio dei ripetuti;
- manda un alert ntfy "database del DNake quasi pieno" quando il file supera
  250 KB, prima del blocco, e "database del DNake troncato" se il blocco c'è già;
- riprova con backoff (max 5s) e riparte da solo appena il DNake torna a posto;
- `/status` espone `pollHealthy`, `consecutivePollFailures`, `lastPollError`,
  `dnakeDbExpectedBytes`, `dnakeDbReceivedBytes`; il watchdog allerta su
  `pollHealthy=false` (senza riavviare il bridge, che non servirebbe).

Gli alert ntfy leggono il topic da `BODYGATE_NTFY_TOPIC` in `.env.local`
(caricato da `start-bodygate-bridge.ps1`, come la machine key). Il topic non va
mai scritto nel sorgente. Senza la variabile il bridge parte con gli alert
disattivati e lo scrive nel log.

Dopo ogni modifica a `Program.cs`: ricompilare con
`build-bodygate-bridge-v3.9.4-alerts-staging.ps1` (con il bridge fermo, perché la
release precedente viene spostata) e copiare gli hash stampati in
`verify-bodygate-bridge-v3.9.4-alerts.ps1`.
