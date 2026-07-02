-- BodyGate ATOMIC OPERATIONS 0.4
-- Preflight READ ONLY prima della migration onboarding Platinum.
--
-- Non modifica dati, funzioni o schema.

with required_tables(table_name) as (
  values
    ('bodygate_atomic_operations'),
    ('branches'),
    ('membership_fee_settings'),
    ('subscription_plans'),
    ('customers'),
    ('customer_membership_fees'),
    ('customer_subscriptions'),
    ('customer_payments'),
    ('payments'),
    ('customer_receipts'),
    ('customer_documents'),
    ('access_credentials'),
    ('customer_badges'),
    ('staff_access_credentials'),
    ('medical_certificates'),
    ('customer_timeline')
),

missing_tables as (
  select array_agg(rt.table_name order by rt.table_name) as names
  from required_tables rt
  where to_regclass('public.' || rt.table_name) is null
),

required_columns(table_name, column_name) as (
  values
    ('bodygate_atomic_operations', 'id'),
    ('bodygate_atomic_operations', 'operation_type'),
    ('bodygate_atomic_operations', 'idempotency_key'),
    ('bodygate_atomic_operations', 'request_hash'),
    ('bodygate_atomic_operations', 'customer_id'),
    ('bodygate_atomic_operations', 'status'),
    ('bodygate_atomic_operations', 'membership_fee_id'),
    ('bodygate_atomic_operations', 'subscription_id'),
    ('bodygate_atomic_operations', 'customer_payment_id'),
    ('bodygate_atomic_operations', 'payment_id'),
    ('bodygate_atomic_operations', 'receipt_id'),
    ('bodygate_atomic_operations', 'document_id'),
    ('bodygate_atomic_operations', 'access_credential_id'),
    ('bodygate_atomic_operations', 'response_payload'),
    ('bodygate_atomic_operations', 'created_at'),
    ('bodygate_atomic_operations', 'completed_at'),

    ('branches', 'id'),

    ('membership_fee_settings', 'branch_id'),
    ('membership_fee_settings', 'is_active'),
    ('membership_fee_settings', 'price'),
    ('membership_fee_settings', 'validity_days'),

    ('subscription_plans', 'id'),
    ('subscription_plans', 'branch_id'),
    ('subscription_plans', 'name'),
    ('subscription_plans', 'price'),
    ('subscription_plans', 'promo_price'),
    ('subscription_plans', 'duration_days'),
    ('subscription_plans', 'is_active'),

    ('customers', 'id'),
    ('customers', 'first_name'),
    ('customers', 'last_name'),
    ('customers', 'phone'),
    ('customers', 'email'),
    ('customers', 'fiscal_code'),
    ('customers', 'branch_id'),
    ('customers', 'gender'),
    ('customers', 'birth_date'),
    ('customers', 'birth_place'),
    ('customers', 'address'),
    ('customers', 'street_number'),
    ('customers', 'postal_code'),
    ('customers', 'city'),
    ('customers', 'province'),
    ('customers', 'country'),
    ('customers', 'document_type'),
    ('customers', 'document_number'),
    ('customers', 'document_issued_by'),
    ('customers', 'document_issued_at'),
    ('customers', 'document_expires_at'),
    ('customers', 'emergency_contact_name'),
    ('customers', 'emergency_contact_phone'),
    ('customers', 'emergency_contact_relation'),
    ('customers', 'profession'),
    ('customers', 'fitness_goal'),
    ('customers', 'marketing_source'),
    ('customers', 'customer_tags'),
    ('customers', 'badge_code'),
    ('customers', 'controller_code'),
    ('customers', 'medical_certificate_start_date'),
    ('customers', 'medical_certificate_end_date'),
    ('customers', 'medical_certificate_url'),
    ('customers', 'medical_certificate_status'),
    ('customers', 'active'),
    ('customers', 'is_active'),
    ('customers', 'status'),
    ('customers', 'subscription_status'),
    ('customers', 'subscription_expiry'),
    ('customers', 'onboarding_status'),
    ('customers', 'payment_status'),
    ('customers', 'contract_status'),
    ('customers', 'access_activation_status'),
    ('customers', 'privacy_consent'),
    ('customers', 'marketing_consent'),
    ('customers', 'photo_video_consent'),

    ('customer_membership_fees', 'id'),
    ('customer_membership_fees', 'customer_id'),
    ('customer_membership_fees', 'branch_id'),
    ('customer_membership_fees', 'amount'),
    ('customer_membership_fees', 'paid_at'),
    ('customer_membership_fees', 'valid_from'),
    ('customer_membership_fees', 'valid_until'),
    ('customer_membership_fees', 'payment_method'),
    ('customer_membership_fees', 'notes'),

    ('customer_subscriptions', 'id'),
    ('customer_subscriptions', 'customer_id'),
    ('customer_subscriptions', 'branch_id'),
    ('customer_subscriptions', 'plan_id'),
    ('customer_subscriptions', 'amount'),
    ('customer_subscriptions', 'starts_at'),
    ('customer_subscriptions', 'ends_at'),
    ('customer_subscriptions', 'is_active'),
    ('customer_subscriptions', 'payment_method'),
    ('customer_subscriptions', 'notes'),

    ('customer_payments', 'id'),
    ('customer_payments', 'customer_id'),
    ('customer_payments', 'type'),
    ('customer_payments', 'description'),
    ('customer_payments', 'amount'),
    ('customer_payments', 'payment_method'),
    ('customer_payments', 'status'),
    ('customer_payments', 'paid_at'),
    ('customer_payments', 'notes'),

    ('payments', 'id'),
    ('payments', 'customer_id'),
    ('payments', 'amount'),
    ('payments', 'method'),
    ('payments', 'paid_at'),
    ('payments', 'subscription_days'),
    ('payments', 'payment_method'),
    ('payments', 'description'),
    ('payments', 'payment_method_id'),
    ('payments', 'payment_type'),
    ('payments', 'status'),
    ('payments', 'created_by'),

    ('customer_receipts', 'id'),
    ('customer_receipts', 'customer_id'),
    ('customer_receipts', 'payment_id'),
    ('customer_receipts', 'subscription_id'),
    ('customer_receipts', 'receipt_year'),
    ('customer_receipts', 'receipt_sequence'),
    ('customer_receipts', 'receipt_number'),
    ('customer_receipts', 'receipt_type'),
    ('customer_receipts', 'amount'),
    ('customer_receipts', 'description'),
    ('customer_receipts', 'customer_copy_label'),
    ('customer_receipts', 'gym_copy_label'),
    ('customer_receipts', 'issued_at'),
    ('customer_receipts', 'receipt_components'),

    ('customer_documents', 'id'),
    ('customer_documents', 'customer_id'),
    ('customer_documents', 'document_type'),
    ('customer_documents', 'title'),
    ('customer_documents', 'status'),

    ('access_credentials', 'id'),
    ('access_credentials', 'customer_id'),
    ('access_credentials', 'type'),
    ('access_credentials', 'code'),
    ('access_credentials', 'controller_code'),
    ('access_credentials', 'status'),

    ('customer_badges', 'badge_code'),
    ('customer_badges', 'is_active'),

    ('staff_access_credentials', 'code'),
    ('staff_access_credentials', 'controller_code'),
    ('staff_access_credentials', 'status'),

    ('medical_certificates', 'customer_id'),
    ('medical_certificates', 'file_url'),
    ('medical_certificates', 'expiry_date'),
    ('medical_certificates', 'status'),
    ('medical_certificates', 'valid_from'),
    ('medical_certificates', 'valid_until'),
    ('medical_certificates', 'certificate_type'),

    ('customer_timeline', 'customer_id'),
    ('customer_timeline', 'type'),
    ('customer_timeline', 'title'),
    ('customer_timeline', 'description'),
    ('customer_timeline', 'created_at')
),

missing_columns as (
  select array_agg(
    rc.table_name || '.' || rc.column_name
    order by rc.table_name, rc.column_name
  ) as names
  from required_columns rc
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = rc.table_name
   and c.column_name = rc.column_name
  where c.column_name is null
),

operation_constraint as (
  select exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'bodygate_atomic_operations'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%platinum_onboarding%'
  ) as allows_platinum_onboarding
),

duplicate_fiscal_codes as (
  select count(*) as duplicate_group_count
  from (
    select upper(trim(fiscal_code))
    from public.customers
    where nullif(trim(fiscal_code), '') is not null
    group by upper(trim(fiscal_code))
    having count(*) > 1
  ) duplicates
),

result as (
  select
    coalesce(cardinality(mt.names), 0) = 0 as all_tables_exist,
    coalesce(mt.names, array[]::text[]) as missing_tables,
    coalesce(cardinality(mc.names), 0) = 0 as all_columns_exist,
    coalesce(mc.names, array[]::text[]) as missing_columns,
    to_regprocedure(
      'public.next_bodygate_receipt_number_v2()'
    ) is not null as receipt_number_rpc_exists,
    oc.allows_platinum_onboarding,
    dfc.duplicate_group_count
  from missing_tables mt
  cross join missing_columns mc
  cross join operation_constraint oc
  cross join duplicate_fiscal_codes dfc
)

select
  *,
  (
    all_tables_exist
    and all_columns_exist
    and receipt_number_rpc_exists
    and allows_platinum_onboarding
  ) as preflight_ok
from result;