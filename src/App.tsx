import {
  useAllApplicationRecords,
  useAllApplicators,
  useAllFarms,
  useAllFields,
  useAllOrganizations,
  useAllProducts,
} from "./db/queries";
import { DraftApplicationRecordForm } from "./ui/application-record/DraftApplicationRecordForm";

function App() {
  const organizations = useAllOrganizations();
  const farms = useAllFarms();
  const fields = useAllFields();
  const applicators = useAllApplicators();
  const products = useAllProducts();
  const applicationRecords = useAllApplicationRecords();

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "1.5rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>FieldLog</h1>
      <p style={{ color: "#555" }}>
        Offline-first pesticide application recordkeeping. This screen captures
        a contractor draft locally; submission and manager review are not yet
        wired in.
      </p>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>New application record (draft)</h2>
        <DraftApplicationRecordForm />
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Drafts ({applicationRecords.length})</h2>
        {applicationRecords.length === 0 ? (
          <p style={{ color: "#888" }}>No drafts yet.</p>
        ) : (
          <ul>
            {applicationRecords.map((r) => (
              <li key={r.id}>
                <code style={{ color: "#888" }}>{r.id.slice(0, 8)}</code>
                {" — "}
                {r.contractorInputs.fieldName} /{" "}
                {r.contractorInputs.productName} —{" "}
                <span>{r.workflowStatus}</span>
                {" / "}
                <span>{r.syncStatus}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: "2rem", borderTop: "1px solid #eee", paddingTop: "1rem" }}>
        <h2 style={{ color: "#555" }}>Seed debug</h2>
        <p style={{ color: "#888", fontSize: "0.85rem" }}>
          Read-only view of seeded reference data. Confirms IndexedDB persistence and Dexie reactivity.
        </p>

        <h3>Organizations ({organizations.length})</h3>
        <ul>
          {organizations.map((o) => (
            <li key={o.id}>
              {o.name} <code style={{ color: "#888" }}>({o.id})</code>
            </li>
          ))}
        </ul>

        <h3>Farms ({farms.length})</h3>
        <ul>
          {farms.map((f) => (
            <li key={f.id}>{f.name}</li>
          ))}
        </ul>

        <h3>Fields ({fields.length})</h3>
        <ul>
          {fields.map((f) => (
            <li key={f.id}>
              {f.name}
              {f.defaultCropOrSite ? ` — ${f.defaultCropOrSite}` : ""}
              {f.defaultAcres != null ? ` (${f.defaultAcres} ac)` : ""}
            </li>
          ))}
        </ul>

        <h3>Applicators ({applicators.length})</h3>
        <ul>
          {applicators.map((a) => (
            <li key={a.id}>
              {a.applicatorName} — {a.contractorCompanyName}
              {a.certificationNumber ? ` (cert #${a.certificationNumber})` : ""}
            </li>
          ))}
        </ul>

        <h3>Products ({products.length})</h3>
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
