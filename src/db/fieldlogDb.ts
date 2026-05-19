import Dexie, { type Table } from "dexie";
import type {
  ApplicationRecord,
  ApplicationRecordEvent,
  ApplicationReview,
  Applicator,
  Farm,
  FieldSite,
  Organization,
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
  }
}

export const db = new FieldLogDb();
