-- BodyGate BASELINE 3/4: funzioni (RPC atomiche, numerazione ricevute, trigger helper).
-- Generato dal database di produzione (progetto BodyGate) il 2026-11-08 con
-- pg_get_functiondef: e' la definizione effettivamente in esecuzione.
-- Dopo ogni funzione si revoca EXECUTE a public/anon/authenticated: le RPC sono
-- richiamabili solo dal service role. Fanno eccezione i due helper puri
-- bodygate_cf_part_code e bodygate_set_updated_at, eseguibili da tutti come in
-- produzione.
-- Nota: le funzioni qui sono SECURITY DEFINER dove indicato; non modificare
-- search_path o owner senza rivedere la sicurezza.

CREATE OR REPLACE FUNCTION public.bodygate_cf_part_code(input_text text, is_given_name boolean)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  cleaned text;
  ch text;
  consonants text := '';
  vowels text := '';
  i integer;
begin
  cleaned := upper(coalesce(input_text, ''));
  cleaned := translate(
    cleaned,
    'ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÇÑ',
    'AAAAAAEEEEIIIIOOOOOUUUUCN'
  );
  cleaned := regexp_replace(cleaned, '[^A-Z]', '', 'g');

  for i in 1..length(cleaned) loop
    ch := substr(cleaned, i, 1);

    if ch ~ '[BCDFGHJKLMNPQRSTVWXYZ]' then
      consonants := consonants || ch;
    elsif ch ~ '[AEIOU]' then
      vowels := vowels || ch;
    end if;
  end loop;

  if is_given_name and length(consonants) >= 4 then
    return substr(consonants, 1, 1) || substr(consonants, 3, 1) || substr(consonants, 4, 1);
  end if;

  return substr(consonants || vowels || 'XXX', 1, 3);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bodygate_courses_claim_operation_v1(p_operation_type text, p_idempotency_key text, p_request_hash text, p_customer_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_operation public.bodygate_atomic_operations%rowtype;
  v_inserted_id uuid;
begin
  p_idempotency_key := trim(coalesce(p_idempotency_key,''));
  p_request_hash := lower(trim(coalesce(p_request_hash,'')));

  if char_length(p_idempotency_key) < 16
     or char_length(p_idempotency_key) > 180
     or p_idempotency_key !~ '^[A-Za-z0-9:_-]+$' then
    raise exception 'BODYGATE_VALIDATION_IDEMPOTENCY_KEY';
  end if;

  if p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'BODYGATE_VALIDATION_REQUEST_HASH';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bodygate-course-operation:' || p_operation_type || ':' || p_idempotency_key, 0)
  );

  insert into public.bodygate_atomic_operations (
    operation_type, idempotency_key, request_hash, customer_id, status
  )
  values (
    p_operation_type, p_idempotency_key, p_request_hash, p_customer_id, 'processing'
  )
  on conflict (operation_type, idempotency_key) do nothing
  returning id into v_inserted_id;

  select *
  into v_operation
  from public.bodygate_atomic_operations
  where operation_type = p_operation_type
    and idempotency_key = p_idempotency_key
  for update;

  if v_operation.request_hash <> p_request_hash then
    raise exception 'BODYGATE_IDEMPOTENCY_PAYLOAD_MISMATCH';
  end if;

  if v_inserted_id is null and v_operation.status = 'completed' then
    return jsonb_build_object(
      'replayed', true,
      'operation_id', v_operation.id,
      'response', v_operation.response_payload
    );
  end if;

  if v_inserted_id is null then
    raise exception 'BODYGATE_OPERATION_ALREADY_PROCESSING';
  end if;

  return jsonb_build_object(
    'replayed', false,
    'operation_id', v_operation.id
  );
end;
$function$
;
revoke all on function public.bodygate_courses_claim_operation_v1(p_operation_type text, p_idempotency_key text, p_request_hash text, p_customer_id uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bodygate_courses_complete_operation_v1(p_operation_id uuid, p_response jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  update public.bodygate_atomic_operations
  set status='completed',
      response_payload=coalesce(p_response,'{}'::jsonb),
      completed_at=clock_timestamp(),
      error_message=null
  where id=p_operation_id
    and status='processing';

  if not found then
    raise exception 'BODYGATE_OPERATION_NOT_PROCESSING';
  end if;

  return coalesce(p_response,'{}'::jsonb);
end;
$function$
;
revoke all on function public.bodygate_courses_complete_operation_v1(p_operation_id uuid, p_response jsonb) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bodygate_courses_touch_updated_at_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$
;
revoke all on function public.bodygate_courses_touch_updated_at_v1() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bodygate_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.book_course_session_atomic_v1(p_idempotency_key text, p_request_hash text, p_session_id uuid, p_customer_id uuid, p_booking_source text DEFAULT 'reception'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_claim jsonb;
  v_operation_id uuid;
  v_session public.course_sessions%rowtype;
  v_course_type public.course_types%rowtype;
  v_customer public.customers%rowtype;
  v_booking public.course_bookings%rowtype;
  v_occupied integer;
  v_waitlist_position integer;
  v_status text;
  v_now timestamptz := clock_timestamp();
  v_response jsonb;
begin
  v_claim := public.bodygate_courses_claim_operation_v1(
    'course_booking_create', p_idempotency_key, p_request_hash, p_customer_id
  );
  if (v_claim->>'replayed')::boolean then return v_claim->'response'; end if;
  v_operation_id := (v_claim->>'operation_id')::uuid;

  select * into v_session
  from public.course_sessions where id=p_session_id for update;
  if not found then raise exception 'BODYGATE_COURSE_SESSION_NOT_FOUND'; end if;
  if v_session.status <> 'open' then raise exception 'BODYGATE_COURSE_SESSION_NOT_BOOKABLE'; end if;
  if v_session.booking_opens_at is not null and v_now < v_session.booking_opens_at then
    raise exception 'BODYGATE_COURSE_BOOKING_NOT_OPEN';
  end if;
  if v_session.booking_closes_at is not null and v_now > v_session.booking_closes_at then
    raise exception 'BODYGATE_COURSE_BOOKING_CLOSED';
  end if;

  select * into v_course_type
  from public.course_types
  where id=v_session.course_type_id and is_active and booking_enabled;
  if not found then raise exception 'BODYGATE_COURSE_BOOKING_DISABLED'; end if;

  select * into v_customer
  from public.customers
  where id=p_customer_id and coalesce(is_active,true) and coalesce(active,true);
  if not found then raise exception 'BODYGATE_CUSTOMER_NOT_ACTIVE'; end if;
  if v_customer.branch_id is null then raise exception 'BODYGATE_CUSTOMER_BRANCH_REQUIRED'; end if;
  if v_customer.branch_id <> v_session.branch_id then raise exception 'BODYGATE_CUSTOMER_BRANCH_MISMATCH'; end if;

  if v_course_type.requires_medical_certificate then
    if coalesce(v_customer.medical_certificate_status,'missing') <> 'valid'
       or v_customer.medical_certificate_end_date is null
       or v_customer.medical_certificate_end_date < v_session.starts_at::date then
      raise exception 'BODYGATE_MEDICAL_CERTIFICATE_NOT_VALID';
    end if;
  end if;

  if v_course_type.requires_active_subscription and not exists (
    select 1 from public.customer_subscriptions cs
    where cs.customer_id=p_customer_id
      and cs.starts_at <= v_session.starts_at::date
      and cs.ends_at >= v_session.starts_at::date
      and cs.is_active=true
  ) then
    raise exception 'BODYGATE_ACTIVE_SUBSCRIPTION_REQUIRED';
  end if;

  select * into v_booking
  from public.course_bookings
  where session_id=p_session_id and customer_id=p_customer_id
  for update;

  if found and v_booking.status in ('confirmed','waitlisted','attended') then
    raise exception 'BODYGATE_COURSE_ALREADY_BOOKED';
  end if;

  select count(*) into v_occupied
  from public.course_bookings
  where session_id=p_session_id and status in ('confirmed','attended');

  if v_occupied < v_session.capacity then
    v_status := 'confirmed';
    v_waitlist_position := null;
  elsif v_course_type.waitlist_enabled then
    v_status := 'waitlisted';
    select coalesce(max(waitlist_position),0)+1 into v_waitlist_position
    from public.course_bookings
    where session_id=p_session_id and status='waitlisted';
  else
    raise exception 'BODYGATE_COURSE_SESSION_FULL';
  end if;

  if v_booking.id is null then
    insert into public.course_bookings(
      branch_id,session_id,customer_id,status,waitlist_position,booking_source,
      booked_at,confirmed_at,cancelled_at,late_cancellation,cancellation_reason
    ) values (
      v_session.branch_id,p_session_id,p_customer_id,v_status,v_waitlist_position,
      lower(trim(coalesce(p_booking_source,'reception'))),v_now,
      case when v_status='confirmed' then v_now else null end,
      null,false,null
    ) returning * into v_booking;
  else
    update public.course_bookings
    set status=v_status,
        waitlist_position=v_waitlist_position,
        booking_source=lower(trim(coalesce(p_booking_source,'reception'))),
        booked_at=v_now,
        confirmed_at=case when v_status='confirmed' then v_now else null end,
        cancelled_at=null,
        checked_in_at=null,
        completed_at=null,
        late_cancellation=false,
        cancellation_reason=null
    where id=v_booking.id
    returning * into v_booking;
  end if;

  insert into public.course_activity_log(
    branch_id,course_type_id,session_id,booking_id,customer_id,event_type,payload
  ) values (
    v_session.branch_id,v_session.course_type_id,p_session_id,v_booking.id,p_customer_id,
    case when v_status='confirmed' then 'course_booking_confirmed' else 'course_booking_waitlisted' end,
    jsonb_build_object('status',v_status,'waitlist_position',v_waitlist_position,'source',p_booking_source)
  );

  insert into public.customer_timeline(customer_id,type,title,description)
  values (
    p_customer_id,
    case when v_status='confirmed' then 'course_booking_confirmed' else 'course_booking_waitlisted' end,
    case when v_status='confirmed' then 'Prenotazione corso confermata' else 'Inserimento in lista dâ€™attesa' end,
    'Sessione ' || p_session_id::text || ' Â· ' || to_char(v_session.starts_at at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI')
  );

  v_response := jsonb_build_object(
    'ok',true,'booking_id',v_booking.id,'status',v_status,
    'waitlist_position',v_waitlist_position,'session_id',p_session_id,'customer_id',p_customer_id
  );
  return public.bodygate_courses_complete_operation_v1(v_operation_id,v_response);
end;
$function$
;
revoke all on function public.book_course_session_atomic_v1(p_idempotency_key text, p_request_hash text, p_session_id uuid, p_customer_id uuid, p_booking_source text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancel_course_booking_atomic_v1(p_idempotency_key text, p_request_hash text, p_booking_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_booking public.course_bookings%rowtype;
  v_session public.course_sessions%rowtype;
  v_course_type public.course_types%rowtype;
  v_promoted public.course_bookings%rowtype;
  v_claim jsonb;
  v_operation_id uuid;
  v_was_confirmed boolean;
  v_late boolean;
  v_response jsonb;
begin
  select * into v_booking from public.course_bookings where id=p_booking_id;
  if not found then raise exception 'BODYGATE_COURSE_BOOKING_NOT_FOUND'; end if;

  v_claim := public.bodygate_courses_claim_operation_v1(
    'course_booking_cancel', p_idempotency_key, p_request_hash, v_booking.customer_id
  );
  if (v_claim->>'replayed')::boolean then return v_claim->'response'; end if;
  v_operation_id := (v_claim->>'operation_id')::uuid;

  select * into v_session from public.course_sessions where id=v_booking.session_id for update;
  select * into v_booking from public.course_bookings where id=p_booking_id for update;
  select * into v_course_type from public.course_types where id=v_session.course_type_id;

  if v_booking.status='cancelled' then raise exception 'BODYGATE_COURSE_BOOKING_ALREADY_CANCELLED'; end if;
  if v_booking.status in ('attended','no_show') then raise exception 'BODYGATE_COURSE_BOOKING_NOT_CANCELLABLE'; end if;

  v_was_confirmed := v_booking.status='confirmed';
  v_late := clock_timestamp() > (v_session.starts_at - make_interval(mins=>v_course_type.cancellation_cutoff_minutes));

  update public.course_bookings
  set status='cancelled',waitlist_position=null,cancelled_at=clock_timestamp(),
      late_cancellation=v_late,cancellation_reason=nullif(trim(p_reason),'')
  where id=p_booking_id
  returning * into v_booking;

  if v_was_confirmed then
    select * into v_promoted
    from public.course_bookings
    where session_id=v_session.id and status='waitlisted'
    order by booked_at,id
    limit 1
    for update skip locked;

    if v_promoted.id is not null then
      update public.course_bookings
      set status='confirmed',waitlist_position=null,confirmed_at=clock_timestamp()
      where id=v_promoted.id
      returning * into v_promoted;

      insert into public.customer_timeline(customer_id,type,title,description)
      values (
        v_promoted.customer_id,'course_booking_promoted','Promosso dalla lista dâ€™attesa',
        'Sessione ' || v_session.id::text || ' Â· ' ||
        to_char(v_session.starts_at at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI')
      );

      insert into public.course_activity_log(
        branch_id,course_type_id,session_id,booking_id,customer_id,event_type,payload
      ) values (
        v_session.branch_id,v_session.course_type_id,v_session.id,v_promoted.id,
        v_promoted.customer_id,'course_booking_promoted','{}'::jsonb
      );
    end if;
  end if;

  with ranked as (
    select id,row_number() over(order by booked_at,id) as rn
    from public.course_bookings
    where session_id=v_session.id and status='waitlisted'
  )
  update public.course_bookings b
  set waitlist_position=r.rn
  from ranked r where b.id=r.id;

  insert into public.customer_timeline(customer_id,type,title,description)
  values (
    v_booking.customer_id,'course_booking_cancelled','Prenotazione corso annullata',
    'Sessione ' || v_session.id::text ||
    case when v_late then ' Â· cancellazione tardiva' else '' end
  );

  insert into public.course_activity_log(
    branch_id,course_type_id,session_id,booking_id,customer_id,event_type,payload
  ) values (
    v_session.branch_id,v_session.course_type_id,v_session.id,v_booking.id,
    v_booking.customer_id,'course_booking_cancelled',
    jsonb_build_object('late_cancellation',v_late,'reason',p_reason,'promoted_booking_id',v_promoted.id)
  );

  v_response := jsonb_build_object(
    'ok',true,'booking_id',v_booking.id,'status','cancelled',
    'late_cancellation',v_late,'promoted_booking_id',v_promoted.id
  );
  return public.bodygate_courses_complete_operation_v1(v_operation_id,v_response);
end;
$function$
;
revoke all on function public.cancel_course_booking_atomic_v1(p_idempotency_key text, p_request_hash text, p_booking_id uuid, p_reason text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancel_course_enrollment_atomic_v1(p_idempotency_key text, p_request_hash text, p_enrollment_id uuid, p_reason text DEFAULT NULL::text, p_cancel_future_bookings boolean DEFAULT true)
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
$function$
;
revoke all on function public.cancel_course_enrollment_atomic_v1(p_idempotency_key text, p_request_hash text, p_enrollment_id uuid, p_reason text, p_cancel_future_bookings boolean) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancel_course_session_atomic_v1(p_idempotency_key text, p_request_hash text, p_session_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_session public.course_sessions%rowtype;
  v_claim jsonb;
  v_operation_id uuid;
  v_cancelled_count integer;
  v_response jsonb;
begin
  v_claim := public.bodygate_courses_claim_operation_v1(
    'course_session_cancel',p_idempotency_key,p_request_hash,null
  );
  if (v_claim->>'replayed')::boolean then return v_claim->'response'; end if;
  v_operation_id := (v_claim->>'operation_id')::uuid;

  select * into v_session from public.course_sessions where id=p_session_id for update;
  if not found then raise exception 'BODYGATE_COURSE_SESSION_NOT_FOUND'; end if;
  if v_session.status='cancelled' then raise exception 'BODYGATE_COURSE_SESSION_ALREADY_CANCELLED'; end if;
  if v_session.status='completed' then raise exception 'BODYGATE_COURSE_SESSION_ALREADY_COMPLETED'; end if;

  update public.course_bookings
  set status='cancelled',waitlist_position=null,cancelled_at=clock_timestamp(),
      cancellation_reason=coalesce(nullif(trim(p_reason),''),'Lezione annullata')
  where session_id=p_session_id and status in ('confirmed','waitlisted');
  get diagnostics v_cancelled_count = row_count;

  insert into public.customer_timeline(customer_id,type,title,description)
  select customer_id,'course_session_cancelled','Lezione annullata',
         coalesce(nullif(trim(p_reason),''),'Lezione annullata') || ' Â· Sessione ' || p_session_id::text
  from public.course_bookings
  where session_id=p_session_id and cancelled_at >= transaction_timestamp();

  update public.course_sessions
  set status='cancelled',notes=concat_ws(E'\n',notes,'Annullata: ' || coalesce(nullif(trim(p_reason),''),'motivo non specificato'))
  where id=p_session_id
  returning * into v_session;

  insert into public.course_activity_log(
    branch_id,course_type_id,session_id,event_type,payload
  ) values (
    v_session.branch_id,v_session.course_type_id,v_session.id,'course_session_cancelled',
    jsonb_build_object('reason',p_reason,'cancelled_bookings',v_cancelled_count)
  );

  v_response := jsonb_build_object('ok',true,'session_id',p_session_id,'status','cancelled','cancelled_bookings',v_cancelled_count);
  return public.bodygate_courses_complete_operation_v1(v_operation_id,v_response);
end;
$function$
;
revoke all on function public.cancel_course_session_atomic_v1(p_idempotency_key text, p_request_hash text, p_session_id uuid, p_reason text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_in_course_booking_atomic_v1(p_idempotency_key text, p_request_hash text, p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_booking public.course_bookings%rowtype;
  v_session public.course_sessions%rowtype;
  v_claim jsonb;
  v_operation_id uuid;
  v_response jsonb;
begin
  select * into v_booking from public.course_bookings where id=p_booking_id;
  if not found then raise exception 'BODYGATE_COURSE_BOOKING_NOT_FOUND'; end if;

  v_claim := public.bodygate_courses_claim_operation_v1(
    'course_booking_check_in',p_idempotency_key,p_request_hash,v_booking.customer_id
  );
  if (v_claim->>'replayed')::boolean then return v_claim->'response'; end if;
  v_operation_id := (v_claim->>'operation_id')::uuid;

  select * into v_booking from public.course_bookings where id=p_booking_id for update;
  select * into v_session from public.course_sessions where id=v_booking.session_id for update;

  if v_booking.status='attended' then raise exception 'BODYGATE_COURSE_ALREADY_CHECKED_IN'; end if;
  if v_booking.status<>'confirmed' then raise exception 'BODYGATE_COURSE_BOOKING_NOT_CONFIRMED'; end if;
  if v_session.status in ('cancelled','completed') then raise exception 'BODYGATE_COURSE_SESSION_NOT_CHECKINABLE'; end if;

  update public.course_bookings
  set status='attended',checked_in_at=clock_timestamp(),completed_at=clock_timestamp()
  where id=p_booking_id
  returning * into v_booking;

  insert into public.customer_timeline(customer_id,type,title,description)
  values (
    v_booking.customer_id,'course_attended','Presenza corso registrata',
    'Sessione ' || v_session.id::text || ' Â· ' ||
    to_char(v_session.starts_at at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI')
  );

  insert into public.course_activity_log(
    branch_id,course_type_id,session_id,booking_id,customer_id,event_type,payload
  ) values (
    v_session.branch_id,v_session.course_type_id,v_session.id,v_booking.id,
    v_booking.customer_id,'course_attended',jsonb_build_object('checked_in_at',v_booking.checked_in_at)
  );

  v_response := jsonb_build_object('ok',true,'booking_id',v_booking.id,'status','attended','checked_in_at',v_booking.checked_in_at);
  return public.bodygate_courses_complete_operation_v1(v_operation_id,v_response);
end;
$function$
;
revoke all on function public.check_in_course_booking_atomic_v1(p_idempotency_key text, p_request_hash text, p_booking_id uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.complete_course_session_atomic_v1(p_idempotency_key text, p_request_hash text, p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_session public.course_sessions%rowtype;
  v_claim jsonb;
  v_operation_id uuid;
  v_no_show_count integer;
  v_response jsonb;
begin
  v_claim := public.bodygate_courses_claim_operation_v1(
    'course_session_complete',p_idempotency_key,p_request_hash,null
  );
  if (v_claim->>'replayed')::boolean then return v_claim->'response'; end if;
  v_operation_id := (v_claim->>'operation_id')::uuid;

  select * into v_session from public.course_sessions where id=p_session_id for update;
  if not found then raise exception 'BODYGATE_COURSE_SESSION_NOT_FOUND'; end if;
  if v_session.status='completed' then raise exception 'BODYGATE_COURSE_SESSION_ALREADY_COMPLETED'; end if;
  if v_session.status='cancelled' then raise exception 'BODYGATE_COURSE_SESSION_CANCELLED'; end if;

  update public.course_bookings
  set status='no_show',completed_at=clock_timestamp()
  where session_id=p_session_id and status='confirmed';
  get diagnostics v_no_show_count = row_count;

  insert into public.customer_timeline(customer_id,type,title,description)
  select customer_id,'course_no_show','Assenza corso registrata','Sessione ' || p_session_id::text
  from public.course_bookings
  where session_id=p_session_id and status='no_show' and completed_at >= transaction_timestamp();

  update public.course_sessions
  set status='completed'
  where id=p_session_id
  returning * into v_session;

  insert into public.course_activity_log(
    branch_id,course_type_id,session_id,event_type,payload
  ) values (
    v_session.branch_id,v_session.course_type_id,v_session.id,'course_session_completed',
    jsonb_build_object('no_show_count',v_no_show_count)
  );

  v_response := jsonb_build_object('ok',true,'session_id',p_session_id,'status','completed','no_show_count',v_no_show_count);
  return public.bodygate_courses_complete_operation_v1(v_operation_id,v_response);
end;
$function$
;
revoke all on function public.complete_course_session_atomic_v1(p_idempotency_key text, p_request_hash text, p_session_id uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_course_room_atomic_v1(p_idempotency_key text, p_request_hash text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_claim jsonb;
  v_operation_id uuid;
  v_branch_id uuid;
  v_row public.course_rooms%rowtype;
  v_response jsonb;
begin
  v_claim := public.bodygate_courses_claim_operation_v1(
    'course_room_create', p_idempotency_key, p_request_hash, null
  );
  if (v_claim->>'replayed')::boolean then return v_claim->'response'; end if;
  v_operation_id := (v_claim->>'operation_id')::uuid;

  v_branch_id := nullif(trim(p_payload->>'branch_id'),'')::uuid;
  perform 1 from public.branches where id=v_branch_id and coalesce(is_active,true);
  if not found then raise exception 'BODYGATE_BRANCH_NOT_ACTIVE'; end if;

  insert into public.course_rooms(branch_id,name,description,capacity)
  values (
    v_branch_id,
    trim(p_payload->>'name'),
    nullif(trim(p_payload->>'description'),''),
    (p_payload->>'capacity')::integer
  )
  returning * into v_row;

  insert into public.course_activity_log(branch_id,event_type,payload)
  values (v_branch_id,'course_room_created',jsonb_build_object('room_id',v_row.id,'name',v_row.name));

  v_response := jsonb_build_object('ok',true,'course_room_id',v_row.id,'course_room',to_jsonb(v_row));
  return public.bodygate_courses_complete_operation_v1(v_operation_id,v_response);
end;
$function$
;
revoke all on function public.create_course_room_atomic_v1(p_idempotency_key text, p_request_hash text, p_payload jsonb) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_course_schedule_atomic_v1(p_idempotency_key text, p_request_hash text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_claim jsonb;
  v_operation_id uuid;
  v_branch_id uuid;
  v_course_type public.course_types%rowtype;
  v_room public.course_rooms%rowtype;
  v_instructor public.staff_users%rowtype;
  v_row public.course_schedules%rowtype;
  v_weekday integer;
  v_start time;
  v_duration integer;
  v_capacity integer;
  v_response jsonb;
begin
  v_claim := public.bodygate_courses_claim_operation_v1(
    'course_schedule_create', p_idempotency_key, p_request_hash, null
  );
  if (v_claim->>'replayed')::boolean then return v_claim->'response'; end if;
  v_operation_id := (v_claim->>'operation_id')::uuid;

  v_branch_id := nullif(trim(p_payload->>'branch_id'),'')::uuid;
  v_weekday := (p_payload->>'weekday')::integer;
  v_start := (p_payload->>'start_time')::time;
  v_duration := (p_payload->>'duration_minutes')::integer;
  v_capacity := (p_payload->>'capacity')::integer;

  select * into v_course_type
  from public.course_types
  where id=(p_payload->>'course_type_id')::uuid
    and branch_id=v_branch_id and is_active;
  if not found then raise exception 'BODYGATE_COURSE_TYPE_NOT_ACTIVE'; end if;

  select * into v_room
  from public.course_rooms
  where id=(p_payload->>'room_id')::uuid
    and branch_id=v_branch_id and is_active;
  if not found then raise exception 'BODYGATE_COURSE_ROOM_NOT_ACTIVE'; end if;

  if v_capacity > v_room.capacity then
    raise exception 'BODYGATE_COURSE_CAPACITY_EXCEEDS_ROOM';
  end if;

  if nullif(trim(p_payload->>'instructor_staff_user_id'),'') is not null then
    select * into v_instructor
    from public.staff_users
    where id=(p_payload->>'instructor_staff_user_id')::uuid
      and coalesce(is_active,true);
    if not found then raise exception 'BODYGATE_COURSE_INSTRUCTOR_NOT_ACTIVE'; end if;
  end if;

  if exists (
    select 1 from public.course_schedules s
    where s.branch_id=v_branch_id
      and s.room_id=v_room.id
      and s.weekday=v_weekday
      and s.status in ('draft','active','paused')
      and s.start_time < (v_start + make_interval(mins=>v_duration))::time
      and (s.start_time + make_interval(mins=>s.duration_minutes))::time > v_start
      and daterange(s.valid_from,coalesce(s.valid_until,'infinity'::date),'[]')
          && daterange((p_payload->>'valid_from')::date,coalesce((p_payload->>'valid_until')::date,'infinity'::date),'[]')
  ) then
    raise exception 'BODYGATE_COURSE_ROOM_SCHEDULE_CONFLICT';
  end if;

  if v_instructor.id is not null and exists (
    select 1 from public.course_schedules s
    where s.instructor_staff_user_id=v_instructor.id
      and s.weekday=v_weekday
      and s.status in ('draft','active','paused')
      and s.start_time < (v_start + make_interval(mins=>v_duration))::time
      and (s.start_time + make_interval(mins=>s.duration_minutes))::time > v_start
      and daterange(s.valid_from,coalesce(s.valid_until,'infinity'::date),'[]')
          && daterange((p_payload->>'valid_from')::date,coalesce((p_payload->>'valid_until')::date,'infinity'::date),'[]')
  ) then
    raise exception 'BODYGATE_COURSE_INSTRUCTOR_SCHEDULE_CONFLICT';
  end if;

  insert into public.course_schedules (
    branch_id,course_type_id,room_id,instructor_staff_user_id,
    weekday,start_time,duration_minutes,capacity,
    valid_from,valid_until,generation_horizon_days,status
  ) values (
    v_branch_id,v_course_type.id,v_room.id,v_instructor.id,
    v_weekday,v_start,v_duration,v_capacity,
    (p_payload->>'valid_from')::date,
    nullif(trim(p_payload->>'valid_until'),'')::date,
    coalesce((p_payload->>'generation_horizon_days')::integer,60),
    coalesce(nullif(trim(p_payload->>'status'),''),'draft')
  )
  returning * into v_row;

  insert into public.course_activity_log(
    branch_id,course_type_id,schedule_id,staff_user_id,event_type,payload
  ) values (
    v_branch_id,v_course_type.id,v_row.id,v_instructor.id,'course_schedule_created',to_jsonb(v_row)
  );

  v_response := jsonb_build_object('ok',true,'course_schedule_id',v_row.id,'course_schedule',to_jsonb(v_row));
  return public.bodygate_courses_complete_operation_v1(v_operation_id,v_response);
end;
$function$
;
revoke all on function public.create_course_schedule_atomic_v1(p_idempotency_key text, p_request_hash text, p_payload jsonb) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_course_type_atomic_v1(p_idempotency_key text, p_request_hash text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_claim jsonb;
  v_operation_id uuid;
  v_branch_id uuid;
  v_row public.course_types%rowtype;
  v_response jsonb;
begin
  v_claim := public.bodygate_courses_claim_operation_v1(
    'course_type_create', p_idempotency_key, p_request_hash, null
  );
  if (v_claim->>'replayed')::boolean then return v_claim->'response'; end if;
  v_operation_id := (v_claim->>'operation_id')::uuid;

  v_branch_id := nullif(trim(p_payload->>'branch_id'),'')::uuid;
  if v_branch_id is null then raise exception 'BODYGATE_VALIDATION_BRANCH_REQUIRED'; end if;

  perform 1 from public.branches where id=v_branch_id and coalesce(is_active,true);
  if not found then raise exception 'BODYGATE_BRANCH_NOT_ACTIVE'; end if;

  insert into public.course_types (
    branch_id, name, slug, description,
    default_duration_minutes, default_capacity, color,
    requires_medical_certificate, requires_active_subscription,
    booking_enabled, waitlist_enabled, cancellation_cutoff_minutes,
    default_price
  )
  values (
    v_branch_id,
    trim(p_payload->>'name'),
    lower(trim(p_payload->>'slug')),
    nullif(trim(p_payload->>'description'),''),
    coalesce((p_payload->>'default_duration_minutes')::integer,50),
    coalesce((p_payload->>'default_capacity')::integer,1),
    coalesce(nullif(trim(p_payload->>'color'),''),'#dc2626'),
    coalesce((p_payload->>'requires_medical_certificate')::boolean,true),
    coalesce((p_payload->>'requires_active_subscription')::boolean,false),
    coalesce((p_payload->>'booking_enabled')::boolean,true),
    coalesce((p_payload->>'waitlist_enabled')::boolean,true),
    coalesce((p_payload->>'cancellation_cutoff_minutes')::integer,120),
    nullif(p_payload->>'default_price','')::numeric
  )
  returning * into v_row;

  insert into public.course_activity_log (
    branch_id, course_type_id, event_type, payload
  ) values (
    v_branch_id, v_row.id, 'course_type_created', jsonb_build_object('name',v_row.name)
  );

  v_response := jsonb_build_object('ok',true,'course_type_id',v_row.id,'course_type',to_jsonb(v_row));
  return public.bodygate_courses_complete_operation_v1(v_operation_id,v_response);
end;
$function$
;
revoke all on function public.create_course_type_atomic_v1(p_idempotency_key text, p_request_hash text, p_payload jsonb) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_platinum_atomic_v1(p_idempotency_key text, p_request_hash text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_operation public.bodygate_atomic_operations%rowtype;
  v_recent_operation public.bodygate_atomic_operations%rowtype;
  v_customer public.customers%rowtype;
  v_membership_fee public.customer_membership_fees%rowtype;
  v_subscription public.customer_subscriptions%rowtype;
  v_customer_payment public.customer_payments%rowtype;
  v_payment public.payments%rowtype;
  v_receipt public.customer_receipts%rowtype;
  v_document public.customer_documents%rowtype;
  v_credential public.access_credentials%rowtype;
  v_plan public.subscription_plans%rowtype;
  v_membership_setting public.membership_fee_settings%rowtype;

  v_inserted_operation_id uuid;
  v_branch_id uuid;
  v_plan_id uuid;
  v_subscription_choice text;
  v_payment_method text;
  v_first_name text;
  v_last_name text;
  v_phone text;
  v_email text;
  v_fiscal_code text;
  v_badge_code text;
  v_controller_code text;
  v_badge_charge_mode text;
  v_badge_reason text;
  v_badge_amount numeric;
  v_membership_amount numeric;
  v_membership_days integer;
  v_subscription_amount numeric := 0;
  v_subscription_days integer := 0;
  v_subscription_name text;
  v_total_amount numeric;
  v_today date := current_date;
  v_now timestamptz := clock_timestamp();
  v_membership_until date;
  v_subscription_until date;
  v_description text;
  v_component_description text;
  v_receipt_components jsonb;
  v_receipt_number_payload jsonb;
  v_response jsonb;
  v_tags text[];
begin
  p_idempotency_key := trim(coalesce(p_idempotency_key, ''));
  p_request_hash := lower(trim(coalesce(p_request_hash, '')));
  p_payload := coalesce(p_payload, '{}'::jsonb);

  if char_length(p_idempotency_key) < 16
     or char_length(p_idempotency_key) > 180
     or p_idempotency_key !~ '^[A-Za-z0-9:_-]+$' then
    raise exception 'BODYGATE_VALIDATION_IDEMPOTENCY_KEY';
  end if;

  if p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'BODYGATE_VALIDATION_REQUEST_HASH';
  end if;

  v_first_name := trim(coalesce(p_payload->>'first_name', ''));
  v_last_name := trim(coalesce(p_payload->>'last_name', ''));
  v_phone := trim(coalesce(p_payload->>'phone', ''));
  v_email := nullif(lower(trim(coalesce(p_payload->>'email', ''))), '');
  v_fiscal_code := upper(trim(coalesce(p_payload->>'fiscal_code', '')));
  v_subscription_choice :=
    lower(trim(coalesce(p_payload->>'subscription_choice', 'with_subscription')));
  v_payment_method :=
    lower(trim(coalesce(p_payload->>'payment_method', 'cash')));
  v_badge_code := trim(coalesce(p_payload->>'badge_code', ''));
  v_controller_code := trim(coalesce(p_payload->>'controller_code', ''));
  v_badge_charge_mode :=
    lower(trim(coalesce(p_payload->>'badge_charge_mode', 'not_included')));
  v_badge_reason :=
    nullif(trim(coalesce(p_payload->>'badge_complimentary_reason', '')), '');

  if v_first_name = '' or v_last_name = '' then
    raise exception 'BODYGATE_VALIDATION_CUSTOMER_NAME';
  end if;

  if v_phone = '' then
    raise exception 'BODYGATE_VALIDATION_PHONE';
  end if;

  if v_fiscal_code = '' then
    raise exception 'BODYGATE_VALIDATION_FISCAL_CODE';
  end if;

  if v_subscription_choice not in ('membership_only', 'with_subscription') then
    raise exception 'BODYGATE_VALIDATION_SUBSCRIPTION_CHOICE';
  end if;

  if v_payment_method not in ('cash', 'pos', 'bank_transfer') then
    raise exception 'BODYGATE_VALIDATION_PAYMENT_METHOD';
  end if;

  if v_badge_charge_mode not in ('not_included', 'charged', 'complimentary') then
    raise exception 'BODYGATE_VALIDATION_BADGE_MODE';
  end if;

  begin
    v_branch_id := nullif(trim(coalesce(p_payload->>'branch_id', '')), '')::uuid;
  exception when invalid_text_representation then
    raise exception 'BODYGATE_VALIDATION_BRANCH_ID';
  end;

  if v_branch_id is null then
    raise exception 'BODYGATE_VALIDATION_BRANCH_REQUIRED';
  end if;

  perform 1
  from public.branches
  where id = v_branch_id;

  if not found then
    raise exception 'BODYGATE_NOT_FOUND_BRANCH';
  end if;

  if v_subscription_choice = 'with_subscription' then
    begin
      v_plan_id :=
        nullif(trim(coalesce(p_payload->>'subscription_plan_id', '')), '')::uuid;
    exception when invalid_text_representation then
      raise exception 'BODYGATE_VALIDATION_PLAN_ID';
    end;

    if v_plan_id is null then
      raise exception 'BODYGATE_VALIDATION_PLAN_ID';
    end if;
  else
    v_plan_id := null;
  end if;

  if v_badge_charge_mode = 'charged'
     and v_badge_code = ''
     and v_controller_code = '' then
    raise exception 'BODYGATE_VALIDATION_BADGE_DELIVERY';
  end if;

  if v_badge_charge_mode = 'complimentary'
     and v_badge_reason is null then
    raise exception 'BODYGATE_VALIDATION_BADGE_REASON';
  end if;

  v_badge_amount :=
    case
      when v_badge_charge_mode = 'charged'
        then round(coalesce(nullif(p_payload->>'badge_fee', '')::numeric, 0), 2)
      else 0
    end;

  if v_badge_amount < 0 then
    raise exception 'BODYGATE_VALIDATION_BADGE_FEE';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bodygate-onboarding-request:' || p_request_hash, 0)
  );

  perform pg_advisory_xact_lock(
    hashtextextended('bodygate-onboarding-fiscal:' || v_fiscal_code, 0)
  );

  if v_badge_code <> '' then
    perform pg_advisory_xact_lock(
      hashtextextended('bodygate-badge:' || v_badge_code, 0)
    );
  end if;

  if v_controller_code <> '' and v_controller_code <> v_badge_code then
    perform pg_advisory_xact_lock(
      hashtextextended('bodygate-badge:' || v_controller_code, 0)
    );
  end if;

  insert into public.bodygate_atomic_operations (
    operation_type,
    idempotency_key,
    request_hash,
    status
  )
  values (
    'platinum_onboarding',
    p_idempotency_key,
    p_request_hash,
    'processing'
  )
  on conflict (operation_type, idempotency_key) do nothing
  returning id into v_inserted_operation_id;

  if v_inserted_operation_id is null then
    select *
    into v_operation
    from public.bodygate_atomic_operations
    where operation_type = 'platinum_onboarding'
      and idempotency_key = p_idempotency_key
    for update;

    if not found then
      raise exception 'BODYGATE_IDEMPOTENCY_OPERATION_INCOMPLETE';
    end if;

    if v_operation.request_hash <> p_request_hash then
      raise exception 'BODYGATE_IDEMPOTENCY_PAYLOAD_MISMATCH';
    end if;

    if v_operation.status = 'completed'
       and v_operation.response_payload is not null then
      return v_operation.response_payload
        || jsonb_build_object(
          'replayed', true,
          'replay_source', 'idempotency_key'
        );
    end if;

    raise exception 'BODYGATE_IDEMPOTENCY_OPERATION_INCOMPLETE';
  end if;

  select *
  into v_operation
  from public.bodygate_atomic_operations
  where id = v_inserted_operation_id
  for update;

  select *
  into v_recent_operation
  from public.bodygate_atomic_operations
  where operation_type = 'platinum_onboarding'
    and request_hash = p_request_hash
    and id <> v_operation.id
    and status = 'completed'
    and response_payload is not null
    and completed_at >= v_now - interval '10 minutes'
  order by completed_at desc
  limit 1;

  if found then
    v_response :=
      v_recent_operation.response_payload
      || jsonb_build_object(
        'replayed', true,
        'replay_source', 'recent_request_hash',
        'operation_id', v_operation.id,
        'idempotency_key', p_idempotency_key,
        'source_operation_id', v_recent_operation.id
      );

    update public.bodygate_atomic_operations
    set
      customer_id = v_recent_operation.customer_id,
      status = 'completed',
      membership_fee_id = v_recent_operation.membership_fee_id,
      subscription_id = v_recent_operation.subscription_id,
      customer_payment_id = v_recent_operation.customer_payment_id,
      payment_id = v_recent_operation.payment_id,
      receipt_id = v_recent_operation.receipt_id,
      document_id = v_recent_operation.document_id,
      access_credential_id = v_recent_operation.access_credential_id,
      response_payload = v_response,
      completed_at = v_now
    where id = v_operation.id;

    return v_response;
  end if;

  perform 1
  from public.customers
  where upper(trim(coalesce(fiscal_code, ''))) = v_fiscal_code
  limit 1;

  if found then
    raise exception 'BODYGATE_DUPLICATE_CUSTOMER_FISCAL_CODE';
  end if;
  if v_badge_code <> '' or v_controller_code <> '' then
    perform 1
    from public.customers
    where (
      badge_code in (nullif(v_badge_code, ''), nullif(v_controller_code, ''))
      or controller_code in (nullif(v_badge_code, ''), nullif(v_controller_code, ''))
    )
      and (
        coalesce(is_active, false)
        or coalesce(active, false)
        or lower(coalesce(status, '')) in ('active', 'onboarding')
      )
    limit 1;

    if found then
      raise exception 'BODYGATE_DUPLICATE_BADGE_CUSTOMER';
    end if;

    perform 1
    from public.access_credentials
    where (
      code in (nullif(v_badge_code, ''), nullif(v_controller_code, ''))
      or controller_code in (nullif(v_badge_code, ''), nullif(v_controller_code, ''))
    )
      and lower(coalesce(status, '')) = 'active'
    limit 1;

    if found then
      raise exception 'BODYGATE_DUPLICATE_BADGE_CREDENTIAL';
    end if;

    perform 1
    from public.customer_badges
    where badge_code in (
      nullif(v_badge_code, ''),
      nullif(v_controller_code, '')
    )
      and coalesce(is_active, true)
    limit 1;

    if found then
      raise exception 'BODYGATE_DUPLICATE_BADGE_CUSTOMER_BADGE';
    end if;

    perform 1
    from public.staff_access_credentials
    where (
      code in (nullif(v_badge_code, ''), nullif(v_controller_code, ''))
      or controller_code in (nullif(v_badge_code, ''), nullif(v_controller_code, ''))
    )
      and lower(coalesce(status, '')) = 'active'
    limit 1;

    if found then
      raise exception 'BODYGATE_DUPLICATE_BADGE_STAFF';
    end if;
  end if;

  select *
  into v_membership_setting
  from public.membership_fee_settings
  where branch_id = v_branch_id
    and is_active = true
  limit 1;

  v_membership_amount :=
    round(
      coalesce(
        v_membership_setting.price,
        nullif(p_payload->>'membership_amount', '')::numeric,
        10
      ),
      2
    );

  v_membership_days :=
    coalesce(v_membership_setting.validity_days, 365);

  if v_membership_amount <= 0 or v_membership_days <= 0 then
    raise exception 'BODYGATE_VALIDATION_MEMBERSHIP_FEE';
  end if;

  v_membership_until := v_today + v_membership_days;

  if v_subscription_choice = 'with_subscription' then
    select *
    into v_plan
    from public.subscription_plans
    where id = v_plan_id;

    if not found then
      raise exception 'BODYGATE_NOT_FOUND_PLAN';
    end if;

    if v_plan.is_active is false then
      raise exception 'BODYGATE_VALIDATION_PLAN_INACTIVE';
    end if;

    if v_plan.branch_id is not null and v_plan.branch_id <> v_branch_id then
      raise exception 'BODYGATE_VALIDATION_BRANCH_MISMATCH';
    end if;

    if v_plan.name not in (
      'Mensile',
      'Trimestrale',
      'Semestrale',
      'Annuale',
      'Annuale ridotto Lun Mer Ven',
      'Annuale ridotto Mar Gio Sab',
      'Mensile Ridotto Lunedi-Mercoledi-Venerdi',
      'Mensile Ridotto Martedi-Giovedi-Sabato',
      'Pilates'
    ) then
      raise exception 'BODYGATE_VALIDATION_PLAN_NOT_ALLOWED';
    end if;

    v_subscription_days := coalesce(v_plan.duration_days, 0);
    v_subscription_amount :=
      round(
        coalesce(nullif(v_plan.promo_price, 0), v_plan.price)::numeric,
        2
      );
    v_subscription_name := v_plan.name;

    if v_subscription_days <= 0 or v_subscription_amount <= 0 then
      raise exception 'BODYGATE_VALIDATION_PLAN_VALUES';
    end if;

    v_subscription_until := v_today + v_subscription_days;
  else
    v_subscription_days := 0;
    v_subscription_amount := 0;
    v_subscription_name := null;
    v_subscription_until := null;
  end if;

  v_total_amount :=
    v_membership_amount + v_subscription_amount + v_badge_amount;

  if v_total_amount <= 0 then
    raise exception 'BODYGATE_VALIDATION_TOTAL_AMOUNT';
  end if;

  if jsonb_typeof(p_payload->'customer_tags') = 'array' then
    select coalesce(array_agg(value), array[]::text[])
    into v_tags
    from jsonb_array_elements_text(p_payload->'customer_tags') as tag(value);
  else
    v_tags := array[]::text[];
  end if;

  insert into public.customers (
    first_name,
    last_name,
    phone,
    email,
    fiscal_code,
    branch_id,
    gender,
    birth_date,
    birth_place,
    address,
    street_number,
    postal_code,
    city,
    province,
    country,
    document_type,
    document_number,
    document_issued_by,
    document_issued_at,
    document_expires_at,
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_relation,
    profession,
    fitness_goal,
    marketing_source,
    customer_tags,
    badge_code,
    controller_code,
    medical_certificate_start_date,
    medical_certificate_end_date,
    medical_certificate_url,
    medical_certificate_status,
    active,
    is_active,
    status,
    subscription_status,
    subscription_expiry,
    onboarding_status,
    payment_status,
    contract_status,
    access_activation_status,
    privacy_consent,
    marketing_consent,
    photo_video_consent
  )
  values (
    v_first_name,
    v_last_name,
    v_phone,
    v_email,
    v_fiscal_code,
    v_branch_id,
    nullif(p_payload->>'gender', ''),
    nullif(p_payload->>'birth_date', '')::date,
    nullif(p_payload->>'birth_place', ''),
    nullif(p_payload->>'address', ''),
    nullif(p_payload->>'street_number', ''),
    nullif(p_payload->>'postal_code', ''),
    nullif(p_payload->>'city', ''),
    nullif(p_payload->>'province', ''),
    coalesce(nullif(p_payload->>'country', ''), 'Italia'),
    nullif(p_payload->>'document_type', ''),
    nullif(p_payload->>'document_number', ''),
    nullif(p_payload->>'document_issued_by', ''),
    nullif(p_payload->>'document_issued_at', '')::date,
    nullif(p_payload->>'document_expires_at', '')::date,
    nullif(p_payload->>'emergency_contact_name', ''),
    nullif(p_payload->>'emergency_contact_phone', ''),
    nullif(p_payload->>'emergency_contact_relation', ''),
    nullif(p_payload->>'profession', ''),
    nullif(p_payload->>'fitness_goal', ''),
    nullif(p_payload->>'marketing_source', ''),
    v_tags,
    nullif(v_badge_code, ''),
    nullif(v_controller_code, ''),
    nullif(p_payload->>'medical_certificate_start_date', '')::date,
    nullif(p_payload->>'medical_certificate_end_date', '')::date,
    nullif(p_payload->>'medical_certificate_url', ''),
    case
      when nullif(p_payload->>'medical_certificate_end_date', '') is not null
        then 'valid'
      else 'missing'
    end,
    false,
    false,
    'onboarding',
    case
      when v_subscription_choice = 'with_subscription' then 'active'
      else 'pending'
    end,
    v_subscription_until,
    'contract_pending',
    'paid',
    'pending_signature',
    case
      when v_badge_code <> '' or v_controller_code <> ''
        then 'badge_assigned'
      else 'pending'
    end,
    coalesce((p_payload->>'privacy_consent')::boolean, false),
    coalesce((p_payload->>'marketing_consent')::boolean, false),
    coalesce((p_payload->>'photo_video_consent')::boolean, false)
  )
  returning * into v_customer;

  insert into public.customer_membership_fees (
    customer_id,
    branch_id,
    amount,
    paid_at,
    valid_from,
    valid_until,
    payment_method,
    notes
  )
  values (
    v_customer.id,
    v_branch_id,
    v_membership_amount,
    v_now,
    v_today,
    v_membership_until,
    v_payment_method,
    'Quota associativa creata da onboarding Platinum atomico'
  )
  returning * into v_membership_fee;

  if v_subscription_choice = 'with_subscription' then
    insert into public.customer_subscriptions (
      customer_id,
      branch_id,
      plan_id,
      amount,
      starts_at,
      ends_at,
      is_active,
      payment_method,
      notes
    )
    values (
      v_customer.id,
      v_branch_id,
      v_plan.id,
      v_subscription_amount,
      v_today,
      v_subscription_until,
      true,
      v_payment_method,
      'Creato da onboarding Platinum atomico: ' || v_subscription_name
    )
    returning * into v_subscription;
  end if;

  v_receipt_components := jsonb_build_array();

  if v_subscription_choice = 'with_subscription' then
    v_receipt_components :=
      v_receipt_components
      || jsonb_build_array(
        jsonb_build_object(
          'code', 'subscription',
          'label', 'Abbonamento ' || v_subscription_name,
          'amount', v_subscription_amount
        )
      );
  end if;

  v_receipt_components :=
    v_receipt_components
    || jsonb_build_array(
      jsonb_build_object(
        'code', 'membership_fee',
        'label', 'Quota associativa',
        'amount', v_membership_amount
      )
    );

  if v_badge_charge_mode <> 'not_included' then
    v_receipt_components :=
      v_receipt_components
      || jsonb_build_array(
        jsonb_build_object(
          'code', 'rfid_badge',
          'label', 'Badge RFID',
          'amount', v_badge_amount
        )
      );
  end if;

  select string_agg(
    component->>'label'
      || ' €'
      || replace(
        to_char((component->>'amount')::numeric, 'FM999999990.00'),
        '.',
        ','
      ),
    ' + '
  )
  into v_component_description
  from jsonb_array_elements(v_receipt_components) as component;

  v_description := 'Nuova iscrizione: ' || v_component_description;

  insert into public.customer_payments (
    customer_id,
    type,
    description,
    amount,
    payment_method,
    status,
    paid_at,
    notes
  )
  values (
    v_customer.id,
    'onboarding',
    v_description,
    v_total_amount,
    v_payment_method,
    'paid',
    v_now,
    'Incasso obbligatorio nuovo cliente - transazione atomica'
  )
  returning * into v_customer_payment;

  insert into public.payments (
    customer_id,
    amount,
    method,
    paid_at,
    subscription_days,
    payment_method,
    description,
    payment_method_id,
    payment_type,
    status,
    created_by
  )
  values (
    v_customer.id,
    v_total_amount,
    v_payment_method,
    v_now,
    v_subscription_days,
    v_payment_method,
    v_description,
    null,
    'onboarding',
    'paid',
    'admin@bodygate.it'
  )
  returning * into v_payment;

  v_receipt_number_payload :=
    public.next_bodygate_receipt_number_v2();

  if v_receipt_number_payload is null
     or nullif(v_receipt_number_payload->>'receipt_number', '') is null then
    raise exception 'BODYGATE_RECEIPT_NUMBER_INVALID';
  end if;

  insert into public.customer_receipts (
    customer_id,
    payment_id,
    subscription_id,
    receipt_year,
    receipt_sequence,
    receipt_number,
    receipt_type,
    amount,
    description,
    customer_copy_label,
    gym_copy_label,
    issued_at,
    receipt_components
  )
  values (
    v_customer.id,
    v_customer_payment.id,
    case
      when v_subscription_choice = 'with_subscription'
        then v_subscription.id
      else null
    end,
    (v_receipt_number_payload->>'receipt_year')::integer,
    (v_receipt_number_payload->>'receipt_sequence')::integer,
    v_receipt_number_payload->>'receipt_number',
    'onboarding',
    v_total_amount,
    v_description,
    'COPIA CLIENTE',
    'COPIA PALESTRA',
    v_now,
    v_receipt_components
  )
  returning * into v_receipt;

  insert into public.customer_documents (
    customer_id,
    document_type,
    title,
    status
  )
  values (
    v_customer.id,
    'contract',
    'Contratto associativo Body Energy ASD '
      || v_today::text
      || ' - '
      || v_membership_until::text,
    'generated'
  )
  returning * into v_document;

  if v_badge_code <> '' or v_controller_code <> '' then
    insert into public.access_credentials (
      customer_id,
      type,
      code,
      controller_code,
      status
    )
    values (
      v_customer.id,
      'card',
      coalesce(nullif(v_badge_code, ''), v_controller_code),
      nullif(v_controller_code, ''),
      'active'
    )
    returning * into v_credential;
  end if;

  if nullif(p_payload->>'medical_certificate_start_date', '') is not null
     or nullif(p_payload->>'medical_certificate_end_date', '') is not null
     or nullif(p_payload->>'medical_certificate_url', '') is not null then
    insert into public.medical_certificates (
      customer_id,
      file_url,
      expiry_date,
      status,
      valid_from,
      valid_until,
      certificate_type
    )
    values (
      v_customer.id,
      nullif(p_payload->>'medical_certificate_url', ''),
      nullif(p_payload->>'medical_certificate_end_date', '')::date,
      case
        when nullif(p_payload->>'medical_certificate_end_date', '') is not null
          then 'valid'
        else 'missing'
      end,
      nullif(p_payload->>'medical_certificate_start_date', '')::date,
      nullif(p_payload->>'medical_certificate_end_date', '')::date,
      'non_agonistico'
    );
  end if;

  insert into public.customer_timeline (
    customer_id,
    type,
    title,
    description,
    created_at
  )
  values
    (
      v_customer.id,
      'customer',
      'Cliente creato',
      v_first_name
        || ' '
        || v_last_name
        || ' creato tramite onboarding Platinum atomico',
      v_now
    ),
    (
      v_customer.id,
      'payment',
      'Incasso onboarding registrato',
      v_description
        || ' - €'
        || replace(to_char(v_total_amount, 'FM999999990.00'), '.', ','),
      v_now
    ),
    (
      v_customer.id,
      'contract',
      'Contratto in attesa di firma',
      'Il cliente deve completare la firma OTP del contratto.',
      v_now
    );

  if v_badge_code <> '' or v_controller_code <> '' then
    insert into public.customer_timeline (
      customer_id,
      type,
      title,
      description,
      created_at
    )
    values (
      v_customer.id,
      'badge',
      case
        when v_badge_charge_mode = 'charged'
          then 'Badge RFID consegnato e addebitato'
        else 'Badge RFID consegnato in omaggio'
      end,
      case
        when v_badge_charge_mode = 'charged'
          then 'Badge RFID consegnato e addebitato €'
            || replace(to_char(v_badge_amount, 'FM999999990.00'), '.', ',')
        else 'Badge RFID consegnato in omaggio — motivo: '
          || coalesce(v_badge_reason, 'non addebitato')
      end,
      v_now
    );
  end if;

  v_response :=
    jsonb_build_object(
      'ok', true,
      'replayed', false,
      'operation_id', v_operation.id,
      'idempotency_key', p_idempotency_key,
      'customer_id', v_customer.id,
      'branch_id', v_branch_id,
      'customer', to_jsonb(v_customer),
      'membership_fee', to_jsonb(v_membership_fee),
      'subscription',
        case
          when v_subscription_choice = 'with_subscription'
            then to_jsonb(v_subscription)
          else null
        end,
      'customer_payment', to_jsonb(v_customer_payment),
      'payment', to_jsonb(v_payment),
      'receipt', to_jsonb(v_receipt),
      'contract_document', to_jsonb(v_document),
      'access_credential',
        case
          when v_badge_code <> '' or v_controller_code <> ''
            then to_jsonb(v_credential)
          else null
        end,
      'steps', jsonb_build_object(
        'customer', true,
        'membership_fee', true,
        'subscription', v_subscription_choice = 'with_subscription',
        'payment', true,
        'receipt', true,
        'badge', v_badge_code <> '' or v_controller_code <> '',
        'contract_pending', true
      ),
      'next_url', '/customers/' || v_customer.id::text || '/contract/print'
    );

  update public.bodygate_atomic_operations
  set
    customer_id = v_customer.id,
    status = 'completed',
    membership_fee_id = v_membership_fee.id,
    subscription_id =
      case
        when v_subscription_choice = 'with_subscription'
          then v_subscription.id
        else null
      end,
    customer_payment_id = v_customer_payment.id,
    payment_id = v_payment.id,
    receipt_id = v_receipt.id,
    document_id = v_document.id,
    access_credential_id =
      case
        when v_badge_code <> '' or v_controller_code <> ''
          then v_credential.id
        else null
      end,
    response_payload = v_response,
    completed_at = v_now
  where id = v_operation.id;

  return v_response;
end;
$function$
;
revoke all on function public.create_platinum_atomic_v1(p_idempotency_key text, p_request_hash text, p_payload jsonb) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_training_program_atomic(payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_program_id uuid;
  day_item jsonb;
  exercise_item jsonb;
  new_day_id uuid;
begin
  if coalesce(payload->>'customer_id', '') = '' then
    raise exception 'customer_id required';
  end if;

  if coalesce(payload->>'title', '') = '' then
    raise exception 'title required';
  end if;

  insert into public.training_programs (customer_id, title, goal, description, coach_name, starts_at, ends_at, is_active)
  values (
    (payload->>'customer_id')::uuid,
    payload->>'title',
    nullif(payload->>'goal', ''),
    nullif(payload->>'description', ''),
    nullif(payload->>'coach_name', ''),
    nullif(payload->>'starts_at', '')::date,
    nullif(payload->>'ends_at', '')::date,
    true
  )
  returning id into new_program_id;

  for day_item in select * from jsonb_array_elements(coalesce(payload->'days', '[]'::jsonb)) loop
    insert into public.training_program_days (program_id, day_number, title, notes)
    values (new_program_id, coalesce((day_item->>'day_number')::int, 1), coalesce(day_item->>'title', 'Giorno'), nullif(day_item->>'notes', ''))
    returning id into new_day_id;

    for exercise_item in select * from jsonb_array_elements(coalesce(day_item->'exercises', '[]'::jsonb)) loop
      if coalesce(exercise_item->>'exercise_id', '') = '' then
        raise exception 'exercise_id required';
      end if;

      insert into public.training_day_exercises (day_id, exercise_id, position, sets, reps, rest_seconds, notes)
      values (
        new_day_id,
        (exercise_item->>'exercise_id')::uuid,
        coalesce((exercise_item->>'position')::int, 1),
        nullif(exercise_item->>'sets', '')::int,
        nullif(exercise_item->>'reps', ''),
        nullif(exercise_item->>'rest_seconds', '')::int,
        nullif(exercise_item->>'notes', '')
      );
    end loop;
  end loop;

  return new_program_id;
end;
$function$
;
revoke all on function public.create_training_program_atomic(payload jsonb) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enroll_customer_course_atomic_v1(p_idempotency_key text, p_request_hash text, p_schedule_id uuid, p_customer_id uuid, p_pricing_mode text, p_fixed_price numeric DEFAULT NULL::numeric, p_payment_method text DEFAULT NULL::text, p_billing_cycle text DEFAULT 'monthly'::text)
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
$function$
;
revoke all on function public.enroll_customer_course_atomic_v1(p_idempotency_key text, p_request_hash text, p_schedule_id uuid, p_customer_id uuid, p_pricing_mode text, p_fixed_price numeric, p_payment_method text, p_billing_cycle text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_course_sessions_atomic_v1(p_idempotency_key text, p_request_hash text, p_schedule_id uuid, p_date_from date, p_date_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_claim jsonb;
  v_operation_id uuid;
  v_schedule public.course_schedules%rowtype;
  v_day date;
  v_starts timestamptz;
  v_ends timestamptz;
  v_created integer := 0;
  v_existing integer := 0;
  v_row_id uuid;
  v_response jsonb;
begin
  v_claim := public.bodygate_courses_claim_operation_v1(
    'course_sessions_generate', p_idempotency_key, p_request_hash, null
  );
  if (v_claim->>'replayed')::boolean then return v_claim->'response'; end if;
  v_operation_id := (v_claim->>'operation_id')::uuid;

  select * into v_schedule
  from public.course_schedules
  where id=p_schedule_id
  for update;

  if not found then raise exception 'BODYGATE_COURSE_SCHEDULE_NOT_FOUND'; end if;
  if v_schedule.status <> 'active' then raise exception 'BODYGATE_COURSE_SCHEDULE_NOT_ACTIVE'; end if;
  if p_date_from is null or p_date_to is null or p_date_to < p_date_from then
    raise exception 'BODYGATE_VALIDATION_DATE_RANGE';
  end if;
  if p_date_to - p_date_from > 366 then raise exception 'BODYGATE_COURSE_GENERATION_RANGE_TOO_LARGE'; end if;

  for v_day in
    select d::date
    from generate_series(p_date_from,p_date_to,interval '1 day') d
    where extract(isodow from d)::integer=v_schedule.weekday
      and d::date >= v_schedule.valid_from
      and (v_schedule.valid_until is null or d::date <= v_schedule.valid_until)
  loop
    v_starts := (v_day + v_schedule.start_time) at time zone 'Europe/Rome';
    v_ends := v_starts + make_interval(mins=>v_schedule.duration_minutes);
    v_row_id := null;

    insert into public.course_sessions(
      branch_id,course_type_id,schedule_id,room_id,instructor_staff_user_id,
      starts_at,ends_at,capacity,status
    ) values (
      v_schedule.branch_id,v_schedule.course_type_id,v_schedule.id,v_schedule.room_id,
      v_schedule.instructor_staff_user_id,v_starts,v_ends,v_schedule.capacity,'open'
    )
    on conflict (schedule_id,starts_at) do nothing
    returning id into v_row_id;

    if v_row_id is null then
      v_existing := v_existing + 1;
    else
      v_created := v_created + 1;
      insert into public.course_activity_log(
        branch_id,course_type_id,schedule_id,session_id,staff_user_id,event_type,payload
      ) values (
        v_schedule.branch_id,v_schedule.course_type_id,v_schedule.id,v_row_id,
        v_schedule.instructor_staff_user_id,'course_session_generated',
        jsonb_build_object('starts_at',v_starts,'ends_at',v_ends)
      );
    end if;
  end loop;

  v_response := jsonb_build_object(
    'ok',true,'schedule_id',p_schedule_id,'created_count',v_created,'existing_count',v_existing,
    'date_from',p_date_from,'date_to',p_date_to
  );
  return public.bodygate_courses_complete_operation_v1(v_operation_id,v_response);
end;
$function$
;
revoke all on function public.generate_course_sessions_atomic_v1(p_idempotency_key text, p_request_hash text, p_schedule_id uuid, p_date_from date, p_date_to date) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.next_bodygate_receipt_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  y integer := extract(year from now())::integer;
  n integer;
begin
  insert into receipt_sequences(year, last_number, updated_at)
  values (y, 1, now())
  on conflict (year)
  do update set
    last_number = receipt_sequences.last_number + 1,
    updated_at = now()
  returning last_number into n;

  return y::text || '/' || lpad(n::text, 6, '0');
end;
$function$
;
revoke all on function public.next_bodygate_receipt_number() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.next_bodygate_receipt_number_v2()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  target_year integer := extract(year from now())::integer;
  next_sequence integer;
  next_receipt_number text;
begin
  insert into receipt_counters(year, last_sequence, updated_at)
  values (target_year, 1, now())
  on conflict (year)
  do update set
    last_sequence = receipt_counters.last_sequence + 1,
    updated_at = now()
  returning last_sequence into next_sequence;

  next_receipt_number := target_year::text || '-' || lpad(next_sequence::text, 4, '0');

  return jsonb_build_object(
    'receipt_year', target_year,
    'receipt_sequence', next_sequence,
    'receipt_number', next_receipt_number
  );
end;
$function$
;
revoke all on function public.next_bodygate_receipt_number_v2() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.nextval_dnake_user_id()
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select nextval('public.dnake_user_id_seq');
$function$
;
revoke all on function public.nextval_dnake_user_id() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pay_course_booking_atomic_v1(p_idempotency_key text, p_request_hash text, p_booking_id uuid, p_amount numeric, p_payment_method text)
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
$function$
;
revoke all on function public.pay_course_booking_atomic_v1(p_idempotency_key text, p_request_hash text, p_booking_id uuid, p_amount numeric, p_payment_method text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.renew_course_enrollment_payment_atomic_v1(p_idempotency_key text, p_request_hash text, p_enrollment_id uuid, p_amount numeric, p_payment_method text, p_period_label text)
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
$function$
;
revoke all on function public.renew_course_enrollment_payment_atomic_v1(p_idempotency_key text, p_request_hash text, p_enrollment_id uuid, p_amount numeric, p_payment_method text, p_period_label text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.renew_membership_fee_atomic_v1(p_idempotency_key text, p_request_hash text, p_customer_id uuid, p_amount numeric, p_payment_method text, p_valid_from date, p_valid_until date, p_allow_duplicate boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_operation public.bodygate_atomic_operations%rowtype;
  v_recent_operation public.bodygate_atomic_operations%rowtype;
  v_customer public.customers%rowtype;
  v_membership_fee public.customer_membership_fees%rowtype;
  v_customer_payment public.customer_payments%rowtype;
  v_payment public.payments%rowtype;
  v_receipt public.customer_receipts%rowtype;
  v_document public.customer_documents%rowtype;
  v_receipt_number_payload jsonb;
  v_response jsonb;
  v_now timestamptz := clock_timestamp();
  v_description text;
  v_year integer;
  v_inserted_operation_id uuid;
begin
  p_idempotency_key := trim(coalesce(p_idempotency_key, ''));
  p_request_hash := lower(trim(coalesce(p_request_hash, '')));
  p_payment_method := lower(trim(coalesce(p_payment_method, '')));
  p_allow_duplicate := coalesce(p_allow_duplicate, false);

  if char_length(p_idempotency_key) < 16
     or char_length(p_idempotency_key) > 180
     or p_idempotency_key !~ '^[A-Za-z0-9:_-]+$' then
    raise exception 'BODYGATE_VALIDATION_IDEMPOTENCY_KEY';
  end if;

  if p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'BODYGATE_VALIDATION_REQUEST_HASH';
  end if;

  if p_customer_id is null then
    raise exception 'BODYGATE_VALIDATION_CUSTOMER_ID';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'BODYGATE_VALIDATION_AMOUNT';
  end if;

  if p_payment_method not in ('cash', 'pos', 'bank_transfer') then
    raise exception 'BODYGATE_VALIDATION_PAYMENT_METHOD';
  end if;

  if p_valid_from is null or p_valid_until is null then
    raise exception 'BODYGATE_VALIDATION_DATES';
  end if;

  if p_valid_until < p_valid_from then
    raise exception 'BODYGATE_VALIDATION_DATE_RANGE';
  end if;

  p_amount := round(p_amount::numeric, 2);

  perform pg_advisory_xact_lock(
    hashtextextended(
      'bodygate-membership-request:' || p_request_hash,
      0
    )
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'bodygate-membership-customer:' || p_customer_id::text,
      0
    )
  );

  insert into public.bodygate_atomic_operations (
    operation_type,
    idempotency_key,
    request_hash,
    customer_id,
    status
  )
  values (
    'membership_fee_renewal',
    p_idempotency_key,
    p_request_hash,
    p_customer_id,
    'processing'
  )
  on conflict (operation_type, idempotency_key) do nothing
  returning id into v_inserted_operation_id;

  if v_inserted_operation_id is null then
    select *
    into v_operation
    from public.bodygate_atomic_operations
    where operation_type = 'membership_fee_renewal'
      and idempotency_key = p_idempotency_key
    for update;

    if not found then
      raise exception 'BODYGATE_IDEMPOTENCY_OPERATION_INCOMPLETE';
    end if;

    if v_operation.request_hash <> p_request_hash
       or v_operation.customer_id <> p_customer_id then
      raise exception 'BODYGATE_IDEMPOTENCY_PAYLOAD_MISMATCH';
    end if;

    if v_operation.status = 'completed'
       and v_operation.response_payload is not null then
      return v_operation.response_payload
        || jsonb_build_object(
          'replayed', true,
          'replay_source', 'idempotency_key'
        );
    end if;

    raise exception 'BODYGATE_IDEMPOTENCY_OPERATION_INCOMPLETE';
  end if;

  select *
  into v_operation
  from public.bodygate_atomic_operations
  where id = v_inserted_operation_id
  for update;

  select *
  into v_recent_operation
  from public.bodygate_atomic_operations
  where operation_type = 'membership_fee_renewal'
    and request_hash = p_request_hash
    and id <> v_operation.id
    and status = 'completed'
    and response_payload is not null
    and completed_at >= v_now - interval '10 minutes'
  order by completed_at desc
  limit 1;

  if found then
    v_response :=
      v_recent_operation.response_payload
      || jsonb_build_object(
        'replayed', true,
        'replay_source', 'recent_request_hash',
        'operation_id', v_operation.id,
        'idempotency_key', p_idempotency_key,
        'source_operation_id', v_recent_operation.id
      );

    update public.bodygate_atomic_operations
    set
      customer_id = v_recent_operation.customer_id,
      status = 'completed',
      membership_fee_id = v_recent_operation.membership_fee_id,
      customer_payment_id = v_recent_operation.customer_payment_id,
      payment_id = v_recent_operation.payment_id,
      receipt_id = v_recent_operation.receipt_id,
      document_id = v_recent_operation.document_id,
      response_payload = v_response,
      completed_at = v_now
    where id = v_operation.id;

    return v_response;
  end if;

  select *
  into v_customer
  from public.customers
  where id = p_customer_id;

  if not found then
    raise exception 'BODYGATE_NOT_FOUND_CUSTOMER';
  end if;

  if not p_allow_duplicate then
    perform 1
    from public.customer_membership_fees
    where customer_id = p_customer_id
      and valid_from = p_valid_from
      and valid_until = p_valid_until
    limit 1;

    if found then
      raise exception 'BODYGATE_DUPLICATE_MEMBERSHIP_FEE';
    end if;

    v_year := extract(year from p_valid_from)::integer;

    perform 1
    from public.customer_receipts
    where customer_id = p_customer_id
      and receipt_type = 'membership_fee'
      and description ilike
        '%Quota associativa Body Energy ASD anno '
        || v_year::text
        || '%'
    limit 1;

    if found then
      raise exception 'BODYGATE_DUPLICATE_MEMBERSHIP_RECEIPT';
    end if;
  end if;

  v_year := extract(year from p_valid_from)::integer;
  v_description :=
    'Quota associativa Body Energy ASD anno ' || v_year::text;

  insert into public.customer_membership_fees (
    customer_id,
    branch_id,
    amount,
    paid_at,
    valid_from,
    valid_until,
    payment_method,
    notes
  )
  values (
    p_customer_id,
    v_customer.branch_id,
    p_amount,
    v_now,
    p_valid_from,
    p_valid_until,
    p_payment_method,
    v_description
  )
  returning * into v_membership_fee;

  insert into public.customer_payments (
    customer_id,
    amount,
    type,
    description,
    payment_method,
    status,
    paid_at,
    notes
  )
  values (
    p_customer_id,
    p_amount,
    'membership_fee',
    v_description,
    p_payment_method,
    'paid',
    v_now,
    'ValiditÃƒÂ  '
      || p_valid_from::text
      || ' - '
      || p_valid_until::text
  )
  returning * into v_customer_payment;

  insert into public.payments (
    customer_id,
    payment_method_id,
    amount,
    payment_type,
    description,
    status,
    paid_at,
    created_by
  )
  values (
    p_customer_id,
    null,
    p_amount,
    'membership_fee',
    v_description,
    'paid',
    v_now,
    'admin@bodygate.it'
  )
  returning * into v_payment;

  v_receipt_number_payload :=
    public.next_bodygate_receipt_number_v2();

  if v_receipt_number_payload is null
     or nullif(v_receipt_number_payload->>'receipt_number', '') is null then
    raise exception 'BODYGATE_RECEIPT_NUMBER_INVALID';
  end if;

  insert into public.customer_receipts (
    customer_id,
    payment_id,
    receipt_year,
    receipt_sequence,
    receipt_number,
    receipt_type,
    amount,
    description,
    customer_copy_label,
    gym_copy_label,
    issued_at
  )
  values (
    p_customer_id,
    v_customer_payment.id,
    (v_receipt_number_payload->>'receipt_year')::integer,
    (v_receipt_number_payload->>'receipt_sequence')::integer,
    v_receipt_number_payload->>'receipt_number',
    'membership_fee',
    p_amount,
    v_description,
    'COPIA CLIENTE',
    'COPIA PALESTRA',
    v_now
  )
  returning * into v_receipt;

  insert into public.customer_timeline (
    customer_id,
    type,
    title,
    description,
    created_at
  )
  values (
    p_customer_id,
    'membership',
    'Quota associativa incassata',
    v_description
      || ' - Ã¢â€šÂ¬'
      || replace(to_char(p_amount, 'FM999999990.00'), '.', ',')
      || ' - ricevuta '
      || v_receipt.receipt_number,
    v_now
  );

  insert into public.customer_documents (
    customer_id,
    document_type,
    title,
    status
  )
  values (
    p_customer_id,
    'contract',
    'Contratto associativo Body Energy ASD '
      || p_valid_from::text
      || ' - '
      || p_valid_until::text,
    'generated'
  )
  returning * into v_document;

  v_response :=
    jsonb_build_object(
      'ok', true,
      'replayed', false,
      'operation_id', v_operation.id,
      'idempotency_key', p_idempotency_key,
      'customer_id', p_customer_id,
      'membership_fee', to_jsonb(v_membership_fee),
      'customer_payment', to_jsonb(v_customer_payment),
      'payment', to_jsonb(v_payment),
      'receipt', to_jsonb(v_receipt),
      'contract_document', to_jsonb(v_document)
    );

  update public.bodygate_atomic_operations
  set
    status = 'completed',
    membership_fee_id = v_membership_fee.id,
    customer_payment_id = v_customer_payment.id,
    payment_id = v_payment.id,
    receipt_id = v_receipt.id,
    document_id = v_document.id,
    response_payload = v_response,
    completed_at = v_now
  where id = v_operation.id;

  return v_response;
end;
$function$
;
revoke all on function public.renew_membership_fee_atomic_v1(p_idempotency_key text, p_request_hash text, p_customer_id uuid, p_amount numeric, p_payment_method text, p_valid_from date, p_valid_until date, p_allow_duplicate boolean) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.renew_subscription_atomic_v1(p_idempotency_key text, p_request_hash text, p_customer_id uuid, p_plan_id uuid, p_payment_method text, p_start_date date, p_requested_amount numeric DEFAULT NULL::numeric, p_notes text DEFAULT NULL::text, p_badge_charge_mode text DEFAULT 'not_included'::text, p_badge_fee numeric DEFAULT 0, p_badge_complimentary_reason text DEFAULT NULL::text, p_new_badge_delivered boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_operation public.subscription_renewal_operations%rowtype;
  v_recent_operation public.subscription_renewal_operations%rowtype;
  v_customer public.customers%rowtype;
  v_plan public.subscription_plans%rowtype;
  v_subscription public.customer_subscriptions%rowtype;
  v_customer_payment public.customer_payments%rowtype;
  v_payment public.payments%rowtype;
  v_receipt public.customer_receipts%rowtype;
  v_receipt_number_payload jsonb;
  v_response jsonb;
  v_branch_id uuid;
  v_subscription_amount numeric;
  v_badge_amount numeric;
  v_total_amount numeric;
  v_duration_days integer;
  v_ends_at date;
  v_now timestamptz := clock_timestamp();
  v_customer_name text;
  v_payment_description text;
  v_receipt_description text;
  v_receipt_components jsonb;
  v_inserted_operation_id uuid;
begin
  p_idempotency_key := trim(coalesce(p_idempotency_key, ''));
  p_request_hash := lower(trim(coalesce(p_request_hash, '')));
  p_payment_method := lower(trim(coalesce(p_payment_method, '')));
  p_badge_charge_mode := lower(trim(coalesce(p_badge_charge_mode, 'not_included')));
  p_notes := nullif(trim(coalesce(p_notes, '')), '');
  p_badge_complimentary_reason :=
    nullif(trim(coalesce(p_badge_complimentary_reason, '')), '');

  if char_length(p_idempotency_key) < 16
     or char_length(p_idempotency_key) > 180
     or p_idempotency_key !~ '^[A-Za-z0-9:_-]+$' then
    raise exception 'BODYGATE_VALIDATION_IDEMPOTENCY_KEY';
  end if;

  if p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'BODYGATE_VALIDATION_REQUEST_HASH';
  end if;

  if p_customer_id is null then
    raise exception 'BODYGATE_VALIDATION_CUSTOMER_ID';
  end if;

  if p_plan_id is null then
    raise exception 'BODYGATE_VALIDATION_PLAN_ID';
  end if;

  if p_start_date is null then
    raise exception 'BODYGATE_VALIDATION_START_DATE';
  end if;

  if p_payment_method not in ('cash', 'pos', 'bank_transfer') then
    raise exception 'BODYGATE_VALIDATION_PAYMENT_METHOD';
  end if;

  if p_badge_charge_mode not in ('not_included', 'charged', 'complimentary') then
    raise exception 'BODYGATE_VALIDATION_BADGE_MODE';
  end if;

  if coalesce(p_badge_fee, 0) < 0 then
    raise exception 'BODYGATE_VALIDATION_BADGE_FEE';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bodygate-renewal-request:' || p_request_hash, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('bodygate-renewal-customer:' || p_customer_id::text, 0)
  );

  insert into public.subscription_renewal_operations (
    idempotency_key,
    request_hash,
    customer_id,
    plan_id,
    status
  )
  values (
    p_idempotency_key,
    p_request_hash,
    p_customer_id,
    p_plan_id,
    'processing'
  )
  on conflict (idempotency_key) do nothing
  returning id into v_inserted_operation_id;

  if v_inserted_operation_id is null then
    select *
    into v_operation
    from public.subscription_renewal_operations
    where idempotency_key = p_idempotency_key
    for update;

    if not found then
      raise exception 'BODYGATE_IDEMPOTENCY_OPERATION_INCOMPLETE';
    end if;

    if v_operation.request_hash <> p_request_hash
       or v_operation.customer_id <> p_customer_id
       or v_operation.plan_id <> p_plan_id then
      raise exception 'BODYGATE_IDEMPOTENCY_PAYLOAD_MISMATCH';
    end if;

    if v_operation.status = 'completed'
       and v_operation.response_payload is not null then
      return v_operation.response_payload
        || jsonb_build_object(
          'replayed', true,
          'replay_source', 'idempotency_key'
        );
    end if;

    raise exception 'BODYGATE_IDEMPOTENCY_OPERATION_INCOMPLETE';
  end if;

  select *
  into v_operation
  from public.subscription_renewal_operations
  where id = v_inserted_operation_id
  for update;

  select *
  into v_recent_operation
  from public.subscription_renewal_operations
  where request_hash = p_request_hash
    and id <> v_operation.id
    and status = 'completed'
    and response_payload is not null
    and completed_at >= v_now - interval '10 minutes'
  order by completed_at desc
  limit 1;

  if found then
    v_response :=
      v_recent_operation.response_payload
      || jsonb_build_object(
        'replayed', true,
        'replay_source', 'recent_request_hash',
        'operation_id', v_operation.id,
        'idempotency_key', p_idempotency_key,
        'source_operation_id', v_recent_operation.id
      );

    update public.subscription_renewal_operations
    set
      branch_id = v_recent_operation.branch_id,
      status = 'completed',
      subscription_id = v_recent_operation.subscription_id,
      customer_payment_id = v_recent_operation.customer_payment_id,
      payment_id = v_recent_operation.payment_id,
      receipt_id = v_recent_operation.receipt_id,
      receipt_number = v_recent_operation.receipt_number,
      response_payload = v_response,
      completed_at = v_now
    where id = v_operation.id;

    return v_response;
  end if;

  select *
  into v_customer
  from public.customers
  where id = p_customer_id;

  if not found then
    raise exception 'BODYGATE_NOT_FOUND_CUSTOMER';
  end if;

  select *
  into v_plan
  from public.subscription_plans
  where id = p_plan_id;

  if not found then
    raise exception 'BODYGATE_NOT_FOUND_PLAN';
  end if;

  if v_plan.is_active is false then
    raise exception 'BODYGATE_VALIDATION_PLAN_INACTIVE';
  end if;

  if v_plan.name not in (
    'Mensile',
    'Trimestrale',
    'Semestrale',
    'Annuale',
    'Annuale ridotto Lun Mer Ven',
    'Annuale ridotto Mar Gio Sab',
    'Mensile Ridotto Lunedi-Mercoledi-Venerdi',
    'Mensile Ridotto Martedi-Giovedi-Sabato',
    'Pilates'
  ) then
    raise exception 'BODYGATE_VALIDATION_PLAN_NOT_ALLOWED';
  end if;

  if v_customer.branch_id is not null
     and v_plan.branch_id is not null
     and v_customer.branch_id <> v_plan.branch_id then
    raise exception 'BODYGATE_VALIDATION_BRANCH_MISMATCH';
  end if;

  v_branch_id := coalesce(v_customer.branch_id, v_plan.branch_id);

  if v_branch_id is null then
    raise exception 'BODYGATE_VALIDATION_BRANCH_REQUIRED';
  end if;

  v_duration_days := coalesce(v_plan.duration_days, 0);

  if v_duration_days <= 0 then
    raise exception 'BODYGATE_VALIDATION_DURATION';
  end if;

  v_subscription_amount :=
    coalesce(
      p_requested_amount,
      nullif(v_plan.promo_price, 0),
      v_plan.price
    );

  if v_subscription_amount is null or v_subscription_amount <= 0 then
    raise exception 'BODYGATE_VALIDATION_AMOUNT';
  end if;

  if p_badge_charge_mode = 'charged'
     and not coalesce(p_new_badge_delivered, false) then
    raise exception 'BODYGATE_VALIDATION_BADGE_DELIVERY';
  end if;

  if p_badge_charge_mode = 'complimentary'
     and p_badge_complimentary_reason is null then
    raise exception 'BODYGATE_VALIDATION_BADGE_REASON';
  end if;

  v_badge_amount :=
    case
      when p_badge_charge_mode = 'charged'
        then round(coalesce(p_badge_fee, 0)::numeric, 2)
      else 0
    end;

  v_subscription_amount := round(v_subscription_amount::numeric, 2);
  v_total_amount := v_subscription_amount + v_badge_amount;
  v_ends_at := p_start_date + v_duration_days;
  v_customer_name :=
    trim(concat_ws(' ', v_customer.first_name, v_customer.last_name));

  v_receipt_components :=
    jsonb_build_array(
      jsonb_build_object(
        'code', 'subscription',
        'label', 'Abbonamento ' || v_plan.name,
        'amount', v_subscription_amount
      )
    );

  if p_badge_charge_mode <> 'not_included' then
    v_receipt_components :=
      v_receipt_components
      || jsonb_build_array(
        jsonb_build_object(
          'code', 'rfid_badge',
          'label', 'Badge RFID',
          'amount', v_badge_amount
        )
      );
  end if;

  v_payment_description :=
    'Rinnovo abbonamento '
    || v_plan.name
    || ' ('
    || p_start_date::text
    || ' - '
    || v_ends_at::text
    || ')'
    || case
         when p_badge_charge_mode <> 'not_included'
           then ' + Badge RFID €'
             || replace(to_char(v_badge_amount, 'FM999999990.00'), '.', ',')
         else ''
       end;

  v_receipt_description :=
    v_payment_description
    || case
         when v_customer_name <> '' then ' - ' || v_customer_name
         else ''
       end;

  if p_start_date <= current_date then
    update public.customer_subscriptions
    set is_active = false
    where customer_id = p_customer_id
      and is_active = true;
  else
    update public.customer_subscriptions
    set is_active = false
    where customer_id = p_customer_id
      and is_active = true
      and starts_at >= p_start_date;
  end if;

  insert into public.customer_subscriptions (
    customer_id,
    branch_id,
    plan_id,
    amount,
    starts_at,
    ends_at,
    is_active,
    payment_method,
    notes
  )
  values (
    p_customer_id,
    v_branch_id,
    p_plan_id,
    v_subscription_amount,
    p_start_date,
    v_ends_at,
    true,
    p_payment_method,
    coalesce(p_notes, 'Rinnovo guidato ' || v_plan.name)
  )
  returning * into v_subscription;

  if v_customer.is_active is distinct from true
     or v_customer.active is distinct from true then
    update public.customers
    set
      is_active = true,
      active = true,
      status = case when status = 'onboarding' then 'active' else status end
    where id = p_customer_id;

    insert into public.customer_timeline (
      customer_id,
      type,
      title,
      description,
      created_at
    )
    values (
      p_customer_id,
      'customer',
      'Cliente riattivato',
      'Riattivazione automatica in seguito a rinnovo abbonamento ' || v_plan.name,
      v_now
    );
  end if;

  insert into public.customer_payments (
    customer_id,
    type,
    description,
    amount,
    payment_method,
    status,
    paid_at,
    notes
  )
  values (
    p_customer_id,
    'subscription',
    v_payment_description,
    v_total_amount,
    p_payment_method,
    'paid',
    v_now,
    p_notes
  )
  returning * into v_customer_payment;

  insert into public.payments (
    customer_id,
    amount,
    method,
    paid_at,
    notes,
    subscription_days,
    payment_method,
    description,
    payment_method_id,
    payment_type,
    status,
    created_by
  )
  values (
    p_customer_id,
    v_total_amount,
    p_payment_method,
    v_now,
    p_notes,
    v_duration_days,
    p_payment_method,
    v_payment_description,
    null,
    'subscription',
    'paid',
    'admin@bodygate.it'
  )
  returning * into v_payment;

  insert into public.customer_timeline (
    customer_id,
    type,
    title,
    description,
    created_at
  )
  values (
    p_customer_id,
    'subscription',
    'Abbonamento rinnovato',
    v_plan.name
      || ' €'
      || replace(to_char(v_subscription_amount, 'FM999999990.00'), '.', ',')
      || ' valido dal '
      || p_start_date::text
      || ' al '
      || v_ends_at::text,
    v_now
  );

  v_receipt_number_payload :=
    public.next_bodygate_receipt_number_v2();

  if v_receipt_number_payload is null
     or nullif(v_receipt_number_payload->>'receipt_number', '') is null then
    raise exception 'BODYGATE_RECEIPT_NUMBER_INVALID';
  end if;

  insert into public.customer_receipts (
    customer_id,
    payment_id,
    subscription_id,
    receipt_year,
    receipt_sequence,
    receipt_number,
    receipt_type,
    amount,
    description,
    customer_copy_label,
    gym_copy_label,
    issued_at,
    receipt_components
  )
  values (
    p_customer_id,
    v_customer_payment.id,
    v_subscription.id,
    (v_receipt_number_payload->>'receipt_year')::integer,
    (v_receipt_number_payload->>'receipt_sequence')::integer,
    v_receipt_number_payload->>'receipt_number',
    'subscription',
    v_total_amount,
    v_receipt_description,
    'COPIA CLIENTE',
    'COPIA PALESTRA',
    v_now,
    v_receipt_components
  )
  returning * into v_receipt;

  v_response :=
    jsonb_build_object(
      'ok', true,
      'replayed', false,
      'operation_id', v_operation.id,
      'idempotency_key', p_idempotency_key,
      'customer_id', p_customer_id,
      'customer_name', v_customer_name,
      'plan', jsonb_build_object(
        'id', v_plan.id,
        'name', v_plan.name,
        'duration_days', v_duration_days
      ),
      'subscription', to_jsonb(v_subscription),
      'payment', to_jsonb(v_customer_payment),
      'accounting_payment', to_jsonb(v_payment),
      'receipt', to_jsonb(v_receipt)
    );

  update public.subscription_renewal_operations
  set
    branch_id = v_branch_id,
    status = 'completed',
    subscription_id = v_subscription.id,
    customer_payment_id = v_customer_payment.id,
    payment_id = v_payment.id,
    receipt_id = v_receipt.id,
    receipt_number = v_receipt.receipt_number,
    response_payload = v_response,
    completed_at = v_now
  where id = v_operation.id;

  return v_response;
end;
$function$
;
revoke all on function public.renew_subscription_atomic_v1(p_idempotency_key text, p_request_hash text, p_customer_id uuid, p_plan_id uuid, p_payment_method text, p_start_date date, p_requested_amount numeric, p_notes text, p_badge_charge_mode text, p_badge_fee numeric, p_badge_complimentary_reason text, p_new_badge_delivered boolean) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_enrollment_bookings_atomic_v1(p_idempotency_key text, p_request_hash text, p_schedule_id uuid)
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
$function$
;
revoke all on function public.sync_enrollment_bookings_atomic_v1(p_idempotency_key text, p_request_hash text, p_schedule_id uuid) from public, anon, authenticated;


-- Segnali live senza dati (migrazione 20261108130000_live_change_signals_v1).
CREATE OR REPLACE FUNCTION public.bodygate_notify_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  begin
    perform realtime.send(
      jsonb_build_object('table', tg_table_name),
      'change',
      'bodygate-live',
      false
    );
  exception when others then
    null;
  end;
  return null;
end;
$function$;
revoke all on function public.bodygate_notify_change() from public, anon, authenticated;
