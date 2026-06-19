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
