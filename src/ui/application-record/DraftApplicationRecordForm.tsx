// DEPRECATED (commit 5ec0d8f): replaced as the live create flow by
// `src/ui/pages/RecordCreatePage.tsx`. This component is no longer
// imported by any production code — only by test files (its own
// DraftApplicationRecordForm.test.tsx and RecordCreatePage.rupCatalog.test.tsx
// which uses it as a convenience product-picker harness). Kept because
// it carries features RecordCreatePage doesn't (RHF validation, NWS
// weather adapter wiring) that may be re-adopted. Do NOT extend this
// component; build new features on RecordCreatePage instead.
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { Product, RUPStatus } from "../../domain/types";
import {
  useAllApplicators,
  useAllFarms,
  useAllFields,
  useAllOrganizations,
  useAllProducts,
} from "../../db/queries";
import { createDraftApplicationRecord } from "../../application/applicationRecordService";
import type { ContractorInputs, WeatherSnapshot } from "../../domain/types";
import { DEMO_APPLICATOR_ACTOR } from "../demoSession";
import {
  getCurrentCoordinate,
  type GeolocationResult,
} from "../../application/geolocation";
import {
  nwsWeatherAdapter,
  type NwsWeatherAdapter,
} from "../../application/nwsWeatherAdapter";
import type {
  WeatherReading,
  WeatherService,
} from "../../application/weatherService";

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

function RupChip({ status }: { status: RUPStatus }) {
  const color =
    status === "yes" ? "error" : status === "no" ? "success" : "default";
  const label =
    status === "yes"
      ? "RUP"
      : status === "no"
        ? "Non-RUP"
        : "RUP: unknown";
  return (
    <Chip
      size="small"
      color={color}
      label={label}
      variant={status === "no" ? "outlined" : "filled"}
      data-testid={`rup-chip-${status}`}
    />
  );
}

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

export type DraftApplicationRecordFormProps = {
  weatherService?: WeatherService | NwsWeatherAdapter;
  getCoordinate?: () => Promise<GeolocationResult>;
};

type WeatherCaptureState =
  | { kind: "idle" }
  | { kind: "capturing" }
  | {
      kind: "captured";
      snapshot: WeatherSnapshot;
      reading: WeatherReading;
    }
  | { kind: "failed"; reason: string };

function readingToFormStrings(reading: WeatherReading): {
  temperature: string;
  windSpeed: string;
  windDirection: string;
} {
  return {
    temperature:
      reading.temperatureF != null
        ? `${reading.temperatureF.toFixed(0)}F`
        : "",
    windSpeed:
      reading.windSpeedMph != null
        ? `${reading.windSpeedMph.toFixed(1)} mph`
        : "",
    windDirection: reading.windDirection ?? "",
  };
}

function describeFailure(
  geo: GeolocationResult | null,
  weatherMessage?: string
): string {
  if (geo) {
    switch (geo.kind) {
      case "permission_denied":
        return "Location permission denied. Enter conditions manually.";
      case "insecure_context":
        return "Location requires a secure (HTTPS) connection. Enter conditions manually.";
      case "unsupported":
        return "This device cannot share its location. Enter conditions manually.";
      case "timeout":
        return "Location lookup timed out. Enter conditions manually.";
      case "error":
        return `Location error: ${geo.message}. Enter conditions manually.`;
      case "ok":
        break;
    }
  }
  return (
    weatherMessage ??
    "Weather lookup failed. Enter conditions manually."
  );
}

export function DraftApplicationRecordForm({
  weatherService = nwsWeatherAdapter,
  getCoordinate = () => getCurrentCoordinate(),
}: DraftApplicationRecordFormProps = {}) {
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
  const [captureState, setCaptureState] = useState<WeatherCaptureState>({
    kind: "idle",
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
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

  const onCaptureWeather = async () => {
    setCaptureState({ kind: "capturing" });
    const geo = await getCoordinate();
    if (geo.kind !== "ok") {
      setCaptureState({ kind: "failed", reason: describeFailure(geo) });
      return;
    }
    const result = await weatherService.fetchCurrent(geo.coordinate);
    if (result.kind !== "ok") {
      setCaptureState({
        kind: "failed",
        reason: describeFailure(
          null,
          result.kind === "timeout"
            ? "Weather lookup timed out. Enter conditions manually."
            : result.message
        ),
      });
      return;
    }
    const fields = readingToFormStrings(result.reading);
    setValue("temperature", fields.temperature, { shouldDirty: true });
    setValue("windSpeed", fields.windSpeed, { shouldDirty: true });
    setValue("windDirection", fields.windDirection, { shouldDirty: true });
    setCaptureState({
      kind: "captured",
      reading: result.reading,
      snapshot: {
        source: result.reading.source,
        stationId: result.reading.stationId,
        observedAt: result.reading.observedAt,
        capturedAt: result.reading.capturedAt,
      },
    });
  };

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
      weatherSnapshot:
        captureState.kind === "captured" ? captureState.snapshot : undefined,

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
      setCaptureState({ kind: "idle" });
      reset();
    } catch (err) {
      setSubmitState({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  });

  const fillWithDemoData = () => {
    const org = organizations[0];
    const applicator = applicators[0];
    const farm = farms[0];
    const fieldForFarm = farm
      ? fields.find((f) => f.farmId === farm.id) ?? fields[0]
      : fields[0];
    const product = products[0];
    if (!org || !applicator || !farm || !fieldForFarm || !product) return;

    const opts = { shouldDirty: true, shouldValidate: false } as const;
    setValue("organizationId", org.id, opts);
    setValue("applicatorId", applicator.id, opts);
    setValue("farmId", farm.id, opts);
    setValue("fieldId", fieldForFarm.id, opts);
    setValue("productId", product.id, opts);
    setValue(
      "cropOrSite",
      fieldForFarm.defaultCropOrSite ?? "Soybeans",
      opts
    );
    setValue(
      "acresTreated",
      fieldForFarm.defaultAcres != null
        ? String(fieldForFarm.defaultAcres)
        : "42.5",
      opts
    );
    setValue("applicationDate", "2026-05-19", opts);
    setValue("startTime", "08:00", opts);
    setValue("applicationMethod", "Ground broadcast", opts);
    setValue("rateApplied", "1 qt/ac", opts);
    setValue("totalAmountApplied", "10 gal", opts);
    setValue("targetPest", "Waterhemp", opts);
    setValue("temperature", "72F", opts);
    setValue("windSpeed", "5 mph", opts);
    setValue("windDirection", "S", opts);
  };

  const showDemoFill = import.meta.env.DEV;

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      {showDemoFill && (
        <Box sx={{ mb: 1.5 }}>
          <Button
            type="button"
            variant="text"
            size="small"
            onClick={fillWithDemoData}
            data-testid="autofill-demo-button"
            sx={{ textTransform: "none", p: 0, minWidth: 0 }}
          >
            Fill with demo data
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            (debug — pre-launch only)
          </Typography>
        </Box>
      )}
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
        <Controller
          name="productId"
          control={control}
          render={({ field }) => {
            const selected =
              products.find((p) => p.id === field.value) ?? null;
            return (
              <Stack spacing={1}>
                <Autocomplete<Product>
                  options={products}
                  value={selected}
                  onChange={(_e, value) => field.onChange(value?.id ?? "")}
                  onBlur={field.onBlur}
                  getOptionLabel={(p) =>
                    `${p.name} (EPA ${p.epaRegistrationNumber})`
                  }
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  filterOptions={(opts, state) => {
                    const q = state.inputValue.trim().toLowerCase();
                    if (!q) return opts;
                    return opts.filter(
                      (p) =>
                        p.name.toLowerCase().includes(q) ||
                        p.epaRegistrationNumber.toLowerCase().includes(q)
                    );
                  }}
                  renderOption={(optionProps, p) => {
                    const { key, ...rest } = optionProps as typeof optionProps & {
                      key?: React.Key;
                    };
                    return (
                      <Box
                        component="li"
                        key={key ?? p.id}
                        {...rest}
                        data-testid={`product-option-${p.id}`}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%",
                          }}
                        >
                          <Box>
                            <Typography variant="body2">{p.name}</Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              EPA {p.epaRegistrationNumber}
                            </Typography>
                          </Box>
                          <RupChip status={p.rupStatus} />
                        </Stack>
                      </Box>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Product"
                      error={!!errors.productId}
                      helperText={errors.productId?.message}
                    />
                  )}
                />
                {selected && (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                    data-testid="selected-product-summary"
                  >
                    <Typography variant="body2">
                      EPA {selected.epaRegistrationNumber}
                    </Typography>
                    <RupChip status={selected.rupStatus} />
                  </Stack>
                )}
              </Stack>
            );
          }}
        />
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
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Button
            type="button"
            variant="outlined"
            size="small"
            onClick={onCaptureWeather}
            disabled={captureState.kind === "capturing"}
          >
            {captureState.kind === "capturing"
              ? "Capturing…"
              : "Capture from NWS"}
          </Button>
          {captureState.kind === "captured" && (
            <Chip
              size="small"
              color="success"
              data-testid="weather-provenance-chip"
              label={
                captureState.snapshot.stationId
                  ? `From ${captureState.snapshot.stationId} (${captureState.snapshot.source})`
                  : `From ${captureState.snapshot.source}`
              }
            />
          )}
        </Stack>
        {captureState.kind === "failed" && (
          <Alert severity="warning" data-testid="weather-capture-alert">
            {captureState.reason}
          </Alert>
        )}
        <TextField
          label="Temperature"
          placeholder="e.g. 72F"
          slotProps={{ inputLabel: { shrink: true } }}
          {...register("temperature")}
        />
        <TextField
          label="Wind speed"
          placeholder="e.g. 5 mph"
          slotProps={{ inputLabel: { shrink: true } }}
          {...register("windSpeed")}
        />
        <TextField
          label="Wind direction"
          placeholder="e.g. S"
          slotProps={{ inputLabel: { shrink: true } }}
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
