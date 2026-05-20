import { useOnlineStatus } from "./useOnlineStatus";

export function OfflineBadge() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: "#fff4e5",
        border: "1px solid #f0b35a",
        color: "#5d3a00",
        padding: "0.5rem 0.75rem",
        borderRadius: 4,
        fontSize: "0.85rem",
        marginBottom: "1rem",
      }}
    >
      Offline — changes save locally and sync when you reconnect.
    </div>
  );
}
