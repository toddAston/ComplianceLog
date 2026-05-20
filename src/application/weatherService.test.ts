import { describe, expect, it } from "vitest";
import {
  celsiusToFahrenheit,
  coordinateSchema,
  degreesToCardinal,
  kilometersPerHourToMph,
  metersPerSecondToMph,
  weatherReadingSchema,
  weatherSourceSchema,
} from "./weatherService";

describe("weatherService schemas", () => {
  it("accepts the four allowed sources", () => {
    expect(weatherSourceSchema.safeParse("nws_observation").success).toBe(true);
    expect(weatherSourceSchema.safeParse("nws_forecast_grid").success).toBe(
      true
    );
    expect(weatherSourceSchema.safeParse("manual").success).toBe(true);
    expect(weatherSourceSchema.safeParse("stale_cache").success).toBe(true);
  });

  it("rejects an unknown source", () => {
    expect(weatherSourceSchema.safeParse("openweather").success).toBe(false);
  });

  it("requires capturedAt and accepts an observation reading", () => {
    const ok = weatherReadingSchema.safeParse({
      source: "nws_observation",
      stationId: "KSGF",
      observedAt: "2026-05-19T12:00:00.000Z",
      capturedAt: "2026-05-19T12:00:30.000Z",
      temperatureF: 72,
      windSpeedMph: 5.4,
      windDirection: "S",
      windDirectionDegrees: 180,
      relativeHumidityPct: 55,
    });
    expect(ok.success).toBe(true);
  });

  it("rejects a reading without capturedAt", () => {
    const bad = weatherReadingSchema.safeParse({
      source: "manual",
    });
    expect(bad.success).toBe(false);
  });

  it("rejects out-of-range coordinates", () => {
    expect(coordinateSchema.safeParse({ latitude: 91, longitude: 0 }).success).toBe(
      false
    );
    expect(
      coordinateSchema.safeParse({ latitude: 0, longitude: 181 }).success
    ).toBe(false);
    expect(
      coordinateSchema.safeParse({ latitude: 37.2, longitude: -89.7 }).success
    ).toBe(true);
  });

  it("rejects negative wind speed", () => {
    const bad = weatherReadingSchema.safeParse({
      source: "nws_observation",
      capturedAt: "2026-05-19T12:00:00.000Z",
      windSpeedMph: -1,
    });
    expect(bad.success).toBe(false);
  });

  it("rejects humidity outside 0..100", () => {
    const bad = weatherReadingSchema.safeParse({
      source: "nws_observation",
      capturedAt: "2026-05-19T12:00:00.000Z",
      relativeHumidityPct: 110,
    });
    expect(bad.success).toBe(false);
  });
});

describe("weatherService unit conversions", () => {
  it("celsiusToFahrenheit", () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(100)).toBe(212);
    expect(celsiusToFahrenheit(22.2)).toBeCloseTo(71.96, 1);
  });

  it("metersPerSecondToMph", () => {
    expect(metersPerSecondToMph(0)).toBe(0);
    expect(metersPerSecondToMph(10)).toBeCloseTo(22.37, 1);
  });

  it("kilometersPerHourToMph", () => {
    expect(kilometersPerHourToMph(0)).toBe(0);
    expect(kilometersPerHourToMph(100)).toBeCloseTo(62.14, 1);
  });
});

describe("degreesToCardinal", () => {
  it("maps cardinal directions", () => {
    expect(degreesToCardinal(0)).toBe("N");
    expect(degreesToCardinal(90)).toBe("E");
    expect(degreesToCardinal(180)).toBe("S");
    expect(degreesToCardinal(270)).toBe("W");
  });

  it("maps intercardinal directions", () => {
    expect(degreesToCardinal(45)).toBe("NE");
    expect(degreesToCardinal(135)).toBe("SE");
    expect(degreesToCardinal(225)).toBe("SW");
    expect(degreesToCardinal(315)).toBe("NW");
  });

  it("normalizes out-of-range degrees", () => {
    expect(degreesToCardinal(360)).toBe("N");
    expect(degreesToCardinal(720)).toBe("N");
    expect(degreesToCardinal(-90)).toBe("W");
  });

  it("returns N for 360 (after normalization)", () => {
    expect(degreesToCardinal(359.9)).toBe("N");
  });
});
