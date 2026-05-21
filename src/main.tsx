import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import "./index.css";
import App from "./App.tsx";
import { seedDemoData, seedDemoRecords } from "./db/seed";
import { seedMoCatalog } from "./catalog/seedMoCatalog";
import { backfillSubmitterIdentity } from "./db/backfillSubmitterIdentity";
import { backfillProductSnapshots } from "./db/backfillProductSnapshots";
import { backfillDemoReferenceData } from "./db/backfillDemoReferenceData";
import { registerFieldLogSW } from "./pwa/registerSW";
import { fieldlogTheme } from "./ui/theme";

// Order matters: reference data first, then records (which depend on it),
// then heals. Heals are idempotent and only do work on stale rows; the
// records seed populates fresh ones with everything in place.
Promise.all([
  seedDemoData(),
  seedMoCatalog(),
])
  // Reference-data heal runs BEFORE records seed so the records' foreign keys
  // (farmId / fieldId / applicatorId) all resolve. Records seed itself is
  // idempotent and short-circuits on re-boot.
  .then(() => backfillDemoReferenceData())
  .then(() => seedDemoRecords())
  .then(() =>
    Promise.all([backfillSubmitterIdentity(), backfillProductSnapshots()])
  )
  .finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider theme={fieldlogTheme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </StrictMode>
  );
});

if (import.meta.env.PROD) {
  registerFieldLogSW({
    onNeedRefresh: () => {
      window.dispatchEvent(new CustomEvent("fieldlog:sw-needs-refresh"));
    },
    onOfflineReady: () => {
      window.dispatchEvent(new CustomEvent("fieldlog:sw-offline-ready"));
    },
    onRegisterError: (error) => {
      console.error("[fieldlog] service worker registration failed", error);
    },
  });
}
