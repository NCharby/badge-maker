-- Migration: Add Room Lead Roommate Codes feature
-- Adds opt-in roommate_codes_enabled flag to ticket_types and
-- roommate_code column to event_attendees with a partial unique index.

-- Opt-in flag per Room Lead ticket type.
-- When true, Room Lead purchasers of this ticket type receive a Roommate Code after checkout.
-- Always false when room_lead = false (enforced in application layer).
ALTER TABLE ticket_types
  ADD COLUMN roommate_codes_enabled BOOLEAN NOT NULL DEFAULT false;

-- Unique code assigned to Room Lead attendees after ticket purchase.
-- Null when the attendee's ticket type does not have roommate_codes_enabled = true.
ALTER TABLE event_attendees
  ADD COLUMN roommate_code TEXT;

-- Partial unique index: roommate_code values must be globally unique across all non-null entries.
CREATE UNIQUE INDEX event_attendees_roommate_code_key
  ON event_attendees(roommate_code)
  WHERE roommate_code IS NOT NULL;
