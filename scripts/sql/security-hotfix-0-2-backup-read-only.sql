-- BodyGate HOTFIX 0.2
-- Backup metadata pre-migration (READ ONLY).
--
-- Non modifica dati o schema e non richiama alcuna RPC.

with objects as (
  select jsonb_build_object(
    'operations_table_exists',
      to_regclass('public.subscription_renewal_operations') is not null,
    'atomic_rpc_exists',
      to_regprocedure(
        'public.renew_subscription_atomic_v1(text,text,uuid,uuid,text,date,numeric,text,text,numeric,text,boolean)'
      ) is not null,
    'receipt_rpc_definition',
      pg_get_functiondef(
        'public.next_bodygate_receipt_number_v2()'::regprocedure
      ),
    'receipt_counter',
      (
        select to_jsonb(x)
        from (
          select year, last_sequence, updated_at
          from public.receipt_counters
          order by year desc
          limit 1
        ) x
      ),
    'latest_structured_receipt',
      (
        select to_jsonb(x)
        from (
          select
            id,
            receipt_number,
            receipt_year,
            receipt_sequence,
            issued_at
          from public.customer_receipts
          where receipt_year is not null
            and receipt_sequence is not null
          order by receipt_year desc, receipt_sequence desc
          limit 1
        ) x
      )
  ) as payload
)
select
  'HOTFIX_0_2_PRE_MIGRATION_METADATA'::text as section_code,
  payload
from objects;
