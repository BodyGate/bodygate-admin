-- BodyGate safe preview + backfill for missing branch_id in onboarding data.
-- Rules: no deletes, no receipt renumbering, no cash_movements/prima nota changes.

begin;

with active_branches as (
  select id
  from public.branches
  where coalesce(is_active, active, status = 'active') = true
), default_branch as (
  select case when count(*) = 1 then max(id) end as id
  from active_branches
), preview as (
  select
    (select count(*) from public.customers c where coalesce(c.is_active, c.active, c.status = 'active') = true and c.branch_id is null) as active_customers_without_branch,
    (select count(*) from public.customer_membership_fees f where f.branch_id is null) as membership_fees_without_branch,
    (select count(*) from public.customer_membership_fees f join public.customers c on c.id = f.customer_id where f.branch_id is null and c.branch_id is not null) as membership_fees_fixable_from_customer_branch,
    (select id from default_branch) as default_branch_id
)
select * from preview;

-- Uncomment these updates after checking preview counts and confirming default_branch_id.
-- with default_branch as (
--   select case when count(*) = 1 then max(id) end as id
--   from public.branches
--   where coalesce(is_active, active, status = 'active') = true
-- )
-- update public.customers c
-- set branch_id = (select id from default_branch)
-- where coalesce(c.is_active, c.active, c.status = 'active') = true
--   and c.branch_id is null
--   and (select id from default_branch) is not null;
--
-- update public.customer_membership_fees f
-- set branch_id = c.branch_id
-- from public.customers c
-- where c.id = f.customer_id
--   and f.branch_id is null
--   and c.branch_id is not null;

rollback;
