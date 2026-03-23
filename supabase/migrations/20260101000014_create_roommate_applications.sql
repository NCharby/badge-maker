-- ============================================================
-- Roommate Applications
-- Tracks both flows for filling bed spots in a room:
--   initiated_by='roommate'   — Roommate applies for a spot
--   initiated_by='room_lead'  — Room Lead claims a user by email
--
-- Conflict resolution: when a Room Lead accepts any application
-- or claim for a specific bed_number, all other pending records
-- for that (event_id, room_id, bed_number) are automatically
-- set to 'superseded'. Those users receive decline notification
-- (notification row 9). This is enforced by application logic
-- triggered after a status → 'accepted' update.
-- ============================================================

CREATE TABLE public.roommate_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.platform_events(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  applicant_user_id UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
  initiated_by TEXT NOT NULL CHECK (initiated_by IN ('roommate', 'room_lead')),
  bed_number INTEGER,    -- specific bed targeted; null = any open spot
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'superseded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.platform_users(id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_roommate_applications_event_id ON public.roommate_applications(event_id);
CREATE INDEX idx_roommate_applications_room_id ON public.roommate_applications(room_id);
CREATE INDEX idx_roommate_applications_applicant ON public.roommate_applications(applicant_user_id);
CREATE INDEX idx_roommate_applications_pending ON public.roommate_applications(event_id, room_id, status)
  WHERE status = 'pending';

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Policies added in migration 20260101000015_rls_policies.sql.

ALTER TABLE public.roommate_applications ENABLE ROW LEVEL SECURITY;
