-- BodyGate HOTFIX 0.2
-- Rollback di emergenza.
--
-- Eseguire soltanto se la migration deve essere rimossa prima di qualunque
-- rinnovo reale. Se la tabella contiene operazioni, lo script si interrompe
-- per non eliminare tracciabilità.

begin;

revoke all privileges on function public.renew_subscription_atomic_v1(
  text,
  text,
  uuid,
  uuid,
  text,
  date,
  numeric,
  text,
  text,
  numeric,
  text,
  boolean
) from public, anon, authenticated, service_role;

drop function if exists public.renew_subscription_atomic_v1(
  text,
  text,
  uuid,
  uuid,
  text,
  date,
  numeric,
  text,
  text,
  numeric,
  text,
  boolean
);

do $rollback$
declare
  v_operation_count bigint := 0;
begin
  if to_regclass('public.subscription_renewal_operations') is not null then
    execute
      'select count(*) from public.subscription_renewal_operations'
      into v_operation_count;

    if v_operation_count > 0 then
      raise exception
        'ROLLBACK HOTFIX 0.2 interrotto: subscription_renewal_operations contiene % record.',
        v_operation_count;
    end if;

    execute
      'drop table public.subscription_renewal_operations';
  end if;
end
$rollback$;

commit;
