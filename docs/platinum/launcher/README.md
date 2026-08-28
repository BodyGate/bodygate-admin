# BodyGate Launcher

Questa cartella conterrà la documentazione e il codice versionato del launcher operativo BodyGate.

## Stato rilevato il 6 agosto 2026

Il launcher attualmente utilizzato sulla postazione Windows esiste solo localmente in `C:\bodygate-admin\launcher\BodyGateLauncher` e il collegamento desktop punta a una build `Debug`.

Il launcher deve diventare un artefatto versionato, compilato in modalità Release, pubblicato in una cartella stabile esterna agli output temporanei `bin/Debug` e certificato tramite i test descritti nell'issue #125.

## Regole architetturali

- Il launcher non deve avviare direttamente il Bridge.
- Il launcher non deve leggere o gestire segreti da `.env.local`.
- I servizi ufficiali devono essere gestiti esclusivamente dai task pianificati `BodyGate Admin` e `BodyGate Bridge`.
- In caso di servizio offline, il launcher deve riavviare il task ufficiale e poi verificare gli endpoint di salute.
- Il launcher deve impedire l'apertura di più istanze della propria interfaccia.
- L'artefatto operativo deve essere pubblicato in una cartella di release stabile e separata dal repository di sviluppo.

## Aggiornamento automatico del task "BodyGate Admin"

`scripts/start-bodygate.ps1` esegue `git fetch`/`git merge --ff-only` da `origin/main`
a ogni (ri)avvio del task, prima di ricompilare ed eseguire l'app. Il task gira come
`SYSTEM`, che ha un profilo Windows proprio e separato da quello dell'utente che ha
fatto l'accesso interattivo: le credenziali Git salvate da quest'ultimo (Git Credential
Manager, cifrate DPAPI per quell'utente) non sono quindi mai visibili a `SYSTEM`. Senza
un token esplicito, il fetch autenticato non può funzionare su un repository privato.

Per abilitare l'aggiornamento automatico su una postazione:

1. Creare un GitHub Personal Access Token (fine-grained) con accesso in sola lettura
   ai contenuti del repository `BodyGate/bodygate-admin`.
2. Aggiungere la riga seguente a `C:\bodygate-admin\.env.local` (file già usato per
   `BODYGATE_MACHINE_KEY`, non versionato):

   ```
   BODYGATE_GIT_UPDATE_TOKEN=<token>
   ```

3. Riavviare il task `BodyGate Admin`.

Il token viene letto a ogni ciclo di aggiornamento e usato solo per la durata del
`git fetch` (via header HTTP locale, mai loggato né passato come argomento di
processo); se mancante, lo script registra un AVVISO nel log e prosegue senza
autenticazione (il fetch fallirà su repository privati, ma l'app riparte comunque
con la build già presente sul disco). Se il fetch fallisce per qualunque motivo
(token assente, scaduto, revocato, o problemi di rete), l'errore viene ora scritto
per intero nel log come riga `ERRORE` — prima veniva scartato silenziosamente e lo
script proseguiva come se non ci fosse alcun aggiornamento disponibile.
