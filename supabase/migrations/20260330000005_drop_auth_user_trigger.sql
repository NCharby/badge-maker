-- Drop the on_auth_user_created trigger and its function.
--
-- The trigger was intended to create platform_users rows atomically within
-- GoTrue's auth.users INSERT transaction. In practice it interferes with
-- GoTrue's transaction handling on Supabase's hosted platform: the trigger
-- causes GoTrue's INSERT to fail (or partially roll back), yet GoTrue returns
-- the pre-generated user UUID in the API response, so the auth.users row is
-- never actually committed. The caller then creates an orphaned platform_users
-- row against a non-existent auth user, and sign-in fails.
--
-- Platform_users rows are created in two other places that work correctly:
--   - Dev path:  registerDevUser() in src/app/(auth)/register/actions.ts
--   - Prod path: auth/callback/route.ts (after email confirmation)

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();
