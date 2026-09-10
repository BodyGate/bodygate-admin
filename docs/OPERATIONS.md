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
non resta mai fermo in caso di errore di build — riparte con qualunque
build sia presente su disco (che in caso di build fallita a metà potrebbe
essere parziale: lo script lo segnala esplicitamente nel log).

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
