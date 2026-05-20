export type AppRilFieldDef = {
  label: string;
  path: string;
};

export type AppRilSectionDef = {
  id: string;
  title: string;
  fields: ReadonlyArray<AppRilFieldDef>;
};

export const APPRIL_LAYOUT = {
  layout: {
    pageSize: "letter" as const,
    unit: "pt" as const,
    marginX: 54,
    marginY: 54,
    titleFontSize: 16,
    sectionFontSize: 12,
    metaFontSize: 10,
    bodyFontSize: 10,
    lineHeight: 14,
    sectionSpacing: 18,
    labelColumnWidth: 160,
  },

  sections: [
    {
      id: "applicator",
      title: "Applicator",
      fields: [
        { label: "Applicator name", path: "contractorInputs.applicatorName" },
        { label: "Company", path: "contractorInputs.company" },
        { label: "Certification #", path: "contractorInputs.certificationNumber" },
      ],
    },
    {
      id: "farm-field",
      title: "Farm / Field",
      fields: [
        { label: "Farm", path: "contractorInputs.farmName" },
        { label: "Field", path: "contractorInputs.fieldName" },
        { label: "Crop / site", path: "contractorInputs.cropOrSite" },
        { label: "Acres treated", path: "contractorInputs.acresTreated" },
      ],
    },
    {
      id: "product",
      title: "Product snapshot at submit",
      fields: [
        { label: "Product name", path: "productSnapshot.productName" },
        { label: "EPA registration #", path: "productSnapshot.epaRegistrationNumber" },
        { label: "RUP status", path: "productSnapshot.rupStatus" },
        { label: "Catalog version", path: "productSnapshot.catalogVersion" },
        { label: "Snapshot taken at", path: "productSnapshot.snapshotCreatedAt" },
      ],
    },
    {
      id: "application",
      title: "Application details",
      fields: [
        { label: "Application date", path: "contractorInputs.applicationDate" },
        { label: "Start time", path: "contractorInputs.startTime" },
        { label: "End time", path: "contractorInputs.endTime" },
        { label: "Application method", path: "contractorInputs.applicationMethod" },
        { label: "Target pest", path: "contractorInputs.targetPest" },
        { label: "Rate applied", path: "contractorInputs.rateApplied" },
        { label: "Total amount applied", path: "contractorInputs.totalAmountApplied" },
        { label: "PHI", path: "contractorInputs.phi" },
      ],
    },
    {
      id: "weather",
      title: "Weather at application",
      fields: [
        { label: "Temperature", path: "contractorInputs.temperature" },
        { label: "Wind speed", path: "contractorInputs.windSpeed" },
        { label: "Wind direction", path: "contractorInputs.windDirection" },
        { label: "Weather notes", path: "contractorInputs.weatherNotes" },
      ],
    },
    {
      id: "review",
      title: "Manager review",
      fields: [
        { label: "Reviewed by", path: "managerReview.reviewedBy" },
        { label: "Reviewed at", path: "managerReview.reviewedAt" },
        { label: "Review notes", path: "managerReview.reviewNotes" },
      ],
    },
    {
      id: "system",
      title: "System",
      fields: [
        { label: "Created at", path: "system.createdAt" },
        { label: "Created offline", path: "system.createdOffline" },
        { label: "Locked at", path: "system.lockedAt" },
      ],
    },
  ] as const satisfies ReadonlyArray<AppRilSectionDef>,
};
