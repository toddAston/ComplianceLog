import { registerSW } from "virtual:pwa-register";

export type PWAEvents = {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisterError?: (error: unknown) => void;
};

export function registerFieldLogSW(events: PWAEvents = {}) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: events.onNeedRefresh,
    onOfflineReady: events.onOfflineReady,
    onRegisterError: events.onRegisterError,
  });
  return updateSW;
}
