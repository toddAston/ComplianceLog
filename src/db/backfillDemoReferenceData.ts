import { db } from "./fieldlogDb";
import {
  DEMO_APPLICATORS,
  DEMO_FARMS,
  DEMO_FIELDS,
} from "./seedDemoRecords";

// Boot-time heal for stale demo reference data. `seedDemoData` only runs on a
// clean database (it short-circuits when the demo org already exists), so any
// IndexedDB that was seeded under an older version misses farms/fields/
// applicators added since. This pass walks each demo collection and adds any
// rows whose id is not already present — never overwriting rows the user
// might have added themselves through the UI (e.g. a manager invited a new
// contractor and that applicator should stay).
export async function backfillDemoReferenceData(): Promise<{
  farms: number;
  fields: number;
  applicators: number;
}> {
  let farms = 0;
  let fields = 0;
  let applicators = 0;

  await db.transaction(
    "rw",
    [db.farms, db.fields, db.applicators],
    async () => {
      for (const farm of DEMO_FARMS) {
        const existing = await db.farms.get(farm.id);
        if (!existing) {
          await db.farms.add(farm);
          farms += 1;
        }
      }
      for (const field of DEMO_FIELDS) {
        const existing = await db.fields.get(field.id);
        if (!existing) {
          await db.fields.add(field);
          fields += 1;
        }
      }
      for (const applicator of DEMO_APPLICATORS) {
        const existing = await db.applicators.get(applicator.id);
        if (!existing) {
          await db.applicators.add(applicator);
          applicators += 1;
        }
      }
    }
  );

  return { farms, fields, applicators };
}
