-- BodyGate HOTFIX 0.1 — hardening vista CRM e RPC ricevute
--
-- Ambito intenzionalmente minimo:
--   * nessuna modifica ai dati applicativi;
--   * nessuna chiamata alle RPC ricevute;
--   * nessuna modifica a Bridge, DNake, KT02.3, tornello o access control;
--   * nessuna modifica a pagamenti, ricevute emesse o contatori.
--
-- Eseguire una sola volta nel Supabase SQL Editor con un ruolo amministrativo.
-- Lo script è racchiuso in transazione: un errore annulla l'intera hotfix.

begin;

-- La vista CRM è una vista automaticamente aggiornabile di public.customers.
-- Rimuoviamo ogni privilegio dai ruoli client e la rendiamo security-invoker.
revoke all privileges on table public.bg_v2_customers_crm
  from public, anon, authenticated, service_role;

alter view public.bg_v2_customers_crm
  set (security_invoker = true);

-- L'applicazione corrente legge i clienti tramite route server/service role.
-- Manteniamo alla service role la sola lettura della vista per eventuali usi server.
grant select on table public.bg_v2_customers_crm to service_role;

-- Le numerazioni possono essere consumate esclusivamente dalle route server.
-- Non eseguiamo nessuna funzione: modifichiamo soltanto i grant EXECUTE.
revoke execute on function public.next_bodygate_receipt_number()
  from public, anon, authenticated;
revoke execute on function public.next_bodygate_receipt_number_v2()
  from public, anon, authenticated;

grant execute on function public.next_bodygate_receipt_number()
  to service_role;
grant execute on function public.next_bodygate_receipt_number_v2()
  to service_role;

commit;
