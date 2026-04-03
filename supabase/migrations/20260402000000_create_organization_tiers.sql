-- Organization tiers: defines pricing and feature limits per org plan
CREATE TABLE organization_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  billing_interval TEXT CHECK (billing_interval IN ('monthly', 'yearly')),
  price_cents INTEGER,
  max_members INTEGER,
  max_events INTEGER,
  max_tickets_per_event INTEGER,
  allowed_modules TEXT[],
  max_attendees_per_event INTEGER,
  max_storage_mb INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the free tier: all limits NULL = unlimited (for now)
INSERT INTO organization_tiers (name, billing_interval, price_cents, max_members, max_events, max_tickets_per_event, allowed_modules, max_attendees_per_event, max_storage_mb)
VALUES ('free', null, null, null, null, null, null, null, null);
