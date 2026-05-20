import { db } from "../db/fieldlogDb";
import type { Farm } from "../domain/types";

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export async function createFarm(input: {
  organizationId: string;
  name: string;
}): Promise<Farm> {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error("Farm name is required.");
  }
  if (!input.organizationId) {
    throw new Error("organizationId is required.");
  }

  const existing = await db.farms
    .where("organizationId")
    .equals(input.organizationId)
    .toArray();
  const duplicate = existing.find(
    (f) => f.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`A farm named "${trimmedName}" already exists.`);
  }

  const farm: Farm = {
    id: id(),
    organizationId: input.organizationId,
    name: trimmedName,
    createdAt: now(),
  };

  await db.farms.add(farm);
  return farm;
}

export async function renameFarm(
  farmId: string,
  newName: string
): Promise<Farm> {
  const trimmed = newName.trim();
  if (!trimmed) {
    throw new Error("Farm name is required.");
  }

  const farm = await db.farms.get(farmId);
  if (!farm) {
    throw new Error("Farm not found.");
  }

  const siblings = await db.farms
    .where("organizationId")
    .equals(farm.organizationId)
    .toArray();
  const collision = siblings.find(
    (f) =>
      f.id !== farmId && f.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (collision) {
    throw new Error(`A farm named "${trimmed}" already exists.`);
  }

  const updated: Farm = { ...farm, name: trimmed };
  await db.farms.put(updated);
  return updated;
}
