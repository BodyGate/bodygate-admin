-- Safe, idempotent data repair for Roberta Mustacciolo access credentials.
-- No deletes: this only aligns customer legacy fields, access_credentials and
-- customer_badges so BodyGate can recognize both physical RFID and bridge codes.

DO $$
DECLARE
  v_customer_id uuid := '09e5a6d2-da98-4ebc-b3fd-f1589b9ee120'::uuid;
  v_rfid_raw text := '51006b659d';
  v_rfid_controller text := '7038365';
  v_qr_raw text := 'local_user=YXJSWERTDglPDEN3AVVcAmc=';
  v_qr_controller text := '095629';
  v_branch_id uuid;
BEGIN
  SELECT branch_id INTO v_branch_id
  FROM public.customers
  WHERE id = v_customer_id;

  IF v_branch_id IS NULL THEN
    RAISE NOTICE 'Roberta Mustacciolo has no branch_id; customer_badges.branch_id will remain null.';
  END IF;

  UPDATE public.customers
  SET badge_code = v_rfid_raw,
      controller_code = v_rfid_controller
  WHERE id = v_customer_id;

  IF to_regclass('public.access_credentials') IS NOT NULL THEN
    UPDATE public.access_credentials
    SET code = v_rfid_raw,
        controller_code = v_rfid_controller,
        type = COALESCE(NULLIF(type, ''), 'card'),
        status = 'active'
    WHERE customer_id = v_customer_id
      AND (code = v_rfid_raw OR controller_code = v_rfid_raw OR controller_code = v_rfid_controller OR type = 'card');

    IF NOT EXISTS (
      SELECT 1 FROM public.access_credentials
      WHERE customer_id = v_customer_id
        AND (code = v_rfid_raw OR controller_code = v_rfid_controller)
    ) THEN
      INSERT INTO public.access_credentials (customer_id, type, code, controller_code, status)
      VALUES (v_customer_id, 'card', v_rfid_raw, v_rfid_controller, 'active');
    END IF;

    UPDATE public.access_credentials
    SET code = v_qr_raw,
        controller_code = v_qr_controller,
        type = 'qr',
        status = 'active'
    WHERE customer_id = v_customer_id
      AND (code = v_qr_raw OR controller_code = v_qr_controller OR controller_code = ltrim(v_qr_controller, '0') OR type = 'qr');

    IF NOT EXISTS (
      SELECT 1 FROM public.access_credentials
      WHERE customer_id = v_customer_id
        AND (code = v_qr_raw OR controller_code = v_qr_controller)
    ) THEN
      INSERT INTO public.access_credentials (customer_id, type, code, controller_code, status)
      VALUES (v_customer_id, 'qr', v_qr_raw, v_qr_controller, 'active');
    END IF;
  END IF;

  IF to_regclass('public.customer_badges') IS NOT NULL THEN
    UPDATE public.customer_badges
    SET customer_id = v_customer_id,
        branch_id = COALESCE(branch_id, v_branch_id),
        is_active = true
    WHERE badge_code IN (v_rfid_raw, v_rfid_controller);

    IF NOT EXISTS (SELECT 1 FROM public.customer_badges WHERE badge_code = v_rfid_raw) THEN
      INSERT INTO public.customer_badges (customer_id, branch_id, badge_code, is_active)
      VALUES (v_customer_id, v_branch_id, v_rfid_raw, true);
    END IF;
  END IF;
END $$;
