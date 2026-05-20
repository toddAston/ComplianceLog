import { db } from "../db/fieldlogDb";
import type { Applicator } from "../domain/types";

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export type InviteContractorInput = {
  organizationId: string;
  applicatorName: string;
  contractorCompanyName: string;
  certificationNumber?: string;
};

export type InviteResult = {
  applicator: Applicator;
  inviteToken: string;
  inviteLink: string;
};

export async function inviteContractor(
  input: InviteContractorInput
): Promise<InviteResult> {
  const trimmedName = input.applicatorName.trim();
  const trimmedCompany = input.contractorCompanyName.trim();

  if (!input.organizationId) {
    throw new Error("organizationId is required.");
  }
  if (!trimmedName) {
    throw new Error("Applicator name is required.");
  }
  if (!trimmedCompany) {
    throw new Error("Contractor company is required.");
  }

  const existing = await db.applicators
    .where("organizationId")
    .equals(input.organizationId)
    .toArray();
  const duplicate = existing.find(
    (a) =>
      a.applicatorName.trim().toLowerCase() === trimmedName.toLowerCase() &&
      a.contractorCompanyName.trim().toLowerCase() ===
        trimmedCompany.toLowerCase()
  );
  if (duplicate) {
    throw new Error(
      `An applicator named "${trimmedName}" at "${trimmedCompany}" is already invited.`
    );
  }

  const cert = input.certificationNumber?.trim();

  const applicator: Applicator = {
    id: id(),
    organizationId: input.organizationId,
    applicatorName: trimmedName,
    contractorCompanyName: trimmedCompany,
    certificationNumber: cert || undefined,
    createdAt: now(),
  };

  await db.applicators.add(applicator);

  const inviteToken = id();
  const inviteLink = `https://fieldlog.invite/${inviteToken}`;

  return { applicator, inviteToken, inviteLink };
}
