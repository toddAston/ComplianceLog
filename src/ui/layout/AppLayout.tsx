import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { OfflineBadge } from "../system/OfflineBadge";

export function AppLayout() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--color-background)" }}>
      <AppHeader />
      <main
        style={{
          paddingTop: 56 + 16,
          paddingBottom: 32,
          paddingLeft: 16,
          paddingRight: 16,
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <div style={{ position: "fixed", top: 64, right: 16, zIndex: 30 }}>
          <OfflineBadge />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
