-- BodyGate Platinum customer integrity audit (READ ONLY)
-- No UPDATE/INSERT/DELETE statements: preview only.

-- 1. Abbonamenti attivi con plan_id null
select * from customer_subscriptions where is_active is not false and plan_id is null;

-- 2. Abbonamenti con plan_id orfano
select cs.* from customer_subscriptions cs left join subscription_plans sp on sp.id = cs.plan_id where cs.plan_id is not null and sp.id is null;

-- 3. Abbonamenti con branch diversa dal piano
select cs.id, cs.customer_id, cs.branch_id as subscription_branch_id, sp.branch_id as plan_branch_id, sp.name from customer_subscriptions cs join subscription_plans sp on sp.id = cs.plan_id where cs.branch_id is not null and sp.branch_id is not null and cs.branch_id <> sp.branch_id;

-- 4. Abbonamenti duplicati attivi per cliente
select customer_id, count(*) as active_count, array_agg(id order by created_at desc) as subscription_ids from customer_subscriptions where is_active is not false and starts_at <= current_date and ends_at >= current_date group by customer_id having count(*) > 1;

-- 5. Clienti attivi senza branch_id
select id, first_name, last_name, status, is_active from customers where (is_active is true or active is true or status = 'active') and branch_id is null;

-- 6. branch_id che non risolvono una sede
select c.id, c.first_name, c.last_name, c.branch_id from customers c left join branches b on b.id = c.branch_id where c.branch_id is not null and b.id is null;

-- 7. customer.subscription_status incoerente con customer_subscriptions
with active_subs as (select customer_id, count(*) as active_count from customer_subscriptions where is_active is not false and starts_at <= current_date and ends_at >= current_date group by customer_id)
select c.id, c.first_name, c.last_name, c.subscription_status, coalesce(a.active_count,0) as active_subscription_count from customers c left join active_subs a on a.customer_id = c.id where (c.subscription_status = 'active' and coalesce(a.active_count,0) = 0) or (c.subscription_status <> 'active' and coalesce(a.active_count,0) > 0);

-- 8. Clienti con accesso valido ma piano non associato
select c.id, c.first_name, c.last_name, cs.id as subscription_id, cs.starts_at, cs.ends_at from customers c join customer_subscriptions cs on cs.customer_id = c.id where cs.is_active is not false and cs.starts_at <= current_date and cs.ends_at >= current_date and cs.plan_id is null and c.branch_id is not null and (c.badge_code is not null or c.controller_code is not null);

-- 9. Onboarding accounting_entries già create
select * from accounting_entries where source = 'customer_onboarding' or category = 'onboarding' or description ilike '%onboarding cliente%' order by entry_date desc, created_at desc nulls last;

-- 10. Stato specifico di Roberta Mustacciolo
select c.id as customer_id, c.first_name, c.last_name, c.birth_date, c.branch_id, b.name as branch_name, b.city as branch_city, cs.id as subscription_id, cs.plan_id, sp.name as plan_name, cs.starts_at, cs.ends_at, cs.amount, cs.is_active, cmf.valid_until as membership_valid_until, c.medical_certificate_end_date, c.badge_code, c.controller_code from customers c left join branches b on b.id = c.branch_id left join customer_subscriptions cs on cs.customer_id = c.id and cs.id = '8dba51cf-6181-4575-a10c-2c667781bf66' left join subscription_plans sp on sp.id = cs.plan_id left join lateral (select * from customer_membership_fees f where f.customer_id = c.id order by f.valid_until desc limit 1) cmf on true where c.id = '09e5a6d2-da98-4ebc-b3fd-f1589b9ee120';

-- 11. Candidati piano per l’abbonamento di Roberta
select sp.id as plan_id, sp.name, b.name as branch, b.city, sp.duration_days, sp.price, sp.promo_price, sp.is_active from subscription_plans sp left join branches b on b.id = sp.branch_id where sp.branch_id = (select branch_id from customers where id = '09e5a6d2-da98-4ebc-b3fd-f1589b9ee120') order by sp.is_active desc, sp.duration_days, sp.name;

-- 12. customer_payments con importo diverso dalla ricevuta collegata (READ ONLY)
select cp.id as customer_payment_id, cp.customer_id, cp.type, cp.amount as customer_payment_amount, cr.id as receipt_id, cr.receipt_number, cr.amount as receipt_amount, cr.receipt_type
from customer_payments cp
join customer_receipts cr on cr.payment_id = cp.id
where round(coalesce(cp.amount, 0)::numeric, 2) <> round(coalesce(cr.amount, 0)::numeric, 2)
order by cr.issued_at desc nulls last, cp.paid_at desc nulls last;

-- 13. customer_payments con importo diverso dal registro payments plausibilmente collegato (READ ONLY)
select cp.id as customer_payment_id, p.id as payment_id, cp.customer_id, cp.type, p.payment_type, cp.amount as customer_payment_amount, p.amount as payment_amount, cp.paid_at, p.paid_at as payment_paid_at, cp.description, p.description as payment_description
from customer_payments cp
join payments p on p.customer_id = cp.customer_id
  and p.payment_type = cp.type
  and (
    p.id = cp.id
    or date(p.paid_at) = date(cp.paid_at)
    or round(coalesce(p.amount, 0)::numeric, 2) = round(coalesce(cp.amount, 0)::numeric, 2)
    or nullif(trim(p.description), '') = nullif(trim(cp.description), '')
  )
where round(coalesce(cp.amount, 0)::numeric, 2) <> round(coalesce(p.amount, 0)::numeric, 2)
order by cp.paid_at desc nulls last;

-- 14. onboarding con totale diverso da subscription + membership_fee (READ ONLY)
select cp.id as customer_payment_id, cp.customer_id, cp.amount as customer_payment_amount, cs.id as subscription_id, cs.amount as subscription_amount, cmf.id as membership_fee_id, cmf.amount as membership_fee_amount, round((coalesce(cs.amount, 0) + coalesce(cmf.amount, 0))::numeric, 2) as expected_total
from customer_payments cp
left join customer_receipts cr on cr.payment_id = cp.id
left join customer_subscriptions cs on cs.id = cr.subscription_id
left join lateral (
  select f.* from customer_membership_fees f
  where f.customer_id = cp.customer_id
  order by abs(extract(epoch from (coalesce(f.created_at, f.valid_from::timestamp) - coalesce(cp.paid_at, cp.created_at)))) asc nulls last
  limit 1
) cmf on true
where cp.type = 'onboarding'
  and round(coalesce(cp.amount, 0)::numeric, 2) <> round((coalesce(cs.amount, 0) + coalesce(cmf.amount, 0))::numeric, 2)
order by cp.paid_at desc nulls last;

-- 15. ricevute onboarding con importo diverso dai componenti (READ ONLY)
select cr.id as receipt_id, cr.receipt_number, cr.customer_id, cr.amount as receipt_amount, cs.id as subscription_id, cs.amount as subscription_amount, cmf.id as membership_fee_id, cmf.amount as membership_fee_amount, round((coalesce(cs.amount, 0) + coalesce(cmf.amount, 0))::numeric, 2) as expected_total
from customer_receipts cr
left join customer_subscriptions cs on cs.id = cr.subscription_id
left join lateral (
  select f.* from customer_membership_fees f
  where f.customer_id = cr.customer_id
  order by abs(extract(epoch from (coalesce(f.created_at, f.valid_from::timestamp) - coalesce(cr.issued_at, cr.created_at)))) asc nulls last
  limit 1
) cmf on true
where cr.receipt_type = 'onboarding'
  and round(coalesce(cr.amount, 0)::numeric, 2) <> round((coalesce(cs.amount, 0) + coalesce(cmf.amount, 0))::numeric, 2)
order by cr.issued_at desc nulls last;

-- 16. Rettifiche customer_payments non propagate a ricevuta o payments (READ ONLY)
select cp.id as customer_payment_id, cp.customer_id, cp.amount as customer_payment_amount, cr.receipt_number, cr.amount as receipt_amount, p.id as payment_id, p.amount as payment_amount, cp.notes, cp.updated_at
from customer_payments cp
left join customer_receipts cr on cr.payment_id = cp.id
left join payments p on p.customer_id = cp.customer_id and p.payment_type = cp.type and (p.id = cp.id or date(p.paid_at) = date(cp.paid_at) or nullif(trim(p.description), '') = nullif(trim(cp.description), ''))
where (cp.notes ilike '%rettifica%' or cp.correction_reason is not null)
  and (
    (cr.id is not null and round(coalesce(cp.amount, 0)::numeric, 2) <> round(coalesce(cr.amount, 0)::numeric, 2))
    or (p.id is not null and round(coalesce(cp.amount, 0)::numeric, 2) <> round(coalesce(p.amount, 0)::numeric, 2))
  )
order by cp.updated_at desc nulls last;

-- 17. Dettaglio riconciliazione specifico Roberta Mustacciolo (READ ONLY)
select c.id as customer_id, c.first_name, c.last_name, cp.id as customer_payment_id, cp.type, cp.amount as customer_payment_amount, cp.payment_method, cp.description, p.id as payment_id, p.amount as payment_amount, cr.id as receipt_id, cr.receipt_number, cr.receipt_type, cr.amount as receipt_amount, cs.id as subscription_id, cs.amount as subscription_amount, cmf.id as membership_fee_id, cmf.amount as membership_fee_amount, round((coalesce(cs.amount, 0) + coalesce(cmf.amount, 0))::numeric, 2) as expected_total
from customers c
left join customer_payments cp on cp.customer_id = c.id and cp.id = '57d515ba-180e-4db8-a64d-a47c8fc605ec'
left join payments p on p.customer_id = c.id and p.id = '0c9889a2-df04-49dd-822c-211ce6c8cb41'
left join customer_receipts cr on cr.payment_id = cp.id and cr.receipt_number = '2026-0012'
left join customer_subscriptions cs on cs.id = cr.subscription_id
left join lateral (select f.* from customer_membership_fees f where f.customer_id = c.id order by f.created_at desc nulls last limit 1) cmf on true
where c.id = '09e5a6d2-da98-4ebc-b3fd-f1589b9ee120';
