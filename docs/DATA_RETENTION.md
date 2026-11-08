# Conservazione dei dati: schema `archive`

Decisione del titolare del 2026-11-08: **i backup dello schema `archive` si
conservano 5 anni**. Questo documento la rende operativa e verificabile.

## Cosa contiene

17 tabelle nate dall'import da ClubManager (giugno 2026) e dalle correzioni dati
successive: backup pre-import, staging, correzioni nomi, sincronizzazione
certificati medici, riconciliazione pagamenti e ricevute. Quasi tutte contengono
dati personali; `clubmanager_medical_certificates_audit_20260612` e
`medical_certificate_sync_candidates_20260612` riguardano **dati sanitari**
(GDPR art. 9). Due tabelle (`security_hardening_20261108_*`) contengono solo
metadati per il rollback di HOTFIX 0.4 e non hanno dati personali.

## Regole

1. **Nessuna cancellazione automatica.** Eliminare una tabella e' irreversibile:
   a ogni scadenza una persona controlla e decide.
2. **Registro:** `archive.retention_register` ha una riga per tabella con
   `retained_since`, `delete_after` e se contiene dati personali. Ogni tabella
   riporta la stessa scadenza nel proprio commento (`\d+ archive.<tabella>`).
3. **Scadenze:** dal **2031-06-04** al **2031-06-19** per le 17 tabelle con dati
   personali. Le due tabelle di rollback vanno riviste entro **2027-11-08**.
4. **Accesso:** solo service role. `anon` e `authenticated` non hanno privilegi
   ne' accesso allo schema; lo schema non e' esposto via API. Verificato il
   2026-11-08.
5. **Nuove tabelle in `archive`:** devono avere una riga nel registro (vedi sotto).
   Un'estensione dell'elenco senza registro e' un difetto.

## Aggiungere una tabella all'archivio

```sql
insert into archive.retention_register
  (table_name, contains_personal_data, source, retained_since, delete_after)
values ('nome_tabella', true, 'Motivo del backup', current_date, current_date + interval '5 years');
```

## Elenco di controllo annuale

```sql
-- tabelle in scadenza nei prossimi 90 giorni
select table_name, delete_after
from archive.retention_register
where delete_after <= current_date + interval '90 days'
order by delete_after;

-- tabelle senza registrazione (non deve restituire righe)
select c.relname
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'archive' and c.relkind = 'r'
  and c.relname <> 'retention_register'
  and not exists (select 1 from archive.retention_register r where r.table_name = c.relname);
```

## Da valutare con il consulente privacy

- La base giuridica e lo scopo della conservazione per 5 anni, in particolare per
  i dati sanitari (certificati medici). Se lo scopo e' solo il ripristino dopo
  l'import, un periodo piu' breve o la pseudonimizzazione dei backup riduce il
  rischio. La scelta e' del titolare; qui si registra solo che e' stata presa.
- Il diritto alla cancellazione di un singolo cliente vale anche per l'archivio:
  serve una procedura che cerchi e rimuova (o renda anonimo) quel cliente nelle
  tabelle `archive` e non solo in `public`.
- I backup di Supabase contengono comunque questi dati finche' non scadono.
