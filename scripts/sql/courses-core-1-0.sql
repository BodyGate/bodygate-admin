-- BodyGate Courses Core 1.0
-- Modulo corsi Platinum, atomico e idempotente.
-- Non modifica access control, Mobile Pass, DNake, Bridge, pagamenti, ricevute o prima nota.

begin;

create extension if not exists btree_gist;

alter table public.bodygate_atomic_operations
  drop constraint if exists bodygate_atomic_operations_type_check;

alter table public.bodygate_atomic_operations
  add constraint bodygate_atomic_operations_type_check
  check (
    operation_type in (
      'membership_fee_renewal',
      'platinum_onboarding',
      'course_type_create',
      'course_room_create',
      'course_schedule_create',
      'course_sessions_generate',
      'course_booking_create',
      'course_booking_cancel',
      'course_booking_check_in',
      'course_session_complete',
      'course_session_cancel'
    )
  );

create table public.course_types (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  name text not null,
  slug text not null,
  description text,
  default_duration_minutes integer not null default 50,
  default_capacity integer not null default 1,
  color text not null default '#dc2626',
  requires_medical_certificate boolean not null default true,
  requires_active_subscription boolean not null default false,
  booking_enabled boolean not null default true,
  waitlist_enabled boolean not null default true,
  cancellation_cutoff_minutes integer not null default 120,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_types_duration_check check (default_duration_minutes > 0 and default_duration_minutes <= 1440),
  constraint course_types_capacity_check check (default_capacity > 0),
  constraint course_types_cutoff_check check (cancellation_cutoff_minutes >= 0),
  constraint course_types_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint course_types_branch_slug_key unique (branch_id, slug)
);

create unique index course_types_branch_name_key
  on public.course_types (branch_id, lower(name));

create table public.course_rooms (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  name text not null,
  description text,
  capacity integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_rooms_capacity_check check (capacity > 0)
);

create unique index course_rooms_branch_name_key
  on public.course_rooms (branch_id, lower(name));

create table public.course_schedules (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  course_type_id uuid not null references public.course_types(id) on delete restrict,
  room_id uuid not null references public.course_rooms(id) on delete restrict,
  instructor_staff_user_id uuid references public.staff_users(id) on delete restrict,
  weekday smallint not null,
  start_time time not null,
  duration_minutes integer not null,
  capacity integer not null,
  valid_from date not null,
  valid_until date,
  generation_horizon_days integer not null default 60,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_schedules_weekday_check check (weekday between 1 and 7),
  constraint course_schedules_duration_check check (duration_minutes > 0 and duration_minutes <= 1440),
  constraint course_schedules_capacity_check check (capacity > 0),
  constraint course_schedules_dates_check check (valid_until is null or valid_until >= valid_from),
  constraint course_schedules_horizon_check check (generation_horizon_days between 1 and 366),
  constraint course_schedules_status_check check (status in ('draft','active','paused','archived'))
);

create index course_schedules_branch_status_idx
  on public.course_schedules (branch_id, status, weekday, start_time);

create table public.course_sessions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  course_type_id uuid not null references public.course_types(id) on delete restrict,
  schedule_id uuid references public.course_schedules(id) on delete restrict,
  room_id uuid not null references public.course_rooms(id) on delete restrict,
  instructor_staff_user_id uuid references public.staff_users(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null,
  status text not null default 'open',
  booking_opens_at timestamptz,
  booking_closes_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_sessions_time_check check (starts_at < ends_at),
  constraint course_sessions_capacity_check check (capacity > 0),
  constraint course_sessions_status_check check (status in ('scheduled','open','closed','completed','cancelled')),
  constraint course_sessions_booking_window_check check (
    booking_opens_at is null
    or booking_closes_at is null
    or booking_opens_at <= booking_closes_at
  ),
  constraint course_sessions_schedule_start_key unique (schedule_id, starts_at)
);

alter table public.course_sessions
  add constraint course_sessions_room_no_overlap
  exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status <> 'cancelled');

alter table public.course_sessions
  add constraint course_sessions_instructor_no_overlap
  exclude using gist (
    instructor_staff_user_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status <> 'cancelled' and instructor_staff_user_id is not null);

create index course_sessions_branch_start_idx
  on public.course_sessions (branch_id, starts_at, status);

create table public.course_bookings (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  session_id uuid not null references public.course_sessions(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  status text not null,
  waitlist_position integer,
  booking_source text not null default 'reception',
  booked_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  checked_in_at timestamptz,
  completed_at timestamptz,
  late_cancellation boolean not null default false,
  cancellation_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_bookings_status_check check (
    status in ('confirmed','waitlisted','cancelled','attended','no_show')
  ),
  constraint course_bookings_waitlist_check check (
    (status = 'waitlisted' and waitlist_position is not null and waitlist_position > 0)
    or
    (status <> 'waitlisted' and waitlist_position is null)
  ),
  constraint course_bookings_source_check check (
    booking_source in ('reception','admin','mobile_pass','system','import')
  ),
  constraint course_bookings_session_customer_key unique (session_id, customer_id)
);

create index course_bookings_session_status_idx
  on public.course_bookings (session_id, status, booked_at, id);

create index course_bookings_customer_idx
  on public.course_bookings (customer_id, booked_at desc);

create table public.course_activity_log (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  course_type_id uuid references public.course_types(id) on delete set null,
  schedule_id uuid references public.course_schedules(id) on delete set null,
  session_id uuid references public.course_sessions(id) on delete set null,
  booking_id uuid references public.course_bookings(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  staff_user_id uuid references public.staff_users(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index course_activity_log_branch_created_idx
  on public.course_activity_log (branch_id, created_at desc);

create or replace function public.bodygate_courses_touch_updated_at_v1()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create trigger course_types_touch_updated_at
before update on public.course_types
for each row execute function public.bodygate_courses_touch_updated_at_v1();

create trigger course_rooms_touch_updated_at
before update on public.course_rooms
for each row execute function public.bodygate_courses_touch_updated_at_v1();

create trigger course_schedules_touch_updated_at
before update on public.course_schedules
for each row execute function public.bodygate_courses_touch_updated_at_v1();

create trigger course_sessions_touch_updated_at
before update on public.course_sessions
for each row execute function public.bodygate_courses_touch_updated_at_v1();

create trigger course_bookings_touch_updated_at
before update on public.course_bookings
for each row execute function public.bodygate_courses_touch_updated_at_v1();

alter table public.course_types enable row level security;
alter table public.course_rooms enable row level security;
alter table public.course_schedules enable row level security;
alter table public.course_sessions enable row level security;
alter table public.course_bookings enable row level security;
alter table public.course_activity_log enable row level security;

revoke all privileges on table public.course_types from public, anon, authenticated, service_role;
revoke all privileges on table public.course_rooms from public, anon, authenticated, service_role;
revoke all privileges on table public.course_schedules from public, anon, authenticated, service_role;
revoke all privileges on table public.course_sessions from public, anon, authenticated, service_role;
revoke all privileges on table public.course_bookings from public, anon, authenticated, service_role;
revoke all privileges on table public.course_activity_log from public, anon, authenticated, service_role;

grant select, insert, update on table public.course_types to service_role;
grant select, insert, update on table public.course_rooms to service_role;
grant select, insert, update on table public.course_schedules to service_role;
grant select, insert, update on table public.course_sessions to service_role;
grant select, insert, update on table public.course_bookings to service_role;
grant select, insert on table public.course_activity_log to service_role;

create or replace function public.bodygate_courses_claim_operation_v1(
  p_operation_type text,
  p_idempotency_key text,
  p_request_hash text,
  p_customer_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
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
$function$;

create or replace function public.bodygate_courses_complete_operation_v1(
  p_operation_id uuid,
  p_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
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
$function$;

create or replace function public.create_course_type_atomic_v1(
  p_idempotency_key text,
  p_request_hash text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
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
  perform 1 from public.branches where id=v_branch_id and coalesce(is_active,true);
  if not found then raise exception 'BODYGATE_BRANCH_NOT_ACTIVE'; end if;

  insert into public.course_types (
    branch_id, name, slug, description,
    default_duration_minutes, default_capacity, color,
    requires_medical_certificate, requires_active_subscription,
    booking_enabled, waitlist_enabled, cancellation_cutoff_minutes
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
    coalesce((p_payload->>'cancellation_cutoff_minutes')::integer,120)
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
$function$;

create or replace function public.create_course_room_atomic_v1(
  p_idempotency_key text,
  p_request_hash text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
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
$function$;

create or replace function public.book_course_session_atomic_v1(
  p_idempotency_key text,
  p_request_hash text,
  p_session_id uuid,
  p_customer_id uuid,
  p_booking_source text default 'reception'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
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
    case when v_status='confirmed' then 'Prenotazione corso confermata' else 'Inserimento in lista d’attesa' end,
    'Sessione ' || p_session_id::text || ' · ' || to_char(v_session.starts_at at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI')
  );

  v_response := jsonb_build_object(
    'ok',true,'booking_id',v_booking.id,'status',v_status,
    'waitlist_position',v_waitlist_position,'session_id',p_session_id,'customer_id',p_customer_id
  );
  return public.bodygate_courses_complete_operation_v1(v_operation_id,v_response);
end;
$function$;

create or replace function public.cancel_course_booking_atomic_v1(
  p_idempotency_key text,
  p_request_hash text,
  p_booking_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
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
        v_promoted.customer_id,'course_booking_promoted','Promosso dalla lista d’attesa',
        'Sessione ' || v_session.id::text || ' · ' ||
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
    case when v_late then ' · cancellazione tardiva' else '' end
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
$function$;

create or replace function public.check_in_course_booking_atomic_v1(
  p_idempotency_key text,
  p_request_hash text,
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
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
    'Sessione ' || v_session.id::text || ' · ' ||
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
$function$;

revoke all on function public.bodygate_courses_touch_updated_at_v1() from public, anon, authenticated;
revoke all on function public.bodygate_courses_claim_operation_v1(text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.bodygate_courses_complete_operation_v1(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.create_course_type_atomic_v1(text,text,jsonb) from public, anon, authenticated;
revoke all on function public.create_course_room_atomic_v1(text,text,jsonb) from public, anon, authenticated;
revoke all on function public.book_course_session_atomic_v1(text,text,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.cancel_course_booking_atomic_v1(text,text,uuid,text) from public, anon, authenticated;
revoke all on function public.check_in_course_booking_atomic_v1(text,text,uuid) from public, anon, authenticated;

grant execute on function public.create_course_type_atomic_v1(text,text,jsonb) to service_role;
grant execute on function public.create_course_room_atomic_v1(text,text,jsonb) to service_role;
grant execute on function public.book_course_session_atomic_v1(text,text,uuid,uuid,text) to service_role;
grant execute on function public.cancel_course_booking_atomic_v1(text,text,uuid,text) to service_role;
grant execute on function public.check_in_course_booking_atomic_v1(text,text,uuid) to service_role;

comment on table public.course_types is 'Catalogo attività corsi BodyGate per sede.';
comment on table public.course_rooms is 'Sale fisiche corsi BodyGate per sede.';
comment on table public.course_schedules is 'Regole ricorrenti di programmazione corsi.';
comment on table public.course_sessions is 'Lezioni reali, snapshot operativo della programmazione.';
comment on table public.course_bookings is 'Prenotazioni, waitlist e presenze in un unico record per cliente/sessione.';
comment on table public.course_activity_log is 'Audit append-only del modulo corsi BodyGate.';

commit;
