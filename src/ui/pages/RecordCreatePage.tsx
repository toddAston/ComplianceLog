import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { StepperLayout } from "../layout/StepperLayout";
import {
  useAllApplicators,
  useAllFarms,
  useAllFields,
  useAllProducts,
} from "../../db/queries";
import { createDraftApplicationRecord } from "../../application/applicationRecordService";
import { runAllComplianceChecks } from "../../application/complianceRules";
import { ComplianceChecklistPanel } from "../application-record/ComplianceChecklistPanel";
import { useSession } from "../session/SessionContext";
import { DEMO_ORG_ID } from "../../db/seed";
import type {
  ApplicationRecord,
  ApplicatorCategory,
  ContractorInputs,
} from "../../domain/types";

const STEP_LABELS = ["Farm & Field", "Product", "Application Details", "Weather", "Review & Attest"];

const APPLICATOR_CATEGORY_OPTIONS: { value: ApplicatorCategory; label: string }[] = [
  { value: "certified_commercial", label: "Certified Commercial" },
  { value: "certified_noncommercial", label: "Certified Noncommercial" },
  { value: "public_operator", label: "Public Operator" },
  { value: "private", label: "Private" },
  { value: "noncertified", label: "Noncertified" },
  { value: "noncertified_rup", label: "Noncertified (RUP)" },
  { value: "technician", label: "Technician" },
  { value: "trainee", label: "Trainee" },
];

export function RecordCreatePage() {
  const navigate = useNavigate();
  const { actor } = useSession();
  const [step, setStep] = useState(0);
  const farms = useAllFarms();
  const fields = useAllFields();
  const products = useAllProducts();
  const applicators = useAllApplicators();

  // Form state
  const [farmId, setFarmId] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [applicatorCategory, setApplicatorCategory] =
    useState<ApplicatorCategory>("certified_commercial");
  const [productId, setProductId] = useState("");
  const [noSln, setNoSln] = useState(false);
  const [dateApplied, setDateApplied] = useState(new Date().toISOString().split("T")[0]);
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [pestTarget, setPestTarget] = useState("");
  const [ratePerAcre, setRatePerAcre] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [acresTreated, setAcresTreated] = useState("");
  const [weatherTemp, setWeatherTemp] = useState("");
  const [weatherWind, setWeatherWind] = useState("");
  const [weatherWindDir, setWeatherWindDir] = useState("");
  const [gpsCoords, setGpsCoords] = useState<{ lat: string; lng: string } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsCapturing, setGpsCapturing] = useState(false);
  const [requesterName, setRequesterName] = useState("");
  const [requesterAddress, setRequesterAddress] = useState("");
  const [labelReviewed, setLabelReviewed] = useState(false);
  const [attested, setAttested] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedProduct = products.find((p) => p.id === productId);
  const selectedFarm = farms.find((f) => f.id === farmId);
  const selectedField = fields.find((f) => f.id === fieldId);

  const canSaveDraft = Boolean(farmId && fieldId && productId);

  // Single source for the record's contractor inputs, tolerant of unselected
  // farm/field/product so the Review step can preview compliance live.
  const buildContractorInputs = (): ContractorInputs => {
    const applicator = applicators[0];
    const hasWeather = Boolean(weatherTemp || weatherWind);
    const todayYmd = new Date().toISOString().split("T")[0];
    const epaReg = selectedProduct?.epaRegistrationNumber ?? "";
    return {
      applicatorId: applicator?.id ?? actor.userId,
      applicatorName: applicator?.applicatorName ?? actor.displayName,
      company: applicator?.contractorCompanyName ?? "",
      certificationNumber: applicator?.certificationNumber,

      farmId: selectedFarm?.id ?? "",
      farmName: selectedFarm?.name ?? "",
      fieldId: selectedField?.id ?? "",
      fieldName: selectedField?.name ?? "",
      cropOrSite: selectedField?.defaultCropOrSite ?? "",
      acresTreated: acresTreated || String(selectedField?.defaultAcres ?? ""),

      productId: selectedProduct?.id,
      productName: selectedProduct?.name ?? "",
      epaRegistrationNumber: epaReg,
      rupStatus: selectedProduct?.rupStatus ?? "unknown",
      catalogVersion: selectedProduct?.catalogVersion,

      applicationDate: dateApplied,
      startTime: timeStart,
      endTime: timeEnd || undefined,
      applicationMethod: "",
      rateApplied: ratePerAcre,
      totalAmountApplied: totalAmount,
      targetPest: pestTarget || undefined,

      temperature: weatherTemp,
      windSpeed: weatherWind,
      windDirection: weatherWindDir,

      // Matrix #46/#47/#48: weather provenance — when the operator entered any
      // weather value manually, stamp source+timestamp+location so the audit
      // trail records *how* the reading was captured, not just the values.
      weatherCaptureSource: hasWeather ? "manual" : undefined,
      weatherCaptureTimestamp: hasWeather ? new Date().toISOString() : undefined,
      weatherCaptureLocation:
        hasWeather && selectedFarm && selectedField
          ? `${selectedFarm.name} — ${selectedField.name}`
          : undefined,

      // Matrix #49/#50: GPS coordinates captured on demand via
      // navigator.geolocation. Coordinates are only set when the operator
      // explicitly clicked "Use my location" on Step 4.
      gpsLatitude: gpsCoords?.lat,
      gpsLongitude: gpsCoords?.lng,

      // Matrix #19/#20 + #21/#22. Requester comes from operator input; site
      // description is derived from the selected farm/field when an explicit
      // address isn't captured, satisfying the "address OR brief description"
      // requirement of 2 CSR 70-25.120(E).
      requesterName: requesterName || undefined,
      requesterAddress: requesterAddress || undefined,
      siteDescription:
        selectedFarm && selectedField
          ? `${selectedFarm.name} — ${selectedField.name}`
          : undefined,

      // Matrix #1: applicator category is explicitly chosen by the operator on
      // Step 1 — no longer inferred from certificationNumber. Matrix #33:
      // empty string means "operator confirmed no SLN registration applies";
      // undefined means "not yet answered".
      applicatorCategory,
      slnNumber: noSln ? "" : undefined,

      // Matrix #51-#58: label-review acks. A single master checkbox on the
      // Review step flips all 8 to true and stamps a demo productLabelRef +
      // labelVersionOrDate so the engine's LABEL_VERIFICATION_REQUIRED rules
      // can clear when the operator has actually consulted the label.
      productLabelRef: labelReviewed
        ? `https://example.epa.gov/labels/${epaReg}`
        : undefined,
      labelVersionOrDate: labelReviewed ? `Demo: ${todayYmd}` : undefined,
      labelConsistencyReviewed: labelReviewed || undefined,
      labelCropSiteReviewed: labelReviewed || undefined,
      labelTargetPestReviewed: labelReviewed || undefined,
      labelRateReviewed: labelReviewed || undefined,
      labelTimingMethodReviewed: labelReviewed || undefined,
      labelPpeReviewed: labelReviewed || undefined,
      labelReiPhiReviewed: labelReviewed || undefined,
      labelDriftBufferReviewed: labelReviewed || undefined,

      attestationConfirmed: attested,
    };
  };

  // Live compliance preview for the Review step — derived from entered data,
  // never hardcoded. Mirrors the read-side gate in RecordDetailDialog.
  const reviewInputs = buildContractorInputs();
  const requiredForReview: { label: string; filled: boolean }[] = [
    { label: "Farm", filled: Boolean(reviewInputs.farmId) },
    { label: "Field", filled: Boolean(reviewInputs.fieldId) },
    { label: "Product", filled: Boolean(reviewInputs.productId) },
    { label: "Date Applied", filled: Boolean(reviewInputs.applicationDate) },
    { label: "Target Pest", filled: Boolean(reviewInputs.targetPest?.trim()) },
    { label: "Rate per Acre", filled: Boolean(reviewInputs.rateApplied.trim()) },
    { label: "Total Amount", filled: Boolean(reviewInputs.totalAmountApplied.trim()) },
    { label: "Acres Treated", filled: Boolean(reviewInputs.acresTreated.trim()) },
    { label: "Requester Name", filled: Boolean(reviewInputs.requesterName?.trim()) },
    { label: "Requester Address", filled: Boolean(reviewInputs.requesterAddress?.trim()) },
  ];
  const missingRequired = requiredForReview.filter((f) => !f.filled).map((f) => f.label);
  const nowIso = new Date().toISOString();
  const previewRecord: ApplicationRecord = {
    id: "preview",
    organizationId: DEMO_ORG_ID,
    workflowStatus: "draft",
    syncStatus: "local_only",
    contractorInputs: reviewInputs,
    managerInputs: { reviewStatus: "not_reviewed" },
    system: { createdAt: nowIso, createdOffline: false, lastUpdatedAt: nowIso },
    complianceReviewRequired: false,
  };
  const allOutcomes = runAllComplianceChecks(previewRecord);
  const failingChecks = allOutcomes.filter((o) => o.status === "fail");
  // Matrix label-verification + NEEDS_REVIEW items surface as `unknown` and
  // must not be silently swallowed by the "Passed" banner — the operator has
  // to either tick the label-review master toggle or acknowledge the review
  // item explicitly before the gate flips green.
  const reviewRequiredChecks = allOutcomes.filter(
    (o) =>
      o.status === "unknown" &&
      (o.resultCode === "LABEL_VERIFICATION_REQUIRED" ||
        o.resultCode === "NEEDS_REVIEW")
  );
  const compliancePassed =
    missingRequired.length === 0 &&
    failingChecks.length === 0 &&
    reviewRequiredChecks.length === 0;

  const handleCaptureLocation = () => {
    setGpsError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsError("Geolocation is not available on this device.");
      return;
    }
    setGpsCapturing(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({
          lat: String(pos.coords.latitude),
          lng: String(pos.coords.longitude),
        });
        setGpsCapturing(false);
      },
      (err) => {
        setGpsError(err.message || "Unable to capture location.");
        setGpsCapturing(false);
      }
    );
  };

  const handleSaveDraft = async () => {
    setSaveError(null);
    if (!canSaveDraft || !selectedFarm || !selectedField || !selectedProduct) {
      setSaveError("Select a farm, field, and product before saving.");
      return;
    }
    const contractorInputs = buildContractorInputs();
    setSaving(true);
    try {
      await createDraftApplicationRecord(
        { organizationId: DEMO_ORG_ID, contractorInputs },
        actor
      );
      navigate("/records");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
    else handleSaveDraft();
  };

  // Step 3 gate: End Time is required before advancing.
  const nextDisabled = (() => {
    if (step === 2 && !timeEnd) return true;
    if (step === 4) return !attested || !canSaveDraft || saving;
    return false;
  })();

  return (
    <>
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 12,
          padding: "8px 0 0",
        }}
      >
        {saveError && (
          <span
            role="alert"
            style={{ fontSize: 12, color: "var(--color-error)" }}
          >
            {saveError}
          </span>
        )}
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={!canSaveDraft || saving}
          style={{
            height: 36,
            padding: "0 14px",
            backgroundColor:
              !canSaveDraft || saving ? "#c8c8c8" : "var(--color-primary)",
            color: !canSaveDraft || saving ? "#646464" : "#ffffff",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            cursor: !canSaveDraft || saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save Draft"}
        </button>
      </div>
    <StepperLayout
      currentStep={step}
      totalSteps={5}
      stepLabels={STEP_LABELS}
      onBack={() => setStep(step - 1)}
      onNext={handleNext}
      nextLabel={step === 4 ? "Save Draft" : "Next"}
      nextDisabled={nextDisabled}
    >
      {/* Step 1: Farm & Field */}
      {step === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FormField label="Farm" required>
            <select value={farmId} onChange={(e) => setFarmId(e.target.value)} style={selectStyle}>
              <option value="">Select a farm...</option>
              {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </FormField>
          <FormField label="Field" required>
            <select value={fieldId} onChange={(e) => setFieldId(e.target.value)} style={selectStyle}>
              <option value="">Select a field...</option>
              {fields.filter((f) => !farmId || f.farmId === farmId).map((f) => (
                <option key={f.id} value={f.id}>{f.name} {f.defaultAcres ? `(${f.defaultAcres} ac)` : ""}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Applicator Category" required>
            <select
              value={applicatorCategory}
              onChange={(e) =>
                setApplicatorCategory(e.target.value as ApplicatorCategory)
              }
              style={selectStyle}
            >
              {APPLICATOR_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      )}

      {/* Step 2: Product */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FormField label="Product" required>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} style={selectStyle}>
              <option value="">Search or select product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — EPA {p.epaRegistrationNumber}</option>
              ))}
            </select>
          </FormField>
          {selectedProduct && (
            <div style={{ backgroundColor: "var(--color-primary-light)", borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-primary)" }}>{selectedProduct.name}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
                EPA Reg #: {selectedProduct.epaRegistrationNumber}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                RUP: {selectedProduct.rupStatus === "yes" ? "⚠️ Restricted Use" : "General Use"}
              </div>
            </div>
          )}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={noSln}
              onChange={(e) => setNoSln(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "var(--color-primary)", marginTop: 2 }}
            />
            <div style={{ fontSize: 13, color: "var(--color-text)" }}>
              No Special Local Need (SLN) registration applies.
            </div>
          </label>
        </div>
      )}

      {/* Step 3: Application Details */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FormField label="Date Applied" required>
            <input type="date" value={dateApplied} onChange={(e) => setDateApplied(e.target.value)} style={inputStyle} />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <FormField label="Time Start">
              <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} style={inputStyle} />
            </FormField>
            <FormField label="Time End" required>
              <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} style={inputStyle} />
            </FormField>
          </div>
          <FormField label="Target Pest" required>
            <input type="text" value={pestTarget} onChange={(e) => setPestTarget(e.target.value)} placeholder="e.g., Broadleaf weeds" style={inputStyle} />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <FormField label="Rate per Acre" required>
              <input type="number" value={ratePerAcre} onChange={(e) => setRatePerAcre(e.target.value)} placeholder="oz/acre" style={inputStyle} />
            </FormField>
            <FormField label="Total Amount" required>
              <input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="Total oz" style={inputStyle} />
            </FormField>
          </div>
          <FormField label="Acres Treated" required>
            <input type="number" value={acresTreated} onChange={(e) => setAcresTreated(e.target.value)} placeholder="e.g., 40" style={inputStyle} />
          </FormField>
          <FormField label="Requester Name" required>
            <input
              type="text"
              value={requesterName}
              onChange={(e) => setRequesterName(e.target.value)}
              placeholder="Person/company requesting the application"
              style={inputStyle}
            />
          </FormField>
          <FormField label="Requester Address" required>
            <input
              type="text"
              value={requesterAddress}
              onChange={(e) => setRequesterAddress(e.target.value)}
              placeholder="Street, City, State"
              style={inputStyle}
            />
          </FormField>
        </div>
      )}

      {/* Step 4: Weather */}
      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{
            padding: 12,
            backgroundColor: "rgba(245,158,11,0.1)",
            borderRadius: 6,
            border: "1px solid rgba(245,158,11,0.3)",
            fontSize: 12,
            color: "#92400e",
          }}>
            💡 Weather data can be auto-fetched from NWS when online. Enter manually if offline.
          </div>
          <FormField label="Temperature (°F)">
            <input type="number" value={weatherTemp} onChange={(e) => setWeatherTemp(e.target.value)} placeholder="e.g., 72" style={inputStyle} />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <FormField label="Wind Speed (mph)">
              <input type="number" value={weatherWind} onChange={(e) => setWeatherWind(e.target.value)} placeholder="e.g., 8" style={inputStyle} />
            </FormField>
            <FormField label="Wind Direction">
              <select value={weatherWindDir} onChange={(e) => setWeatherWindDir(e.target.value)} style={selectStyle}>
                <option value="">Select...</option>
                {["N", "NE", "E", "SE", "S", "SW", "W", "NW"].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </FormField>
          </div>
          {Number(weatherWind) > 10 && (
            <div style={{
              padding: 12,
              backgroundColor: "rgba(239,68,68,0.1)",
              borderRadius: 6,
              border: "1px solid rgba(239,68,68,0.3)",
              fontSize: 12,
              color: "#991b1b",
            }}>
              ⚠️ Wind speed exceeds 10 mph — check EPA label restrictions for this product.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              onClick={handleCaptureLocation}
              disabled={gpsCapturing}
              data-testid="gps-capture-button"
              style={{
                alignSelf: "flex-start",
                height: 36,
                padding: "0 14px",
                backgroundColor: gpsCapturing
                  ? "#c8c8c8"
                  : "var(--color-primary)",
                color: gpsCapturing ? "#646464" : "#ffffff",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: gpsCapturing ? "not-allowed" : "pointer",
              }}
            >
              {gpsCapturing ? "Capturing…" : "📍 Use my location"}
            </button>
            {gpsCoords && (
              <div
                data-testid="gps-coords-display"
                style={{ fontSize: 12, color: "var(--color-text-secondary)" }}
              >
                Lat {gpsCoords.lat}, Lng {gpsCoords.lng}
              </div>
            )}
            {gpsError && (
              <div
                data-testid="gps-error"
                style={{ fontSize: 12, color: "var(--color-error)" }}
              >
                {gpsError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 5: Review & Attest */}
      {step === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, padding: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Application Summary</h3>
            <DetailRow label="Farm" value={farms.find((f) => f.id === farmId)?.name || "—"} />
            <DetailRow label="Field" value={fields.find((f) => f.id === fieldId)?.name || "—"} />
            <DetailRow label="Product" value={selectedProduct?.name || "—"} />
            <DetailRow label="Date" value={dateApplied || "—"} />
            <DetailRow label="Target Pest" value={pestTarget || "—"} />
            <DetailRow label="Rate" value={ratePerAcre ? `${ratePerAcre} oz/acre` : "—"} />
            <DetailRow label="Total Amount" value={totalAmount ? `${totalAmount} oz` : "—"} />
            <DetailRow label="Acres Treated" value={acresTreated || "—"} />
            <DetailRow label="Temperature" value={weatherTemp ? `${weatherTemp}°F` : "—"} />
            <DetailRow label="Wind" value={weatherWind ? `${weatherWind} mph ${weatherWindDir}` : "—"} />
          </div>

          {/* Label-review master toggle — flips all 8 Matrix #51-#58 acks plus
              the productLabelRef/labelVersionOrDate evidence pointers so the
              LABEL_VERIFICATION_REQUIRED bucket can clear. */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              cursor: "pointer",
              padding: 12,
              borderRadius: 6,
              border: "1px solid var(--color-border)",
            }}
          >
            <input
              type="checkbox"
              checked={labelReviewed}
              onChange={(e) => setLabelReviewed(e.target.checked)}
              data-testid="label-reviewed-toggle"
              style={{ width: 20, height: 20, accentColor: "var(--color-primary)", marginTop: 2 }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                I have reviewed the product label
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
                Confirms label sections (crop/site, target pest, rate, timing &amp; method, PPE, REI/PHI, drift &amp; buffer) match this application.
              </div>
            </div>
          </label>

          {/* Compliance panel — grouped by matrix result code, computed from
              entered data. Surfaces form-level "you haven't filled this in yet"
              nudges alongside the engine's failing rules and review-required
              label items, each with its source citation. */}
          <div
            data-testid="compliance-status-banner"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: compliancePassed ? "var(--color-primary, #166534)" : "#991b1b",
            }}
          >
            {(() => {
              if (compliancePassed) return "✓ Compliance Check Passed";
              if (failingChecks.length === 0 && missingRequired.length === 0) {
                const n = reviewRequiredChecks.length;
                return `${n} item${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} review`;
              }
              const issues = missingRequired.length + failingChecks.length;
              return `✗ Compliance Check Failed — ${issues} issue${issues === 1 ? "" : "s"}`;
            })()}
          </div>
          <ComplianceChecklistPanel
            outcomes={allOutcomes}
            missingFormFields={missingRequired.map(
              (label) => `Missing required field: ${label}`
            )}
          />

          {/* Attestation */}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", padding: 12, borderRadius: 6, border: "1px solid var(--color-border)" }}>
            <input
              type="checkbox"
              checked={attested}
              onChange={(e) => setAttested(e.target.checked)}
              style={{ width: 20, height: 20, accentColor: "var(--color-primary)", marginTop: 2 }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>I attest this record is accurate</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
                By checking this box, I certify that the information above is true and complete to the best of my knowledge.
              </div>
            </div>
          </label>
        </div>
      )}
    </StepperLayout>
    </>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text)", marginBottom: 4 }}>
        {label} {required && <span style={{ color: "var(--color-error)" }}>*</span>}
      </div>
      {children}
    </label>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, padding: "8px 0", borderBottom: "1px solid #e8e8e8" }}>
      <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{label}</span>
      <span style={{ fontSize: 14, color: "var(--color-text)" }}>{value}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  padding: "0 12px",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  fontSize: 14,
  backgroundColor: "var(--color-background)",
  color: "var(--color-text)",
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none" as const,
  backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23646464" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>')`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center",
  backgroundSize: "20px",
  paddingRight: 32,
  cursor: "pointer",
};
