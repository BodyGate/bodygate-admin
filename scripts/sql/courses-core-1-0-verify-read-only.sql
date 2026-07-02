-- BodyGate Courses Core 1.0 - VERIFY READ ONLY
-- Eseguire dopo la migration.

with required_tables(table_name) as (
  values
    ('course_types'),
    ('course_rooms'),
    ('course_schedules'),
    ('course_sessions'),
    ('course_bookings'),
    ('course_activity_log')
),
required_functions(function_name) as (
  values
    ('create_course_type_atomic_v1'),
    ('create_course_room_atomic_v1'),
    ('create_course_schedule_atomic_v1'),
    ('generate_course_sessions_atomic_v1'),
    ('book_course_session_atomic_v1'),
    ('cancel_course_booking_atomic_v1'),
    ('check_in_course_booking_atomic_v1'),
    ('complete_course_session_atomic_v1'),
    ('cancel_course_session_atomic_v1')
),
table_status as (
  select
    rt.table_name,
    to_regclass('public.' || rt.table_name) is not null as exists,
    coalesce(c.relrowsecurity,false) as rls_enabled
  from required_tables rt
  left join pg_class c on c.oid = to_regclass('public.' || rt.table_name)
),
function_status as (
  select
    rf.function_name,
    exists(
      select 1
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=rf.function_name
    ) as exists,
    coalesce((
      select p.prosecdef
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=rf.function_name
      limit 1
    ),false) as security_definer
  from required_functions rf
),
counts as (
  select
    (select count(*) from public.course_types) as course_types_count,
    (select count(*) from public.course_rooms) as course_rooms_count,
    (select count(*) from public.course_schedules) as schedules_count,
    (select count(*) from public.course_sessions) as sessions_count,
    (select count(*) from public.course_bookings) as bookings_count,
    (select count(*) from public.course_activity_log) as activity_count
),
ops as (
  select
    count(*) filter (where operation_type like 'course_%') as course_operations,
    count(*) filter (where operation_type like 'course_%' and status='processing') as processing_operations
  from public.bodygate_atomic_operations
)
select
  (select bool_and(exists and rls_enabled) from table_status) as tables_ok,
  (select jsonb_agg(to_jsonb(table_status) order by table_name) from table_status) as tables,
  (select bool_and(exists and security_definer) from function_status) as functions_ok,
  (select jsonb_agg(to_jsonb(function_status) order by function_name) from function_status) as functions,
  to_jsonb(counts) as row_counts,
  to_jsonb(ops) as operation_counts,
  (
    (select bool_and(exists and rls_enabled) from table_status)
    and
    (select bool_and(exists and security_definer) from function_status)
    and
    (select processing_operations=0 from ops)
  ) as hotfix_ok
from counts, ops;
