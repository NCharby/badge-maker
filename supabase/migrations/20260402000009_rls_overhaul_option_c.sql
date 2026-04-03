-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS OVERHAUL — Option C: Simple own-row RLS + admin client for cross-entity
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- ARCHITECTURAL RULE (documented in CLAUDE.md):
--   No RLS policy may contain a subquery that reads a different RLS-protected table.
--   Cross-table authorization is handled in application code using the admin client
--   (service role) via the checkEventAccess() helper.
--
-- RLS provides two levels only:
--   1. Users read/write their own rows (auth.uid() = user_id or id)
--   2. System admins read/write all rows (via user_role() SECURITY DEFINER)
--
-- Organization membership checks use SECURITY DEFINER functions only:
--   - user_role()         — returns platform role, bypasses RLS
--   - is_org_member()     — checks org membership, bypasses RLS
--   - org_access_level()  — returns org access level, bypasses RLS
--
-- All EP/ML cross-entity reads (reading other users' profiles, reading events
-- they manage via org membership, etc.) go through the admin client in Server
-- Actions / Route Handlers.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Helper: get current user's email (for invitation matching)
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.platform_users WHERE id = auth.uid()
$$;

-- ═══ PLATFORM_USERS ═══
-- Drop the cross-table policy that caused circular deps
DROP POLICY IF EXISTS "platform_users: ep reads own event attendees" ON platform_users;
-- Keep: "platform_users: user reads own" (auth.uid() = id) — from 000000
-- Keep: "platform_users: user inserts own" (auth.uid() = id) — from 000000
-- Keep: "platform_users: user updates own" (auth.uid() = id) — from 000000
-- Add: SA reads all
CREATE POLICY "platform_users: sa reads all" ON public.platform_users
  FOR SELECT USING (public.user_role() = 'system_admin');

-- ═══ PLATFORM_EVENTS ═══
-- Drop ALL existing SELECT/UPDATE/INSERT/DELETE policies and rebuild clean
DROP POLICY IF EXISTS "platform_events: sa selects all" ON platform_events;
DROP POLICY IF EXISTS "platform_events: ep selects own" ON platform_events;
DROP POLICY IF EXISTS "platform_events: ep inserts own" ON platform_events;
DROP POLICY IF EXISTS "platform_events: ep or sa updates own" ON platform_events;
DROP POLICY IF EXISTS "platform_events: ep or sa deletes own" ON platform_events;
DROP POLICY IF EXISTS "Org OL/EP can select org events" ON platform_events;
DROP POLICY IF EXISTS "Org OL/EP can update org events" ON platform_events;
DROP POLICY IF EXISTS "Org OL/EP can insert org events" ON platform_events;
DROP POLICY IF EXISTS "Module Lead can select assigned events" ON platform_events;

-- Owner reads own events
CREATE POLICY "platform_events: owner selects own" ON public.platform_events
  FOR SELECT USING (owner_id = auth.uid());
-- SA reads all
CREATE POLICY "platform_events: sa selects all" ON public.platform_events
  FOR SELECT USING (public.user_role() = 'system_admin');
-- Org OL/EP reads org events (SECURITY DEFINER function only)
CREATE POLICY "platform_events: org member selects" ON public.platform_events
  FOR SELECT USING (
    organization_id IS NOT NULL
    AND public.org_access_level(organization_id) IN ('organization_lead', 'event_promoter')
  );
-- Owner or SA updates
CREATE POLICY "platform_events: owner or sa updates" ON public.platform_events
  FOR UPDATE USING (owner_id = auth.uid() OR public.user_role() = 'system_admin');
-- Org OL/EP updates org events
CREATE POLICY "platform_events: org member updates" ON public.platform_events
  FOR UPDATE USING (
    organization_id IS NOT NULL
    AND public.org_access_level(organization_id) IN ('organization_lead', 'event_promoter')
  );
-- Org OL/EP inserts org events
CREATE POLICY "platform_events: org member inserts" ON public.platform_events
  FOR INSERT WITH CHECK (
    organization_id IS NOT NULL
    AND public.org_access_level(organization_id) IN ('organization_lead', 'event_promoter')
  );
-- Owner or SA deletes
CREATE POLICY "platform_events: owner or sa deletes" ON public.platform_events
  FOR DELETE USING (owner_id = auth.uid() OR public.user_role() = 'system_admin');

-- ═══ EVENT_ATTENDEES ═══
-- Drop cross-table policies
DROP POLICY IF EXISTS "event_attendees: ep selects for own events" ON event_attendees;
DROP POLICY IF EXISTS "event_attendees: sa selects all" ON event_attendees;
DROP POLICY IF EXISTS "event_attendees: ep updates for own events" ON event_attendees;
DROP POLICY IF EXISTS "event_attendees: sa updates all" ON event_attendees;
-- Keep: user selects own, user inserts own, user updates own, user or sa deletes

-- SA reads all
CREATE POLICY "event_attendees: sa selects all" ON public.event_attendees
  FOR SELECT USING (public.user_role() = 'system_admin');
-- SA updates all
CREATE POLICY "event_attendees: sa updates all" ON public.event_attendees
  FOR UPDATE USING (public.user_role() = 'system_admin');
-- EP reads via admin client in Server Actions — no cross-table RLS needed

-- ═══ VENUES ═══
DROP POLICY IF EXISTS "venues: ep and sa select all" ON venues;
DROP POLICY IF EXISTS "venues: owner ep or sa selects" ON venues;
DROP POLICY IF EXISTS "venues: ep inserts own" ON venues;
DROP POLICY IF EXISTS "venues: owner ep or sa updates" ON venues;
DROP POLICY IF EXISTS "venues: owner ep or sa deletes" ON venues;
DROP POLICY IF EXISTS "Org OL/EP can select org venues" ON venues;
DROP POLICY IF EXISTS "Org OL/EP can insert org venues" ON venues;
DROP POLICY IF EXISTS "Org OL/EP can update org venues" ON venues;

-- Owner reads own
CREATE POLICY "venues: owner selects own" ON public.venues
  FOR SELECT USING (owner_id = auth.uid());
-- SA reads all
CREATE POLICY "venues: sa selects all" ON public.venues
  FOR SELECT USING (public.user_role() = 'system_admin');
-- Org member reads org venues
CREATE POLICY "venues: org member selects" ON public.venues
  FOR SELECT USING (
    organization_id IS NOT NULL
    AND public.org_access_level(organization_id) IN ('organization_lead', 'event_promoter')
  );
-- Owner or SA or org member inserts
CREATE POLICY "venues: org member inserts" ON public.venues
  FOR INSERT WITH CHECK (
    organization_id IS NOT NULL
    AND public.org_access_level(organization_id) IN ('organization_lead', 'event_promoter')
  );
-- Owner or SA or org member updates
CREATE POLICY "venues: owner or org member updates" ON public.venues
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR public.user_role() = 'system_admin'
    OR (organization_id IS NOT NULL AND public.org_access_level(organization_id) IN ('organization_lead', 'event_promoter'))
  );
-- Owner or SA deletes
CREATE POLICY "venues: owner or sa deletes" ON public.venues
  FOR DELETE USING (owner_id = auth.uid() OR public.user_role() = 'system_admin');

-- ═══ ROOMS ═══
-- Drop cross-table policies that join venues/platform_events
DROP POLICY IF EXISTS "rooms: ep and sa select" ON rooms;
DROP POLICY IF EXISTS "rooms: ep inserts into own venues" ON rooms;
DROP POLICY IF EXISTS "rooms: ep inserts" ON rooms;
DROP POLICY IF EXISTS "rooms: ep or sa updates own venue rooms" ON rooms;
DROP POLICY IF EXISTS "rooms: ep or sa updates" ON rooms;
DROP POLICY IF EXISTS "rooms: ep or sa deletes own venue rooms" ON rooms;
DROP POLICY IF EXISTS "rooms: ep or sa deletes" ON rooms;

-- SA reads all rooms
CREATE POLICY "rooms: sa selects all" ON public.rooms
  FOR SELECT USING (public.user_role() = 'system_admin');
-- EP reads via admin client — too many cross-table joins for safe RLS
-- Users read rooms via RPC (get_roommate_finder_cards) which is SECURITY DEFINER
-- SA manages all
CREATE POLICY "rooms: sa inserts" ON public.rooms
  FOR INSERT WITH CHECK (public.user_role() = 'system_admin' OR public.user_role() = 'event_promoter');
CREATE POLICY "rooms: sa or ep updates" ON public.rooms
  FOR UPDATE USING (public.user_role() = 'system_admin' OR public.user_role() = 'event_promoter');
CREATE POLICY "rooms: sa or ep deletes" ON public.rooms
  FOR DELETE USING (public.user_role() = 'system_admin' OR public.user_role() = 'event_promoter');

-- ═══ EVENT_ROOM_CONFIG ═══
-- Drop cross-table policies
DROP POLICY IF EXISTS "event_room_config: ep or sa select" ON event_room_config;
DROP POLICY IF EXISTS "event_room_config: ep or sa insert" ON event_room_config;
DROP POLICY IF EXISTS "event_room_config: ep or sa update" ON event_room_config;
DROP POLICY IF EXISTS "event_room_config: ep or sa delete" ON event_room_config;

CREATE POLICY "event_room_config: ep or sa select" ON public.event_room_config
  FOR SELECT USING (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "event_room_config: ep or sa insert" ON public.event_room_config
  FOR INSERT WITH CHECK (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "event_room_config: ep or sa update" ON public.event_room_config
  FOR UPDATE USING (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "event_room_config: ep or sa delete" ON public.event_room_config
  FOR DELETE USING (public.user_role() IN ('event_promoter', 'system_admin'));

-- ═══ BED_BLOCKS ═══
DROP POLICY IF EXISTS "bed_blocks: ep or sa select" ON bed_blocks;
DROP POLICY IF EXISTS "bed_blocks: ep or sa insert" ON bed_blocks;
DROP POLICY IF EXISTS "bed_blocks: ep or sa delete" ON bed_blocks;
DROP POLICY IF EXISTS "bed_blocks: ep or sa update" ON bed_blocks;

CREATE POLICY "bed_blocks: ep or sa select" ON public.bed_blocks
  FOR SELECT USING (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "bed_blocks: ep or sa insert" ON public.bed_blocks
  FOR INSERT WITH CHECK (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "bed_blocks: ep or sa update" ON public.bed_blocks
  FOR UPDATE USING (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "bed_blocks: ep or sa delete" ON public.bed_blocks
  FOR DELETE USING (public.user_role() IN ('event_promoter', 'system_admin'));

-- ═══ TICKET_GROUPS ═══
-- Drop cross-table policies that join platform_events
DROP POLICY IF EXISTS "ticket_groups: attendees select" ON ticket_groups;
DROP POLICY IF EXISTS "ticket_groups: ep or sa inserts" ON ticket_groups;
DROP POLICY IF EXISTS "ticket_groups: ep or sa updates" ON ticket_groups;
DROP POLICY IF EXISTS "ticket_groups: ep or sa deletes" ON ticket_groups;

CREATE POLICY "ticket_groups: authenticated select" ON public.ticket_groups
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "ticket_groups: ep or sa inserts" ON public.ticket_groups
  FOR INSERT WITH CHECK (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "ticket_groups: ep or sa updates" ON public.ticket_groups
  FOR UPDATE USING (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "ticket_groups: ep or sa deletes" ON public.ticket_groups
  FOR DELETE USING (public.user_role() IN ('event_promoter', 'system_admin'));

-- ═══ TICKET_TYPES ═══
DROP POLICY IF EXISTS "ticket_types: attendees select" ON ticket_types;
DROP POLICY IF EXISTS "ticket_types: ep or sa inserts" ON ticket_types;
DROP POLICY IF EXISTS "ticket_types: ep or sa updates" ON ticket_types;
DROP POLICY IF EXISTS "ticket_types: ep or sa deletes" ON ticket_types;

CREATE POLICY "ticket_types: authenticated select" ON public.ticket_types
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "ticket_types: ep or sa inserts" ON public.ticket_types
  FOR INSERT WITH CHECK (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "ticket_types: ep or sa updates" ON public.ticket_types
  FOR UPDATE USING (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "ticket_types: ep or sa deletes" ON public.ticket_types
  FOR DELETE USING (public.user_role() IN ('event_promoter', 'system_admin'));

-- ═══ ORDERS ═══
DROP POLICY IF EXISTS "orders: ep selects for own events" ON orders;
DROP POLICY IF EXISTS "orders: sa selects all" ON orders;
DROP POLICY IF EXISTS "orders: ep or sa updates" ON orders;
DROP POLICY IF EXISTS "orders: sa deletes" ON orders;
-- Keep: user selects own, user inserts own

CREATE POLICY "orders: sa selects all" ON public.orders
  FOR SELECT USING (public.user_role() = 'system_admin');
CREATE POLICY "orders: ep or sa updates" ON public.orders
  FOR UPDATE USING (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "orders: sa deletes" ON public.orders
  FOR DELETE USING (public.user_role() = 'system_admin');

-- ═══ ORDER_ITEMS ═══
DROP POLICY IF EXISTS "order_items: ep selects for own events" ON order_items;
DROP POLICY IF EXISTS "order_items: sa selects all" ON order_items;
DROP POLICY IF EXISTS "order_items: ep or sa updates" ON order_items;
DROP POLICY IF EXISTS "order_items: sa deletes" ON order_items;
-- Keep: user selects own via order, user inserts for own orders

CREATE POLICY "order_items: sa selects all" ON public.order_items
  FOR SELECT USING (public.user_role() = 'system_admin');
CREATE POLICY "order_items: ep or sa updates" ON public.order_items
  FOR UPDATE USING (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "order_items: sa deletes" ON public.order_items
  FOR DELETE USING (public.user_role() = 'system_admin');

-- ═══ MERCHANDISE ═══
DROP POLICY IF EXISTS "merchandise: attendees select enabled" ON merchandise;
DROP POLICY IF EXISTS "merchandise: ep or sa inserts" ON merchandise;
DROP POLICY IF EXISTS "merchandise: ep or sa updates" ON merchandise;
DROP POLICY IF EXISTS "merchandise: ep or sa deletes" ON merchandise;

CREATE POLICY "merchandise: authenticated select" ON public.merchandise
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "merchandise: ep or sa inserts" ON public.merchandise
  FOR INSERT WITH CHECK (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "merchandise: ep or sa updates" ON public.merchandise
  FOR UPDATE USING (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "merchandise: ep or sa deletes" ON public.merchandise
  FOR DELETE USING (public.user_role() IN ('event_promoter', 'system_admin'));

-- ═══ APPLICATION_FORMS ═══
DROP POLICY IF EXISTS "application_forms: attendees and ep select" ON application_forms;
DROP POLICY IF EXISTS "application_forms: ep or sa inserts" ON application_forms;
DROP POLICY IF EXISTS "application_forms: ep or sa updates" ON application_forms;
DROP POLICY IF EXISTS "application_forms: ep or sa deletes" ON application_forms;

CREATE POLICY "application_forms: authenticated select" ON public.application_forms
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "application_forms: ep or sa inserts" ON public.application_forms
  FOR INSERT WITH CHECK (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "application_forms: ep or sa updates" ON public.application_forms
  FOR UPDATE USING (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "application_forms: ep or sa deletes" ON public.application_forms
  FOR DELETE USING (public.user_role() IN ('event_promoter', 'system_admin'));

-- ═══ APPLICATION_RESPONSES ═══
DROP POLICY IF EXISTS "application_responses: ep selects for own events" ON application_responses;
DROP POLICY IF EXISTS "application_responses: sa selects all" ON application_responses;
DROP POLICY IF EXISTS "application_responses: ep or sa updates" ON application_responses;
-- Keep: user selects own, user inserts own, user updates own, user or sa deletes

CREATE POLICY "application_responses: sa selects all" ON public.application_responses
  FOR SELECT USING (public.user_role() = 'system_admin');
CREATE POLICY "application_responses: ep or sa updates" ON public.application_responses
  FOR UPDATE USING (public.user_role() IN ('event_promoter', 'system_admin'));

-- ═══ SCHEDULE_ACTIVITIES ═══
DROP POLICY IF EXISTS "schedule_activities: attendees and ep select" ON schedule_activities;
DROP POLICY IF EXISTS "schedule_activities: ep or sa inserts" ON schedule_activities;
DROP POLICY IF EXISTS "schedule_activities: ep or sa updates" ON schedule_activities;
DROP POLICY IF EXISTS "schedule_activities: ep or sa deletes" ON schedule_activities;

CREATE POLICY "schedule_activities: authenticated select" ON public.schedule_activities
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "schedule_activities: ep or sa inserts" ON public.schedule_activities
  FOR INSERT WITH CHECK (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "schedule_activities: ep or sa updates" ON public.schedule_activities
  FOR UPDATE USING (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "schedule_activities: ep or sa deletes" ON public.schedule_activities
  FOR DELETE USING (public.user_role() IN ('event_promoter', 'system_admin'));

-- ═══ VOLUNTEER_SHIFTS ═══
DROP POLICY IF EXISTS "volunteer_shifts: attendees and ep select" ON volunteer_shifts;
DROP POLICY IF EXISTS "volunteer_shifts: ep or sa inserts" ON volunteer_shifts;
DROP POLICY IF EXISTS "volunteer_shifts: ep or sa updates" ON volunteer_shifts;
DROP POLICY IF EXISTS "volunteer_shifts: ep or sa deletes" ON volunteer_shifts;

CREATE POLICY "volunteer_shifts: authenticated select" ON public.volunteer_shifts
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "volunteer_shifts: ep or sa inserts" ON public.volunteer_shifts
  FOR INSERT WITH CHECK (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "volunteer_shifts: ep or sa updates" ON public.volunteer_shifts
  FOR UPDATE USING (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "volunteer_shifts: ep or sa deletes" ON public.volunteer_shifts
  FOR DELETE USING (public.user_role() IN ('event_promoter', 'system_admin'));

-- ═══ USER_VOLUNTEER_SIGNUPS ═══
DROP POLICY IF EXISTS "user_volunteer_signups: ep selects for own events" ON user_volunteer_signups;
DROP POLICY IF EXISTS "user_volunteer_signups: sa selects all" ON user_volunteer_signups;
DROP POLICY IF EXISTS "user_volunteer_signups: ep or sa updates" ON user_volunteer_signups;
-- Keep: user selects own, user inserts own, user updates own, user or sa deletes

CREATE POLICY "user_volunteer_signups: sa selects all" ON public.user_volunteer_signups
  FOR SELECT USING (public.user_role() = 'system_admin');
CREATE POLICY "user_volunteer_signups: ep or sa updates" ON public.user_volunteer_signups
  FOR UPDATE USING (public.user_role() IN ('event_promoter', 'system_admin'));

-- ═══ ROOMMATE_APPLICATIONS ═══
DROP POLICY IF EXISTS "roommate_applications: room lead selects for own room" ON roommate_applications;
DROP POLICY IF EXISTS "roommate_applications: ep selects for own events" ON roommate_applications;
DROP POLICY IF EXISTS "roommate_applications: sa selects all" ON roommate_applications;
DROP POLICY IF EXISTS "roommate_applications: ep or sa updates" ON roommate_applications;
DROP POLICY IF EXISTS "roommate_applications: sa deletes" ON roommate_applications;
-- Keep: applicant selects own, applicant inserts own, applicant cancels own

CREATE POLICY "roommate_applications: sa selects all" ON public.roommate_applications
  FOR SELECT USING (public.user_role() = 'system_admin');
-- Room leads read applications via admin client in Server Actions
CREATE POLICY "roommate_applications: ep or sa updates" ON public.roommate_applications
  FOR UPDATE USING (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "roommate_applications: sa deletes" ON public.roommate_applications
  FOR DELETE USING (public.user_role() = 'system_admin');

-- ═══ WAIVER_TEMPLATES ═══
DROP POLICY IF EXISTS "waiver_templates: attendees and ep select" ON waiver_templates;
DROP POLICY IF EXISTS "waiver_templates: ep or sa inserts" ON waiver_templates;
DROP POLICY IF EXISTS "waiver_templates: ep or sa updates" ON waiver_templates;
DROP POLICY IF EXISTS "waiver_templates: ep or sa deletes" ON waiver_templates;

CREATE POLICY "waiver_templates: authenticated select" ON public.waiver_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "waiver_templates: ep or sa inserts" ON public.waiver_templates
  FOR INSERT WITH CHECK (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "waiver_templates: ep or sa updates" ON public.waiver_templates
  FOR UPDATE USING (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "waiver_templates: ep or sa deletes" ON public.waiver_templates
  FOR DELETE USING (public.user_role() IN ('event_promoter', 'system_admin'));

-- ═══ BADGE_TEMPLATES ═══
DROP POLICY IF EXISTS "badge_templates: attendees and ep select" ON badge_templates;
DROP POLICY IF EXISTS "badge_templates: ep or sa inserts" ON badge_templates;
DROP POLICY IF EXISTS "badge_templates: ep or sa updates" ON badge_templates;
DROP POLICY IF EXISTS "badge_templates: ep or sa deletes" ON badge_templates;

CREATE POLICY "badge_templates: authenticated select" ON public.badge_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "badge_templates: ep or sa inserts" ON public.badge_templates
  FOR INSERT WITH CHECK (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "badge_templates: ep or sa updates" ON public.badge_templates
  FOR UPDATE USING (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "badge_templates: ep or sa deletes" ON public.badge_templates
  FOR DELETE USING (public.user_role() IN ('event_promoter', 'system_admin'));

-- ═══ ORGANIZATIONS ═══
-- Drop all existing and recreate clean
DROP POLICY IF EXISTS "Org members can read own org" ON organizations;
DROP POLICY IF EXISTS "System admins can read all orgs" ON organizations;
DROP POLICY IF EXISTS "OLs can update own org" ON organizations;
DROP POLICY IF EXISTS "System admins can insert orgs" ON organizations;
DROP POLICY IF EXISTS "System admins can update all orgs" ON organizations;
DROP POLICY IF EXISTS "Authenticated users can create orgs" ON organizations;

CREATE POLICY "organizations: member selects own" ON public.organizations
  FOR SELECT USING (public.is_org_member(id));
CREATE POLICY "organizations: sa selects all" ON public.organizations
  FOR SELECT USING (public.user_role() = 'system_admin');
CREATE POLICY "organizations: authenticated inserts" ON public.organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "organizations: ol updates own" ON public.organizations
  FOR UPDATE USING (public.org_access_level(id) = 'organization_lead');
CREATE POLICY "organizations: sa updates all" ON public.organizations
  FOR UPDATE USING (public.user_role() = 'system_admin');

-- ═══ ORGANIZATION_MEMBERS ═══
DROP POLICY IF EXISTS "Org members can read own org members" ON organization_members;
DROP POLICY IF EXISTS "System admins can read all org members" ON organization_members;
DROP POLICY IF EXISTS "OL/EP can insert org members" ON organization_members;
DROP POLICY IF EXISTS "OL can update org members" ON organization_members;
DROP POLICY IF EXISTS "OL can delete org members" ON organization_members;

CREATE POLICY "org_members: member reads own org" ON public.organization_members
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "org_members: sa reads all" ON public.organization_members
  FOR SELECT USING (public.user_role() = 'system_admin');
CREATE POLICY "org_members: ol or ep inserts" ON public.organization_members
  FOR INSERT WITH CHECK (
    public.org_access_level(organization_id) IN ('organization_lead', 'event_promoter')
    OR public.user_role() = 'system_admin'
  );
CREATE POLICY "org_members: ol updates" ON public.organization_members
  FOR UPDATE USING (
    public.org_access_level(organization_id) = 'organization_lead'
    OR public.user_role() = 'system_admin'
  );
CREATE POLICY "org_members: ol deletes" ON public.organization_members
  FOR DELETE USING (
    public.org_access_level(organization_id) = 'organization_lead'
    OR public.user_role() = 'system_admin'
  );

-- ═══ ORGANIZATION_MODULE_ACCESS ═══
DROP POLICY IF EXISTS "Org members can read module access" ON organization_module_access;
DROP POLICY IF EXISTS "OL/EP can insert module access" ON organization_module_access;
DROP POLICY IF EXISTS "OL/EP can delete module access" ON organization_module_access;

-- Use admin client for all module access management
CREATE POLICY "org_module_access: sa reads all" ON public.organization_module_access
  FOR SELECT USING (public.user_role() = 'system_admin');
CREATE POLICY "org_module_access: ep reads" ON public.organization_module_access
  FOR SELECT USING (public.user_role() = 'event_promoter');
CREATE POLICY "org_module_access: ep or sa inserts" ON public.organization_module_access
  FOR INSERT WITH CHECK (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "org_module_access: ep or sa deletes" ON public.organization_module_access
  FOR DELETE USING (public.user_role() IN ('event_promoter', 'system_admin'));

-- ═══ ORGANIZATION_INVITATIONS ═══
DROP POLICY IF EXISTS "OL/EP can read org invitations" ON organization_invitations;
DROP POLICY IF EXISTS "Invitees can read own invitations" ON organization_invitations;
DROP POLICY IF EXISTS "OL can insert invitations" ON organization_invitations;
DROP POLICY IF EXISTS "Invitees can update own invitations" ON organization_invitations;

-- Use SECURITY DEFINER for email matching (no inline platform_users read)
CREATE POLICY "org_invitations: ep or sa reads" ON public.organization_invitations
  FOR SELECT USING (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "org_invitations: invitee reads own" ON public.organization_invitations
  FOR SELECT USING (email = public.current_user_email() AND status = 'pending');
CREATE POLICY "org_invitations: ep or sa inserts" ON public.organization_invitations
  FOR INSERT WITH CHECK (public.user_role() IN ('event_promoter', 'system_admin'));
CREATE POLICY "org_invitations: invitee updates own" ON public.organization_invitations
  FOR UPDATE USING (email = public.current_user_email() AND status = 'pending');

-- ═══ PLATFORM_NOTIFICATIONS ═══
-- Already clean — user select/update own only. No changes needed.
-- Policies from 20260101000022 and 20260101000023 are safe.

-- ═══ ROOM_LOCK_REQUESTS ═══
-- Already clean — user reads/updates own. No changes needed.
-- Policies from 20260401000004 are safe.

-- ═══ LOCKS ═══
-- Already clean — user selects/inserts/deletes own. No changes needed.
