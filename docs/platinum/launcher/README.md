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
