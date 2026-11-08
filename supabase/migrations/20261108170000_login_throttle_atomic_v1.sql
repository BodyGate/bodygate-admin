-- BodyGate LOGIN THROTTLE ATOMIC 1.0
-- Decisione e prenotazione del tentativo di login in un'unica operazione atomica.
--
-- Perche': controllare il conteggio in una richiesta e registrare l'errore in
-- un'altra lascia una finestra in cui una raffica di richieste simultanee legge
-- tutta "sotto il limite" e passa. Qui la funzione serializza le richieste per
-- email e per IP con un advisory lock (sempre nello stesso ordine: niente
-- deadlock), calcola se e' bloccato e, se non lo e', REGISTRA subito il
-- tentativo. Un login riuscito poi cancella le righe della coppia email+IP.
--
-- Solo service role. La logica della finestra scorrevole e' la stessa di
-- app/lib/auth/loginThrottle.ts (limiti passati come parametri).
create or replace function public.reserve_login_attempt(
  p_email text,
  p_ip text,
  p_window_seconds integer default 900,
  p_limit_pair integer default 5,
  p_limit_email integer default 25,
  p_limit_ip integer default 30
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := left(coalesce(p_email, ''), 254);
  v_ip text := left(coalesce(nullif(p_ip, ''), 'unknown'), 64);
  v_now timestamptz := clock_timestamp();
  v_window interval := make_interval(secs => greatest(p_window_seconds, 1));
  v_since timestamptz;
  v_times timestamptz[];
  v_n integer;
  v_unlock timestamptz := null;
  v_candidate timestamptz;
begin
  v_since := v_now - v_window;

  -- Stesso ordine per tutti: prima l'email, poi l'IP.
  perform pg_advisory_xact_lock(hashtextextended('bodygate-login-email:' || v_email, 0));
  perform pg_advisory_xact_lock(hashtextextended('bodygate-login-ip:' || v_ip, 0));

  -- Livello coppia email + IP
  select array_agg(created_at order by created_at) into v_times
  from public.login_attempts where email = v_email and ip = v_ip and created_at > v_since;
  v_n := coalesce(array_length(v_times, 1), 0);
  if v_n >= p_limit_pair then
    v_candidate := v_times[v_n - p_limit_pair + 1] + v_window;
    v_unlock := greatest(coalesce(v_unlock, v_candidate), v_candidate);
  end if;

  -- Livello email (qualunque IP)
  select array_agg(created_at order by created_at) into v_times
  from public.login_attempts where email = v_email and created_at > v_since;
  v_n := coalesce(array_length(v_times, 1), 0);
  if v_n >= p_limit_email then
    v_candidate := v_times[v_n - p_limit_email + 1] + v_window;
    v_unlock := greatest(coalesce(v_unlock, v_candidate), v_candidate);
  end if;

  -- Livello IP (qualunque email)
  select array_agg(created_at order by created_at) into v_times
  from public.login_attempts where ip = v_ip and created_at > v_since;
  v_n := coalesce(array_length(v_times, 1), 0);
  if v_n >= p_limit_ip then
    v_candidate := v_times[v_n - p_limit_ip + 1] + v_window;
    v_unlock := greatest(coalesce(v_unlock, v_candidate), v_candidate);
  end if;

  if v_unlock is not null then
    -- Bloccato: non si registra nulla, quindi il blocco non si allunga.
    return query select false, greatest(1, ceil(extract(epoch from (v_unlock - v_now)))::integer);
    return;
  end if;

  insert into public.login_attempts (email, ip, created_at) values (v_email, v_ip, v_now);

  -- Pulizia occasionale delle righe vecchie (la tabella non deve crescere).
  if random() < 0.02 then
    delete from public.login_attempts where created_at < v_now - interval '1 day';
  end if;

  return query select true, 0;
end;
$$;

revoke all on function public.reserve_login_attempt(text, text, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_login_attempt(text, text, integer, integer, integer, integer)
  to service_role;
