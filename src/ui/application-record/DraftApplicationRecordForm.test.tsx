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

describe("App + RecordCreatePage integration", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/records/new");
  });

  async function fillStepperDraft() {
    const user = userEvent.setup();
    const farmSelect = (await screen.findByLabelText(/Farm/i)) as HTMLSelectElement;
    await waitFor(() => {
      expect(
        Array.from(farmSelect.options).some((o) => o.value === "farm-north")
      ).toBe(true);
    });
    await user.selectOptions(farmSelect, "farm-north");
    const fieldSelect = screen.getByLabelText(/Field/i) as HTMLSelectElement;
    await waitFor(() => {
      expect(
        Array.from(fieldSelect.options).some((o) => o.value === "field-7")
      ).toBe(true);
    });
    await user.selectOptions(fieldSelect, "field-7");

    await user.click(screen.getByRole("button", { name: /Next/i }));
    const productSelect = (await screen.findByLabelText(/Product/i)) as HTMLSelectElement;
    await waitFor(() => {
      expect(
        Array.from(productSelect.options).some(
          (o) => o.value === "product-example-herbicide-4l"
        )
      ).toBe(true);
    });
    await user.selectOptions(productSelect, "product-example-herbicide-4l");
    return user;
  }

  it("a draft saved through the stepper appears in the records list", async () => {
    render(<App />);

    const user = await fillStepperDraft();
    await user.click(screen.getByRole("button", { name: /Save Draft/i }));

    // RecordsListPage now renders <DraftsList />, so the heading is just
    // "Records" (count surfaces per-row inside the list). DraftsList renders
    // the raw `syncStatus` enum inside its chip, hence "local_only".
    expect(
      await screen.findByRole("heading", { level: 1, name: /^Records$/ })
    ).toBeTruthy();
    expect(await screen.findByText("draft")).toBeTruthy();
    expect(await screen.findByText("local_only")).toBeTruthy();
  });

  it("a saved draft persists across a remount (refresh)", async () => {
    const first = render(<App />);

    const user = await fillStepperDraft();
    await user.click(screen.getByRole("button", { name: /Save Draft/i }));
    await screen.findByRole("heading", { level: 1, name: /^Records$/ });

    first.unmount();

    window.history.pushState({}, "", "/records");
    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 1, name: /^Records$/ })
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

  describe("autofill demo button", () => {
    it("renders the temporary autofill affordance in dev builds", async () => {
      render(<DraftApplicationRecordForm />);
      const btn = await screen.findByTestId("autofill-demo-button");
      expect(btn.textContent).toMatch(/fill with demo data/i);
    });

    it("populates required fields when clicked so the draft saves without manual entry", async () => {
      const user = userEvent.setup();
      render(<DraftApplicationRecordForm />);

      // Wait for reference data to load before clicking — the handler
      // pulls org/farm/field/applicator/product from Dexie hooks.
      await screen.findByRole("option", { name: "North Farm" });

      await user.click(await screen.findByTestId("autofill-demo-button"));

      await waitFor(() => {
        expect(
          (screen.getByLabelText("Organization") as HTMLSelectElement).value
        ).toBe("org-demo-semofarms");
      });
      expect(
        (screen.getByLabelText("Applicator") as HTMLSelectElement).value
      ).toBe("applicator-john-smith");
      expect(
        (screen.getByLabelText("Farm") as HTMLSelectElement).value
      ).toBe("farm-north");
      expect(
        (screen.getByLabelText("Field") as HTMLSelectElement).value
      ).toBe("field-7");
      expect(
        (screen.getByLabelText("Crop or site") as HTMLInputElement).value
      ).toBe("Soybeans");
      expect(
        (screen.getByLabelText("Acres treated") as HTMLInputElement).value
      ).toBe("42.5");
      expect(
        (screen.getByLabelText("Application date") as HTMLInputElement).value
      ).toBe("2026-05-19");
      expect(
        (screen.getByLabelText("Start time") as HTMLInputElement).value
      ).toBe("08:00");
      expect(
        (screen.getByLabelText("Application method") as HTMLInputElement).value
      ).toBe("Ground broadcast");
      expect(
        (screen.getByLabelText("Rate applied") as HTMLInputElement).value
      ).toBe("1 qt/ac");
      expect(
        (screen.getByLabelText("Total amount applied") as HTMLInputElement).value
      ).toBe("10 gal");
      expect(
        (screen.getByLabelText("Temperature") as HTMLInputElement).value
      ).toBe("72F");
      expect(
        (screen.getByLabelText("Wind speed") as HTMLInputElement).value
      ).toBe("5 mph");
      expect(
        (screen.getByLabelText("Wind direction") as HTMLInputElement).value
      ).toBe("S");
    });

    it("does not check the attestation box (contractor must still attest)", async () => {
      const user = userEvent.setup();
      render(<DraftApplicationRecordForm />);
      await screen.findByRole("option", { name: "North Farm" });

      await user.click(screen.getByTestId("autofill-demo-button"));

      const attestation = screen.getByRole("checkbox", {
        name: /attest these inputs/i,
      }) as HTMLInputElement;
      expect(attestation.checked).toBe(false);
    });

    it("results in a saved draft after click + attestation + submit", async () => {
      const user = userEvent.setup();
      render(<DraftApplicationRecordForm />);
      await screen.findByRole("option", { name: "North Farm" });

      await user.click(screen.getByTestId("autofill-demo-button"));
      await user.click(
        screen.getByRole("checkbox", { name: /attest these inputs/i })
      );
      await user.click(screen.getByRole("button", { name: /save draft/i }));

      await waitFor(async () => {
        expect(await db.applicationRecords.count()).toBe(1);
      });
      const [record] = await db.applicationRecords.toArray();
      expect(record.workflowStatus).toBe("draft");
      expect(record.contractorInputs.applicatorName).toBe("John Smith");
      expect(record.contractorInputs.fieldName).toBe("Field 7");
      expect(record.contractorInputs.attestationConfirmed).toBe(true);
    });

    it("is a no-op when reference data has not loaded yet", async () => {
      // Clear seeded data so the hooks return empty arrays. The button
      // should still exist (dev gate) but clicking it must not throw and
      // must not flip any field values.
      await Promise.all(db.tables.map((t) => t.clear()));
      const user = userEvent.setup();
      render(<DraftApplicationRecordForm />);

      const btn = await screen.findByTestId("autofill-demo-button");
      await user.click(btn);

      expect(
        (screen.getByLabelText("Organization") as HTMLSelectElement).value
      ).toBe("");
      expect(
        (screen.getByLabelText("Crop or site") as HTMLInputElement).value
      ).toBe("");
      expect(await db.applicationRecords.count()).toBe(0);
    });
  });
});

describe("RecordCreatePage compliance gate", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/records/new");
  });

  it("does NOT report compliance passed when the Review step is reached with no data", async () => {
    render(<App />);
    const user = userEvent.setup();

    // Walk to the Review step with only Time End filled (now required to
    // advance past Step 3) — every other host-tracked required field is still
    // empty, so the gate must still fail.
    await user.click(await screen.findByRole("button", { name: /Next/i }));
    await user.click(await screen.findByRole("button", { name: /Next/i }));
    await user.type(await screen.findByLabelText(/Time End/i), "11:30");
    await user.click(await screen.findByRole("button", { name: /Next/i }));
    await user.click(await screen.findByRole("button", { name: /Next/i }));

    expect(await screen.findByText(/Compliance Check Failed/i)).toBeTruthy();
    expect(screen.queryByText(/Compliance Check Passed/i)).toBeNull();
    expect(screen.getByText(/Missing required field: Product/i)).toBeTruthy();
    expect(screen.getByText(/Missing required field: Target Pest/i)).toBeTruthy();
  });

  it("reports compliance passed only after all required data and weather are entered", async () => {
    render(<App />);
    const user = userEvent.setup();

    // Step 1 — Farm & Field
    const farmSelect = (await screen.findByLabelText(/Farm/i)) as HTMLSelectElement;
    await waitFor(() =>
      expect(Array.from(farmSelect.options).some((o) => o.value === "farm-north")).toBe(true)
    );
    await user.selectOptions(farmSelect, "farm-north");
    const fieldSelect = screen.getByLabelText(/Field/i) as HTMLSelectElement;
    await waitFor(() =>
      expect(Array.from(fieldSelect.options).some((o) => o.value === "field-7")).toBe(true)
    );
    await user.selectOptions(fieldSelect, "field-7");
    await user.click(screen.getByRole("button", { name: /Next/i }));

    // Step 2 — Product (seeded as RUP "yes"; applicator carries a cert so RUP passes)
    const productSelect = (await screen.findByLabelText(/Product/i)) as HTMLSelectElement;
    await waitFor(() =>
      expect(
        Array.from(productSelect.options).some(
          (o) => o.value === "product-example-herbicide-4l"
        )
      ).toBe(true)
    );
    await user.selectOptions(productSelect, "product-example-herbicide-4l");
    // Acknowledge no SLN so the slnNumber field resolves to "" (operator-
    // confirmed not applicable) and the gate can clear.
    await user.click(screen.getByLabelText(/no Special Local Need/i));
    await user.click(screen.getByRole("button", { name: /Next/i }));

    // Step 3 — Application Details (date defaults to today)
    await user.type(screen.getByLabelText(/Time Start/i), "08:30");
    await user.type(screen.getByLabelText(/Time End/i), "11:30");
    await user.type(screen.getByLabelText(/Target Pest/i), "Broadleaf weeds");
    await user.type(screen.getByLabelText(/Rate per Acre/i), "22");
    await user.type(screen.getByLabelText(/Total Amount/i), "880");
    await user.type(screen.getByLabelText(/Acres Treated/i), "40");
    await user.type(
      screen.getByLabelText(/Requester Name/i),
      "Acme Producer Co."
    );
    await user.type(
      screen.getByLabelText(/Requester Address/i),
      "1234 Main St, Columbia, MO 65201"
    );
    await user.click(screen.getByRole("button", { name: /Next/i }));

    // Step 4 — Weather (clears the outdoor air-temperature + wind rules)
    await user.type(screen.getByLabelText(/Temperature/i), "72");
    await user.type(screen.getByLabelText(/Wind Speed/i), "5");
    await user.selectOptions(screen.getByLabelText(/Wind Direction/i), "NW");
    await user.click(screen.getByRole("button", { name: /Next/i }));

    // Step 5 — Review. Tick the master label-review toggle so the eight
    // LABEL_VERIFICATION_REQUIRED items clear. GPS_EVIDENCE_UNKNOWN remains a
    // NEEDS_REVIEW item (jsdom has no navigator.geolocation), so the banner
    // surfaces "1 item needs review" rather than "Passed" — that is the
    // correct, expected state when GPS evidence has not been captured.
    await user.click(await screen.findByTestId("label-reviewed-toggle"));
    expect(await screen.findByText(/1 item needs review/i)).toBeTruthy();
    expect(screen.queryByText(/Compliance Check Failed/i)).toBeNull();
  });
});
