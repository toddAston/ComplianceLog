import { exportLockedApplicationRecord } from "./applicationRecordExport";
import { renderApplicationRecordPdf } from "./applicationRecordPdf";

// Triggers a browser-native download of the given blob. Extracted so the
// download flow can be unit-tested by stubbing this single seam.
export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on next tick so the click has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export type AuditPacketDownloadDeps = {
  triggerDownload?: typeof triggerDownload;
};

// Build the JSON audit packet (the same shape AuditReport / the export endpoint
// produce) and stream it to the user as a download. The exported DTO carries
// retainUntil, the source-linked complianceChecklist, the disclaimer, and the
// full event timeline — i.e. a self-contained audit packet.
export async function downloadAuditPacketJson(
  recordId: string,
  deps: AuditPacketDownloadDeps = {}
): Promise<void> {
  const dto = await exportLockedApplicationRecord(recordId);
  const blob = new Blob([JSON.stringify(dto, null, 2)], {
    type: "application/json",
  });
  const fileName = `application-record-${dto.recordId}.json`;
  (deps.triggerDownload ?? triggerDownload)(blob, fileName);
}

// Build the PDF audit packet (rendered via jsPDF + APPRIL layout) and stream
// it as a download. Uses the existing applicationRecordPdf renderer so the PDF
// stays consistent with the AuditReport printable view.
export async function downloadAuditPacketPdf(
  recordId: string,
  deps: AuditPacketDownloadDeps = {}
): Promise<void> {
  const dto = await exportLockedApplicationRecord(recordId);
  const { blob, fileName } = renderApplicationRecordPdf(dto);
  (deps.triggerDownload ?? triggerDownload)(blob, fileName);
}
