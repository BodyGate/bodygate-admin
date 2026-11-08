-- BodyGate BASELINE (seed): dati di configurazione, nessun dato personale.
-- Estratti dal database di produzione il 2026-11-08 (5 ruoli, 15 permessi,
-- 45 assegnazioni, 5 metodi di pagamento, 8 moduli). Idempotente.
--
-- ATTENZIONE: la matrice ruoli/permessi qui sotto e' FEDELE alla produzione,
-- non una raccomandazione. In produzione `trainer` e `reception` hanno
-- manage_staff e manage_modules, mentre `manager` ha solo i permessi corsi
-- e `commerciale` nessuno. Va rivista prima di venderla a nuovi clienti
-- (vedi docs/SECURITY_HOTFIX_0_4.md, sezione RBAC).

insert into public.staff_roles (role_key, role_name, description, is_system) values
  ('admin',       'Amministrazione', 'Amministrazione BodyGate',                true),
  ('commerciale', 'Commerciale',     'Gestione CRM, pagamenti e rinnovi',       true),
  ('manager',     'Manager',         'Supervisione operativa e analytics',      true),
  ('reception',   'Receptionist',    'Reception BodyGate',                      true),
  ('trainer',     'Istruttore',      'Istruttore BodyGate',                     true)
on conflict (role_key) do nothing;

insert into public.staff_permissions (permission_key, permission_name, category, description) values
  ('edit_customers',         'Modificare Clienti',                      'Clienti',        'Creazione e modifica clienti'),
  ('manage_access',          'Gestire Accessi',                         'Access Control', 'Gestione badge, blocchi e access control'),
  ('manage_course_bookings', 'Gestisci prenotazioni, waitlist e check-in', 'Corsi',      null),
  ('manage_courses',         'Gestisci corsi, sale e programmazioni',   'Corsi',          null),
  ('manage_modules',         'Gestire Moduli',                          'Sistema',        'Attivazione e disattivazione moduli'),
  ('manage_payments',        'Gestire Pagamenti',                       'Pagamenti',      'Creazione e modifica pagamenti'),
  ('manage_staff',           'Gestire Staff',                           'Sistema',        'Gestione ruoli e permessi'),
  ('manage_training',        'Gestire Training',                        'Training',       'Gestione schede e programmi'),
  ('view_access_logs',       'Vedere Accessi',                          'Access Control', 'Visualizzazione storico accessi'),
  ('view_analytics',         'Vedere Analytics',                        'Analytics',      'Accesso report e statistiche'),
  ('view_courses',           'Visualizza corsi e calendario',           'Corsi',          null),
  ('view_customers',         'Vedere Clienti',                          'Clienti',        'Accesso elenco e schede clienti'),
  ('view_dashboard',         'Vedere Dashboard',                        'Dashboard',      'Accesso alla dashboard principale'),
  ('view_notifications',     'Vedere Notifiche',                        'Notifiche',      'Accesso Notification Center'),
  ('view_payments',          'Vedere Pagamenti',                        'Pagamenti',      'Visualizzazione pagamenti')
on conflict (permission_key) do nothing;

-- Matrice ruolo -> permessi (45 assegnazioni).
with matrix(role_key, permission_key) as (
  values
    -- admin: tutti i 15 permessi
    ('admin','edit_customers'),('admin','manage_access'),('admin','manage_course_bookings'),
    ('admin','manage_courses'),('admin','manage_modules'),('admin','manage_payments'),
    ('admin','manage_staff'),('admin','manage_training'),('admin','view_access_logs'),
    ('admin','view_analytics'),('admin','view_courses'),('admin','view_customers'),
    ('admin','view_dashboard'),('admin','view_notifications'),('admin','view_payments'),
    -- manager: solo area corsi
    ('manager','manage_course_bookings'),('manager','manage_courses'),('manager','view_courses'),
    -- reception: 14 permessi (tutti tranne manage_courses)
    ('reception','edit_customers'),('reception','manage_access'),('reception','manage_course_bookings'),
    ('reception','manage_modules'),('reception','manage_payments'),('reception','manage_staff'),
    ('reception','manage_training'),('reception','view_access_logs'),('reception','view_analytics'),
    ('reception','view_courses'),('reception','view_customers'),('reception','view_dashboard'),
    ('reception','view_notifications'),('reception','view_payments'),
    -- trainer: 13 permessi (tutti tranne manage_courses e manage_course_bookings)
    ('trainer','edit_customers'),('trainer','manage_access'),('trainer','manage_modules'),
    ('trainer','manage_payments'),('trainer','manage_staff'),('trainer','manage_training'),
    ('trainer','view_access_logs'),('trainer','view_analytics'),('trainer','view_courses'),
    ('trainer','view_customers'),('trainer','view_dashboard'),('trainer','view_notifications'),
    ('trainer','view_payments')
)
insert into public.staff_role_permissions (role_id, permission_id)
select r.id, p.id
from matrix m
join public.staff_roles r on r.role_key = m.role_key
join public.staff_permissions p on p.permission_key = m.permission_key
on conflict (role_id, permission_id) do nothing;

insert into public.payment_methods (name, method_key, is_active) values
  ('Bonifico', 'bank_transfer', true),
  ('Carta',    'card',          true),
  ('Contanti', 'cash',          true),
  ('Altro',    'other',         true),
  ('Satispay', 'satispay',      true)
on conflict (method_key) do nothing;

insert into public.system_modules (module_key, module_name, description, is_enabled) values
  ('advanced_payments', 'Pagamenti Avanzati',   'Sistema cassa e pagamenti evoluto',        false),
  ('crm',               'CRM Premium',          'Sistema avanzato gestione clienti',        true),
  ('document_center',   'Document Center',      'Gestione documenti cloud',                 false),
  ('multi_branch',      'Multi Branch',         'Gestione multi palestra',                  false),
  ('notifications',     'Notification Center',  'Sistema notifiche realtime intelligente',  true),
  ('reception_mode',    'Reception Mode',       'Schermata fullscreen reception',           false),
  ('staff_permissions', 'Staff & Permissions',  'Ruoli e permessi utenti',                  true),
  ('training_platform', 'Training Platform',    'Schede allenamento e coaching',            false)
on conflict (module_key) do nothing;
