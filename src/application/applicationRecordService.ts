import { db } from "../db/fieldlogDb";
import type {
  ApplicationRecord,
  ApplicationRecordEvent,
  ApplicationReview,
  ContractorInputs,
  Product,
  ProductSnapshot,
} from "../domain/types";
import {
  runAllComplianceChecks,
  type ComplianceCheckOutcome,
} from "./complianceRules";

function summarizeOutcomes(outcomes: ComplianceCheckOutcome[]): string {
  const counts = { pass: 0, fail: 0, unknown: 0 };
  for (const o of outcomes) counts[o.status] += 1;
  return `${counts.pass} pass, ${counts.fail} fail, ${counts.unknown} unknown`;
}

export type ActorContext = {
  userId: string;
  displayName: string;
};

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
  >,
  actor: ActorContext
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
    actorUserId: actor.userId,
    actorDisplayName: actor.displayName,
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

export async function submitApplicationRecord(
  recordId: string,
  actor: ActorContext
) {
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

  const complianceOutcomes = runAllComplianceChecks(record);
  const complianceResults = complianceOutcomes.filter(
    (o) => o.status === "fail"
  );
  const blocked = complianceResults.filter((r) => r.severity === "blocked");
  if (blocked.length > 0) {
    throw new Error(blocked[0].message);
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
      submittedBy: actor.displayName,
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
      type: "compliance_check_run",
      actorUserId: actor.userId,
      actorDisplayName: actor.displayName,
      occurredAt: submittedAt,
      message: `Compliance checks at submit — ${summarizeOutcomes(complianceOutcomes)}.`,
      metadata: {
        phase: "submit",
        outcomes: complianceOutcomes,
        results: complianceResults,
      },
    },
    {
      id: id(),
      applicationRecordId: record.id,
      type: "submitted",
      actorUserId: actor.userId,
      actorDisplayName: actor.displayName,
      occurredAt: submittedAt,
      message: "Application record submitted by contractor.",
    },
    {
      id: id(),
      applicationRecordId: record.id,
      type: "product_snapshot_created",
      actorUserId: actor.userId,
      actorDisplayName: actor.displayName,
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
  actor: ActorContext,
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
    reviewedBy: actor.displayName,
    reviewedAt,
    reviewNotes,
  };

  const lockedRecord: ApplicationRecord = {
    ...record,
    workflowStatus: "locked",
    managerInputs: {
      reviewStatus: "accepted",
      reviewedBy: actor.displayName,
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
      actorUserId: actor.userId,
      actorDisplayName: actor.displayName,
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
      actorUserId: actor.userId,
      actorDisplayName: actor.displayName,
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

export async function requestCorrectionForApplicationRecord(
  recordId: string,
  actor: ActorContext,
  correctionNotes: string
) {
  const trimmedNotes = correctionNotes?.trim();
  if (!trimmedNotes) {
    throw new Error("Correction notes are required to request corrections.");
  }

  const record = await db.applicationRecords.get(recordId);

  if (!record) {
    throw new Error("Application record not found.");
  }

  if (record.workflowStatus !== "pending_review") {
    throw new Error(
      "Only pending review records can receive correction requests."
    );
  }

  const reviewedAt = now();

  const updatedRecord: ApplicationRecord = {
    ...record,
    workflowStatus: "needs_correction",
    managerInputs: {
      reviewStatus: "needs_correction",
      reviewedBy: actor.displayName,
      reviewedAt,
      reviewNotes: trimmedNotes,
    },
    system: {
      ...record.system,
      lastUpdatedAt: reviewedAt,
    },
  };

  const event: ApplicationRecordEvent = {
    id: id(),
    applicationRecordId: record.id,
    type: "correction_requested",
    actorUserId: actor.userId,
    actorDisplayName: actor.displayName,
    occurredAt: reviewedAt,
    message: "Manager requested corrections on application record.",
    metadata: {
      correctionNotes: trimmedNotes,
    },
  };

  await db.transaction(
    "rw",
    db.applicationRecords,
    db.recordEvents,
    async () => {
      await db.applicationRecords.put(updatedRecord);
      await db.recordEvents.add(event);
    }
  );

  return updatedRecord;
}

export async function resubmitCorrectedApplicationRecord(
  recordId: string,
  updatedFields: Partial<ContractorInputs>,
  actor: ActorContext
) {
  const record = await db.applicationRecords.get(recordId);

  if (!record) {
    throw new Error("Application record not found.");
  }

  if (record.workflowStatus !== "needs_correction") {
    throw new Error(
      "Only records needing correction can be resubmitted."
    );
  }

  const nonEmptyFields = Object.fromEntries(
    Object.entries(updatedFields).filter(
      ([, v]) => v !== undefined && v !== ""
    )
  );
  if (Object.keys(nonEmptyFields).length === 0) {
    throw new Error("At least one field must be updated for resubmission.");
  }

  const mergedInputs: ContractorInputs = {
    ...record.contractorInputs,
    ...nonEmptyFields,
  };

  const candidateRecord: ApplicationRecord = {
    ...record,
    contractorInputs: mergedInputs,
  };

  const complianceOutcomes = runAllComplianceChecks(candidateRecord);
  const complianceResults = complianceOutcomes.filter(
    (o) => o.status === "fail"
  );
  const blocked = complianceResults.filter((r) => r.severity === "blocked");
  if (blocked.length > 0) {
    throw new Error(blocked[0].message);
  }

  const resubmittedAt = now();

  const updatedRecord: ApplicationRecord = {
    ...record,
    workflowStatus: "pending_review",
    syncStatus: "queued",
    contractorInputs: mergedInputs,
    managerInputs: {
      reviewStatus: "not_reviewed",
    },
    system: {
      ...record.system,
      lastUpdatedAt: resubmittedAt,
    },
  };

  const events: ApplicationRecordEvent[] = [
    {
      id: id(),
      applicationRecordId: record.id,
      type: "correction_submitted",
      actorUserId: actor.userId,
      actorDisplayName: actor.displayName,
      occurredAt: resubmittedAt,
      message: "Contractor resubmitted corrected application record.",
      metadata: { updatedFields: nonEmptyFields },
    },
    {
      id: id(),
      applicationRecordId: record.id,
      type: "compliance_check_run",
      actorUserId: actor.userId,
      actorDisplayName: actor.displayName,
      occurredAt: resubmittedAt,
      message: `Compliance checks at resubmit — ${summarizeOutcomes(complianceOutcomes)}.`,
      metadata: {
        phase: "resubmit",
        outcomes: complianceOutcomes,
        results: complianceResults,
      },
    },
  ];

  await db.transaction(
    "rw",
    db.applicationRecords,
    db.recordEvents,
    async () => {
      await db.applicationRecords.put(updatedRecord);
      await db.recordEvents.bulkAdd(events);
    }
  );

  return updatedRecord;
}

/**
 * Dev/demo helper: walks every record whose syncStatus is "queued" through
 * syncing → synced, appending a single "synced" record event per record.
 *
 * This is not a real sync — it never talks to a server. It exists so the UI
 * can demonstrate the offline → synced transition without backend wiring.
 */
export async function simulateSyncAllQueued(
  actor: ActorContext
): Promise<{ syncedRecordIds: string[] }> {
  const queued = await db.applicationRecords
    .where("syncStatus")
    .equals("queued")
    .toArray();
  const syncedAt = now();
  const syncedRecordIds: string[] = [];

  await db.transaction(
    "rw",
    db.applicationRecords,
    db.recordEvents,
    async () => {
      for (const record of queued) {
        await db.applicationRecords.put({
          ...record,
          syncStatus: "synced",
          system: {
            ...record.system,
            lastUpdatedAt: syncedAt,
          },
        });
        await db.recordEvents.add({
          id: id(),
          applicationRecordId: record.id,
          // Reuse "updated" since the simulated sync is not a domain
          // transition with its own dedicated event type yet.
          type: "updated",
          actorUserId: actor.userId,
          actorDisplayName: actor.displayName,
          occurredAt: syncedAt,
          message: "Sync simulated: queued → synced.",
          metadata: { syncStatusBefore: "queued", syncStatusAfter: "synced" },
        });
        syncedRecordIds.push(record.id);
      }
    }
  );

  return { syncedRecordIds };
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
