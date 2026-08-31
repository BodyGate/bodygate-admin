-- Postgres grants EXECUTE to PUBLIC by default on CREATE FUNCTION, which made
-- the 5 course enrollment/payment RPCs callable directly by anon/authenticated
-- via PostgREST, bypassing the service-role-only API routes. Every other
-- course RPC already revokes this; align these with that pattern.
revoke execute on function public.enroll_customer_course_atomic_v1 from public, anon, authenticated;
revoke execute on function public.cancel_course_enrollment_atomic_v1 from public, anon, authenticated;
revoke execute on function public.sync_enrollment_bookings_atomic_v1 from public, anon, authenticated;
revoke execute on function public.pay_course_booking_atomic_v1 from public, anon, authenticated;
revoke execute on function public.renew_course_enrollment_payment_atomic_v1 from public, anon, authenticated;
