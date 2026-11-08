# ADR 0001 — Modello di multi-tenancy per BodyGate

Stato: **proposto** (da confermare prima di scrivere codice)
Data: 2026-11-08

## Contesto (verificato su codice e database)

- Oggi il database ha **1 sede** (`branches` = 1) e **nessuna** colonna
  `tenant_id`/`organization_id`. `branch_id` esiste su circa 15 tabelle su 66 e
  serve alle sedi di una stessa palestra. Mancano su `payments`,
  `customer_payments`, `customer_receipts`, `customer_documents`,
  `medical_certificates`, `customer_internal_notes`, ecc.
- L'applicazione **non usa Supabase Auth** (`auth.users` = 0): il login e' proprio
  (`app_users`, bcrypt, cookie firmato) e **ogni** accesso ai dati usa la service
  role, che bypassa le RLS (circa 90 route API creano il proprio client).
  Conseguenza: le RLS non possono isolare i tenant cosi' come sono.
- Dati particolarmente sensibili: certificati medici, documento d'identita',
  codice fiscale (GDPR art. 9).
- Hardware: un bridge in sede per palestra (tornelli DNAKE), con chiave
  macchina propria (`BODYGATE_MACHINE_KEY`).
- Il numero di clienti previsto nei primi 12-18 mesi e' basso (decine di sedi, non
  migliaia).

## Opzioni

### A. Database condiviso con `tenant_id` + RLS
Una sola base dati, `tenant_id` su ogni tabella, policy RLS che confrontano
`tenant_id` con un claim del JWT.

- Pro: costo e operativita' minimi a regime, una sola migrazione per tutti.
- Contro **oggi**: richiede prima di migrare l'autenticazione a Supabase Auth (o
  a JWT firmati compatibili) e di eliminare l'uso diffuso della service role,
  altrimenti le RLS non proteggono nulla. Un solo `where` dimenticato in una
  delle ~90 route espone i dati di **tutte** le palestre. Rischio alto con dati
  sanitari.

### B. Un progetto Supabase per palestra
Ogni cliente ha il proprio database (stessa baseline), l'app seleziona
URL/chiavi in base al tenant (dominio o sottodominio).

- Pro: isolamento forte per costruzione, nessuna modifica alle query,
  offboarding GDPR banale (si elimina il progetto), regione scelta per cliente,
  blast radius limitato, backup e ripristino per cliente.
- Contro: costo per progetto, migrazioni da propagare a N database, nessuna
  vista aggregata nativa.

### C. Schema per tenant nello stesso progetto
Compromesso: isolamento logico, ma stessi limiti di A sulla service role e
migrazioni N volte. Scartata.

## Decisione proposta

**B ora, A piu' avanti.**

1. Per le prime 5-20 palestre: progetto Supabase dedicato per tenant, creato dalla
   baseline (`supabase/baseline/`, gia' verificata su database vuoto).
2. Introdurre un **registro dei tenant** (tabella o configurazione server) con
   dominio, URL del progetto, riferimento ai segreti, piano e stato.
3. Un **runner di migrazioni** che applica la stessa migrazione a tutti i tenant,
   con registro delle versioni per tenant e arresto al primo errore.
4. Quando i tenant superano la trentina o serve una vista aggregata: passare ad A
   solo dopo aver (a) spostato l'autenticazione su JWT con claim `tenant_id`,
   (b) sostituito la service role con client scoped per tenant, (c) aggiunto
   `tenant_id` e RLS con test automatici di isolamento.

Motivo: il rischio principale non e' il costo ma una fuga di dati tra clienti. B
lo elimina senza riscrivere 90 route; A e' la destinazione, non il punto di
partenza.

## Un centro con piu' sedi (aggiunta 2026-11-08)

Un cliente BodyGate puo' essere un **centro con piu' sedi**. Il modello diventa a
due livelli: **centro** (il tenant, cioe' il database nel modello B) che contiene
**N sedi** (`branches`). Il centro e' l'unita' di fatturazione, di sicurezza e di
dati; la sede e' l'unita' operativa (clienti iscritti, varchi, cassa, corsi).

### Cosa regge gia' e cosa no (verificato su database e codice)
- La tabella `branches` esiste e **20 tabelle su 66** hanno `branch_id`: clienti,
  abbonamenti, quote, corsi, contabilita', badge, presenze, listini, impostazioni.
- **Mancano di `branch_id`** tabelle operative: `payments`, `customer_payments`,
  `customer_receipts`, `customer_documents`, `customer_blocks`, `access_logs`
  (registro grezzo dei varchi), `unknown_badge_logs`, `training_programs`,
  `workout_sessions`, `staff_users`.
- **Dati incompleti oggi:** 4 clienti, 1 abbonamento e 24 ingressi senza sede.
- **Il codice presuppone una sede sola:** `app/lib/server/defaultBranch.ts` sceglie
  la "sede predefinita" (con un ID fisso del primo centro come ripiego); non esiste
  una sede attiva nella sessione ne' un selettore di sede nell'interfaccia.
- **Controllo accessi:** `access/check` riconosce il badge ma non da quale
  varco/sede arriva; non c'e' un registro dei dispositivi per sede.
- **Staff e permessi** sono globali: nessuna assegnazione di una persona a una sede.
- **Numerazione ricevute:** un contatore per anno (`receipt_counters`), non per sede.
- **Sicurezza hardware:** una sola chiave macchina (`BODYGATE_MACHINE_KEY`) per
  tutta l'installazione, non una per bridge/sede.
- Esiste gia' il modulo `multi_branch` (disattivato) in `system_modules`.

### Decisioni di prodotto (titolare, 2026-11-08)
1. **Accesso:** ogni cliente entra **solo nella sede dove e' stata creata la sua anagrafica**
   (sede di appartenenza = sede di creazione).
2. **Abbonamenti:** per ora **nessun abbonamento valido in piu' sedi**. L'abbonamento
   appartiene alla sede del cliente.
3. **Ricevute:** si numerano **per sede**.
4. **Listini:** si impostano **in fase di installazione**, sede per sede.
5. **Ancora da decidere:** il personale lavora in una sola sede o in piu'? Serve un ruolo
   "responsabile di centro" che vede tutte le sedi? I report sono per sede, consolidati o
   entrambi? (Proposta predefinita: personale assegnabile a piu' sedi tramite
   `staff_branches`; il responsabile di centro vede tutto; report per sede e consolidato.)

### Cosa comportano queste decisioni
- **Cliente solo nella sua sede:** `customers.branch_id` diventa obbligatorio. Il controllo
  accessi deve conoscere la sede del varco e negare con un motivo chiaro ("cliente di
  un'altra sede") quando non coincide. Resta da decidere se serve un "trasferimento di
  sede" quando un cliente si sposta.
- **Nessun abbonamento multi-sede:** nessun campo nuovo sui piani. Il disegno non lo
  esclude per il futuro (basterebbe un flag sul piano).
- **Ricevute per sede:** oggi `customer_receipts.receipt_number` e' **univoco in tutto il
  database** e il contatore (`receipt_counters`) e' per anno. Numerando per sede due sedi
  genererebbero lo stesso numero: serve un prefisso/sezionale per sede (es. `A-2026-0001`)
  oppure rendere l'unicita' per (sede, numero), piu' `branch_id` su `customer_receipts` e
  contatore per (sede, anno). Il formato va concordato con il commercialista. Va toccata
  `next_bodygate_receipt_number_v2` e il vincolo `customer_receipts_year_sequence_uidx`,
  cioe' il percorso dei pagamenti: fase a rischio, da fare con test dedicati.
- **Listini all'installazione:** `subscription_plans`, `subscription_categories` e
  `membership_fee_settings` hanno gia' `branch_id`. Lo script di creazione carica ora
  i listini per sede da un file (`--plans-file`, vedi `docs/TENANT_PROVISIONING.md`).
- **Dati mancanti oggi** (verificati il 2026-11-08, non toccati): 4 clienti senza sede
  (tutti inattivi), 1 abbonamento (di uno di quei clienti), 2 quote e 24 ingressi
  (21 sono badge sconosciuti, senza cliente). Con una sola sede esistente la sede giusta
  e' una sola; lo script storico `scripts/sql/backfill-default-branch.sql` lascia di
  proposito fuori i clienti inattivi. Si sistema nella fase 1, insieme al `NOT NULL`.

### Proposta (da confermare con le risposte sopra)
- **Tenant = centro**, un database per centro (invariato). Le sedi vivono dentro.
- Ogni sede ha il **proprio bridge e la propria chiave macchina**, registrati in una
  tabella `access_devices (branch_id, controller_code, ...)`; `access/check` risolve
  la sede dal dispositivo e applica la regola scelta al punto 1.
- Assegnazione personale-sede (`staff_branches`) e **sede attiva** nella sessione;
  ogni route operativa filtra per sede, con il centro intero solo per chi ha il
  permesso di responsabile di centro.
- Contatori di ricevuta per (sede, anno), con prefisso/sezionale per sede (decisione 3).

### Piano di lavoro a fasi (ogni fase e' rilasciabile da sola)
1. **Integrita' dei dati:** assegnare la sede ai 4 clienti, 1 abbonamento e 24
   ingressi senza sede (script `scripts/sql/backfill-default-branch.sql` come base);
   poi `NOT NULL` dove ha senso.
2. **Schema:** `branch_id` sulle tabelle operative mancanti, `staff_branches`,
   `access_devices`; migrazioni additive e baseline rigenerata.
3. **Sessione e API:** sede attiva nella sessione; scoping per sede nelle route
   (le guardie `withPermission` sono il punto dove agganciarlo); rimozione di
   `defaultBranch.ts` e del suo ID fisso.
4. **Accessi:** `access_devices`, chiave macchina per bridge, regola multi-sede.
5. **Interfaccia:** selettore di sede, filtri e vista consolidata.
6. **Ricevute e report** per sede/centro.

Le fasi 1-2 non cambiano il comportamento per un centro con una sola sede. Stima
indicativa e non verificata: 4-8 settimane di un ingegnere per le fasi 1-6.

## Prerequisiti (indipendenti dalla scelta)

- Autorizzazione lato server sulle route: fatta su 79 file di route su 90 (vedi
  `docs/SECURITY_HOTFIX_0_4.md`); resta da aggiungere lo scoping per sede.
- Account personali per operatore (oggi `app_users` ha 1 riga: nessuna
  tracciabilita' e la matrice ruoli non ha effetto).
- Revisione della matrice ruoli/permessi (`trainer` e `reception` hanno
  `manage_staff`).
- Variabili d'ambiente e segreti per tenant (service role, chiave macchina,
  segreto di sessione distinto) e un bridge installabile da remoto.
- Contratto, DPA/GDPR e SLA; registro dei trattamenti; politica di conservazione
  per lo schema `archive` e per i log.

## Definizione di "pronto per vendere come SaaS"

- [ ] Creazione di una nuova palestra senza intervento manuale (database,
      segreti, utente admin, dominio) in meno di 30 minuti.
- [ ] Test automatico: l'utente del tenant X non legge nulla del tenant Y.
- [ ] Autorizzazione server su tutte le route, con test.
- [ ] Fatturazione ricorrente e stato di sospensione per mancato pagamento.
- [ ] Bridge hardware con aggiornamento e monitoraggio remoti.
- [ ] Backup verificati con ripristino provato, per tenant.
- [ ] Documenti legali (DPA, informativa, SLA) e procedura di data breach.

## Stime

Le stime sono indicative e non verificate: B con runner e onboarding, 3-5
settimane di un ingegnere; il passaggio ad A, 2-3 mesi. Da rivedere dopo uno
spike di una settimana.
