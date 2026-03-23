-- ============================================================
-- Ticket Groups and Ticket Types
-- ticket_groups: optional shared pool container for ticket_types.
-- ticket_types: purchasable ticket definitions per event.
--
-- DEFERRED FK RESOLUTION:
--   Adds event_attendees.ticket_type_id → ticket_types(id)
--   (column created in migration 20260101000004; FK added here)
-- ============================================================

CREATE TABLE public.ticket_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.platform_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  available_count INTEGER,   -- shared pool; null = use individual ticket_type available_count
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.platform_events(id) ON DELETE CASCADE,
  ticket_group_id UUID REFERENCES public.ticket_groups(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  available_count INTEGER,                  -- null = unlimited
  room_lead BOOLEAN NOT NULL DEFAULT false, -- designates purchaser as Room Lead
  volunteer_hours_required INTEGER NOT NULL DEFAULT 0,
  room_required_at_purchase BOOLEAN NOT NULL DEFAULT false,
  room_type_restriction TEXT[],             -- room_group names; empty array = no restriction
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_ticket_groups_event_id ON public.ticket_groups(event_id);
CREATE INDEX idx_ticket_types_event_id ON public.ticket_types(event_id);
CREATE INDEX idx_ticket_types_ticket_group_id ON public.ticket_types(ticket_group_id)
  WHERE ticket_group_id IS NOT NULL;

-- ── Deferred FK: event_attendees.ticket_type_id → ticket_types(id) ───────────
-- Column created in migration 20260101000004 without a FK.
-- Now that ticket_types exists, add the constraint.

ALTER TABLE public.event_attendees
  ADD CONSTRAINT fk_event_attendees_ticket_type_id
  FOREIGN KEY (ticket_type_id) REFERENCES public.ticket_types(id)
  ON DELETE SET NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Policies added in migration 20260101000015_rls_policies.sql.

ALTER TABLE public.ticket_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
