export type ID = string;
export type ISODateString = string;
export type ISODateTimeString = string;
export type TimeString = string; // "HH:mm"

export type RUPStatus = "yes" | "no" | "unknown";

export type WorkflowStatus =
  | "draft"
  | "submitted"
  | "pending_review"
  | "needs_correction"
  | "accepted"
  | "locked"
  | "exported";

export type SyncStatus =
  | "local_only"
  | "queued"
  | "syncing"
  | "synced"
  | "sync_failed";

export type UserRole = "applicator" | "manager";

export type ReviewStatus =
  | "not_reviewed"
  | "accepted"
  | "needs_correction"
  | "rejected";

export type RecordEventType =
  | "created"
  | "updated"
  | "submitted"
  | "product_snapshot_created"
  | "reviewed"
  | "accepted"
  | "locked"
  | "exported"
  | "sync_failed";

export interface Organization {
  id: ID;
  name: string;
  createdAt: ISODateTimeString;
}

export interface User {
  id: ID;
  organizationId: ID;
  displayName: string;
  role: UserRole;
  createdAt: ISODateTimeString;
}

export interface Farm {
  id: ID;
  organizationId: ID;
  name: string;
  createdAt: ISODateTimeString;
}

export interface FieldSite {
  id: ID;
  organizationId: ID;
  farmId: ID;
  name: string;
  defaultAcres?: number;
  defaultCropOrSite?: string;
  createdAt: ISODateTimeString;
}

export interface Applicator {
  id: ID;
  organizationId: ID;
  contractorCompanyName: string;
  applicatorName: string;
  certificationNumber?: string;
  createdAt: ISODateTimeString;
}

export interface Product {
  id: ID;
  catalogVersion: string;
  name: string;
  epaRegistrationNumber: string;
  rupStatus: RUPStatus;
  createdAt: ISODateTimeString;
}

export interface ProductSnapshot {
  id: ID;
  applicationRecordId: ID;
  sourceProductId?: ID;

  productName: string;
  epaRegistrationNumber: string;
  rupStatus: RUPStatus;
  catalogVersion: string;

  snapshotCreatedAt: ISODateTimeString;
}

export interface ContractorInputs {
  applicatorId: ID;
  applicatorName: string;
  company: string;
  certificationNumber?: string;

  farmId: ID;
  farmName: string;
  fieldId: ID;
  fieldName: string;
  cropOrSite: string;
  acresTreated: string;

  productId?: ID;
  productName: string;
  epaRegistrationNumber: string;
  rupStatus: RUPStatus;
  catalogVersion?: string;

  applicationDate: ISODateString;
  startTime: TimeString;
  endTime?: TimeString;
  applicationMethod: string;
  rateApplied: string;
  totalAmountApplied: string;
  targetPest?: string;
  phi?: string;

  temperature: string;
  windSpeed: string;
  windDirection: string;
  weatherNotes?: string;

  attestationConfirmed: boolean;
  submittedBy?: string;
  submittedAt?: ISODateTimeString;
}

export interface ManagerInputs {
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: ISODateTimeString;
  reviewNotes?: string;
}

export interface SystemCapturedFields {
  createdAt: ISODateTimeString;
  createdOffline: boolean;
  lastUpdatedAt: ISODateTimeString;
  lockedAt?: ISODateTimeString;
  catalogVersion?: string;
}

export interface ApplicationRecord {
  id: ID;
  organizationId: ID;

  workflowStatus: WorkflowStatus;
  syncStatus: SyncStatus;

  contractorInputs: ContractorInputs;
  managerInputs: ManagerInputs;
  system: SystemCapturedFields;

  productSnapshotId?: ID;

  complianceReviewRequired: boolean;
}

export interface ApplicationReview {
  id: ID;
  applicationRecordId: ID;
  reviewStatus: ReviewStatus;
  reviewedBy: string;
  reviewedAt: ISODateTimeString;
  reviewNotes?: string;
}

export interface ApplicationRecordEvent {
  id: ID;
  applicationRecordId: ID;
  type: RecordEventType;
  actorUserId?: ID;
  actorDisplayName?: string;
  occurredAt: ISODateTimeString;
  message?: string;
  metadata?: Record<string, unknown>;
}
