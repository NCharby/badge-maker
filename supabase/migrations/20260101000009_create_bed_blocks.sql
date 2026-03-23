-- ============================================================
-- Bed Blocks
-- Per-bed blocking within a room for a specific event.
-- Reduces effective capacity without removing the room.
-- Effective max occupancy = bed_spot_count - COUNT(bed_blocks)
-- for that room + event combination.
-- ============================================================

CREATE TABLE public.bed_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.platform_events(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  bed_number INTEGER NOT NULL,   -- positional slot 1..bed_spot_count
  block_note TEXT,               -- EP-visible only; not shown to users
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.platform_users(id),

  UNIQUE(event_id, room_id, bed_number)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_bed_blocks_event_room ON public.bed_blocks(event_id, room_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Policies added in migration 20260101000015_rls_policies.sql.

ALTER TABLE public.bed_blocks ENABLE ROW LEVEL SECURITY;
