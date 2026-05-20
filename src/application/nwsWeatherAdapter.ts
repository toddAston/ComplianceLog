import {
  celsiusToFahrenheit,
  degreesToCardinal,
  metersPerSecondToMph,
  type Coordinate,
  type WeatherFetchOptions,
  type WeatherFetchResult,
  type WeatherReading,
  type WeatherService,
} from "./weatherService";

const NWS_BASE = "https://api.weather.gov";
const DEFAULT_TIMEOUT_MS = 5_000;
const USER_AGENT = "FieldLog/0.1 (contact@fieldlog.local)";

type NwsPointsResponse = {
  properties?: {
    observationStations?: string;
  };
};

type NwsStationListResponse = {
  features?: Array<{
    properties?: {
      stationIdentifier?: string;
    };
  }>;
};

type NwsObservationResponse = {
  properties?: {
    timestamp?: string;
    temperature?: { value?: number | null; unitCode?: string };
    windSpeed?: { value?: number | null; unitCode?: string };
    windGust?: { value?: number | null; unitCode?: string };
    windDirection?: { value?: number | null; unitCode?: string };
    relativeHumidity?: { value?: number | null };
  };
};

function buildHeaders(): HeadersInit {
  return {
    Accept: "application/geo+json",
    "User-Agent": USER_AGENT,
  };
}

async function fetchJson<T>(
  url: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal
): Promise<T> {
  const response = await fetchImpl(url, {
    headers: buildHeaders(),
    signal,
  });
  if (!response.ok) {
    throw new Error(`NWS ${url} responded ${response.status}`);
  }
  return (await response.json()) as T;
}

function unitNormalized(unitCode: string | undefined): string {
  return (unitCode ?? "").toLowerCase().replace(/^wmounit:/, "");
}

function toFahrenheit(
  value: number | null | undefined,
  unitCode: string | undefined
): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  const unit = unitNormalized(unitCode);
  if (unit.includes("degc")) return celsiusToFahrenheit(value);
  if (unit.includes("degf")) return value;
  return celsiusToFahrenheit(value);
}

function toMph(
  value: number | null | undefined,
  unitCode: string | undefined
): number | undefined {
  if (value == null || !Number.isFinite(value) || value < 0) return undefined;
  const unit = unitNormalized(unitCode);
  if (unit.includes("km_h-1") || unit.includes("kmh")) return value * 0.621371192237334;
  if (unit.includes("mi_h-1") || unit.includes("mph")) return value;
  return metersPerSecondToMph(value);
}

function buildReading(
  observation: NwsObservationResponse,
  stationId: string | undefined,
  capturedAt: string
): WeatherReading {
  const props = observation.properties ?? {};
  const temperatureF = toFahrenheit(
    props.temperature?.value,
    props.temperature?.unitCode
  );
  const windSpeedMph = toMph(props.windSpeed?.value, props.windSpeed?.unitCode);
  const windGustMph = toMph(props.windGust?.value, props.windGust?.unitCode);
  const windDirectionDegrees =
    props.windDirection?.value != null &&
    Number.isFinite(props.windDirection.value)
      ? props.windDirection.value
      : undefined;
  const windDirection =
    windDirectionDegrees != null
      ? degreesToCardinal(windDirectionDegrees)
      : undefined;
  const humidity =
    props.relativeHumidity?.value != null &&
    Number.isFinite(props.relativeHumidity.value)
      ? Math.max(0, Math.min(100, props.relativeHumidity.value))
      : undefined;

  return {
    source: "nws_observation",
    stationId,
    observedAt: props.timestamp,
    capturedAt,
    temperatureF,
    windSpeedMph,
    windGustMph,
    windDirection,
    windDirectionDegrees,
    relativeHumidityPct: humidity,
    rawProviderPayload: observation,
  };
}

export class NwsWeatherAdapter implements WeatherService {
  async fetchCurrent(
    location: Coordinate,
    options: WeatherFetchOptions = {}
  ): Promise<WeatherFetchResult> {
    const fetchImpl = options.fetchImpl ?? fetch;
    const now = options.now ?? (() => new Date());
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(new Error("timeout")),
      DEFAULT_TIMEOUT_MS
    );
    const linkedAbort = () => controller.abort(new Error("aborted"));
    options.signal?.addEventListener("abort", linkedAbort);

    try {
      const lat = location.latitude.toFixed(4);
      const lon = location.longitude.toFixed(4);
      const points = await fetchJson<NwsPointsResponse>(
        `${NWS_BASE}/points/${lat},${lon}`,
        fetchImpl,
        controller.signal
      );
      const stationsUrl = points.properties?.observationStations;
      if (!stationsUrl) {
        return {
          kind: "unavailable",
          message: "NWS points response missing observationStations link.",
        };
      }
      const stations = await fetchJson<NwsStationListResponse>(
        stationsUrl,
        fetchImpl,
        controller.signal
      );
      const stationId =
        stations.features?.[0]?.properties?.stationIdentifier ?? undefined;
      if (!stationId) {
        return {
          kind: "unavailable",
          message: "No NWS observation stations available for coordinate.",
        };
      }
      const observation = await fetchJson<NwsObservationResponse>(
        `${NWS_BASE}/stations/${stationId}/observations/latest`,
        fetchImpl,
        controller.signal
      );

      return {
        kind: "ok",
        reading: buildReading(observation, stationId, now().toISOString()),
      };
    } catch (err) {
      if (
        (err as Error)?.name === "AbortError" ||
        /timeout|aborted/i.test((err as Error)?.message ?? "")
      ) {
        return { kind: "timeout" };
      }
      return {
        kind: "unavailable",
        message: err instanceof Error ? err.message : "Unknown NWS error.",
      };
    } finally {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener("abort", linkedAbort);
    }
  }
}

export const nwsWeatherAdapter = new NwsWeatherAdapter();
