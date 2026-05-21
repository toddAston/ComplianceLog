import { db } from "./fieldlogDb";

// One-time, idempotent boot heal. The submit service stamps
// `contractorInputs.submittedBy` and `submittedAt` locally. The chain-of-custody
// compliance rule (MISSING_SUBMITTER_IDENTITY / MISSING_SUBMISSION_TIMESTAMP)
// reads those fields. But the sync writeback path (`adoptServerRecord` in
// syncService) replaces the local record with the server response wholesale —
// so a flush after submit can wipe locally-stamped fields when the server
// payload omits them. Earlier session iterations had this bug; records created
// during that window are stuck with `submittedBy` undefined.
//
// The `submitted` event in `recordEvents` is append-only and carries the
// actor's displayName + occurredAt at the moment of submission. That's our
// source of truth: every record that has ever been submitted has at least
// one `submitted` event tagging WHO submitted it. So we walk records past
// `draft`, and for each one missing the contractorInputs stamps, we read the
// earliest `submitted` event and backfill from it.
//
// Runs every boot from main.tsx. No-ops when there's nothing to heal.
export async function backfillSubmitterIdentity(): Promise<{
  scanned: number;
  healed: number;
}> {
  const records = await db.applicationRecords.toArray();
  const candidates = records.filter(
    (r) =>
      r.workflowStatus !== "draft" &&
      (!r.contractorInputs.submittedBy?.trim() ||
        !r.contractorInputs.submittedAt?.trim())
  );

  if (candidates.length === 0) return { scanned: records.length, healed: 0 };

  let healed = 0;
  for (const record of candidates) {
    const events = await db.recordEvents
      .where("applicationRecordId")
      .equals(record.id)
      .toArray();
    const submitted = events
      .filter((e) => e.type === "submitted")
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0];
    if (!submitted?.actorDisplayName || !submitted?.occurredAt) continue;

    await db.applicationRecords.update(record.id, {
      contractorInputs: {
        ...record.contractorInputs,
        submittedBy:
          record.contractorInputs.submittedBy?.trim() ||
          submitted.actorDisplayName,
        submittedAt:
          record.contractorInputs.submittedAt?.trim() || submitted.occurredAt,
      },
    });
    healed += 1;
  }

  return { scanned: records.length, healed };
}
