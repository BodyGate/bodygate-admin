-- BodyGate HOTFIX 0.2
-- Verifica post-migration (READ ONLY).
--
-- Non modifica dati o schema e non richiama la RPC di rinnovo.

with function_oid as (
  select to_regprocedure(
    'public.renew_subscription_atomic_v1(text,text,uuid,uuid,text,date,numeric,text,text,numeric,text,boolean)'
  ) as oid
),

function_metadata as (
  select
    p.oid,
    p.prosecdef as security_definer,
    p.proconfig,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
    has_function_privilege(
      'authenticated',
      p.oid,
      'EXECUTE'
    ) as authenticated_execute,
    has_function_privilege(
      'service_role',
      p.oid,
      'EXECUTE'
    ) as service_role_execute
  from function_oid f
  join pg_proc p on p.oid = f.oid
),

table_metadata as (
  select
    c.relrowsecurity as rls_enabled,
    has_table_privilege(
      'anon',
      'public.subscription_renewal_operations',
      'SELECT'
    ) as anon_select,
    has_table_privilege(
      'authenticated',
      'public.subscription_renewal_operations',
      'SELECT'
    ) as authenticated_select,
    has_table_privilege(
      'service_role',
      'public.subscription_renewal_operations',
      'SELECT'
    ) as service_role_select
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'subscription_renewal_operations'
),

constraints_metadata as (
  select
    count(*) filter (
      where conname =
        'subscription_renewal_operations_idempotency_key_key'
    ) = 1 as idempotency_unique,
    count(*) filter (
      where conname =
        'subscription_renewal_operations_status_check'
    ) = 1 as status_check
  from pg_constraint
  where conrelid =
    'public.subscription_renewal_operations'::regclass
),

operation_counts as (
  select
    count(*) as operation_count,
    count(*) filter (where status = 'processing') as processing_count,
    count(*) filter (where status = 'completed') as completed_count
  from public.subscription_renewal_operations
),

result as (
  select
    to_regclass('public.subscription_renewal_operations') is not null
      as operations_table_exists,
    f.oid is not null as atomic_rpc_exists,
    fm.security_definer,
    coalesce(
      array_to_string(fm.proconfig, ',') like
        '%search_path=public, pg_temp%',
      false
    ) as secure_search_path,
    not fm.anon_execute as anon_rpc_blocked,
    not fm.authenticated_execute as authenticated_rpc_blocked,
    fm.service_role_execute as service_role_rpc_allowed,
    tm.rls_enabled,
    not tm.anon_select as anon_table_blocked,
    not tm.authenticated_select as authenticated_table_blocked,
    tm.service_role_select as service_role_table_read_allowed,
    cm.idempotency_unique,
    cm.status_check,
    oc.operation_count,
    oc.processing_count,
    oc.completed_count
  from function_oid f
  left join function_metadata fm on fm.oid = f.oid
  cross join table_metadata tm
  cross join constraints_metadata cm
  cross join operation_counts oc
)

select
  *,
  (
    operations_table_exists
    and atomic_rpc_exists
    and security_definer
    and secure_search_path
    and anon_rpc_blocked
    and authenticated_rpc_blocked
    and service_role_rpc_allowed
    and rls_enabled
    and anon_table_blocked
    and authenticated_table_blocked
    and service_role_table_read_allowed
    and idempotency_unique
    and status_check
    and processing_count = 0
  ) as hotfix_ok
from result;
