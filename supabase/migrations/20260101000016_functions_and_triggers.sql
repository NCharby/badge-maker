-- ============================================================
-- Functions and Triggers
--
-- 1. update_updated_at_column()  — ensure it exists (idempotent)
-- 2. get_roommate_finder_cards() — user-facing Roommate Finder RPC
-- 3. get_roommate_finder_cards_ep() — EP variant (includes blocked/reserved)
-- ============================================================

-- ── 1. update_updated_at_column ──────────────────────────────────────────────
-- Defined in the baseline migration (schema.sql). Redefined here with
-- CREATE OR REPLACE so this migration is safe to apply on a fresh DB
-- that never ran the baseline (e.g., a CI environment seeded differently).

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 2. get_roommate_finder_cards (user-facing) ────────────────────────────────
-- Returns Roommate Finder card data for all visible, available rooms
-- in the given event.
--
-- Authorization: caller must be a confirmed attendee of the event
--   (event_attendees row with user_id = auth.uid() and ticket_status = 'Complete').
--   Returns empty array if not authorized.
--
-- Exclusions:
--   - Rooms where event_room_config.blocked = true
--   - Rooms where event_room_config.reserved = true
--   - Rooms not linked to the event's venue
--
-- Privacy:
--   - platform_users.roommate_finder_hidden = true → display name = 'Anonymous'
--   - preferred_scene_name fallback: portion of email before '@'
--
-- Effective max occupancy = bed_spot_count - COUNT(bed_blocks for this event+room)
-- open_spot_count = effective max - confirmed occupants
--   (room_status IN ('Selected', 'Locked In', 'Verified'))

CREATE OR REPLACE FUNCTION public.get_roommate_finder_cards(p_event_id UUID)
RETURNS TABLE (
  room_id UUID,
  room_number TEXT,
  room_name TEXT,
  lodging_type TEXT,
  bed_type TEXT,
  has_kitchen BOOLEAN,
  location_zone TEXT,
  room_group TEXT,
  min_occupancy INTEGER,
  max_occupancy INTEGER,
  effective_max_occupancy INTEGER,
  open_spot_count INTEGER,
  room_daily_rates JSONB,
  room_lead_display_name TEXT,
  occupants JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_venue_id UUID;
BEGIN
  -- Authorization check: caller must be a confirmed attendee (ticket purchased)
  IF NOT EXISTS (
    SELECT 1 FROM public.event_attendees
    WHERE event_id = p_event_id
      AND user_id = auth.uid()
      AND ticket_status = 'Complete'
  ) THEN
    RETURN;  -- empty result set; no error exposed
  END IF;

  -- Resolve the venue for this event
  SELECT venue_id INTO v_venue_id
  FROM public.platform_events
  WHERE id = p_event_id;

  IF v_venue_id IS NULL THEN
    RETURN;  -- no venue configured for this event
  END IF;

  RETURN QUERY
  WITH

  -- Bed block counts per room for this event
  bed_block_counts AS (
    SELECT
      bb.room_id,
      COUNT(*) AS blocked_beds
    FROM public.bed_blocks bb
    WHERE bb.event_id = p_event_id
    GROUP BY bb.room_id
  ),

  -- Confirmed occupants per room for this event
  -- (room_status IN ('Selected', 'Locked In', 'Verified'))
  occupant_data AS (
    SELECT
      ea.room_id,
      ea.user_id,
      ea.is_room_lead,
      ea.room_status,
      CASE
        WHEN pu.roommate_finder_hidden = true THEN 'Anonymous'
        WHEN pu.preferred_scene_name IS NOT NULL AND pu.preferred_scene_name != ''
          THEN pu.preferred_scene_name
        ELSE split_part(pu.email, '@', 1)
      END AS display_name
    FROM public.event_attendees ea
    JOIN public.platform_users pu ON pu.id = ea.user_id
    WHERE ea.event_id = p_event_id
      AND ea.room_status IN ('Selected', 'Locked In', 'Verified')
      AND ea.room_id IS NOT NULL
  ),

  -- Room Lead display names per room
  room_leads AS (
    SELECT
      room_id,
      display_name AS lead_display_name
    FROM occupant_data
    WHERE is_room_lead = true
  ),

  -- Confirmed occupants aggregated per room (for the occupants JSONB array)
  confirmed_occupants AS (
    SELECT
      room_id,
      COUNT(*) AS confirmed_count,
      jsonb_agg(
        jsonb_build_object('display_name', display_name)
        ORDER BY is_room_lead DESC  -- Room Lead listed first
      ) AS occupant_list
    FROM occupant_data
    GROUP BY room_id
  )

  SELECT
    r.id                          AS room_id,
    r.number                      AS room_number,
    r.name                        AS room_name,
    r.lodging_type,
    r.bed_type,
    r.has_kitchen,
    r.location_zone,
    r.room_group,
    r.min_occupancy,
    r.bed_spot_count              AS max_occupancy,

    -- Effective max = bed_spot_count minus blocked beds
    (r.bed_spot_count - COALESCE(bbc.blocked_beds, 0))::INTEGER
                                  AS effective_max_occupancy,

    -- Open spots = effective max minus confirmed occupants
    GREATEST(
      0,
      (r.bed_spot_count - COALESCE(bbc.blocked_beds, 0) - COALESCE(co.confirmed_count, 0))::INTEGER
    )                             AS open_spot_count,

    r.room_daily_rates,

    -- Room Lead display name
    COALESCE(rl.lead_display_name, 'OPEN')
                                  AS room_lead_display_name,

    -- Occupants array: confirmed occupants first, then OPEN placeholders
    (
      COALESCE(co.occupant_list, '[]'::jsonb)
      ||
      (
        SELECT jsonb_agg(jsonb_build_object('display_name', 'OPEN'))
        FROM generate_series(
          1,
          GREATEST(
            0,
            (r.bed_spot_count - COALESCE(bbc.blocked_beds, 0) - COALESCE(co.confirmed_count, 0))::INTEGER
          )
        )
      )
    )                             AS occupants

  FROM public.rooms r
  LEFT JOIN public.event_room_config erc
    ON erc.room_id = r.id AND erc.event_id = p_event_id
  LEFT JOIN bed_block_counts bbc ON bbc.room_id = r.id
  LEFT JOIN confirmed_occupants co ON co.room_id = r.id
  LEFT JOIN room_leads rl ON rl.room_id = r.id

  WHERE r.venue_id = v_venue_id
    -- Exclude blocked rooms
    AND (erc.blocked IS NULL OR erc.blocked = false)
    -- Exclude reserved rooms
    AND (erc.reserved IS NULL OR erc.reserved = false)

  ORDER BY r.number NULLS LAST, r.name;

END;
$$;

-- ── 3. get_roommate_finder_cards_ep (EP variant) ──────────────────────────────
-- Returns all rooms including blocked and reserved.
-- Blocked rooms include: blocked=true, block_note.
-- Reserved rooms include: reservation_note, reservation_note_public.
-- Caller must be the EP who owns the event, or SA.

CREATE OR REPLACE FUNCTION public.get_roommate_finder_cards_ep(p_event_id UUID)
RETURNS TABLE (
  room_id UUID,
  room_number TEXT,
  room_name TEXT,
  lodging_type TEXT,
  bed_type TEXT,
  has_kitchen BOOLEAN,
  location_zone TEXT,
  room_group TEXT,
  min_occupancy INTEGER,
  max_occupancy INTEGER,
  effective_max_occupancy INTEGER,
  open_spot_count INTEGER,
  room_daily_rates JSONB,
  room_lead_display_name TEXT,
  occupants JSONB,
  blocked BOOLEAN,
  block_note TEXT,
  reserved BOOLEAN,
  reservation_note TEXT,
  reservation_note_public BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_venue_id UUID;
BEGIN
  -- Authorization: EP who owns the event or SA
  IF NOT EXISTS (
    SELECT 1 FROM public.platform_events
    WHERE id = p_event_id
      AND (
        owner_id = auth.uid()
        OR public.user_role() = 'system_admin'
      )
  ) THEN
    RETURN;
  END IF;

  SELECT venue_id INTO v_venue_id
  FROM public.platform_events
  WHERE id = p_event_id;

  IF v_venue_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH

  bed_block_counts AS (
    SELECT
      bb.room_id,
      COUNT(*) AS blocked_beds
    FROM public.bed_blocks bb
    WHERE bb.event_id = p_event_id
    GROUP BY bb.room_id
  ),

  occupant_data AS (
    SELECT
      ea.room_id,
      ea.user_id,
      ea.is_room_lead,
      ea.room_status,
      CASE
        WHEN pu.roommate_finder_hidden = true THEN 'Anonymous'
        WHEN pu.preferred_scene_name IS NOT NULL AND pu.preferred_scene_name != ''
          THEN pu.preferred_scene_name
        ELSE split_part(pu.email, '@', 1)
      END AS display_name
    FROM public.event_attendees ea
    JOIN public.platform_users pu ON pu.id = ea.user_id
    WHERE ea.event_id = p_event_id
      AND ea.room_status IN ('Selected', 'Locked In', 'Verified')
      AND ea.room_id IS NOT NULL
  ),

  room_leads AS (
    SELECT room_id, display_name AS lead_display_name
    FROM occupant_data
    WHERE is_room_lead = true
  ),

  confirmed_occupants AS (
    SELECT
      room_id,
      COUNT(*) AS confirmed_count,
      jsonb_agg(
        jsonb_build_object('display_name', display_name)
        ORDER BY is_room_lead DESC
      ) AS occupant_list
    FROM occupant_data
    GROUP BY room_id
  )

  SELECT
    r.id,
    r.number,
    r.name,
    r.lodging_type,
    r.bed_type,
    r.has_kitchen,
    r.location_zone,
    r.room_group,
    r.min_occupancy,
    r.bed_spot_count,
    (r.bed_spot_count - COALESCE(bbc.blocked_beds, 0))::INTEGER,
    GREATEST(
      0,
      (r.bed_spot_count - COALESCE(bbc.blocked_beds, 0) - COALESCE(co.confirmed_count, 0))::INTEGER
    ),
    r.room_daily_rates,
    COALESCE(rl.lead_display_name, 'OPEN'),
    (
      COALESCE(co.occupant_list, '[]'::jsonb)
      ||
      (
        SELECT jsonb_agg(jsonb_build_object('display_name', 'OPEN'))
        FROM generate_series(
          1,
          GREATEST(
            0,
            (r.bed_spot_count - COALESCE(bbc.blocked_beds, 0) - COALESCE(co.confirmed_count, 0))::INTEGER
          )
        )
      )
    ),
    COALESCE(erc.blocked, false),
    erc.block_note,
    COALESCE(erc.reserved, false),
    erc.reservation_note,
    COALESCE(erc.reservation_note_public, false)

  FROM public.rooms r
  LEFT JOIN public.event_room_config erc
    ON erc.room_id = r.id AND erc.event_id = p_event_id
  LEFT JOIN bed_block_counts bbc ON bbc.room_id = r.id
  LEFT JOIN confirmed_occupants co ON co.room_id = r.id
  LEFT JOIN room_leads rl ON rl.room_id = r.id

  WHERE r.venue_id = v_venue_id

  ORDER BY
    COALESCE(erc.blocked, false) DESC,   -- blocked rooms listed last in EP view
    r.number NULLS LAST,
    r.name;

END;
$$;

-- ── Grant execute on RPCs to authenticated users ──────────────────────────────

GRANT EXECUTE ON FUNCTION public.get_roommate_finder_cards(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_roommate_finder_cards_ep(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;
