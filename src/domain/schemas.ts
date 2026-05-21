import { z } from "zod";

export const rupStatusSchema = z.enum(["yes", "no", "unknown"]);

// Matrix #25: unit accompanying the size of area treated. Acres covers the
// existing v0.1 form; the rest are for indoor/structural and linear scenarios.
export const areaUnitSchema = z.enum([
  "acres",
  "square_feet",
  "linear_feet",
  "cubic_feet",
  "other",
]);

// Matrix #1: applicator category — drives duty checks (#2, #3) and conditional
// applicability for noncertified/technician/trainee name+license fields.
export const applicatorCategorySchema = z.enum([
  "certified_commercial",
  "certified_noncommercial",
  "public_operator",
  "private",
  "noncertified",
  "noncertified_rup",
  "technician",
  "trainee",
  "unknown",
]);

// Matrix #65-#67: a single product in a tank mix. All sub-fields are optional
// because mid-drafted entries are common; the rules detect incompleteness on
// each filled entry and emit MISSING_REQUIRED_FIELD when a required sub-field
// is absent.
export const tankMixProductSchema = z.object({
  productName: z.string().optional(),
  epaRegistrationNumber: z.string().optional(),
  applicationRate: z.string().optional(),
  totalAmount: z.string().optional(),
});

// Matrix #40: rate unit. "other" lets free-form units survive validation while
// still recording the structured choice when known.
export const rateUnitSchema = z.enum([
  "oz_per_acre",
  "lb_per_acre",
  "gal_per_acre",
  "qt_per_acre",
  "pt_per_acre",
  "fl_oz_per_1000_sqft",
  "lb_per_1000_sqft",
  "gal_per_1000_sqft",
  "other",
]);

export const workflowStatusSchema = z.enum([
  "draft",
  "submitted",
  "pending_review",
  "needs_correction",
  "accepted",
  "locked",
  "exported",
]);

export const syncStatusSchema = z.enum([
  "local_only",
  "queued",
  "syncing",
  "synced",
  "sync_failed",
]);

export const userRoleSchema = z.enum(["applicator", "manager"]);

export const reviewStatusSchema = z.enum([
  "not_reviewed",
  "accepted",
  "needs_correction",
  "rejected",
]);

export const recordEventTypeSchema = z.enum([
  "created",
  "updated",
  "submitted",
  "product_snapshot_created",
  "reviewed",
  "correction_requested",
  "correction_submitted",
  "compliance_check_run",
  "accepted",
  "locked",
  "exported",
  "sync_failed",
]);

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
});

export const userSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  displayName: z.string(),
  role: userRoleSchema,
  createdAt: z.string(),
});

export const farmSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  createdAt: z.string(),
});

export const fieldSiteSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  farmId: z.string(),
  name: z.string(),
  defaultAcres: z.number().optional(),
  defaultCropOrSite: z.string().optional(),
  createdAt: z.string(),
});

export const applicatorSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  contractorCompanyName: z.string(),
  applicatorName: z.string(),
  certificationNumber: z.string().optional(),
  createdAt: z.string(),
});

export const productSchema = z.object({
  id: z.string(),
  catalogVersion: z.string(),
  name: z.string(),
  epaRegistrationNumber: z.string(),
  rupStatus: rupStatusSchema,
  createdAt: z.string(),
  // Optional metadata sourced from the EPA RUP report; surfaced in the picker
  // and audit context. Stays optional so existing seeds/tests remain valid.
  activeIngredient: z.string().optional(),
  manufacturer: z.string().optional(),
});

export const productSnapshotSchema = z.object({
  id: z.string(),
  applicationRecordId: z.string(),
  sourceProductId: z.string().optional(),

  productName: z.string(),
  epaRegistrationNumber: z.string(),
  rupStatus: rupStatusSchema,
  catalogVersion: z.string(),

  snapshotCreatedAt: z.string(),
});

export const weatherSnapshotSchema = z.object({
  source: z.enum([
    "nws_observation",
    "nws_forecast_grid",
    "manual",
    "stale_cache",
  ]),
  stationId: z.string().optional(),
  observedAt: z.string().optional(),
  capturedAt: z.string(),
});

export const contractorInputsSchema = z.object({
  applicatorId: z.string(),
  applicatorName: z.string(),
  company: z.string(),
  certificationNumber: z.string().optional(),

  farmId: z.string(),
  farmName: z.string(),
  fieldId: z.string(),
  fieldName: z.string(),
  cropOrSite: z.string(),
  acresTreated: z.string(),

  productId: z.string().optional(),
  productName: z.string(),
  epaRegistrationNumber: z.string(),
  rupStatus: rupStatusSchema,
  catalogVersion: z.string().optional(),

  applicationDate: z.string(),
  startTime: z.string(),
  endTime: z.string().optional(),
  applicationMethod: z.string(),
  rateApplied: z.string(),
  totalAmountApplied: z.string(),
  targetPest: z.string().optional(),
  phi: z.string().optional(),

  temperature: z.string(),
  windSpeed: z.string(),
  windDirection: z.string(),
  weatherNotes: z.string().optional(),
  weatherSnapshot: weatherSnapshotSchema.optional(),

  attestationConfirmed: z.boolean(),
  submittedBy: z.string().optional(),
  submittedAt: z.string().optional(),

  // P0 compliance-matrix fields. All optional so existing records and offline
  // drafts remain schema-valid; the compliance engine emits
  // MISSING_REQUIRED_FIELD when these are absent and required by their rule.

  // Matrix #1: site classification gate (drives outdoor weather requirements).
  // Free string for now to match defensive reads in helpers.isOutdoorApplication.
  siteType: z.string().optional(),

  // Matrix #19/#20: person requesting the pesticide use.
  requesterName: z.string().optional(),
  requesterAddress: z.string().optional(),

  // Matrix #21/#22: application site address OR brief description (rule passes
  // if either is present).
  siteAddress: z.string().optional(),
  siteDescription: z.string().optional(),

  // Matrix #24/#25: structured area treated + unit. Existing `acresTreated`
  // (above) remains for back-compat; new records should populate the structured
  // pair when known.
  areaTreatedValue: z.string().optional(),
  areaUnit: areaUnitSchema.optional(),

  // Matrix #37-#40: structured rate / mixture fields. Existing `rateApplied` and
  // `totalAmountApplied` remain for back-compat.
  mixtureRate: z.string().optional(),
  totalMixtureAmount: z.string().optional(),
  applicationRateValue: z.string().optional(),
  rateUnit: rateUnitSchema.optional(),

  // Matrix #34: documented evidence linking a use to its EPA registration when
  // the EPA number itself is not recorded directly per use.
  epaRegistrationCorrelationEvidenceId: z.string().optional(),

  // Matrix #52-#55: agricultural-producer request to apply at less than the
  // labeled concentration. The flag drives applicability of the other three.
  lessThanLabelConcentration: z.boolean().optional(),
  producerRequestText: z.string().optional(),
  producerRequestSignature: z.string().optional(),
  producerRequestDate: z.string().optional(),

  // Matrix #1: applicator category.
  applicatorCategory: applicatorCategorySchema.optional(),

  // Matrix #10-#15: secondary actor information. Each is conditional on the
  // primary `applicatorCategory` or on participation flags below.
  noncertifiedApplicatorName: z.string().optional(),
  noncertifiedApplicatorLicense: z.string().optional(),
  technicianName: z.string().optional(),
  technicianLicense: z.string().optional(),
  traineeName: z.string().optional(),

  // Matrix #26: indoor spot or crack-and-crevice exemption — gates the
  // requirement for a structured area-size (#24).
  indoorSpotCrackCrevice: z.boolean().optional(),

  // Matrix #33: Special Local Need (SLN) registration number.
  slnNumber: z.string().optional(),

  // Matrix #41-#43: pre-mixed / ready-to-use product fields.
  isPremixed: z.boolean().optional(),
  premixedAmountUsed: z.string().optional(),
  premixedActualRate: z.string().optional(),

  // Matrix #45: structural / termite-within-10ft exception — gates the
  // outdoor weather requirements.
  structuralTermiteWithin10ft: z.boolean().optional(),

  // Matrix #49-#51 + #72: manual weather + GPS evidence quality.
  weatherCaptureSource: z.string().optional(),
  weatherCaptureTimestamp: z.string().optional(),
  weatherCaptureLocation: z.string().optional(),
  gpsLatitude: z.string().optional(),
  gpsLongitude: z.string().optional(),

  // Matrix #35-#36 + #56-#64: label reference + reviewer acknowledgments. Each
  // boolean is the human's "I have reviewed this label-driven question" mark;
  // when false/undefined the rule remains `unknown` per LABEL_VERIFICATION_REQUIRED
  // (matrix says never auto-pass).
  productLabelRef: z.string().optional(),
  labelVersionOrDate: z.string().optional(),
  labelConsistencyReviewed: z.boolean().optional(),
  labelCropSiteReviewed: z.boolean().optional(),
  labelTargetPestReviewed: z.boolean().optional(),
  labelRateReviewed: z.boolean().optional(),
  labelTimingMethodReviewed: z.boolean().optional(),
  labelPpeReviewed: z.boolean().optional(),
  labelReiPhiReviewed: z.boolean().optional(),
  labelDriftBufferReviewed: z.boolean().optional(),

  // Matrix #65-#67: tank mix products. When non-empty, per-entry rules apply.
  tankMixProducts: z.array(tankMixProductSchema).optional(),

  // Matrix #68-#71: noncertified-applicator supervision evidence.
  supervisorIdentified: z.boolean().optional(),
  workOrderAcknowledged: z.boolean().optional(),
  labelInPossessionAcknowledged: z.boolean().optional(),
  equipmentReadinessAcknowledged: z.boolean().optional(),
});

export const managerInputsSchema = z.object({
  reviewStatus: reviewStatusSchema,
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  reviewNotes: z.string().optional(),
});

export const systemCapturedFieldsSchema = z.object({
  createdAt: z.string(),
  createdOffline: z.boolean(),
  lastUpdatedAt: z.string(),
  lockedAt: z.string().optional(),
  catalogVersion: z.string().optional(),
});

export const applicationRecordSchema = z.object({
  id: z.string(),
  organizationId: z.string(),

  workflowStatus: workflowStatusSchema,
  syncStatus: syncStatusSchema,

  contractorInputs: contractorInputsSchema,
  managerInputs: managerInputsSchema,
  system: systemCapturedFieldsSchema,

  productSnapshotId: z.string().optional(),

  complianceReviewRequired: z.boolean(),

  // Sync metadata (added when the sync layer landed). All optional so records
  // created before sync, or never synced, remain valid.
  // - etag: server concurrency token; absent until first successful sync.
  // - syncError: last sync failure message surfaced in the UI.
  // - lastSyncedAt: ISO timestamp of the last confirmed server round-trip.
  // - serverShadow: the server's copy stashed on a conflict, for rebase.
  etag: z.string().optional(),
  syncError: z.string().optional(),
  lastSyncedAt: z.string().optional(),
  serverShadow: z.unknown().optional(),
});

export const syncOperationKindSchema = z.enum([
  "create_draft",
  "update_inputs",
  "submit",
  "resubmit",
]);

export const outboxStatusSchema = z.enum([
  "pending",
  "inflight",
  "failed",
  "done",
]);

// A queued, replay-safe mutation awaiting flush to the server (loopback or HTTP).
export const outboxOperationSchema = z.object({
  opId: z.string(),
  idempotencyKey: z.string(),
  recordId: z.string(),
  kind: syncOperationKindSchema,
  status: outboxStatusSchema,
  baseEtag: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  attempts: z.number(),
  lastError: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Local record of which catalog version is cached and when it loaded — drives the
// offline staleness indicator (Phase 2).
export const catalogMetaSchema = z.object({
  catalogVersion: z.string(),
  loadedAt: z.string(),
  source: z.string().optional(),
});

export const applicationReviewSchema = z.object({
  id: z.string(),
  applicationRecordId: z.string(),
  reviewStatus: reviewStatusSchema,
  reviewedBy: z.string(),
  reviewedAt: z.string(),
  reviewNotes: z.string().optional(),
});

export const applicationRecordEventSchema = z.object({
  id: z.string(),
  applicationRecordId: z.string(),
  type: recordEventTypeSchema,
  actorUserId: z.string().optional(),
  actorDisplayName: z.string().optional(),
  occurredAt: z.string(),
  message: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
