import { describe, expect, it, vi } from "vitest";
import { getCurrentCoordinate } from "./geolocation";

type SuccessCallback = (position: GeolocationPosition) => void;
type ErrorCallback = (error: GeolocationPositionError) => void;

function buildPosition(latitude: number, longitude: number, accuracy = 12): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON() {
        return this;
      },
    } as GeolocationCoordinates,
    timestamp: 0,
    toJSON() {
      return this;
    },
  };
}

function buildError(code: 1 | 2 | 3, message = ""): GeolocationPositionError {
  return {
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

function buildGeolocation(
  impl: (
    success: SuccessCallback,
    error?: ErrorCallback,
    opts?: PositionOptions
  ) => void
): Geolocation {
  return {
    getCurrentPosition: vi.fn(impl),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  } as unknown as Geolocation;
}

describe("getCurrentCoordinate", () => {
  it("returns ok with coords when geolocation succeeds", async () => {
    const geo = buildGeolocation((success) => {
      success(buildPosition(37.2, -89.7));
    });
    const result = await getCurrentCoordinate(
      {},
      { geolocation: geo, isSecureContext: true }
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.coordinate.latitude).toBe(37.2);
    expect(result.coordinate.longitude).toBe(-89.7);
    expect(result.accuracyMeters).toBe(12);
  });

  it("returns insecure_context when isSecureContext is false", async () => {
    const geo = buildGeolocation(() => {});
    const result = await getCurrentCoordinate(
      {},
      { geolocation: geo, isSecureContext: false }
    );
    expect(result.kind).toBe("insecure_context");
  });

  it("returns unsupported when geolocation is not available", async () => {
    const result = await getCurrentCoordinate(
      {},
      { geolocation: null, isSecureContext: true }
    );
    expect(result.kind).toBe("unsupported");
  });

  it("returns permission_denied when callback errors with code 1", async () => {
    const geo = buildGeolocation((_s, err) => {
      err!(buildError(1, "blocked"));
    });
    const result = await getCurrentCoordinate(
      {},
      { geolocation: geo, isSecureContext: true }
    );
    expect(result.kind).toBe("permission_denied");
  });

  it("returns timeout when callback errors with code 3", async () => {
    const geo = buildGeolocation((_s, err) => {
      err!(buildError(3));
    });
    const result = await getCurrentCoordinate(
      {},
      { geolocation: geo, isSecureContext: true }
    );
    expect(result.kind).toBe("timeout");
  });

  it("returns error for unknown code with the underlying message", async () => {
    const geo = buildGeolocation((_s, err) => {
      err!(buildError(2, "position unavailable"));
    });
    const result = await getCurrentCoordinate(
      {},
      { geolocation: geo, isSecureContext: true }
    );
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toBe("position unavailable");
    }
  });

  it("times out independently of the underlying API timeout", async () => {
    const geo = buildGeolocation(() => {
      // never calls back
    });
    const result = await getCurrentCoordinate(
      { timeoutMs: 20 },
      { geolocation: geo, isSecureContext: true }
    );
    expect(result.kind).toBe("timeout");
  });

  it("only resolves once even if both timeout and success could fire", async () => {
    const captured: { current: SuccessCallback | null } = { current: null };
    const geo = buildGeolocation((success) => {
      captured.current = success;
    });
    const promise = getCurrentCoordinate(
      { timeoutMs: 10 },
      { geolocation: geo, isSecureContext: true }
    );
    const first = await promise;
    captured.current?.(buildPosition(0, 0));
    expect(first.kind).toBe("timeout");
  });

  it("passes options through to the underlying API", async () => {
    const calls: Array<[SuccessCallback, ErrorCallback | undefined, PositionOptions | undefined]> = [];
    const geo = {
      getCurrentPosition: (
        success: SuccessCallback,
        error?: ErrorCallback,
        opts?: PositionOptions
      ) => {
        calls.push([success, error, opts]);
        success(buildPosition(1, 2));
      },
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    } as unknown as Geolocation;

    await getCurrentCoordinate(
      { timeoutMs: 250, maximumAgeMs: 9000, enableHighAccuracy: true },
      { geolocation: geo, isSecureContext: true }
    );
    const opts = calls[0][2]!;
    expect(opts.timeout).toBe(250);
    expect(opts.maximumAge).toBe(9000);
    expect(opts.enableHighAccuracy).toBe(true);
  });
});
