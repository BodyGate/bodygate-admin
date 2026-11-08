-- STATO: applicata in produzione il 2026-11-08.
--
-- BodyGate ARCHIVE RETENTION 1.0
-- Il titolare ha deciso (2026-11-08) che i backup dello schema `archive`
-- (import ClubManager, correzioni dati, riconciliazioni) si conservano 5 anni.
-- Questa migrazione NON cancella nulla:
--   1) chiude i privilegi residui di anon/authenticated sulle tabelle archive;
--   2) crea il registro di conservazione con la data di eliminazione prevista
--      di ogni tabella e la riporta come commento sulla tabella.
-- La cancellazione resta sempre manuale e rivista (vedi docs/DATA_RETENTION.md).

revoke all on all tables in schema archive from public, anon, authenticated;
revoke all on all sequences in schema archive from public, anon, authenticated;
alter default privileges for role postgres in schema archive
  revoke all on tables from public, anon, authenticated;

create table if not exists archive.retention_register (
  table_name text primary key,
  contains_personal_data boolean not null,
  source text not null,
  retained_since date not null,
  delete_after date not null,
  basis text not null default 'Decisione del titolare del 2026-11-08: conservazione 5 anni',
  reviewed_at date
);
alter table archive.retention_register enable row level security;
revoke all on archive.retention_register from public, anon, authenticated;

insert into archive.retention_register (table_name, contains_personal_data, source, retained_since, delete_after) values
  ('backup_customers_before_clubmanager_20260604',               true,  'Backup anagrafica prima dell''import ClubManager',        date '2026-06-04', date '2031-06-04'),
  ('backup_customer_subscriptions_before_clubmanager_20260604',  true,  'Backup abbonamenti prima dell''import ClubManager',       date '2026-06-04', date '2031-06-04'),
  ('backup_customer_membership_fees_before_clubmanager_20260604',true,  'Backup quote associative prima dell''import ClubManager', date '2026-06-04', date '2031-06-04'),
  ('stg_clubmanager_customers',                                  true,  'Staging import ClubManager (anagrafica)',                 date '2026-06-04', date '2031-06-04'),
  ('stg_clubmanager_subscriptions',                              true,  'Staging import ClubManager (abbonamenti)',                date '2026-06-04', date '2031-06-04'),
  ('stg_clubmanager_membership_fees',                            true,  'Staging import ClubManager (quote associative)',          date '2026-06-04', date '2031-06-04'),
  ('stg_clubmanager_live_subscriptions_20260611',                true,  'Staging import ClubManager (abbonamenti attivi)',         date '2026-06-11', date '2031-06-11'),
  ('clubmanager_medical_certificates_audit_20260612',            true,  'Audit certificati medici (dati sanitari)',                date '2026-06-12', date '2031-06-12'),
  ('medical_certificate_sync_candidates_20260612',               true,  'Candidati sincronizzazione certificati medici',           date '2026-06-12', date '2031-06-12'),
  ('customers_medical_certificate_sync_backup_20260612',         true,  'Backup prima della sincronizzazione certificati medici',  date '2026-06-12', date '2031-06-12'),
  ('customers_duplicate_cleanup_backup_20260612',                true,  'Backup prima della pulizia duplicati',                    date '2026-06-12', date '2031-06-12'),
  ('customers_name_fix_backup_20260612',                         true,  'Backup prima della correzione nomi',                      date '2026-06-12', date '2031-06-12'),
  ('customers_name_fix_manual_backup_20260612',                  true,  'Backup prima della correzione manuale nomi',              date '2026-06-12', date '2031-06-12'),
  ('payments_reconcile_backup_20260619',                         true,  'Backup prima della riconciliazione pagamenti',            date '2026-06-19', date '2031-06-19'),
  ('customer_payments_reconcile_backup_20260619',                true,  'Backup prima della riconciliazione pagamenti clienti',    date '2026-06-19', date '2031-06-19'),
  ('customer_receipts_reconcile_backup_20260619',                true,  'Backup prima della riconciliazione ricevute',             date '2026-06-19', date '2031-06-19'),
  ('customer_subscriptions_plan_fix_backup_20260619',            true,  'Backup prima della correzione piani abbonamento',         date '2026-06-19', date '2031-06-19')
on conflict (table_name) do nothing;

insert into archive.retention_register (table_name, contains_personal_data, source, retained_since, delete_after, basis) values
  ('security_hardening_20261108_policies', false, 'Snapshot policy per rollback HOTFIX 0.4 (solo metadati)', date '2026-11-08', date '2027-11-08', 'Rivedere entro un anno: eliminare quando il rollback non serve piu'''),
  ('security_hardening_20261108_grants',   false, 'Snapshot privilegi per rollback HOTFIX 0.4 (solo metadati)', date '2026-11-08', date '2027-11-08', 'Rivedere entro un anno: eliminare quando il rollback non serve piu''')
on conflict (table_name) do nothing;

do $$
declare r record;
begin
  for r in select * from archive.retention_register loop
    if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'archive' and c.relname = r.table_name) then
      execute format('comment on table archive.%I is %L', r.table_name,
        case when r.contains_personal_data
          then format('Conservazione 5 anni (decisione del titolare 2026-11-08). Contiene dati personali: solo service role. Eliminare dopo %s. Vedi archive.retention_register.', r.delete_after)
          else format('Metadati senza dati personali. Rivedere entro %s. Vedi archive.retention_register.', r.delete_after)
        end);
    end if;
  end loop;
end
$$;

comment on table archive.retention_register is 'Registro di conservazione dello schema archive: una riga per tabella con data di eliminazione prevista. La cancellazione e'' sempre manuale e rivista.';
