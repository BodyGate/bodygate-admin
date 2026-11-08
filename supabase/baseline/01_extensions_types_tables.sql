-- BodyGate BASELINE 1/4: estensioni, tipi, sequenze, tabelle.
-- Generato dal database di produzione (progetto BodyGate) il 2026-11-08.
-- Vedi supabase/baseline/README.md per l'ordine di esecuzione.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists btree_gist with schema extensions;

create type public.difficulty_level as enum ('beginner', 'intermediate', 'advanced', 'elite');
create type public.equipment_type as enum ('barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bodyweight', 'band', 'trx', 'med_ball', 'box', 'rack', 'bench', 'pull_up_bar', 'dip_station', 'smith_machine', 'leg_press', 'hack_squat', 'chest_press', 'shoulder_press', 'lat_machine', 'row_machine', 'curl_machine', 'extension_machine', 'curl_bench', 'hyperextension_bench', 'calf_machine', 'hip_thrust_machine', 'sissy_squat', 'multipower', 'crossover', 'pec_deck', 't_bar', 'ercolina', 'pulley');
create type public.exercise_category as enum ('strength', 'cardio', 'mobility', 'plyometric', 'calisthenics');
create type public.force_type as enum ('push', 'pull', 'hinge', 'squat', 'carry', 'rotation', 'lunge', 'extension', 'curl');
create type public.mechanics_type as enum ('compound', 'isolation');
create type public.muscle_group as enum ('chest', 'upper_chest', 'lower_chest', 'back', 'lats', 'traps', 'rhomboids', 'lower_back', 'shoulders', 'front_delt', 'side_delt', 'rear_delt', 'biceps', 'triceps', 'forearms', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'tibialis', 'abs', 'obliques', 'hip_flexors', 'adductors', 'abductors');

create sequence if not exists public.dnake_user_id_seq;

create table public.access_credentials (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  type text not null,
  code text not null,
  status text not null default 'active'::text,
  created_at timestamp with time zone default now(),
  controller_code text,
  is_active boolean not null default true
);

create table public.access_logs (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  credential_code text,
  result text not null,
  reason text,
  created_at timestamp with time zone default now(),
  badge_code text,
  controller_code text,
  allowed boolean default false,
  door integer,
  reader integer,
  event_type integer,
  open_command_sent boolean default false,
  open_sdk_result boolean default false,
  open_warning boolean default false,
  controller_ip text,
  bridge_version text,
  direction text default 'in'::text
);

create table public.accounting_entries (
  id uuid not null default gen_random_uuid(),
  branch_id uuid,
  customer_id uuid,
  direction text not null,
  category text not null,
  description text,
  amount numeric(10,2) not null default 0,
  payment_method text default 'cash'::text,
  entry_date date not null default CURRENT_DATE,
  source text default 'manual'::text,
  source_id uuid,
  attachment_url text,
  operator_name text default 'Operatore'::text,
  created_at timestamp with time zone default now()
);

create table public.app_settings (
  id uuid not null default gen_random_uuid(),
  branch_id uuid,
  setting_key text not null,
  setting_value jsonb not null,
  description text,
  updated_at timestamp with time zone default now()
);

create table public.app_users (
  id uuid not null default gen_random_uuid(),
  email text not null,
  password text not null,
  role text not null default 'admin'::text,
  active boolean not null default true,
  created_at timestamp with time zone default now()
);

create table public.audit_logs (
  id uuid not null default gen_random_uuid(),
  branch_id uuid,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  user_email text,
  created_at timestamp with time zone default now()
);

create table public.bodygate_atomic_operations (
  id uuid not null default gen_random_uuid(),
  operation_type text not null,
  idempotency_key text not null,
  request_hash text not null,
  customer_id uuid,
  status text not null default 'processing'::text,
  membership_fee_id uuid,
  subscription_id uuid,
  customer_payment_id uuid,
  payment_id uuid,
  receipt_id uuid,
  document_id uuid,
  access_credential_id uuid,
  response_payload jsonb,
  error_message text,
  created_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone
);

create table public.branches (
  id uuid not null default gen_random_uuid(),
  name text not null,
  address text,
  city text,
  phone text,
  email text,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table public.course_activity_log (
  id uuid not null default gen_random_uuid(),
  branch_id uuid not null,
  course_type_id uuid,
  schedule_id uuid,
  session_id uuid,
  booking_id uuid,
  customer_id uuid,
  staff_user_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table public.course_bookings (
  id uuid not null default gen_random_uuid(),
  branch_id uuid not null,
  session_id uuid not null,
  customer_id uuid not null,
  status text not null,
  waitlist_position integer,
  booking_source text not null default 'reception'::text,
  booked_at timestamp with time zone not null default now(),
  confirmed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  checked_in_at timestamp with time zone,
  completed_at timestamp with time zone,
  late_cancellation boolean not null default false,
  cancellation_reason text,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  payment_id uuid
);

create table public.course_enrollments (
  id uuid not null default gen_random_uuid(),
  branch_id uuid not null,
  schedule_id uuid not null,
  customer_id uuid not null,
  status text not null default 'active'::text,
  pricing_mode text not null,
  fixed_price numeric(10,2),
  billing_cycle text not null default 'monthly'::text,
  enrolled_at timestamp with time zone not null default now(),
  cancelled_at timestamp with time zone,
  cancellation_reason text,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.course_rooms (
  id uuid not null default gen_random_uuid(),
  branch_id uuid not null,
  name text not null,
  description text,
  capacity integer not null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.course_schedules (
  id uuid not null default gen_random_uuid(),
  branch_id uuid not null,
  course_type_id uuid not null,
  room_id uuid not null,
  instructor_staff_user_id uuid,
  weekday smallint not null,
  start_time time without time zone not null,
  duration_minutes integer not null,
  capacity integer not null,
  valid_from date not null,
  valid_until date,
  generation_horizon_days integer not null default 60,
  status text not null default 'draft'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.course_sessions (
  id uuid not null default gen_random_uuid(),
  branch_id uuid not null,
  course_type_id uuid not null,
  schedule_id uuid,
  room_id uuid not null,
  instructor_staff_user_id uuid,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  capacity integer not null,
  status text not null default 'open'::text,
  booking_opens_at timestamp with time zone,
  booking_closes_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.course_types (
  id uuid not null default gen_random_uuid(),
  branch_id uuid not null,
  name text not null,
  slug text not null,
  description text,
  default_duration_minutes integer not null default 50,
  default_capacity integer not null default 1,
  color text not null default '#dc2626'::text,
  requires_medical_certificate boolean not null default true,
  requires_active_subscription boolean not null default false,
  booking_enabled boolean not null default true,
  waitlist_enabled boolean not null default true,
  cancellation_cutoff_minutes integer not null default 120,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  default_price numeric(10,2)
);

create table public.customer_access_logs (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  branch_id uuid,
  access_time timestamp with time zone default now(),
  was_allowed boolean not null,
  reason text,
  badge_code text,
  created_at timestamp with time zone default now(),
  controller_code text
);

create table public.customer_activities (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  type text not null,
  title text not null,
  description text,
  created_at timestamp with time zone default now()
);

create table public.customer_badges (
  id uuid not null default gen_random_uuid(),
  customer_id uuid not null,
  branch_id uuid,
  badge_code text not null,
  badge_type text default 'controller'::text,
  is_primary boolean default false,
  is_active boolean default true,
  notes text,
  created_at timestamp with time zone default now()
);

create table public.customer_blocks (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  reason text not null,
  block_type text not null default 'manual'::text,
  starts_at timestamp with time zone default now(),
  ends_at timestamp with time zone,
  is_active boolean default true,
  created_by text,
  created_at timestamp with time zone default now()
);

create table public.customer_checkins (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  coach_name text,
  body_weight numeric,
  waist_cm numeric,
  chest_cm numeric,
  hips_cm numeric,
  energy_level integer,
  hunger_level integer,
  sleep_quality integer,
  stress_level integer,
  feedback text,
  coach_notes text,
  status text default 'pending'::text,
  created_at timestamp with time zone default now()
);

create table public.customer_dnake_users (
  id uuid not null default gen_random_uuid(),
  customer_id uuid not null,
  dnake_user_id text not null,
  dnake_name text not null,
  qrcode_timestamp text not null,
  qr_payload text,
  qr_status text default 'active'::text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.customer_documents (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  type text not null default 'contract'::text,
  file_url text not null default 'pending'::text,
  file_path text,
  notes text,
  created_at timestamp with time zone default now(),
  otp_code text,
  otp_expires_at timestamp with time zone,
  signed_at timestamp with time zone,
  signed_ip text,
  signed_user_agent text,
  document_type text default 'contract'::text,
  title text default 'Contratto iscrizione palestra'::text,
  status text default 'generated'::text
);

create table public.customer_exercise_records (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  exercise_id uuid,
  record_type text not null,
  record_value numeric not null,
  load_kg numeric,
  reps integer,
  session_id uuid,
  set_log_id uuid,
  achieved_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

create table public.customer_internal_notes (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  note text not null,
  is_important boolean default false,
  created_by text,
  created_at timestamp with time zone default now()
);

create table public.customer_membership_fees (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  branch_id uuid,
  amount numeric(10,2) not null,
  paid_at timestamp with time zone default now(),
  valid_from date not null default CURRENT_DATE,
  valid_until date not null,
  payment_method text default 'cash'::text,
  notes text,
  created_at timestamp with time zone default now()
);

create table public.customer_mobile_passes (
  id uuid not null default gen_random_uuid(),
  customer_id uuid not null,
  public_token text not null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  last_opened_at timestamp with time zone
);

create table public.customer_notifications (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  type text default 'info'::text,
  title text not null,
  message text,
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

create table public.customer_payments (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  type text not null,
  description text,
  amount numeric(10,2) not null default 0,
  payment_method text,
  paid_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  status text not null default 'paid'::text,
  notes text,
  correction_reason text,
  cancellation_reason text,
  cancelled_at timestamp with time zone,
  updated_at timestamp with time zone default now()
);

create table public.customer_progress_photos (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  checkin_id uuid,
  photo_url text not null,
  pose text,
  created_at timestamp with time zone default now()
);

create table public.customer_receipts (
  id uuid not null default gen_random_uuid(),
  customer_id uuid not null,
  payment_id uuid,
  subscription_id uuid,
  receipt_number text not null,
  receipt_type text not null default 'subscription'::text,
  amount numeric not null default 0,
  description text,
  customer_copy_label text default 'COPIA CLIENTE'::text,
  gym_copy_label text default 'COPIA PALESTRA'::text,
  issued_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  receipt_year integer,
  receipt_sequence integer,
  receipt_components jsonb
);

create table public.customer_subscriptions (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  branch_id uuid,
  plan_id uuid,
  amount numeric(10,2) not null,
  starts_at date not null default CURRENT_DATE,
  ends_at date not null,
  is_active boolean default true,
  payment_method text default 'cash'::text,
  notes text,
  created_at timestamp with time zone default now()
);

create table public.customer_timeline (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  type text not null,
  title text not null,
  description text,
  created_at timestamp with time zone default now()
);

create table public.customers (
  id uuid not null default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  fiscal_code text,
  birth_date date,
  photo_url text,
  status text not null default 'active'::text,
  notes text,
  created_at timestamp with time zone default now(),
  active boolean default true,
  subscription_status text default 'active'::text,
  subscription_expiry timestamp with time zone,
  address text,
  city text,
  emergency_contact text,
  medical_certificate_start date,
  medical_certificate_end date,
  profile_photo text,
  is_active boolean default true,
  branch_id uuid,
  medical_certificate_url text,
  medical_certificate_start_date date,
  medical_certificate_end_date date,
  medical_certificate_status text default 'missing'::text,
  badge_code text,
  controller_code text,
  gender text,
  postal_code text,
  emergency_contact_name text,
  emergency_contact_phone text,
  reception_notes text,
  birth_place text,
  street_number text,
  province text,
  country text default 'Italia'::text,
  document_type text,
  document_number text,
  document_issued_by text,
  document_issued_at date,
  document_expires_at date,
  emergency_contact_relation text,
  profession text,
  fitness_goal text,
  marketing_source text,
  customer_tags text[],
  privacy_consent boolean default false,
  marketing_consent boolean default false,
  photo_video_consent boolean default false,
  onboarding_status text default 'draft'::text,
  contract_status text default 'not_generated'::text,
  payment_status text default 'pending'::text,
  access_activation_status text default 'pending'::text
);

create table public.documents (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  title text not null,
  type text not null default 'generic'::text,
  file_url text not null,
  file_path text,
  file_name text,
  status text not null default 'uploaded'::text,
  signed_at timestamp with time zone,
  expires_at date,
  created_at timestamp with time zone not null default now()
);

create table public.exercise_aliases (
  id uuid not null default gen_random_uuid(),
  exercise_id uuid,
  alias character varying(255) not null
);

create table public.exercise_tags (
  id uuid not null default gen_random_uuid(),
  exercise_id uuid,
  tag character varying(100) not null
);

create table public.exercise_variants (
  id uuid not null default gen_random_uuid(),
  parent_exercise_id uuid,
  variant_exercise_id uuid,
  relationship_type character varying(50) not null default 'variation'::character varying,
  notes text
);

create table public.exercises (
  id uuid not null default gen_random_uuid(),
  name character varying(255) not null,
  slug character varying(255) not null,
  category exercise_category not null default 'strength'::exercise_category,
  muscle_group muscle_group[] not null default '{}'::muscle_group[],
  equipment equipment_type[] default '{}'::equipment_type[],
  difficulty difficulty_level default 'intermediate'::difficulty_level,
  mechanics mechanics_type,
  force_type force_type,
  description text,
  instructions text[] default '{}'::text[],
  tips text[] default '{}'::text[],
  setup_notes text,
  common_mistakes text[] default '{}'::text[],
  thumbnail_url character varying(500),
  video_url character varying(500),
  setup_image_url character varying(500),
  is_unilateral boolean default false,
  is_bodyweight boolean default false,
  requires_spotter boolean default false,
  created_at timestamp without time zone default now(),
  updated_at timestamp without time zone default now(),
  is_active boolean not null default true,
  display_order integer not null default 0,
  media_status character varying(30) not null default 'placeholder'::character varying,
  media_attribution text,
  metadata jsonb not null default '{}'::jsonb,
  machine_brand text,
  machine_name text,
  machine_code text,
  qr_code text
);

create table public.exercises_library (
  id uuid not null default gen_random_uuid(),
  name text not null,
  muscle_group text,
  equipment text,
  difficulty text,
  video_url text,
  image_url text,
  instructions text,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  machine_brand text,
  machine_name text,
  machine_code text,
  qr_code text,
  thumbnail_url text,
  tutorial_video_url text,
  coach_tips text,
  setup_notes text,
  common_mistakes text
);

create table public.gym_presence (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  branch_id uuid,
  badge_code text,
  entered_at timestamp with time zone default now(),
  exited_at timestamp with time zone,
  is_inside boolean default true,
  source text default 'turnstile'::text,
  created_at timestamp with time zone default now()
);

create table public.login_attempts (
  id uuid not null default gen_random_uuid(),
  email text not null,
  ip text not null,
  created_at timestamp with time zone not null default now()
);

create table public.medical_certificates (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  file_url text,
  expiry_date date,
  status text not null default 'pending'::text,
  created_at timestamp with time zone default now(),
  valid_from date,
  valid_until date,
  certificate_type text default 'non_agonistico'::text,
  notes text,
  file_path text,
  file_name text
);

create table public.membership_fee_settings (
  id uuid not null default gen_random_uuid(),
  branch_id uuid,
  name text not null default 'Quota Associativa'::text,
  price numeric(10,2) not null default 10.00,
  validity_days integer not null default 365,
  required_for_access boolean not null default true,
  is_active boolean not null default true,
  created_at timestamp with time zone default now()
);

create table public.memberships (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  payment_id uuid,
  plan_name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'active'::text,
  created_at timestamp with time zone default now()
);

create table public.payment_methods (
  id uuid not null default gen_random_uuid(),
  name text not null,
  method_key text not null,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table public.payments (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  amount numeric(10,2) not null,
  method text,
  paid_at timestamp with time zone default now(),
  notes text,
  subscription_days integer default 30,
  payment_method text,
  description text,
  created_at timestamp with time zone default now(),
  payment_method_id uuid,
  payment_type text default 'subscription'::text,
  status text default 'paid'::text,
  created_by text
);

create table public.receipt_counters (
  year integer not null,
  last_sequence integer not null default 0,
  updated_at timestamp with time zone not null default now()
);

create table public.receipt_sequences (
  year integer not null,
  last_number integer not null default 0,
  updated_at timestamp with time zone default now()
);

create table public.staff_access_credentials (
  id uuid not null default gen_random_uuid(),
  staff_user_id uuid not null,
  type text not null,
  code text not null,
  status text not null default 'active'::text,
  created_at timestamp with time zone not null default now(),
  controller_code text,
  is_active boolean not null default true
);

create table public.staff_dnake_users (
  id uuid not null default gen_random_uuid(),
  staff_user_id uuid not null,
  dnake_user_id text not null,
  dnake_name text,
  qrcode_timestamp text,
  qr_payload text,
  qr_status text not null default 'active'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.staff_mobile_passes (
  id uuid not null default gen_random_uuid(),
  staff_user_id uuid not null,
  public_token text not null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  last_opened_at timestamp with time zone
);

create table public.staff_permissions (
  id uuid not null default gen_random_uuid(),
  permission_key text not null,
  permission_name text not null,
  category text not null,
  description text,
  created_at timestamp with time zone default now()
);

create table public.staff_role_permissions (
  id uuid not null default gen_random_uuid(),
  role_id uuid,
  permission_id uuid,
  created_at timestamp with time zone default now()
);

create table public.staff_roles (
  id uuid not null default gen_random_uuid(),
  role_key text not null,
  role_name text not null,
  description text,
  is_system boolean default false,
  created_at timestamp with time zone default now()
);

create table public.staff_users (
  id uuid not null default gen_random_uuid(),
  full_name text not null,
  email text not null,
  role_id uuid,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  auth_user_id uuid,
  phone text
);

create table public.subscription_categories (
  id uuid not null default gen_random_uuid(),
  branch_id uuid,
  name text not null,
  description text,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table public.subscription_plans (
  id uuid not null default gen_random_uuid(),
  branch_id uuid,
  category_id uuid,
  name text not null,
  price numeric(10,2) not null,
  duration_days integer not null,
  access_allowed boolean default true,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  category text,
  promo_price numeric,
  color text default '#5b3df5'::text,
  is_featured boolean default false,
  auto_renew boolean default false,
  description text
);

create table public.subscription_renewal_operations (
  id uuid not null default gen_random_uuid(),
  idempotency_key text not null,
  request_hash text not null,
  customer_id uuid not null,
  plan_id uuid not null,
  branch_id uuid,
  status text not null default 'processing'::text,
  subscription_id uuid,
  customer_payment_id uuid,
  payment_id uuid,
  receipt_id uuid,
  receipt_number text,
  response_payload jsonb,
  error_message text,
  created_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone
);

create table public.system_modules (
  id uuid not null default gen_random_uuid(),
  module_key text not null,
  module_name text not null,
  description text,
  is_enabled boolean default true,
  created_at timestamp with time zone default now()
);

create table public.training_day_exercises (
  id uuid not null default gen_random_uuid(),
  day_id uuid,
  exercise_id uuid,
  sets text,
  reps text,
  rest text,
  rir text,
  tempo text,
  notes text,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  rest_seconds integer,
  block_type text default 'normal'::text,
  block_label text,
  target_load text,
  progression_rule text,
  is_warmup boolean default false
);

create table public.training_program_days (
  id uuid not null default gen_random_uuid(),
  program_id uuid,
  day_name text not null,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

create table public.training_programs (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  title text not null,
  description text,
  coach_name text,
  goal text,
  is_active boolean default true,
  starts_at date,
  ends_at date,
  created_at timestamp with time zone default now()
);

create table public.training_services (
  id uuid not null default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  price numeric not null default 0,
  duration_days integer,
  trainer_name text,
  is_active boolean default true,
  is_featured boolean default false,
  color text default '#5b3df5'::text,
  created_at timestamp with time zone default now()
);

create table public.training_templates (
  id uuid not null default gen_random_uuid(),
  title text not null,
  description text,
  goal text,
  difficulty text,
  days_per_week integer,
  coach_name text,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table public.unknown_badge_logs (
  id uuid not null default gen_random_uuid(),
  badge_code text not null,
  access_time timestamp with time zone default now(),
  reason text default 'Badge non riconosciuto'::text,
  source text default 'turnstile'::text
);

create table public.workout_sessions (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  program_id uuid,
  day_id uuid,
  status text default 'planned'::text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  duration_minutes integer,
  perceived_effort integer,
  notes text,
  created_at timestamp with time zone default now()
);

create table public.workout_set_logs (
  id uuid not null default gen_random_uuid(),
  session_id uuid,
  exercise_id uuid,
  day_exercise_id uuid,
  set_number integer,
  target_reps text,
  actual_reps integer,
  target_load text,
  actual_load numeric,
  rir text,
  completed boolean default false,
  notes text,
  created_at timestamp with time zone default now()
);
