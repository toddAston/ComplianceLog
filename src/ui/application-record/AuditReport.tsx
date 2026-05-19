import type { ApplicationRecord, ApplicationRecordEvent } from "../../domain/types";
import type { ComplianceCheckResult } from "../../application/complianceRules";
import "./audit-report-print.css";

type Props = {
  record: ApplicationRecord;
  events: ApplicationRecordEvent[];
  complianceResults: ComplianceCheckResult[];
};

export function AuditReport({ record, events, complianceResults }: Props) {
  const ci = record.contractorInputs;
  const uniqueCitations = [
    ...new Map(
      complianceResults.map((r) => [r.citationShort, r.citation])
    ).entries(),
  ];

  return (
    <div className="audit-report">
      {/* Header */}
      <header className="audit-report__header">
        <h1>FieldLog Audit Report</h1>
        <p>
          <strong>Organization:</strong> {record.organizationId}
        </p>
        <p>
          <strong>Record ID:</strong> {record.id}
        </p>
        <p>
          <strong>Report Generated:</strong> {new Date().toLocaleString()}
        </p>
        <p>
          <strong>Workflow Status:</strong> {record.workflowStatus}
        </p>
      </header>

      {/* Record Summary */}
      <section className="audit-report__section">
        <h2>Application Record Summary</h2>
        <table className="audit-report__table">
          <tbody>
            <tr>
              <th>Applicator</th>
              <td>
                {ci.applicatorName} — {ci.company}
              </td>
            </tr>
            <tr>
              <th>Certification #</th>
              <td>{ci.certificationNumber || "Not provided"}</td>
            </tr>
            <tr>
              <th>Farm / Field</th>
              <td>
                {ci.farmName} / {ci.fieldName}
              </td>
            </tr>
            <tr>
              <th>Crop/Site</th>
              <td>{ci.cropOrSite}</td>
            </tr>
            <tr>
              <th>Acres Treated</th>
              <td>{ci.acresTreated}</td>
            </tr>
            <tr>
              <th>Product</th>
              <td>
                {ci.productName} (EPA Reg. #{ci.epaRegistrationNumber})
              </td>
            </tr>
            <tr>
              <th>Restricted Use</th>
              <td>{ci.rupStatus === "yes" ? "Yes" : ci.rupStatus === "no" ? "No" : "Unknown"}</td>
            </tr>
            <tr>
              <th>Application Date</th>
              <td>{ci.applicationDate}</td>
            </tr>
            <tr>
              <th>Time</th>
              <td>
                {ci.startTime}
                {ci.endTime ? ` – ${ci.endTime}` : ""}
              </td>
            </tr>
            <tr>
              <th>Method</th>
              <td>{ci.applicationMethod}</td>
            </tr>
            <tr>
              <th>Rate Applied</th>
              <td>{ci.rateApplied}</td>
            </tr>
            <tr>
              <th>Total Amount</th>
              <td>{ci.totalAmountApplied}</td>
            </tr>
            <tr>
              <th>Target Pest</th>
              <td>{ci.targetPest || "Not recorded"}</td>
            </tr>
            <tr>
              <th>Temperature</th>
              <td>{ci.temperature || "Not recorded"}</td>
            </tr>
            <tr>
              <th>Wind Speed</th>
              <td>{ci.windSpeed || "Not recorded"}</td>
            </tr>
            <tr>
              <th>Wind Direction</th>
              <td>{ci.windDirection || "Not recorded"}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Compliance Checks */}
      <section className="audit-report__section">
        <h2>Compliance Checks</h2>
        {complianceResults.length === 0 ? (
          <p className="audit-report__pass">✓ All required checks passed.</p>
        ) : (
          <table className="audit-report__table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Finding</th>
                <th>Citation</th>
              </tr>
            </thead>
            <tbody>
              {complianceResults.map((r) => (
                <tr key={r.ruleId}>
                  <td style={{ textTransform: "uppercase", fontWeight: 600 }}>
                    {r.severity}
                  </td>
                  <td>{r.message}</td>
                  <td>{r.citationShort}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Event Timeline */}
      <section className="audit-report__section">
        <h2>Event Timeline</h2>
        <table className="audit-report__table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Event</th>
              <th>Actor</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {events.map((evt) => (
              <tr key={evt.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  {new Date(evt.occurredAt).toLocaleString()}
                </td>
                <td>{evt.type}</td>
                <td>{evt.actorDisplayName || "—"}</td>
                <td>{evt.message || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Regulatory References */}
      {uniqueCitations.length > 0 && (
        <section className="audit-report__section">
          <h2>Regulatory References</h2>
          <ul>
            {uniqueCitations.map(([short, full]) => (
              <li key={short}>
                <strong>{short}</strong> — {full}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Disclaimer */}
      <footer className="audit-report__disclaimer">
        <p>
          <strong>Disclaimer:</strong> This report is generated by FieldLog. It
          provides source-linked recordkeeping data but does not guarantee
          regulatory compliance. Final compliance determination requires
          qualified human review. All regulatory citations are provided for
          reference only.
        </p>
      </footer>
    </div>
  );
}
