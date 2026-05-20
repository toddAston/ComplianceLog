import type { Coordinate } from "./weatherService";

export type GeolocationResult =
  | { kind: "ok"; coordinate: Coordinate; accuracyMeters?: number }
  | { kind: "permission_denied" }
  | { kind: "timeout" }
  | { kind: "insecure_context" }
  | { kind: "unsupported" }
  | { kind: "error"; message: string };

export type GeolocationDependencies = {
  geolocation?: Geolocation | null;
  isSecureContext?: boolean;
};

export type GeolocationOptions = {
  timeoutMs?: number;
  maximumAgeMs?: number;
  enableHighAccuracy?: boolean;
};

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_AGE_MS = 60_000;

export function getCurrentCoordinate(
  options: GeolocationOptions = {},
  deps: GeolocationDependencies = {}
): Promise<GeolocationResult> {
  const isSecureContext =
    deps.isSecureContext ??
    (typeof window === "undefined"
      ? false
      : (window as Window & { isSecureContext?: boolean }).isSecureContext ??
        false);
  const geolocation =
    deps.geolocation === undefined
      ? typeof navigator === "undefined"
        ? null
        : navigator.geolocation ?? null
      : deps.geolocation;

  if (!isSecureContext) {
    return Promise.resolve({ kind: "insecure_context" });
  }
  if (!geolocation) {
    return Promise.resolve({ kind: "unsupported" });
  }

  return new Promise<GeolocationResult>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ kind: "timeout" });
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    geolocation.getCurrentPosition(
      (position) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          kind: "ok",
          coordinate: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          accuracyMeters: position.coords.accuracy,
        });
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error.code === error.PERMISSION_DENIED) {
          resolve({ kind: "permission_denied" });
          return;
        }
        if (error.code === error.TIMEOUT) {
          resolve({ kind: "timeout" });
          return;
        }
        resolve({
          kind: "error",
          message: error.message || "Unknown geolocation error.",
        });
      },
      {
        enableHighAccuracy: options.enableHighAccuracy ?? false,
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maximumAge: options.maximumAgeMs ?? DEFAULT_MAX_AGE_MS,
      }
    );
  });
}
