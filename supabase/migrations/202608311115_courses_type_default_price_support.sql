-- create_course_type_atomic_v1 now also accepts an optional default_price
-- in the payload, so per-session-priced course types (course_types.default_price,
-- added in 202608311100_courses_enrollment_and_payments.sql) can be set at
-- creation time instead of requiring a separate write.
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
$function$;
