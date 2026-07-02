-- BodyGate Courses Core 1.0
-- DRY RUN ATOMICO CON ROLLBACK
-- Nessun dato resterà nel database.

begin;

do $bodygate$
declare
  v_branch_id uuid;
  v_customer_id uuid;
  v_course_type_id uuid;
  v_room_id uuid;
  v_schedule_id uuid;
  v_session_id uuid;
  v_booking_id uuid;
  v_result jsonb;
  v_today date := current_date;
  v_target_date date;
  v_weekday integer;
begin
  select b.id
  into v_branch_id
  from public.branches b
  where coalesce(b.is_active, true)
  order by b.created_at nulls last, b.id
  limit 1;

  if v_branch_id is null then
    raise exception 'DRY_RUN_NO_ACTIVE_BRANCH';
  end if;

  select c.id
  into v_customer_id
  from public.customers c
  where c.branch_id = v_branch_id
    and coalesce(c.is_active, true)
    and coalesce(c.active, true)
  order by c.created_at nulls last, c.id
  limit 1;

  if v_customer_id is null then
    raise exception 'DRY_RUN_NO_ACTIVE_CUSTOMER_FOR_BRANCH';
  end if;

  -- Tipo corso senza requisiti medici/economici per isolare il test del core.
  v_result := public.create_course_type_atomic_v1(
    'dryrun_course_type_20260702',
    repeat('1', 64),
    jsonb_build_object(
      'branch_id', v_branch_id,
      'name', 'DRY RUN Pilates Reformer',
      'slug', 'dry-run-pilates-reformer',
      'description', 'Record temporaneo dry-run',
      'default_duration_minutes', 50,
      'default_capacity', 4,
      'color', '#dc2626',
      'requires_medical_certificate', false,
      'requires_active_subscription', false,
      'booking_enabled', true,
      'waitlist_enabled', true,
      'cancellation_cutoff_minutes', 120
    )
  );

  v_course_type_id := (v_result->>'course_type_id')::uuid;

  v_result := public.create_course_room_atomic_v1(
    'dryrun_course_room_20260702',
    repeat('2', 64),
    jsonb_build_object(
      'branch_id', v_branch_id,
      'name', 'DRY RUN Sala Reformer',
      'description', 'Sala temporanea dry-run',
      'capacity', 4
    )
  );

  v_room_id := (v_result->>'course_room_id')::uuid;

  v_target_date := v_today + 7;
  v_weekday := extract(isodow from v_target_date)::integer;

  v_result := public.create_course_schedule_atomic_v1(
    'dryrun_schedule_20260702',
    repeat('3', 64),
    jsonb_build_object(
      'branch_id', v_branch_id,
      'course_type_id', v_course_type_id,
      'room_id', v_room_id,
      'weekday', v_weekday,
      'start_time', '18:00',
      'duration_minutes', 50,
      'capacity', 4,
      'valid_from', v_target_date,
      'valid_until', v_target_date + 30,
      'generation_horizon_days', 30,
      'status', 'active'
    )
  );

  v_schedule_id := (v_result->>'course_schedule_id')::uuid;

  v_result := public.generate_course_sessions_atomic_v1(
    'dryrun_generate_20260702',
    repeat('4', 64),
    v_schedule_id,
    v_target_date,
    v_target_date + 7
  );

  select cs.id
  into v_session_id
  from public.course_sessions cs
  where cs.schedule_id = v_schedule_id
  order by cs.starts_at
  limit 1;

  if v_session_id is null then
    raise exception 'DRY_RUN_SESSION_NOT_GENERATED';
  end if;

  v_result := public.book_course_session_atomic_v1(
    'dryrun_booking_20260702',
    repeat('5', 64),
    v_session_id,
    v_customer_id,
    'admin'
  );

  v_booking_id := (v_result->>'booking_id')::uuid;

  if coalesce(v_result->>'status', '') <> 'confirmed' then
    raise exception 'DRY_RUN_BOOKING_NOT_CONFIRMED: %', v_result;
  end if;

  -- Replay idempotente: deve restituire lo stesso booking.
  v_result := public.book_course_session_atomic_v1(
    'dryrun_booking_20260702',
    repeat('5', 64),
    v_session_id,
    v_customer_id,
    'admin'
  );

  if (v_result->>'booking_id')::uuid <> v_booking_id then
    raise exception 'DRY_RUN_IDEMPOTENCY_REPLAY_FAILED';
  end if;

  v_result := public.check_in_course_booking_atomic_v1(
    'dryrun_checkin_20260702',
    repeat('6', 64),
    v_booking_id
  );

  if coalesce(v_result->>'status', '') <> 'attended' then
    raise exception 'DRY_RUN_CHECKIN_FAILED: %', v_result;
  end if;

  v_result := public.complete_course_session_atomic_v1(
    'dryrun_complete_20260702',
    repeat('7', 64),
    v_session_id
  );

  if coalesce(v_result->>'status', '') <> 'completed' then
    raise exception 'DRY_RUN_COMPLETE_FAILED: %', v_result;
  end if;

  raise notice 'BODYGATE COURSES DRY RUN OK';
  raise notice 'branch_id=% customer_id=%', v_branch_id, v_customer_id;
  raise notice 'course_type_id=% room_id=% schedule_id=%', v_course_type_id, v_room_id, v_schedule_id;
  raise notice 'session_id=% booking_id=%', v_session_id, v_booking_id;
end;
$bodygate$;

rollback;

select
  (select count(*) from public.course_types where name = 'DRY RUN Pilates Reformer') = 0
    as course_type_rolled_back,
  (select count(*) from public.course_rooms where name = 'DRY RUN Sala Reformer') = 0
    as room_rolled_back,
  (
    select count(*)
    from public.bodygate_atomic_operations
    where idempotency_key like 'dryrun_%_20260702'
  ) = 0 as atomic_operations_rolled_back;
