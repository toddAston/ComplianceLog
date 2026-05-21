import type { ApplicationRecord } from "../../../domain/types";
import type { ComplianceRule } from "../types";
import { has, isOutdoorApplication } from "../helpers";

type CI = ApplicationRecord["contractorInputs"] & {
  weatherCaptureSource?: string;
  weatherCaptureTimestamp?: string;
  weatherCaptureLocation?: string;
  gpsLatitude?: string;
  gpsLongitude?: string;
};

// Matrix #49-#51 + #72. The auto-fetched `weatherSnapshot` already carries
// source/capturedAt/stationId; manual entries may not. These rules emit
// NEEDS_REVIEW (unknown) when neither the snapshot nor a manual capture field
// is present, so they show in the audit but don't block lock.
const fromSnapshot = (record: ApplicationRecord, field: "source" | "capturedAt" | "stationId") => {
  const snap = record.contractorInputs.weatherSnapshot;
  if (!snap) return undefined;
  return (snap as Record<string, string | undefined>)[field];
};

export const evidenceQualityRules: ComplianceRule[] = [
  // Matrix #49: weather capture source (manual, device, API, meter, …).
  {
    ruleId: "WEATHER_CAPTURE_SOURCE_UNKNOWN",
    resultCode: "NEEDS_REVIEW",
    citation:
      "FieldLog operational — outdoor weather records should identify the capture source (manual entry, device, weather API, on-site meter, …) for evidence quality.",
    citationShort: "FIELDLOG_OPERATIONAL",
    description: "Weather capture source recorded",
    message:
      "Outdoor weather capture source is not recorded — record the source for evidence quality (matrix #49).",
    appliesWhen: isOutdoorApplication,
    evaluate: (record) => {
      const v =
        (record.contractorInputs as CI).weatherCaptureSource ??
        fromSnapshot(record, "source");
      return has(v)
        ? { status: "pass" }
        : { status: "unknown", unknownReason: "Capture source not recorded." };
    },
  },

  // Matrix #50: weather capture timestamp.
  {
    ruleId: "WEATHER_CAPTURE_TIMESTAMP_UNKNOWN",
    resultCode: "NEEDS_REVIEW",
    citation:
      "FieldLog operational — outdoor weather records should carry the timestamp at which the reading was captured.",
    citationShort: "FIELDLOG_OPERATIONAL",
    description: "Weather capture timestamp recorded",
    message:
      "Outdoor weather capture timestamp is not recorded (matrix #50).",
    appliesWhen: isOutdoorApplication,
    evaluate: (record) => {
      const v =
        (record.contractorInputs as CI).weatherCaptureTimestamp ??
        fromSnapshot(record, "capturedAt");
      return has(v)
        ? { status: "pass" }
        : { status: "unknown", unknownReason: "Capture timestamp not recorded." };
    },
  },

  // Matrix #51: weather capture location.
  {
    ruleId: "WEATHER_CAPTURE_LOCATION_UNKNOWN",
    resultCode: "NEEDS_REVIEW",
    citation:
      "FieldLog operational — outdoor weather records should identify the location associated with the reading (site, station, or coordinates).",
    citationShort: "FIELDLOG_OPERATIONAL",
    description: "Weather capture location recorded",
    message:
      "Outdoor weather capture location is not recorded (matrix #51).",
    appliesWhen: isOutdoorApplication,
    evaluate: (record) => {
      const v =
        (record.contractorInputs as CI).weatherCaptureLocation ??
        fromSnapshot(record, "stationId");
      return has(v)
        ? { status: "pass" }
        : { status: "unknown", unknownReason: "Capture location not recorded." };
    },
  },

  // Matrix #72: GPS point / field polygon evidence.
  {
    ruleId: "GPS_EVIDENCE_UNKNOWN",
    resultCode: "NEEDS_REVIEW",
    citation:
      "FieldLog operational — a GPS point or field polygon is not required by 2 CSR 70-25.120 but strengthens site evidence; FieldLog flags its absence for review.",
    citationShort: "FIELDLOG_OPERATIONAL",
    description: "GPS / location evidence captured",
    message: "No GPS point or field polygon captured (matrix #72).",
    evaluate: (record) => {
      const ci = record.contractorInputs as CI;
      if (has(ci.gpsLatitude) && has(ci.gpsLongitude)) {
        return { status: "pass" };
      }
      return {
        status: "unknown",
        unknownReason: "GPS coordinates not captured.",
      };
    },
  },
];
