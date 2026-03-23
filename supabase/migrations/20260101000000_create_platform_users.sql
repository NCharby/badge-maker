-- ============================================================
-- Platform Users
-- Central user profile table for the SD Platform.
-- One row per Supabase Auth user.
-- Extends auth.users with role, profile, and preferences.
-- ============================================================

CREATE TABLE public.platform_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'event_promoter', 'system_admin')) DEFAULT 'user',
  email TEXT UNIQUE NOT NULL,          -- mirrored from auth.users for query convenience

  -- Telegram
  telegram_handle TEXT,                -- stored without '@'; stripped on input
  telegram_verified BOOLEAN NOT NULL DEFAULT false,

  -- Age / Identity
  date_of_birth DATE NOT NULL,
  age_verification_status TEXT CHECK (age_verification_status IN ('unverified', 'pending', 'verified', 'failed')) DEFAULT 'unverified',
  age_verified_at TIMESTAMPTZ,
  age_verification_provider TEXT,      -- 'stub' until real provider selected

  -- Profile
  preferred_scene_name TEXT,           -- universal display name; fallback: email-before-@ if null/empty
  other_scene_names TEXT[],            -- EP reference only; never shown in user-facing UI
  phone TEXT,
  address TEXT,
  zip_code TEXT,
  social_media JSONB,                  -- [{ "key": string, "value": string }]
  profile_picture_url TEXT,
  roommate_finder_hidden BOOLEAN NOT NULL DEFAULT false,

  -- Notification preferences
  email_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  telegram_notifications_enabled BOOLEAN NOT NULL DEFAULT false,  -- activates when telegram_verified → true
  notification_preferences JSONB,      -- EP only: per-notification-type channel config

  -- EP only
  payment_provider TEXT CHECK (payment_provider IN ('square', 'paypal')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_platform_users_role ON public.platform_users(role);
CREATE INDEX idx_platform_users_email ON public.platform_users(email);
CREATE INDEX idx_platform_users_telegram ON public.platform_users(telegram_handle)
  WHERE telegram_handle IS NOT NULL;

-- ── updated_at trigger ───────────────────────────────────────────────────────
-- Reuses update_updated_at_column() from baseline migration.

CREATE TRIGGER update_platform_users_updated_at
  BEFORE UPDATE ON public.platform_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── telegram_notifications_enabled auto-activation ───────────────────────────
-- When telegram_verified transitions from false to true,
-- automatically enable telegram notifications.

CREATE OR REPLACE FUNCTION activate_telegram_notifications()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.telegram_verified = false AND NEW.telegram_verified = true THEN
    NEW.telegram_notifications_enabled := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_telegram_verified
  BEFORE UPDATE ON public.platform_users
  FOR EACH ROW EXECUTE FUNCTION activate_telegram_notifications();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Note: SA operations use the Supabase service role key (bypasses RLS).
-- The auth.user_role() helper is defined in migration 20260101000015.
-- To avoid bootstrapping issues, platform_users uses simpler auth.uid() checks only.

ALTER TABLE public.platform_users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile.
CREATE POLICY "platform_users: user reads own" ON public.platform_users
  FOR SELECT USING (auth.uid() = id);

-- Users can insert their own profile (account creation Server Action).
CREATE POLICY "platform_users: user inserts own" ON public.platform_users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile.
CREATE POLICY "platform_users: user updates own" ON public.platform_users
  FOR UPDATE USING (auth.uid() = id);

-- No user-facing delete policy; deletion is handled via service role only.
