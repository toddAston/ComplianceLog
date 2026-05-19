import { db } from "./fieldlogDb";
import type {
  ApplicationRecord,
  ApplicationRecordEvent,
  ApplicationReview,
  Product,
  ProductSnapshot,
} from "../domain/types";
import { DEMO_APPLICATOR_USER_ID, DEMO_MANAGER_USER_ID } from "./seed";

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export async function createDraftApplicationRecord(
  record: Omit<
    ApplicationRecord,
    | "id"
    | "workflowStatus"
    | "syncStatus"
    | "system"
    | "managerInputs"
    | "complianceReviewRequired"
  >
) {
  const createdAt = now();

  const draft: ApplicationRecord = {
    ...record,
    id: id(),
    workflowStatus: "draft",
    syncStatus: "local_only",
    managerInputs: {
      reviewStatus: "not_reviewed",
    },
    system: {
      createdAt,
      createdOffline: true,
      lastUpdatedAt: createdAt,
      catalogVersion: record.contractorInputs.catalogVersion,
    },
    complianceReviewRequired:
      record.contractorInputs.rupStatus === "unknown",
  };

  const event: ApplicationRecordEvent = {
    id: id(),
    applicationRecordId: draft.id,
    type: "created",
    actorUserId: DEMO_APPLICATOR_USER_ID,
    actorDisplayName: "Demo Applicator",
    occurredAt: createdAt,
    message: "Application record draft created locally.",
  };

  await db.transaction(
    "rw",
    db.applicationRecords,
    db.recordEvents,
    async () => {
      await db.applicationRecords.add(draft);
      await db.recordEvents.add(event);
    }
  );

  return draft;
}

export async function submitApplicationRecord(recordId: string) {
  const record = await db.applicationRecords.get(recordId);

  if (!record) {
    throw new Error("Application record not found.");
  }

  if (record.workflowStatus !== "draft") {
    throw new Error("Only draft records can be submitted.");
  }

  if (!record.contractorInputs.attestationConfirmed) {
    throw new Error("Attestation must be confirmed before submission.");
  }

  const submittedAt = now();

  const productSnapshot: ProductSnapshot = {
    id: id(),
    applicationRecordId: record.id,
    sourceProductId: record.contractorInputs.productId,

    productName: record.contractorInputs.productName,
    epaRegistrationNumber: record.contractorInputs.epaRegistrationNumber,
    rupStatus: record.contractorInputs.rupStatus,
    catalogVersion:
      record.contractorInputs.catalogVersion ?? "UNKNOWN-CATALOG-VERSION",

    snapshotCreatedAt: submittedAt,
  };

  const updatedRecord: ApplicationRecord = {
    ...record,
    workflowStatus: "pending_review",
    syncStatus: "queued",
    productSnapshotId: productSnapshot.id,
    contractorInputs: {
      ...record.contractorInputs,
      submittedBy: "Demo Applicator",
      submittedAt,
    },
    system: {
      ...record.system,
      lastUpdatedAt: submittedAt,
      catalogVersion: productSnapshot.catalogVersion,
    },
    complianceReviewRequired:
      record.contractorInputs.rupStatus === "unknown",
  };

  const events: ApplicationRecordEvent[] = [
    {
      id: id(),
      applicationRecordId: record.id,
      type: "submitted",
      actorUserId: DEMO_APPLICATOR_USER_ID,
      actorDisplayName: "Demo Applicator",
      occurredAt: submittedAt,
      message: "Application record submitted by contractor.",
    },
    {
      id: id(),
      applicationRecordId: record.id,
      type: "product_snapshot_created",
      actorUserId: DEMO_APPLICATOR_USER_ID,
      actorDisplayName: "Demo Applicator",
      occurredAt: submittedAt,
      message: "Product reference snapshot copied into application record.",
      metadata: {
        productSnapshotId: productSnapshot.id,
        rupStatus: productSnapshot.rupStatus,
        catalogVersion: productSnapshot.catalogVersion,
      },
    },
  ];

  await db.transaction(
    "rw",
    db.applicationRecords,
    db.productSnapshots,
    db.recordEvents,
    async () => {
      await db.productSnapshots.add(productSnapshot);
      await db.applicationRecords.put(updatedRecord);
      await db.recordEvents.bulkAdd(events);
    }
  );

  return updatedRecord;
}

export async function acceptAndLockApplicationRecord(
  recordId: string,
  reviewNotes?: string
) {
  const record = await db.applicationRecords.get(recordId);

  if (!record) {
    throw new Error("Application record not found.");
  }

  if (record.workflowStatus !== "pending_review") {
    throw new Error("Only pending review records can be accepted and locked.");
  }

  if (!record.productSnapshotId) {
    throw new Error("Cannot lock a record without a product snapshot.");
  }

  const reviewedAt = now();
  const lockedAt = reviewedAt;

  const review: ApplicationReview = {
    id: id(),
    applicationRecordId: record.id,
    reviewStatus: "accepted",
    reviewedBy: "Demo Manager",
    reviewedAt,
    reviewNotes,
  };

  const lockedRecord: ApplicationRecord = {
    ...record,
    workflowStatus: "locked",
    managerInputs: {
      reviewStatus: "accepted",
      reviewedBy: "Demo Manager",
      reviewedAt,
      reviewNotes,
    },
    system: {
      ...record.system,
      lastUpdatedAt: lockedAt,
      lockedAt,
    },
  };

  const events: ApplicationRecordEvent[] = [
    {
      id: id(),
      applicationRecordId: record.id,
      type: "reviewed",
      actorUserId: DEMO_MANAGER_USER_ID,
      actorDisplayName: "Demo Manager",
      occurredAt: reviewedAt,
      message: "Manager reviewed application record.",
      metadata: {
        reviewStatus: "accepted",
      },
    },
    {
      id: id(),
      applicationRecordId: record.id,
      type: "locked",
      actorUserId: DEMO_MANAGER_USER_ID,
      actorDisplayName: "Demo Manager",
      occurredAt: lockedAt,
      message: "Application record locked as immutable evidence.",
    },
  ];

  await db.transaction(
    "rw",
    db.applicationRecords,
    db.reviews,
    db.recordEvents,
    async () => {
      await db.reviews.add(review);
      await db.applicationRecords.put(lockedRecord);
      await db.recordEvents.bulkAdd(events);
    }
  );

  return lockedRecord;
}

export function productToContractorProductFields(product: Product) {
  return {
    productId: product.id,
    productName: product.name,
    epaRegistrationNumber: product.epaRegistrationNumber,
    rupStatus: product.rupStatus,
    catalogVersion: product.catalogVersion,
  };
}
