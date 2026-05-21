import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  updateApplicator,
  type UpdateApplicatorPatch,
} from "../../application/contractorService";
import type {
  LicenseCategoryCode,
  NoncertifiedRupTrainingType,
} from "../../domain/schemas";
import type { Applicator, ApplicatorCategory } from "../../domain/types";
import {
  getRecentValues,
  recordRecentValue,
} from "../../lib/recentValues";

// Categories surfaced in the dialog. Mirrors the applicatorCategorySchema
// enum and keeps display labels consistent with the create-record stepper.
const CATEGORY_OPTIONS: { value: ApplicatorCategory; label: string }[] = [
  { value: "certified_commercial", label: "Certified Commercial" },
  { value: "certified_noncommercial", label: "Certified Noncommercial" },
  { value: "public_operator", label: "Public Operator" },
  { value: "private", label: "Private" },
  { value: "noncertified", label: "Noncertified" },
  { value: "noncertified_rup", label: "Noncertified (RUP)" },
  { value: "technician", label: "Technician" },
  { value: "trainee", label: "Trainee" },
];

// 2 CSR 70-25.100 + .140 — Missouri license-category catalog grouped by the
// kind of certification an applicator can hold. Commercial / noncommercial /
// public-operator share Cat 1-13 (with 1a/1b, 5b, and 7a/7b/7c sub-codes);
// private applicators use Cat 20-23.
type LicenseCategoryOption = {
  value: LicenseCategoryCode;
  label: string;
};

const COMMERCIAL_LICENSE_CATEGORIES: LicenseCategoryOption[] = [
  { value: "cat_1_agricultural", label: "Cat 1 — Agricultural" },
  { value: "cat_1a_agricultural_plant", label: "Cat 1a — Agricultural Plant" },
  { value: "cat_1b_agricultural_animal", label: "Cat 1b — Agricultural Animal" },
  { value: "cat_2_forest", label: "Cat 2 — Forest" },
  { value: "cat_3_ornamental_turf", label: "Cat 3 — Ornamental & Turf" },
  { value: "cat_4_seed_treatment", label: "Cat 4 — Seed Treatment" },
  { value: "cat_5_aquatic", label: "Cat 5 — Aquatic" },
  { value: "cat_5b_sewer_root", label: "Cat 5b — Sewer Root Control" },
  { value: "cat_6_right_of_way", label: "Cat 6 — Right-of-Way" },
  { value: "cat_7_structural", label: "Cat 7 — Structural" },
  { value: "cat_7a_general_structural", label: "Cat 7a — General Structural" },
  { value: "cat_7b_termite", label: "Cat 7b — Termite" },
  { value: "cat_7c_fumigation", label: "Cat 7c — Fumigation" },
  { value: "cat_8_public_health", label: "Cat 8 — Public Health" },
  { value: "cat_9_regulatory", label: "Cat 9 — Regulatory" },
  {
    value: "cat_10_demonstration_research",
    label: "Cat 10 — Demonstration & Research",
  },
  { value: "cat_11_wood_products", label: "Cat 11 — Wood Products" },
  { value: "cat_12_soil_fumigation", label: "Cat 12 — Soil Fumigation" },
  { value: "cat_13_aerial", label: "Cat 13 — Aerial" },
];

const PRIVATE_LICENSE_CATEGORIES: LicenseCategoryOption[] = [
  { value: "cat_20_general_agricultural", label: "Cat 20 — General Agricultural" },
  { value: "cat_21_soil_fumigation", label: "Cat 21 — Soil Fumigation" },
  {
    value: "cat_22_non_soil_fumigation",
    label: "Cat 22 — Non-Soil Fumigation",
  },
  { value: "cat_23_aerial", label: "Cat 23 — Aerial" },
];

export const LICENSE_CATEGORY_OPTIONS: {
  commercial: LicenseCategoryOption[];
  private: LicenseCategoryOption[];
} = {
  commercial: COMMERCIAL_LICENSE_CATEGORIES,
  private: PRIVATE_LICENSE_CATEGORIES,
};

// Recent-values keys are stable strings (not derived from translatable labels)
// so the localStorage entries survive UI copy changes.
const RECENT_KEYS = {
  company: "contractor.company",
  certificationNumber: "contractor.certificationNumber",
  licenseExpiry: "contractor.licenseExpiry",
  noncertifiedRupTrainingDate: "contractor.noncertifiedRupTrainingDate",
} as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Derives the noncertified-RUP retraining expiry date from training type and
// training date. CORE exam = +3 years; approved training program = +1 year.
// Returns null when either input is missing or the date string is unparseable.
export function deriveRetrainingExpiry(
  trainingType: NoncertifiedRupTrainingType | undefined,
  trainingDate: string | undefined
): Date | null {
  if (!trainingType || !trainingDate) return null;
  // YYYY-MM-DD parse — anchor at UTC midnight so day arithmetic doesn't drift
  // across DST transitions.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trainingDate.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
    return null;
  }
  const yearsAdded = trainingType === "core_exam" ? 3 : 1;
  // Use UTC arithmetic to avoid local-timezone day flips.
  const expiry = new Date(Date.UTC(y + yearsAdded, mo - 1, d));
  if (Number.isNaN(expiry.getTime())) return null;
  return expiry;
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(a: Date, b: Date): number {
  // Anchor both ends at UTC midnight so we count calendar days.
  const aMid = Date.UTC(
    a.getUTCFullYear(),
    a.getUTCMonth(),
    a.getUTCDate()
  );
  const bMid = Date.UTC(
    b.getUTCFullYear(),
    b.getUTCMonth(),
    b.getUTCDate()
  );
  return Math.round((aMid - bMid) / MS_PER_DAY);
}

export type ContractorDetailDialogProps = {
  applicator: Applicator | null;
  onClose: () => void;
  // Optional callback invoked after a successful save. The manager UI uses
  // this to surface a transient "saved" toast.
  onSaved?: (updated: Applicator) => void;
};

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; message: string };

// Modal that lets a manager edit every applicator-level field tracked in the
// system: name, company, certification #, email, phone, default applicator
// category (used as a hint when this applicator drafts a record), license
// expiry date, free-text notes, Missouri license-category codes, and the
// noncertified-RUP retraining cycle. Wired into ContractorManager's clickable
// applicator cards.
export function ContractorDetailDialog({
  applicator,
  onClose,
  onSaved,
}: ContractorDetailDialogProps) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<ApplicatorCategory | "">("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [licenseCategoryCodes, setLicenseCategoryCodes] = useState<
    LicenseCategoryCode[]
  >([]);
  const [trainingType, setTrainingType] = useState<
    NoncertifiedRupTrainingType | ""
  >("");
  const [trainingDate, setTrainingDate] = useState("");
  const [state, setState] = useState<SaveState>({ kind: "idle" });

  // Recent-values lists. Read fresh whenever the dialog opens with a new
  // applicator so a value typed in a previous open shows up immediately.
  const [recentCompany, setRecentCompany] = useState<string[]>([]);
  const [recentCert, setRecentCert] = useState<string[]>([]);
  const [recentLicenseExpiry, setRecentLicenseExpiry] = useState<string[]>([]);
  const [recentTrainingDate, setRecentTrainingDate] = useState<string[]>([]);

  // Hydrate form state when the dialog opens with a new applicator. Resets
  // form errors so a previous failed save doesn't bleed into a new record.
  useEffect(() => {
    if (!applicator) return;
    setName(applicator.applicatorName);
    setCompany(applicator.contractorCompanyName);
    setCertNumber(applicator.certificationNumber ?? "");
    setEmail(applicator.emailAddress ?? "");
    setPhone(applicator.phoneNumber ?? "");
    setCategory(applicator.defaultApplicatorCategory ?? "");
    setLicenseExpiry(applicator.licenseExpiryDate ?? "");
    setNotes(applicator.notes ?? "");
    setLicenseCategoryCodes(applicator.licenseCategoryCodes ?? []);
    setTrainingType(applicator.noncertifiedRupTrainingType ?? "");
    setTrainingDate(applicator.noncertifiedRupTrainingDate ?? "");
    setRecentCompany(getRecentValues(RECENT_KEYS.company));
    setRecentCert(getRecentValues(RECENT_KEYS.certificationNumber));
    setRecentLicenseExpiry(getRecentValues(RECENT_KEYS.licenseExpiry));
    setRecentTrainingDate(
      getRecentValues(RECENT_KEYS.noncertifiedRupTrainingDate)
    );
    setState({ kind: "idle" });
  }, [applicator]);

  const derivedExpiry = useMemo(
    () =>
      deriveRetrainingExpiry(
        trainingType === "" ? undefined : trainingType,
        trainingDate || undefined
      ),
    [trainingType, trainingDate]
  );

  if (!applicator) return null;

  const toggleLicenseCategory = (code: LicenseCategoryCode) => {
    setLicenseCategoryCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSave = async () => {
    setState({ kind: "saving" });
    // Record recent values one more time on save so values that were typed
    // but never blurred (e.g. user typed then immediately clicked Save) also
    // make it into the LRU.
    recordRecentValue(RECENT_KEYS.company, company);
    recordRecentValue(RECENT_KEYS.certificationNumber, certNumber);
    recordRecentValue(RECENT_KEYS.licenseExpiry, licenseExpiry);
    recordRecentValue(RECENT_KEYS.noncertifiedRupTrainingDate, trainingDate);

    const patch: UpdateApplicatorPatch = {
      applicatorName: name,
      contractorCompanyName: company,
      certificationNumber: certNumber,
      emailAddress: email,
      phoneNumber: phone,
      defaultApplicatorCategory: category === "" ? undefined : category,
      licenseExpiryDate: licenseExpiry,
      notes,
      licenseCategoryCodes,
      noncertifiedRupTrainingType:
        trainingType === "" ? undefined : trainingType,
      noncertifiedRupTrainingDate: trainingDate,
    };
    try {
      const updated = await updateApplicator(applicator.id, patch);
      setState({ kind: "idle" });
      onSaved?.(updated);
      onClose();
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  };

  // Derived-expiry banner content. Renders neutral text by default, warning
  // text when the expiry is within 30 days, and an error tone once it lapses.
  const expiryBanner = (() => {
    if (!trainingType || !trainingDate) {
      return {
        text: "Set both to derive expiry.",
        color: "text.secondary" as const,
        testid: "retraining-expiry-info",
      };
    }
    if (!derivedExpiry) {
      return {
        text: "Set both to derive expiry.",
        color: "text.secondary" as const,
        testid: "retraining-expiry-info",
      };
    }
    const today = new Date();
    const days = daysBetween(derivedExpiry, today);
    if (days < 0) {
      return {
        text: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago (${toIsoDate(derivedExpiry)})`,
        color: "error.main" as const,
        testid: "retraining-expiry-warning",
      };
    }
    if (days <= 30) {
      return {
        text: `Expires in ${days} day${days === 1 ? "" : "s"} (${toIsoDate(derivedExpiry)})`,
        color: "warning.main" as const,
        testid: "retraining-expiry-warning",
      };
    }
    return {
      text: `Expires ${toIsoDate(derivedExpiry)}`,
      color: "text.secondary" as const,
      testid: "retraining-expiry-info",
    };
  })();

  return (
    <Dialog
      open={applicator !== null}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="contractor-detail-title"
      data-testid="contractor-detail-dialog"
    >
      <DialogTitle id="contractor-detail-title">
        Edit applicator
        <Typography variant="caption" component="div" color="text.secondary">
          {applicator.applicatorName} — {applicator.contractorCompanyName}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {/* Datalists referenced by `list=` on the text/date inputs below.
            Rendered once at the top of the content so React doesn't tear them
            down across re-renders. */}
        <datalist id="recent-contractor.company">
          {recentCompany.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
        <datalist id="recent-contractor.certificationNumber">
          {recentCert.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
        <datalist id="recent-contractor.licenseExpiry">
          {recentLicenseExpiry.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
        <datalist id="recent-contractor.noncertifiedRupTrainingDate">
          {recentTrainingDate.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Applicator name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            slotProps={{ htmlInput: { "aria-label": "Applicator name" } }}
          />
          <TextField
            label="Contractor company"
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            onBlur={() =>
              recordRecentValue(RECENT_KEYS.company, company)
            }
            slotProps={{
              htmlInput: {
                "aria-label": "Contractor company",
                list: "recent-contractor.company",
              },
            }}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Certification #"
              value={certNumber}
              onChange={(e) => setCertNumber(e.target.value)}
              onBlur={() =>
                recordRecentValue(
                  RECENT_KEYS.certificationNumber,
                  certNumber
                )
              }
              slotProps={{
                htmlInput: {
                  "aria-label": "Certification number",
                  list: "recent-contractor.certificationNumber",
                },
              }}
              fullWidth
            />
            <TextField
              label="License expiry"
              type="date"
              value={licenseExpiry}
              onChange={(e) => setLicenseExpiry(e.target.value)}
              onBlur={() =>
                recordRecentValue(RECENT_KEYS.licenseExpiry, licenseExpiry)
              }
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: {
                  "aria-label": "License expiry date",
                  list: "recent-contractor.licenseExpiry",
                },
              }}
              fullWidth
            />
          </Stack>
          <TextField
            select
            label="Default applicator category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ApplicatorCategory)}
            slotProps={{
              htmlInput: { "aria-label": "Default applicator category" },
            }}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {CATEGORY_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              slotProps={{ htmlInput: { "aria-label": "Email address" } }}
              fullWidth
            />
            <TextField
              label="Phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              slotProps={{ htmlInput: { "aria-label": "Phone number" } }}
              fullWidth
            />
          </Stack>
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            slotProps={{ htmlInput: { "aria-label": "Notes" } }}
            multiline
            minRows={2}
          />

          {/* Section 1 — License categories (2 CSR 70-25.100 + .140). */}
          <FormControl
            component="fieldset"
            data-testid="license-categories-section"
          >
            <FormLabel component="legend">License categories</FormLabel>
            <Box
              component="fieldset"
              data-testid="license-categories-commercial"
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                px: 2,
                py: 1,
                mt: 1,
              }}
            >
              <Box
                component="legend"
                sx={{ px: 1, fontSize: 13, color: "text.secondary" }}
              >
                Commercial / Noncommercial / Public Operator (Cat 1-13)
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 0.5,
                }}
              >
                {LICENSE_CATEGORY_OPTIONS.commercial.map((opt) => {
                  const checked = licenseCategoryCodes.includes(opt.value);
                  return (
                    <FormControlLabel
                      key={opt.value}
                      data-testid={`license-category-${opt.value}`}
                      control={
                        <Checkbox
                          checked={checked}
                          onChange={() => toggleLicenseCategory(opt.value)}
                          slotProps={{ input: { "aria-label": opt.label } }}
                          size="small"
                        />
                      }
                      label={opt.label}
                    />
                  );
                })}
              </Box>
            </Box>
            <Box
              component="fieldset"
              data-testid="license-categories-private"
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                px: 2,
                py: 1,
                mt: 1,
              }}
            >
              <Box
                component="legend"
                sx={{ px: 1, fontSize: 13, color: "text.secondary" }}
              >
                Private applicator (Cat 20-23)
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 0.5,
                }}
              >
                {LICENSE_CATEGORY_OPTIONS.private.map((opt) => {
                  const checked = licenseCategoryCodes.includes(opt.value);
                  return (
                    <FormControlLabel
                      key={opt.value}
                      data-testid={`license-category-${opt.value}`}
                      control={
                        <Checkbox
                          checked={checked}
                          onChange={() => toggleLicenseCategory(opt.value)}
                          slotProps={{ input: { "aria-label": opt.label } }}
                          size="small"
                        />
                      }
                      label={opt.label}
                    />
                  );
                })}
              </Box>
            </Box>
          </FormControl>

          {/* Section 2 — Noncertified RUP retraining (2 CSR 70-25.153(1)). */}
          <FormControl component="fieldset" data-testid="retraining-section">
            <FormLabel component="legend">
              Noncertified RUP retraining
            </FormLabel>
            <RadioGroup
              value={trainingType}
              onChange={(e) =>
                setTrainingType(
                  e.target.value === ""
                    ? ""
                    : (e.target.value as NoncertifiedRupTrainingType)
                )
              }
              data-testid="retraining-type"
            >
              <FormControlLabel
                value=""
                data-testid="retraining-type-none"
                control={<Radio size="small" />}
                label="None / not applicable"
                slotProps={{
                  typography: { variant: "body2" },
                }}
              />
              <FormControlLabel
                value="core_exam"
                data-testid="retraining-type-core_exam"
                control={
                  <Radio
                    size="small"
                    slotProps={{
                      input: {
                        "aria-label": "CORE exam — 3-year cycle",
                      },
                    }}
                  />
                }
                label="CORE exam — 3-year cycle"
                slotProps={{
                  typography: { variant: "body2" },
                }}
              />
              <FormControlLabel
                value="training_program"
                data-testid="retraining-type-training_program"
                control={
                  <Radio
                    size="small"
                    slotProps={{
                      input: {
                        "aria-label":
                          "Approved training program — 1-year cycle",
                      },
                    }}
                  />
                }
                label="Approved training program — 1-year cycle"
                slotProps={{
                  typography: { variant: "body2" },
                }}
              />
            </RadioGroup>
            <TextField
              label="Training date"
              type="date"
              value={trainingDate}
              onChange={(e) => setTrainingDate(e.target.value)}
              onBlur={() =>
                recordRecentValue(
                  RECENT_KEYS.noncertifiedRupTrainingDate,
                  trainingDate
                )
              }
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: {
                  "aria-label": "Noncertified RUP training date",
                  list: "recent-contractor.noncertifiedRupTrainingDate",
                },
              }}
              sx={{ mt: 1 }}
            />
            <Box
              data-testid={expiryBanner.testid}
              sx={{
                mt: 1,
                fontSize: 13,
                color: expiryBanner.color,
              }}
            >
              Derived expiry: {expiryBanner.text}
            </Box>
          </FormControl>

          {state.kind === "error" && (
            <Alert severity="error" data-testid="contractor-detail-error">
              {state.message}
            </Alert>
          )}
          <Box sx={{ fontSize: 11, color: "text.secondary" }}>
            User ID: <code>{applicator.id}</code>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={state.kind === "saving"}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={state.kind === "saving"}
          data-testid="contractor-detail-save"
        >
          {state.kind === "saving" ? "Saving…" : "Save changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
