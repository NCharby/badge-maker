-- ============================================================
-- Fix RLS gaps identified in QA pass
--
-- 1. bed_blocks: add missing UPDATE policy
-- 2. platform_users: add EP SELECT policy for event attendees
-- ============================================================

-- ── bed_blocks: UPDATE policy (was missing; SELECT/INSERT/DELETE existed) ───

CREATE POLICY "bed_blocks: ep or sa update" ON public.bed_blocks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE id = bed_blocks.event_id AND owner_id = auth.uid()
    )
    OR public.user_role() = 'system_admin'
  );

-- ── platform_users: EP SELECT for attendees of own events ────────────────────
-- Previously only "user reads own" existed. EPs need to read full attendee
-- profiles per CLAUDE.md §5 Permissions Matrix. Code currently works around
-- this via admin client; this policy adds database-level defense-in-depth.

CREATE POLICY "platform_users: ep reads own event attendees" ON public.platform_users
  FOR SELECT
  USING (
    public.user_role() = 'system_admin'
    OR auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.event_attendees ea
      JOIN public.platform_events pe ON pe.id = ea.event_id
      WHERE ea.user_id = platform_users.id AND pe.owner_id = auth.uid()
    )
  );
