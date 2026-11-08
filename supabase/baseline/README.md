# Baseline dello schema BodyGate

Ricostruzione completa e verificata dello schema `public` di produzione
(progetto Supabase BodyGate), estratta il **2026-11-08** dopo HOTFIX 0.4.
Serve a creare un ambiente nuovo (staging, test, nuova sede) con un solo
comando, cosa impossibile prima: il nucleo del database (clienti, pagamenti,
accessi) non e' in nessuna delle migrazioni di `supabase/migrations/`.

> Non e' una migrazione: sta fuori da `supabase/migrations/` di proposito,
> cosi' `supabase db push` non prova a ricrearla su produzione.

## Ordine di esecuzione

| File | Contenuto |
|---|---|
| `01_extensions_types_tables.sql` | estensioni, 6 enum, 1 sequenza, 67 tabelle (715 colonne) |
| `02_constraints_indexes.sql` | 230 vincoli (PK, unique, esclusioni, check, FK) e 136 indici |
| `03_functions.sql` | 27 funzioni (RPC atomiche, ricevute, trigger helper) con i loro permessi |
| `04_triggers_views_security.sql` | 17 trigger, 2 viste, RLS su tutte le tabelle, 25 policy, privilegi, 3 bucket storage |
| `05_reference_seed.sql` | dati di configurazione: 5 ruoli, 15 permessi, 45 assegnazioni, 5 metodi di pagamento, 8 moduli |

```bash
for f in supabase/baseline/0*.sql; do
  PGOPTIONS="-c search_path=public,extensions" \
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

Dopo il seed servono ancora i dati specifici della sede: una riga in `branches`,
un `membership_fee_settings`, categorie e piani abbonamento, e almeno un
utente in `app_users` (password con hash bcrypt) e `staff_users`.

## Cosa e' stato verificato

La baseline e' stata applicata a un PostgreSQL 16 **vuoto** (con ruoli
`anon`/`authenticated`/`service_role` e schemi `extensions`/`realtime`/`storage`
simulati) e confrontata con produzione. Tutti gli indicatori coincidono:

| Oggetto | Produzione | Baseline |
|---|---|---|
| Tabelle / colonne | 67 / 715 | 67 / 715 |
| Viste | 2 | 2 |
| Vincoli | 230 | 230 |
| Indici (esclusi quelli dei vincoli) | 136 | 136 |
| Funzioni | 27 | 27 |
| Trigger | 17 | 17 |
| Enum | 6 | 6 |
| Policy | 25 | 25 |
| Tabelle con RLS | 67 | 67 |
| Permessi diretti anon/authenticated | 0 | 0 |

Il seed e' idempotente (secondo lancio senza errori).

## Limiti noti

- Testata su PostgreSQL 16; produzione e' 17. Nessuna funzionalita' specifica di
  17 e' usata.
- Su Supabase servono `pgcrypto`, `uuid-ossp`, `btree_gist` nello schema
  `extensions` (le esclusioni anti-sovrapposizione dei corsi usano `btree_gist`).
- **Non inclusi:** schema `archive` (backup della migrazione da ClubManager, con
  dati personali, conservati 5 anni per decisione del titolare: vedi `docs/DATA_RETENTION.md`), schemi gestiti
  da Supabase (`auth`, `storage`, `realtime`), dati dei clienti.
- Lo storico `supabase_migrations` di produzione non coincide con i file in
  `supabase/migrations/` (stesse modifiche, versioni diverse). Per un ambiente
  nuovo si usa questa baseline e **non** le migrazioni precedenti al 2026-11-08.
- La vista `bodygate_v2_customers` non e' `security_invoker` (ignora le RLS).
  Oggi e' inerte perche' nessun ruolo pubblico ha accesso: non concederlo mai.
- La matrice permessi del seed e' fedele alla produzione, non una scelta
  progettuale: vedi `docs/SECURITY_HOTFIX_0_4.md` (sezione RBAC).

## Rigenerare la baseline

Le definizioni vengono da `pg_get_functiondef`, `pg_get_constraintdef`,
`pg_get_indexdef`, `pg_get_triggerdef` e `pg_get_viewdef` sul database vivo.
Se lo schema cambia, aggiungere una migrazione in `supabase/migrations/` e
rigenerare la baseline alla prossima release.
