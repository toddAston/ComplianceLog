import { db } from "./fieldlogDb";
import type {
  Applicator,
  Farm,
  FieldSite,
  Organization,
  Product,
  User,
} from "../domain/types";

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

  const farm: Farm = {
    id: "farm-north",
    organizationId: DEMO_ORG_ID,
    name: "North Farm",
    createdAt: now(),
  };

  const field: FieldSite = {
    id: "field-7",
    organizationId: DEMO_ORG_ID,
    farmId: farm.id,
    name: "Field 7",
    defaultAcres: 42.5,
    defaultCropOrSite: "Soybeans",
    createdAt: now(),
  };

  const applicator: Applicator = {
    id: "applicator-john-smith",
    organizationId: DEMO_ORG_ID,
    contractorCompanyName: "Smith Spray Services",
    applicatorName: "John Smith",
    certificationNumber: "MO-123456",
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

  await db.transaction(
    "rw",
    [db.organizations, db.users, db.farms, db.fields, db.applicators, db.products],
    async () => {
      await db.organizations.add(organization);
      await db.users.bulkAdd([applicatorUser, managerUser]);
      await db.farms.add(farm);
      await db.fields.add(field);
      await db.applicators.add(applicator);
      await db.products.add(product);
    }
  );
}
