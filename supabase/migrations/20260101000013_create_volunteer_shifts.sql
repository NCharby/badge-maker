-- ============================================================
-- Volunteer Shifts and User Volunteer Signups
-- volunteer_shifts: shift definitions per event.
-- user_volunteer_signups: one record per user per shift.
--
-- Soft lock during checkout: when a user selects a shift,
-- a lock (resource_type='shift') is held for 15 minutes.
-- On purchase completion, status transitions to 'confirmed'.
--
-- Constraints enforced in application layer:
--   - A user may not sign up for the same shift twice
--     (enforced by UNIQUE(user_id, shift_id))
--   - A user may not hold two overlapping shifts simultaneously
--     (enforced by app-layer overlap check before insert)
-- ============================================================

CREATE TABLE public.volunteer_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.platform_events(id) ON DELETE CASCADE,
  schedule_activity_id UUID REFERENCES public.schedule_activities(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  date_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  capacity INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_volunteer_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.platform_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.volunteer_shifts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending_checkout'
    CHECK (status IN ('pending_checkout', 'confirmed', 'no_show')),
  completed BOOLEAN NOT NULL DEFAULT false,   -- set by EP after event; record-keeping only
  area_lead_label BOOLEAN NOT NULL DEFAULT false,  -- display label; not a platform role

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, shift_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_volunteer_shifts_event_id ON public.volunteer_shifts(event_id);
CREATE INDEX idx_volunteer_shifts_date_time ON public.volunteer_shifts(event_id, date_time);
CREATE INDEX idx_volunteer_shifts_activity ON public.volunteer_shifts(schedule_activity_id)
  WHERE schedule_activity_id IS NOT NULL;

CREATE INDEX idx_user_volunteer_signups_event_id ON public.user_volunteer_signups(event_id);
CREATE INDEX idx_user_volunteer_signups_user_id ON public.user_volunteer_signups(user_id);
CREATE INDEX idx_user_volunteer_signups_shift_id ON public.user_volunteer_signups(shift_id);
CREATE INDEX idx_user_volunteer_signups_confirmed ON public.user_volunteer_signups(user_id, event_id, status)
  WHERE status = 'confirmed';

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Policies added in migration 20260101000015_rls_policies.sql.

ALTER TABLE public.volunteer_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_volunteer_signups ENABLE ROW LEVEL SECURITY;
