-- BodyGate ATOMIC OPERATIONS 0.3
-- Rinnovo quota associativa atomico e idempotente.
--
-- Crea una tabella tecnica condivisa, predisposta anche per il futuro
-- onboarding Platinum atomico. Non Ã¨ contabilitÃ  e non Ã¨ prima nota.
--
-- Non eseguire manualmente la RPC o la RPC di numerazione ricevute.

begin;

create table if not exists public.bodygate_atomic_operations (
  id uuid primary key default gen_random_uuid(),
  operation_type text not null,
  idempotency_key text not null,
  request_hash text not null,
  customer_id uuid
    references public.customers(id) on delete restrict,
  status text not null default 'processing',
  membership_fee_id uuid
    references public.customer_membership_fees(id) on delete set null,
  subscription_id uuid
    references public.customer_subscriptions(id) on delete set null,
  customer_payment_id uuid
    references public.customer_payments(id) on delete set null,
  payment_id uuid
    references public.payments(id) on delete set null,
  receipt_id uuid
    references public.customer_receipts(id) on delete set null,
  document_id uuid
    references public.customer_documents(id) on delete set null,
  access_credential_id uuid
    references public.access_credentials(id) on delete set null,
  response_payload jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint bodygate_atomic_operations_operation_key_key
    unique (operation_type, idempotency_key),
  constraint bodygate_atomic_operations_type_check
    check (
      operation_type in (
        'membership_fee_renewal',
        'platinum_onboarding'
      )
    ),
  constraint bodygate_atomic_operations_status_check
    check (status in ('processing', 'completed')),
  constraint bodygate_atomic_operations_idempotency_key_check
    check (char_length(idempotency_key) between 16 and 180),
  constraint bodygate_atomic_operations_request_hash_check
    check (request_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists bodygate_atomic_operations_request_hash_idx
  on public.bodygate_atomic_operations
  (operation_type, request_hash, completed_at desc)
  where status = 'completed';

create index if not exists bodygate_atomic_operations_customer_idx
  on public.bodygate_atomic_operations
  (customer_id, operation_type, created_at desc);

alter table public.bodygate_atomic_operations enable row level security;

revoke all privileges on table public.bodygate_atomic_operations
  from public, anon, authenticated, service_role;

grant select on table public.bodygate_atomic_operations
  to service_role;

comment on table public.bodygate_atomic_operations is
  'Registro tecnico idempotente BodyGate per quota associativa e onboarding. Non Ã¨ contabilitÃ  nÃ© prima nota.';

create or replace function public.renew_membership_fee_atomic_v1(
  p_idempotency_key text,
  p_request_hash text,
  p_customer_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_valid_from date,
  p_valid_until date,
  p_allow_duplicate boolean default false
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
    'ValiditÃ  '
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
      || ' - â‚¬'
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
$function$;

revoke all privileges on function public.renew_membership_fee_atomic_v1(
  text,
  text,
  uuid,
  numeric,
  text,
  date,
  date,
  boolean
) from public, anon, authenticated;

grant execute on function public.renew_membership_fee_atomic_v1(
  text,
  text,
  uuid,
  numeric,
  text,
  date,
  date,
  boolean
) to service_role;

comment on function public.renew_membership_fee_atomic_v1(
  text,
  text,
  uuid,
  numeric,
  text,
  date,
  date,
  boolean
) is
  'Rinnovo quota associativa BodyGate atomico e idempotente. Esecuzione esclusiva service_role.';

commit;