-- 0002 — Compliance matrix #1-72 fields on application_records.
--
-- Adds the optional contractor-input fields the client Zod has carried since
-- src/domain/schemas.ts:208-306. Every column is nullable: each field is
-- .optional() on the wire, and the compliance engine treats absence as either
-- fail or "unknown" depending on the rule (see
-- src/application/compliance/rules/*.ts).
--
-- Per handoff constraint #11, fixed-shape fields are flat columns; jsonb is
-- reserved for genuinely open-ended bags. tank_mix_products is a variable-length
-- structured bag (parallel to weather_snapshot) and is the only jsonb addition.

BEGIN;

-- ---------------------------------------------------------------------------
-- New enums (values mirror src/domain/schemas.ts:7-52). Source of truth is the
-- client Zod — drizzle-kit will regenerate from src/db/schema.ts if needed.
-- ---------------------------------------------------------------------------
CREATE TYPE area_unit AS ENUM (
  'acres','square_feet','linear_feet','cubic_feet','other'
);

CREATE TYPE rate_unit AS ENUM (
  'oz_per_acre','lb_per_acre','gal_per_acre','qt_per_acre','pt_per_acre',
  'fl_oz_per_1000_sqft','lb_per_1000_sqft','gal_per_1000_sqft','other'
);

CREATE TYPE applicator_category AS ENUM (
  'certified_commercial','certified_noncommercial','public_operator','private',
  'noncertified','noncertified_rup','technician','trainee','unknown'
);

-- ---------------------------------------------------------------------------
-- application_records — compliance matrix columns (all nullable).
-- ---------------------------------------------------------------------------
ALTER TABLE application_records
  ADD COLUMN site_type                                  text,
  ADD COLUMN requester_name                             text,
  ADD COLUMN requester_address                          text,
  ADD COLUMN site_address                               text,
  ADD COLUMN site_description                           text,
  ADD COLUMN area_treated_value                         text,
  ADD COLUMN area_unit                                  area_unit,
  ADD COLUMN mixture_rate                               text,
  ADD COLUMN total_mixture_amount                       text,
  ADD COLUMN application_rate_value                     text,
  ADD COLUMN rate_unit                                  rate_unit,
  ADD COLUMN epa_registration_correlation_evidence_id   text,
  ADD COLUMN less_than_label_concentration              boolean,
  ADD COLUMN producer_request_text                      text,
  ADD COLUMN producer_request_signature                 text,
  -- Opaque text, not date: client Zod is z.string().optional() with no format
  -- constraint. Tighten only when the rule tightens.
  ADD COLUMN producer_request_date                      text,
  ADD COLUMN applicator_category                        applicator_category,
  ADD COLUMN noncertified_applicator_name               text,
  ADD COLUMN noncertified_applicator_license            text,
  ADD COLUMN technician_name                            text,
  ADD COLUMN technician_license                         text,
  ADD COLUMN trainee_name                               text,
  ADD COLUMN indoor_spot_crack_crevice                  boolean,
  -- SLN: rule distinguishes NULL (absent) from '' (explicitly recorded as
  -- N/A). Mapping layer preserves this via nullableTextToDb/FromDb.
  ADD COLUMN sln_number                                 text,
  ADD COLUMN is_premixed                                boolean,
  ADD COLUMN premixed_amount_used                       text,
  ADD COLUMN premixed_actual_rate                       text,
  ADD COLUMN structural_termite_within_10ft             boolean,
  ADD COLUMN weather_capture_source                     text,
  ADD COLUMN weather_capture_timestamp                  text,
  ADD COLUMN weather_capture_location                   text,
  ADD COLUMN gps_latitude                               text,
  ADD COLUMN gps_longitude                              text,
  ADD COLUMN product_label_ref                          text,
  ADD COLUMN label_version_or_date                      text,
  ADD COLUMN label_consistency_reviewed                 boolean,
  ADD COLUMN label_crop_site_reviewed                   boolean,
  ADD COLUMN label_target_pest_reviewed                 boolean,
  ADD COLUMN label_rate_reviewed                        boolean,
  ADD COLUMN label_timing_method_reviewed               boolean,
  ADD COLUMN label_ppe_reviewed                         boolean,
  ADD COLUMN label_rei_phi_reviewed                     boolean,
  ADD COLUMN label_drift_buffer_reviewed                boolean,
  -- Variable-length structured bag — matches the weather_snapshot precedent.
  ADD COLUMN tank_mix_products                          jsonb,
  ADD COLUMN supervisor_identified                      boolean,
  ADD COLUMN work_order_acknowledged                    boolean,
  ADD COLUMN label_in_possession_acknowledged           boolean,
  ADD COLUMN equipment_readiness_acknowledged           boolean;

COMMIT;
