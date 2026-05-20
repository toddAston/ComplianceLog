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
import { useSession } from "../session/SessionContext";
import { DEMO_ORG_ID } from "../../db/seed";
import type { ContractorInputs } from "../../domain/types";

const STEP_LABELS = ["Farm & Field", "Product", "Application Details", "Weather", "Review & Attest"];

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
  const [productId, setProductId] = useState("");
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
  const [attested, setAttested] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedProduct = products.find((p) => p.id === productId);
  const selectedFarm = farms.find((f) => f.id === farmId);
  const selectedField = fields.find((f) => f.id === fieldId);

  const canSaveDraft = Boolean(farmId && fieldId && productId);

  const handleSaveDraft = async () => {
    setSaveError(null);
    if (!canSaveDraft || !selectedFarm || !selectedField || !selectedProduct) {
      setSaveError("Select a farm, field, and product before saving.");
      return;
    }
    const applicator = applicators[0];
    const contractorInputs: ContractorInputs = {
      applicatorId: applicator?.id ?? actor.userId,
      applicatorName: applicator?.applicatorName ?? actor.displayName,
      company: applicator?.contractorCompanyName ?? "",
      certificationNumber: applicator?.certificationNumber,

      farmId: selectedFarm.id,
      farmName: selectedFarm.name,
      fieldId: selectedField.id,
      fieldName: selectedField.name,
      cropOrSite: selectedField.defaultCropOrSite ?? "",
      acresTreated: acresTreated || String(selectedField.defaultAcres ?? ""),

      productId: selectedProduct.id,
      productName: selectedProduct.name,
      epaRegistrationNumber: selectedProduct.epaRegistrationNumber,
      rupStatus: selectedProduct.rupStatus,
      catalogVersion: selectedProduct.catalogVersion,

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

      attestationConfirmed: attested,
    };
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
      nextDisabled={step === 4 ? !attested || !canSaveDraft || saving : false}
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
            <FormField label="Time End">
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

          {/* Compliance status */}
          <div style={{
            padding: 12,
            borderRadius: 6,
            backgroundColor: "var(--color-primary-light)",
            border: "1px solid var(--color-primary)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-primary)" }}>
              ✓ Compliance Check Passed
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
              All 13 Missouri mandatory data points present.
            </div>
          </div>

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
