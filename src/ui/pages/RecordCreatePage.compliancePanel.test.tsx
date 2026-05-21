import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticateForTests } from "../session/testAuth";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";
import { db } from "../../db/fieldlogDb";
import { seedDemoData } from "../../db/seed";

// The global test setup (src/test/setup.ts) only wires fake-indexeddb; it does
// NOT register Testing Library cleanup, so each integration test must reset the
// DOM and Dexie state explicitly. See ComplianceChecklistPanel.test.tsx for the
// same afterEach pattern.
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedDemoData();
  // Pre-authenticate so RequireAuth doesn't bounce the deep link to /login.
  authenticateForTests("contractor");
  window.history.pushState({}, "", "/records/new");
});

afterEach(() => {
  cleanup();
});

async function clickNext(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Next/i }));
}

async function selectFarmAndField(user: ReturnType<typeof userEvent.setup>) {
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
}

async function selectProduct(user: ReturnType<typeof userEvent.setup>) {
  const productSelect = (await screen.findByLabelText(/Product/i)) as HTMLSelectElement;
  await waitFor(() => {
    expect(
      Array.from(productSelect.options).some(
        (o) => o.value === "product-example-herbicide-4l"
      )
    ).toBe(true);
  });
  await user.selectOptions(productSelect, "product-example-herbicide-4l");
}

async function fillApplicationDetails(user: ReturnType<typeof userEvent.setup>) {
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
}

async function fillWeather(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Temperature/i), "72");
  await user.type(screen.getByLabelText(/Wind Speed/i), "5");
  await user.selectOptions(screen.getByLabelText(/Wind Direction/i), "NW");
}

describe("RecordCreatePage compliance panel integration", () => {
  it("mounts the compliance panel on the Review step with form-field nudges when nothing is filled in", async () => {
    render(<App />);
    const user = userEvent.setup();

    // Walk to Review with minimal entries (End Time is required to advance past
    // Step 3 since the polish bundle landed) so the panel is mounted but every
    // host-tracked required field other than Time End remains empty.
    await clickNext(user); // Step 1 → 2
    await clickNext(user); // Step 2 → 3
    await user.type(await screen.findByLabelText(/Time End/i), "11:30");
    await clickNext(user); // Step 3 → 4
    await clickNext(user); // Step 4 → 5

    // The shared panel is mounted inside the host.
    const panel = await screen.findByTestId("compliance-checklist-panel");
    expect(panel).toBeTruthy();

    // The form-fields nudge section is present and lists at least the
    // host-supplied form-level missing fields (Product, Target Pest, etc.).
    const formFields = within(panel).getByTestId("compliance-form-fields");
    expect(
      within(formFields).getByText(/Missing required field: Product/i)
    ).toBeTruthy();
    expect(
      within(formFields).getByText(/Missing required field: Target Pest/i)
    ).toBeTruthy();
    expect(
      within(formFields).getByText(/Missing required field: Rate per Acre/i)
    ).toBeTruthy();
    expect(
      within(formFields).getByText(/Missing required field: Total Amount/i)
    ).toBeTruthy();

    // The panel must NOT be in the all-clear state when there are surfaced
    // form-field nudges and engine failures.
    expect(screen.queryByText(/all clear/i)).toBeNull();
  });

  it("renders the engine's MISSING_REQUIRED_FIELD bucket on Review when no data was entered", async () => {
    render(<App />);
    const user = userEvent.setup();

    await clickNext(user); // Step 1 → 2
    await clickNext(user); // Step 2 → 3
    await user.type(await screen.findByLabelText(/Time End/i), "11:30");
    await clickNext(user); // Step 3 → 4
    await clickNext(user); // Step 4 → 5

    const panel = await screen.findByTestId("compliance-checklist-panel");
    // The engine's required-field rules (MISSING_PRODUCT_NAME, MISSING_EPA_REG,
    // MISSING_RATE_OR_AMOUNT, MISSING_TARGET_PEST, etc.) all carry
    // resultCode=MISSING_REQUIRED_FIELD and fire on an empty draft, so this
    // bucket section must be present alongside the form-level nudges.
    expect(
      within(panel).getByTestId("compliance-bucket-MISSING_REQUIRED_FIELD")
    ).toBeTruthy();
  });

  it("clears the MISSING_REQUIRED_FIELD bucket and the form-fields nudge when every required step is filled in", async () => {
    render(<App />);
    const user = userEvent.setup();

    // Step 1
    await selectFarmAndField(user);
    await clickNext(user);

    // Step 2 — pick product + acknowledge no SLN so slnNumber resolves to ""
    // (operator-confirmed not applicable) instead of leaving an unanswered flag.
    await selectProduct(user);
    await user.click(
      screen.getByLabelText(/no Special Local Need/i)
    );
    await clickNext(user);

    // Step 3
    await fillApplicationDetails(user);
    await clickNext(user);

    // Step 4
    await fillWeather(user);
    await clickNext(user);

    // Step 5 — tick the master label-review toggle so the eight
    // LABEL_VERIFICATION_REQUIRED items clear and the gate flips green.
    await user.click(await screen.findByTestId("label-reviewed-toggle"));

    // Step 5: panel is mounted, MISSING_REQUIRED_FIELD bucket should be gone
    // (no required-field rule fails), and the host-supplied form-fields nudge
    // section is absent because every host-tracked field is filled.
    const panel = await screen.findByTestId("compliance-checklist-panel");
    expect(panel).toBeTruthy();

    expect(
      within(panel).queryByTestId("compliance-bucket-MISSING_REQUIRED_FIELD")
    ).toBeNull();
    expect(
      within(panel).queryByTestId("compliance-form-fields")
    ).toBeNull();

    // GPS_EVIDENCE_UNKNOWN is a permanent NEEDS_REVIEW that has no appliesWhen
    // gate — in jsdom there is no navigator.geolocation so we can't capture
    // coords. The banner reads "1 item needs review" rather than "Passed", but
    // there must be no hard failures and no missing required fields.
    expect(screen.queryByText(/Compliance Check Failed/i)).toBeNull();
    expect(screen.getByText(/1 item needs review/i)).toBeTruthy();
  });

  it("surfaces a MISSING_REQUIRED_FIELD bucket on Review when Step 4 weather is skipped (outdoor wind + temperature rules)", async () => {
    render(<App />);
    const user = userEvent.setup();

    await selectFarmAndField(user);
    await clickNext(user);
    await selectProduct(user);
    await clickNext(user);
    await fillApplicationDetails(user);
    await clickNext(user);
    // Skip Step 4 — leave temperature, wind speed, wind direction blank.
    await clickNext(user);

    const panel = await screen.findByTestId("compliance-checklist-panel");
    const missingBucket = within(panel).getByTestId(
      "compliance-bucket-MISSING_REQUIRED_FIELD"
    );
    expect(missingBucket).toBeTruthy();

    // Both MISSING_WIND and MISSING_AIR_TEMPERATURE map to resultCode
    // MISSING_REQUIRED_FIELD with citationShort "2 CSR 70-25.120(M)". The
    // bucket's bodies render the rule's `message`, which we assert by id.
    expect(
      within(missingBucket).getByText(/MISSING_WIND/)
    ).toBeTruthy();
    expect(
      within(missingBucket).getByText(/MISSING_AIR_TEMPERATURE/)
    ).toBeTruthy();
    expect(
      within(missingBucket).getAllByText(/2 CSR 70-25\.120\(M\)/).length
    ).toBeGreaterThan(0);

    // Required form-fields nudge is gone because all the host-tracked form
    // fields (Step 3) are filled — the only remaining issues are weather.
    expect(within(panel).queryByTestId("compliance-form-fields")).toBeNull();

    // Gate banner must NOT report passed when weather rules fail.
    expect(screen.queryByText(/Compliance Check Passed/i)).toBeNull();
    expect(screen.getByText(/Compliance Check Failed/i)).toBeTruthy();
  });
});

describe("RecordCreatePage polish — applicator category picker (Matrix #1)", () => {
  it("defaults to certified_commercial and surfaces all 8 enum options", async () => {
    render(<App />);
    const select = (await screen.findByLabelText(
      /Applicator Category/i
    )) as HTMLSelectElement;
    expect(select.value).toBe("certified_commercial");
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual([
      "certified_commercial",
      "certified_noncommercial",
      "public_operator",
      "private",
      "noncertified",
      "noncertified_rup",
      "technician",
      "trainee",
    ]);
  });

  it("switching to noncertified surfaces the matrix supervision NEEDS_REVIEW items on Review", async () => {
    render(<App />);
    const user = userEvent.setup();

    await selectFarmAndField(user);
    await user.selectOptions(
      screen.getByLabelText(/Applicator Category/i),
      "noncertified"
    );
    await clickNext(user);

    await selectProduct(user);
    await user.click(screen.getByLabelText(/no Special Local Need/i));
    await clickNext(user);

    await fillApplicationDetails(user);
    await clickNext(user);

    await fillWeather(user);
    await clickNext(user);

    await user.click(await screen.findByTestId("label-reviewed-toggle"));

    // The supervision rules are gated by noncertified|trainee|technician and
    // their resultCode is NEEDS_REVIEW. They live in the NEEDS_REVIEW bucket
    // because the acks are unset.
    const panel = await screen.findByTestId("compliance-checklist-panel");
    const needsReviewBucket = within(panel).getByTestId(
      "compliance-bucket-NEEDS_REVIEW"
    );
    expect(
      within(needsReviewBucket).getByText(/SUPERVISOR_NOT_IDENTIFIED/)
    ).toBeTruthy();
  });
});

describe("RecordCreatePage polish — End Time required (Step 3)", () => {
  it("disables Next on Step 3 until End Time is entered", async () => {
    render(<App />);
    const user = userEvent.setup();

    await selectFarmAndField(user);
    await clickNext(user);
    await selectProduct(user);
    await clickNext(user);

    // Step 3 reached — End Time is still empty so Next must be disabled.
    const nextBtn = screen.getByRole("button", {
      name: /^Next/i,
    }) as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);

    await user.type(screen.getByLabelText(/Time End/i), "11:30");
    expect(
      (screen.getByRole("button", { name: /^Next/i }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });
});

describe("RecordCreatePage polish — label-review master toggle (Matrix #51-#58)", () => {
  it("flipping the master toggle clears the LABEL_VERIFICATION_REQUIRED bucket", async () => {
    render(<App />);
    const user = userEvent.setup();

    await selectFarmAndField(user);
    await clickNext(user);
    await selectProduct(user);
    await user.click(screen.getByLabelText(/no Special Local Need/i));
    await clickNext(user);
    await fillApplicationDetails(user);
    await clickNext(user);
    await fillWeather(user);
    await clickNext(user);

    // Before flipping the toggle the bucket is present.
    const panel = await screen.findByTestId("compliance-checklist-panel");
    expect(
      within(panel).queryByTestId(
        "compliance-bucket-LABEL_VERIFICATION_REQUIRED"
      )
    ).toBeTruthy();

    await user.click(screen.getByTestId("label-reviewed-toggle"));

    expect(
      within(
        screen.getByTestId("compliance-checklist-panel")
      ).queryByTestId("compliance-bucket-LABEL_VERIFICATION_REQUIRED")
    ).toBeNull();
  });
});

describe("RecordCreatePage polish — banner reconciliation", () => {
  it("reads 'N items need review' when failures and missing fields are zero but review-required items remain", async () => {
    render(<App />);
    const user = userEvent.setup();

    await selectFarmAndField(user);
    await clickNext(user);
    await selectProduct(user);
    await user.click(screen.getByLabelText(/no Special Local Need/i));
    await clickNext(user);
    await fillApplicationDetails(user);
    await clickNext(user);
    await fillWeather(user);
    await clickNext(user);

    // Master toggle UNTICKED → many LABEL_VERIFICATION_REQUIRED items remain
    // but no failures and no missing required fields, so the banner must
    // surface "N items need review" (NOT "Failed", NOT "Passed").
    const banner = await screen.findByTestId("compliance-status-banner");
    expect(banner.textContent).toMatch(/items? needs? review/i);
    expect(banner.textContent).not.toMatch(/Compliance Check Failed/i);
    expect(banner.textContent).not.toMatch(/Compliance Check Passed/i);
  });
});

describe("RecordCreatePage polish — Step 2 SLN acknowledgment (Matrix #33)", () => {
  it("ticking the no-SLN checkbox clears the SLN_NUMBER_NOT_CONFIRMED rule", async () => {
    render(<App />);
    const user = userEvent.setup();

    await selectFarmAndField(user);
    await clickNext(user);
    await selectProduct(user);
    await clickNext(user);
    await fillApplicationDetails(user);
    await clickNext(user);
    await fillWeather(user);
    await clickNext(user);

    // Before ticking the no-SLN checkbox the rule fires (slnNumber is
    // undefined). The rule's id surfaces inside the NEEDS_REVIEW bucket.
    let panel = await screen.findByTestId("compliance-checklist-panel");
    expect(
      within(panel).queryByText(/SLN_NUMBER_NOT_CONFIRMED/)
    ).toBeTruthy();

    // Go back to Step 2, tick the no-SLN checkbox, walk back through Step 3
    // (End Time gate is satisfied because we already typed 11:30 earlier).
    await user.click(screen.getByRole("button", { name: /Back/i }));
    await user.click(screen.getByRole("button", { name: /Back/i }));
    await user.click(screen.getByRole("button", { name: /Back/i }));
    await user.click(screen.getByLabelText(/no Special Local Need/i));
    await clickNext(user);
    await clickNext(user);
    await clickNext(user);

    panel = await screen.findByTestId("compliance-checklist-panel");
    expect(within(panel).queryByText(/SLN_NUMBER_NOT_CONFIRMED/)).toBeNull();
  });
});

describe("RecordCreatePage polish — GPS capture button (Matrix #49/#72)", () => {
  it("calls navigator.geolocation.getCurrentPosition on click (NEVER on render) and stores coords", async () => {
    const getCurrentPosition = vi.fn(
      (
        success: (pos: {
          coords: { latitude: number; longitude: number };
        }) => void
      ) => {
        success({ coords: { latitude: 37.2, longitude: -89.7 } });
      }
    );
    const originalGeolocation = (navigator as Navigator & { geolocation?: unknown })
      .geolocation;
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition },
      configurable: true,
    });

    try {
      render(<App />);
      const user = userEvent.setup();

      await selectFarmAndField(user);
      await clickNext(user);
      await selectProduct(user);
      await clickNext(user);
      await fillApplicationDetails(user);
      await clickNext(user);

      // Step 4 reached. Geolocation must NOT have been called on render — the
      // critical safety contract for jsdom and offline-first.
      expect(getCurrentPosition).not.toHaveBeenCalled();

      await user.click(screen.getByTestId("gps-capture-button"));
      expect(getCurrentPosition).toHaveBeenCalledTimes(1);

      // Coords surface in the local display block.
      const coords = await screen.findByTestId("gps-coords-display");
      expect(coords.textContent).toMatch(/37\.2/);
      expect(coords.textContent).toMatch(/-89\.7/);
    } finally {
      if (originalGeolocation === undefined) {
        Reflect.deleteProperty(navigator, "geolocation");
      } else {
        Object.defineProperty(navigator, "geolocation", {
          value: originalGeolocation,
          configurable: true,
        });
      }
    }
  });

  it("surfaces an inline error and does not crash when navigator.geolocation is absent", async () => {
    const originalGeolocation = (navigator as Navigator & { geolocation?: unknown })
      .geolocation;
    // Force-absent geolocation by removing the property.
    Reflect.deleteProperty(navigator, "geolocation");

    try {
      render(<App />);
      const user = userEvent.setup();

      await selectFarmAndField(user);
      await clickNext(user);
      await selectProduct(user);
      await clickNext(user);
      await fillApplicationDetails(user);
      await clickNext(user);

      await user.click(screen.getByTestId("gps-capture-button"));
      const err = await screen.findByTestId("gps-error");
      expect(err.textContent).toMatch(/geolocation is not available/i);
    } finally {
      if (originalGeolocation !== undefined) {
        Object.defineProperty(navigator, "geolocation", {
          value: originalGeolocation,
          configurable: true,
        });
      }
    }
  });
});

describe("RecordCreatePage polish — weather capture metadata auto-populate (Matrix #46/#47/#48)", () => {
  it("saves weatherCaptureSource='manual' + timestamp + location when operator entered weather", async () => {
    render(<App />);
    const user = userEvent.setup();

    await selectFarmAndField(user);
    await clickNext(user);
    await selectProduct(user);
    await user.click(screen.getByLabelText(/no Special Local Need/i));
    await clickNext(user);
    await fillApplicationDetails(user);
    await clickNext(user);
    await fillWeather(user);
    await clickNext(user);

    // Save the draft via the outer Save Draft button.
    const saveButtons = screen.getAllByRole("button", { name: /Save Draft/i });
    await user.click(saveButtons[0]);

    await screen.findByRole("heading", { level: 1, name: /^Records$/ });

    await waitFor(async () => {
      expect(await db.applicationRecords.count()).toBe(1);
    });
    const [record] = await db.applicationRecords.toArray();
    expect(record.contractorInputs.weatherCaptureSource).toBe("manual");
    expect(record.contractorInputs.weatherCaptureTimestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T/
    );
    expect(record.contractorInputs.weatherCaptureLocation).toBe(
      "North Farm — Field 7"
    );
  });

  it("leaves weather capture metadata undefined when no weather was entered", async () => {
    render(<App />);
    const user = userEvent.setup();

    await selectFarmAndField(user);
    await clickNext(user);
    await selectProduct(user);
    await user.click(screen.getByLabelText(/no Special Local Need/i));
    await clickNext(user);
    await fillApplicationDetails(user);
    await clickNext(user);
    // Skip Step 4 weather entirely.
    await clickNext(user);

    const saveButtons = screen.getAllByRole("button", { name: /Save Draft/i });
    await user.click(saveButtons[0]);

    await screen.findByRole("heading", { level: 1, name: /^Records$/ });

    await waitFor(async () => {
      expect(await db.applicationRecords.count()).toBe(1);
    });
    const [record] = await db.applicationRecords.toArray();
    expect(record.contractorInputs.weatherCaptureSource).toBeUndefined();
    expect(record.contractorInputs.weatherCaptureTimestamp).toBeUndefined();
    expect(record.contractorInputs.weatherCaptureLocation).toBeUndefined();
  });
});

describe("RecordCreatePage polish — saved draft contractorInputs round-trip", () => {
  it("persists applicatorCategory, slnNumber='', and all 8 label-review acks on save", async () => {
    render(<App />);
    const user = userEvent.setup();

    await selectFarmAndField(user);
    await user.selectOptions(
      screen.getByLabelText(/Applicator Category/i),
      "private"
    );
    await clickNext(user);
    await selectProduct(user);
    await user.click(screen.getByLabelText(/no Special Local Need/i));
    await clickNext(user);
    await fillApplicationDetails(user);
    await clickNext(user);
    await fillWeather(user);
    await clickNext(user);

    await user.click(screen.getByTestId("label-reviewed-toggle"));

    const saveButtons = screen.getAllByRole("button", { name: /Save Draft/i });
    await user.click(saveButtons[0]);

    await screen.findByRole("heading", { level: 1, name: /^Records$/ });

    await waitFor(async () => {
      expect(await db.applicationRecords.count()).toBe(1);
    });
    const [record] = await db.applicationRecords.toArray();
    const ci = record.contractorInputs;
    expect(ci.applicatorCategory).toBe("private");
    expect(ci.slnNumber).toBe("");
    expect(ci.productLabelRef).toMatch(/^https:\/\/example\.epa\.gov\/labels\//);
    expect(ci.labelVersionOrDate).toMatch(/^Demo: \d{4}-\d{2}-\d{2}$/);
    expect(ci.labelConsistencyReviewed).toBe(true);
    expect(ci.labelCropSiteReviewed).toBe(true);
    expect(ci.labelTargetPestReviewed).toBe(true);
    expect(ci.labelRateReviewed).toBe(true);
    expect(ci.labelTimingMethodReviewed).toBe(true);
    expect(ci.labelPpeReviewed).toBe(true);
    expect(ci.labelReiPhiReviewed).toBe(true);
    expect(ci.labelDriftBufferReviewed).toBe(true);
  });

  it("leaves slnNumber undefined when the no-SLN checkbox is NOT ticked", async () => {
    render(<App />);
    const user = userEvent.setup();

    await selectFarmAndField(user);
    await clickNext(user);
    await selectProduct(user);
    // Deliberately do NOT tick no-SLN — slnNumber must remain undefined
    // (operator has not yet answered).
    await clickNext(user);
    await fillApplicationDetails(user);
    await clickNext(user);
    await fillWeather(user);
    await clickNext(user);

    const saveButtons = screen.getAllByRole("button", { name: /Save Draft/i });
    await user.click(saveButtons[0]);

    await screen.findByRole("heading", { level: 1, name: /^Records$/ });

    await waitFor(async () => {
      expect(await db.applicationRecords.count()).toBe(1);
    });
    const [record] = await db.applicationRecords.toArray();
    expect(record.contractorInputs.slnNumber).toBeUndefined();
  });
});
