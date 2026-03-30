-- Remove the FK constraint from platform_users.id → auth.users.id.
--
-- The FK causes a race condition on Supabase's hosted platform: GoTrue writes
-- auth.users via its own connection pool and returns HTTP 200, but PostgREST
-- (which uses PgBouncer in transaction mode) cannot see GoTrue's committed row
-- quickly enough to satisfy the FK check during the platform_users INSERT.
-- Retry logic with delays did not resolve this — the visibility gap persists
-- beyond 1.5 seconds in practice.
--
-- The cascade delete behaviour (DELETE platform_users when auth user deleted)
-- is preserved via an AFTER DELETE trigger below, which is functionally
-- equivalent to ON DELETE CASCADE.

ALTER TABLE public.platform_users
  DROP CONSTRAINT IF EXISTS platform_users_id_fkey;

-- Preserve cascade delete via trigger
CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.platform_users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_deleted();
