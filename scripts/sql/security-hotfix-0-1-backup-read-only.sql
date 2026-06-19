-- BodyGate HOTFIX 0.1 — snapshot metadata pre-applicazione (READ ONLY)
--
-- Eseguire prima della hotfix ed esportare il singolo result set in CSV.
-- Non esegue RPC e non modifica dati o schema.

with view_metadata as (
  select
    n.nspname as schema_name,
    c.relname as object_name,
    pg_get_userbyid(c.relowner) as owner_name,
    c.relacl::text as raw_acl,
    c.reloptions,
    pg_get_viewdef(c.oid, true) as definition
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'bg_v2_customers_crm'
    and c.relkind = 'v'
),
function_metadata as (
  select
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_userbyid(p.proowner) as owner_name,
    p.prosecdef as security_definer,
    p.proacl::text as raw_acl,
    pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'next_bodygate_receipt_number',
      'next_bodygate_receipt_number_v2'
    )
),
sections as (
  select
    1 as section_order,
    'VIEW_METADATA'::text as section_code,
    coalesce(
      (select jsonb_agg(to_jsonb(x) order by x.object_name) from view_metadata x),
      '[]'::jsonb
    ) as payload

  union all

  select
    2,
    'FUNCTION_METADATA',
    coalesce(
      (select jsonb_agg(to_jsonb(x) order by x.function_name, x.arguments) from function_metadata x),
      '[]'::jsonb
    )
)
select section_order, section_code, payload
from sections
order by section_order;
