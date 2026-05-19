type ApplicationRecordForm = {
  applicator: {
    name: string;
    company?: string;
    certificationNumber?: string;
  };

  fieldSite: {
    farmName: string;
    fieldName: string;
    cropOrSite: string;
    acresTreated: number | null;
  };

  product: {
    productName: string;
    epaRegistrationNumber?: string;
    rupStatus: "yes" | "no" | "unknown";
    productCatalogId?: string;
  };

  applicationDetails: {
    applicationDate: string;
    startTime: string;
    endTime?: string;
    applicationMethod: string;
    rateApplied: string;
    totalAmountApplied: string;
  };

  weatherConditions: {
    temperatureF: number | null;
    windSpeedMph: number | null;
    windDirection: string;
    weatherNotes?: string;
  };

  attestation: {
    confirmed: boolean;
  };
};