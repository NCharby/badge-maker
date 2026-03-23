-- ============================================================
-- Event Attendees
-- The join table between platform_users and platform_events.
-- One row per user per event. Tracks all per-module statuses.
--
-- DEFERRED FK CONSTRAINTS (added in later migrations):
--   ticket_type_id → ticket_types(id)  — added in migration 20260101000005
--   order_id       → orders(id)         — added in migration 20260101000006
-- ============================================================

CREATE TABLE public.event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.platform_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,

  -- Ticket
  ticket_type_id UUID,               -- FK added in migration 20260101000005
  ticket_purchased_at TIMESTAMPTZ,
  order_id UUID,                     -- FK added in migration 20260101000006

  -- Module statuses
  application_status TEXT NOT NULL DEFAULT 'Incomplete'
    CHECK (application_status IN ('Incomplete','In Progress','Needs Review','Completed','Approved','Declined','Closed')),
  waiver_status TEXT NOT NULL DEFAULT 'Incomplete'
    CHECK (waiver_status IN ('Incomplete','Completed','Declined')),
  ticket_status TEXT NOT NULL DEFAULT 'Incomplete'
    CHECK (ticket_status IN ('Incomplete','Complete')),
  room_status TEXT NOT NULL DEFAULT 'Not Selected'
    CHECK (room_status IN ('Not Selected','Selected','Locked In','Verified','Critical Issue')),
  lock_status TEXT NOT NULL DEFAULT 'Unlocked'
    CHECK (lock_status IN ('Unlocked','Ready to Lock','Locked')),

  -- Age verification mirror (EP-visible)
  age_verification_status TEXT DEFAULT 'unverified',

  -- Room assignment
  room_id UUID REFERENCES public.rooms(id),
  is_room_lead BOOLEAN NOT NULL DEFAULT false,   -- set from ticket_types.room_lead at purchase; EP-overridable
  room_open_group TEXT,                           -- assigned Room Open Group phase name

  -- Volunteering
  volunteer_hours_required INTEGER NOT NULL DEFAULT 0,  -- copied from ticket_types at purchase

  -- Check-in (MVP 2 only — do not implement logic in MVP 1)
  checked_in BOOLEAN DEFAULT false,
  checked_in_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One ticket per user per event
  UNIQUE(event_id, user_id)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_event_attendees_event_id ON public.event_attendees(event_id);
CREATE INDEX idx_event_attendees_user_id ON public.event_attendees(user_id);
CREATE INDEX idx_event_attendees_room_id ON public.event_attendees(room_id)
  WHERE room_id IS NOT NULL;
CREATE INDEX idx_event_attendees_lock_status ON public.event_attendees(event_id, lock_status);
CREATE INDEX idx_event_attendees_is_room_lead ON public.event_attendees(event_id, is_room_lead)
  WHERE is_room_lead = true;

-- ── updated_at trigger ───────────────────────────────────────────────────────

CREATE TRIGGER update_event_attendees_updated_at
  BEFORE UPDATE ON public.event_attendees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Policies added in migration 20260101000015_rls_policies.sql.

ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
