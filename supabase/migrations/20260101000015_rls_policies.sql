-- ============================================================
-- RLS Policies — All Platform Tables
--
-- Defines auth.user_role() SECURITY DEFINER helper first,
-- then adds policies to every platform table.
--
-- RLS Block reference (from CLAUDE.md §2):
--   A  — auth.uid() = user_id / owner column
--   B  — public.user_role() = 'system_admin'
--   C  — public.user_role() IN ('event_promoter', 'system_admin')
--   D  — EP owns the event: EXISTS (platform_events WHERE id=event_id AND owner_id=auth.uid())
--   E  — Caller is attendee: EXISTS (event_attendees WHERE event_id=X AND user_id=auth.uid())
--
-- SA operations use the Supabase service role key which bypasses
-- RLS entirely. Block B policies are defense-in-depth only.
-- ============================================================

-- ── user_role() helper ────────────────────────────────────────────────────────
-- SECURITY DEFINER runs as the function owner (postgres), bypassing RLS
-- on platform_users. This avoids infinite recursion when platform_users
-- policies would otherwise call back into platform_users.
-- Referenced in CLAUDE.md as auth.user_role(); defined here in public schema.

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.platform_users WHERE id = auth.uid()
$$;

-- ── venues ────────────────────────────────────────────────────────────────────
-- Any EP or SA can read all venues (shared resource pool).
-- Only the venue's owner EP or SA can modify.

CREATE POLICY "venues: ep and sa select all" ON public.venues
  FOR SELECT
  USING (public.user_role() IN ('event_promoter', 'system_admin'));

CREATE POLICY "venues: ep inserts own" ON public.venues
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "venues: owner ep or sa updates" ON public.venues
  FOR UPDATE
  USING (owner_id = auth.uid() OR public.user_role() = 'system_admin');

CREATE POLICY "venues: owner ep or sa deletes" ON public.venues
  FOR DELETE
  USING (owner_id = auth.uid() OR public.user_role() = 'system_admin');

-- ── rooms ─────────────────────────────────────────────────────────────────────
-- EPs and SAs can read rooms. Rooms are also read by get_roommate_finder_cards()
-- (SECURITY DEFINER) for user-facing queries.
-- Only the owning EP (via venue.owner_id) or SA can modify.

CREATE POLICY "rooms: ep and sa select" ON public.rooms
  FOR SELECT
  USING (public.user_role() IN ('event_promoter', 'system_admin'));

CREATE POLICY "rooms: ep inserts into own venues" ON public.rooms
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.venues
      WHERE id = rooms.venue_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "rooms: ep or sa updates own venue rooms" ON public.rooms
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.venues
      WHERE id = rooms.venue_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "rooms: ep or sa deletes own venue rooms" ON public.rooms
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.venues
      WHERE id = rooms.venue_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

-- ── platform_events ───────────────────────────────────────────────────────────
-- Users have NO direct access. Event data is served exclusively via
-- authenticated Server Actions / Route Handlers.

CREATE POLICY "platform_events: sa selects all" ON public.platform_events
  FOR SELECT
  USING (public.user_role() = 'system_admin');

CREATE POLICY "platform_events: ep selects own" ON public.platform_events
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "platform_events: ep inserts own" ON public.platform_events
  FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    AND public.user_role() IN ('event_promoter', 'system_admin')
  );

CREATE POLICY "platform_events: ep or sa updates own" ON public.platform_events
  FOR UPDATE
  USING (owner_id = auth.uid() OR public.user_role() = 'system_admin');

CREATE POLICY "platform_events: ep or sa deletes own" ON public.platform_events
  FOR DELETE
  USING (owner_id = auth.uid() OR public.user_role() = 'system_admin');

-- ── event_attendees ───────────────────────────────────────────────────────────

CREATE POLICY "event_attendees: user selects own" ON public.event_attendees
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "event_attendees: ep selects for own events" ON public.event_attendees
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = event_attendees.event_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "event_attendees: sa selects all" ON public.event_attendees
  FOR SELECT
  USING (public.user_role() = 'system_admin');

CREATE POLICY "event_attendees: user inserts own" ON public.event_attendees
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "event_attendees: user updates own" ON public.event_attendees
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "event_attendees: ep updates for own events" ON public.event_attendees
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = event_attendees.event_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "event_attendees: sa updates all" ON public.event_attendees
  FOR UPDATE
  USING (public.user_role() = 'system_admin');

CREATE POLICY "event_attendees: user or sa deletes" ON public.event_attendees
  FOR DELETE
  USING (user_id = auth.uid() OR public.user_role() = 'system_admin');

-- ── ticket_groups ─────────────────────────────────────────────────────────────

CREATE POLICY "ticket_groups: attendees select" ON public.ticket_groups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_attendees
      WHERE event_id = ticket_groups.event_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = ticket_groups.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "ticket_groups: ep or sa inserts" ON public.ticket_groups
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = ticket_groups.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "ticket_groups: ep or sa updates" ON public.ticket_groups
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = ticket_groups.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "ticket_groups: ep or sa deletes" ON public.ticket_groups
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = ticket_groups.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

-- ── ticket_types ──────────────────────────────────────────────────────────────

CREATE POLICY "ticket_types: attendees select" ON public.ticket_types
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_attendees
      WHERE event_id = ticket_types.event_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = ticket_types.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "ticket_types: ep or sa inserts" ON public.ticket_types
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = ticket_types.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "ticket_types: ep or sa updates" ON public.ticket_types
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = ticket_types.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "ticket_types: ep or sa deletes" ON public.ticket_types
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = ticket_types.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

-- ── orders ────────────────────────────────────────────────────────────────────

CREATE POLICY "orders: user selects own" ON public.orders
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "orders: ep selects for own events" ON public.orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = orders.event_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "orders: sa selects all" ON public.orders
  FOR SELECT
  USING (public.user_role() = 'system_admin');

CREATE POLICY "orders: user inserts own" ON public.orders
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Refunds and status updates are EP/SA actions via Server Actions
CREATE POLICY "orders: ep or sa updates" ON public.orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = orders.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

-- Order records are never deleted; status transitions handle cancellation
CREATE POLICY "orders: sa deletes" ON public.orders
  FOR DELETE
  USING (public.user_role() = 'system_admin');

-- ── order_items ───────────────────────────────────────────────────────────────

CREATE POLICY "order_items: user selects own via order" ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_items.order_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "order_items: ep selects for own events" ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.platform_events pe ON pe.id = o.event_id
      WHERE o.id = order_items.order_id AND pe.owner_id = auth.uid()
    )
  );

CREATE POLICY "order_items: sa selects all" ON public.order_items
  FOR SELECT
  USING (public.user_role() = 'system_admin');

CREATE POLICY "order_items: user inserts for own orders" ON public.order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_items.order_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "order_items: ep or sa updates" ON public.order_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.platform_events pe ON pe.id = o.event_id
      WHERE o.id = order_items.order_id AND pe.owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "order_items: sa deletes" ON public.order_items
  FOR DELETE
  USING (public.user_role() = 'system_admin');

-- ── merchandise ───────────────────────────────────────────────────────────────

CREATE POLICY "merchandise: attendees select enabled" ON public.merchandise
  FOR SELECT
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.event_attendees
        WHERE event_id = merchandise.event_id AND user_id = auth.uid()
      )
      AND merchandise.enabled = true
    )
    OR EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = merchandise.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "merchandise: ep or sa inserts" ON public.merchandise
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = merchandise.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "merchandise: ep or sa updates" ON public.merchandise
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = merchandise.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "merchandise: ep or sa deletes" ON public.merchandise
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = merchandise.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

-- ── event_room_config ─────────────────────────────────────────────────────────
-- Users access room data through get_roommate_finder_cards() (SECURITY DEFINER).
-- Direct table access is EP/SA only.

CREATE POLICY "event_room_config: ep or sa select" ON public.event_room_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = event_room_config.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "event_room_config: ep or sa insert" ON public.event_room_config
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = event_room_config.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "event_room_config: ep or sa update" ON public.event_room_config
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = event_room_config.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "event_room_config: ep or sa delete" ON public.event_room_config
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = event_room_config.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

-- ── bed_blocks ────────────────────────────────────────────────────────────────

CREATE POLICY "bed_blocks: ep or sa select" ON public.bed_blocks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = bed_blocks.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "bed_blocks: ep or sa insert" ON public.bed_blocks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = bed_blocks.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "bed_blocks: ep or sa delete" ON public.bed_blocks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = bed_blocks.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

-- ── locks ─────────────────────────────────────────────────────────────────────

CREATE POLICY "locks: user selects own" ON public.locks
  FOR SELECT
  USING (locked_by = auth.uid() OR public.user_role() = 'system_admin');

CREATE POLICY "locks: user inserts own" ON public.locks
  FOR INSERT
  WITH CHECK (locked_by = auth.uid());

-- Lock release on checkout complete/abandon
CREATE POLICY "locks: user or sa deletes" ON public.locks
  FOR DELETE
  USING (locked_by = auth.uid() OR public.user_role() = 'system_admin');

-- ── application_forms ─────────────────────────────────────────────────────────

CREATE POLICY "application_forms: attendees and ep select" ON public.application_forms
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_attendees
      WHERE event_id = application_forms.event_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = application_forms.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "application_forms: ep or sa inserts" ON public.application_forms
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = application_forms.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "application_forms: ep or sa updates" ON public.application_forms
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = application_forms.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "application_forms: ep or sa deletes" ON public.application_forms
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = application_forms.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

-- ── application_responses ─────────────────────────────────────────────────────

CREATE POLICY "application_responses: user selects own" ON public.application_responses
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "application_responses: ep selects for own events" ON public.application_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = application_responses.event_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "application_responses: sa selects all" ON public.application_responses
  FOR SELECT
  USING (public.user_role() = 'system_admin');

CREATE POLICY "application_responses: user inserts own" ON public.application_responses
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "application_responses: user updates own" ON public.application_responses
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "application_responses: ep or sa updates" ON public.application_responses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = application_responses.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "application_responses: user or sa deletes" ON public.application_responses
  FOR DELETE
  USING (user_id = auth.uid() OR public.user_role() = 'system_admin');

-- ── schedule_activities ───────────────────────────────────────────────────────

CREATE POLICY "schedule_activities: attendees and ep select" ON public.schedule_activities
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_attendees
      WHERE event_id = schedule_activities.event_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = schedule_activities.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "schedule_activities: ep or sa inserts" ON public.schedule_activities
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = schedule_activities.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "schedule_activities: ep or sa updates" ON public.schedule_activities
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = schedule_activities.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "schedule_activities: ep or sa deletes" ON public.schedule_activities
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = schedule_activities.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

-- ── volunteer_shifts ──────────────────────────────────────────────────────────

CREATE POLICY "volunteer_shifts: attendees and ep select" ON public.volunteer_shifts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_attendees
      WHERE event_id = volunteer_shifts.event_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = volunteer_shifts.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "volunteer_shifts: ep or sa inserts" ON public.volunteer_shifts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = volunteer_shifts.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "volunteer_shifts: ep or sa updates" ON public.volunteer_shifts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = volunteer_shifts.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "volunteer_shifts: ep or sa deletes" ON public.volunteer_shifts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = volunteer_shifts.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

-- ── user_volunteer_signups ────────────────────────────────────────────────────

CREATE POLICY "user_volunteer_signups: user selects own" ON public.user_volunteer_signups
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_volunteer_signups: ep selects for own events" ON public.user_volunteer_signups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = user_volunteer_signups.event_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "user_volunteer_signups: sa selects all" ON public.user_volunteer_signups
  FOR SELECT
  USING (public.user_role() = 'system_admin');

CREATE POLICY "user_volunteer_signups: user inserts own" ON public.user_volunteer_signups
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_volunteer_signups: user updates own" ON public.user_volunteer_signups
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "user_volunteer_signups: ep or sa updates" ON public.user_volunteer_signups
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = user_volunteer_signups.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "user_volunteer_signups: user or sa deletes" ON public.user_volunteer_signups
  FOR DELETE
  USING (user_id = auth.uid() OR public.user_role() = 'system_admin');

-- ── roommate_applications ─────────────────────────────────────────────────────

CREATE POLICY "roommate_applications: applicant selects own" ON public.roommate_applications
  FOR SELECT
  USING (applicant_user_id = auth.uid());

-- Room Lead can see applications to their room
CREATE POLICY "roommate_applications: room lead selects for own room" ON public.roommate_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_attendees ea
      WHERE ea.event_id = roommate_applications.event_id
        AND ea.user_id = auth.uid()
        AND ea.room_id = roommate_applications.room_id
        AND ea.is_room_lead = true
    )
  );

CREATE POLICY "roommate_applications: ep selects for own events" ON public.roommate_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = roommate_applications.event_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "roommate_applications: sa selects all" ON public.roommate_applications
  FOR SELECT
  USING (public.user_role() = 'system_admin');

-- Roommate-initiated applies: applicant_user_id must be the caller.
-- Room Lead-initiated claims go through Server Action using service role.
CREATE POLICY "roommate_applications: applicant inserts own" ON public.roommate_applications
  FOR INSERT
  WITH CHECK (
    applicant_user_id = auth.uid()
    AND initiated_by = 'roommate'
  );

-- Status updates (accept/decline/cancel/supersede) go through Server Actions.
CREATE POLICY "roommate_applications: applicant cancels own" ON public.roommate_applications
  FOR UPDATE
  USING (applicant_user_id = auth.uid());

CREATE POLICY "roommate_applications: ep or sa updates" ON public.roommate_applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = roommate_applications.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

CREATE POLICY "roommate_applications: sa deletes" ON public.roommate_applications
  FOR DELETE
  USING (public.user_role() = 'system_admin');
