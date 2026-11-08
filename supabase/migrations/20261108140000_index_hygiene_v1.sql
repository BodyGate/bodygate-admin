-- STATO: applicata in produzione il 2026-11-08.
--
-- BodyGate INDEX HYGIENE 1.0
-- 1) Rimuove due duplicati esatti segnalati dall'advisor Supabase.
-- 2) Crea gli indici mancanti sulle chiavi esterne a colonna singola di public
--    (join e cancellazioni a cascata oggi richiedono scansioni complete).
--
-- Nessuna modifica ai dati. Le tabelle sono piccole (< 5.000 righe): la
-- creazione degli indici e' immediata.

-- 1) Duplicati. L'unicita' resta garantita dall'indice/vincolo gemello.
drop index if exists public.access_credentials_code_unique;
alter table public.customer_mobile_passes
  drop constraint if exists customer_mobile_passes_public_token_unique;

-- 2) Indici sulle FK a colonna singola prive di indice di copertura.
do $$
declare
  r record;
  idx_name text;
begin
  for r in
    select
      c.conrelid::regclass as tbl,
      c.conrelid as tbl_oid,
      c.conkey[1] as colnum,
      a.attname as col
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and n.nspname = 'public'
      and array_length(c.conkey, 1) = 1
      and not exists (
        select 1
        from pg_index i
        where i.indrelid = c.conrelid
          and i.indkey[0] = c.conkey[1]
          and i.indisvalid
      )
  loop
    idx_name := left(format('idx_%s_%s_fk', replace(r.tbl::text, 'public.', ''), r.col), 63);
    execute format('create index if not exists %I on %s (%I)', idx_name, r.tbl, r.col);
  end loop;
end
$$;
