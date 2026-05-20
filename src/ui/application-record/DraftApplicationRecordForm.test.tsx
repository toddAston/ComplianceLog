import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";
import { db } from "../../db/fieldlogDb";
import { seedDemoData } from "../../db/seed";
import { DraftApplicationRecordForm } from "./DraftApplicationRecordForm";
import type {
  WeatherFetchResult,
  WeatherService,
} from "../../application/weatherService";
import type { GeolocationResult } from "../../application/geolocation";

function fakeWeatherService(result: WeatherFetchResult): WeatherService {
  return {
    fetchCurrent: vi.fn(async () => result),
  };
}

function fakeGeolocator(result: GeolocationResult) {
  return vi.fn(async () => result);
}

const okGeo: GeolocationResult = {
  kind: "ok",
  coordinate: { latitude: 37.2, longitude: -89.7 },
};

const okWeather: WeatherFetchResult = {
  kind: "ok",
  reading: {
    source: "nws_observation",
    stationId: "KSGF",
    observedAt: "2026-05-19T12:00:00+00:00",
    capturedAt: "2026-05-19T12:00:30.000Z",
    temperatureF: 71.96,
    windSpeedMph: 3.36,
    windDirection: "S",
    windDirectionDegrees: 180,
  },
};

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
});

afterEach(() => {
  cleanup();
});

async function pickProduct(user: ReturnType<typeof userEvent.setup>) {
  const input = screen.getByLabelText("Product");
  await user.click(input);
  const option = await screen.findByTestId(
    "product-option-product-example-herbicide-4l"
  );
  await user.click(option);
}

async function fillValidDraft() {
  const user = userEvent.setup();

  await screen.findByRole("option", {
    name: /John Smith.*Smith Spray Services/,
  });

  await user.selectOptions(
    screen.getByLabelText("Organization"),
    "org-demo-semofarms"
  );
  await user.selectOptions(
    screen.getByLabelText("Applicator"),
    "applicator-john-smith"
  );
  await user.selectOptions(screen.getByLabelText("Farm"), "farm-north");
  await user.selectOptions(screen.getByLabelText("Field"), "field-7");
  await pickProduct(user);

  await user.type(screen.getByLabelText("Crop or site"), "Soybeans");
  await user.type(screen.getByLabelText("Acres treated"), "42.5");

  await user.type(screen.getByLabelText("Application date"), "2026-05-19");
  await user.type(screen.getByLabelText("Start time"), "08:00");
  await user.type(
    screen.getByLabelText("Application method"),
    "Ground broadcast"
  );
  await user.type(screen.getByLabelText("Rate applied"), "1 qt/ac");
  await user.type(screen.getByLabelText("Total amount applied"), "10 gal");

  await user.type(screen.getByLabelText("Temperature"), "72F");
  await user.type(screen.getByLabelText("Wind speed"), "5 mph");
  await user.type(screen.getByLabelText("Wind direction"), "S");

  return user;
}

describe("DraftApplicationRecordForm", () => {
  it("populates dropdowns from seeded reference data", async () => {
    render(<DraftApplicationRecordForm />);

    expect(
      await screen.findByRole("option", {
        name: "Southeast Missouri Farms Demo",
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("option", {
        name: /John Smith.*Smith Spray Services/,
      })
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: "North Farm" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Field 7" })).toBeTruthy();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Product"));
    expect(
      await screen.findByTestId(
        "product-option-product-example-herbicide-4l"
      )
    ).toBeTruthy();
  });

  it("shows validation messages on empty submit and writes nothing", async () => {
    const user = userEvent.setup();
    render(<DraftApplicationRecordForm />);

    await user.click(screen.getByRole("button", { name: /save draft/i }));

    expect(
      await screen.findByText(/Organization is required/i)
    ).toBeTruthy();
    expect(screen.getByText(/Applicator is required/i)).toBeTruthy();
    expect(screen.getByText(/Farm is required/i)).toBeTruthy();
    expect(screen.getByText(/Field is required/i)).toBeTruthy();
    expect(screen.getByText(/Product is required/i)).toBeTruthy();

    expect(await db.applicationRecords.count()).toBe(0);
  });

  it("creates a draft via the application service when valid inputs are submitted", async () => {
    render(<DraftApplicationRecordForm />);

    const user = await fillValidDraft();
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(async () => {
      expect(await db.applicationRecords.count()).toBe(1);
    });

    const records = await db.applicationRecords.toArray();
    expect(records[0].workflowStatus).toBe("draft");
    expect(records[0].syncStatus).toBe("local_only");
    expect(records[0].contractorInputs.applicatorName).toBe("John Smith");
    expect(records[0].contractorInputs.company).toBe("Smith Spray Services");
    expect(records[0].contractorInputs.farmName).toBe("North Farm");
    expect(records[0].contractorInputs.fieldName).toBe("Field 7");
    expect(records[0].contractorInputs.productName).toBe(
      "Example Herbicide 4L"
    );
    expect(records[0].contractorInputs.epaRegistrationNumber).toBe("12345-678");

    const events = await db.recordEvents
      .where("applicationRecordId")
      .equals(records[0].id)
      .toArray();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("created");
    expect(events[0].actorUserId).toBe("user-demo-applicator");
    expect(events[0].actorDisplayName).toBe("Demo Applicator");
  });

  it("filters fields to the selected farm", async () => {
    const user = userEvent.setup();
    render(<DraftApplicationRecordForm />);

    await screen.findByRole("option", { name: "North Farm" });

    await user.selectOptions(screen.getByLabelText("Farm"), "farm-north");

    const fieldSelect = screen.getByLabelText("Field") as HTMLSelectElement;
    const fieldOptions = Array.from(
      fieldSelect.querySelectorAll("option")
    ).map((o) => o.textContent);
    expect(fieldOptions).toContain("Field 7");
    expect(fieldOptions.every((label) => label !== "Field 12-South")).toBe(
      true
    );
  });

  it("shows a success Alert after saving and clears the form", async () => {
    render(<DraftApplicationRecordForm />);
    const user = await fillValidDraft();
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Draft saved/i);

    expect(
      (screen.getByLabelText("Crop or site") as HTMLInputElement).value
    ).toBe("");
  });
});

describe("DraftApplicationRecordForm weather capture", () => {
  it("populates temperature, wind speed, and wind direction from a successful NWS reading", async () => {
    const user = userEvent.setup();
    render(
      <DraftApplicationRecordForm
        weatherService={fakeWeatherService(okWeather)}
        getCoordinate={fakeGeolocator(okGeo)}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /capture from nws/i })
    );

    await waitFor(() => {
      expect(
        (screen.getByLabelText("Temperature") as HTMLInputElement).value
      ).toBe("72F");
    });
    expect(
      (screen.getByLabelText("Wind speed") as HTMLInputElement).value
    ).toBe("3.4 mph");
    expect(
      (screen.getByLabelText("Wind direction") as HTMLInputElement).value
    ).toBe("S");
    expect(
      screen.getByTestId("weather-provenance-chip").textContent
    ).toMatch(/KSGF/);
  });

  it("persists a weatherSnapshot on the draft after capture + save", async () => {
    const user = userEvent.setup();
    render(
      <DraftApplicationRecordForm
        weatherService={fakeWeatherService(okWeather)}
        getCoordinate={fakeGeolocator(okGeo)}
      />
    );

    await screen.findByRole("option", {
      name: /John Smith.*Smith Spray Services/,
    });

    await user.selectOptions(
      screen.getByLabelText("Organization"),
      "org-demo-semofarms"
    );
    await user.selectOptions(
      screen.getByLabelText("Applicator"),
      "applicator-john-smith"
    );
    await user.selectOptions(screen.getByLabelText("Farm"), "farm-north");
    await user.selectOptions(screen.getByLabelText("Field"), "field-7");
    await pickProduct(user);
    await user.type(screen.getByLabelText("Crop or site"), "Soybeans");
    await user.type(screen.getByLabelText("Acres treated"), "42.5");
    await user.type(screen.getByLabelText("Application date"), "2026-05-19");
    await user.type(screen.getByLabelText("Start time"), "08:00");
    await user.type(
      screen.getByLabelText("Application method"),
      "Ground broadcast"
    );
    await user.type(screen.getByLabelText("Rate applied"), "1 qt/ac");
    await user.type(screen.getByLabelText("Total amount applied"), "10 gal");

    await user.click(
      screen.getByRole("button", { name: /capture from nws/i })
    );
    await screen.findByTestId("weather-provenance-chip");

    await user.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(async () => {
      expect(await db.applicationRecords.count()).toBe(1);
    });
    const [record] = await db.applicationRecords.toArray();
    expect(record.contractorInputs.weatherSnapshot).toEqual({
      source: "nws_observation",
      stationId: "KSGF",
      observedAt: "2026-05-19T12:00:00+00:00",
      capturedAt: "2026-05-19T12:00:30.000Z",
    });
  });

  it("does not block submit when geolocation permission is denied (manual override)", async () => {
    const user = userEvent.setup();
    const geolocator = fakeGeolocator({ kind: "permission_denied" });
    const weather = fakeWeatherService(okWeather);
    render(
      <DraftApplicationRecordForm
        weatherService={weather}
        getCoordinate={geolocator}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /capture from nws/i })
    );

    const alert = await screen.findByTestId("weather-capture-alert");
    expect(alert.textContent).toMatch(/permission denied/i);
    expect(weather.fetchCurrent).not.toHaveBeenCalled();

    expect(
      (screen.getByLabelText("Temperature") as HTMLInputElement).disabled
    ).toBe(false);
  });

  it("falls back to manual entry on weather timeout and surfaces a banner without throwing", async () => {
    const user = userEvent.setup();
    render(
      <DraftApplicationRecordForm
        weatherService={fakeWeatherService({ kind: "timeout" })}
        getCoordinate={fakeGeolocator(okGeo)}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /capture from nws/i })
    );

    const alert = await screen.findByTestId("weather-capture-alert");
    expect(alert.textContent).toMatch(/timed out/i);
  });

  it("does not save a weatherSnapshot when capture was never triggered", async () => {
    const user = userEvent.setup();
    render(<DraftApplicationRecordForm />);

    await screen.findByRole("option", {
      name: /John Smith.*Smith Spray Services/,
    });

    await user.selectOptions(
      screen.getByLabelText("Organization"),
      "org-demo-semofarms"
    );
    await user.selectOptions(
      screen.getByLabelText("Applicator"),
      "applicator-john-smith"
    );
    await user.selectOptions(screen.getByLabelText("Farm"), "farm-north");
    await user.selectOptions(screen.getByLabelText("Field"), "field-7");
    await pickProduct(user);
    await user.type(screen.getByLabelText("Crop or site"), "Soybeans");
    await user.type(screen.getByLabelText("Acres treated"), "42.5");
    await user.type(screen.getByLabelText("Application date"), "2026-05-19");
    await user.type(screen.getByLabelText("Start time"), "08:00");
    await user.type(
      screen.getByLabelText("Application method"),
      "Ground broadcast"
    );
    await user.type(screen.getByLabelText("Rate applied"), "1 qt/ac");
    await user.type(screen.getByLabelText("Total amount applied"), "10 gal");
    await user.type(screen.getByLabelText("Temperature"), "72F");
    await user.type(screen.getByLabelText("Wind speed"), "5 mph");
    await user.type(screen.getByLabelText("Wind direction"), "S");

    await user.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(async () => {
      expect(await db.applicationRecords.count()).toBe(1);
    });
    const [record] = await db.applicationRecords.toArray();
    expect(record.contractorInputs.weatherSnapshot).toBeUndefined();
    expect(record.contractorInputs.temperature).toBe("72F");
  });
});

describe("App + DraftApplicationRecordForm integration", () => {
  it("new draft appears in the Drafts list after save", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 2, name: /Records \(0\)/ })
    ).toBeTruthy();

    const user = await fillValidDraft();
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    expect(
      await screen.findByRole("heading", { level: 2, name: /Records \(1\)/ })
    ).toBeTruthy();
    expect(await screen.findByText("draft")).toBeTruthy();
    expect(await screen.findByText("local_only")).toBeTruthy();
  });

  it("submitted draft persists across a remount (refresh)", async () => {
    const first = render(<App />);

    const user = await fillValidDraft();
    await user.click(screen.getByRole("button", { name: /save draft/i }));
    await screen.findByRole("heading", { level: 2, name: /Records \(1\)/ });

    first.unmount();

    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 2, name: /Records \(1\)/ })
    ).toBeTruthy();
    expect(await screen.findByText("draft")).toBeTruthy();
    expect(await screen.findByText("local_only")).toBeTruthy();
  });
});

describe("DraftApplicationRecordForm Product Autocomplete", () => {
  async function seedSecondProduct() {
    await db.products.put({
      id: "product-roundup-powermax",
      catalogVersion: "MO-DEMO-2026-05-19",
      name: "Roundup PowerMAX 3",
      epaRegistrationNumber: "524-475",
      rupStatus: "no",
      createdAt: "2026-05-19T00:00:00.000Z",
    });
  }

  it("renders an RUP chip beside each option in the dropdown", async () => {
    await seedSecondProduct();
    const user = userEvent.setup();
    render(<DraftApplicationRecordForm />);

    await user.click(await screen.findByLabelText("Product"));

    const yesOption = await screen.findByTestId(
      "product-option-product-example-herbicide-4l"
    );
    expect(yesOption.textContent).toMatch(/RUP/);

    const noOption = await screen.findByTestId(
      "product-option-product-roundup-powermax"
    );
    expect(noOption.textContent).toMatch(/Non-RUP/);
  });

  it("filters options by typed substring of the product name", async () => {
    await seedSecondProduct();
    const user = userEvent.setup();
    render(<DraftApplicationRecordForm />);

    const input = await screen.findByLabelText("Product");
    await user.click(input);
    await user.type(input, "Roundup");

    expect(
      await screen.findByTestId("product-option-product-roundup-powermax")
    ).toBeTruthy();
    expect(
      screen.queryByTestId("product-option-product-example-herbicide-4l")
    ).toBeNull();
  });

  it("filters options by EPA registration number substring", async () => {
    await seedSecondProduct();
    const user = userEvent.setup();
    render(<DraftApplicationRecordForm />);

    const input = await screen.findByLabelText("Product");
    await user.click(input);
    await user.type(input, "524-475");

    expect(
      await screen.findByTestId("product-option-product-roundup-powermax")
    ).toBeTruthy();
    expect(
      screen.queryByTestId("product-option-product-example-herbicide-4l")
    ).toBeNull();
  });

  it("shows the selected product's RUP chip below the input after selection", async () => {
    await seedSecondProduct();
    const user = userEvent.setup();
    render(<DraftApplicationRecordForm />);

    await user.click(await screen.findByLabelText("Product"));
    await user.click(
      await screen.findByTestId("product-option-product-example-herbicide-4l")
    );

    const summary = await screen.findByTestId("selected-product-summary");
    expect(summary.textContent).toMatch(/12345-678/);
    expect(summary.querySelector('[data-testid="rup-chip-yes"]')).toBeTruthy();
  });

  it("renders no selected-product summary when nothing is picked", async () => {
    render(<DraftApplicationRecordForm />);
    await screen.findByLabelText("Product");
    expect(screen.queryByTestId("selected-product-summary")).toBeNull();
  });

  it("surfaces the validation error when the form is submitted with no product", async () => {
    const user = userEvent.setup();
    render(<DraftApplicationRecordForm />);

    await user.click(screen.getByRole("button", { name: /save draft/i }));

    expect(await screen.findByText(/Product is required/i)).toBeTruthy();
  });
});
