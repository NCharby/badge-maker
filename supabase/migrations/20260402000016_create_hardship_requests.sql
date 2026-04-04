-- Hardship cancellation requests: attendee-initiated, EP-approved manual refund flow.
-- One pending request per user per event enforced via partial unique index.

CREATE TABLE public.hardship_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES platform_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),
  reason TEXT NOT NULL,
  supporting_details TEXT,
  refund_percentage INTEGER,          -- set by EP on approval (0-100)
  reviewed_by UUID REFERENCES platform_users(id),
  reviewed_at TIMESTAMPTZ,
  ep_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hardship_requests_event ON hardship_requests(event_id);
CREATE INDEX idx_hardship_requests_user ON hardship_requests(user_id);

-- Only one pending request per user per event at a time
CREATE UNIQUE INDEX idx_hardship_one_pending
  ON hardship_requests(event_id, user_id)
  WHERE status = 'pending';

ALTER TABLE hardship_requests ENABLE ROW LEVEL SECURITY;

-- Users can read and create their own requests
CREATE POLICY "hardship_requests: users read own"
  ON hardship_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "hardship_requests: users insert own"
  ON hardship_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- System admin full access
CREATE POLICY "hardship_requests: sa full select"
  ON hardship_requests FOR SELECT
  USING (public.user_role() = 'system_admin');

CREATE POLICY "hardship_requests: sa full insert"
  ON hardship_requests FOR INSERT
  WITH CHECK (public.user_role() = 'system_admin');

CREATE POLICY "hardship_requests: sa full update"
  ON hardship_requests FOR UPDATE
  USING (public.user_role() = 'system_admin')
  WITH CHECK (public.user_role() = 'system_admin');

CREATE POLICY "hardship_requests: sa full delete"
  ON hardship_requests FOR DELETE
  USING (public.user_role() = 'system_admin');

-- EP/OL update via admin client (service role bypasses RLS)
