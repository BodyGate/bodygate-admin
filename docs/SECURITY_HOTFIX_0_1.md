# BodyGate — Security Hotfix 0.1

## Obiettivo

Chiudere due superfici P0 confermate dagli audit live Supabase:

1. `public.bg_v2_customers_crm` era leggibile e modificabile da `anon`, automaticamente aggiornabile, posseduta da `postgres` e priva di `security_invoker`.
2. Le RPC `next_bodygate_receipt_number()` e `next_bodygate_receipt_number_v2()` erano eseguibili da ruoli client; la RPC legacy è anche `SECURITY DEFINER`.

La hotfix non modifica dati reali, contatori, ricevute, pagamenti, Mobile Pass, Bridge, DNake, KT02.3, tornello o access control.

## File

- `scripts/sql/security-hotfix-0-1-backup-read-only.sql`
- `scripts/sql/security-hotfix-0-1.sql`
- `scripts/sql/security-hotfix-0-1-verify-read-only.sql`
- `scripts/sql/security-hotfix-0-1-rollback.sql`

## Preflight obbligatorio

1. Verificare il branch e la revisione applicativa in produzione.
2. Eseguire `security-hotfix-0-1-backup-read-only.sql` nel Supabase SQL Editor.
3. Esportare il risultato in CSV e conservarlo insieme al ticket/PR.
4. Non eseguire manualmente nessuna RPC ricevuta.
5. Annotare il valore corrente di `receipt_counters.last_sequence` senza modificarlo.

## Applicazione

Eseguire nel Supabase SQL Editor:

```text
scripts/sql/security-hotfix-0-1.sql
```

Lo script usa una transazione unica. Se un oggetto atteso manca o un comando fallisce, PostgreSQL annulla l'intera hotfix.

## Verifica database

Eseguire:

```text
scripts/sql/security-hotfix-0-1-verify-read-only.sql
```

L'esito atteso è:

```text
hotfix_ok = true
```

La verifica non chiama le RPC e non consuma numeri ricevuta.

## QA applicativo

### CRM

- Login reception riuscito.
- Dashboard raggiungibile.
- `/customers` carica la lista.
- Ricerca e filtri clienti funzionano.
- Scheda cliente raggiungibile.
- Storico pagamenti e ricevute leggibile.

La lista clienti corrente usa `/api/customers/list`, che legge `public.customers` lato server con service role; non dipende dalla vista CRM.

### Flussi economici

Eseguire soltanto smoke test non distruttivi prima dell'applicazione live. Dopo l'applicazione, un test economico reale va svolto solo secondo procedura reception autorizzata:

- rinnovo abbonamento tramite route ufficiale;
- quota associativa tramite route ufficiale;
- verifica che la ricevuta sia generata dalla RPC v2 tramite service role;
- verifica che il numero progressivo sia aumentato una sola volta;
- nessuna chiamata manuale alle RPC.

### Access control

Non sono modificati file o oggetti relativi a:

- `/api/access/check`;
- Bridge;
- DNake;
- KT02.3;
- tornello;
- badge normalization;
- Mobile Pass.

Il QA deve limitarsi a verificare che i percorsi esistenti restino raggiungibili; non è richiesto aprire il tornello per validare questa patch SQL.

## Rollback

Usare `security-hotfix-0-1-rollback.sql` soltanto in caso di regressione grave e documentata.

Il rollback ripristina intenzionalmente ACL vulnerabili. Dopo il rollback:

1. rieseguire lo script di audit sicurezza;
2. aprire immediatamente un incidente P0;
3. non considerare l'ambiente protetto;
4. preparare una correzione alternativa prima di proseguire con altre funzionalità.

## Limitazioni intenzionali

Questa hotfix non rimuove ancora le policy `anon SELECT USING (true)` dalle tabelle base, perché alcune parti legacy dell'interfaccia utilizzano ancora il client Supabase anon. La loro mappatura e migrazione verso route server costituisce la fase successiva di hardening.

Non vengono eliminate:

- la RPC legacy;
- `receipt_sequences`;
- la vista CRM;
- policy RLS delle tabelle base;
- grant generali non direttamente coinvolti nella superficie minima.

## Criteri di completamento

La hotfix è completa quando:

- `anon` e `authenticated` non hanno privilegi sulla vista CRM;
- `service_role` ha soltanto `SELECT` sulla vista CRM;
- la vista ha `security_invoker=true`;
- `anon` e `authenticated` non possono eseguire le RPC ricevute;
- `service_role` può eseguire entrambe le RPC;
- la lista clienti continua a funzionare;
- i flussi ufficiali ricevuta continuano a usare la service role;
- nessun numero è stato consumato durante backup e verifica;
- nessun dato reale è stato modificato dalla procedura di hardening.
