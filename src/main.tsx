import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { seedDemoData } from "./db/seed";
import { registerFieldLogSW } from "./pwa/registerSW";

seedDemoData().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
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
