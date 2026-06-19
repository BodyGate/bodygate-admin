-- Idempotente: aggiunge componenti analitiche non distruttive alle ricevute.
alter table if exists public.customer_receipts
  add column if not exists receipt_components jsonb;

comment on column public.customer_receipts.receipt_components is
  'Componenti analitiche opzionali della ricevuta (subscription, membership_fee, rfid_badge). Null per ricevute storiche.';
