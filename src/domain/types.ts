import { z } from "zod";
import {
  applicationRecordEventSchema,
  applicationRecordSchema,
  applicationReviewSchema,
  applicatorSchema,
  catalogMetaSchema,
  contractorInputsSchema,
  farmSchema,
  fieldSiteSchema,
  managerInputsSchema,
  organizationSchema,
  outboxOperationSchema,
  outboxStatusSchema,
  productSchema,
  productSnapshotSchema,
  recordEventTypeSchema,
  reviewStatusSchema,
  rupStatusSchema,
  syncOperationKindSchema,
  syncStatusSchema,
  systemCapturedFieldsSchema,
  userRoleSchema,
  userSchema,
  weatherSnapshotSchema,
  workflowStatusSchema,
} from "./schemas";

export type ID = string;
export type ISODateString = string;
export type ISODateTimeString = string;
export type TimeString = string;

export type RUPStatus = z.infer<typeof rupStatusSchema>;
export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;
export type SyncStatus = z.infer<typeof syncStatusSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type RecordEventType = z.infer<typeof recordEventTypeSchema>;

export type Organization = z.infer<typeof organizationSchema>;
export type User = z.infer<typeof userSchema>;
export type Farm = z.infer<typeof farmSchema>;
export type FieldSite = z.infer<typeof fieldSiteSchema>;
export type Applicator = z.infer<typeof applicatorSchema>;
export type Product = z.infer<typeof productSchema>;
export type ProductSnapshot = z.infer<typeof productSnapshotSchema>;
export type ContractorInputs = z.infer<typeof contractorInputsSchema>;
export type ManagerInputs = z.infer<typeof managerInputsSchema>;
export type SystemCapturedFields = z.infer<typeof systemCapturedFieldsSchema>;
export type ApplicationRecord = z.infer<typeof applicationRecordSchema>;
export type ApplicationReview = z.infer<typeof applicationReviewSchema>;
export type ApplicationRecordEvent = z.infer<typeof applicationRecordEventSchema>;
export type WeatherSnapshot = z.infer<typeof weatherSnapshotSchema>;

export type SyncOperationKind = z.infer<typeof syncOperationKindSchema>;
export type OutboxStatus = z.infer<typeof outboxStatusSchema>;
export type OutboxOperation = z.infer<typeof outboxOperationSchema>;
export type CatalogMeta = z.infer<typeof catalogMetaSchema>;
