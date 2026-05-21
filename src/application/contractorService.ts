import { db } from "../db/fieldlogDb";
import type { Applicator, ApplicatorCategory } from "../domain/types";
import type {
  LicenseCategoryCode,
  NoncertifiedRupTrainingType,
} from "../domain/schemas";

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

const DEFAULT_INVITE_BASE_URL = "https://fieldlog.invite";

function resolveInviteBaseUrl(): string {
  const raw = import.meta.env.VITE_INVITE_BASE_URL?.trim();
  const base = raw && raw.length > 0 ? raw : DEFAULT_INVITE_BASE_URL;
  return base.replace(/\/+$/, "");
}

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
  const inviteLink = `${resolveInviteBaseUrl()}/${inviteToken}`;

  return { applicator, inviteToken, inviteLink };
}

export type UpdateApplicatorPatch = {
  applicatorName?: string;
  contractorCompanyName?: string;
  certificationNumber?: string;
  emailAddress?: string;
  phoneNumber?: string;
  defaultApplicatorCategory?: ApplicatorCategory;
  licenseExpiryDate?: string;
  notes?: string;
  // 2 CSR 70-25.100 + .140 — categories of certification this applicator
  // currently holds. `undefined` = leave as-is; `[]` = explicit clear.
  licenseCategoryCodes?: LicenseCategoryCode[];
  // 2 CSR 70-25.153(1) — noncertified RUP retraining cycle inputs.
  noncertifiedRupTrainingType?: NoncertifiedRupTrainingType;
  noncertifiedRupTrainingDate?: string;
};

// Apply a partial update to an existing applicator row. Empty strings are
// treated as explicit clears (field → undefined); a missing key leaves the
// existing value unchanged. Used by the contractor detail dialog.
export async function updateApplicator(
  applicatorId: string,
  patch: UpdateApplicatorPatch
): Promise<Applicator> {
  const existing = await db.applicators.get(applicatorId);
  if (!existing) {
    throw new Error("Applicator not found.");
  }

  // Required-name guard: editing the name to empty would render the row
  // unreadable in the list and break compliance attribution.
  if (patch.applicatorName !== undefined && patch.applicatorName.trim() === "") {
    throw new Error("Applicator name cannot be empty.");
  }
  if (
    patch.contractorCompanyName !== undefined &&
    patch.contractorCompanyName.trim() === ""
  ) {
    throw new Error("Contractor company cannot be empty.");
  }

  const trim = (v: string | undefined): string | undefined => {
    if (v === undefined) return undefined;
    const t = v.trim();
    return t === "" ? undefined : t;
  };

  const next: Applicator = {
    ...existing,
    ...(patch.applicatorName !== undefined && {
      applicatorName: patch.applicatorName.trim(),
    }),
    ...(patch.contractorCompanyName !== undefined && {
      contractorCompanyName: patch.contractorCompanyName.trim(),
    }),
    ...(patch.certificationNumber !== undefined && {
      certificationNumber: trim(patch.certificationNumber),
    }),
    ...(patch.emailAddress !== undefined && {
      emailAddress: trim(patch.emailAddress),
    }),
    ...(patch.phoneNumber !== undefined && {
      phoneNumber: trim(patch.phoneNumber),
    }),
    ...(patch.defaultApplicatorCategory !== undefined && {
      defaultApplicatorCategory: patch.defaultApplicatorCategory,
    }),
    ...(patch.licenseExpiryDate !== undefined && {
      licenseExpiryDate: trim(patch.licenseExpiryDate),
    }),
    ...(patch.notes !== undefined && {
      notes: trim(patch.notes),
    }),
    ...(patch.licenseCategoryCodes !== undefined && {
      licenseCategoryCodes:
        patch.licenseCategoryCodes.length === 0
          ? undefined
          : patch.licenseCategoryCodes,
    }),
    ...(patch.noncertifiedRupTrainingType !== undefined && {
      noncertifiedRupTrainingType: patch.noncertifiedRupTrainingType,
    }),
    ...(patch.noncertifiedRupTrainingDate !== undefined && {
      noncertifiedRupTrainingDate: trim(patch.noncertifiedRupTrainingDate),
    }),
  };

  await db.applicators.put(next);
  return next;
}
