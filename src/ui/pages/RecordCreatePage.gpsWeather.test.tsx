import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { db } from "../../db/fieldlogDb";
import { seedDemoData } from "../../db/seed";
import { SessionProvider } from "../session/SessionContext";
import { RecordCreatePage } from "./RecordCreatePage";
import type {
  WeatherFetchResult,
  WeatherService,
} from "../../application/weatherService";

// A stub geolocation that always succeeds with the given coords.
function stubGeolocation(latitude: number, longitude: number) {
  const original = (navigator as Navigator & { geolocation?: Geolocation })
    .geolocation;
  const fake = {
    getCurrentPosition: (success: PositionCallback) => {
      success({
        coords: {
          latitude,
          longitude,
          accuracy: 5,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    },
  } as unknown as Geolocation;
  Object.defineProperty(navigator, "geolocation", {
    value: fake,
    configurable: true,
  });
  return () => {
    if (original === undefined) {
      Reflect.deleteProperty(navigator, "geolocation");
    } else {
      Object.defineProperty(navigator, "geolocation", {
        value: original,
        configurable: true,
      });
    }
  };
}

function fakeWeatherService(result: WeatherFetchResult): WeatherService {
  return {
    fetchCurrent: vi.fn(async () => result),
  };
}

const OK_READING: WeatherFetchResult = {
  kind: "ok",
  reading: {
    source: "nws_observation",
    stationId: "KSGF",
    observedAt: "2026-05-19T12:00:00.000Z",
    capturedAt: "2026-05-19T12:00:30.000Z",
    temperatureF: 71.6,
    windSpeedMph: 4.8,
    windDirection: "SSW",
    windDirectionDegrees: 202.5,
  },
};

const renderPage = (weatherService?: WeatherService) =>
  render(
    <SessionProvider initialRole="contractor">
      <BrowserRouter>
        <RecordCreatePage weatherService={weatherService} />
      </BrowserRouter>
    </SessionProvider>
  );

// Walk the stepper to Step 4 (Weather), where the "Use my location" button
// lives. Dexie live-queries are async — wait for the seeded options to appear
// before trying to select them.
async function walkToWeatherStep(user: ReturnType<typeof userEvent.setup>) {
  // Step 1 — Farm & Field
  const farmSelect = (await screen.findByLabelText(/Farm/i)) as HTMLSelectElement;
  await waitFor(() =>
    expect(
      Array.from(farmSelect.options).some((o) => o.value === "farm-north")
    ).toBe(true)
  );
  await user.selectOptions(farmSelect, "farm-north");

  const fieldSelect = screen.getByLabelText(/Field/i) as HTMLSelectElement;
  await waitFor(() =>
    expect(
      Array.from(fieldSelect.options).some((o) => o.value === "field-7")
    ).toBe(true)
  );
  await user.selectOptions(fieldSelect, "field-7");
  await user.click(screen.getByRole("button", { name: /Next/i }));

  // Step 2 — Product
  const productSelect = (await screen.findByLabelText(
    /Product/i
  )) as HTMLSelectElement;
  await waitFor(() =>
    expect(
      Array.from(productSelect.options).some(
        (o) => o.value === "product-example-herbicide-4l"
      )
    ).toBe(true)
  );
  await user.selectOptions(productSelect, "product-example-herbicide-4l");
  await user.click(screen.getByRole("button", { name: /Next/i }));

  // Step 3 — Application Details: End Time is now required, fill enough to advance.
  await user.type(screen.getByLabelText(/Time Start/i), "08:30");
  await user.type(screen.getByLabelText(/Time End/i), "11:30");
  await user.click(screen.getByRole("button", { name: /Next/i }));
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

afterEach(() => {
  cleanup();
});

describe("RecordCreatePage — GPS click also fills the weather inputs", () => {
  it("fills temperature, wind speed, and wind direction from the NWS reading when GPS succeeds", async () => {
    const restoreGeo = stubGeolocation(39.06, -92.33);
    const service = fakeWeatherService(OK_READING);

    try {
      renderPage(service);
      const user = userEvent.setup();
      await walkToWeatherStep(user);

      // Sanity: before the click, the three weather inputs are empty.
      const tempInput = screen.getByLabelText(/Temperature/i) as HTMLInputElement;
      const windInput = screen.getByLabelText(/Wind Speed/i) as HTMLInputElement;
      const dirInput = screen.getByLabelText(/Wind Direction/i) as HTMLSelectElement;
      expect(tempInput.value).toBe("");
      expect(windInput.value).toBe("");
      expect(dirInput.value).toBe("");

      await user.click(screen.getByTestId("gps-capture-button"));

      // Coords surface so the operator can see the capture worked.
      const coords = await screen.findByTestId("gps-coords-display");
      expect(coords.textContent).toMatch(/39\.06/);
      expect(coords.textContent).toMatch(/-92\.33/);

      // And — the focus of this test — the weather fields are populated from
      // the NWS reading. Temperature and wind speed are rounded to whole numbers.
      await waitFor(() => {
        expect(
          (screen.getByLabelText(/Temperature/i) as HTMLInputElement).value
        ).toBe("72"); // round(71.6)
      });
      expect(
        (screen.getByLabelText(/Wind Speed/i) as HTMLInputElement).value
      ).toBe("5"); // round(4.8)
      expect(
        (screen.getByLabelText(/Wind Direction/i) as HTMLSelectElement).value
      ).toBe("SSW");

      // The injected service was called exactly once with the GPS coords.
      expect(service.fetchCurrent).toHaveBeenCalledTimes(1);
      expect(service.fetchCurrent).toHaveBeenCalledWith({
        latitude: 39.06,
        longitude: -92.33,
      });
    } finally {
      restoreGeo();
    }
  });

  it("does NOT overwrite weather fields the operator already filled in", async () => {
    const restoreGeo = stubGeolocation(39.06, -92.33);
    const service = fakeWeatherService(OK_READING);

    try {
      renderPage(service);
      const user = userEvent.setup();
      await walkToWeatherStep(user);

      // Operator typed manual values first.
      await user.type(screen.getByLabelText(/Temperature/i), "65");
      await user.type(screen.getByLabelText(/Wind Speed/i), "10");
      await user.selectOptions(screen.getByLabelText(/Wind Direction/i), "N");

      await user.click(screen.getByTestId("gps-capture-button"));
      await screen.findByTestId("gps-coords-display");

      // Even though the NWS reading would suggest 72 / 5 / SSW, the operator's
      // earlier values must be preserved — auto-fill only fills BLANK fields.
      expect(
        (screen.getByLabelText(/Temperature/i) as HTMLInputElement).value
      ).toBe("65");
      expect(
        (screen.getByLabelText(/Wind Speed/i) as HTMLInputElement).value
      ).toBe("10");
      expect(
        (screen.getByLabelText(/Wind Direction/i) as HTMLSelectElement).value
      ).toBe("N");
    } finally {
      restoreGeo();
    }
  });

  it("captures coordinates but leaves weather empty when the weather service returns unavailable", async () => {
    const restoreGeo = stubGeolocation(39.06, -92.33);
    const service = fakeWeatherService({
      kind: "unavailable",
      message: "NWS gateway down",
    });

    try {
      renderPage(service);
      const user = userEvent.setup();
      await walkToWeatherStep(user);

      await user.click(screen.getByTestId("gps-capture-button"));
      await screen.findByTestId("gps-coords-display");

      // GPS succeeded but weather fetch reported unavailable — weather inputs
      // stay blank for manual entry. No exception is surfaced to the user.
      expect(
        (screen.getByLabelText(/Temperature/i) as HTMLInputElement).value
      ).toBe("");
      expect(
        (screen.getByLabelText(/Wind Speed/i) as HTMLInputElement).value
      ).toBe("");
      expect(
        (screen.getByLabelText(/Wind Direction/i) as HTMLSelectElement).value
      ).toBe("");
      expect(service.fetchCurrent).toHaveBeenCalledTimes(1);
    } finally {
      restoreGeo();
    }
  });

  it("captures coordinates and continues when the weather service throws", async () => {
    const restoreGeo = stubGeolocation(39.06, -92.33);
    const service: WeatherService = {
      fetchCurrent: vi.fn(async () => {
        throw new Error("fetch boom");
      }),
    };

    try {
      renderPage(service);
      const user = userEvent.setup();
      await walkToWeatherStep(user);

      await user.click(screen.getByTestId("gps-capture-button"));
      await screen.findByTestId("gps-coords-display");

      // Weather threw — but GPS capture still completed and the button is
      // no longer in the "capturing…" state.
      expect(
        (screen.getByLabelText(/Temperature/i) as HTMLInputElement).value
      ).toBe("");
      const gpsButton = screen.getByTestId(
        "gps-capture-button"
      ) as HTMLButtonElement;
      await waitFor(() => expect(gpsButton.disabled).toBe(false));
    } finally {
      restoreGeo();
    }
  });
});
