-- Keep privileged-action records append-only at the database layer.
-- Deleting a user may apply the existing actorId ON DELETE SET NULL action;
-- that one referential update is allowed while every audit detail stays fixed.
CREATE FUNCTION prevent_admin_audit_event_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD."actorId" IS NOT NULL
    AND NEW."actorId" IS NULL
    AND (to_jsonb(OLD) - 'actorId') = (to_jsonb(NEW) - 'actorId') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'admin audit events are immutable'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER admin_audit_events_immutable_rows
BEFORE UPDATE OR DELETE ON "admin_audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_admin_audit_event_mutation();

CREATE TRIGGER admin_audit_events_immutable_truncate
BEFORE TRUNCATE ON "admin_audit_events"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_admin_audit_event_mutation();
