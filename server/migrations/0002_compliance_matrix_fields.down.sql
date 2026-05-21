-- Down migration for 0002_compliance_matrix_fields. Reverses the structure
-- cleanly on a fresh DB; NOT safe against populated production data. Run
-- manually with `psql -f` (drizzle-kit's migrate is forward-only).

BEGIN;

-- Drop columns first; the enum types are referenced by them.
ALTER TABLE IF EXISTS application_records
  DROP COLUMN IF EXISTS site_type,
  DROP COLUMN IF EXISTS requester_name,
  DROP COLUMN IF EXISTS requester_address,
  DROP COLUMN IF EXISTS site_address,
  DROP COLUMN IF EXISTS site_description,
  DROP COLUMN IF EXISTS area_treated_value,
  DROP COLUMN IF EXISTS area_unit,
  DROP COLUMN IF EXISTS mixture_rate,
  DROP COLUMN IF EXISTS total_mixture_amount,
  DROP COLUMN IF EXISTS application_rate_value,
  DROP COLUMN IF EXISTS rate_unit,
  DROP COLUMN IF EXISTS epa_registration_correlation_evidence_id,
  DROP COLUMN IF EXISTS less_than_label_concentration,
  DROP COLUMN IF EXISTS producer_request_text,
  DROP COLUMN IF EXISTS producer_request_signature,
  DROP COLUMN IF EXISTS producer_request_date,
  DROP COLUMN IF EXISTS applicator_category,
  DROP COLUMN IF EXISTS noncertified_applicator_name,
  DROP COLUMN IF EXISTS noncertified_applicator_license,
  DROP COLUMN IF EXISTS technician_name,
  DROP COLUMN IF EXISTS technician_license,
  DROP COLUMN IF EXISTS trainee_name,
  DROP COLUMN IF EXISTS indoor_spot_crack_crevice,
  DROP COLUMN IF EXISTS sln_number,
  DROP COLUMN IF EXISTS is_premixed,
  DROP COLUMN IF EXISTS premixed_amount_used,
  DROP COLUMN IF EXISTS premixed_actual_rate,
  DROP COLUMN IF EXISTS structural_termite_within_10ft,
  DROP COLUMN IF EXISTS weather_capture_source,
  DROP COLUMN IF EXISTS weather_capture_timestamp,
  DROP COLUMN IF EXISTS weather_capture_location,
  DROP COLUMN IF EXISTS gps_latitude,
  DROP COLUMN IF EXISTS gps_longitude,
  DROP COLUMN IF EXISTS product_label_ref,
  DROP COLUMN IF EXISTS label_version_or_date,
  DROP COLUMN IF EXISTS label_consistency_reviewed,
  DROP COLUMN IF EXISTS label_crop_site_reviewed,
  DROP COLUMN IF EXISTS label_target_pest_reviewed,
  DROP COLUMN IF EXISTS label_rate_reviewed,
  DROP COLUMN IF EXISTS label_timing_method_reviewed,
  DROP COLUMN IF EXISTS label_ppe_reviewed,
  DROP COLUMN IF EXISTS label_rei_phi_reviewed,
  DROP COLUMN IF EXISTS label_drift_buffer_reviewed,
  DROP COLUMN IF EXISTS tank_mix_products,
  DROP COLUMN IF EXISTS supervisor_identified,
  DROP COLUMN IF EXISTS work_order_acknowledged,
  DROP COLUMN IF EXISTS label_in_possession_acknowledged,
  DROP COLUMN IF EXISTS equipment_readiness_acknowledged;

DROP TYPE IF EXISTS applicator_category;
DROP TYPE IF EXISTS rate_unit;
DROP TYPE IF EXISTS area_unit;

COMMIT;
