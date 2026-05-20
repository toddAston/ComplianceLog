import { useEffect, useState } from "react";

export function OfflineBadge() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

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
