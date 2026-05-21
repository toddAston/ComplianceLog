import type {
  ApplicationRecord,
  ApplicationRecordEvent,
  ApplicationReview,
  Applicator,
  ContractorInputs,
  Farm,
  FieldSite,
  ProductSnapshot,
} from "../domain/types";
import { db } from "./fieldlogDb";

const DEMO_ORG_ID = "org-demo-semofarms";

// Six farms across southeast Missouri, each with multiple fields. Names are
// realistic for the region (Boot Heel, Bootheel, Sikeston, Cape Girardeau,
// etc.) so the demo product picker + record list reads as a working operation
// rather than a synthetic fixture.
export const DEMO_FARMS: Farm[] = [
  { id: "farm-north", organizationId: DEMO_ORG_ID, name: "North Farm", createdAt: "2025-01-15T10:00:00.000Z" },
  { id: "farm-boot-heel", organizationId: DEMO_ORG_ID, name: "Boot Heel Acres", createdAt: "2025-01-20T10:00:00.000Z" },
  { id: "farm-rivercreek", organizationId: DEMO_ORG_ID, name: "River Creek Farms", createdAt: "2025-02-03T10:00:00.000Z" },
  { id: "farm-sikeston", organizationId: DEMO_ORG_ID, name: "Sikeston Cotton Co.", createdAt: "2025-02-18T10:00:00.000Z" },
  { id: "farm-cape", organizationId: DEMO_ORG_ID, name: "Cape Bottoms Farm", createdAt: "2025-03-04T10:00:00.000Z" },
  { id: "farm-delta", organizationId: DEMO_ORG_ID, name: "Delta Row Crops", createdAt: "2025-03-22T10:00:00.000Z" },
];

export const DEMO_FIELDS: FieldSite[] = [
  // North Farm — soybean / corn rotation
  { id: "field-7", organizationId: DEMO_ORG_ID, farmId: "farm-north", name: "Field 7", defaultAcres: 42.5, defaultCropOrSite: "Soybeans", createdAt: "2025-01-15T10:00:00.000Z" },
  { id: "field-north-3", organizationId: DEMO_ORG_ID, farmId: "farm-north", name: "Field 3 (North)", defaultAcres: 80, defaultCropOrSite: "Corn", createdAt: "2025-01-15T10:00:00.000Z" },
  { id: "field-north-rd", organizationId: DEMO_ORG_ID, farmId: "farm-north", name: "Roadside Strip", defaultAcres: 5, defaultCropOrSite: "Pasture", createdAt: "2025-01-15T10:00:00.000Z" },
  // Boot Heel — cotton + soy
  { id: "field-bh-cotton-east", organizationId: DEMO_ORG_ID, farmId: "farm-boot-heel", name: "East Cotton", defaultAcres: 120, defaultCropOrSite: "Cotton", createdAt: "2025-01-20T10:00:00.000Z" },
  { id: "field-bh-cotton-west", organizationId: DEMO_ORG_ID, farmId: "farm-boot-heel", name: "West Cotton", defaultAcres: 95, defaultCropOrSite: "Cotton", createdAt: "2025-01-20T10:00:00.000Z" },
  { id: "field-bh-soy", organizationId: DEMO_ORG_ID, farmId: "farm-boot-heel", name: "South Soy", defaultAcres: 60, defaultCropOrSite: "Soybeans", createdAt: "2025-01-20T10:00:00.000Z" },
  // River Creek — corn + rangeland
  { id: "field-rc-corn", organizationId: DEMO_ORG_ID, farmId: "farm-rivercreek", name: "Bottom Corn", defaultAcres: 150, defaultCropOrSite: "Corn", createdAt: "2025-02-03T10:00:00.000Z" },
  { id: "field-rc-range", organizationId: DEMO_ORG_ID, farmId: "farm-rivercreek", name: "Upper Pasture", defaultAcres: 240, defaultCropOrSite: "Rangeland", createdAt: "2025-02-03T10:00:00.000Z" },
  { id: "field-rc-storage", organizationId: DEMO_ORG_ID, farmId: "farm-rivercreek", name: "Grain Bin #2 (indoor)", defaultAcres: 0, defaultCropOrSite: "Stored grain", createdAt: "2025-02-03T10:00:00.000Z" },
  // Sikeston Cotton
  { id: "field-sk-block-a", organizationId: DEMO_ORG_ID, farmId: "farm-sikeston", name: "Block A", defaultAcres: 80, defaultCropOrSite: "Cotton", createdAt: "2025-02-18T10:00:00.000Z" },
  { id: "field-sk-block-b", organizationId: DEMO_ORG_ID, farmId: "farm-sikeston", name: "Block B", defaultAcres: 95, defaultCropOrSite: "Cotton", createdAt: "2025-02-18T10:00:00.000Z" },
  // Cape Bottoms
  { id: "field-cape-river", organizationId: DEMO_ORG_ID, farmId: "farm-cape", name: "River Bottom", defaultAcres: 100, defaultCropOrSite: "Corn", createdAt: "2025-03-04T10:00:00.000Z" },
  { id: "field-cape-hilltop", organizationId: DEMO_ORG_ID, farmId: "farm-cape", name: "Hilltop", defaultAcres: 55, defaultCropOrSite: "Soybeans", createdAt: "2025-03-04T10:00:00.000Z" },
  // Delta
  { id: "field-delta-1", organizationId: DEMO_ORG_ID, farmId: "farm-delta", name: "Pivot 1", defaultAcres: 130, defaultCropOrSite: "Corn", createdAt: "2025-03-22T10:00:00.000Z" },
  { id: "field-delta-2", organizationId: DEMO_ORG_ID, farmId: "farm-delta", name: "Pivot 2", defaultAcres: 130, defaultCropOrSite: "Soybeans", createdAt: "2025-03-22T10:00:00.000Z" },
  { id: "field-delta-warehouse", organizationId: DEMO_ORG_ID, farmId: "farm-delta", name: "Warehouse (indoor)", defaultAcres: 0, defaultCropOrSite: "Stored grain", createdAt: "2025-03-22T10:00:00.000Z" },
];

// Seven applicators across three contractor companies, mixed certifications +
// Missouri license categories so the Contractor detail dialog shows variety.
// John Smith is the original seeded applicator (kept for back-compat with
// existing tests and the demo session actor). Categories follow 2 CSR
// 70-25.100 + .140 — see `licenseCategoryCodeSchema` for the full enum.
export const DEMO_APPLICATORS: Applicator[] = [
  // Smith Spray Services: row-crop foliar + soil application.
  {
    id: "applicator-john-smith",
    organizationId: DEMO_ORG_ID,
    contractorCompanyName: "Smith Spray Services",
    applicatorName: "John Smith",
    certificationNumber: "MO-123456",
    createdAt: "2025-01-15T10:00:00.000Z",
    licenseCategoryCodes: ["cat_1a_agricultural_plant", "cat_3_ornamental_turf"],
  },
  {
    id: "applicator-marie-c",
    organizationId: DEMO_ORG_ID,
    contractorCompanyName: "Smith Spray Services",
    applicatorName: "Marie Castellano",
    certificationNumber: "MO-129044",
    createdAt: "2025-01-15T10:00:00.000Z",
    licenseCategoryCodes: ["cat_1a_agricultural_plant"],
  },
  {
    id: "applicator-dale-t",
    organizationId: DEMO_ORG_ID,
    contractorCompanyName: "Smith Spray Services",
    applicatorName: "Dale Thompson",
    certificationNumber: "MO-130118",
    createdAt: "2025-01-15T10:00:00.000Z",
    licenseCategoryCodes: ["cat_1a_agricultural_plant", "cat_13_aerial"],
  },
  // Delta Ag Services: corn / soybean + aerial.
  {
    id: "applicator-jenna-r",
    organizationId: DEMO_ORG_ID,
    contractorCompanyName: "Delta Ag Services",
    applicatorName: "Jenna Reyes",
    certificationNumber: "MO-142087",
    createdAt: "2025-02-12T10:00:00.000Z",
    licenseCategoryCodes: ["cat_1a_agricultural_plant", "cat_6_right_of_way"],
  },
  {
    id: "applicator-tomas-l",
    organizationId: DEMO_ORG_ID,
    contractorCompanyName: "Delta Ag Services",
    applicatorName: "Tomas Liu",
    certificationNumber: "MO-142102",
    createdAt: "2025-02-12T10:00:00.000Z",
    licenseCategoryCodes: ["cat_1a_agricultural_plant"],
  },
  // Trainee (no cert) — drives the noncertified-applicator code paths.
  {
    id: "applicator-trainee-bj",
    organizationId: DEMO_ORG_ID,
    contractorCompanyName: "Delta Ag Services",
    applicatorName: "B.J. Walker (Trainee)",
    createdAt: "2025-04-01T10:00:00.000Z",
    // No license categories yet (trainee). Noncertified RUP retraining tracked
    // via the dialog's training type + date inputs.
    noncertifiedRupTrainingType: "training_program",
    noncertifiedRupTrainingDate: "2026-04-01",
  },
  // Bootheel Pest Solutions: structural / termite / fumigation specialty.
  {
    id: "applicator-rup-spec",
    organizationId: DEMO_ORG_ID,
    contractorCompanyName: "Bootheel Pest Solutions",
    applicatorName: "Ramona Pérez",
    certificationNumber: "MO-119812",
    createdAt: "2025-04-12T10:00:00.000Z",
    licenseCategoryCodes: [
      "cat_7a_general_structural",
      "cat_7b_termite",
      "cat_7c_fumigation",
    ],
  },
];

const APPLICATOR_BY_ID = new Map(DEMO_APPLICATORS.map((a) => [a.id, a]));
const FIELD_BY_ID = new Map(DEMO_FIELDS.map((f) => [f.id, f]));
const FARM_BY_ID = new Map(DEMO_FARMS.map((f) => [f.id, f]));

// Realistic requester for the address-style chain-of-custody fields.
const REQUESTER = {
  name: "Acme Producer Co.",
  address: "4521 County Road MM, Sikeston, MO 63801",
};

type RecordSpec = {
  id: string;
  applicatorId: string;
  fieldId: string;
  productId: string;
  productName: string;
  productEpa: string;
  productRup: "yes" | "no" | "unknown";
  applicationDate: string; // ISO date
  startTime: string;
  endTime: string;
  targetPest: string;
  rate: string;
  totalAmount: string;
  acres: string;
  weather: { temp: string; wind: string; windDir: string };
  workflowStatus:
    | "draft"
    | "submitted"
    | "pending_review"
    | "needs_correction"
    | "locked"
    | "exported";
  // The manager who acted on the record at lock time, if applicable.
  managerAction?: { reviewedAt: string; reviewNotes?: string };
  // Whether the record fully cleared label-review acks (some records are
  // marked unreviewed to keep the LABEL_VERIFICATION_REQUIRED bucket lit).
  labelReviewed?: boolean;
  notes?: string;
};

// 28 records: at least one per workflow status, spread across all farms /
// applicators / product families so every UI surface (Drafts list, Review
// queue, locked records with PDF + audit) has rich content.
const RECORD_SPECS: RecordSpec[] = [
  // ── Drafts (5) ─────────────────────────────────
  { id: "rec-d-1", applicatorId: "applicator-john-smith", fieldId: "field-7", productId: "rup-100-1075", productName: "Force 3G Insecticide", productEpa: "100-1075", productRup: "yes", applicationDate: "2026-05-18", startTime: "07:00", endTime: "09:30", targetPest: "Western Corn Rootworm", rate: "5.5 lb/ac", totalAmount: "234 lb", acres: "42.5", weather: { temp: "68", wind: "4", windDir: "S" }, workflowStatus: "draft", labelReviewed: true },
  { id: "rec-d-2", applicatorId: "applicator-marie-c", fieldId: "field-north-3", productId: "rup-100-1086", productName: "Karate EC-W Insecticide", productEpa: "100-1086", productRup: "yes", applicationDate: "2026-05-19", startTime: "08:00", endTime: "11:30", targetPest: "Soybean Aphid", rate: "3.84 oz/ac", totalAmount: "307 oz", acres: "80", weather: { temp: "72", wind: "5", windDir: "SSW" }, workflowStatus: "draft", labelReviewed: false },
  { id: "rec-d-3", applicatorId: "applicator-dale-t", fieldId: "field-bh-cotton-east", productId: "rup-100-1652", productName: "Gramoxone 3LB", productEpa: "100-1652", productRup: "yes", applicationDate: "2026-05-19", startTime: "06:30", endTime: "10:00", targetPest: "Pigweed (Palmer amaranth)", rate: "2.5 pt/ac", totalAmount: "37.5 gal", acres: "120", weather: { temp: "75", wind: "7", windDir: "S" }, workflowStatus: "draft", labelReviewed: true },
  { id: "rec-d-4", applicatorId: "applicator-jenna-r", fieldId: "field-rc-corn", productId: "rup-228-535", productName: "Trooper 22K Herbicide", productEpa: "228-535", productRup: "yes", applicationDate: "2026-05-20", startTime: "07:00", endTime: "12:00", targetPest: "Field bindweed", rate: "16 oz/ac", totalAmount: "2400 oz", acres: "150", weather: { temp: "70", wind: "3", windDir: "W" }, workflowStatus: "draft", labelReviewed: false },
  { id: "rec-d-5", applicatorId: "applicator-tomas-l", fieldId: "field-delta-1", productId: "rup-100-1075", productName: "Force 3G Insecticide", productEpa: "100-1075", productRup: "yes", applicationDate: "2026-05-20", startTime: "07:30", endTime: "10:00", targetPest: "Corn Rootworm", rate: "5.5 lb/ac", totalAmount: "715 lb", acres: "130", weather: { temp: "73", wind: "6", windDir: "SSW" }, workflowStatus: "draft", labelReviewed: true },

  // ── Submitted / pending review (6) ──────────────
  { id: "rec-p-1", applicatorId: "applicator-john-smith", fieldId: "field-bh-soy", productId: "rup-100-1276", productName: "Endigo ZC", productEpa: "100-1276", productRup: "yes", applicationDate: "2026-05-15", startTime: "06:45", endTime: "09:15", targetPest: "Stink Bug", rate: "4 oz/ac", totalAmount: "240 oz", acres: "60", weather: { temp: "78", wind: "5", windDir: "S" }, workflowStatus: "pending_review", labelReviewed: true },
  { id: "rec-p-2", applicatorId: "applicator-marie-c", fieldId: "field-cape-river", productId: "rup-228-530", productName: "Manpower Herbicide", productEpa: "228-530", productRup: "yes", applicationDate: "2026-05-16", startTime: "07:00", endTime: "11:00", targetPest: "Pasture Weeds", rate: "1 qt/ac", totalAmount: "25 gal", acres: "100", weather: { temp: "74", wind: "8", windDir: "SW" }, workflowStatus: "pending_review", labelReviewed: false },
  { id: "rec-p-3", applicatorId: "applicator-dale-t", fieldId: "field-bh-cotton-west", productId: "rup-279-3069", productName: "Capture 2 EC Insecticide/Miticide", productEpa: "279-3069", productRup: "yes", applicationDate: "2026-05-17", startTime: "06:00", endTime: "08:30", targetPest: "Cotton Aphid", rate: "6.4 oz/ac", totalAmount: "608 oz", acres: "95", weather: { temp: "72", wind: "4", windDir: "S" }, workflowStatus: "pending_review", labelReviewed: true },
  { id: "rec-p-4", applicatorId: "applicator-jenna-r", fieldId: "field-delta-2", productId: "rup-61842-52", productName: "Lannate SP INSECTICIDE", productEpa: "61842-52", productRup: "yes", applicationDate: "2026-05-17", startTime: "07:15", endTime: "10:45", targetPest: "Soybean Looper", rate: "0.5 lb/ac", totalAmount: "65 lb", acres: "130", weather: { temp: "71", wind: "6", windDir: "SE" }, workflowStatus: "pending_review", labelReviewed: false },
  { id: "rec-p-5", applicatorId: "applicator-tomas-l", fieldId: "field-sk-block-a", productId: "rup-100-1112", productName: "Warrior Insecticide with Zeon", productEpa: "100-1112", productRup: "yes", applicationDate: "2026-05-18", startTime: "06:00", endTime: "09:00", targetPest: "Plant Bug", rate: "3.2 oz/ac", totalAmount: "256 oz", acres: "80", weather: { temp: "70", wind: "3", windDir: "S" }, workflowStatus: "pending_review", labelReviewed: true },
  { id: "rec-p-6", applicatorId: "applicator-rup-spec", fieldId: "field-rc-storage", productId: "rup-4-152", productName: "Bonide Orchard Mouse Bait", productEpa: "4-152", productRup: "yes", applicationDate: "2026-05-18", startTime: "10:00", endTime: "11:00", targetPest: "Field mice", rate: "0.25 lb/bin", totalAmount: "2 lb", acres: "0", weather: { temp: "60", wind: "0", windDir: "" }, workflowStatus: "pending_review", labelReviewed: true, notes: "Indoor — storage bin." },

  // ── Needs correction (3) ────────────────────────
  { id: "rec-nc-1", applicatorId: "applicator-trainee-bj", fieldId: "field-cape-hilltop", productId: "rup-228-526", productName: "Kaiso 24 WG Insecticide", productEpa: "228-526", productRup: "yes", applicationDate: "2026-05-12", startTime: "07:00", endTime: "09:00", targetPest: "Bean Leaf Beetle", rate: "1.92 oz/ac", totalAmount: "105.6 oz", acres: "55", weather: { temp: "69", wind: "9", windDir: "W" }, workflowStatus: "needs_correction", managerAction: { reviewedAt: "2026-05-12T15:00:00.000Z", reviewNotes: "Wind speed at 9 mph — confirm drift management plan was followed." }, labelReviewed: false },
  { id: "rec-nc-2", applicatorId: "applicator-jenna-r", fieldId: "field-rc-range", productId: "rup-228-535", productName: "Trooper 22K Herbicide", productEpa: "228-535", productRup: "yes", applicationDate: "2026-05-10", startTime: "06:30", endTime: "13:30", targetPest: "Sericea lespedeza", rate: "12 oz/ac", totalAmount: "2880 oz", acres: "240", weather: { temp: "76", wind: "5", windDir: "S" }, workflowStatus: "needs_correction", managerAction: { reviewedAt: "2026-05-11T09:30:00.000Z", reviewNotes: "Verify acreage — 240 ac in 7 hours requires sustained 34 ac/hr." }, labelReviewed: true },
  { id: "rec-nc-3", applicatorId: "applicator-dale-t", fieldId: "field-bh-cotton-east", productId: "rup-279-3069", productName: "Capture 2 EC Insecticide/Miticide", productEpa: "279-3069", productRup: "yes", applicationDate: "2026-05-09", startTime: "06:00", endTime: "08:00", targetPest: "Cotton Bollworm", rate: "5.12 oz/ac", totalAmount: "614.4 oz", acres: "120", weather: { temp: "73", wind: "4", windDir: "SSW" }, workflowStatus: "needs_correction", managerAction: { reviewedAt: "2026-05-09T11:00:00.000Z", reviewNotes: "Re-check the target pest — bollworm or budworm? Affects label rate range." }, labelReviewed: false },

  // ── Locked records (12) — varied across farms + products ─────
  { id: "rec-l-1", applicatorId: "applicator-john-smith", fieldId: "field-7", productId: "rup-100-1086", productName: "Karate EC-W Insecticide", productEpa: "100-1086", productRup: "yes", applicationDate: "2026-05-08", startTime: "07:00", endTime: "10:00", targetPest: "Soybean Aphid", rate: "3.84 oz/ac", totalAmount: "163 oz", acres: "42.5", weather: { temp: "70", wind: "4", windDir: "S" }, workflowStatus: "locked", managerAction: { reviewedAt: "2026-05-08T14:00:00.000Z", reviewNotes: "Looks good — approved as evidence." }, labelReviewed: true },
  { id: "rec-l-2", applicatorId: "applicator-marie-c", fieldId: "field-north-3", productId: "rup-100-1075", productName: "Force 3G Insecticide", productEpa: "100-1075", productRup: "yes", applicationDate: "2026-05-07", startTime: "07:30", endTime: "11:30", targetPest: "Corn Rootworm", rate: "5.5 lb/ac", totalAmount: "440 lb", acres: "80", weather: { temp: "68", wind: "3", windDir: "SE" }, workflowStatus: "locked", managerAction: { reviewedAt: "2026-05-07T16:00:00.000Z", reviewNotes: "Standard corn rootworm treatment — approved." }, labelReviewed: true },
  { id: "rec-l-3", applicatorId: "applicator-dale-t", fieldId: "field-bh-soy", productId: "rup-100-1276", productName: "Endigo ZC", productEpa: "100-1276", productRup: "yes", applicationDate: "2026-05-05", startTime: "06:00", endTime: "09:00", targetPest: "Stink Bug", rate: "4 oz/ac", totalAmount: "240 oz", acres: "60", weather: { temp: "72", wind: "5", windDir: "S" }, workflowStatus: "locked", managerAction: { reviewedAt: "2026-05-05T13:00:00.000Z", reviewNotes: "Approved — bollworm window." }, labelReviewed: true },
  { id: "rec-l-4", applicatorId: "applicator-jenna-r", fieldId: "field-delta-2", productId: "rup-100-1652", productName: "Gramoxone 3LB", productEpa: "100-1652", productRup: "yes", applicationDate: "2026-05-04", startTime: "07:00", endTime: "12:30", targetPest: "Marestail", rate: "2.5 pt/ac", totalAmount: "40.6 gal", acres: "130", weather: { temp: "75", wind: "6", windDir: "S" }, workflowStatus: "locked", managerAction: { reviewedAt: "2026-05-04T15:30:00.000Z" }, labelReviewed: true },
  { id: "rec-l-5", applicatorId: "applicator-tomas-l", fieldId: "field-sk-block-b", productId: "rup-100-1112", productName: "Warrior Insecticide with Zeon", productEpa: "100-1112", productRup: "yes", applicationDate: "2026-05-03", startTime: "06:15", endTime: "10:15", targetPest: "Plant Bug", rate: "3.2 oz/ac", totalAmount: "304 oz", acres: "95", weather: { temp: "71", wind: "4", windDir: "SSW" }, workflowStatus: "locked", managerAction: { reviewedAt: "2026-05-03T12:00:00.000Z", reviewNotes: "Approved." }, labelReviewed: true },
  { id: "rec-l-6", applicatorId: "applicator-john-smith", fieldId: "field-bh-cotton-east", productId: "rup-279-3069", productName: "Capture 2 EC Insecticide/Miticide", productEpa: "279-3069", productRup: "yes", applicationDate: "2026-05-02", startTime: "06:00", endTime: "09:30", targetPest: "Cotton Aphid", rate: "6.4 oz/ac", totalAmount: "768 oz", acres: "120", weather: { temp: "73", wind: "5", windDir: "S" }, workflowStatus: "locked", managerAction: { reviewedAt: "2026-05-02T15:00:00.000Z", reviewNotes: "Bifenthrin treatment — approved." }, labelReviewed: true },
  { id: "rec-l-7", applicatorId: "applicator-marie-c", fieldId: "field-cape-river", productId: "rup-228-530", productName: "Manpower Herbicide", productEpa: "228-530", productRup: "yes", applicationDate: "2026-04-30", startTime: "07:00", endTime: "13:00", targetPest: "Bull Thistle", rate: "1 qt/ac", totalAmount: "25 gal", acres: "100", weather: { temp: "67", wind: "6", windDir: "W" }, workflowStatus: "locked", managerAction: { reviewedAt: "2026-04-30T16:30:00.000Z" }, labelReviewed: true },
  { id: "rec-l-8", applicatorId: "applicator-dale-t", fieldId: "field-bh-cotton-west", productId: "rup-100-1086", productName: "Karate EC-W Insecticide", productEpa: "100-1086", productRup: "yes", applicationDate: "2026-04-28", startTime: "06:30", endTime: "09:30", targetPest: "Tarnished Plant Bug", rate: "3.84 oz/ac", totalAmount: "364.8 oz", acres: "95", weather: { temp: "70", wind: "3", windDir: "S" }, workflowStatus: "locked", managerAction: { reviewedAt: "2026-04-28T11:00:00.000Z", reviewNotes: "Approved." }, labelReviewed: true },
  { id: "rec-l-9", applicatorId: "applicator-jenna-r", fieldId: "field-rc-corn", productId: "rup-100-1253", productName: "Force CS Insecticide", productEpa: "100-1253", productRup: "yes", applicationDate: "2026-04-26", startTime: "07:00", endTime: "11:00", targetPest: "Corn Rootworm", rate: "0.46 oz/1000 row-ft", totalAmount: "240 oz", acres: "150", weather: { temp: "65", wind: "5", windDir: "SE" }, workflowStatus: "locked", managerAction: { reviewedAt: "2026-04-26T14:00:00.000Z" }, labelReviewed: true },
  { id: "rec-l-10", applicatorId: "applicator-tomas-l", fieldId: "field-delta-1", productId: "rup-100-1075", productName: "Force 3G Insecticide", productEpa: "100-1075", productRup: "yes", applicationDate: "2026-04-25", startTime: "07:30", endTime: "10:30", targetPest: "Corn Rootworm", rate: "5.5 lb/ac", totalAmount: "715 lb", acres: "130", weather: { temp: "68", wind: "4", windDir: "S" }, workflowStatus: "locked", managerAction: { reviewedAt: "2026-04-25T15:00:00.000Z", reviewNotes: "Approved — standard treatment." }, labelReviewed: true },
  { id: "rec-l-11", applicatorId: "applicator-rup-spec", fieldId: "field-delta-warehouse", productId: "rup-4-152", productName: "Bonide Orchard Mouse Bait", productEpa: "4-152", productRup: "yes", applicationDate: "2026-04-22", startTime: "10:00", endTime: "11:30", targetPest: "Field mice", rate: "0.5 lb/site", totalAmount: "4 lb", acres: "0", weather: { temp: "62", wind: "0", windDir: "" }, workflowStatus: "locked", managerAction: { reviewedAt: "2026-04-22T13:00:00.000Z", reviewNotes: "Indoor application — approved per pest control protocol." }, labelReviewed: true, notes: "Indoor — warehouse." },
  { id: "rec-l-12", applicatorId: "applicator-john-smith", fieldId: "field-north-3", productId: "rup-228-535", productName: "Trooper 22K Herbicide", productEpa: "228-535", productRup: "yes", applicationDate: "2026-04-18", startTime: "07:00", endTime: "12:00", targetPest: "Johnsongrass", rate: "10 oz/ac", totalAmount: "800 oz", acres: "80", weather: { temp: "66", wind: "5", windDir: "SW" }, workflowStatus: "locked", managerAction: { reviewedAt: "2026-04-18T16:00:00.000Z" }, labelReviewed: true },

  // ── Exported (2) ────────────────────────────────
  { id: "rec-e-1", applicatorId: "applicator-marie-c", fieldId: "field-7", productId: "rup-100-1075", productName: "Force 3G Insecticide", productEpa: "100-1075", productRup: "yes", applicationDate: "2026-04-12", startTime: "08:00", endTime: "11:00", targetPest: "Corn Rootworm", rate: "5.5 lb/ac", totalAmount: "234 lb", acres: "42.5", weather: { temp: "64", wind: "3", windDir: "S" }, workflowStatus: "exported", managerAction: { reviewedAt: "2026-04-12T16:00:00.000Z" }, labelReviewed: true },
  { id: "rec-e-2", applicatorId: "applicator-dale-t", fieldId: "field-bh-cotton-east", productId: "rup-100-1086", productName: "Karate EC-W Insecticide", productEpa: "100-1086", productRup: "yes", applicationDate: "2026-04-10", startTime: "06:00", endTime: "10:00", targetPest: "Tarnished Plant Bug", rate: "3.84 oz/ac", totalAmount: "460.8 oz", acres: "120", weather: { temp: "68", wind: "4", windDir: "S" }, workflowStatus: "exported", managerAction: { reviewedAt: "2026-04-10T15:00:00.000Z" }, labelReviewed: true },
];

const DEMO_MANAGER_DISPLAY = "Demo Manager";
const RUP_CATALOG_VERSION = "MO-DEMO-2026-05-21";

// One UUID per spec — deterministic by record id so reseeds yield stable rows.
const uid = (prefix: string, recordId: string) => `${prefix}-${recordId}`;

function buildContractorInputs(spec: RecordSpec): ContractorInputs {
  const applicator = APPLICATOR_BY_ID.get(spec.applicatorId)!;
  const field = FIELD_BY_ID.get(spec.fieldId)!;
  const farm = FARM_BY_ID.get(field.farmId)!;
  const isIndoor = field.defaultCropOrSite?.toLowerCase().includes("grain");
  const isSubmitted = spec.workflowStatus !== "draft";

  return {
    applicatorId: applicator.id,
    applicatorName: applicator.applicatorName,
    company: applicator.contractorCompanyName,
    certificationNumber: applicator.certificationNumber,

    farmId: farm.id,
    farmName: farm.name,
    fieldId: field.id,
    fieldName: field.name,
    cropOrSite: field.defaultCropOrSite ?? "",
    acresTreated: spec.acres,

    productId: spec.productId,
    productName: spec.productName,
    epaRegistrationNumber: spec.productEpa,
    rupStatus: spec.productRup,
    catalogVersion: RUP_CATALOG_VERSION,

    applicationDate: spec.applicationDate,
    startTime: spec.startTime,
    endTime: spec.endTime,
    applicationMethod: "",
    rateApplied: spec.rate,
    totalAmountApplied: spec.totalAmount,
    targetPest: spec.targetPest,

    temperature: spec.weather.temp,
    windSpeed: spec.weather.wind,
    windDirection: spec.weather.windDir,

    weatherCaptureSource: spec.weather.temp ? "manual" : undefined,
    weatherCaptureTimestamp: spec.weather.temp
      ? `${spec.applicationDate}T${spec.startTime}:00.000Z`
      : undefined,
    weatherCaptureLocation: spec.weather.temp ? `${farm.name} — ${field.name}` : undefined,

    requesterName: REQUESTER.name,
    requesterAddress: REQUESTER.address,
    siteDescription: `${farm.name} — ${field.name}${isIndoor ? " (indoor)" : ""}`,

    applicatorCategory: applicator.certificationNumber
      ? "certified_commercial"
      : "trainee",
    slnNumber: "",

    productLabelRef: spec.labelReviewed
      ? `https://example.epa.gov/labels/${spec.productEpa}`
      : undefined,
    labelVersionOrDate: spec.labelReviewed
      ? `Demo: ${spec.applicationDate}`
      : undefined,
    labelConsistencyReviewed: spec.labelReviewed,
    labelCropSiteReviewed: spec.labelReviewed,
    labelTargetPestReviewed: spec.labelReviewed,
    labelRateReviewed: spec.labelReviewed,
    labelTimingMethodReviewed: spec.labelReviewed,
    labelPpeReviewed: spec.labelReviewed,
    labelReiPhiReviewed: spec.labelReviewed,
    labelDriftBufferReviewed: spec.labelReviewed,

    attestationConfirmed: isSubmitted,
    submittedBy: isSubmitted ? applicator.applicatorName : undefined,
    submittedAt: isSubmitted
      ? `${spec.applicationDate}T${spec.endTime}:00.000Z`
      : undefined,
  };
}

function buildApplicationRecord(spec: RecordSpec): {
  record: ApplicationRecord;
  snapshot: ProductSnapshot | null;
  review: ApplicationReview | null;
  events: ApplicationRecordEvent[];
} {
  const contractorInputs = buildContractorInputs(spec);
  const applicator = APPLICATOR_BY_ID.get(spec.applicatorId)!;
  const isPastSubmit = spec.workflowStatus !== "draft";
  const isLockedOrExported =
    spec.workflowStatus === "locked" || spec.workflowStatus === "exported";

  const snapshotId = isPastSubmit ? uid("snap", spec.id) : null;
  const snapshot: ProductSnapshot | null =
    isPastSubmit && snapshotId
      ? {
          id: snapshotId,
          applicationRecordId: spec.id,
          sourceProductId: spec.productId,
          productName: spec.productName,
          epaRegistrationNumber: spec.productEpa,
          rupStatus: spec.productRup,
          catalogVersion: RUP_CATALOG_VERSION,
          snapshotCreatedAt: `${spec.applicationDate}T${spec.endTime}:30.000Z`,
        }
      : null;

  const createdAt = `${spec.applicationDate}T${spec.startTime}:00.000Z`;
  const submittedAt = isPastSubmit
    ? `${spec.applicationDate}T${spec.endTime}:00.000Z`
    : undefined;
  const reviewedAt = spec.managerAction?.reviewedAt;
  const lockedAt = isLockedOrExported ? reviewedAt : undefined;

  const record: ApplicationRecord = {
    id: spec.id,
    organizationId: DEMO_ORG_ID,
    workflowStatus: spec.workflowStatus,
    syncStatus: isPastSubmit ? "synced" : "local_only",
    contractorInputs,
    managerInputs: {
      reviewStatus:
        spec.workflowStatus === "needs_correction"
          ? "needs_correction"
          : isLockedOrExported
          ? "accepted"
          : "not_reviewed",
      reviewedBy: spec.managerAction ? DEMO_MANAGER_DISPLAY : undefined,
      reviewedAt,
      reviewNotes: spec.managerAction?.reviewNotes,
    },
    system: {
      createdAt,
      createdOffline: false,
      lastUpdatedAt: reviewedAt ?? submittedAt ?? createdAt,
      lockedAt,
      catalogVersion: RUP_CATALOG_VERSION,
    },
    productSnapshotId: snapshotId ?? undefined,
    complianceReviewRequired: false,
  };

  const review: ApplicationReview | null =
    spec.managerAction && reviewedAt
      ? {
          id: uid("rev", spec.id),
          applicationRecordId: spec.id,
          reviewStatus:
            spec.workflowStatus === "needs_correction"
              ? "needs_correction"
              : "accepted",
          reviewedBy: DEMO_MANAGER_DISPLAY,
          reviewedAt,
          reviewNotes: spec.managerAction.reviewNotes,
        }
      : null;

  const events: ApplicationRecordEvent[] = [
    {
      id: uid("ev-created", spec.id),
      applicationRecordId: spec.id,
      type: "created",
      actorUserId: "user-demo-applicator",
      actorDisplayName: applicator.applicatorName,
      occurredAt: createdAt,
      message: "Application record draft created.",
    },
  ];
  if (isPastSubmit && submittedAt) {
    events.push({
      id: uid("ev-submitted", spec.id),
      applicationRecordId: spec.id,
      type: "submitted",
      actorUserId: "user-demo-applicator",
      actorDisplayName: applicator.applicatorName,
      occurredAt: submittedAt,
      message: "Application record submitted by contractor.",
    });
    if (snapshot) {
      events.push({
        id: uid("ev-snap", spec.id),
        applicationRecordId: spec.id,
        type: "product_snapshot_created",
        actorUserId: "user-demo-applicator",
        actorDisplayName: applicator.applicatorName,
        occurredAt: snapshot.snapshotCreatedAt,
        message: "Product reference snapshot copied into application record.",
      });
    }
  }
  if (spec.workflowStatus === "needs_correction" && reviewedAt) {
    events.push({
      id: uid("ev-corr", spec.id),
      applicationRecordId: spec.id,
      type: "correction_requested",
      actorUserId: "user-demo-manager",
      actorDisplayName: DEMO_MANAGER_DISPLAY,
      occurredAt: reviewedAt,
      message: "Manager requested correction.",
      metadata: { correctionNotes: spec.managerAction?.reviewNotes },
    });
  }
  if (isLockedOrExported && reviewedAt) {
    events.push({
      id: uid("ev-rev", spec.id),
      applicationRecordId: spec.id,
      type: "reviewed",
      actorUserId: "user-demo-manager",
      actorDisplayName: DEMO_MANAGER_DISPLAY,
      occurredAt: reviewedAt,
      message: "Manager reviewed application record.",
      metadata: { reviewStatus: "accepted" },
    });
    events.push({
      id: uid("ev-lock", spec.id),
      applicationRecordId: spec.id,
      type: "locked",
      actorUserId: "user-demo-manager",
      actorDisplayName: DEMO_MANAGER_DISPLAY,
      occurredAt: reviewedAt,
      message: "Application record locked as immutable evidence.",
    });
  }
  if (spec.workflowStatus === "exported" && reviewedAt) {
    events.push({
      id: uid("ev-exp", spec.id),
      applicationRecordId: spec.id,
      type: "exported",
      actorUserId: "user-demo-manager",
      actorDisplayName: DEMO_MANAGER_DISPLAY,
      occurredAt: reviewedAt,
      message: "Audit packet exported.",
    });
  }

  return { record, snapshot, review, events };
}

export async function seedDemoRecords(): Promise<void> {
  // Idempotency guard: if any of the demo records already exists, bail. Avoids
  // duplicate rows on hot-reload or repeated boots. Tests build records inline
  // so they never call this; production calls it once per cold boot.
  const sentinel = await db.applicationRecords.get(RECORD_SPECS[0].id);
  if (sentinel) return;

  const records: ApplicationRecord[] = [];
  const snapshots: ProductSnapshot[] = [];
  const reviews: ApplicationReview[] = [];
  const events: ApplicationRecordEvent[] = [];

  for (const spec of RECORD_SPECS) {
    const built = buildApplicationRecord(spec);
    records.push(built.record);
    if (built.snapshot) snapshots.push(built.snapshot);
    if (built.review) reviews.push(built.review);
    events.push(...built.events);
  }

  await db.transaction(
    "rw",
    [
      db.applicationRecords,
      db.productSnapshots,
      db.reviews,
      db.recordEvents,
    ],
    async () => {
      await db.applicationRecords.bulkPut(records);
      await db.productSnapshots.bulkPut(snapshots);
      await db.reviews.bulkPut(reviews);
      await db.recordEvents.bulkPut(events);
    }
  );
}

export const DEMO_RECORD_COUNT = RECORD_SPECS.length;
