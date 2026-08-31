-- Course enrollment + course payments foundations.
--
-- Builds on the course booking engine delivered in PR #109 (course_types,
-- course_rooms, course_schedules, course_sessions, course_bookings,
-- course_activity_log — all already RLS-enabled with zero policies, so
-- access is service-role only, same as the rest of the app).
--
-- This migration adds:
--   1. course_enrollments — a standing enrollment to a recurring schedule
--      (e.g. "Pilates every Monday"). It does NOT replace course_bookings:
--      an active enrollment auto-generates the per-session booking via
--      sync_enrollment_bookings_atomic_v1, so the existing session/booking
--      model, capacity checks and waitlist logic are reused unchanged for
--      both enrolled and drop-in customers.
--   2. Payment plumbing reusing the existing customer_payments /
--      payments / customer_receipts / next_bodygate_receipt_number_v2
--      pattern already used by renew_membership_fee_atomic_v1 — no new
--      payment tables, no parallel receipt numbering.
--
-- New atomic operation types are added to the existing
-- bodygate_atomic_operations_type_check allowlist rather than relaxing it,
-- keeping every operation type explicit as the rest of the schema does.

-- ---------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------

ALTER TABLE public.course_types
  ADD COLUMN IF NOT EXISTS default_price numeric(10,2);

ALTER TABLE public.course_bookings
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.customer_payments(id);

CREATE TABLE public.course_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  schedule_id uuid NOT NULL REFERENCES public.course_schedules(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  pricing_mode text NOT NULL CHECK (pricing_mode IN ('fixed', 'per_session')),
  fixed_price numeric(10,2),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_enrollments_fixed_price_required
    CHECK (pricing_mode <> 'fixed' OR fixed_price IS NOT NULL)
);

COMMENT ON TABLE public.course_enrollments IS
  'Iscrizione fissa di un cliente a uno schedule ricorrente. Genera automaticamente le prenotazioni sulle sessioni future via sync_enrollment_bookings_atomic_v1.';

CREATE UNIQUE INDEX course_enrollments_active_unique
  ON public.course_enrollments (schedule_id, customer_id)
  WHERE status = 'active';

CREATE INDEX course_enrollments_customer_idx ON public.course_enrollments (customer_id);
CREATE INDEX course_enrollments_schedule_idx ON public.course_enrollments (schedule_id, status);

ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER course_enrollments_touch_updated_at
  BEFORE UPDATE ON public.course_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.bodygate_courses_touch_updated_at_v1();

ALTER TABLE public.bodygate_atomic_operations
  DROP CONSTRAINT bodygate_atomic_operations_type_check;

ALTER TABLE public.bodygate_atomic_operations
  ADD CONSTRAINT bodygate_atomic_operations_type_check
  CHECK (operation_type = ANY (ARRAY[
    'membership_fee_renewal'::text,
    'platinum_onboarding'::text,
    'course_type_create'::text,
    'course_room_create'::text,
    'course_schedule_create'::text,
    'course_sessions_generate'::text,
    'course_booking_create'::text,
    'course_booking_cancel'::text,
    'course_booking_check_in'::text,
    'course_session_complete'::text,
    'course_session_cancel'::text,
    'course_enrollment_create'::text,
    'course_enrollment_cancel'::text,
    'course_enrollment_sync'::text,
    'course_booking_pay'::text,
    'course_enrollment_payment_renew'::text
  ]));

-- ---------------------------------------------------------------------
-- 2. enroll_customer_course_atomic_v1 / cancel_course_enrollment_atomic_v1
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enroll_customer_course_atomic_v1(
  p_idempotency_key text,
  p_request_hash text,
  p_schedule_id uuid,
  p_customer_id uuid,
  p_pricing_mode text,
  p_fixed_price numeric DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_billing_cycle text DEFAULT 'monthly'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_claim jsonb;
  v_operation_id uuid;
  v_schedule public.course_schedules%rowtype;
  v_course_type public.course_types%rowtype;
  v_customer public.customers%rowtype;
  v_enrollment public.course_enrollments%rowtype;
  v_customer_payment public.customer_payments%rowtype;
  v_payment public.payments%rowtype;
  v_receipt public.customer_receipts%rowtype;
  v_receipt_number_payload jsonb;
  v_description text;
  v_now timestamptz := clock_timestamp();
  v_response jsonb;
begin
  p_pricing_mode := lower(trim(coalesce(p_pricing_mode,'')));
  p_billing_cycle := lower(trim(coalesce(p_billing_cycle,'monthly')));

  if p_pricing_mode not in ('fixed','per_session') then
    raise exception 'BODYGATE_VALIDATION_PRICING_MODE';
  end if;

  if p_pricing_mode = 'fixed' then
    if p_fixed_price is null or p_fixed_price <= 0 then
      raise exception 'BODYGATE_VALIDATION_FIXED_PRICE';
    end if;

    p_payment_method := lower(trim(coalesce(p_payment_method,'')));

    if p_payment_method not in ('cash','pos','bank_transfer') then
      raise exception 'BODYGATE_VALIDATION_PAYMENT_METHOD';
    end if;

    if p_billing_cycle not in ('monthly','quarterly','annual') then
      raise exception 'BODYGATE_VALIDATION_BILLING_CYCLE';
    end if;
  end if;

  v_claim := public.bodygate_courses_claim_operation_v1(
    'course_enrollment_create', p_idempotency_key, p_request_hash, p_customer_id
  );
  if (v_claim->>'replayed')::boolean then return v_claim->'response'; end if;
  v_operation_id := (v_claim->>'operation_id')::uuid;

  select * into v_schedule
  from public.course_schedules where id=p_schedule_id for update;
  if not found then raise exception 'BODYGATE_COURSE_SCHEDULE_NOT_FOUND'; end if;
  if v_schedule.status <> 'active' then raise exception 'BODYGATE_COURSE_SCHEDULE_NOT_ACTIVE'; end if;

  select * into v_course_type
  from public.course_types
  where id=v_schedule.course_type_id and is_active and booking_enabled;
  if not found then raise exception 'BODYGATE_COURSE_BOOKING_DISABLED'; end if;

  select * into v_customer
  from public.customers
  where id=p_customer_id and coalesce(is_active,true) and coalesce(active,true);
  if not found then raise exception 'BODYGATE_CUSTOMER_NOT_ACTIVE'; end if;
  if v_customer.branch_id is null then raise exception 'BODYGATE_CUSTOMER_BRANCH_REQUIRED'; end if;
  if v_customer.branch_id <> v_schedule.branch_id then raise exception 'BODYGATE_CUSTOMER_BRANCH_MISMATCH'; end if;

  if v_course_type.requires_medical_certificate then
    if coalesce(v_customer.medical_certificate_status,'missing') <> 'valid'
       or v_customer.medical_certificate_end_date is null
       or v_customer.medical_certificate_end_date < v_now::date then
      raise exception 'BODYGATE_MEDICAL_CERTIFICATE_NOT_VALID';
    end if;
  end if;

  if v_course_type.requires_active_subscription and not exists (
    select 1 from public.customer_subscriptions cs
    where cs.customer_id=p_customer_id
      and cs.starts_at <= v_now::date
      and cs.ends_at >= v_now::date
      and cs.is_active=true
  ) then
    raise exception 'BODYGATE_ACTIVE_SUBSCRIPTION_REQUIRED';
  end if;

  if exists (
    select 1 from public.course_enrollments
    where schedule_id=p_schedule_id and customer_id=p_customer_id and status='active'
  ) then
    raise exception 'BODYGATE_COURSE_ENROLLMENT_ALREADY_ACTIVE';
  end if;

  insert into public.course_enrollments (
    branch_id, schedule_id, customer_id, status, pricing_mode, fixed_price,
    billing_cycle, enrolled_at
  ) values (
    v_schedule.branch_id, p_schedule_id, p_customer_id, 'active', p_pricing_mode,
    case when p_pricing_mode='fixed' then p_fixed_price else null end,
    p_billing_cycle, v_now
  ) returning * into v_enrollment;

  v_description := 'Iscrizione corso ' || v_course_type.name;

  if p_pricing_mode = 'fixed' then
    insert into public.customer_payments (
      customer_id, amount, type, description, payment_method, status, paid_at, notes
    ) values (
      p_customer_id, p_fixed_price, 'course_enrollment', v_description, p_payment_method,
      'paid', v_now, 'Ciclo di fatturazione: ' || p_billing_cycle
    ) returning * into v_customer_payment;

    insert into public.payments (
      customer_id, payment_method_id, amount, payment_type, description, status, paid_at, created_by
    ) values (
      p_customer_id, null, p_fixed_price, 'course_enrollment', v_description, 'paid', v_now, 'admin@bodygate.it'
    ) returning * into v_payment;

    v_receipt_number_payload := public.next_bodygate_receipt_number_v2();

    if v_receipt_number_payload is null
       or nullif(v_receipt_number_payload->>'receipt_number','') is null then
      raise exception 'BODYGATE_RECEIPT_NUMBER_INVALID';
    end if;

    insert into public.customer_receipts (
      customer_id, payment_id, receipt_year, receipt_sequence, receipt_number, receipt_type,
      amount, description, customer_copy_label, gym_copy_label, issued_at
    ) values (
      p_customer_id, v_customer_payment.id,
      (v_receipt_number_payload->>'receipt_year')::integer,
      (v_receipt_number_payload->>'receipt_sequence')::integer,
      v_receipt_number_payload->>'receipt_number',
      'course_enrollment', p_fixed_price, v_description,
      'COPIA CLIENTE', 'COPIA PALESTRA', v_now
    ) returning * into v_receipt;
  end if;

  insert into public.course_activity_log (
    branch_id, course_type_id, schedule_id, customer_id, event_type, payload
  ) values (
    v_schedule.branch_id, v_schedule.course_type_id, p_schedule_id, p_customer_id,
    'course_enrollment_created',
    jsonb_build_object('enrollment_id', v_enrollment.id, 'pricing_mode', p_pricing_mode)
  );

  insert into public.customer_timeline (customer_id, type, title, description)
  values (
    p_customer_id, 'course_enrollment_created', 'Iscrizione corso attivata',
    v_description || case when v_receipt.id is not null then ' - ricevuta ' || v_receipt.receipt_number else '' end
  );

  v_response := jsonb_build_object(
    'ok', true,
    'enrollment', to_jsonb(v_enrollment),
    'customer_payment', to_jsonb(v_customer_payment),
    'receipt', to_jsonb(v_receipt)
  );
  return public.bodygate_courses_complete_operation_v1(v_operation_id, v_response);
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_course_enrollment_atomic_v1(
  p_idempotency_key text,
  p_request_hash text,
  p_enrollment_id uuid,
  p_reason text DEFAULT NULL,
  p_cancel_future_bookings boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_claim jsonb;
  v_operation_id uuid;
  v_enrollment public.course_enrollments%rowtype;
  v_booking record;
  v_session public.course_sessions%rowtype;
  v_course_type public.course_types%rowtype;
  v_promoted public.course_bookings%rowtype;
  v_cancelled_booking_ids uuid[] := '{}';
  v_now timestamptz := clock_timestamp();
  v_response jsonb;
begin
  select * into v_enrollment from public.course_enrollments where id=p_enrollment_id;
  if not found then raise exception 'BODYGATE_COURSE_ENROLLMENT_NOT_FOUND'; end if;

  v_claim := public.bodygate_courses_claim_operation_v1(
    'course_enrollment_cancel', p_idempotency_key, p_request_hash, v_enrollment.customer_id
  );
  if (v_claim->>'replayed')::boolean then return v_claim->'response'; end if;
  v_operation_id := (v_claim->>'operation_id')::uuid;

  select * into v_enrollment from public.course_enrollments where id=p_enrollment_id for update;
  if v_enrollment.status = 'cancelled' then raise exception 'BODYGATE_COURSE_ENROLLMENT_ALREADY_CANCELLED'; end if;

  update public.course_enrollments
  set status='cancelled', cancelled_at=v_now, cancellation_reason=nullif(trim(p_reason),'')
  where id=p_enrollment_id
  returning * into v_enrollment;

  if p_cancel_future_bookings then
    for v_booking in
      select b.* from public.course_bookings b
      join public.course_sessions s on s.id = b.session_id
      where s.schedule_id = v_enrollment.schedule_id
        and b.customer_id = v_enrollment.customer_id
        and b.booking_source = 'enrollment'
        and b.status in ('confirmed','waitlisted')
        and s.starts_at > v_now
      order by s.starts_at
    loop
      select * into v_session from public.course_sessions where id=v_booking.session_id for update;
      select * into v_course_type from public.course_types where id=v_session.course_type_id;

      update public.course_bookings
      set status='cancelled', waitlist_position=null, cancelled_at=v_now,
          late_cancellation=false, cancellation_reason='Iscrizione annullata'
      where id=v_booking.id;

      v_cancelled_booking_ids := v_cancelled_booking_ids || v_booking.id;

      if v_booking.status = 'confirmed' then
        select * into v_promoted
        from public.course_bookings
        where session_id=v_session.id and status='waitlisted'
        order by booked_at, id
        limit 1
        for update skip locked;

        if v_promoted.id is not null then
          update public.course_bookings
          set status='confirmed', waitlist_position=null, confirmed_at=v_now
          where id=v_promoted.id;

          insert into public.customer_timeline(customer_id,type,title,description)
          values (
            v_promoted.customer_id, 'course_booking_promoted', 'Promosso dalla lista d''attesa',
            'Sessione ' || v_session.id::text || ' - ' ||
            to_char(v_session.starts_at at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI')
          );
        end if;
      end if;

      with ranked as (
        select id, row_number() over (order by booked_at, id) as rn
        from public.course_bookings
        where session_id=v_session.id and status='waitlisted'
      )
      update public.course_bookings b
      set waitlist_position = r.rn
      from ranked r where b.id = r.id;

      insert into public.course_activity_log (
        branch_id, course_type_id, session_id, booking_id, customer_id, event_type, payload
      ) values (
        v_session.branch_id, v_session.course_type_id, v_session.id, v_booking.id,
        v_booking.customer_id, 'course_booking_cancelled',
        jsonb_build_object('reason','enrollment_cancelled','enrollment_id', p_enrollment_id)
      );
    end loop;
  end if;

  insert into public.course_activity_log (
    branch_id, course_type_id, schedule_id, customer_id, event_type, payload
  ) values (
    v_enrollment.branch_id, null, v_enrollment.schedule_id, v_enrollment.customer_id,
    'course_enrollment_cancelled',
    jsonb_build_object('enrollment_id', p_enrollment_id, 'cancelled_bookings', to_jsonb(v_cancelled_booking_ids))
  );

  insert into public.customer_timeline (customer_id, type, title, description)
  values (
    v_enrollment.customer_id, 'course_enrollment_cancelled', 'Iscrizione corso annullata',
    coalesce(p_reason, 'Nessun motivo specificato')
  );

  v_response := jsonb_build_object(
    'ok', true,
    'enrollment_id', p_enrollment_id,
    'status', 'cancelled',
    'cancelled_booking_ids', to_jsonb(v_cancelled_booking_ids)
  );
  return public.bodygate_courses_complete_operation_v1(v_operation_id, v_response);
end;
$function$;

-- ---------------------------------------------------------------------
-- 3. sync_enrollment_bookings_atomic_v1
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_enrollment_bookings_atomic_v1(
  p_idempotency_key text,
  p_request_hash text,
  p_schedule_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_claim jsonb;
  v_operation_id uuid;
  v_schedule public.course_schedules%rowtype;
  v_course_type public.course_types%rowtype;
  v_enrollment record;
  v_session record;
  v_occupied integer;
  v_status text;
  v_waitlist_position integer;
  v_booking public.course_bookings%rowtype;
  v_created_ids uuid[] := '{}';
  v_now timestamptz := clock_timestamp();
  v_response jsonb;
begin
  select * into v_schedule from public.course_schedules where id=p_schedule_id;
  if not found then raise exception 'BODYGATE_COURSE_SCHEDULE_NOT_FOUND'; end if;

  v_claim := public.bodygate_courses_claim_operation_v1(
    'course_enrollment_sync', p_idempotency_key, p_request_hash, null
  );
  if (v_claim->>'replayed')::boolean then return v_claim->'response'; end if;
  v_operation_id := (v_claim->>'operation_id')::uuid;

  select * into v_course_type from public.course_types where id=v_schedule.course_type_id;

  for v_session in
    select * from public.course_sessions
    where schedule_id = p_schedule_id
      and status = 'open'
      and starts_at > v_now
    order by starts_at
    for update
  loop
    for v_enrollment in
      select * from public.course_enrollments
      where schedule_id = p_schedule_id and status = 'active'
      order by enrolled_at
    loop
      continue when exists (
        select 1 from public.course_bookings
        where session_id = v_session.id and customer_id = v_enrollment.customer_id
      );

      select count(*) into v_occupied
      from public.course_bookings
      where session_id = v_session.id and status in ('confirmed','attended');

      if v_occupied < v_session.capacity then
        v_status := 'confirmed';
        v_waitlist_position := null;
      elsif v_course_type.waitlist_enabled then
        v_status := 'waitlisted';
        select coalesce(max(waitlist_position),0)+1 into v_waitlist_position
        from public.course_bookings
        where session_id = v_session.id and status='waitlisted';
      else
        continue;
      end if;

      v_booking := null;

      insert into public.course_bookings (
        branch_id, session_id, customer_id, status, waitlist_position, booking_source,
        booked_at, confirmed_at
      ) values (
        v_session.branch_id, v_session.id, v_enrollment.customer_id, v_status, v_waitlist_position,
        'enrollment', v_now, case when v_status='confirmed' then v_now else null end
      )
      on conflict (session_id, customer_id) do nothing
      returning * into v_booking;

      if v_booking.id is not null then
        v_created_ids := v_created_ids || v_booking.id;

        insert into public.course_activity_log (
          branch_id, course_type_id, session_id, booking_id, customer_id, event_type, payload
        ) values (
          v_session.branch_id, v_session.course_type_id, v_session.id, v_booking.id,
          v_enrollment.customer_id,
          case when v_status='confirmed' then 'course_booking_confirmed' else 'course_booking_waitlisted' end,
          jsonb_build_object('source','enrollment','enrollment_id',v_enrollment.id)
        );
      end if;
    end loop;
  end loop;

  v_response := jsonb_build_object(
    'ok', true,
    'schedule_id', p_schedule_id,
    'created_booking_ids', to_jsonb(v_created_ids),
    'created_count', coalesce(array_length(v_created_ids,1), 0)
  );
  return public.bodygate_courses_complete_operation_v1(v_operation_id, v_response);
end;
$function$;

-- ---------------------------------------------------------------------
-- 4. pay_course_booking_atomic_v1 / renew_course_enrollment_payment_atomic_v1
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pay_course_booking_atomic_v1(
  p_idempotency_key text,
  p_request_hash text,
  p_booking_id uuid,
  p_amount numeric,
  p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_claim jsonb;
  v_operation_id uuid;
  v_booking public.course_bookings%rowtype;
  v_session public.course_sessions%rowtype;
  v_course_type public.course_types%rowtype;
  v_customer_payment public.customer_payments%rowtype;
  v_payment public.payments%rowtype;
  v_receipt public.customer_receipts%rowtype;
  v_receipt_number_payload jsonb;
  v_description text;
  v_now timestamptz := clock_timestamp();
  v_response jsonb;
begin
  p_payment_method := lower(trim(coalesce(p_payment_method,'')));
  if p_payment_method not in ('cash','pos','bank_transfer') then
    raise exception 'BODYGATE_VALIDATION_PAYMENT_METHOD';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'BODYGATE_VALIDATION_AMOUNT';
  end if;
  p_amount := round(p_amount::numeric,2);

  select * into v_booking from public.course_bookings where id=p_booking_id;
  if not found then raise exception 'BODYGATE_COURSE_BOOKING_NOT_FOUND'; end if;

  v_claim := public.bodygate_courses_claim_operation_v1(
    'course_booking_pay', p_idempotency_key, p_request_hash, v_booking.customer_id
  );
  if (v_claim->>'replayed')::boolean then return v_claim->'response'; end if;
  v_operation_id := (v_claim->>'operation_id')::uuid;

  select * into v_booking from public.course_bookings where id=p_booking_id for update;
  if v_booking.status not in ('confirmed','attended') then
    raise exception 'BODYGATE_COURSE_BOOKING_NOT_PAYABLE';
  end if;
  if v_booking.payment_id is not null then
    raise exception 'BODYGATE_COURSE_BOOKING_ALREADY_PAID';
  end if;

  select * into v_session from public.course_sessions where id=v_booking.session_id;
  select * into v_course_type from public.course_types where id=v_session.course_type_id;

  v_description := 'Prenotazione corso ' || v_course_type.name || ' - ' ||
    to_char(v_session.starts_at at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI');

  insert into public.customer_payments (
    customer_id, amount, type, description, payment_method, status, paid_at
  ) values (
    v_booking.customer_id, p_amount, 'course_session', v_description, p_payment_method, 'paid', v_now
  ) returning * into v_customer_payment;

  insert into public.payments (
    customer_id, payment_method_id, amount, payment_type, description, status, paid_at, created_by
  ) values (
    v_booking.customer_id, null, p_amount, 'course_session', v_description, 'paid', v_now, 'admin@bodygate.it'
  ) returning * into v_payment;

  v_receipt_number_payload := public.next_bodygate_receipt_number_v2();
  if v_receipt_number_payload is null or nullif(v_receipt_number_payload->>'receipt_number','') is null then
    raise exception 'BODYGATE_RECEIPT_NUMBER_INVALID';
  end if;

  insert into public.customer_receipts (
    customer_id, payment_id, receipt_year, receipt_sequence, receipt_number, receipt_type,
    amount, description, customer_copy_label, gym_copy_label, issued_at
  ) values (
    v_booking.customer_id, v_customer_payment.id,
    (v_receipt_number_payload->>'receipt_year')::integer,
    (v_receipt_number_payload->>'receipt_sequence')::integer,
    v_receipt_number_payload->>'receipt_number',
    'course_session', p_amount, v_description,
    'COPIA CLIENTE', 'COPIA PALESTRA', v_now
  ) returning * into v_receipt;

  update public.course_bookings set payment_id = v_customer_payment.id where id=p_booking_id;

  insert into public.course_activity_log (
    branch_id, course_type_id, session_id, booking_id, customer_id, event_type, payload
  ) values (
    v_session.branch_id, v_session.course_type_id, v_session.id, p_booking_id, v_booking.customer_id,
    'course_booking_paid', jsonb_build_object('amount', p_amount, 'receipt_number', v_receipt.receipt_number)
  );

  insert into public.customer_timeline (customer_id, type, title, description)
  values (
    v_booking.customer_id, 'course_payment', 'Pagamento corso registrato',
    v_description || ' - ricevuta ' || v_receipt.receipt_number
  );

  v_response := jsonb_build_object(
    'ok', true,
    'booking_id', p_booking_id,
    'customer_payment', to_jsonb(v_customer_payment),
    'receipt', to_jsonb(v_receipt)
  );
  return public.bodygate_courses_complete_operation_v1(v_operation_id, v_response);
end;
$function$;

CREATE OR REPLACE FUNCTION public.renew_course_enrollment_payment_atomic_v1(
  p_idempotency_key text,
  p_request_hash text,
  p_enrollment_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_period_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_claim jsonb;
  v_operation_id uuid;
  v_enrollment public.course_enrollments%rowtype;
  v_schedule public.course_schedules%rowtype;
  v_course_type public.course_types%rowtype;
  v_customer_payment public.customer_payments%rowtype;
  v_payment public.payments%rowtype;
  v_receipt public.customer_receipts%rowtype;
  v_receipt_number_payload jsonb;
  v_description text;
  v_now timestamptz := clock_timestamp();
  v_response jsonb;
begin
  p_payment_method := lower(trim(coalesce(p_payment_method,'')));
  if p_payment_method not in ('cash','pos','bank_transfer') then
    raise exception 'BODYGATE_VALIDATION_PAYMENT_METHOD';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'BODYGATE_VALIDATION_AMOUNT';
  end if;
  p_amount := round(p_amount::numeric,2);
  if nullif(trim(coalesce(p_period_label,'')),'') is null then
    raise exception 'BODYGATE_VALIDATION_PERIOD_LABEL';
  end if;

  select * into v_enrollment from public.course_enrollments where id=p_enrollment_id;
  if not found then raise exception 'BODYGATE_COURSE_ENROLLMENT_NOT_FOUND'; end if;

  v_claim := public.bodygate_courses_claim_operation_v1(
    'course_enrollment_payment_renew', p_idempotency_key, p_request_hash, v_enrollment.customer_id
  );
  if (v_claim->>'replayed')::boolean then return v_claim->'response'; end if;
  v_operation_id := (v_claim->>'operation_id')::uuid;

  select * into v_enrollment from public.course_enrollments where id=p_enrollment_id for update;
  if v_enrollment.status <> 'active' then raise exception 'BODYGATE_COURSE_ENROLLMENT_NOT_ACTIVE'; end if;
  if v_enrollment.pricing_mode <> 'fixed' then raise exception 'BODYGATE_COURSE_ENROLLMENT_NOT_FIXED_PRICING'; end if;

  select * into v_schedule from public.course_schedules where id=v_enrollment.schedule_id;
  select * into v_course_type from public.course_types where id=v_schedule.course_type_id;

  v_description := 'Iscrizione corso ' || v_course_type.name || ' - ' || trim(p_period_label);

  insert into public.customer_payments (
    customer_id, amount, type, description, payment_method, status, paid_at
  ) values (
    v_enrollment.customer_id, p_amount, 'course_enrollment', v_description, p_payment_method, 'paid', v_now
  ) returning * into v_customer_payment;

  insert into public.payments (
    customer_id, payment_method_id, amount, payment_type, description, status, paid_at, created_by
  ) values (
    v_enrollment.customer_id, null, p_amount, 'course_enrollment', v_description, 'paid', v_now, 'admin@bodygate.it'
  ) returning * into v_payment;

  v_receipt_number_payload := public.next_bodygate_receipt_number_v2();
  if v_receipt_number_payload is null or nullif(v_receipt_number_payload->>'receipt_number','') is null then
    raise exception 'BODYGATE_RECEIPT_NUMBER_INVALID';
  end if;

  insert into public.customer_receipts (
    customer_id, payment_id, receipt_year, receipt_sequence, receipt_number, receipt_type,
    amount, description, customer_copy_label, gym_copy_label, issued_at
  ) values (
    v_enrollment.customer_id, v_customer_payment.id,
    (v_receipt_number_payload->>'receipt_year')::integer,
    (v_receipt_number_payload->>'receipt_sequence')::integer,
    v_receipt_number_payload->>'receipt_number',
    'course_enrollment', p_amount, v_description,
    'COPIA CLIENTE', 'COPIA PALESTRA', v_now
  ) returning * into v_receipt;

  insert into public.course_activity_log (
    branch_id, course_type_id, schedule_id, customer_id, event_type, payload
  ) values (
    v_enrollment.branch_id, v_schedule.course_type_id, v_enrollment.schedule_id, v_enrollment.customer_id,
    'course_enrollment_payment_renewed',
    jsonb_build_object('enrollment_id', p_enrollment_id, 'amount', p_amount, 'period_label', p_period_label)
  );

  insert into public.customer_timeline (customer_id, type, title, description)
  values (
    v_enrollment.customer_id, 'course_payment', 'Rinnovo pagamento iscrizione corso',
    v_description || ' - ricevuta ' || v_receipt.receipt_number
  );

  v_response := jsonb_build_object(
    'ok', true,
    'enrollment_id', p_enrollment_id,
    'customer_payment', to_jsonb(v_customer_payment),
    'receipt', to_jsonb(v_receipt)
  );
  return public.bodygate_courses_complete_operation_v1(v_operation_id, v_response);
end;
$function$;
