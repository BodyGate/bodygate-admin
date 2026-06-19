-- BodyGate HOTFIX 0.1 — rollback di emergenza
--
-- ATTENZIONE: questo rollback ripristina i privilegi vulnerabili rilevati
-- dall'AUDIT 0.2C/0.2D. Usarlo soltanto per una regressione applicativa grave,
-- dopo aver salvato l'output di security-hotfix-0-1-backup-read-only.sql.
--
-- Non modifica dati applicativi e non esegue le RPC ricevute.

begin;

alter view public.bg_v2_customers_crm
  reset (security_invoker);

-- Ripristino ACL osservate prima della hotfix.
grant all privileges on table public.bg_v2_customers_crm
  to anon, authenticated, service_role;

-- Ripristino EXECUTE pubblico osservato prima della hotfix.
grant execute on function public.next_bodygate_receipt_number()
  to public, anon, authenticated, service_role;
grant execute on function public.next_bodygate_receipt_number_v2()
  to public, anon, authenticated, service_role;

commit;
