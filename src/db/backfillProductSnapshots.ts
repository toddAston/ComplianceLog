import { db } from "./fieldlogDb";
import type { ProductSnapshot } from "../domain/types";

// One-time, idempotent boot heal. Locked records carry `productSnapshotId`
// pointing into the productSnapshots table. If the snapshot row was deleted
// (e.g. an earlier session wiped the table for testing or hit a partial
// clear), the export path throws "Product snapshot referenced by locked
// record is missing (corrupt state)" and the audit-packet download breaks.
//
// Heal: for each locked/exported record missing its referenced snapshot,
// synthesize one from the record's frozen `contractorInputs` (which already
// carry productName / epaRegistrationNumber / rupStatus / catalogVersion).
// This is exactly what was frozen at submit time, so reconstruction is
// lossless. Runs every boot from main.tsx. No-ops once data is clean.
export async function backfillProductSnapshots(): Promise<{
  scanned: number;
  healed: number;
}> {
  const records = await db.applicationRecords.toArray();
  const candidates = records.filter(
    (r) =>
      (r.workflowStatus === "locked" || r.workflowStatus === "exported") &&
      r.productSnapshotId
  );
  if (candidates.length === 0) return { scanned: records.length, healed: 0 };

  let healed = 0;
  for (const record of candidates) {
    const snapshotId = record.productSnapshotId;
    if (!snapshotId) continue;
    const existing = await db.productSnapshots.get(snapshotId);
    if (existing) continue;

    const ci = record.contractorInputs;
    const snapshot: ProductSnapshot = {
      id: snapshotId,
      applicationRecordId: record.id,
      sourceProductId: ci.productId,
      productName: ci.productName,
      epaRegistrationNumber: ci.epaRegistrationNumber,
      rupStatus: ci.rupStatus,
      catalogVersion:
        ci.catalogVersion ?? record.system.catalogVersion ?? "UNKNOWN-CATALOG-VERSION",
      snapshotCreatedAt:
        ci.submittedAt ?? record.system.lockedAt ?? record.system.lastUpdatedAt,
    };
    await db.productSnapshots.add(snapshot);
    healed += 1;
  }

  return { scanned: records.length, healed };
}
