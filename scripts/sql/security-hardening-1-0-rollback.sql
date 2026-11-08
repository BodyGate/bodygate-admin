-- ROLLBACK di supabase/migrations/20261108120000_revoke_anon_authenticated_public_access_v1.sql
--
-- ATTENZIONE: riapre l'accesso diretto di anon/authenticated ai dati dei
-- clienti (PII e dati sanitari). Usare solo per un ripristino d'emergenza e
-- richiudere appena possibile.
--
-- Richiede lo snapshot archive.security_hardening_20261108_* creato dalla
-- migrazione. Eseguire in transazione.

begin;

-- 1) Ripristina i grant di tabella.
do $$
declare
  r record;
begin
  for r in
    select distinct table_schema, table_name, grantee, privilege_type
    from archive.security_hardening_20261108_grants
  loop
    execute format('grant %s on %I.%I to %I', r.privilege_type, r.table_schema, r.table_name, r.grantee);
  end loop;
end
$$;

-- 2) Ricrea le policy eliminate (solo quelle assenti).
do $$
declare
  r record;
  roles_sql text;
begin
  for r in
    select s.*
    from archive.security_hardening_20261108_policies s
    where not exists (
      select 1 from pg_policies p
      where p.schemaname = s.schemaname
        and p.tablename = s.tablename
        and p.policyname = s.policyname
    )
  loop
    select string_agg(quote_ident(x), ', ') into roles_sql from unnest(r.roles) as x;
    execute format(
      'create policy %I on %I.%I as %s for %s to %s%s%s',
      r.policyname, r.schemaname, r.tablename, r.permissive, r.cmd, roles_sql,
      case when r.qual is not null then ' using (' || r.qual || ')' else '' end,
      case when r.with_check is not null then ' with check (' || r.with_check || ')' else '' end
    );
  end loop;
end
$$;

grant execute on function public.nextval_dnake_user_id() to authenticated;

commit;
