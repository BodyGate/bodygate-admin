-- BodyGate Courses Role Permissions 1.0
-- Assegnazione additiva e idempotente dei permessi corsi.
-- Non rimuove né altera permessi già esistenti.

begin;

with assignments(role_key, permission_key) as (
  values
    ('admin', 'view_courses'),
    ('admin', 'manage_courses'),
    ('admin', 'manage_course_bookings'),

    ('manager', 'view_courses'),
    ('manager', 'manage_courses'),
    ('manager', 'manage_course_bookings'),

    ('reception', 'view_courses'),
    ('reception', 'manage_course_bookings'),

    ('trainer', 'view_courses')
),
resolved as (
  select
    r.id as role_id,
    p.id as permission_id
  from assignments a
  join public.staff_roles r
    on r.role_key = a.role_key
  join public.staff_permissions p
    on p.permission_key = a.permission_key
)
insert into public.staff_role_permissions (
  role_id,
  permission_id
)
select
  resolved.role_id,
  resolved.permission_id
from resolved
where not exists (
  select 1
  from public.staff_role_permissions existing
  where existing.role_id = resolved.role_id
    and existing.permission_id = resolved.permission_id
);

commit;

select
  r.role_key,
  r.role_name,
  p.permission_key
from public.staff_role_permissions rp
join public.staff_roles r
  on r.id = rp.role_id
join public.staff_permissions p
  on p.id = rp.permission_id
where p.permission_key in (
  'view_courses',
  'manage_courses',
  'manage_course_bookings'
)
order by
  r.role_name,
  p.permission_key;
