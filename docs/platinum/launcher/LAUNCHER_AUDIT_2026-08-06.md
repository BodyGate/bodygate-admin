# Audit launcher BodyGate — 6 agosto 2026

## Evidenze

- `BodyGate Admin` e `BodyGate Bridge` sono task pianificati eseguiti come `SYSTEM`, con privilegi elevati e `MultipleInstances=IgnoreNew`.
- Lo script Admin mantiene `npm run start` in loop con riavvio dopo 5 secondi.
- Lo script Bridge mantiene la release ufficiale `V3.9.2-machine-auth` in loop con riavvio dopo 3 secondi e carica la machine key da `.env.local`.
- Il launcher desktop punta a `launcher/BodyGateLauncher/bin/Debug/net8.0-windows/BodyGate.exe`.
- Il launcher non risulta presente su `main` ed è quindi attualmente un componente locale non versionato.

## Difetti architetturali rilevati

1. Quando il Bridge è offline, il launcher avvia direttamente `BodyGateBridge.exe` invece di richiamare il task ufficiale `BodyGate Bridge`.
2. Il launcher legge direttamente `BODYGATE_MACHINE_KEY` da `.env.local`, duplicando responsabilità e gestione dei segreti già presenti nello script ufficiale del task Bridge.
3. Il pulsante Arresta termina il task Admin e i processi Bridge, ma non termina il task pianificato `BodyGate Bridge`; il supervisore può quindi riavviare il Bridge pochi secondi dopo.
4. Se un task è marcato Running ma il servizio è offline, `schtasks /Run` può non produrre un riavvio effettivo a causa di `MultipleInstances=IgnoreNew`.
5. Il launcher può essere aperto in più istanze.
6. L'artefatto operativo è collocato in una cartella `bin/Debug`, non in una release stabile e certificata.

## Correzione prevista

- Versionare il launcher.
- Impedire istanze multiple.
- Rimuovere lettura di `.env.local` e avvio diretto del Bridge.
- Gestire Admin e Bridge esclusivamente tramite i rispettivi task pianificati.
- Quando un servizio locale risulta offline, eseguire un riavvio controllato del task ufficiale (`/End`, breve attesa, `/Run`) e verificare gli health endpoint.
- Rendere il comando Arresta coerente per entrambi i task e protetto da conferma esplicita.
- Pubblicare una release versionata in cartella stabile esterna agli output di compilazione.
- Eseguire test parallelo senza sostituire il launcher attuale, poi 3 avvii launcher, crash recovery e 3 cold boot.
