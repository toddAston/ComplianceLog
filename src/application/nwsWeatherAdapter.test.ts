import { describe, expect, it, vi } from "vitest";
import { NwsWeatherAdapter } from "./nwsWeatherAdapter";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/geo+json" },
  });
}

function mockFetchSequence(...responses: Array<Response | Error>) {
  const calls: string[] = [];
  let i = 0;
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    calls.push(typeof input === "string" ? input : String(input));
    const next = responses[i++];
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const SGF_POINTS = {
  properties: {
    observationStations:
      "https://api.weather.gov/gridpoints/SGF/74,32/stations",
  },
};
const SGF_STATIONS = {
  features: [
    {
      properties: { stationIdentifier: "KSGF" },
    },
  ],
};
const SGF_OBSERVATION_METRIC = {
  properties: {
    timestamp: "2026-05-19T12:00:00+00:00",
    temperature: { value: 22.2, unitCode: "wmoUnit:degC" },
    windSpeed: { value: 5.4, unitCode: "wmoUnit:km_h-1" },
    windGust: { value: 12, unitCode: "wmoUnit:km_h-1" },
    windDirection: { value: 180, unitCode: "wmoUnit:degree_(angle)" },
    relativeHumidity: { value: 62 },
  },
};

describe("NwsWeatherAdapter", () => {
  it("resolves to a normalized WeatherReading via points→stations→observation", async () => {
    const { fetchImpl, calls } = mockFetchSequence(
      jsonResponse(SGF_POINTS),
      jsonResponse(SGF_STATIONS),
      jsonResponse(SGF_OBSERVATION_METRIC)
    );
    const adapter = new NwsWeatherAdapter();

    const result = await adapter.fetchCurrent(
      { latitude: 37.2, longitude: -89.7 },
      {
        fetchImpl,
        now: () => new Date("2026-05-19T12:00:30.000Z"),
      }
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.reading.source).toBe("nws_observation");
    expect(result.reading.stationId).toBe("KSGF");
    expect(result.reading.observedAt).toBe("2026-05-19T12:00:00+00:00");
    expect(result.reading.capturedAt).toBe("2026-05-19T12:00:30.000Z");
    expect(result.reading.temperatureF).toBeCloseTo(71.96, 1);
    expect(result.reading.windSpeedMph).toBeCloseTo(3.36, 1);
    expect(result.reading.windGustMph).toBeCloseTo(7.46, 1);
    expect(result.reading.windDirectionDegrees).toBe(180);
    expect(result.reading.windDirection).toBe("S");
    expect(result.reading.relativeHumidityPct).toBe(62);

    expect(calls[0]).toContain("/points/37.2000,-89.7000");
    expect(calls[1]).toBe(
      "https://api.weather.gov/gridpoints/SGF/74,32/stations"
    );
    expect(calls[2]).toContain("/stations/KSGF/observations/latest");
  });

  it("returns unavailable when points response is missing stations link", async () => {
    const { fetchImpl } = mockFetchSequence(
      jsonResponse({ properties: {} })
    );
    const adapter = new NwsWeatherAdapter();
    const result = await adapter.fetchCurrent(
      { latitude: 37.2, longitude: -89.7 },
      { fetchImpl }
    );
    expect(result.kind).toBe("unavailable");
  });

  it("returns unavailable when no stations exist for the coordinate", async () => {
    const { fetchImpl } = mockFetchSequence(
      jsonResponse(SGF_POINTS),
      jsonResponse({ features: [] })
    );
    const adapter = new NwsWeatherAdapter();
    const result = await adapter.fetchCurrent(
      { latitude: 37.2, longitude: -89.7 },
      { fetchImpl }
    );
    expect(result.kind).toBe("unavailable");
  });

  it("returns unavailable when NWS responds non-2xx", async () => {
    const { fetchImpl } = mockFetchSequence(
      new Response("nope", { status: 503 })
    );
    const adapter = new NwsWeatherAdapter();
    const result = await adapter.fetchCurrent(
      { latitude: 37.2, longitude: -89.7 },
      { fetchImpl }
    );
    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") {
      expect(result.message).toMatch(/503/);
    }
  });

  it("returns timeout when external abort fires", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((_resolve, reject) => {
          controller.signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        })
    ) as unknown as typeof fetch;
    const adapter = new NwsWeatherAdapter();
    const promise = adapter.fetchCurrent(
      { latitude: 37.2, longitude: -89.7 },
      { fetchImpl, signal: controller.signal }
    );
    controller.abort();
    const result = await promise;
    expect(result.kind).toBe("timeout");
  });

  it("treats missing observation values as undefined (does not throw)", async () => {
    const { fetchImpl } = mockFetchSequence(
      jsonResponse(SGF_POINTS),
      jsonResponse(SGF_STATIONS),
      jsonResponse({
        properties: {
          timestamp: "2026-05-19T12:00:00+00:00",
          temperature: { value: null, unitCode: "wmoUnit:degC" },
          windSpeed: { value: null, unitCode: "wmoUnit:km_h-1" },
        },
      })
    );
    const adapter = new NwsWeatherAdapter();
    const result = await adapter.fetchCurrent(
      { latitude: 37.2, longitude: -89.7 },
      { fetchImpl, now: () => new Date("2026-05-19T12:00:30.000Z") }
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.reading.temperatureF).toBeUndefined();
    expect(result.reading.windSpeedMph).toBeUndefined();
    expect(result.reading.windDirection).toBeUndefined();
    expect(result.reading.relativeHumidityPct).toBeUndefined();
  });

  it("uses Fahrenheit values without converting when unit is degF", async () => {
    const { fetchImpl } = mockFetchSequence(
      jsonResponse(SGF_POINTS),
      jsonResponse(SGF_STATIONS),
      jsonResponse({
        properties: {
          timestamp: "2026-05-19T12:00:00+00:00",
          temperature: { value: 72, unitCode: "wmoUnit:degF" },
          windSpeed: { value: 5, unitCode: "wmoUnit:mi_h-1" },
        },
      })
    );
    const adapter = new NwsWeatherAdapter();
    const result = await adapter.fetchCurrent(
      { latitude: 37.2, longitude: -89.7 },
      { fetchImpl, now: () => new Date("2026-05-19T12:00:30.000Z") }
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.reading.temperatureF).toBe(72);
    expect(result.reading.windSpeedMph).toBe(5);
  });
});
