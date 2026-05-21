import { db } from "./fieldlogDb";
import type {
  Organization,
  Product,
  User,
} from "../domain/types";
import { buildRupProductSeed } from "./seedRupProducts";
import {
  DEMO_APPLICATORS,
  DEMO_FARMS,
  DEMO_FIELDS,
} from "./seedDemoRecords";

const now = () => new Date().toISOString();

export const DEMO_ORG_ID = "org-demo-semofarms";
export const DEMO_APPLICATOR_USER_ID = "user-demo-applicator";
export const DEMO_MANAGER_USER_ID = "user-demo-manager";

export async function seedDemoData() {
  const existingOrg = await db.organizations.get(DEMO_ORG_ID);

  if (existingOrg) {
    return;
  }

  const organization: Organization = {
    id: DEMO_ORG_ID,
    name: "Southeast Missouri Farms Demo",
    createdAt: now(),
  };

  const applicatorUser: User = {
    id: DEMO_APPLICATOR_USER_ID,
    organizationId: DEMO_ORG_ID,
    displayName: "Demo Applicator",
    role: "applicator",
    createdAt: now(),
  };

  const managerUser: User = {
    id: DEMO_MANAGER_USER_ID,
    organizationId: DEMO_ORG_ID,
    displayName: "Demo Manager",
    role: "manager",
    createdAt: now(),
  };

  const product: Product = {
    id: "product-example-herbicide-4l",
    catalogVersion: "MO-DEMO-2026-05-19",
    name: "Example Herbicide 4L",
    epaRegistrationNumber: "12345-678",
    rupStatus: "yes",
    createdAt: now(),
  };

  // Curated EPA RUP report rows — gives the product picker real names, real
  // EPA reg numbers, and real manufacturers so the RUP_UNCERTIFIED compliance
  // check fires against authentic products in the demo.
  const rupProducts = buildRupProductSeed(now());

  await db.transaction(
    "rw",
    [db.organizations, db.users, db.farms, db.fields, db.applicators, db.products],
    async () => {
      await db.organizations.add(organization);
      await db.users.bulkAdd([applicatorUser, managerUser]);
      await db.farms.bulkAdd(DEMO_FARMS);
      await db.fields.bulkAdd(DEMO_FIELDS);
      await db.applicators.bulkAdd(DEMO_APPLICATORS);
      await db.products.add(product);
      await db.products.bulkAdd(rupProducts);
    }
  );

}

// Records seed is a separate entry point so production boot can populate the
// app with a varied set of demo records while every test continues to start
// from an empty records table. main.tsx calls both; tests that need records
// build them inline (per-test fixtures) so assertions stay deterministic.
export { seedDemoRecords } from "./seedDemoRecords";
