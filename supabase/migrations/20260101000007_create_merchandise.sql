-- ============================================================
-- Merchandise
-- Per-event merchandise items available during ticket checkout.
-- Items with finite available_count use the Locks table
-- (resource_type = 'merchandise') to prevent overselling.
-- ============================================================

CREATE TABLE public.merchandise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.platform_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  available_count INTEGER,              -- null = unlimited; finite counts use soft lock
  image_url TEXT,
  ticket_type_restriction UUID[],       -- empty = no restriction; else array of ticket_type IDs
                                        -- only shown to users whose ticket_type_id is in this array
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_merchandise_event_id ON public.merchandise(event_id);
CREATE INDEX idx_merchandise_event_enabled ON public.merchandise(event_id, enabled)
  WHERE enabled = true;

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Policies added in migration 20260101000015_rls_policies.sql.

ALTER TABLE public.merchandise ENABLE ROW LEVEL SECURITY;
