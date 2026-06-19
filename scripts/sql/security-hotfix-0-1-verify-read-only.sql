-- BodyGate HOTFIX 0.1 — verifica post-applicazione (READ ONLY)
--
-- Nessuna RPC viene eseguita. Nessun dato o schema viene modificato.
-- Il risultato atteso è una sola riga con hotfix_ok = true.

with view_state as (
  select
    c.oid,
    c.reloptions,
    coalesce(
      exists (
        select 1
        from unnest(coalesce(c.reloptions, array[]::text[])) opt
        where opt = 'security_invoker=true'
      ),
      false
    ) as security_invoker_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'bg_v2_customers_crm'
    and c.relkind = 'v'
),
function_state as (
  select
    p.proname as function_name,
    p.oid,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
    has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'next_bodygate_receipt_number',
      'next_bodygate_receipt_number_v2'
    )
),
checks as (
  select
    (select security_invoker_enabled from view_state) as view_security_invoker,
    has_table_privilege('anon', 'public.bg_v2_customers_crm', 'SELECT') as anon_view_select,
    has_table_privilege('anon', 'public.bg_v2_customers_crm', 'INSERT') as anon_view_insert,
    has_table_privilege('anon', 'public.bg_v2_customers_crm', 'UPDATE') as anon_view_update,
    has_table_privilege('anon', 'public.bg_v2_customers_crm', 'DELETE') as anon_view_delete,
    has_table_privilege('authenticated', 'public.bg_v2_customers_crm', 'SELECT') as authenticated_view_select,
    has_table_privilege('authenticated', 'public.bg_v2_customers_crm', 'INSERT') as authenticated_view_insert,
    has_table_privilege('authenticated', 'public.bg_v2_customers_crm', 'UPDATE') as authenticated_view_update,
    has_table_privilege('authenticated', 'public.bg_v2_customers_crm', 'DELETE') as authenticated_view_delete,
    has_table_privilege('service_role', 'public.bg_v2_customers_crm', 'SELECT') as service_role_view_select,
    has_table_privilege('service_role', 'public.bg_v2_customers_crm', 'INSERT') as service_role_view_insert,
    has_table_privilege('service_role', 'public.bg_v2_customers_crm', 'UPDATE') as service_role_view_update,
    has_table_privilege('service_role', 'public.bg_v2_customers_crm', 'DELETE') as service_role_view_delete,
    coalesce(bool_and(not anon_can_execute), false) as anon_receipt_rpc_blocked,
    coalesce(bool_and(not authenticated_can_execute), false) as authenticated_receipt_rpc_blocked,
    coalesce(bool_and(service_role_can_execute), false) as service_role_receipt_rpc_allowed,
    (select count(*) from function_state) as receipt_rpc_count
  from function_state
)
select
  *,
  (
    view_security_invoker = true
    and anon_view_select = false
    and anon_view_insert = false
    and anon_view_update = false
    and anon_view_delete = false
    and authenticated_view_select = false
    and authenticated_view_insert = false
    and authenticated_view_update = false
    and authenticated_view_delete = false
    and service_role_view_select = true
    and service_role_view_insert = false
    and service_role_view_update = false
    and service_role_view_delete = false
    and anon_receipt_rpc_blocked = true
    and authenticated_receipt_rpc_blocked = true
    and service_role_receipt_rpc_allowed = true
    and receipt_rpc_count = 2
  ) as hotfix_ok
from checks;
