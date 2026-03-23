-- ============================================================
-- Venues
-- A Venue is the physical location for an event and the
-- container for its Room Matrix.
-- ============================================================

CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.platform_users(id),  -- EP who created it
  name TEXT NOT NULL,
  physical_address TEXT NOT NULL,
  website TEXT,
  email TEXT,       -- default hotel contact email for weekly reports
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_venues_owner_id ON public.venues(owner_id);

-- ── updated_at trigger ───────────────────────────────────────────────────────

CREATE TRIGGER update_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- EPs and SAs can select venues; only the owner EP or SA can modify.
-- auth.user_role() is defined in migration 20260101000015.
-- Policies added in migration 20260101000015_rls_policies.sql.

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
