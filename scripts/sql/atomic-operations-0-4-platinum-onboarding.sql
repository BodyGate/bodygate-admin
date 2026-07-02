-- BodyGate ATOMIC OPERATIONS 0.4
-- Onboarding Platinum atomico e idempotente.
--
-- Requisito: ATOMIC OPERATIONS 0.3 giÃ  applicata.
-- La RPC crea in una sola transazione:
-- cliente, quota associativa, eventuale abbonamento, pagamenti,
-- ricevuta, contratto, eventuale credenziale badge,
-- eventuale certificato medico e timeline.
--
-- Mobile Pass, QR DNake e upload file restano provisioning esterno
-- successivo e idempotente: non possono partecipare alla transazione PostgreSQL.
--
-- Non eseguire manualmente la RPC o la RPC di numerazione ricevute.

begin;

create or replace function public.create_platinum_atomic_v1(
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
      || ' â‚¬'
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
        || ' - â‚¬'
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
          then 'Badge RFID consegnato e addebitato â‚¬'
            || replace(to_char(v_badge_amount, 'FM999999990.00'), '.', ',')
        else 'Badge RFID consegnato in omaggio â€” motivo: '
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
$function$;

revoke all privileges on function public.create_platinum_atomic_v1(
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.create_platinum_atomic_v1(
  text,
  text,
  jsonb
) to service_role;

comment on function public.create_platinum_atomic_v1(
  text,
  text,
  jsonb
) is
  'Onboarding Platinum BodyGate atomico e idempotente. Esecuzione esclusiva service_role.';

commit;