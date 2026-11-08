-- Ruoli e schemi minimi che su Supabase esistono gia', per far girare su un
-- PostgreSQL vuoto i test che usano il database (creazione palestra, limite login).
-- Idempotente: i ruoli sono globali al cluster.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end
$$;

create schema if not exists extensions;
create schema if not exists realtime;
create schema if not exists storage;

create table if not exists storage.buckets (id text primary key, name text not null, public boolean default false);

create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language sql as 'select';
