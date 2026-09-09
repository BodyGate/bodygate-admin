-- Same class of issue as the course RPCs (202608311130): Postgres grants
-- EXECUTE to PUBLIC by default on CREATE FUNCTION, which left this
-- SECURITY DEFINER function callable directly by anon/authenticated via
-- PostgREST, bypassing the service-role-only /api/training route.
revoke execute on function public.create_training_program_atomic(jsonb) from public, anon, authenticated;
