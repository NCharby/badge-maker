-- Add 'user' as an organization access level.
-- An org 'user' is a member with no special privileges — they are associated
-- to the org but cannot manage events or modules. This allows EP/OL to demote
-- Module Leads while maintaining their org membership.

ALTER TABLE organization_members
  DROP CONSTRAINT organization_members_access_level_check;

ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_access_level_check
  CHECK (access_level IN ('organization_lead', 'event_promoter', 'module_lead', 'user'));
