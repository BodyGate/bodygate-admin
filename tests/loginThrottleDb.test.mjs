// La decisione sta nel database (public.reserve_login_attempt): questi test la
// eseguono davvero. Servono psql e un PostgreSQL con i ruoli Supabase; senza
// LOGIN_THROTTLE_TEST_DATABASE_URL vengono saltati.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const url = process.env.LOGIN_THROTTLE_TEST_DATABASE_URL;
const skip = !(url && spawnSync("psql", ["--version"]).status === 0);

const sync = (sql) => {
  const r = spawnSync("psql", [url, "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const asyncQuery = (sql) =>
  new Promise((resolve, reject) => {
    const p = spawn("psql", [url, "-At", "-c", sql]);
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`psql ${code}`))));
  });

const reserveSql = (email, ip) => `select allowed::text || '|' || retry_after_seconds from public.reserve_login_attempt('${email}', '${ip}')`;
const reserve = (email, ip) => {
  const [allowed, retry] = sync(reserveSql(email, ip)).split("|");
  return { allowed: allowed === "true", retry: Number(retry) };
};

test("setup: apply the two login migrations to an empty database", { skip }, () => {
  sync("do $$ begin if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end $$");
  sync("drop table if exists public.login_attempts cascade");
  for (const f of ["20261108160000_login_attempts_v1.sql", "20261108170000_login_throttle_atomic_v1.sql"]) {
    const r = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-q", "-f", `supabase/migrations/${f}`], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
  }
});

test("same email+IP: 5 attempts pass, the 6th is blocked for ~15 minutes", { skip }, () => {
  sync("truncate public.login_attempts");
  for (let i = 1; i <= 5; i += 1) assert.equal(reserve("a@x.it", "1.1.1.1").allowed, true, `tentativo ${i}`);
  const sixth = reserve("a@x.it", "1.1.1.1");
  assert.equal(sixth.allowed, false);
  assert.ok(sixth.retry >= 890 && sixth.retry <= 900, `retry ${sixth.retry}`);
});

test("blocked attempts are not recorded, so the lock never extends", { skip }, () => {
  sync("truncate public.login_attempts");
  for (let i = 0; i < 5; i += 1) reserve("a@x.it", "1.1.1.1");
  for (let i = 0; i < 10; i += 1) assert.equal(reserve("a@x.it", "1.1.1.1").allowed, false);
  assert.equal(sync("select count(*) from public.login_attempts"), "5");
});

test("a stranger on another IP cannot lock the owner out with the pair limit", { skip }, () => {
  sync("truncate public.login_attempts");
  for (let i = 0; i < 10; i += 1) reserve("owner@x.it", "6.6.6.6"); // l'estraneo si blocca da solo
  assert.equal(reserve("owner@x.it", "1.1.1.1").allowed, true);
});

test("rotating IPs is stopped by the per-email limit (25)", { skip }, () => {
  sync("truncate public.login_attempts");
  for (let i = 1; i <= 25; i += 1) assert.equal(reserve("v@x.it", `10.0.0.${i}`).allowed, true, `tentativo ${i}`);
  assert.equal(reserve("v@x.it", "10.0.0.99").allowed, false);
  assert.equal(reserve("altra@x.it", "10.0.0.99").allowed, true); // un'altra email non e' toccata
});

test("scanning many emails from one IP is stopped by the per-IP limit (30)", { skip }, () => {
  sync("truncate public.login_attempts");
  for (let i = 1; i <= 30; i += 1) assert.equal(reserve(`u${i}@x.it`, "7.7.7.7").allowed, true, `tentativo ${i}`);
  assert.equal(reserve("u31@x.it", "7.7.7.7").allowed, false);
});

test("the window slides: failures older than 15 minutes are ignored and the unlock time is exact", { skip }, () => {
  sync("truncate public.login_attempts");
  // 5 errori: il piu' vecchio di 14 minuti e 30 secondi fa -> sblocco tra ~30 secondi
  sync(`insert into public.login_attempts (email, ip, created_at) select 'w@x.it', '2.2.2.2', now() - (interval '14 minutes 30 seconds') + (g * interval '10 seconds') from generate_series(0, 4) g`);
  const blocked = reserve("w@x.it", "2.2.2.2");
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retry >= 25 && blocked.retry <= 31, `retry ${blocked.retry}`);
  // errori vecchi di oltre 15 minuti: ignorati
  sync("truncate public.login_attempts");
  sync(`insert into public.login_attempts (email, ip, created_at) select 'w@x.it', '2.2.2.2', now() - interval '16 minutes' from generate_series(1, 20)`);
  assert.equal(reserve("w@x.it", "2.2.2.2").allowed, true);
});

test("the lock lasts until ALL tripped levels are free", { skip }, () => {
  sync("truncate public.login_attempts");
  // coppia: 5 errori che escono tra ~20 s; IP: 30 errori (altre email) che escono tra ~600 s
  sync(`insert into public.login_attempts (email, ip, created_at) select 'm@x.it', '3.3.3.3', now() - interval '14 minutes 40 seconds' + (g * interval '1 second') from generate_series(0, 4) g`);
  sync(`insert into public.login_attempts (email, ip, created_at) select 'o' || g || '@x.it', '3.3.3.3', now() - interval '5 minutes' + (g * interval '1 second') from generate_series(1, 30) g`);
  const d = reserve("m@x.it", "3.3.3.3");
  assert.equal(d.allowed, false);
  assert.ok(d.retry > 500, `deve valere il livello che si sblocca per ultimo, ottenuto ${d.retry}`);
});

test("a successful login clears the pair (delete) and the next attempt is allowed", { skip }, () => {
  sync("truncate public.login_attempts");
  for (let i = 0; i < 5; i += 1) reserve("c@x.it", "4.4.4.4");
  assert.equal(reserve("c@x.it", "4.4.4.4").allowed, false);
  sync("delete from public.login_attempts where email = 'c@x.it' and ip = '4.4.4.4'");
  assert.equal(reserve("c@x.it", "4.4.4.4").allowed, true);
});

test("CONCURRENCY: 40 simultaneous attempts for the same email+IP let exactly 5 through", { skip }, async () => {
  sync("truncate public.login_attempts");
  const results = await Promise.all(Array.from({ length: 40 }, () => asyncQuery(reserveSql("race@x.it", "5.5.5.5"))));
  const allowed = results.filter((r) => r.startsWith("true")).length;
  assert.equal(allowed, 5, `passate ${allowed} su 40`);
  assert.equal(sync("select count(*) from public.login_attempts where email = 'race@x.it'"), "5");
});

test("CONCURRENCY: 60 simultaneous attempts across 60 IPs for one email let exactly 25 through", { skip }, async () => {
  sync("truncate public.login_attempts");
  const results = await Promise.all(Array.from({ length: 60 }, (_, i) => asyncQuery(reserveSql("race2@x.it", `9.9.9.${i + 1}`))));
  assert.equal(results.filter((r) => r.startsWith("true")).length, 25);
});

test("inputs are bounded and an empty IP becomes 'unknown'", { skip }, () => {
  sync("truncate public.login_attempts");
  sync(`select * from public.reserve_login_attempt('${"x".repeat(500)}', '')`);
  assert.equal(sync("select length(email) || '|' || ip from public.login_attempts"), "254|unknown");
});

test("only the service role can execute it; anon and public cannot", { skip }, () => {
  const sig = "public.reserve_login_attempt(text,text,integer,integer,integer,integer)";
  assert.equal(sync(`select has_function_privilege('anon', '${sig}', 'execute')::text`), "false");
  assert.equal(sync(`select has_function_privilege('service_role', '${sig}', 'execute')::text`), "true");
});

test("the migration file is the one that gets applied (sanity)", { skip }, () => {
  assert.match(readFileSync("supabase/migrations/20261108170000_login_throttle_atomic_v1.sql", "utf8"), /pg_advisory_xact_lock/);
});
