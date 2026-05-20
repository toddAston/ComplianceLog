import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Source of truth: the client Zod enums. PG enum values are derived from them so
// the two cannot drift (handoff constraint #11 / migration §5.3). If a Zod enum
// gains a member, regenerating the migration is the only way to add it to PG.
import {
  recordEventTypeSchema,
  reviewStatusSchema,
  rupStatusSchema,
  syncStatusSchema,
  userRoleSchema,
  workflowStatusSchema,
} from "../../../src/domain/schemas";
import type {
  RUPStatus,
  RecordEventType,
  ReviewStatus,
  SyncStatus,
  UserRole,
  WorkflowStatus,
} from "../../../src/domain/types";

// pgEnum needs a literal tuple to type the column. We cast the Zod `.options` to the
// inferred literal union (not a widened `string[]`) so enum columns keep precise
// types — `.default(...)` and `$inferInsert` rely on this.
export const workflowStatus = pgEnum(
  "workflow_status",
  workflowStatusSchema.options as [WorkflowStatus, ...WorkflowStatus[]]
);
export const syncStatus = pgEnum(
  "sync_status",
  syncStatusSchema.options as [SyncStatus, ...SyncStatus[]]
);
export const rupStatus = pgEnum(
  "rup_status",
  rupStatusSchema.options as [RUPStatus, ...RUPStatus[]]
);
export const reviewStatus = pgEnum(
  "review_status",
  reviewStatusSchema.options as [ReviewStatus, ...ReviewStatus[]]
);
export const recordEventType = pgEnum(
  "record_event_type",
  recordEventTypeSchema.options as [RecordEventType, ...RecordEventType[]]
);
export const userRole = pgEnum(
  "user_role",
  userRoleSchema.options as [UserRole, ...UserRole[]]
);

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    ...auditColumns,
  },
  (t) => [uniqueIndex("organizations_name_uq").on(t.name)]
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    displayName: text("display_name").notNull(),
    role: userRole("role").notNull(),
    // Server-only: never present on the client. argon2id hash, never plaintext.
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex("users_email_uq").on(sql`lower(${t.email})`),
    index("users_org_role_idx").on(t.organizationId, t.role),
  ]
);

export const farms = pgTable(
  "farms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    ...auditColumns,
  },
  (t) => [
    index("farms_org_idx").on(t.organizationId),
    uniqueIndex("farms_org_name_uq").on(t.organizationId, sql`lower(${t.name})`),
  ]
);

export const fields = pgTable(
  "fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    farmId: uuid("farm_id")
      .notNull()
      .references(() => farms.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    defaultAcres: numeric("default_acres", { precision: 12, scale: 2 }),
    defaultCropOrSite: text("default_crop_or_site"),
    ...auditColumns,
  },
  (t) => [
    index("fields_org_idx").on(t.organizationId),
    index("fields_farm_idx").on(t.farmId),
    uniqueIndex("fields_farm_name_uq").on(t.farmId, sql`lower(${t.name})`),
    check("fields_default_acres_nonneg", sql`${t.defaultAcres} is null or ${t.defaultAcres} >= 0`),
  ]
);

export const applicators = pgTable(
  "applicators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    contractorCompanyName: text("contractor_company_name").notNull(),
    applicatorName: text("applicator_name").notNull(),
    certificationNumber: text("certification_number"),
    ...auditColumns,
  },
  (t) => [
    index("applicators_org_idx").on(t.organizationId),
    uniqueIndex("applicators_org_name_company_uq").on(
      t.organizationId,
      sql`lower(${t.applicatorName})`,
      sql`lower(${t.contractorCompanyName})`
    ),
  ]
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    catalogVersion: text("catalog_version").notNull(),
    name: text("name").notNull(),
    epaRegistrationNumber: text("epa_registration_number").notNull(),
    rupStatus: rupStatus("rup_status").notNull(),
    ...auditColumns,
  },
  (t) => [
    index("products_catalog_version_idx").on(t.catalogVersion),
    index("products_epa_reg_idx").on(t.epaRegistrationNumber),
    index("products_rup_status_idx").on(t.rupStatus),
    check(
      "products_epa_reg_format",
      sql`char_length(${t.epaRegistrationNumber}) > 0 and ${t.epaRegistrationNumber} ~ '^[A-Za-z0-9-]+$'`
    ),
  ]
);

// One application record. Per handoff constraint #11 every fixed-shape field from
// contractorInputs / managerInputs / system is a real column; `jsonb` is reserved
// for genuinely open-ended bags (weather_snapshot). The whole record is NEVER one
// jsonb blob.
export const applicationRecords = pgTable(
  "application_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),

    workflowStatus: workflowStatus("workflow_status").notNull(),
    syncStatus: syncStatus("sync_status").notNull(),

    productSnapshotId: uuid("product_snapshot_id"),
    complianceReviewRequired: boolean("compliance_review_required").notNull(),

    // Server-added (documented in client_migration_notes.md): who created the row,
    // and an opaque concurrency token for the sync conflict check.
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    etag: uuid("etag").notNull().defaultRandom(),

    // --- contractorInputs (flattened) ---
    applicatorId: uuid("applicator_id"),
    applicatorName: text("applicator_name").notNull(),
    company: text("company").notNull(),
    certificationNumber: text("certification_number"),
    farmId: uuid("farm_id"),
    farmName: text("farm_name").notNull(),
    fieldId: uuid("field_id"),
    fieldName: text("field_name").notNull(),
    cropOrSite: text("crop_or_site").notNull(),
    // Wire shape is z.string(); flattened to numeric per constraint #11. NULL when
    // the client sent "" (draft). Mapping layer parses/validates at the boundary.
    acresTreated: numeric("acres_treated", { precision: 12, scale: 2 }),
    productId: uuid("product_id"),
    productName: text("product_name").notNull(),
    epaRegistrationNumber: text("epa_registration_number").notNull(),
    rupStatus: rupStatus("rup_status").notNull(),
    catalogVersion: text("catalog_version"),
    applicationDate: date("application_date").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time"),
    applicationMethod: text("application_method").notNull(),
    rateApplied: text("rate_applied").notNull(),
    totalAmountApplied: text("total_amount_applied").notNull(),
    targetPest: text("target_pest"),
    phi: text("phi"),
    // temperature / wind_* stay text: the client schema is string-typed and admits
    // non-numeric content ("calm", "5-10"). Coercion to numeric is deferred — see
    // Divergences in api_architecture.md.
    temperature: text("temperature").notNull(),
    windSpeed: text("wind_speed").notNull(),
    windDirection: text("wind_direction").notNull(),
    weatherNotes: text("weather_notes"),
    weatherSnapshot: jsonb("weather_snapshot"),
    attestationConfirmed: boolean("attestation_confirmed").notNull(),
    submittedBy: text("submitted_by"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),

    // --- managerInputs (flattened) ---
    reviewStatus: reviewStatus("review_status").notNull().default("not_reviewed"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),

    // --- system (flattened) ---
    systemCreatedAt: timestamp("system_created_at", { withTimezone: true }).notNull(),
    createdOffline: boolean("created_offline").notNull(),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    systemCatalogVersion: text("system_catalog_version"),

    ...auditColumns,
  },
  (t) => [
    // Review-queue and sync-flush hot paths (handoff §5.3).
    index("app_records_org_workflow_idx").on(t.organizationId, t.workflowStatus),
    index("app_records_org_sync_idx").on(t.organizationId, t.syncStatus),
    index("app_records_snapshot_idx").on(t.productSnapshotId),
    index("app_records_system_created_idx").on(t.systemCreatedAt),
    index("app_records_locked_idx").on(t.lockedAt),
    check(
      "app_records_acres_nonneg",
      sql`${t.acresTreated} is null or ${t.acresTreated} >= 0`
    ),
    check(
      "app_records_epa_reg_format",
      sql`char_length(${t.epaRegistrationNumber}) > 0 and ${t.epaRegistrationNumber} ~ '^[A-Za-z0-9-]+$'`
    ),
    // Once locked, the only forward transition is exported (handoff constraint #12).
    // A DB trigger (see migration) enforces column-level immutability; this CHECK
    // catches an illegal status value landing on a locked row.
    check(
      "app_records_locked_forward_only",
      sql`${t.workflowStatus} <> 'locked' or ${t.lockedAt} is not null`
    ),
  ]
);

export const productSnapshots = pgTable(
  "product_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    applicationRecordId: uuid("application_record_id")
      .notNull()
      .references(() => applicationRecords.id, { onDelete: "restrict" }),
    sourceProductId: uuid("source_product_id"),
    productName: text("product_name").notNull(),
    epaRegistrationNumber: text("epa_registration_number").notNull(),
    rupStatus: rupStatus("rup_status").notNull(),
    catalogVersion: text("catalog_version").notNull(),
    snapshotCreatedAt: timestamp("snapshot_created_at", { withTimezone: true }).notNull(),
    ...auditColumns,
  },
  (t) => [
    index("product_snapshots_org_idx").on(t.organizationId),
    uniqueIndex("product_snapshots_record_uq").on(t.applicationRecordId),
    index("product_snapshots_epa_reg_idx").on(t.epaRegistrationNumber),
  ]
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    applicationRecordId: uuid("application_record_id")
      .notNull()
      .references(() => applicationRecords.id, { onDelete: "restrict" }),
    reviewStatus: reviewStatus("review_status").notNull(),
    reviewedBy: text("reviewed_by").notNull(),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
    reviewNotes: text("review_notes"),
    ...auditColumns,
  },
  (t) => [
    index("reviews_org_idx").on(t.organizationId),
    index("reviews_record_idx").on(t.applicationRecordId),
    index("reviews_status_idx").on(t.reviewStatus),
  ]
);

// Append-only audit log. A DB trigger (see migration) raises on UPDATE/DELETE.
export const recordEvents = pgTable(
  "record_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    applicationRecordId: uuid("application_record_id")
      .notNull()
      .references(() => applicationRecords.id, { onDelete: "restrict" }),
    type: recordEventType("type").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    actorDisplayName: text("actor_display_name"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    message: text("message"),
    // Open-ended bag: compliance outcomes, sync deltas, correction notes. jsonb + GIN.
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("record_events_record_idx").on(t.applicationRecordId),
    index("record_events_type_idx").on(t.type),
    index("record_events_occurred_idx").on(t.occurredAt),
    index("record_events_metadata_gin").using("gin", t.metadata),
  ]
);
