-- ============================================================
-- Event Room Config
-- Per-event overlay on top of the venue's room matrix.
-- One row per (event, room) pair.
-- Controls blocking, reservations, and Room Open Group phase
-- assignment for each room within a specific event.
-- ============================================================

CREATE TABLE public.event_room_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.platform_events(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,

  -- Blocking (whole-room; per-bed blocking is in bed_blocks table)
  blocked BOOLEAN NOT NULL DEFAULT false,
  block_note TEXT,                          -- EP-visible only; not shown to users

  -- Reservation (whole-room; EP manually assigns room to a use case)
  reserved BOOLEAN NOT NULL DEFAULT false,
  reservation_note TEXT,
  reservation_note_public BOOLEAN NOT NULL DEFAULT false,  -- if true, note shown to users

  -- Room Open Group (optional incremental room release per phase)
  -- null = room is visible to all attendees regardless of group config
  open_group_phase TEXT,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.platform_users(id),

  UNIQUE(event_id, room_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_event_room_config_event_id ON public.event_room_config(event_id);
CREATE INDEX idx_event_room_config_blocked ON public.event_room_config(event_id, blocked)
  WHERE blocked = true;
CREATE INDEX idx_event_room_config_reserved ON public.event_room_config(event_id, reserved)
  WHERE reserved = true;

-- ── updated_at trigger ───────────────────────────────────────────────────────

CREATE TRIGGER update_event_room_config_updated_at
  BEFORE UPDATE ON public.event_room_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Policies added in migration 20260101000015_rls_policies.sql.

ALTER TABLE public.event_room_config ENABLE ROW LEVEL SECURITY;
