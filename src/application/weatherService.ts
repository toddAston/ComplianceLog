import { z } from "zod";

export const weatherSourceSchema = z.enum([
  "nws_observation",
  "nws_forecast_grid",
  "manual",
  "stale_cache",
]);
export type WeatherSource = z.infer<typeof weatherSourceSchema>;

export const weatherReadingSchema = z.object({
  source: weatherSourceSchema,
  stationId: z.string().optional(),
  observedAt: z.string().datetime().optional(),
  capturedAt: z.string().datetime(),

  temperatureF: z.number().finite().optional(),
  windSpeedMph: z.number().finite().nonnegative().optional(),
  windGustMph: z.number().finite().nonnegative().optional(),
  windDirection: z.string().optional(),
  windDirectionDegrees: z.number().finite().min(0).max(360).optional(),
  relativeHumidityPct: z.number().finite().min(0).max(100).optional(),

  rawProviderPayload: z.unknown().optional(),
});
export type WeatherReading = z.infer<typeof weatherReadingSchema>;

export const coordinateSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
export type Coordinate = z.infer<typeof coordinateSchema>;

export type WeatherFetchOptions = {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export type WeatherFetchResult =
  | { kind: "ok"; reading: WeatherReading }
  | { kind: "timeout" }
  | { kind: "unavailable"; message: string };

export interface WeatherService {
  fetchCurrent(
    location: Coordinate,
    options?: WeatherFetchOptions
  ): Promise<WeatherFetchResult>;
}

export const DEGREES_TO_CARDINAL: ReadonlyArray<{
  max: number;
  cardinal: string;
}> = [
  { max: 11.25, cardinal: "N" },
  { max: 33.75, cardinal: "NNE" },
  { max: 56.25, cardinal: "NE" },
  { max: 78.75, cardinal: "ENE" },
  { max: 101.25, cardinal: "E" },
  { max: 123.75, cardinal: "ESE" },
  { max: 146.25, cardinal: "SE" },
  { max: 168.75, cardinal: "SSE" },
  { max: 191.25, cardinal: "S" },
  { max: 213.75, cardinal: "SSW" },
  { max: 236.25, cardinal: "SW" },
  { max: 258.75, cardinal: "WSW" },
  { max: 281.25, cardinal: "W" },
  { max: 303.75, cardinal: "WNW" },
  { max: 326.25, cardinal: "NW" },
  { max: 348.75, cardinal: "NNW" },
  { max: 360.01, cardinal: "N" },
];

export function degreesToCardinal(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  for (const { max, cardinal } of DEGREES_TO_CARDINAL) {
    if (normalized < max) return cardinal;
  }
  return "N";
}

export function celsiusToFahrenheit(c: number): number {
  return c * 1.8 + 32;
}

export function metersPerSecondToMph(mps: number): number {
  return mps * 2.2369362920544;
}

export function kilometersPerHourToMph(kph: number): number {
  return kph * 0.621371192237334;
}
