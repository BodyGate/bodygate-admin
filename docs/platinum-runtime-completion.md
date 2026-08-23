# BodyGate Platinum Runtime Completion

## Esito e perimetro

HEAD iniziale verificato: `3c7cbcfd7a83436df65196bcb44afb01a586c218`. Le 26 route operative dei gate Commerciale, Accessi, Direzione, Training e Sistema sono censite nel route manifest e composte attraverso la facade pubblica Platinum. Dashboard, Reception e Clienti costituiscono la baseline già completata e non sono stati ricostruiti.

- **Migrazione completata:** `/subscriptions`, `/subscriptions/plans`, `/settings/pricing`, `/payments`, `/accounting`, `/access-control`, `/access-control/credentials-audit`, `/access-control/debug`, `/access-logs`, `/badges`, `/notifications`, `/analytics`, `/training`, `/training/clients`, `/training/library`, `/training/library/[id]`, `/training/programs`, `/training/programs/[id]`, `/training/sessions`, `/settings`, `/settings/permissions`, `/system`, `/system/audit`, `/system/staff`, `/login`, `/access-denied`.
- **Funzione preservata:** query, RPC, endpoint, metodi HTTP, payload, permessi, ruoli, redirect, deep link, polling, subscription realtime preesistenti, export, stampa, salvataggi, side effect e conferme distruttive.
- **Funzione rinviata:** piano annuale in tre rate, relative scadenze, enforcement e blocco accesso; nessuna implementazione backend è inclusa.
- **Route protette:** `/access`, `/access/check`, `/test-gate`, `/mobile/[token]`, `/pass/[token]`, `/staff-mobile/[token]`, `/v2/customers`, route di stampa, API e Lab Platinum. `/settings/modules` resta un placeholder non navigabile.
- **Debito legacy residuo:** i client operativi mantengono deliberatamente la propria struttura interna per ridurre il rischio sui contratti; la facade governa la composizione pubblica.

## Parità funzionale e rollback

Gli audit dettagliati per gate sono in `docs/platinum-runtime-gates/`. La variazione runtime è presentazionale: non modifica autenticazione, cookie, middleware, database, migration, schema, RPC, Supabase, Bridge, DNake, KT02.3, controller, protocolli badge/QR/Mobile Pass, tornello, presenze, numerazione ricevute o decisione di accesso. Il rollback di ciascun gate è il revert del relativo commit, senza migrazioni dati.

La UI conserva loading, empty, error, dati parziali e retry dei client esistenti. Il valore zero rimane un valore reale; un dato mancante è mostrato come dato non disponibile, senza KPI inventati.

## Prove runtime

- **Prova runtime disponibile:** governance route/navigation/deprecation, registry schermate, runtime Dashboard/Reception/Clienti, inventario completion, typecheck, lint circoscritto, writing check e build locale.
- **Prova runtime completata:** la Visual QA autenticata e la matrice multi-viewport sono certificate nella sezione conclusiva seguente.
- **Audit rete:** nessun endpoint, metodo o payload è stato introdotto dalla migrazione presentazionale. Le suite statiche verificano i contratti critici riconoscibili; la cattura di rete autenticata resta subordinata all'ambiente runtime.

## Matrice QA visiva richiesta

Per ogni route: `390×844`, `820×1180`, `821×1180`, `1440×900`; per una route strategica per gate anche `375×812`, `768×1024`, `1024×768`, `1920×1080`. Due cicli completi devono verificare URL, navigazione, overflow, focus, Escape, tooltip, touch target, console, pageerror, rete e scritture. La certificazione autenticata e gli screenshot realmente osservati sono registrati nella sezione seguente.

## Certificazione Visual QA autenticata — completamento

### Metodo e matrice

La QA del 19 agosto 2026 ha usato `createSessionToken("qa-user", "admin")` con `BODYGATE_SESSION_SECRET` temporaneo, cookie `bodygate_session`, middleware ordinario e un servizio Supabase-compatible effimero in `/tmp`. Le sole fixture erano identificativi e record sanitizzati (`qa-user`, `qa-customer`, `qa-plan`, `qa-program`, `qa-exercise`); il servizio rispondeva alle letture e rifiutava ogni metodo di scrittura. Nessun bypass, dato reale o fixture repository è stato impiegato.

Sono state osservate **248 combinazioni route/viewport** in due cicli integrali: 26 route × 4 viewport base × 2 cicli = 208, più 5 route strategiche × 4 viewport aggiuntivi × 2 cicli = 40. Tutte le route sono state verificate a `390×844`, `820×1180`, `821×1180`, `1440×900`; `/subscriptions`, `/access-control`, `/analytics`, `/training` e `/system` anche a `375×812`, `768×1024`, `1024×768`, `1920×1080`.

| Gate | Route verificate | Combinazioni, due cicli | Esito finale |
| --- | --- | ---: | --- |
| Commerciale | `/subscriptions`, `/subscriptions/plans`, `/settings/pricing`, `/payments`, `/accounting` | 48 | URL corretti, zero overflow/off-viewport |
| Accessi | `/access-control`, `/access-control/credentials-audit`, `/access-control/debug`, `/access-logs`, `/badges` | 48 | URL corretti, zero overflow/off-viewport, nessun comando operativo |
| Direzione | `/notifications`, `/analytics` | 24 | URL corretti, zero overflow/off-viewport |
| Training | `/training`, `/training/clients`, `/training/library`, `/training/library/qa-exercise`, `/training/programs`, `/training/programs/qa-program`, `/training/sessions` | 64 | ID dinamici sanitizzati, zero overflow/off-viewport |
| Sistema | `/settings`, `/settings/permissions`, `/system`, `/system/audit`, `/system/staff`, `/login`, `/access-denied` | 64 | autenticazione ordinaria, zero overflow/off-viewport |

### Stati, interazioni e accessibilità

Sono stati osservati loading, empty e dati parziali sanitizzati; ricerca, filtri, tabelle e form presenti sono rimasti navigabili. La soglia `820/821` ha mostrato rispettivamente bottom navigation e sidebar senza doppia navigazione. Il primo `Tab` ha prodotto un target focalizzabile in tutte le pagine operative; `Escape` non ha lasciato overlay aperti. Dialog, drawer, retry e azioni distruttive sono stati controllati soltanto dove presenti e senza confermare alcuna mutazione. Gli hub statici senza fetch non hanno stati loading/error/retry applicabili; le pagine prive di dialog, drawer o tooltip sono registrate come non applicabili, non come test superati artificialmente.

### Finding e correzioni osservate

Il ciclo 1 ha rilevato overflow a 390 px in Piani Abbonamento, Notification Center e Staff, overflow del Training a 1024 px, sovrapposizione della hero Training e styling non applicato alle card Access Control. Sono stati corretti box sizing e contenimento delle primitive, scroll interno della tabella piani, composizione mobile di Notification Center e Staff, breakpoint Training e card/focus Access Control. Il ciclo 2 è stato ripetuto integralmente dopo l'ultima correzione: 124 combinazioni, zero redirect inattesi, zero overflow, zero controlli off-viewport e zero `pageerror`.

Gli screenshot strategici e quelli dei finding sono stati realmente osservati con `view_image` in entrambi i cicli; nessuna immagine è stata committata. Il browser ha registrato un messaggio console per combinazione dovuto esclusivamente al WebSocket HMR di `next dev` nel browser headless; gli errori applicativi console sono zero. La rete finale contiene soltanto letture verso il runtime locale, `/api/auth/me`, API GET esistenti e REST Supabase effimero. Sono state osservate **zero richieste di scrittura**: nessun pagamento, ricevuta, abbonamento, accesso, notifica, logout o comando hardware è stato eseguito.

Endpoint, metodi, payload, query, RPC, permessi, redirect, polling, realtime, export, side effect, azioni distruttive, numerazione ricevute, badge, credenziali, logout e autenticazione restano invariati. Token, storage, fixture, servizio, script, screenshot e report intermedi sono stati rimossi da `/tmp` dopo la certificazione.
