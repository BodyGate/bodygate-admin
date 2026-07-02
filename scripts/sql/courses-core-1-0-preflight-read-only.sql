-- BodyGate Courses Core 1.0 - PRE-FLIGHT READ ONLY
-- Non modifica dati o schema.

with required_tables(table_name) as (
  values
    ('branches'),
    ('customers'),
    ('staff_users'),
    ('customer_timeline'),
    ('customer_subscriptions'),
    ('bodygate_atomic_operations')
),
missing_tables as (
  select rt.table_name
  from required_tables rt
  where to_regclass('public.' || rt.table_name) is null
),
required_columns(table_name, column_name) as (
  values
    ('branches','id'),
    ('branches','is_active'),
    ('customers','id'),
    ('customers','branch_id'),
    ('customers','is_active'),
    ('customers','medical_certificate_status'),
    ('customers','medical_certificate_end_date'),
    ('staff_users','id'),
    ('staff_users','is_active'),
    ('customer_timeline','customer_id'),
    ('customer_timeline','type'),
    ('customer_timeline','title'),
    ('customer_timeline','description'),
    ('customer_subscriptions','customer_id'),
    ('customer_subscriptions','starts_at'),
    ('customer_subscriptions','ends_at'),
    ('customer_subscriptions','is_active'),
    ('bodygate_atomic_operations','operation_type'),
    ('bodygate_atomic_operations','idempotency_key'),
    ('bodygate_atomic_operations','request_hash'),
    ('bodygate_atomic_operations','customer_id'),
    ('bodygate_atomic_operations','status'),
    ('bodygate_atomic_operations','response_payload'),
    ('bodygate_atomic_operations','error_message'),
    ('bodygate_atomic_operations','completed_at')
),
missing_columns as (
  select rc.table_name, rc.column_name
  from required_columns rc
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = rc.table_name
      and c.column_name = rc.column_name
  )
),
existing_course_objects as (
  select unnest(array[
    'course_types','course_rooms','course_schedules','course_sessions',
    'course_bookings','course_activity_log'
  ]) as object_name
),
conflicts as (
  select object_name
  from existing_course_objects
  where to_regclass('public.' || object_name) is not null
),
operation_check as (
  select pg_get_constraintdef(c.oid) as definition
  from pg_constraint c
  join pg_class r on r.oid = c.conrelid
  join pg_namespace n on n.oid = r.relnamespace
  where n.nspname='public'
    and r.relname='bodygate_atomic_operations'
    and c.conname='bodygate_atomic_operations_type_check'
)
select
  not exists(select 1 from missing_tables) as all_required_tables_exist,
  coalesce((select jsonb_agg(table_name order by table_name) from missing_tables),'[]'::jsonb) as missing_tables,
  not exists(select 1 from missing_columns) as all_required_columns_exist,
  coalesce((select jsonb_agg(jsonb_build_object('table',table_name,'column',column_name) order by table_name,column_name) from missing_columns),'[]'::jsonb) as missing_columns,
  not exists(select 1 from conflicts) as no_existing_course_tables,
  coalesce((select jsonb_agg(object_name order by object_name) from conflicts),'[]'::jsonb) as conflicting_objects,
  exists(select 1 from pg_extension where extname='btree_gist') as btree_gist_already_installed,
  coalesce((select definition from operation_check limit 1),'MISSING') as atomic_operation_type_check,
  (
    not exists(select 1 from missing_tables)
    and not exists(select 1 from missing_columns)
    and not exists(select 1 from conflicts)
  ) as preflight_ok;
