-- POST /api/payments/create used to insert into `payments` (accounting)
-- and `customer_payments` (customer-facing) as two separate client calls.
-- A failure on the second insert left an orphaned accounting row; a lost
-- response after a committed second insert made a client-side "delete the
-- first row to compensate" unsafe too, since the client cannot tell a
-- rejected insert from a committed one whose acknowledgement never arrived.
-- Doing both inserts inside one plpgsql function makes them one Postgres
-- transaction: either both rows exist or neither does, with no ambiguous
-- client-side compensation needed.

create or replace function public.create_misc_payment_atomic_v1(
  p_customer_id uuid,
  p_payment_method_id uuid,
  p_amount numeric,
  p_payment_type text,
  p_description text,
  p_payment_method_name text,
  p_created_by text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_payment public.payments%rowtype;
  v_customer_payment public.customer_payments%rowtype;
  v_now timestamptz := clock_timestamp();
  v_payment_type text := trim(coalesce(p_payment_type, ''));
  v_description text := nullif(trim(coalesce(p_description, '')), '');
begin
  if v_payment_type = '' then
    raise exception 'BODYGATE_VALIDATION_PAYMENT_TYPE';
  end if;

  if v_payment_type in ('subscription', 'membership_fee') then
    raise exception 'BODYGATE_PAYMENT_TYPE_NOT_ALLOWED_HERE';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'BODYGATE_VALIDATION_AMOUNT';
  end if;

  insert into public.payments (
    customer_id, payment_method_id, amount, payment_type, description, status, paid_at, created_by
  ) values (
    p_customer_id, p_payment_method_id, round(p_amount::numeric, 2), v_payment_type, v_description,
    'paid', v_now, coalesce(nullif(trim(p_created_by), ''), 'admin@bodygate.it')
  ) returning * into v_payment;

  insert into public.customer_payments (
    customer_id, amount, type, description, payment_method, status, paid_at
  ) values (
    p_customer_id, round(p_amount::numeric, 2), v_payment_type, v_description,
    nullif(trim(coalesce(p_payment_method_name, '')), ''), 'paid', v_now
  ) returning * into v_customer_payment;

  return jsonb_build_object(
    'payment', to_jsonb(v_payment),
    'customer_payment', to_jsonb(v_customer_payment)
  );
end;
$function$;

revoke all on function public.create_misc_payment_atomic_v1(uuid, uuid, numeric, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_misc_payment_atomic_v1(uuid, uuid, numeric, text, text, text, text) to service_role;
