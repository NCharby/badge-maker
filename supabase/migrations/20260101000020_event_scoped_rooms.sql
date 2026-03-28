-- ============================================================
-- Event-Scoped Rooms
--
-- Adds event_id to rooms so the Room Selection module can
-- manage rooms directly on an event without requiring a
-- pre-saved Venue object. Makes venue_id nullable.
--
-- A room is either venue-scoped (venue_id set) or event-scoped
-- (event_id set). The XOR constraint enforces exactly one is set.
-- All attendee-facing room features work identically for both.
-- ============================================================

-- 1. Make venue_id nullable (was NOT NULL with ON DELETE CASCADE)
ALTER TABLE public.rooms
  ALTER COLUMN venue_id DROP NOT NULL;

-- 2. Add event_id FK for event-scoped rooms
ALTER TABLE public.rooms
  ADD COLUMN event_id UUID REFERENCES public.platform_events(id) ON DELETE CASCADE;

-- 3. XOR constraint: exactly one of venue_id / event_id must be set
ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_scope_xor
  CHECK (
    (venue_id IS NOT NULL AND event_id IS NULL) OR
    (venue_id IS NULL  AND event_id IS NOT NULL)
  );

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- 4. Rebuild room_group composite index to cover both scopes
DROP INDEX IF EXISTS idx_rooms_room_group;

CREATE INDEX idx_rooms_room_group_venue ON public.rooms(venue_id, room_group)
  WHERE venue_id IS NOT NULL AND room_group IS NOT NULL;

CREATE INDEX idx_rooms_room_group_event ON public.rooms(event_id, room_group)
  WHERE event_id IS NOT NULL AND room_group IS NOT NULL;

-- 5. Index for event-scoped room queries
CREATE INDEX idx_rooms_event_id ON public.rooms(event_id)
  WHERE event_id IS NOT NULL;

-- 6. Unique room number constraint for event-scoped rooms
--    (venue-scoped rooms already have rooms_venue_number_unique from migration 19)
CREATE UNIQUE INDEX rooms_event_number_unique
  ON public.rooms(event_id, number)
  WHERE event_id IS NOT NULL AND number IS NOT NULL;

-- ── AUTO-{n} trigger: handle both venue-scoped and event-scoped ───────────────

CREATE OR REPLACE FUNCTION assign_room_auto_number()
RETURNS TRIGGER AS $$
DECLARE
  max_n INTEGER;
BEGIN
  IF NEW.number IS NULL THEN
    IF NEW.venue_id IS NOT NULL THEN
      SELECT COALESCE(
        MAX(CAST(SUBSTRING(number FROM 6) AS INTEGER)),
        0
      ) + 1
      INTO max_n
      FROM public.rooms
      WHERE venue_id = NEW.venue_id
        AND number ~ '^AUTO-\d+$';
    ELSE
      SELECT COALESCE(
        MAX(CAST(SUBSTRING(number FROM 6) AS INTEGER)),
        0
      ) + 1
      INTO max_n
      FROM public.rooms
      WHERE event_id = NEW.event_id
        AND number ~ '^AUTO-\d+$';
    END IF;

    NEW.number := 'AUTO-' || max_n::TEXT;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── RLS: update room policies to cover event-scoped rooms ────────────────────

-- INSERT: allow EP to insert rooms scoped to a venue they own OR an event they own
DROP POLICY IF EXISTS "rooms: ep inserts into own venues" ON public.rooms;

CREATE POLICY "rooms: ep inserts" ON public.rooms
  FOR INSERT
  WITH CHECK (
    (
      venue_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.venues
        WHERE id = rooms.venue_id AND owner_id = auth.uid()
      )
    ) OR (
      event_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.platform_events
        WHERE id = rooms.event_id AND owner_id = auth.uid()
      )
    ) OR public.user_role() = 'system_admin'
  );

-- UPDATE: same dual-scope ownership check
DROP POLICY IF EXISTS "rooms: ep or sa updates own venue rooms" ON public.rooms;

CREATE POLICY "rooms: ep or sa updates" ON public.rooms
  FOR UPDATE
  USING (
    (
      venue_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.venues
        WHERE id = rooms.venue_id AND owner_id = auth.uid()
      )
    ) OR (
      event_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.platform_events
        WHERE id = rooms.event_id AND owner_id = auth.uid()
      )
    ) OR public.user_role() = 'system_admin'
  );

-- DELETE: same dual-scope ownership check
DROP POLICY IF EXISTS "rooms: ep or sa deletes own venue rooms" ON public.rooms;

CREATE POLICY "rooms: ep or sa deletes" ON public.rooms
  FOR DELETE
  USING (
    (
      venue_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.venues
        WHERE id = rooms.venue_id AND owner_id = auth.uid()
      )
    ) OR (
      event_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.platform_events
        WHERE id = rooms.event_id AND owner_id = auth.uid()
      )
    ) OR public.user_role() = 'system_admin'
  );
