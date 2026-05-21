import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { applicationRecords, productSnapshots, recordEvents } from "../db/schema";
import { contractorInputsSchema } from "../../../src/domain/schemas";
import type { ApplicationRecord } from "../../../src/domain/types";
import { runAllComplianceChecks } from "../../../src/application/complianceRules";

import { AppError } from "../lib/errors";
import { parseOrThrow } from "../lib/validate";
import { assertTransition } from "../lib/lifecycle";
import {
  acresFromDb,
  acresToDb,
  dateToDb,
  nullableTextFromDb,
  nullableTextToDb,
  optionalTimeToDb,
  timeFromDb,
  timeToDb,
} from "../lib/mapping";
import { getActor } from "../plugins/auth";

const createBodySchema = z.object({
  id: z.string().uuid(),
  contractorInputs: contractorInputsSchema,
  createdOffline: z.boolean().optional(),
});

type RecordRow = typeof applicationRecords.$inferSelect;

// The Idempotency-Key is validated for presence here; the replay store (handoff §5.5
// — persist result, replay on retry) is intentionally NOT implemented in the skeleton.
function requireIdempotencyKey(req: FastifyRequest): void {
  const key = req.headers["idempotency-key"];
  if (typeof key !== "string" || key.trim().length === 0) {
    throw new AppError("VALIDATION_FAILED", "Idempotency-Key header is required.");
  }
}

function assertOwnership(req: FastifyRequest, row: RecordRow): void {
  const actor = getActor(req);
  if (actor.role === "applicator" && row.createdByUserId !== actor.userId) {
    throw new AppError("FORBIDDEN", "You can only act on records you created.");
  }
}

export function registerRecordRoutes(app: FastifyInstance): void {
  const { db } = app.resources;

  // POST /v1/application-records — create a draft (client-supplied UUID).
  app.post("/v1/application-records", async (req, reply) => {
    requireIdempotencyKey(req);
    const actor = getActor(req);
    const body = parseOrThrow(createBodySchema, req.body);
    const ci = body.contractorInputs;
    const now = new Date();

    const insertRow: typeof applicationRecords.$inferInsert = {
      id: body.id,
      organizationId: actor.organizationId,
      workflowStatus: "draft",
      syncStatus: "local_only",
      complianceReviewRequired: ci.rupStatus === "unknown",
      createdByUserId: actor.userId,
      applicatorId: ci.applicatorId ?? null,
      applicatorName: ci.applicatorName,
      company: ci.company,
      certificationNumber: ci.certificationNumber ?? null,
      farmId: ci.farmId ?? null,
      farmName: ci.farmName,
      fieldId: ci.fieldId ?? null,
      fieldName: ci.fieldName,
      cropOrSite: ci.cropOrSite,
      acresTreated: acresToDb(ci.acresTreated),
      productId: ci.productId ?? null,
      productName: ci.productName,
      epaRegistrationNumber: ci.epaRegistrationNumber,
      rupStatus: ci.rupStatus,
      catalogVersion: ci.catalogVersion ?? null,
      applicationDate: dateToDb(ci.applicationDate),
      startTime: timeToDb(ci.startTime, "contractorInputs.startTime"),
      endTime: optionalTimeToDb(ci.endTime, "contractorInputs.endTime"),
      applicationMethod: ci.applicationMethod,
      rateApplied: ci.rateApplied,
      totalAmountApplied: ci.totalAmountApplied,
      targetPest: ci.targetPest ?? null,
      phi: ci.phi ?? null,
      temperature: ci.temperature,
      windSpeed: ci.windSpeed,
      windDirection: ci.windDirection,
      weatherNotes: ci.weatherNotes ?? null,
      weatherSnapshot: ci.weatherSnapshot ?? null,
      attestationConfirmed: ci.attestationConfirmed,
      // Compliance matrix #1-72 — text uses nullableTextToDb to preserve '' vs
      // NULL (load-bearing for SLN and any future empty-string-aware rule);
      // booleans/enums/jsonb pass through (?? null handles undefined correctly,
      // and false survives ?? null because only nullish short-circuits).
      siteType: nullableTextToDb(ci.siteType),
      requesterName: nullableTextToDb(ci.requesterName),
      requesterAddress: nullableTextToDb(ci.requesterAddress),
      siteAddress: nullableTextToDb(ci.siteAddress),
      siteDescription: nullableTextToDb(ci.siteDescription),
      areaTreatedValue: nullableTextToDb(ci.areaTreatedValue),
      areaUnit: ci.areaUnit ?? null,
      mixtureRate: nullableTextToDb(ci.mixtureRate),
      totalMixtureAmount: nullableTextToDb(ci.totalMixtureAmount),
      applicationRateValue: nullableTextToDb(ci.applicationRateValue),
      rateUnit: ci.rateUnit ?? null,
      epaRegistrationCorrelationEvidenceId: nullableTextToDb(
        ci.epaRegistrationCorrelationEvidenceId
      ),
      lessThanLabelConcentration: ci.lessThanLabelConcentration ?? null,
      producerRequestText: nullableTextToDb(ci.producerRequestText),
      producerRequestSignature: nullableTextToDb(ci.producerRequestSignature),
      producerRequestDate: nullableTextToDb(ci.producerRequestDate),
      applicatorCategory: ci.applicatorCategory ?? null,
      noncertifiedApplicatorName: nullableTextToDb(ci.noncertifiedApplicatorName),
      noncertifiedApplicatorLicense: nullableTextToDb(
        ci.noncertifiedApplicatorLicense
      ),
      technicianName: nullableTextToDb(ci.technicianName),
      technicianLicense: nullableTextToDb(ci.technicianLicense),
      traineeName: nullableTextToDb(ci.traineeName),
      indoorSpotCrackCrevice: ci.indoorSpotCrackCrevice ?? null,
      slnNumber: nullableTextToDb(ci.slnNumber),
      isPremixed: ci.isPremixed ?? null,
      premixedAmountUsed: nullableTextToDb(ci.premixedAmountUsed),
      premixedActualRate: nullableTextToDb(ci.premixedActualRate),
      structuralTermiteWithin10ft: ci.structuralTermiteWithin10ft ?? null,
      weatherCaptureSource: nullableTextToDb(ci.weatherCaptureSource),
      weatherCaptureTimestamp: nullableTextToDb(ci.weatherCaptureTimestamp),
      weatherCaptureLocation: nullableTextToDb(ci.weatherCaptureLocation),
      gpsLatitude: nullableTextToDb(ci.gpsLatitude),
      gpsLongitude: nullableTextToDb(ci.gpsLongitude),
      productLabelRef: nullableTextToDb(ci.productLabelRef),
      labelVersionOrDate: nullableTextToDb(ci.labelVersionOrDate),
      labelConsistencyReviewed: ci.labelConsistencyReviewed ?? null,
      labelCropSiteReviewed: ci.labelCropSiteReviewed ?? null,
      labelTargetPestReviewed: ci.labelTargetPestReviewed ?? null,
      labelRateReviewed: ci.labelRateReviewed ?? null,
      labelTimingMethodReviewed: ci.labelTimingMethodReviewed ?? null,
      labelPpeReviewed: ci.labelPpeReviewed ?? null,
      labelReiPhiReviewed: ci.labelReiPhiReviewed ?? null,
      labelDriftBufferReviewed: ci.labelDriftBufferReviewed ?? null,
      tankMixProducts: ci.tankMixProducts ?? null,
      supervisorIdentified: ci.supervisorIdentified ?? null,
      workOrderAcknowledged: ci.workOrderAcknowledged ?? null,
      labelInPossessionAcknowledged: ci.labelInPossessionAcknowledged ?? null,
      equipmentReadinessAcknowledged: ci.equipmentReadinessAcknowledged ?? null,
      reviewStatus: "not_reviewed",
      systemCreatedAt: now,
      createdOffline: body.createdOffline ?? true,
      lastUpdatedAt: now,
    };

    await db.transaction(async (tx) => {
      await tx.insert(applicationRecords).values(insertRow);
      await tx.insert(recordEvents).values({
        organizationId: actor.organizationId,
        applicationRecordId: body.id,
        type: "created",
        actorUserId: actor.userId,
        actorDisplayName: actor.displayName,
        occurredAt: now,
        message: "Application record draft created.",
      });
    });

    const saved = await loadRecord(app, actor.organizationId, body.id);
    reply.header("ETag", saved.etag);
    reply.code(201);
    return rowToApplicationRecord(saved);
  });

  // POST /v1/application-records/:recordId/submit — draft -> pending_review.
  app.post<{ Params: { recordId: string } }>(
    "/v1/application-records/:recordId/submit",
    async (req, reply) => {
      requireIdempotencyKey(req);
      const actor = getActor(req);
      const row = await loadRecord(app, actor.organizationId, req.params.recordId);
      assertOwnership(req, row);

      assertTransition(row.workflowStatus, "pending_review");

      if (!row.attestationConfirmed) {
        throw new AppError(
          "VALIDATION_FAILED",
          "Attestation must be confirmed before submission."
        );
      }

      // Server re-runs compliance — the client cannot be trusted (handoff §5.2.7).
      const outcomes = runAllComplianceChecks(rowToApplicationRecord(row));
      const blocked = outcomes.find(
        (o) => o.status === "fail" && o.severity === "blocked"
      );
      if (blocked) {
        throw new AppError("VALIDATION_FAILED", blocked.message);
      }

      const submittedAt = new Date();
      const snapshotId = randomUUID();
      const newEtag = randomUUID();

      await db.transaction(async (tx) => {
        await tx.insert(productSnapshots).values({
          id: snapshotId,
          organizationId: actor.organizationId,
          applicationRecordId: row.id,
          sourceProductId: row.productId ?? null,
          productName: row.productName,
          epaRegistrationNumber: row.epaRegistrationNumber,
          rupStatus: row.rupStatus,
          catalogVersion: row.catalogVersion ?? "UNKNOWN-CATALOG-VERSION",
          snapshotCreatedAt: submittedAt,
        });
        await tx
          .update(applicationRecords)
          .set({
            workflowStatus: "pending_review",
            syncStatus: "queued",
            productSnapshotId: snapshotId,
            submittedBy: actor.displayName,
            submittedAt,
            lastUpdatedAt: submittedAt,
            etag: newEtag,
            updatedAt: submittedAt,
          })
          .where(eq(applicationRecords.id, row.id));
        await tx.insert(recordEvents).values([
          {
            organizationId: actor.organizationId,
            applicationRecordId: row.id,
            type: "compliance_check_run",
            actorUserId: actor.userId,
            actorDisplayName: actor.displayName,
            occurredAt: submittedAt,
            message: "Compliance checks at submit.",
            metadata: { phase: "submit", outcomes },
          },
          {
            organizationId: actor.organizationId,
            applicationRecordId: row.id,
            type: "submitted",
            actorUserId: actor.userId,
            actorDisplayName: actor.displayName,
            occurredAt: submittedAt,
            message: "Application record submitted by contractor.",
          },
          {
            organizationId: actor.organizationId,
            applicationRecordId: row.id,
            type: "product_snapshot_created",
            actorUserId: actor.userId,
            actorDisplayName: actor.displayName,
            occurredAt: submittedAt,
            message: "Product reference snapshot frozen into application record.",
            metadata: { productSnapshotId: snapshotId },
          },
        ]);
      });

      const saved = await loadRecord(app, actor.organizationId, row.id);
      reply.header("ETag", saved.etag);
      return rowToApplicationRecord(saved);
    }
  );
}

async function loadRecord(
  app: FastifyInstance,
  organizationId: string,
  recordId: string
): Promise<RecordRow> {
  const rows = await app.resources.db
    .select()
    .from(applicationRecords)
    .where(
      and(
        eq(applicationRecords.id, recordId),
        eq(applicationRecords.organizationId, organizationId)
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new AppError("NOT_FOUND", "Application record not found.");
  }
  return row;
}

const iso = (v: Date | string | null): string | undefined => {
  if (v == null) return undefined;
  return typeof v === "string" ? v : v.toISOString();
};

// DB row -> client wire shape (re-nests the flattened columns).
export function rowToApplicationRecord(row: RecordRow): ApplicationRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    workflowStatus: row.workflowStatus,
    syncStatus: row.syncStatus,
    contractorInputs: {
      applicatorId: row.applicatorId ?? "",
      applicatorName: row.applicatorName,
      company: row.company,
      certificationNumber: row.certificationNumber ?? undefined,
      farmId: row.farmId ?? "",
      farmName: row.farmName,
      fieldId: row.fieldId ?? "",
      fieldName: row.fieldName,
      cropOrSite: row.cropOrSite,
      acresTreated: acresFromDb(row.acresTreated),
      productId: row.productId ?? undefined,
      productName: row.productName,
      epaRegistrationNumber: row.epaRegistrationNumber,
      rupStatus: row.rupStatus,
      catalogVersion: row.catalogVersion ?? undefined,
      applicationDate: row.applicationDate,
      startTime: timeFromDb(row.startTime),
      endTime: row.endTime ? timeFromDb(row.endTime) : undefined,
      applicationMethod: row.applicationMethod,
      rateApplied: row.rateApplied,
      totalAmountApplied: row.totalAmountApplied,
      targetPest: row.targetPest ?? undefined,
      phi: row.phi ?? undefined,
      temperature: row.temperature,
      windSpeed: row.windSpeed,
      windDirection: row.windDirection,
      weatherNotes: row.weatherNotes ?? undefined,
      weatherSnapshot: (row.weatherSnapshot as ApplicationRecord["contractorInputs"]["weatherSnapshot"]) ?? undefined,
      attestationConfirmed: row.attestationConfirmed,
      submittedBy: row.submittedBy ?? undefined,
      submittedAt: iso(row.submittedAt),
      // Compliance matrix #1-72 — text uses nullableTextFromDb to preserve '' vs
      // undefined; booleans/enums use `?? undefined` (correct because
      // false ?? undefined === false).
      siteType: nullableTextFromDb(row.siteType),
      requesterName: nullableTextFromDb(row.requesterName),
      requesterAddress: nullableTextFromDb(row.requesterAddress),
      siteAddress: nullableTextFromDb(row.siteAddress),
      siteDescription: nullableTextFromDb(row.siteDescription),
      areaTreatedValue: nullableTextFromDb(row.areaTreatedValue),
      areaUnit: row.areaUnit ?? undefined,
      mixtureRate: nullableTextFromDb(row.mixtureRate),
      totalMixtureAmount: nullableTextFromDb(row.totalMixtureAmount),
      applicationRateValue: nullableTextFromDb(row.applicationRateValue),
      rateUnit: row.rateUnit ?? undefined,
      epaRegistrationCorrelationEvidenceId: nullableTextFromDb(
        row.epaRegistrationCorrelationEvidenceId
      ),
      lessThanLabelConcentration:
        row.lessThanLabelConcentration ?? undefined,
      producerRequestText: nullableTextFromDb(row.producerRequestText),
      producerRequestSignature: nullableTextFromDb(row.producerRequestSignature),
      producerRequestDate: nullableTextFromDb(row.producerRequestDate),
      applicatorCategory: row.applicatorCategory ?? undefined,
      noncertifiedApplicatorName: nullableTextFromDb(row.noncertifiedApplicatorName),
      noncertifiedApplicatorLicense: nullableTextFromDb(
        row.noncertifiedApplicatorLicense
      ),
      technicianName: nullableTextFromDb(row.technicianName),
      technicianLicense: nullableTextFromDb(row.technicianLicense),
      traineeName: nullableTextFromDb(row.traineeName),
      indoorSpotCrackCrevice: row.indoorSpotCrackCrevice ?? undefined,
      slnNumber: nullableTextFromDb(row.slnNumber),
      isPremixed: row.isPremixed ?? undefined,
      premixedAmountUsed: nullableTextFromDb(row.premixedAmountUsed),
      premixedActualRate: nullableTextFromDb(row.premixedActualRate),
      structuralTermiteWithin10ft: row.structuralTermiteWithin10ft ?? undefined,
      weatherCaptureSource: nullableTextFromDb(row.weatherCaptureSource),
      weatherCaptureTimestamp: nullableTextFromDb(row.weatherCaptureTimestamp),
      weatherCaptureLocation: nullableTextFromDb(row.weatherCaptureLocation),
      gpsLatitude: nullableTextFromDb(row.gpsLatitude),
      gpsLongitude: nullableTextFromDb(row.gpsLongitude),
      productLabelRef: nullableTextFromDb(row.productLabelRef),
      labelVersionOrDate: nullableTextFromDb(row.labelVersionOrDate),
      labelConsistencyReviewed: row.labelConsistencyReviewed ?? undefined,
      labelCropSiteReviewed: row.labelCropSiteReviewed ?? undefined,
      labelTargetPestReviewed: row.labelTargetPestReviewed ?? undefined,
      labelRateReviewed: row.labelRateReviewed ?? undefined,
      labelTimingMethodReviewed: row.labelTimingMethodReviewed ?? undefined,
      labelPpeReviewed: row.labelPpeReviewed ?? undefined,
      labelReiPhiReviewed: row.labelReiPhiReviewed ?? undefined,
      labelDriftBufferReviewed: row.labelDriftBufferReviewed ?? undefined,
      tankMixProducts:
        (row.tankMixProducts as ApplicationRecord["contractorInputs"]["tankMixProducts"]) ??
        undefined,
      supervisorIdentified: row.supervisorIdentified ?? undefined,
      workOrderAcknowledged: row.workOrderAcknowledged ?? undefined,
      labelInPossessionAcknowledged: row.labelInPossessionAcknowledged ?? undefined,
      equipmentReadinessAcknowledged: row.equipmentReadinessAcknowledged ?? undefined,
    },
    managerInputs: {
      reviewStatus: row.reviewStatus,
      reviewedBy: row.reviewedBy ?? undefined,
      reviewedAt: iso(row.reviewedAt),
      reviewNotes: row.reviewNotes ?? undefined,
    },
    system: {
      createdAt: iso(row.systemCreatedAt) ?? new Date(0).toISOString(),
      createdOffline: row.createdOffline,
      lastUpdatedAt: iso(row.lastUpdatedAt) ?? new Date(0).toISOString(),
      lockedAt: iso(row.lockedAt),
      catalogVersion: row.systemCatalogVersion ?? undefined,
    },
    productSnapshotId: row.productSnapshotId ?? undefined,
    complianceReviewRequired: row.complianceReviewRequired,
  };
}
