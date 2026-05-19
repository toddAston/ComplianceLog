import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useAllApplicators,
  useAllFarms,
  useAllFields,
  useAllOrganizations,
  useAllProducts,
} from "../../db/queries";
import { createDraftApplicationRecord } from "../../application/applicationRecordService";
import type { ContractorInputs } from "../../domain/types";
import { DEMO_APPLICATOR_ACTOR } from "../demoSession";

const optionalString = z
  .string()
  .optional()
  .or(z.literal(""));

const draftFormSchema = z.object({
  organizationId: z.string().min(1, "Organization is required"),
  applicatorId: z.string().min(1, "Applicator is required"),
  farmId: z.string().min(1, "Farm is required"),
  fieldId: z.string().min(1, "Field is required"),
  productId: z.string().min(1, "Product is required"),

  cropOrSite: z.string().min(1, "Crop or site is required"),
  acresTreated: z.string().min(1, "Acres treated is required"),

  applicationDate: z.string().min(1, "Application date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: optionalString,
  applicationMethod: z.string().min(1, "Application method is required"),
  rateApplied: z.string().min(1, "Rate is required"),
  totalAmountApplied: z.string().min(1, "Total amount is required"),
  targetPest: optionalString,
  phi: optionalString,

  temperature: optionalString,
  windSpeed: optionalString,
  windDirection: optionalString,
  weatherNotes: optionalString,

  attestationConfirmed: z.boolean(),
});

type DraftFormValues = z.infer<typeof draftFormSchema>;

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.875rem",
  marginTop: "0.75rem",
  marginBottom: "0.25rem",
  color: "#333",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.4rem 0.5rem",
  fontSize: "1rem",
  boxSizing: "border-box",
};

const errorStyle: React.CSSProperties = {
  color: "#b00020",
  fontSize: "0.8rem",
  marginTop: "0.15rem",
};

export function DraftApplicationRecordForm() {
  const organizations = useAllOrganizations();
  const farms = useAllFarms();
  const fields = useAllFields();
  const applicators = useAllApplicators();
  const products = useAllProducts();

  const [submitState, setSubmitState] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved"; recordId: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<DraftFormValues>({
    resolver: zodResolver(draftFormSchema),
    defaultValues: {
      organizationId: "",
      applicatorId: "",
      farmId: "",
      fieldId: "",
      productId: "",
      cropOrSite: "",
      acresTreated: "",
      applicationDate: "",
      startTime: "",
      endTime: "",
      applicationMethod: "",
      rateApplied: "",
      totalAmountApplied: "",
      targetPest: "",
      phi: "",
      temperature: "",
      windSpeed: "",
      windDirection: "",
      weatherNotes: "",
      attestationConfirmed: false,
    },
  });

  const selectedFarmId = watch("farmId");
  const fieldsForFarm = selectedFarmId
    ? fields.filter((f) => f.farmId === selectedFarmId)
    : fields;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitState({ kind: "saving" });

    const applicator = applicators.find((a) => a.id === values.applicatorId);
    const farm = farms.find((f) => f.id === values.farmId);
    const field = fields.find((f) => f.id === values.fieldId);
    const product = products.find((p) => p.id === values.productId);

    if (!applicator || !farm || !field || !product) {
      setSubmitState({
        kind: "error",
        message:
          "One of the selected reference records is no longer available. Reload and try again.",
      });
      return;
    }

    const contractorInputs: ContractorInputs = {
      applicatorId: applicator.id,
      applicatorName: applicator.applicatorName,
      company: applicator.contractorCompanyName,
      certificationNumber: applicator.certificationNumber,

      farmId: farm.id,
      farmName: farm.name,
      fieldId: field.id,
      fieldName: field.name,
      cropOrSite: values.cropOrSite,
      acresTreated: values.acresTreated,

      productId: product.id,
      productName: product.name,
      epaRegistrationNumber: product.epaRegistrationNumber,
      rupStatus: product.rupStatus,
      catalogVersion: product.catalogVersion,

      applicationDate: values.applicationDate,
      startTime: values.startTime,
      endTime: values.endTime || undefined,
      applicationMethod: values.applicationMethod,
      rateApplied: values.rateApplied,
      totalAmountApplied: values.totalAmountApplied,
      targetPest: values.targetPest || undefined,
      phi: values.phi || undefined,

      temperature: values.temperature || "",
      windSpeed: values.windSpeed || "",
      windDirection: values.windDirection || "",
      weatherNotes: values.weatherNotes || undefined,

      attestationConfirmed: values.attestationConfirmed,
    };

    try {
      const draft = await createDraftApplicationRecord(
        {
          organizationId: values.organizationId,
          contractorInputs,
        },
        DEMO_APPLICATOR_ACTOR
      );
      setSubmitState({ kind: "saved", recordId: draft.id });
      reset();
    } catch (err) {
      setSubmitState({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  });

  return (
    <form onSubmit={onSubmit} style={{ display: "block" }}>
      <fieldset
        style={{
          border: "1px solid #ddd",
          padding: "0.75rem 1rem 1rem",
          marginBottom: "1rem",
        }}
      >
        <legend style={{ padding: "0 0.4rem" }}>Who & where</legend>

        <label htmlFor="organizationId" style={labelStyle}>
          Organization
        </label>
        <select
          id="organizationId"
          style={inputStyle}
          {...register("organizationId")}
        >
          <option value="">— select —</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        {errors.organizationId && (
          <div style={errorStyle}>{errors.organizationId.message}</div>
        )}

        <label htmlFor="applicatorId" style={labelStyle}>
          Applicator
        </label>
        <select
          id="applicatorId"
          style={inputStyle}
          {...register("applicatorId")}
        >
          <option value="">— select —</option>
          {applicators.map((a) => (
            <option key={a.id} value={a.id}>
              {a.applicatorName} — {a.contractorCompanyName}
            </option>
          ))}
        </select>
        {errors.applicatorId && (
          <div style={errorStyle}>{errors.applicatorId.message}</div>
        )}

        <label htmlFor="farmId" style={labelStyle}>
          Farm
        </label>
        <select id="farmId" style={inputStyle} {...register("farmId")}>
          <option value="">— select —</option>
          {farms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        {errors.farmId && <div style={errorStyle}>{errors.farmId.message}</div>}

        <label htmlFor="fieldId" style={labelStyle}>
          Field
        </label>
        <select id="fieldId" style={inputStyle} {...register("fieldId")}>
          <option value="">— select —</option>
          {fieldsForFarm.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        {errors.fieldId && (
          <div style={errorStyle}>{errors.fieldId.message}</div>
        )}

        <label htmlFor="cropOrSite" style={labelStyle}>
          Crop or site
        </label>
        <input
          id="cropOrSite"
          type="text"
          style={inputStyle}
          {...register("cropOrSite")}
        />
        {errors.cropOrSite && (
          <div style={errorStyle}>{errors.cropOrSite.message}</div>
        )}

        <label htmlFor="acresTreated" style={labelStyle}>
          Acres treated
        </label>
        <input
          id="acresTreated"
          type="text"
          inputMode="decimal"
          style={inputStyle}
          {...register("acresTreated")}
        />
        {errors.acresTreated && (
          <div style={errorStyle}>{errors.acresTreated.message}</div>
        )}
      </fieldset>

      <fieldset
        style={{
          border: "1px solid #ddd",
          padding: "0.75rem 1rem 1rem",
          marginBottom: "1rem",
        }}
      >
        <legend style={{ padding: "0 0.4rem" }}>Product</legend>

        <label htmlFor="productId" style={labelStyle}>
          Product
        </label>
        <select id="productId" style={inputStyle} {...register("productId")}>
          <option value="">— select —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — EPA {p.epaRegistrationNumber} — RUP: {p.rupStatus}
            </option>
          ))}
        </select>
        {errors.productId && (
          <div style={errorStyle}>{errors.productId.message}</div>
        )}
        <p style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.4rem" }}>
          RUP status is captured as a fact at submit time. FieldLog does not
          decide whether you may legally apply a product.
        </p>
      </fieldset>

      <fieldset
        style={{
          border: "1px solid #ddd",
          padding: "0.75rem 1rem 1rem",
          marginBottom: "1rem",
        }}
      >
        <legend style={{ padding: "0 0.4rem" }}>Application details</legend>

        <label htmlFor="applicationDate" style={labelStyle}>
          Application date
        </label>
        <input
          id="applicationDate"
          type="date"
          style={inputStyle}
          {...register("applicationDate")}
        />
        {errors.applicationDate && (
          <div style={errorStyle}>{errors.applicationDate.message}</div>
        )}

        <label htmlFor="startTime" style={labelStyle}>
          Start time
        </label>
        <input
          id="startTime"
          type="time"
          style={inputStyle}
          {...register("startTime")}
        />
        {errors.startTime && (
          <div style={errorStyle}>{errors.startTime.message}</div>
        )}

        <label htmlFor="endTime" style={labelStyle}>
          End time (optional)
        </label>
        <input
          id="endTime"
          type="time"
          style={inputStyle}
          {...register("endTime")}
        />

        <label htmlFor="applicationMethod" style={labelStyle}>
          Application method
        </label>
        <input
          id="applicationMethod"
          type="text"
          style={inputStyle}
          placeholder="e.g. Ground broadcast"
          {...register("applicationMethod")}
        />
        {errors.applicationMethod && (
          <div style={errorStyle}>{errors.applicationMethod.message}</div>
        )}

        <label htmlFor="rateApplied" style={labelStyle}>
          Rate applied
        </label>
        <input
          id="rateApplied"
          type="text"
          style={inputStyle}
          placeholder="e.g. 1 qt/ac"
          {...register("rateApplied")}
        />
        {errors.rateApplied && (
          <div style={errorStyle}>{errors.rateApplied.message}</div>
        )}

        <label htmlFor="totalAmountApplied" style={labelStyle}>
          Total amount applied
        </label>
        <input
          id="totalAmountApplied"
          type="text"
          style={inputStyle}
          placeholder="e.g. 10 gal"
          {...register("totalAmountApplied")}
        />
        {errors.totalAmountApplied && (
          <div style={errorStyle}>{errors.totalAmountApplied.message}</div>
        )}

        <label htmlFor="targetPest" style={labelStyle}>
          Target pest (optional)
        </label>
        <input
          id="targetPest"
          type="text"
          style={inputStyle}
          {...register("targetPest")}
        />

        <label htmlFor="phi" style={labelStyle}>
          PHI (optional)
        </label>
        <input id="phi" type="text" style={inputStyle} {...register("phi")} />
      </fieldset>

      <fieldset
        style={{
          border: "1px solid #ddd",
          padding: "0.75rem 1rem 1rem",
          marginBottom: "1rem",
        }}
      >
        <legend style={{ padding: "0 0.4rem" }}>Conditions</legend>

        <label htmlFor="temperature" style={labelStyle}>
          Temperature
        </label>
        <input
          id="temperature"
          type="text"
          style={inputStyle}
          placeholder="e.g. 72F"
          {...register("temperature")}
        />
        {errors.temperature && (
          <div style={errorStyle}>{errors.temperature.message}</div>
        )}

        <label htmlFor="windSpeed" style={labelStyle}>
          Wind speed
        </label>
        <input
          id="windSpeed"
          type="text"
          style={inputStyle}
          placeholder="e.g. 5 mph"
          {...register("windSpeed")}
        />
        {errors.windSpeed && (
          <div style={errorStyle}>{errors.windSpeed.message}</div>
        )}

        <label htmlFor="windDirection" style={labelStyle}>
          Wind direction
        </label>
        <input
          id="windDirection"
          type="text"
          style={inputStyle}
          placeholder="e.g. S"
          {...register("windDirection")}
        />
        {errors.windDirection && (
          <div style={errorStyle}>{errors.windDirection.message}</div>
        )}

        <label htmlFor="weatherNotes" style={labelStyle}>
          Weather notes (optional)
        </label>
        <input
          id="weatherNotes"
          type="text"
          style={inputStyle}
          {...register("weatherNotes")}
        />
      </fieldset>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.75rem",
        }}
      >
        <input type="checkbox" {...register("attestationConfirmed")} />
        <span>
          I attest these inputs are accurate to the best of my knowledge.
          (Required to submit later; not required to save a draft.)
        </span>
      </label>

      <button
        type="submit"
        disabled={submitState.kind === "saving"}
        style={{
          padding: "0.5rem 1rem",
          fontSize: "1rem",
          cursor: submitState.kind === "saving" ? "not-allowed" : "pointer",
        }}
      >
        {submitState.kind === "saving" ? "Saving…" : "Save draft"}
      </button>

      {submitState.kind === "saved" && (
        <div style={{ color: "#0a6", marginTop: "0.5rem" }}>
          Draft saved (id: <code>{submitState.recordId}</code>).
        </div>
      )}
      {submitState.kind === "error" && (
        <div style={{ color: "#b00020", marginTop: "0.5rem" }}>
          {submitState.message}
        </div>
      )}
    </form>
  );
}
