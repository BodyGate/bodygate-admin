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

## Prerequisiti (indipendenti dalla scelta)

- Autorizzazione lato server su **tutte** le route (oggi solo 9 su 90; vedi
  `docs/SECURITY_HOTFIX_0_4.md`).
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
