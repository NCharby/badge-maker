-- Room locking system: user self-lock, Room Lead lock, lock requests

-- New columns on event_attendees
ALTER TABLE event_attendees ADD COLUMN user_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE event_attendees ADD COLUMN room_lead_locked BOOLEAN NOT NULL DEFAULT false;

-- Room lock requests table
CREATE TABLE room_lock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES platform_events(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES platform_users(id),
  target_user_id UUID NOT NULL REFERENCES platform_users(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(event_id, room_id, target_user_id, status)
);

-- RLS for room_lock_requests
ALTER TABLE room_lock_requests ENABLE ROW LEVEL SECURITY;

-- Users can read lock requests targeting them
CREATE POLICY "Users can read own lock requests"
  ON room_lock_requests FOR SELECT
  USING (auth.uid() = target_user_id OR auth.uid() = requested_by);

-- Users can update (accept/decline) requests targeting them
CREATE POLICY "Users can update own lock requests"
  ON room_lock_requests FOR UPDATE
  USING (auth.uid() = target_user_id);

-- Room Leads can insert lock requests (service role also used)
CREATE POLICY "Authenticated users can insert lock requests"
  ON room_lock_requests FOR INSERT
  WITH CHECK (auth.uid() = requested_by);

CREATE INDEX room_lock_requests_target_pending_idx
  ON room_lock_requests(target_user_id, event_id)
  WHERE status = 'pending';
