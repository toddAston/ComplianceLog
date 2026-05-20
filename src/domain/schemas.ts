import { z } from "zod";

export const rupStatusSchema = z.enum(["yes", "no", "unknown"]);

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
