-- BodyGate Courses Permissions 1.0
-- Registra i permessi del modulo corsi senza assegnarli automaticamente ai ruoli.
-- Gli amministratori BodyGate mantengono il bypass applicativo già esistente.

begin;

insert into public.staff_permissions (
  permission_key,
  permission_name,
  category
)
values
  (
    'view_courses',
    'Visualizza corsi e calendario',
    'Corsi'
  ),
  (
    'manage_courses',
    'Gestisci corsi, sale e programmazioni',
    'Corsi'
  ),
  (
    'manage_course_bookings',
    'Gestisci prenotazioni, waitlist e check-in',
    'Corsi'
  )
on conflict (permission_key) do update
set
  permission_name = excluded.permission_name,
  category = excluded.category;

commit;

select
  permission_key,
  permission_name,
  category
from public.staff_permissions
where permission_key in (
  'view_courses',
  'manage_courses',
  'manage_course_bookings'
)
order by permission_key;
