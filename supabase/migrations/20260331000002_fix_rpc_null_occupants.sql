-- ============================================================
-- Fix null occupants when open_spot_count = 0.
--
-- Root cause: generate_series(1, 0) produces zero rows, so
-- jsonb_agg() returns NULL. In PostgreSQL, any_jsonb || NULL
-- evaluates to NULL, making the entire occupants expression
-- null for fully-occupied rooms.
--
-- Fix: wrap the OPEN-slots subquery in COALESCE(..., '[]'::jsonb)
-- so that null || '[]' = the left-hand occupant list.
-- ============================================================

-- ── 1. get_roommate_finder_cards (user-facing) ────────────────────────────────

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
    RETURN;
  END IF;

  -- Resolve the venue for this event (may be NULL for Basic Event Rooms)
  SELECT venue_id INTO v_venue_id
  FROM public.platform_events
  WHERE id = p_event_id;

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
    SELECT
      od.room_id,
      od.display_name AS lead_display_name
    FROM occupant_data od
    WHERE od.is_room_lead = true
  ),

  confirmed_occupants AS (
    SELECT
      od.room_id,
      COUNT(*) AS confirmed_count,
      jsonb_agg(
        jsonb_build_object('display_name', od.display_name)
        ORDER BY od.is_room_lead DESC
      ) AS occupant_list
    FROM occupant_data od
    GROUP BY od.room_id
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

    (r.bed_spot_count - COALESCE(bbc.blocked_beds, 0))::INTEGER
                                  AS effective_max_occupancy,

    GREATEST(
      0,
      (r.bed_spot_count - COALESCE(bbc.blocked_beds, 0) - COALESCE(co.confirmed_count, 0))::INTEGER
    )                             AS open_spot_count,

    r.room_daily_rates,

    COALESCE(rl.lead_display_name, 'OPEN')
                                  AS room_lead_display_name,

    (
      COALESCE(co.occupant_list, '[]'::jsonb)
      ||
      COALESCE(
        (
          SELECT jsonb_agg(jsonb_build_object('display_name', 'OPEN'))
          FROM generate_series(
            1,
            GREATEST(
              0,
              (r.bed_spot_count - COALESCE(bbc.blocked_beds, 0) - COALESCE(co.confirmed_count, 0))::INTEGER
            )
          )
        ),
        '[]'::jsonb
      )
    )                             AS occupants

  FROM public.rooms r
  LEFT JOIN public.event_room_config erc
    ON erc.room_id = r.id AND erc.event_id = p_event_id
  LEFT JOIN bed_block_counts bbc ON bbc.room_id = r.id
  LEFT JOIN confirmed_occupants co ON co.room_id = r.id
  LEFT JOIN room_leads rl ON rl.room_id = r.id

  WHERE (r.venue_id = v_venue_id OR r.event_id = p_event_id)
    AND (erc.blocked IS NULL OR erc.blocked = false)
    AND (erc.reserved IS NULL OR erc.reserved = false)

  ORDER BY r.number NULLS LAST, r.name;

END;
$$;

-- ── 2. get_roommate_finder_cards_ep (EP variant) ──────────────────────────────

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

  -- Resolve venue (may be NULL for Basic Event Rooms)
  SELECT venue_id INTO v_venue_id
  FROM public.platform_events
  WHERE id = p_event_id;

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
    SELECT od.room_id, od.display_name AS lead_display_name
    FROM occupant_data od
    WHERE od.is_room_lead = true
  ),

  confirmed_occupants AS (
    SELECT
      od.room_id,
      COUNT(*) AS confirmed_count,
      jsonb_agg(
        jsonb_build_object('display_name', od.display_name)
        ORDER BY od.is_room_lead DESC
      ) AS occupant_list
    FROM occupant_data od
    GROUP BY od.room_id
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
      COALESCE(
        (
          SELECT jsonb_agg(jsonb_build_object('display_name', 'OPEN'))
          FROM generate_series(
            1,
            GREATEST(
              0,
              (r.bed_spot_count - COALESCE(bbc.blocked_beds, 0) - COALESCE(co.confirmed_count, 0))::INTEGER
            )
          )
        ),
        '[]'::jsonb
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

  WHERE (r.venue_id = v_venue_id OR r.event_id = p_event_id)

  ORDER BY
    COALESCE(erc.blocked, false) DESC,
    r.number NULLS LAST,
    r.name;

END;
$$;
