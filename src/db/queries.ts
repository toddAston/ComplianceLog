import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./fieldlogDb";
import type {
  ApplicationRecord,
  ApplicationRecordEvent,
  Applicator,
  Farm,
  FieldSite,
  Organization,
  Product,
} from "../domain/types";

export const useAllOrganizations = () =>
  useLiveQuery(() => db.organizations.toArray(), [], [] as Organization[]);

export const useAllFarms = () =>
  useLiveQuery(() => db.farms.toArray(), [], [] as Farm[]);

export const useAllFields = () =>
  useLiveQuery(() => db.fields.toArray(), [], [] as FieldSite[]);

export const useAllApplicators = () =>
  useLiveQuery(() => db.applicators.toArray(), [], [] as Applicator[]);

export const useAllProducts = () =>
  useLiveQuery(() => db.products.toArray(), [], [] as Product[]);

export const useAllApplicationRecords = () =>
  useLiveQuery(
    () => db.applicationRecords.orderBy("system.createdAt").reverse().toArray(),
    [],
    [] as ApplicationRecord[]
  );

export const useRecordEvents = (recordId: string | null) =>
  useLiveQuery(
    () =>
      recordId
        ? db.recordEvents
            .where("applicationRecordId")
            .equals(recordId)
            .sortBy("occurredAt")
        : [],
    [recordId],
    [] as ApplicationRecordEvent[]
  );
