-- BodyGate LIVE SIGNALS 1.0
-- Aggiornamenti in tempo reale senza esporre dati.
--
-- Sostituisce `postgres_changes` (che richiedeva SELECT per anon sulle tabelle
-- con dati personali) con un segnale broadcast `{ "table": "<nome>" }` sul
-- canale `bodygate-live`. Il payload non contiene righe ne' PII: i client
-- ricaricano i dati dalle API autenticate. Vedi app/lib/liveChanges.ts.
--
-- Trigger a livello di statement: un'operazione in blocco genera un solo
-- segnale. Il canale e' pubblico (l'app usa un login proprio, non Supabase
-- Auth): chi ha la chiave anon puo' ascoltare "la tabella X e' cambiata" ma
-- nessun dato.

create or replace function public.bodygate_notify_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object('table', tg_table_name),
      'change',
      'bodygate-live',
      false
    );
  exception when others then
    -- Il segnale live non deve mai far fallire la scrittura di business.
    null;
  end;
  return null;
end;
$$;

revoke all on function public.bodygate_notify_change() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'access_logs',
    'audit_logs',
    'customers',
    'customer_access_logs',
    'customer_blocks',
    'customer_membership_fees',
    'customer_subscriptions',
    'gym_presence',
    'payments',
    'unknown_badge_logs'
  ]
  loop
    execute format('drop trigger if exists bodygate_live_signal on public.%I', t);
    execute format(
      'create trigger bodygate_live_signal
         after insert or update or delete on public.%I
         for each statement execute function public.bodygate_notify_change()',
      t
    );
  end loop;
end
$$;
