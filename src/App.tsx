import {
  useAllApplicators,
  useAllFarms,
  useAllFields,
  useAllOrganizations,
  useAllProducts,
} from "./db/queries";

function App() {
  const organizations = useAllOrganizations();
  const farms = useAllFarms();
  const fields = useAllFields();
  const applicators = useAllApplicators();
  const products = useAllProducts();

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "1.5rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>FieldLog — Seed Debug</h1>
      <p style={{ color: "#555" }}>
        Read-only view of seeded reference data. Confirms IndexedDB persistence and Dexie reactivity.
      </p>

      <section>
        <h2>Organizations ({organizations.length})</h2>
        <ul>
          {organizations.map((o) => (
            <li key={o.id}>
              {o.name} <code style={{ color: "#888" }}>({o.id})</code>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Farms ({farms.length})</h2>
        <ul>
          {farms.map((f) => (
            <li key={f.id}>{f.name}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Fields ({fields.length})</h2>
        <ul>
          {fields.map((f) => (
            <li key={f.id}>
              {f.name}
              {f.defaultCropOrSite ? ` — ${f.defaultCropOrSite}` : ""}
              {f.defaultAcres != null ? ` (${f.defaultAcres} ac)` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Applicators ({applicators.length})</h2>
        <ul>
          {applicators.map((a) => (
            <li key={a.id}>
              {a.applicatorName} — {a.contractorCompanyName}
              {a.certificationNumber ? ` (cert #${a.certificationNumber})` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Products ({products.length})</h2>
        <ul>
          {products.map((p) => (
            <li key={p.id}>
              {p.name} — EPA {p.epaRegistrationNumber} — RUP: {p.rupStatus}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export default App;
