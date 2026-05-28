-- BodyGate DNake operational test customer seed
-- Badge/controller code: 51006a4b43
--
-- Run this script once in the Supabase SQL editor (or psql) for the target
-- BodyGate database. It is intentionally idempotent: if the badge already
-- exists in customer_badges or access_credentials, the existing customer is
-- reused and the operational records are refreshed instead of duplicated.
--
-- The /api/access/check route currently reads customer_badges, customers,
-- customer_membership_fees, customer_subscriptions and customers' medical
-- certificate date fields. The reception/CRM screens also read
-- access_credentials and medical_certificates, so this script keeps both data
-- paths aligned without changing the bridge or /api/access/check.

DO $$
DECLARE
  v_badge CONSTANT text := '51006a4b43';
  v_first_name CONSTANT text := 'TEST';
  v_last_name CONSTANT text := 'DNake';
  v_email CONSTANT text := 'test.dnake@bodygate.local';
  v_phone CONSTANT text := NULL;
  v_today date := CURRENT_DATE;
  v_membership_valid_until date := (CURRENT_DATE + INTERVAL '1 year')::date;
  v_subscription_ends_at date := (CURRENT_DATE + INTERVAL '30 days')::date;
  v_medical_valid_until date := (CURRENT_DATE + INTERVAL '1 year')::date;
  v_customer_id uuid;
  v_branch_id uuid;
  v_customer_insert_cols text[] := ARRAY['id'];
  v_customer_insert_vals text[] := ARRAY['$1'];
  v_customer_update_sets text[] := ARRAY[]::text[];
  v_sql text;
BEGIN
  -- Resolve the customer already linked to this physical badge, if present.
  IF to_regclass('public.customer_badges') IS NOT NULL THEN
    EXECUTE 'select customer_id from public.customer_badges where badge_code = $1 limit 1'
      INTO v_customer_id
      USING v_badge;
  END IF;

  IF v_customer_id IS NULL AND to_regclass('public.access_credentials') IS NOT NULL THEN
    EXECUTE 'select customer_id from public.access_credentials where code = $1 or controller_code = $1 limit 1'
      INTO v_customer_id
      USING v_badge;
  END IF;

  -- Pick an operational branch. /api/access/check requires customers.branch_id.
  IF to_regclass('public.branches') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'branches'
        AND column_name = 'is_active'
    ) THEN
      EXECUTE 'select id from public.branches where is_active = true order by id limit 1'
        INTO v_branch_id;
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'branches'
        AND column_name = 'active'
    ) THEN
      EXECUTE 'select id from public.branches where active = true order by id limit 1'
        INTO v_branch_id;
    ELSE
      EXECUTE 'select id from public.branches order by id limit 1'
        INTO v_branch_id;
    END IF;
  END IF;

  IF v_branch_id IS NULL AND v_customer_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'branch_id'
  ) THEN
    EXECUTE 'select branch_id from public.customers where id = $1 limit 1'
      INTO v_branch_id
      USING v_customer_id;
  END IF;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'No branch found. Create or activate at least one row in public.branches before seeding the DNake test customer, because /api/access/check denies customers without branch_id.';
  END IF;

  -- Create or update the CRM customer. Column checks keep the script compatible
  -- with both legacy and current BodyGate schemas.
  IF v_customer_id IS NULL THEN
    v_customer_id := gen_random_uuid();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'first_name') THEN
    v_customer_insert_cols := v_customer_insert_cols || 'first_name';
    v_customer_insert_vals := v_customer_insert_vals || '$2';
    v_customer_update_sets := v_customer_update_sets || 'first_name = $2';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_name') THEN
    v_customer_insert_cols := v_customer_insert_cols || 'last_name';
    v_customer_insert_vals := v_customer_insert_vals || '$3';
    v_customer_update_sets := v_customer_update_sets || 'last_name = $3';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'full_name') THEN
    v_customer_insert_cols := v_customer_insert_cols || 'full_name';
    v_customer_insert_vals := v_customer_insert_vals || '$4';
    v_customer_update_sets := v_customer_update_sets || 'full_name = $4';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'email') THEN
    v_customer_insert_cols := v_customer_insert_cols || 'email';
    v_customer_insert_vals := v_customer_insert_vals || '$5';
    v_customer_update_sets := v_customer_update_sets || 'email = coalesce(customers.email, $5)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'phone') THEN
    v_customer_insert_cols := v_customer_insert_cols || 'phone';
    v_customer_insert_vals := v_customer_insert_vals || '$6';
    v_customer_update_sets := v_customer_update_sets || 'phone = coalesce(customers.phone, $6)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'is_active') THEN
    v_customer_insert_cols := v_customer_insert_cols || 'is_active';
    v_customer_insert_vals := v_customer_insert_vals || 'true';
    v_customer_update_sets := v_customer_update_sets || 'is_active = true';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'active') THEN
    v_customer_insert_cols := v_customer_insert_cols || 'active';
    v_customer_insert_vals := v_customer_insert_vals || 'true';
    v_customer_update_sets := v_customer_update_sets || 'active = true';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'branch_id') THEN
    v_customer_insert_cols := v_customer_insert_cols || 'branch_id';
    v_customer_insert_vals := v_customer_insert_vals || '$7';
    v_customer_update_sets := v_customer_update_sets || 'branch_id = coalesce(customers.branch_id, $7)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'medical_certificate_end_date') THEN
    v_customer_insert_cols := v_customer_insert_cols || 'medical_certificate_end_date';
    v_customer_insert_vals := v_customer_insert_vals || '$8';
    v_customer_update_sets := v_customer_update_sets || 'medical_certificate_end_date = $8';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'medical_certificate_end') THEN
    v_customer_insert_cols := v_customer_insert_cols || 'medical_certificate_end';
    v_customer_insert_vals := v_customer_insert_vals || '$8';
    v_customer_update_sets := v_customer_update_sets || 'medical_certificate_end = $8';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'updated_at') THEN
    v_customer_insert_cols := v_customer_insert_cols || 'updated_at';
    v_customer_insert_vals := v_customer_insert_vals || 'now()';
    v_customer_update_sets := v_customer_update_sets || 'updated_at = now()';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_customer_id) THEN
    v_sql := format(
      'insert into public.customers (%s) values (%s)',
      array_to_string(v_customer_insert_cols, ', '),
      array_to_string(v_customer_insert_vals, ', ')
    );
    EXECUTE v_sql
      USING v_customer_id, v_first_name, v_last_name, trim(v_first_name || ' ' || v_last_name), v_email, v_phone, v_branch_id, v_medical_valid_until;
  ELSE
    v_sql := format(
      'update public.customers set %s where id = $1',
      array_to_string(v_customer_update_sets, ', ')
    );
    EXECUTE v_sql
      USING v_customer_id, v_first_name, v_last_name, trim(v_first_name || ' ' || v_last_name), v_email, v_phone, v_branch_id, v_medical_valid_until;
  END IF;

  -- Ensure /api/access/check can recognize the badge. This route uses
  -- customer_badges, not access_credentials.
  UPDATE public.customer_badges
  SET customer_id = v_customer_id,
      branch_id = v_branch_id,
      is_active = true
  WHERE badge_code = v_badge;

  IF NOT FOUND THEN
    INSERT INTO public.customer_badges (customer_id, branch_id, badge_code, is_active)
    VALUES (v_customer_id, v_branch_id, v_badge, true);
  END IF;

  -- Ensure reception/CRM and legacy access screens can recognize the same code.
  IF to_regclass('public.access_credentials') IS NOT NULL THEN
    UPDATE public.access_credentials
    SET customer_id = v_customer_id,
        controller_code = v_badge,
        status = 'active'
    WHERE code = v_badge OR controller_code = v_badge;

    IF NOT FOUND THEN
      INSERT INTO public.access_credentials (customer_id, code, controller_code, status)
      VALUES (v_customer_id, v_badge, v_badge, 'active');
    END IF;
  END IF;

  -- Membership fee valid for at least one year. Existing overlapping rows are
  -- refreshed instead of duplicated.
  UPDATE public.customer_membership_fees
  SET valid_from = LEAST(valid_from, v_today),
      valid_until = GREATEST(valid_until, v_membership_valid_until)
  WHERE customer_id = v_customer_id
    AND branch_id = v_branch_id
    AND valid_until >= v_today;

  IF NOT FOUND THEN
    INSERT INTO public.customer_membership_fees (customer_id, branch_id, valid_from, valid_until)
    VALUES (v_customer_id, v_branch_id, v_today, v_membership_valid_until);
  END IF;

  -- Active subscription valid for at least 30 days.
  UPDATE public.customer_subscriptions
  SET is_active = true,
      starts_at = LEAST(starts_at, v_today),
      ends_at = GREATEST(ends_at, v_subscription_ends_at)
  WHERE customer_id = v_customer_id
    AND branch_id = v_branch_id
    AND ends_at >= v_today;

  IF NOT FOUND THEN
    INSERT INTO public.customer_subscriptions (customer_id, branch_id, is_active, starts_at, ends_at)
    VALUES (v_customer_id, v_branch_id, true, v_today, v_subscription_ends_at);
  END IF;

  -- CRM/reception medical certificate row. /api/access/check relies on the
  -- customer date fields above, but this keeps the document panel valid too.
  IF to_regclass('public.medical_certificates') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'medical_certificates'
        AND column_name = 'valid_until'
    ) THEN
      UPDATE public.medical_certificates
      SET valid_from = v_today,
          valid_until = v_medical_valid_until,
          expiry_date = v_medical_valid_until,
          status = CASE
            WHEN EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = 'public'
                AND table_name = 'medical_certificates'
                AND column_name = 'status'
            ) THEN 'valid'
            ELSE status
          END,
          certificate_type = CASE
            WHEN EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = 'public'
                AND table_name = 'medical_certificates'
                AND column_name = 'certificate_type'
            ) THEN 'non_agonistico'
            ELSE certificate_type
          END
      WHERE customer_id = v_customer_id
        AND valid_until >= v_today;

      IF NOT FOUND THEN
        INSERT INTO public.medical_certificates (customer_id, valid_from, valid_until, expiry_date, status, certificate_type)
        VALUES (v_customer_id, v_today, v_medical_valid_until, v_medical_valid_until, 'valid', 'non_agonistico');
      END IF;
    ELSE
      INSERT INTO public.medical_certificates (customer_id, expiry_date, status)
      VALUES (v_customer_id, v_medical_valid_until, 'approved')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RAISE NOTICE 'BodyGate DNake test customer ready: customer_id=%, branch_id=%, badge=%', v_customer_id, v_branch_id, v_badge;
END $$;

-- Verification query: should return one fully operational TEST DNake record.
SELECT
  c.id AS customer_id,
  c.first_name,
  c.last_name,
  c.is_active,
  c.branch_id,
  c.medical_certificate_end_date,
  cb.badge_code,
  cb.is_active AS badge_active,
  ac.code AS access_code,
  ac.controller_code,
  ac.status AS access_status,
  cmf.valid_until AS membership_fee_valid_until,
  cs.ends_at AS subscription_ends_at,
  cs.is_active AS subscription_active,
  mc.valid_until AS medical_certificate_valid_until
FROM public.customers c
LEFT JOIN public.customer_badges cb ON cb.customer_id = c.id AND cb.badge_code = '51006a4b43'
LEFT JOIN public.access_credentials ac ON ac.customer_id = c.id AND ac.code = '51006a4b43'
LEFT JOIN public.customer_membership_fees cmf ON cmf.customer_id = c.id AND cmf.valid_until >= CURRENT_DATE
LEFT JOIN public.customer_subscriptions cs ON cs.customer_id = c.id AND cs.ends_at >= CURRENT_DATE AND cs.is_active = true
LEFT JOIN public.medical_certificates mc ON mc.customer_id = c.id AND mc.valid_until >= CURRENT_DATE
WHERE c.id = COALESCE(
  (SELECT customer_id FROM public.customer_badges WHERE badge_code = '51006a4b43' LIMIT 1),
  (SELECT customer_id FROM public.access_credentials WHERE code = '51006a4b43' LIMIT 1)
);
