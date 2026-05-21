import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../server";
import { loadEnv } from "../env";
import type { Resources } from "../db/client";
import type { ContractorInputs } from "../../../src/domain/types";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const env = loadEnv({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://localhost/test",
  REDIS_URL: "redis://localhost:6379",
  SESSION_SECRET: "s".repeat(32),
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "r".repeat(32),
} as NodeJS.ProcessEnv);

const APPLICATOR_USER_ID = "00000000-0000-0000-0000-0000000000a1";
const APPLICATOR_ORG_ID = "00000000-0000-0000-0000-0000000000b1";

const applicatorToken = Buffer.from(
  JSON.stringify({
    userId: APPLICATOR_USER_ID,
    organizationId: APPLICATOR_ORG_ID,
    role: "applicator",
    displayName: "Test Applicator",
  })
).toString("base64url");

const authHeaders = {
  authorization: `Bearer ${applicatorToken}`,
  "idempotency-key": "test-key-1",
  "content-type": "application/json",
};

// ---------------------------------------------------------------------------
// Hand-rolled in-memory Drizzle db fake. The surface implemented matches what
// server/src/routes/records.ts actually calls: select().from().where().limit(),
// insert().values(), update().set().where(), transaction(cb).
//
// Where-clause arguments are opaque Drizzle SQL objects — we ignore them and
// return all rows in the table, because each test creates exactly one record.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type Table = unknown;

function makeFakeDb() {
  const tables = new Map<Table, Map<string, Row>>();
  const tableFor = (t: Table): Map<string, Row> => {
    let m = tables.get(t);
    if (!m) {
      m = new Map();
      tables.set(t, m);
    }
    return m;
  };

  const insertOp = (t: Table) => ({
    values(rowOrRows: Row | Row[]) {
      const m = tableFor(t);
      const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
      for (const r of rows) {
        const id = (r.id as string) ?? randomUUID();
        // Audit-column defaults that Drizzle would supply in real Postgres.
        m.set(id, {
          etag: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...r,
          id,
        });
      }
      return Promise.resolve();
    },
  });

  const updateOp = (t: Table) => ({
    set(patch: Row) {
      return {
        where(_filter: unknown) {
          const m = tableFor(t);
          for (const [k, row] of m) {
            m.set(k, { ...row, ...patch });
          }
          return Promise.resolve();
        },
      };
    },
  });

  const selectOp = () => ({
    from(t: Table) {
      return {
        where(_filter: unknown) {
          return {
            limit(_n: number) {
              const m = tableFor(t);
              return Promise.resolve([...m.values()]);
            },
          };
        },
      };
    },
  });

  const db: Record<string, unknown> = {
    insert: insertOp,
    update: updateOp,
    select: selectOp,
    async transaction(cb: (tx: typeof db) => unknown) {
      return cb(db);
    },
    _tables: tables,
  };
  return db;
}

function fakeResources(): Resources {
  const db = makeFakeDb() as unknown as Resources["db"];
  return {
    sql: {} as Resources["sql"],
    db,
    redis: {} as Resources["redis"],
    pingPostgres: async () => true,
    pingRedis: async () => true,
    close: async () => {},
  };
}

// ---------------------------------------------------------------------------
// Payload builders
// ---------------------------------------------------------------------------

function v01Inputs(over: Partial<ContractorInputs> = {}): ContractorInputs {
  return {
    applicatorId: "00000000-0000-0000-0000-0000000000c1",
    applicatorName: "Jane Applicator",
    company: "Acme Spraying",
    certificationNumber: "CERT-001",
    farmId: "00000000-0000-0000-0000-0000000000d1",
    farmName: "North 40",
    fieldId: "00000000-0000-0000-0000-0000000000e1",
    fieldName: "Field A",
    cropOrSite: "Corn",
    acresTreated: "10.5",
    productName: "Roundup",
    epaRegistrationNumber: "524-475",
    rupStatus: "no",
    catalogVersion: "2026-01",
    applicationDate: "2026-05-20",
    startTime: "08:00",
    endTime: "10:00",
    applicationMethod: "broadcast_spray",
    rateApplied: "1 qt/acre",
    totalAmountApplied: "10.5 qt",
    targetPest: "weeds",
    temperature: "72",
    windSpeed: "5",
    windDirection: "N",
    attestationConfirmed: true,
    ...over,
  };
}

function allMatrixInputs(): ContractorInputs {
  // Every matrix field populated, distinct, non-default — for the round-trip
  // assertion that nothing is dropped/coerced.
  return v01Inputs({
    siteType: "outdoor",
    requesterName: "Farmer Joe",
    requesterAddress: "123 Field Rd",
    siteAddress: "456 Field Rd",
    siteDescription: "north pivot",
    areaTreatedValue: "10.5",
    areaUnit: "square_feet",
    mixtureRate: "1.5 qt/acre",
    totalMixtureAmount: "15 gal",
    applicationRateValue: "1.5",
    rateUnit: "qt_per_acre",
    epaRegistrationCorrelationEvidenceId: "evidence-1",
    lessThanLabelConcentration: true,
    producerRequestText: "lower rate ok",
    producerRequestSignature: "J. Farmer",
    producerRequestDate: "2026-05-19",
    applicatorCategory: "certified_commercial",
    noncertifiedApplicatorName: "Mike",
    noncertifiedApplicatorLicense: "NCA-1",
    technicianName: "Tina",
    technicianLicense: "TEC-1",
    traineeName: "Tyler",
    indoorSpotCrackCrevice: false,
    slnNumber: "SLN-001",
    isPremixed: true,
    premixedAmountUsed: "2 gal",
    premixedActualRate: "0.5 gal/acre",
    structuralTermiteWithin10ft: false,
    weatherCaptureSource: "manual",
    weatherCaptureTimestamp: "2026-05-20T08:00:00Z",
    weatherCaptureLocation: "field A center",
    gpsLatitude: "38.5",
    gpsLongitude: "-92.3",
    productLabelRef: "label-2024-rev3",
    labelVersionOrDate: "2024-08-01",
    labelConsistencyReviewed: true,
    labelCropSiteReviewed: true,
    labelTargetPestReviewed: true,
    labelRateReviewed: true,
    labelTimingMethodReviewed: true,
    labelPpeReviewed: true,
    labelReiPhiReviewed: true,
    labelDriftBufferReviewed: true,
    tankMixProducts: [
      {
        productName: "Tank A",
        epaRegistrationNumber: "111-22",
        applicationRate: "0.5 qt/acre",
        totalAmount: "5 qt",
      },
      {
        productName: "Tank B",
        epaRegistrationNumber: "333-44",
        applicationRate: "0.25 qt/acre",
        totalAmount: "2.5 qt",
      },
    ],
    supervisorIdentified: true,
    workOrderAcknowledged: true,
    labelInPossessionAcknowledged: true,
    equipmentReadinessAcknowledged: true,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createRecord(
  app: FastifyInstance,
  contractorInputs: ContractorInputs,
  recordId: string = randomUUID()
) {
  const res = await app.inject({
    method: "POST",
    url: "/v1/application-records",
    headers: authHeaders,
    payload: { id: recordId, contractorInputs },
  });
  return { res, recordId };
}

async function submitRecord(app: FastifyInstance, recordId: string) {
  // No content-type header — submit carries no body, and Fastify rejects
  // an explicit application/json content-type with an empty payload.
  return app.inject({
    method: "POST",
    url: `/v1/application-records/${recordId}/submit`,
    headers: {
      authorization: authHeaders.authorization,
      "idempotency-key": "submit-key-1",
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let app: FastifyInstance | undefined;
beforeEach(() => {
  app = buildApp(fakeResources(), env);
});
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("POST /v1/application-records — matrix round-trip", () => {
  it("round-trips every matrix field on create (no silent drop)", async () => {
    const inputs = allMatrixInputs();
    const { res } = await createRecord(app!, inputs);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    const ci = body.contractorInputs;

    // Spot-check a representative field of each type.
    expect(ci.siteType).toBe("outdoor");
    expect(ci.areaUnit).toBe("square_feet");
    expect(ci.rateUnit).toBe("qt_per_acre");
    expect(ci.applicatorCategory).toBe("certified_commercial");
    expect(ci.lessThanLabelConcentration).toBe(true);
    expect(ci.indoorSpotCrackCrevice).toBe(false);
    expect(ci.slnNumber).toBe("SLN-001");
    expect(ci.gpsLatitude).toBe("38.5");
    expect(ci.gpsLongitude).toBe("-92.3");
    expect(ci.labelConsistencyReviewed).toBe(true);
    expect(ci.labelDriftBufferReviewed).toBe(true);
    expect(ci.supervisorIdentified).toBe(true);
    expect(ci.equipmentReadinessAcknowledged).toBe(true);

    // tankMixProducts survives as an array of objects, not stringified.
    expect(Array.isArray(ci.tankMixProducts)).toBe(true);
    expect(ci.tankMixProducts).toHaveLength(2);
    expect(ci.tankMixProducts[0]).toEqual({
      productName: "Tank A",
      epaRegistrationNumber: "111-22",
      applicationRate: "0.5 qt/acre",
      totalAmount: "5 qt",
    });
  });

  it("returns undefined (not null, not '') for absent matrix fields", async () => {
    const { res } = await createRecord(app!, v01Inputs());
    expect(res.statusCode).toBe(201);
    const ci = res.json().contractorInputs;

    expect(ci.siteType).toBeUndefined();
    expect(ci.areaUnit).toBeUndefined();
    expect(ci.slnNumber).toBeUndefined();
    expect(ci.applicatorCategory).toBeUndefined();
    expect(ci.lessThanLabelConcentration).toBeUndefined();
    expect(ci.gpsLatitude).toBeUndefined();
    expect(ci.tankMixProducts).toBeUndefined();
    expect(ci.supervisorIdentified).toBeUndefined();
  });
});

describe("slnNumber — undefined vs empty distinction", () => {
  // Load-bearing for src/application/compliance/rules/conditionalApplicability.ts:
  // the SLN rule treats absent as fail, empty-string as pass.

  it("absent slnNumber reads back as undefined", async () => {
    const { res } = await createRecord(app!, v01Inputs());
    expect(res.statusCode).toBe(201);
    expect(res.json().contractorInputs.slnNumber).toBeUndefined();
  });

  it("empty-string slnNumber survives and reads back as ''", async () => {
    const { res } = await createRecord(app!, v01Inputs({ slnNumber: "" }));
    expect(res.statusCode).toBe(201);
    expect(res.json().contractorInputs.slnNumber).toBe("");
  });
});

describe("tankMixProducts — empty array vs absent", () => {
  it("[] reads back as []", async () => {
    const { res } = await createRecord(
      app!,
      v01Inputs({ tankMixProducts: [] })
    );
    expect(res.statusCode).toBe(201);
    expect(res.json().contractorInputs.tankMixProducts).toEqual([]);
  });

  it("absent reads back as undefined", async () => {
    const { res } = await createRecord(app!, v01Inputs());
    expect(res.statusCode).toBe(201);
    expect(res.json().contractorInputs.tankMixProducts).toBeUndefined();
  });
});

describe("boolean false survives round-trip", () => {
  // Catches the `?? false` regression — false must not be coerced to undefined.
  it("isPremixed=false reads back as false, not undefined", async () => {
    const { res } = await createRecord(
      app!,
      v01Inputs({ isPremixed: false })
    );
    expect(res.statusCode).toBe(201);
    expect(res.json().contractorInputs.isPremixed).toBe(false);
  });
});

describe("POST /v1/application-records/:id/submit — compliance gate", () => {
  it("blocks submit when an RUP product is applied without a cert (RUP_UNCERTIFIED)", async () => {
    const inputs = v01Inputs({
      rupStatus: "yes",
      certificationNumber: undefined,
    });
    const { recordId } = await createRecord(app!, inputs);
    const res = await submitRecord(app!, recordId);

    expect(res.statusCode).toBe(422);
    const err = res.json().error;
    expect(err.code).toBe("VALIDATION_FAILED");
    expect(err.message).toMatch(/RSMo 281\.037/);
  });

  it("passes submit when RUP product has a cert (matrix fields preserved on submit)", async () => {
    const inputs = allMatrixInputs(); // rupStatus: "no" by default, has cert
    const { recordId } = await createRecord(app!, inputs);
    const res = await submitRecord(app!, recordId);

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.workflowStatus).toBe("pending_review");
    // After submit, matrix fields still round-trip.
    expect(body.contractorInputs.applicatorCategory).toBe("certified_commercial");
    expect(body.contractorInputs.tankMixProducts).toHaveLength(2);
  });
});
