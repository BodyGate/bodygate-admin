-- POST /api/customers/update-profile assigns an RFID badge with
-- `customer_badges.upsert({...}, { onConflict: "badge_code" })`, expecting
-- Postgres to reuse the existing row for that badge_code. `customer_badges`
-- has only a plain (non-unique) btree index on badge_code
-- (idx_customer_badges_code, see supabase/baseline/02_constraints_indexes.sql),
-- so Postgres has no unique/exclusion constraint to match the ON CONFLICT
-- target and rejects the upsert (42P10) on every single call. Until this
-- migration, the route never checked that error, so update-profile reported
-- success while customer_badges silently kept no record of the badge. That
-- breaks two things that read customer_badges: the "Badge non allineato"
-- check in /api/access/credentials-audit (false positive on every customer
-- who got a badge via this route) and the customer_badges half of the
-- duplicate-badge guard in update-profile's own findBadgeConflict (always a
-- no-op, since no row is ever there to find).
--
-- Dedupe defensively before adding the constraint: the one-off scripts in
-- docs/sql/ that insert into customer_badges directly already guard with an
-- explicit "insert only if no row has this badge_code" check, so no
-- duplicate is expected, but the migration must not fail to apply if one
-- slipped in anyway. Keep the active row per badge_code (or, if none is
-- active, the most recently created one) and drop the rest; this only
-- removes redundant duplicate rows for the same physical badge, not any
-- customer's current credential.
delete from public.customer_badges a
using (
  select
    id,
    row_number() over (
      partition by badge_code
      -- `is_active desc` alone would sort a NULL row first (Postgres's
      -- default for DESC is NULLS FIRST), keeping an inactive/unset row over
      -- a genuinely active one. `nulls last` makes true rank before both
      -- false and null, matching the "keep the active row" intent.
      order by is_active desc nulls last, created_at desc, id desc
    ) as rn
  from public.customer_badges
) ranked
where a.id = ranked.id
  and ranked.rn > 1;

alter table public.customer_badges
  add constraint customer_badges_badge_code_key unique (badge_code);
