-- Trigger: auto-create platform_users row when a new auth.users row is inserted.
--
-- This eliminates the race condition between GoTrue (which writes auth.users) and
-- PostgREST (which writes platform_users) in Supabase's hosted environment. Both
-- services use the same database through a connection pool; the FK check on
-- platform_users.id → auth.users.id can fail if GoTrue's transaction hasn't been
-- seen yet by the PostgREST connection. Running the insert in the same trigger
-- transaction as auth.users INSERT makes the FK violation impossible.
--
-- The trigger is conditional on date_of_birth being present in raw_user_meta_data.
-- This ensures the seed script (which creates auth users WITHOUT metadata) is
-- unaffected — the seed inserts platform_users rows manually with full data.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed when date_of_birth is present — real registrations always include it;
  -- the seed script does not, so seed-created auth users are handled separately.
  IF (NEW.raw_user_meta_data->>'date_of_birth') IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.platform_users (
    id,
    email,
    date_of_birth,
    telegram_handle,
    preferred_scene_name,
    role
  )
  VALUES (
    NEW.id,
    NEW.email,
    (NEW.raw_user_meta_data->>'date_of_birth')::date,
    NULLIF(TRIM(NEW.raw_user_meta_data->>'telegram_handle'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'preferred_scene_name'), ''),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
