-- BodyGate HOTFIX 0.3
-- Riattivazione automatica del cliente in fase di rinnovo abbonamento.
--
-- Bug osservato: dopo un rinnovo pagato con successo, il gate continuava a
-- rispondere "Cliente non attivo" (vedi app/api/access/check/route.ts,
-- controllo customer.is_active) perché renew_subscription_atomic_v1
-- aggiornava solo customer_subscriptions.is_active, senza mai riportare
-- customers.is_active/active/status a "attivo". Il cliente restava bloccato
-- al varco finché qualcuno non spuntava manualmente "Cliente attivo" in
-- Modifica cliente.
--
-- Questa migration ridefinisce la funzione (stessa firma, stesso comportamento
-- per tutto il resto) aggiungendo, subito dopo la creazione del nuovo
-- abbonamento, la riattivazione del cliente:
--   customers.is_active = true
--   customers.active    = true
--   customers.status    = 'active' (solo se era 'onboarding', altrimenti invariato)
--
-- Non tocca access control, Mobile Pass, Bridge o hardware, non cambia gli
-- altri effetti della funzione (pagamento, ricevuta, timeline, idempotenza).

begin;

create or replace function public.renew_subscription_atomic_v1(
  p_idempotency_key text,
  p_request_hash text,
  p_customer_id uuid,
  p_plan_id uuid,
  p_payment_method text,
  p_start_date date,
  p_requested_amount numeric default null,
  p_notes text default null,
  p_badge_charge_mode text default 'not_included',
  p_badge_fee numeric default 0,
  p_badge_complimentary_reason text default null,
  p_new_badge_delivered boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
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

  -- Serializza richieste identiche e tutti i rinnovi dello stesso cliente.
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

  -- Protezione aggiuntiva per client legacy senza chiave persistente:
  -- stessa richiesta completata negli ultimi dieci minuti = replay.
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

  -- HOTFIX 0.3: un rinnovo pagato con successo deve riportare il cliente
  -- attivo. Senza questo update, un cliente disattivato (is_active=false)
  -- restava bloccato al gate ("Cliente non attivo") anche con abbonamento
  -- appena rinnovato e valido, finché qualcuno non lo riattivava a mano da
  -- Modifica cliente.
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
$function$;

commit;
