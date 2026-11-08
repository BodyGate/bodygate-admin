-- BodyGate BASELINE 4/4: trigger, viste, RLS, policy, privilegi, storage.
-- Generato dal database di produzione (progetto BodyGate) il 2026-11-08,
-- dopo HOTFIX 0.4 (chiusura accesso anon/authenticated).

-- Trigger
CREATE TRIGGER bodygate_live_signal AFTER INSERT OR DELETE OR UPDATE ON public.access_logs FOR EACH STATEMENT EXECUTE FUNCTION public.bodygate_notify_change();
CREATE TRIGGER bodygate_live_signal AFTER INSERT OR DELETE OR UPDATE ON public.audit_logs FOR EACH STATEMENT EXECUTE FUNCTION public.bodygate_notify_change();
CREATE TRIGGER bodygate_live_signal AFTER INSERT OR DELETE OR UPDATE ON public.customer_access_logs FOR EACH STATEMENT EXECUTE FUNCTION public.bodygate_notify_change();
CREATE TRIGGER bodygate_live_signal AFTER INSERT OR DELETE OR UPDATE ON public.customer_blocks FOR EACH STATEMENT EXECUTE FUNCTION public.bodygate_notify_change();
CREATE TRIGGER bodygate_live_signal AFTER INSERT OR DELETE OR UPDATE ON public.customer_membership_fees FOR EACH STATEMENT EXECUTE FUNCTION public.bodygate_notify_change();
CREATE TRIGGER bodygate_live_signal AFTER INSERT OR DELETE OR UPDATE ON public.customer_subscriptions FOR EACH STATEMENT EXECUTE FUNCTION public.bodygate_notify_change();
CREATE TRIGGER bodygate_live_signal AFTER INSERT OR DELETE OR UPDATE ON public.customers FOR EACH STATEMENT EXECUTE FUNCTION public.bodygate_notify_change();
CREATE TRIGGER bodygate_live_signal AFTER INSERT OR DELETE OR UPDATE ON public.gym_presence FOR EACH STATEMENT EXECUTE FUNCTION public.bodygate_notify_change();
CREATE TRIGGER bodygate_live_signal AFTER INSERT OR DELETE OR UPDATE ON public.payments FOR EACH STATEMENT EXECUTE FUNCTION public.bodygate_notify_change();
CREATE TRIGGER bodygate_live_signal AFTER INSERT OR DELETE OR UPDATE ON public.unknown_badge_logs FOR EACH STATEMENT EXECUTE FUNCTION public.bodygate_notify_change();
CREATE TRIGGER course_bookings_touch_updated_at BEFORE UPDATE ON public.course_bookings FOR EACH ROW EXECUTE FUNCTION public.bodygate_courses_touch_updated_at_v1();
CREATE TRIGGER course_enrollments_touch_updated_at BEFORE UPDATE ON public.course_enrollments FOR EACH ROW EXECUTE FUNCTION public.bodygate_courses_touch_updated_at_v1();
CREATE TRIGGER course_rooms_touch_updated_at BEFORE UPDATE ON public.course_rooms FOR EACH ROW EXECUTE FUNCTION public.bodygate_courses_touch_updated_at_v1();
CREATE TRIGGER course_schedules_touch_updated_at BEFORE UPDATE ON public.course_schedules FOR EACH ROW EXECUTE FUNCTION public.bodygate_courses_touch_updated_at_v1();
CREATE TRIGGER course_sessions_touch_updated_at BEFORE UPDATE ON public.course_sessions FOR EACH ROW EXECUTE FUNCTION public.bodygate_courses_touch_updated_at_v1();
CREATE TRIGGER course_types_touch_updated_at BEFORE UPDATE ON public.course_types FOR EACH ROW EXECUTE FUNCTION public.bodygate_courses_touch_updated_at_v1();
CREATE TRIGGER trg_exercises_updated_at BEFORE UPDATE ON public.exercises FOR EACH ROW EXECUTE FUNCTION public.bodygate_set_updated_at();

-- Viste.
-- ATTENZIONE: bodygate_v2_customers NON e' security_invoker, quindi legge
-- `customers` con i privilegi del proprietario e ignora le RLS. E' inerte solo
-- perche' nessun ruolo pubblico ha SELECT (vedi privilegi sotto). Non
-- concederle mai a anon/authenticated; da convertire in security_invoker o
-- eliminare (vedi docs/SECURITY_HOTFIX_0_4.md).
create or replace view public.bg_v2_customers_crm with (security_invoker = true) as
 SELECT id,
    TRIM(BOTH FROM (COALESCE(first_name, ''::text) || ' '::text) || COALESCE(last_name, ''::text)) AS display_name,
    first_name,
    last_name,
    phone,
    email,
    badge_code,
    subscription_status,
    subscription_expiry,
    medical_certificate_status,
    medical_certificate_end_date,
    is_active,
    created_at,
        CASE
            WHEN is_active = true THEN 'active'::text
            ELSE 'inactive'::text
        END AS access_status
   FROM customers c;

create or replace view public.bodygate_v2_customers as
 SELECT id,
    TRIM(BOTH FROM (COALESCE(first_name, ''::text) || ' '::text) || COALESCE(last_name, ''::text)) AS display_name,
    first_name,
    last_name,
    phone,
    email,
    badge_code,
    subscription_status,
    subscription_expiry,
    medical_certificate_status,
    medical_certificate_end_date,
    is_active,
        CASE
            WHEN is_active = true THEN 'active'::text
            ELSE 'inactive'::text
        END AS access_status
   FROM customers c;

-- Row Level Security: attiva su tutte le 66 tabelle.
alter table public.access_credentials enable row level security;
alter table public.access_logs enable row level security;
alter table public.accounting_entries enable row level security;
alter table public.app_settings enable row level security;
alter table public.app_users enable row level security;
alter table public.audit_logs enable row level security;
alter table public.bodygate_atomic_operations enable row level security;
alter table public.branches enable row level security;
alter table public.course_activity_log enable row level security;
alter table public.course_bookings enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.course_rooms enable row level security;
alter table public.course_schedules enable row level security;
alter table public.course_sessions enable row level security;
alter table public.course_types enable row level security;
alter table public.customer_access_logs enable row level security;
alter table public.customer_activities enable row level security;
alter table public.customer_badges enable row level security;
alter table public.customer_blocks enable row level security;
alter table public.customer_checkins enable row level security;
alter table public.customer_dnake_users enable row level security;
alter table public.customer_documents enable row level security;
alter table public.customer_exercise_records enable row level security;
alter table public.customer_internal_notes enable row level security;
alter table public.customer_membership_fees enable row level security;
alter table public.customer_mobile_passes enable row level security;
alter table public.customer_notifications enable row level security;
alter table public.customer_payments enable row level security;
alter table public.customer_progress_photos enable row level security;
alter table public.customer_receipts enable row level security;
alter table public.customer_subscriptions enable row level security;
alter table public.customer_timeline enable row level security;
alter table public.customers enable row level security;
alter table public.documents enable row level security;
alter table public.exercise_aliases enable row level security;
alter table public.exercise_tags enable row level security;
alter table public.exercise_variants enable row level security;
alter table public.exercises enable row level security;
alter table public.exercises_library enable row level security;
alter table public.gym_presence enable row level security;
alter table public.medical_certificates enable row level security;
alter table public.membership_fee_settings enable row level security;
alter table public.memberships enable row level security;
alter table public.payment_methods enable row level security;
alter table public.payments enable row level security;
alter table public.receipt_counters enable row level security;
alter table public.receipt_sequences enable row level security;
alter table public.staff_access_credentials enable row level security;
alter table public.staff_dnake_users enable row level security;
alter table public.staff_mobile_passes enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.staff_role_permissions enable row level security;
alter table public.staff_roles enable row level security;
alter table public.staff_users enable row level security;
alter table public.subscription_categories enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscription_renewal_operations enable row level security;
alter table public.system_modules enable row level security;
alter table public.training_day_exercises enable row level security;
alter table public.training_program_days enable row level security;
alter table public.training_programs enable row level security;
alter table public.training_services enable row level security;
alter table public.training_templates enable row level security;
alter table public.unknown_badge_logs enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_set_logs enable row level security;

-- Policy (stato dopo HOTFIX 0.4). Nessuna policy di SELECT aperta: tutte le
-- letture passano dal service role. Le policy "No direct ... = false" bloccano
-- le scritture dirette di `authenticated`.
create policy "No direct access credentials delete" on public.access_credentials as PERMISSIVE for DELETE to authenticated using (false);
create policy "No direct access credentials insert" on public.access_credentials as PERMISSIVE for INSERT to authenticated with check (false);
create policy "No direct access credentials update" on public.access_credentials as PERMISSIVE for UPDATE to authenticated using (false);
create policy "No direct access logs delete" on public.customer_access_logs as PERMISSIVE for DELETE to authenticated using (false);
create policy "No direct access logs insert" on public.customer_access_logs as PERMISSIVE for INSERT to authenticated with check (false);
create policy "No direct access logs update" on public.customer_access_logs as PERMISSIVE for UPDATE to authenticated using (false);
create policy "No direct customer blocks delete" on public.customer_blocks as PERMISSIVE for DELETE to authenticated using (false);
create policy "No direct customer blocks insert" on public.customer_blocks as PERMISSIVE for INSERT to authenticated with check (false);
create policy "No direct customer blocks update" on public.customer_blocks as PERMISSIVE for UPDATE to authenticated using (false);
create policy "No direct internal notes delete" on public.customer_internal_notes as PERMISSIVE for DELETE to authenticated using (false);
create policy "No direct internal notes insert" on public.customer_internal_notes as PERMISSIVE for INSERT to authenticated with check (false);
create policy "No direct internal notes update" on public.customer_internal_notes as PERMISSIVE for UPDATE to authenticated using (false);
create policy "No direct membership fees delete" on public.customer_membership_fees as PERMISSIVE for DELETE to authenticated using (false);
create policy "No direct membership fees insert" on public.customer_membership_fees as PERMISSIVE for INSERT to authenticated with check (false);
create policy "No direct membership fees update" on public.customer_membership_fees as PERMISSIVE for UPDATE to authenticated using (false);
create policy "No direct customer subscriptions delete" on public.customer_subscriptions as PERMISSIVE for DELETE to authenticated using (false);
create policy "No direct customer subscriptions insert" on public.customer_subscriptions as PERMISSIVE for INSERT to authenticated with check (false);
create policy "No direct customer subscriptions update" on public.customer_subscriptions as PERMISSIVE for UPDATE to authenticated using (false);
create policy "No direct customer delete" on public.customers as PERMISSIVE for DELETE to authenticated using (false);
create policy "No direct customer insert" on public.customers as PERMISSIVE for INSERT to authenticated with check (false);
create policy "No direct customer update" on public.customers as PERMISSIVE for UPDATE to authenticated using (false);
create policy "BodyGate can read active exercise library" on public.exercises_library as PERMISSIVE for SELECT to anon, authenticated using ((COALESCE(is_active, true) = true));
create policy "No direct subscription plans delete" on public.subscription_plans as PERMISSIVE for DELETE to authenticated using (false);
create policy "No direct subscription plans insert" on public.subscription_plans as PERMISSIVE for INSERT to authenticated with check (false);
create policy "No direct subscription plans update" on public.subscription_plans as PERMISSIVE for UPDATE to authenticated using (false);

-- Privilegi: anon e authenticated non hanno alcun accesso diretto alle tabelle
-- ne' alle sequenze, oggi e per le tabelle future.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

-- Storage: bucket privati, nessuna policy su storage.objects (accesso solo con
-- service role / URL firmati).
insert into storage.buckets (id, name, public) values
  ('customer-photos', 'customer-photos', false),
  ('documents', 'documents', false),
  ('medical-certificates', 'medical-certificates', false)
on conflict (id) do nothing;
