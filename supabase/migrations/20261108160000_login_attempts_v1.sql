-- BodyGate LOGIN ATTEMPTS 1.0
-- Archivio dei tentativi di login falliti, usato dal limite ai tentativi
-- (app/lib/auth/loginThrottle.ts). Solo service role: nessun privilegio a
-- anon/authenticated. Le righe vecchie (> 24 ore) vengono ripulite dal codice.
create table if not exists public.login_attempts (
  id uuid not null default gen_random_uuid(),
  email text not null,
  ip text not null,
  created_at timestamp with time zone not null default now(),
  constraint login_attempts_pkey primary key (id)
);

create index if not exists login_attempts_email_created_idx on public.login_attempts using btree (email, created_at desc);
create index if not exists login_attempts_ip_created_idx on public.login_attempts using btree (ip, created_at desc);
create index if not exists login_attempts_created_idx on public.login_attempts using btree (created_at);

alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from public, anon, authenticated;
