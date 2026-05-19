import { db } from "../db/fieldlogDb";
import type {
  ApplicationRecordEvent,
  ContractorInputs,
  ProductSnapshot,
  RecordEventType,
} from "../domain/types";

export type LockedApplicationRecordExportEvent = {
  id: string;
  type: RecordEventType;
  actorUserId?: string;
  actorDisplayName?: string;
  occurredAt: string;
  message?: string;
  metadata?: Record<string, unknown>;
};

export type LockedApplicationRecordExport = {
  exportSchemaVersion: "v1";

  recordId: string;
  organizationId: string;
  workflowStatus: "locked";

  contractorInputs: ContractorInputs;
  productSnapshot: ProductSnapshot;
  managerReview: {
    reviewedBy: string;
    reviewedAt: string;
    reviewNotes?: string;
  };

  system: {
    createdAt: string;
    createdOffline: boolean;
    lockedAt: string;
    catalogVersion?: string;
  };

  events: ReadonlyArray<LockedApplicationRecordExportEvent>;
};

const sortEvents = (events: ApplicationRecordEvent[]) =>
  [...events].sort((a, b) => {
    if (a.occurredAt !== b.occurredAt) {
      return a.occurredAt < b.occurredAt ? -1 : 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

const projectEvent = (
  event: ApplicationRecordEvent
): LockedApplicationRecordExportEvent => ({
  id: event.id,
  type: event.type,
  actorUserId: event.actorUserId,
  actorDisplayName: event.actorDisplayName,
  occurredAt: event.occurredAt,
  message: event.message,
  metadata: event.metadata,
});

export async function exportLockedApplicationRecord(
  recordId: string
): Promise<LockedApplicationRecordExport> {
  const record = await db.applicationRecords.get(recordId);

  if (!record) {
    throw new Error("Application record not found.");
  }

  if (record.workflowStatus !== "locked") {
    throw new Error("Only locked records can be exported.");
  }

  if (!record.productSnapshotId) {
    throw new Error(
      "Locked record is missing a product snapshot reference (corrupt state)."
    );
  }

  const productSnapshot = await db.productSnapshots.get(
    record.productSnapshotId
  );
  if (!productSnapshot) {
    throw new Error(
      "Product snapshot referenced by locked record is missing (corrupt state)."
    );
  }

  const { reviewedBy, reviewedAt, reviewNotes } = record.managerInputs;
  if (!reviewedBy || !reviewedAt) {
    throw new Error(
      "Locked record is missing manager review attribution (corrupt state)."
    );
  }

  if (!record.system.lockedAt) {
    throw new Error(
      "Locked record is missing system.lockedAt (corrupt state)."
    );
  }

  const events = await db.recordEvents
    .where("applicationRecordId")
    .equals(record.id)
    .toArray();

  return {
    exportSchemaVersion: "v1",

    recordId: record.id,
    organizationId: record.organizationId,
    workflowStatus: "locked",

    contractorInputs: record.contractorInputs,
    productSnapshot,
    managerReview: {
      reviewedBy,
      reviewedAt,
      reviewNotes,
    },

    system: {
      createdAt: record.system.createdAt,
      createdOffline: record.system.createdOffline,
      lockedAt: record.system.lockedAt,
      catalogVersion: record.system.catalogVersion,
    },

    events: sortEvents(events).map(projectEvent),
  };
}
