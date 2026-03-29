-- ============================================================
-- Restrict platform_notifications UPDATE to safe columns only
--
-- The RLS UPDATE policy allows users to modify their own rows,
-- but users should only be able to change is_read and dismissed_at.
-- This trigger blocks any attempt to alter content columns.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_notification_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id          <> OLD.user_id          OR
     NEW.notification_type <> OLD.notification_type OR
     NEW.title             <> OLD.title             OR
     NEW.body              <> OLD.body              OR
     NEW.action_url        IS DISTINCT FROM OLD.action_url  OR
     NEW.action_label      IS DISTINCT FROM OLD.action_label OR
     NEW.event_id          IS DISTINCT FROM OLD.event_id    OR
     NEW.created_at        <> OLD.created_at
  THEN
    RAISE EXCEPTION 'Only is_read and dismissed_at may be updated on platform_notifications';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER platform_notifications_restrict_update
  BEFORE UPDATE ON public.platform_notifications
  FOR EACH ROW EXECUTE FUNCTION public.check_notification_update();
