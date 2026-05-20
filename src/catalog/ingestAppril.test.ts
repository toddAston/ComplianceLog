import { describe, expect, it } from "vitest";
import {
  ingestAppRilRows,
  isAcceptedRow,
  projectAppRilRow,
} from "./ingestAppril";

const roundupRow = {
  reg_num: "524-475",
  reg_type: "Sec3",
  product_name: "ROUNDUP POWERMAX 3",
  status_group: "Active",
  rup_flag: "N",
  signal_word: "CAUTION",
  pesticide_type: "Pesticide",
  pest_cat: "HERBICIDE TERRESTRIAL",
  sites: "AGRICULTURAL CROPS, SOYBEANS, CORN, COTTON",
  ais: "GLYPHOSATE, POTASSIUM SALT 48.7%; PC_Code 417300; CAS 70901-12-1",
};

const paraquatRow = {
  reg_num: "100-1431",
  reg_type: "Sec3",
  product_name: "GRAMOXONE SL 3.0",
  status_group: "Active",
  rup_flag: "Y",
  rup_reason: "Acute toxicity",
  signal_word: "DANGER",
  pesticide_type: "Pesticide",
  pest_cat: "HERBICIDE TERRESTRIAL",
  sites: "SOYBEANS, COTTON, CORN",
  ais: "PARAQUAT DICHLORIDE 30.1%; PC_Code 061601; CAS 1910-42-5",
};

const cancelledRow = {
  reg_num: "9999-1",
  reg_type: "Sec3",
  product_name: "Old Product",
  status_group: "Cancelled",
  rup_flag: "N",
  sites: "SOYBEANS",
};

const distributorRow = {
  reg_num: "524-475-12345",
  reg_type: "DP",
  product_name: "Distributor Repack",
  status_group: "Active",
  rup_flag: "N",
  sites: "SOYBEANS",
};

const malformedRow = {
  product_name: "Missing reg num",
  status_group: "Active",
};

describe("isAcceptedRow", () => {
  it("accepts an active Sec3 row when activeOnly + sec3Only are set", () => {
    expect(
      isAcceptedRow(roundupRow, {
        catalogVersion: "v1",
        activeOnly: true,
        sec3Only: true,
      })
    ).toBe(true);
  });

  it("rejects cancelled rows when activeOnly is set", () => {
    expect(
      isAcceptedRow(cancelledRow, {
        catalogVersion: "v1",
        activeOnly: true,
      })
    ).toBe(false);
  });

  it("rejects distributor products when sec3Only is set", () => {
    expect(
      isAcceptedRow(distributorRow, {
        catalogVersion: "v1",
        sec3Only: true,
      })
    ).toBe(false);
  });

  it("requires at least one of the site needles when siteIncludes is non-empty", () => {
    expect(
      isAcceptedRow(roundupRow, {
        catalogVersion: "v1",
        siteIncludes: ["soybean"],
      })
    ).toBe(true);
    expect(
      isAcceptedRow(roundupRow, {
        catalogVersion: "v1",
        siteIncludes: ["wineries", "mosquito"],
      })
    ).toBe(false);
  });
});

describe("projectAppRilRow", () => {
  it("maps a typical herbicide row to a CatalogProduct", () => {
    const product = projectAppRilRow(roundupRow);
    expect(product.epaRegistrationNumber).toBe("524-475");
    expect(product.name).toBe("ROUNDUP POWERMAX 3");
    expect(product.rupStatus).toBe("no");
    expect(product.useSites).toEqual([
      "AGRICULTURAL CROPS",
      "SOYBEANS",
      "CORN",
      "COTTON",
    ]);
    expect(product.activeIngredients.length).toBe(3);
  });

  it("maps RUP=Y to rupStatus 'yes' and carries rupReason verbatim", () => {
    const product = projectAppRilRow(paraquatRow);
    expect(product.rupStatus).toBe("yes");
    expect(product.rupReason).toBe("Acute toxicity");
    expect(product.signalWord).toBe("DANGER");
  });

  it("returns rupStatus 'unknown' when rup_flag is missing or unrecognized", () => {
    const product = projectAppRilRow({
      reg_num: "1-1",
      product_name: "Mystery",
      rup_flag: "Maybe",
    });
    expect(product.rupStatus).toBe("unknown");
  });

  it("treats empty CLOB fields as empty arrays, not undefined", () => {
    const product = projectAppRilRow({
      reg_num: "2-2",
      product_name: "Bare",
    });
    expect(product.pestCategories).toEqual([]);
    expect(product.useSites).toEqual([]);
    expect(product.activeIngredients).toEqual([]);
  });
});

describe("ingestAppRilRows", () => {
  it("filters, deduplicates, and sorts by registration number", () => {
    const result = ingestAppRilRows(
      [
        paraquatRow,
        roundupRow,
        cancelledRow,
        distributorRow,
        malformedRow,
        roundupRow,
      ],
      {
        catalogVersion: "MO-SEED-2026-05-19",
        activeOnly: true,
        sec3Only: true,
        siteIncludes: ["soybean", "corn", "cotton"],
      }
    );
    expect(result.catalogVersion).toBe("MO-SEED-2026-05-19");
    expect(result.products.map((p) => p.epaRegistrationNumber)).toEqual([
      "100-1431",
      "524-475",
    ]);
  });

  it("returns an empty product list when no rows match", () => {
    const result = ingestAppRilRows(
      [cancelledRow],
      { catalogVersion: "v1", activeOnly: true }
    );
    expect(result.products).toEqual([]);
  });

  it("ignores rows missing the required reg_num", () => {
    const result = ingestAppRilRows(
      [malformedRow],
      { catalogVersion: "v1" }
    );
    expect(result.products).toEqual([]);
  });
});
