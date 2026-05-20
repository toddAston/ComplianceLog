import { createHttpTransport } from "./httpTransport";
import { createLoopbackTransport } from "./loopbackTransport";
import type { SyncTransport } from "./transport";

// App-wide transport selection. With no backend deployed, VITE_API_URL is unset and
// we use the in-memory loopback so the offline→online flow is fully demoable. Set
// VITE_API_URL to point at the real server (server/) once it's running.
const apiUrl =
  typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_URL : undefined;

export const defaultTransport: SyncTransport = apiUrl
  ? createHttpTransport(apiUrl)
  : createLoopbackTransport();
