import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
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

const optionalString = z.string().optional().or(z.literal(""));

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

function SectionPaper({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle1" component="h3" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      <Stack spacing={2}>{children}</Stack>
    </Paper>
  );
}

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
    <Box component="form" onSubmit={onSubmit} noValidate>
      <SectionPaper title="Who & where">
        <TextField
          select
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          label="Organization"
          error={!!errors.organizationId}
          helperText={errors.organizationId?.message}
          {...register("organizationId")}
        >
          <option value="">— select —</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </TextField>

        <TextField
          select
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          label="Applicator"
          error={!!errors.applicatorId}
          helperText={errors.applicatorId?.message}
          {...register("applicatorId")}
        >
          <option value="">— select —</option>
          {applicators.map((a) => (
            <option key={a.id} value={a.id}>
              {a.applicatorName} — {a.contractorCompanyName}
            </option>
          ))}
        </TextField>

        <TextField
          select
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          label="Farm"
          error={!!errors.farmId}
          helperText={errors.farmId?.message}
          {...register("farmId")}
        >
          <option value="">— select —</option>
          {farms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </TextField>

        <TextField
          select
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          label="Field"
          error={!!errors.fieldId}
          helperText={errors.fieldId?.message}
          {...register("fieldId")}
        >
          <option value="">— select —</option>
          {fieldsForFarm.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </TextField>

        <TextField
          label="Crop or site"
          error={!!errors.cropOrSite}
          helperText={errors.cropOrSite?.message}
          {...register("cropOrSite")}
        />

        <TextField
          label="Acres treated"
          slotProps={{ htmlInput: { inputMode: "decimal" } }}
          error={!!errors.acresTreated}
          helperText={errors.acresTreated?.message}
          {...register("acresTreated")}
        />
      </SectionPaper>

      <SectionPaper title="Product">
        <TextField
          select
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          label="Product"
          error={!!errors.productId}
          helperText={errors.productId?.message}
          {...register("productId")}
        >
          <option value="">— select —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — EPA {p.epaRegistrationNumber} — RUP: {p.rupStatus}
            </option>
          ))}
        </TextField>
        <Typography variant="caption" color="text.secondary">
          RUP status is captured as a fact at submit time. FieldLog does not
          decide whether you may legally apply a product.
        </Typography>
      </SectionPaper>

      <SectionPaper title="Application details">
        <TextField
          type="date"
          label="Application date"
          slotProps={{ inputLabel: { shrink: true } }}
          error={!!errors.applicationDate}
          helperText={errors.applicationDate?.message}
          {...register("applicationDate")}
        />
        <TextField
          type="time"
          label="Start time"
          slotProps={{ inputLabel: { shrink: true } }}
          error={!!errors.startTime}
          helperText={errors.startTime?.message}
          {...register("startTime")}
        />
        <TextField
          type="time"
          label="End time (optional)"
          slotProps={{ inputLabel: { shrink: true } }}
          {...register("endTime")}
        />
        <TextField
          label="Application method"
          placeholder="e.g. Ground broadcast"
          error={!!errors.applicationMethod}
          helperText={errors.applicationMethod?.message}
          {...register("applicationMethod")}
        />
        <TextField
          label="Rate applied"
          placeholder="e.g. 1 qt/ac"
          error={!!errors.rateApplied}
          helperText={errors.rateApplied?.message}
          {...register("rateApplied")}
        />
        <TextField
          label="Total amount applied"
          placeholder="e.g. 10 gal"
          error={!!errors.totalAmountApplied}
          helperText={errors.totalAmountApplied?.message}
          {...register("totalAmountApplied")}
        />
        <TextField
          label="Target pest (optional)"
          {...register("targetPest")}
        />
        <TextField label="PHI (optional)" {...register("phi")} />
      </SectionPaper>

      <SectionPaper title="Conditions">
        <TextField
          label="Temperature"
          placeholder="e.g. 72F"
          {...register("temperature")}
        />
        <TextField
          label="Wind speed"
          placeholder="e.g. 5 mph"
          {...register("windSpeed")}
        />
        <TextField
          label="Wind direction"
          placeholder="e.g. S"
          {...register("windDirection")}
        />
        <TextField
          label="Weather notes (optional)"
          {...register("weatherNotes")}
        />
      </SectionPaper>

      <FormControlLabel
        sx={{ mb: 1.5 }}
        control={<Checkbox {...register("attestationConfirmed")} />}
        label="I attest these inputs are accurate to the best of my knowledge. (Required to submit later; not required to save a draft.)"
      />

      <Button type="submit" disabled={submitState.kind === "saving"}>
        {submitState.kind === "saving" ? "Saving…" : "Save draft"}
      </Button>

      {submitState.kind === "saved" && (
        <Alert severity="success" sx={{ mt: 1.5 }}>
          Draft saved (id: <code>{submitState.recordId}</code>).
        </Alert>
      )}
      {submitState.kind === "error" && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {submitState.message}
        </Alert>
      )}
    </Box>
  );
}
