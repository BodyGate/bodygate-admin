-- BodyGate annual receipt numbering.
-- Adds atomic yearly counters for new customer_receipts without backfilling history.

alter table if exists public.customer_receipts
  add column if not exists receipt_year integer,
  add column if not exists receipt_sequence integer;

create table if not exists public.receipt_counters (
  year integer primary key,
  last_sequence integer not null default 0,
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_receipts_receipt_number_uidx
  on public.customer_receipts (receipt_number)
  where receipt_number is not null;

create unique index if not exists customer_receipts_receipt_year_sequence_uidx
  on public.customer_receipts (receipt_year, receipt_sequence)
  where receipt_year is not null
    and receipt_sequence is not null;

create or replace function public.next_bodygate_receipt_number_v2()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_year integer := extract(year from current_date)::integer;
  next_sequence integer;
  next_receipt_number text;
begin
  insert into public.receipt_counters(year, last_sequence, updated_at)
  values (target_year, 1, now())
  on conflict (year)
  do update set
    last_sequence = public.receipt_counters.last_sequence + 1,
    updated_at = now()
  returning last_sequence into next_sequence;

  next_receipt_number := target_year::text || '-' || lpad(next_sequence::text, 4, '0');

  return jsonb_build_object(
    'receipt_year', target_year,
    'receipt_sequence', next_sequence,
    'receipt_number', next_receipt_number
  );
end;
$$;
