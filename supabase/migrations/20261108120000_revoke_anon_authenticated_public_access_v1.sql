-- BodyGate SECURITY HARDENING 1.0
-- Chiude l'accesso diretto dei ruoli `anon` e `authenticated` ai dati dello
-- schema public.
--
-- Contesto: la chiave anon (NEXT_PUBLIC_SUPABASE_ANON_KEY) e' presente nel
-- bundle del browser. Le policy "Allow anon read ..." con `using (true)`
-- rendevano leggibili da chiunque anagrafica clienti (codice fiscale,
-- documento, contatti, stato certificato medico), abbonamenti, quote e log
-- di accesso. L'applicazione NON usa PostgREST con questi ruoli: ogni lettura
-- e scrittura passa da API server con service role (che bypassa le RLS).
-- Il solo uso lato browser della chiave anon e' il Realtime, che comunque non
-- riceve eventi: la publication supabase_realtime contiene solo access_logs.
--
-- Rollback: scripts/sql/security-hardening-1-0-rollback.sql (usa lo snapshot
-- creato qui sotto nello schema archive).

-- 1) Snapshot di policy e grant (solo metadati, nessun dato personale).
--    Lo schema `archive` esiste in produzione (backup ClubManager) ma non in un
--    ambiente nuovo: va creato, chiuso ai ruoli pubblici e solo poi usato.
create schema if not exists archive;
revoke all on schema archive from public, anon, authenticated;

create table if not exists archive.security_hardening_20261108_policies as
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public';

create table if not exists archive.security_hardening_20261108_grants as
select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated');

alter table archive.security_hardening_20261108_policies enable row level security;
alter table archive.security_hardening_20261108_grants enable row level security;
revoke all on archive.security_hardening_20261108_policies from anon, authenticated;
revoke all on archive.security_hardening_20261108_grants from anon, authenticated;

-- 2) Elimina le policy di SELECT aperte (`using (true)`) per anon/authenticated.
--    Restano le policy "No direct ... = false" e quella condizionata della
--    libreria esercizi (priva di grant, quindi inerte).
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and cmd = 'SELECT'
      and qual = 'true'
      and roles && array['anon', 'authenticated']::name[]
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$$;

-- 3) Revoca ogni privilegio su tabelle e sequenze (inclusi TRUNCATE/TRIGGER/
--    REFERENCES concessi di default). Il service role non e' toccato.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- 4) Le nuove tabelle non devono piu' nascere accessibili a anon/authenticated.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- 5) Funzione SECURITY DEFINER ancora eseguibile da `authenticated`.
revoke execute on function public.nextval_dnake_user_id() from public, anon, authenticated;
