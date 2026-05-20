import { db } from "../db/fieldlogDb";
import type { FieldSite } from "../domain/types";

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export type CreateFieldInput = {
  organizationId: string;
  farmId: string;
  name: string;
  defaultAcres?: number;
  defaultCropOrSite?: string;
};

export async function createField(input: CreateFieldInput): Promise<FieldSite> {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error("Field name is required.");
  }
  if (!input.organizationId) {
    throw new Error("organizationId is required.");
  }
  if (!input.farmId) {
    throw new Error("farmId is required.");
  }
  if (input.defaultAcres != null && input.defaultAcres < 0) {
    throw new Error("Acres cannot be negative.");
  }

  const farm = await db.farms.get(input.farmId);
  if (!farm) {
    throw new Error("Farm not found.");
  }
  if (farm.organizationId !== input.organizationId) {
    throw new Error("Farm does not belong to the active organization.");
  }

  const siblings = await db.fields
    .where("farmId")
    .equals(input.farmId)
    .toArray();
  const collision = siblings.find(
    (f) => f.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (collision) {
    throw new Error(`A field named "${trimmedName}" already exists on this farm.`);
  }

  const trimmedCrop = input.defaultCropOrSite?.trim();

  const field: FieldSite = {
    id: id(),
    organizationId: input.organizationId,
    farmId: input.farmId,
    name: trimmedName,
    defaultAcres: input.defaultAcres,
    defaultCropOrSite: trimmedCrop || undefined,
    createdAt: now(),
  };

  await db.fields.add(field);
  return field;
}

export async function renameField(
  fieldId: string,
  newName: string
): Promise<FieldSite> {
  return updateField(fieldId, { name: newName });
}

export type UpdateFieldInput = {
  name?: string;
  defaultAcres?: number | null;
  defaultCropOrSite?: string | null;
};

export async function updateField(
  fieldId: string,
  patch: UpdateFieldInput
): Promise<FieldSite> {
  const field = await db.fields.get(fieldId);
  if (!field) {
    throw new Error("Field not found.");
  }

  const next: FieldSite = { ...field };

  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) {
      throw new Error("Field name is required.");
    }
    const siblings = await db.fields
      .where("farmId")
      .equals(field.farmId)
      .toArray();
    const collision = siblings.find(
      (f) =>
        f.id !== fieldId &&
        f.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (collision) {
      throw new Error(
        `A field named "${trimmed}" already exists on this farm.`
      );
    }
    next.name = trimmed;
  }

  if (patch.defaultAcres !== undefined) {
    if (patch.defaultAcres === null) {
      next.defaultAcres = undefined;
    } else {
      if (Number.isNaN(patch.defaultAcres)) {
        throw new Error("Acres must be a number.");
      }
      if (patch.defaultAcres < 0) {
        throw new Error("Acres cannot be negative.");
      }
      next.defaultAcres = patch.defaultAcres;
    }
  }

  if (patch.defaultCropOrSite !== undefined) {
    if (patch.defaultCropOrSite === null) {
      next.defaultCropOrSite = undefined;
    } else {
      const trimmedCrop = patch.defaultCropOrSite.trim();
      next.defaultCropOrSite = trimmedCrop || undefined;
    }
  }

  await db.fields.put(next);
  return next;
}
