-- TASK-015 / PRD-043 / SEC-08: the staff audit log is append-only and records a reason.

-- New staff actions that were previously unlogged (finding S-6 and settings/admin creation).
ALTER TYPE "AdminActivityAction" ADD VALUE 'user_data_cleaned';
ALTER TYPE "AdminActivityAction" ADD VALUE 'users_data_bulk_cleaned';
ALTER TYPE "AdminActivityAction" ADD VALUE 'site_settings_changed';
ALTER TYPE "AdminActivityAction" ADD VALUE 'admin_registered';

-- Why the action was taken (nullable: old rows and routine actions have none).
ALTER TABLE "admin_activity_logs" ADD COLUMN "reason" TEXT;

-- Reject UPDATE and DELETE. One exception: the actor_id foreign key is ON DELETE SET NULL,
-- which Postgres runs as an UPDATE of actor_id to NULL when an admin account is deleted.
-- That single change (actor_id non-null -> null, every other column identical) is allowed
-- so deleting a user keeps working; anything else is refused.
CREATE OR REPLACE FUNCTION admin_activity_logs_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.actor_id IS NOT NULL
     AND NEW.actor_id IS NULL
     AND NEW.id = OLD.id
     AND NEW.action = OLD.action
     AND NEW.target_type = OLD.target_type
     AND NEW.target_id IS NOT DISTINCT FROM OLD.target_id
     AND NEW.details IS NOT DISTINCT FROM OLD.details
     AND NEW.reason IS NOT DISTINCT FROM OLD.reason
     AND NEW.created_at = OLD.created_at THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'admin_activity_logs is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_activity_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON "admin_activity_logs"
  FOR EACH ROW EXECUTE FUNCTION admin_activity_logs_append_only();

-- TRUNCATE bypasses row triggers, so block it too.
CREATE OR REPLACE FUNCTION admin_activity_logs_no_truncate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'admin_activity_logs is append-only: TRUNCATE is not allowed'
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_activity_logs_no_truncate
  BEFORE TRUNCATE ON "admin_activity_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION admin_activity_logs_no_truncate();
