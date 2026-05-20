import Dexie, { type Table } from "dexie";
import type {
  ApplicationRecord,
  ApplicationRecordEvent,
  ApplicationReview,
  Applicator,
  CatalogMeta,
  Farm,
  FieldSite,
  Organization,
  OutboxOperation,
  Product,
  ProductSnapshot,
  User,
} from "../domain/types";

export class FieldLogDb extends Dexie {
  organizations!: Table<Organization, string>;
  users!: Table<User, string>;

  farms!: Table<Farm, string>;
  fields!: Table<FieldSite, string>;
  applicators!: Table<Applicator, string>;
  products!: Table<Product, string>;

  applicationRecords!: Table<ApplicationRecord, string>;
  productSnapshots!: Table<ProductSnapshot, string>;
  reviews!: Table<ApplicationReview, string>;
  recordEvents!: Table<ApplicationRecordEvent, string>;

  // v2 (sync layer)
  outbox!: Table<OutboxOperation, string>;
  catalogMeta!: Table<CatalogMeta, string>;

  constructor() {
    super("fieldlog-db");

    this.version(1).stores({
      organizations: "&id, name",
      users: "&id, organizationId, role",

      farms: "&id, organizationId, name",
      fields: "&id, organizationId, farmId, name",
      applicators: "&id, organizationId, applicatorName, contractorCompanyName",
      products: "&id, catalogVersion, name, epaRegistrationNumber, rupStatus",

      applicationRecords:
        "&id, organizationId, workflowStatus, syncStatus, productSnapshotId, system.createdAt, system.lockedAt",

      productSnapshots:
        "&id, applicationRecordId, sourceProductId, epaRegistrationNumber, rupStatus, catalogVersion",

      reviews: "&id, applicationRecordId, reviewStatus, reviewedAt",

      recordEvents: "&id, applicationRecordId, type, occurredAt",
    });

    // v2 is purely additive: two new stores. The new optional fields on
    // ApplicationRecord (etag/syncError/lastSyncedAt/serverShadow) need no schema
    // change because Dexie stores rows as opaque JSON. Existing tables are
    // inherited unchanged (Dexie merges schema across versions).
    this.version(2).stores({
      outbox: "&opId, recordId, status, kind, createdAt",
      catalogMeta: "&catalogVersion, loadedAt",
    });
  }
}

export const db = new FieldLogDb();
