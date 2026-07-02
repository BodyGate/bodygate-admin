-- BodyGate Courses Core 1.0
-- DRY RUN WAITLIST + PROMOZIONE ATOMICA + ROLLBACK

begin;

do $bodygate$
declare
  v_branch_id uuid;
  v_customer_1 uuid;
  v_customer_2 uuid;
  v_course_type_id uuid;
  v_room_id uuid;
  v_schedule_id uuid;
  v_session_id uuid;
  v_booking_1 uuid;
  v_booking_2 uuid;
  v_result jsonb;
  v_target_date date := current_date + 1000;
  v_weekday integer;
begin
  select c.branch_id
  into v_branch_id
  from public.customers c
  where c.branch_id is not null
    and coalesce(c.is_active, true)
    and coalesce(c.active, true)
  group by c.branch_id
  having count(*) >= 2
  order by c.branch_id
  limit 1;

  if v_branch_id is null then
    raise exception 'DRY_RUN_REQUIRES_TWO_ACTIVE_CUSTOMERS_SAME_BRANCH';
  end if;

  select c.id
  into v_customer_1
  from public.customers c
  where c.branch_id = v_branch_id
    and coalesce(c.is_active, true)
    and coalesce(c.active, true)
  order by c.created_at nulls last, c.id
  limit 1;

  select c.id
  into v_customer_2
  from public.customers c
  where c.branch_id = v_branch_id
    and coalesce(c.is_active, true)
    and coalesce(c.active, true)
    and c.id <> v_customer_1
  order by c.created_at nulls last, c.id
  limit 1;

  if v_customer_1 is null
     or v_customer_2 is null
     or v_customer_1 = v_customer_2 then
    raise exception 'DRY_RUN_CUSTOMER_SELECTION_FAILED';
  end if;

  v_result := public.create_course_type_atomic_v1(
    'dryrun_waitlist_type_20260702',
    repeat('a', 64),
    jsonb_build_object(
      'branch_id', v_branch_id,
      'name', 'DRY RUN Waitlist Pilates',
      'slug', 'dry-run-waitlist-pilates',
      'description', 'Test temporaneo waitlist',
      'default_duration_minutes', 50,
      'default_capacity', 1,
      'requires_medical_certificate', false,
      'requires_active_subscription', false,
      'booking_enabled', true,
      'waitlist_enabled', true,
      'cancellation_cutoff_minutes', 0
    )
  );

  v_course_type_id := (v_result->>'course_type_id')::uuid;

  v_result := public.create_course_room_atomic_v1(
    'dryrun_waitlist_room_20260702',
    repeat('b', 64),
    jsonb_build_object(
      'branch_id', v_branch_id,
      'name', 'DRY RUN Waitlist Room',
      'capacity', 1
    )
  );

  v_room_id := (v_result->>'course_room_id')::uuid;

  v_weekday := extract(isodow from v_target_date)::integer;

  v_result := public.create_course_schedule_atomic_v1(
    'dryrun_waitlist_schedule_20260702',
    repeat('c', 64),
    jsonb_build_object(
      'branch_id', v_branch_id,
      'course_type_id', v_course_type_id,
      'room_id', v_room_id,
      'weekday', v_weekday,
      'start_time', '03:00',
      'duration_minutes', 50,
      'capacity', 1,
      'valid_from', v_target_date,
      'valid_until', v_target_date,
      'generation_horizon_days', 1,
      'status', 'active'
    )
  );

  v_schedule_id := (v_result->>'course_schedule_id')::uuid;

  perform public.generate_course_sessions_atomic_v1(
    'dryrun_waitlist_generate_20260702',
    repeat('d', 64),
    v_schedule_id,
    v_target_date,
    v_target_date
  );

  select id
  into v_session_id
  from public.course_sessions
  where schedule_id = v_schedule_id
  limit 1;

  if v_session_id is null then
    raise exception 'DRY_RUN_WAITLIST_SESSION_NOT_GENERATED';
  end if;

  v_result := public.book_course_session_atomic_v1(
    'dryrun_waitlist_booking1_20260702',
    repeat('e', 64),
    v_session_id,
    v_customer_1,
    'admin'
  );

  v_booking_1 := (v_result->>'booking_id')::uuid;

  if v_result->>'status' <> 'confirmed' then
    raise exception 'DRY_RUN_FIRST_CUSTOMER_NOT_CONFIRMED: %', v_result;
  end if;

  v_result := public.book_course_session_atomic_v1(
    'dryrun_waitlist_booking2_20260702',
    repeat('f', 64),
    v_session_id,
    v_customer_2,
    'admin'
  );

  v_booking_2 := (v_result->>'booking_id')::uuid;

  if v_result->>'status' <> 'waitlisted'
     or (v_result->>'waitlist_position')::integer <> 1 then
    raise exception 'DRY_RUN_SECOND_CUSTOMER_NOT_WAITLISTED: %', v_result;
  end if;

  v_result := public.cancel_course_booking_atomic_v1(
    'dryrun_waitlist_cancel_20260702',
    repeat('1', 64),
    v_booking_1,
    'Dry-run promozione automatica'
  );

  if v_result->>'status' <> 'cancelled' then
    raise exception 'DRY_RUN_CANCELLATION_FAILED: %', v_result;
  end if;

  if (v_result->>'promoted_booking_id')::uuid <> v_booking_2 then
    raise exception 'DRY_RUN_WRONG_PROMOTED_BOOKING: %', v_result;
  end if;

  if not exists (
    select 1
    from public.course_bookings
    where id = v_booking_2
      and status = 'confirmed'
      and waitlist_position is null
      and confirmed_at is not null
  ) then
    raise exception 'DRY_RUN_WAITLIST_PROMOTION_NOT_PERSISTED';
  end if;

  if exists (
    select 1
    from public.course_bookings
    where session_id = v_session_id
      and status = 'waitlisted'
  ) then
    raise exception 'DRY_RUN_WAITLIST_NOT_REORDERED';
  end if;
end;
$bodygate$;

rollback;

select
  (select count(*) from public.course_types where name = 'DRY RUN Waitlist Pilates') = 0
    as course_type_rolled_back,
  (select count(*) from public.course_rooms where name = 'DRY RUN Waitlist Room') = 0
    as room_rolled_back,
  (
    select count(*)
    from public.bodygate_atomic_operations
    where idempotency_key like 'dryrun_waitlist_%_20260702'
  ) = 0
    as atomic_operations_rolled_back;
