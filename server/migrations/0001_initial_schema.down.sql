-- Down migration for 0001_initial_schema.
--
-- Reverses the structure cleanly on a FRESH database. It is NOT safe against
-- populated production data (it drops evidence tables). The deploy pipeline must
-- never run this `down` against prod without a manual override (handoff §5.3).
-- drizzle-kit's own migrate command is forward-only; this file documents the
-- inverse for local resets and review, run manually with `psql -f`.

BEGIN;

DROP TRIGGER IF EXISTS application_records_lifecycle ON application_records;
DROP TRIGGER IF EXISTS record_events_no_update_delete ON record_events;
DROP FUNCTION IF EXISTS enforce_application_record_lifecycle();
DROP FUNCTION IF EXISTS reject_record_event_mutation();

ALTER TABLE IF EXISTS application_records
  DROP CONSTRAINT IF EXISTS application_records_snapshot_fk;

DROP TABLE IF EXISTS record_events;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS product_snapshots;
DROP TABLE IF EXISTS application_records;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS applicators;
DROP TABLE IF EXISTS fields;
DROP TABLE IF EXISTS farms;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS organizations;

DROP TYPE IF EXISTS user_role;
DROP TYPE IF EXISTS record_event_type;
DROP TYPE IF EXISTS review_status;
DROP TYPE IF EXISTS rup_status;
DROP TYPE IF EXISTS sync_status;
DROP TYPE IF EXISTS workflow_status;

COMMIT;
