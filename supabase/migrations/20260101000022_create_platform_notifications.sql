-- ============================================================
-- Platform Notifications
--
-- Persistent in-platform notification store. All notification
-- types write here regardless of whether email/Telegram is also
-- sent. Service role inserts; users read and update (dismiss/
-- mark-read) only their own rows.
-- ============================================================

CREATE TABLE public.platform_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,         -- quick link to the relevant workflow/object
  action_label TEXT,       -- CTA button text, e.g. "Review Application"
  event_id UUID REFERENCES public.platform_events(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  dismissed_at TIMESTAMPTZ,   -- null = visible in inbox; set = soft-deleted
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for the inbox query (user + recency)
CREATE INDEX platform_notifications_user_created_idx
  ON public.platform_notifications(user_id, created_at DESC);

-- Partial index for unread badge count — covers only rows that matter
CREATE INDEX platform_notifications_user_unread_idx
  ON public.platform_notifications(user_id)
  WHERE is_read = false AND dismissed_at IS NULL;

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.platform_notifications ENABLE ROW LEVEL SECURITY;

-- Users may read their own notifications
CREATE POLICY "platform_notifications: user select own"
  ON public.platform_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users may update their own notifications (is_read, dismissed_at)
CREATE POLICY "platform_notifications: user update own"
  ON public.platform_notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- INSERT is service-role only — the system creates notifications on behalf of users
-- DELETE is disallowed — use dismissed_at for soft removal
