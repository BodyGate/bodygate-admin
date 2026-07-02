-- BodyGate ATOMIC OPERATIONS 0.4
-- Verifica post-migration READ ONLY.
--
-- Non modifica dati o schema e non richiama la RPC operativa.

with function_oid as (
  select to_regprocedure(
    'public.create_platinum_atomic_v1(text,text,jsonb)'
  ) as oid
),

function_metadata as (
  select
    p.oid,
    p.prosecdef as security_definer,
    p.proconfig,
    has_function_privilege('anon', p.oid, 'EXECUTE')
      as anon_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE')
      as authenticated_execute,
    has_function_privilege('service_role', p.oid, 'EXECUTE')
      as service_role_execute
  from function_oid f
  join pg_proc p on p.oid = f.oid
),

table_metadata as (
  select
    c.relrowsecurity as rls_enabled,
    has_table_privilege(
      'anon',
      'public.bodygate_atomic_operations',
      'SELECT'
    ) as anon_select,
    has_table_privilege(
      'authenticated',
      'public.bodygate_atomic_operations',
      'SELECT'
    ) as authenticated_select,
    has_table_privilege(
      'service_role',
      'public.bodygate_atomic_operations',
      'SELECT'
    ) as service_role_select
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'bodygate_atomic_operations'
),

operation_counts as (
  select
    count(*) filter (
      where operation_type = 'platinum_onboarding'
    ) as onboarding_operation_count,
    count(*) filter (
      where operation_type = 'platinum_onboarding'
        and status = 'processing'
    ) as onboarding_processing_count,
    count(*) filter (
      where operation_type = 'platinum_onboarding'
        and status = 'completed'
    ) as onboarding_completed_count
  from public.bodygate_atomic_operations
),

result as (
  select
    to_regclass('public.bodygate_atomic_operations') is not null
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
    oc.onboarding_operation_count,
    oc.onboarding_processing_count,
    oc.onboarding_completed_count
  from function_oid f
  left join function_metadata fm on fm.oid = f.oid
  cross join table_metadata tm
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
    and onboarding_processing_count = 0
  ) as hotfix_ok
from result;