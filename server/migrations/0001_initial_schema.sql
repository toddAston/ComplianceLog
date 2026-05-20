-- FieldLog API — initial schema (Postgres 16+).
--
-- This file is the canonical, hand-audited schema. It is structurally equivalent
-- to `drizzle-kit generate` output for server/src/db/schema.ts, plus the triggers
-- and lifecycle enforcement Drizzle cannot express (handoff §5.3). Regenerate with
-- `npm run db:generate` to reconcile auto-named constraints; the triggers below
-- must be re-appended after any regeneration.
--
-- Enums are derived from the client Zod enums in src/domain/schemas.ts. gen_random_uuid()
-- is core in Postgres 13+, so no extension is required.

BEGIN;

-- ---------------------------------------------------------------------------
-- Enum types (values mirror src/domain/schemas.ts:3-45)
-- ---------------------------------------------------------------------------
CREATE TYPE workflow_status AS ENUM (
  'draft', 'submitted', 'pending_review', 'needs_correction',
  'accepted', 'locked', 'exported'
);
CREATE TYPE sync_status AS ENUM (
  'local_only', 'queued', 'syncing', 'synced', 'sync_failed'
);
CREATE TYPE rup_status AS ENUM ('yes', 'no', 'unknown');
CREATE TYPE review_status AS ENUM (
  'not_reviewed', 'accepted', 'needs_correction', 'rejected'
);
CREATE TYPE record_event_type AS ENUM (
  'created', 'updated', 'submitted', 'product_snapshot_created', 'reviewed',
  'correction_requested', 'correction_submitted', 'compliance_check_run',
  'accepted', 'locked', 'exported', 'sync_failed'
);
CREATE TYPE user_role AS ENUM ('applicator', 'manager');

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX organizations_name_uq ON organizations (name);

-- ---------------------------------------------------------------------------
-- users (server-only columns: email, password_hash)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  display_name     text NOT NULL,
  role             user_role NOT NULL,
  email            text NOT NULL,
  password_hash    text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));
CREATE INDEX users_org_role_idx ON users (organization_id, role);

-- ---------------------------------------------------------------------------
-- farms
-- ---------------------------------------------------------------------------
CREATE TABLE farms (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  name             text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX farms_org_idx ON farms (organization_id);
CREATE UNIQUE INDEX farms_org_name_uq ON farms (organization_id, lower(name));

-- ---------------------------------------------------------------------------
-- fields
-- ---------------------------------------------------------------------------
CREATE TABLE fields (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  farm_id               uuid NOT NULL REFERENCES farms (id) ON DELETE RESTRICT,
  name                  text NOT NULL,
  default_acres         numeric(12, 2),
  default_crop_or_site  text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fields_default_acres_nonneg
    CHECK (default_acres IS NULL OR default_acres >= 0)
);
CREATE INDEX fields_org_idx ON fields (organization_id);
CREATE INDEX fields_farm_idx ON fields (farm_id);
CREATE UNIQUE INDEX fields_farm_name_uq ON fields (farm_id, lower(name));

-- ---------------------------------------------------------------------------
-- applicators
-- ---------------------------------------------------------------------------
CREATE TABLE applicators (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  contractor_company_name  text NOT NULL,
  applicator_name          text NOT NULL,
  certification_number     text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX applicators_org_idx ON applicators (organization_id);
CREATE UNIQUE INDEX applicators_org_name_company_uq
  ON applicators (organization_id, lower(applicator_name), lower(contractor_company_name));

-- ---------------------------------------------------------------------------
-- products (catalog)
-- ---------------------------------------------------------------------------
CREATE TABLE products (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_version          text NOT NULL,
  name                     text NOT NULL,
  epa_registration_number  text NOT NULL,
  rup_status               rup_status NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_epa_reg_format
    CHECK (char_length(epa_registration_number) > 0
           AND epa_registration_number ~ '^[A-Za-z0-9-]+$')
);
CREATE INDEX products_catalog_version_idx ON products (catalog_version);
CREATE INDEX products_epa_reg_idx ON products (epa_registration_number);
CREATE INDEX products_rup_status_idx ON products (rup_status);

-- ---------------------------------------------------------------------------
-- application_records (flattened; jsonb only for weather_snapshot)
-- ---------------------------------------------------------------------------
CREATE TABLE application_records (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,

  workflow_status             workflow_status NOT NULL,
  sync_status                 sync_status NOT NULL,

  product_snapshot_id         uuid,
  compliance_review_required  boolean NOT NULL,

  created_by_user_id          uuid REFERENCES users (id) ON DELETE RESTRICT,
  etag                        uuid NOT NULL DEFAULT gen_random_uuid(),

  -- contractorInputs
  applicator_id               uuid,
  applicator_name             text NOT NULL,
  company                     text NOT NULL,
  certification_number        text,
  farm_id                     uuid,
  farm_name                   text NOT NULL,
  field_id                    uuid,
  field_name                  text NOT NULL,
  crop_or_site                text NOT NULL,
  acres_treated               numeric(12, 2),
  product_id                  uuid,
  product_name                text NOT NULL,
  epa_registration_number     text NOT NULL,
  rup_status                  rup_status NOT NULL,
  catalog_version             text,
  application_date            date NOT NULL,
  start_time                  time NOT NULL,
  end_time                    time,
  application_method          text NOT NULL,
  rate_applied                text NOT NULL,
  total_amount_applied        text NOT NULL,
  target_pest                 text,
  phi                         text,
  temperature                 text NOT NULL,
  wind_speed                  text NOT NULL,
  wind_direction              text NOT NULL,
  weather_notes               text,
  weather_snapshot            jsonb,
  attestation_confirmed       boolean NOT NULL,
  submitted_by                text,
  submitted_at                timestamptz,

  -- managerInputs
  review_status               review_status NOT NULL DEFAULT 'not_reviewed',
  reviewed_by                 text,
  reviewed_at                 timestamptz,
  review_notes                text,

  -- system
  system_created_at           timestamptz NOT NULL,
  created_offline             boolean NOT NULL,
  last_updated_at             timestamptz NOT NULL,
  locked_at                   timestamptz,
  system_catalog_version      text,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT app_records_acres_nonneg
    CHECK (acres_treated IS NULL OR acres_treated >= 0),
  CONSTRAINT app_records_epa_reg_format
    CHECK (char_length(epa_registration_number) > 0
           AND epa_registration_number ~ '^[A-Za-z0-9-]+$'),
  CONSTRAINT app_records_locked_has_lock_ts
    CHECK (workflow_status NOT IN ('locked', 'exported') OR locked_at IS NOT NULL)
);

-- FK to snapshot is added after product_snapshots exists (circular reference).
CREATE INDEX app_records_org_workflow_idx ON application_records (organization_id, workflow_status);
CREATE INDEX app_records_org_sync_idx ON application_records (organization_id, sync_status);
CREATE INDEX app_records_snapshot_idx ON application_records (product_snapshot_id);
CREATE INDEX app_records_system_created_idx ON application_records (system_created_at);
CREATE INDEX app_records_locked_idx ON application_records (locked_at);

-- ---------------------------------------------------------------------------
-- product_snapshots (frozen at submit, one per record)
-- ---------------------------------------------------------------------------
CREATE TABLE product_snapshots (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  application_record_id     uuid NOT NULL REFERENCES application_records (id) ON DELETE RESTRICT,
  source_product_id        uuid,
  product_name             text NOT NULL,
  epa_registration_number  text NOT NULL,
  rup_status               rup_status NOT NULL,
  catalog_version          text NOT NULL,
  snapshot_created_at      timestamptz NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_snapshots_org_idx ON product_snapshots (organization_id);
CREATE UNIQUE INDEX product_snapshots_record_uq ON product_snapshots (application_record_id);
CREATE INDEX product_snapshots_epa_reg_idx ON product_snapshots (epa_registration_number);

ALTER TABLE application_records
  ADD CONSTRAINT application_records_snapshot_fk
  FOREIGN KEY (product_snapshot_id) REFERENCES product_snapshots (id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
CREATE TABLE reviews (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  application_record_id  uuid NOT NULL REFERENCES application_records (id) ON DELETE RESTRICT,
  review_status         review_status NOT NULL,
  reviewed_by           text NOT NULL,
  reviewed_by_user_id   uuid REFERENCES users (id) ON DELETE RESTRICT,
  reviewed_at           timestamptz NOT NULL,
  review_notes          text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_org_idx ON reviews (organization_id);
CREATE INDEX reviews_record_idx ON reviews (application_record_id);
CREATE INDEX reviews_status_idx ON reviews (review_status);

-- ---------------------------------------------------------------------------
-- record_events (append-only audit log)
-- ---------------------------------------------------------------------------
CREATE TABLE record_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  application_record_id  uuid NOT NULL REFERENCES application_records (id) ON DELETE RESTRICT,
  type                  record_event_type NOT NULL,
  actor_user_id         uuid REFERENCES users (id) ON DELETE RESTRICT,
  actor_display_name    text,
  occurred_at           timestamptz NOT NULL,
  message               text,
  metadata              jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX record_events_record_idx ON record_events (application_record_id);
CREATE INDEX record_events_type_idx ON record_events (type);
CREATE INDEX record_events_occurred_idx ON record_events (occurred_at);
CREATE INDEX record_events_metadata_gin ON record_events USING gin (metadata);

-- ---------------------------------------------------------------------------
-- Trigger: record_events is append-only (handoff constraint #13)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reject_record_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'record_events is append-only; % is not permitted', TG_OP
    USING ERRCODE = 'check_violation';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER record_events_no_update_delete
  BEFORE UPDATE OR DELETE ON record_events
  FOR EACH ROW EXECUTE FUNCTION reject_record_event_mutation();

-- ---------------------------------------------------------------------------
-- Trigger: lifecycle state machine + immutability after lock
-- (handoff constraints #12, and the CHECK-able state machine)
--
-- Allowed workflow_status transitions. The client service shortcuts
-- draft -> pending_review and pending_review -> locked; both the doc-canonical
-- path and the client path are permitted (see Divergences in api_architecture.md).
-- Once locked, only locked -> exported may proceed, and ONLY workflow_status,
-- last_updated_at, updated_at and etag may change on that hop.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_application_record_lifecycle()
RETURNS trigger AS $$
DECLARE
  old_s text := OLD.workflow_status::text;
  new_s text := NEW.workflow_status::text;
  allowed text[] := ARRAY[
    'draft>submitted', 'draft>pending_review', 'draft>needs_correction',
    'submitted>pending_review',
    'pending_review>accepted', 'pending_review>needs_correction', 'pending_review>locked',
    'accepted>locked',
    'needs_correction>pending_review', 'needs_correction>draft',
    'locked>exported'
  ];
BEGIN
  -- Immutability gate first: locked/exported rows are frozen.
  IF old_s IN ('locked', 'exported') THEN
    IF NOT (old_s = 'locked' AND new_s = 'exported') THEN
      RAISE EXCEPTION
        'application_record % is % and immutable; only locked->exported is permitted',
        OLD.id, old_s USING ERRCODE = 'check_violation';
    END IF;
    -- On the export hop, only the allowlisted columns may differ.
    IF (to_jsonb(NEW) - 'workflow_status' - 'last_updated_at' - 'updated_at' - 'etag')
       IS DISTINCT FROM
       (to_jsonb(OLD) - 'workflow_status' - 'last_updated_at' - 'updated_at' - 'etag') THEN
      RAISE EXCEPTION
        'application_record % is locked; only workflow_status/last_updated_at may change on export',
        OLD.id USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- Non-frozen rows: validate the transition if the status actually changed.
  IF old_s IS DISTINCT FROM new_s THEN
    IF NOT ((old_s || '>' || new_s) = ANY (allowed)) THEN
      RAISE EXCEPTION 'illegal workflow transition % -> %', old_s, new_s
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER application_records_lifecycle
  BEFORE UPDATE ON application_records
  FOR EACH ROW EXECUTE FUNCTION enforce_application_record_lifecycle();

COMMIT;
