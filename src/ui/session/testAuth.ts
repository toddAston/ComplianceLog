// Test-only helper: pre-populate the demo session in localStorage so that
// rendering <App /> in an integration test skips the /login redirect and
// lands on the deep-linked route. SessionProvider hydrates from the same
// key on mount. Production code does not import this module.
//
// Use in beforeEach of any test that calls `render(<App />)` and wants to
// land somewhere other than /login.
export function authenticateForTests(role: "contractor" | "manager"): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    "fieldlog-demo-session",
    JSON.stringify({ role })
  );
}

export function clearTestAuth(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("fieldlog-demo-session");
}
