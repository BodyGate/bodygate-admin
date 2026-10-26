# DNake: lettura badge, messa in servizio e manutenzione

Stato al 26 ottobre 2026. Sostituisce le note di progetto precedenti (che descrivevano un firmware
e un formato di registro non piu' in uso).

## 1. Come funziona oggi

```
badge/QR -> DNake AC02C (192.168.1.58) -> /data/unlock_sql.db
                                              |  letto ogni 100 ms dal bridge
                                              v
                 Bridge V3.9.6-TXT (C:\BodyGateBridge_Releases\V3.9.6-txt)
                                              |  POST /api/access/check
                                              v
                      BodyGate (regole: abbonamento, quota, certificato)
                                              |  se consentito
                                              v
                  Bridge -> controller KT02.3 (192.168.1.251) -> tornello
```

- Firmware del DNake: **`170AC.2.0.16_GA_20260306`** (aggiornato dal cloud il 23/10/2026, ~15:20).
  Con questo firmware il registro e' di nuovo il database SQLite `unlock_sql.db` e i QR si generano in locale.
  Il firmware di fabbrica `170AC.Cloud.V1.8.10` scriveva invece `unlock.txt` e non generava QR.
- Il bridge legge il formato indicato da `BODYGATE_DNAKE_LOG_FORMAT` in `.env.local`
  (`sqlite` oggi; `txt` per `unlock.txt`).
- Il bridge parte dal task pianificato **`BodyGate Bridge`** tramite `scripts/start-bodygate-bridge.ps1`,
  che carica le variabili da `.env.local`. Il riavvio si fa SOLO cosi':

  ```
  schtasks /End /TN "BodyGate Bridge"
  Get-CimInstance Win32_Process -Filter "Name='BodyGateBridge.exe'" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  schtasks /Run /TN "BodyGate Bridge"
  Invoke-RestMethod http://127.0.0.1:5050/status
  ```

  Mai riavviare a mano con variabili temporanee in una finestra PowerShell: al primo riavvio del PC si
  perdono (cosi' si e' rotto il tornello il 26/10/2026).

## 2. Variabili in `.env.local` (non versionato)

| Variabile | Valore | Note |
|---|---|---|
| `BODYGATE_MACHINE_KEY` | segreto | obbligatoria |
| `BODYGATE_DNAKE_LOG_FORMAT` | `sqlite` | `txt` solo per il firmware Cloud V1.8.10 |
| `BODYGATE_DNAKE_IP` | `192.168.1.58` | default del bridge |
| `DNAKE_IP`, `DNAKE_USERNAME`, `DNAKE_PASSWORD_MD5` | pannello | usate dal gestionale per i QR |
| `BODYGATE_NTFY_TOPIC` | opzionale | avvisi sul telefono |
| `BODYGATE_PUSH_*` | opzionali | eventi push del bridge (modo `discover`: solo registrazione) |

## 3. Il pericolo: il file del DNake supera ~284 KB

Il server web del DNake (`mini_httpd`) consegna `unlock_sql.db` **troncato a 290816 byte**; SQLite lo giudica
corrotto e il bridge smette di leggere i badge (e' successo l'8 ottobre 2026: file da 318 KB).

- Il registro ha circa 88 byte a riga: il limite arriva a circa **3300 righe**.
- Il pannello ha capienza 100000 righe: la sovrascrittura circolare ("Delete Log When Storage Full: 300")
  scatterebbe molto dopo il blocco. **Non basta.**
- **Impostazione adottata (26/10/2026):** Access > Access Control > Log Storage >
  `Delete Old Logs Periodically`, durata **10080 minuti (7 giorni)**. A 40-60 passaggi al giorno restano
  ~300-420 righe (30-40 KB).
- **Da verificare alla prima potatura (circa 30/10/2026):** il bridge deve continuare a leggere. Se il
  DNake eliminasse l'intera tabella e ripartisse da capo, il bridge potrebbe ignorare i nuovi eventi.
  Controllo: passaggio di prova e `Invoke-RestMethod http://127.0.0.1:5050/status` (lastBadge, pollHealthy).
- Controllo periodico: `(Invoke-WebRequest http://192.168.1.58/data/unlock_sql.db -Method Head -UseBasicParsing).Headers["Content-Length"]`
  (oggi ~8192; allarme se sopra 200000).

## 4. Salute reale del bridge

"ONLINE" nel launcher o in dashboard significa solo che il bridge risponde. La salute vera e':

```
Invoke-RestMethod http://127.0.0.1:5050/status | Select-Object version,mode,dnakeDbUrl,pollHealthy,consecutivePollFailures,lastPollError,lastBadge
```

Atteso: `V3.9.6-TXT`, `dnake-sql-polling`, `unlock_sql.db`, `pollHealthy: True`, 0 errori.
Il log del bridge e' in `C:\BodyGateBridge_Releases\V3.9.6-txt\logs\bridge.log` (non in `logs\` del repo).

## 5. Esiti nel log e cosa significano

| Log | Significato |
|---|---|
| `ESITO: CONSENTITO` + `TORNELLO APERTO` | tutto regolare |
| `NEGATO` + motivo | decisione di BodyGate (abbonamento, quota, certificato, blocco): non e' un guasto |
| `Cliente non identificato` | etichetta del bridge: guarda il `Motivo`; per i QR il codice e' l'ID utente del DNake |
| `Download registro DNake fallito: HTTP 404` | formato sbagliato (`txt` col firmware 2.0.16) o DNake irraggiungibile |
| `database disk image is malformed` | file troncato: vedi sezione 3 |

## 5b. Tempi di apertura (V3.9.7-TIMING)

Dal 26/10/2026 la lettura "rilevato -> Cliente" nel log era di circa 2 s, mentre BodyGate risponde in
~0,7 s (`Server-Timing: total;dur=660-716`) e le letture su Supabase costano ~80 ms l'una (misure sul PC).
La V3.9.7 non cambia le regole di accesso: scrive dopo ogni passaggio

```
Tempi: coda=0 ms, BodyGate=702 ms, tornello=1 ms, totale dal rilevamento=703 ms
```

e li espone in `/status` (`lastQueueMs`, `lastCheckMs`, `lastOpenMs`, `lastTotalMs`, `httpNoProxy`).
Se `BodyGate` e' molto sopra ~700 ms, il tempo si perde nella chiamata del bridge (ipotesi principale: rilevamento
automatico del proxy di Windows); in quel caso si prova `BODYGATE_BRIDGE_NO_PROXY=1` in `.env.local` e si riavvia
il task, confrontando i `Tempi` prima e dopo.

Installazione (a palestra chiusa, il tornello resta fermo ~15 s; Amministratore):

```
cd C:\bodygate-admin
git pull --ff-only origin main
.\scripts\build-bodygate-bridge-v3.9.7-timing.ps1
.\scripts\switch-bodygate-bridge-v3.9.7-timing.ps1
```

Lo switch controlla gli hash, installa, verifica `/status` (versione, modo di lettura, `pollHealthy`) e in caso di
errore torna da solo alla V3.9.6.

## 6. Punti aperti

- Primo controllo della potatura dei log (30/10/2026, promemoria impostato).
- Misura dei ~2 s tra rilevazione e risposta di BodyGate (obiettivo: sotto 1 s dal badge al tornello).
- Password predefinite del DNake (`admin`/`123456`) da cambiare; IP `192.168.1.58` da riservare sul router
  (DHCP attivo) per il MAC `BC:F8:11:59:00:45`.
- `/data/` del DNake espone senza password `users.xml` e simili sulla rete interna.
- Storico accessi mancante in BodyGate dal 9 al 21 ottobre 2026 (giorni del blocco).
- Abbonamento di prova di Giuseppe Pisacane (id `c8a927e9-27fc-4cea-9a66-bf6cc32d5180`, fino al 30/11/2026): eliminabile.

## 7. Cronologia

- 8 ott 2026: blocco del bridge (file `unlock_sql.db` troncato a 284 KB sul vecchio DNake).
- 22 ott: sostituzione del DNake (192.168.1.58, firmware Cloud V1.8.10, registro `unlock.txt`); bridge V3.9.6-TXT.
- 23 ott ~15:20: aggiornamento firmware a 2.0.16 dal cloud (QR di nuovo disponibile, registro `unlock_sql.db`).
- 26 ott: tornello fermo per riavvio con lo script di avvio non versionato (V3.9.3, vecchio DNake); ripristino,
  PR 328 e 330 unite a `main`, PC riallineato, potatura log impostata a 7 giorni.
