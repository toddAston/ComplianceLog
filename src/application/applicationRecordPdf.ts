import { jsPDF } from "jspdf";
import type { LockedApplicationRecordExport } from "./applicationRecordExport";
import { APPRIL_LAYOUT, type AppRilSectionDef } from "./apprilLayout";

export type ApplicationRecordPdfBlob = {
  blob: Blob;
  fileName: string;
};

function getByPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null) return acc;
    return (acc as Record<string, unknown>)[key];
  }, source);
}

function formatValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string" || typeof item === "number"
          ? String(item)
          : JSON.stringify(item)
      )
      .join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const PAGE_HEIGHT_PT = 792;
const PAGE_WIDTH_PT = 612;

export function renderApplicationRecordPdf(
  exportPayload: LockedApplicationRecordExport
): ApplicationRecordPdfBlob {
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: false });
  const { layout, sections } = APPRIL_LAYOUT;

  let y = layout.marginY;
  const maxY = PAGE_HEIGHT_PT - layout.marginY;
  const valueX = layout.marginX + layout.labelColumnWidth;
  const valueWidth = PAGE_WIDTH_PT - valueX - layout.marginX;

  const ensureRoom = (rows: number) => {
    if (y + rows * layout.lineHeight > maxY) {
      doc.addPage();
      y = layout.marginY;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(layout.titleFontSize);
  doc.text("Application Record", layout.marginX, y);
  y += layout.lineHeight + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(layout.metaFontSize);
  doc.text(`Record ID: ${exportPayload.recordId}`, layout.marginX, y);
  y += layout.lineHeight;
  doc.text(`Locked at: ${exportPayload.system.lockedAt}`, layout.marginX, y);
  y += layout.lineHeight;
  doc.text(
    `Organization: ${exportPayload.organizationId}`,
    layout.marginX,
    y
  );
  y += layout.sectionSpacing;

  for (const section of sections as ReadonlyArray<AppRilSectionDef>) {
    ensureRoom(2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(layout.sectionFontSize);
    doc.text(section.title, layout.marginX, y);
    y += layout.lineHeight;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(layout.bodyFontSize);

    for (const field of section.fields) {
      const value = formatValue(getByPath(exportPayload, field.path));
      const wrapped = doc.splitTextToSize(value, valueWidth) as string[];

      ensureRoom(wrapped.length);

      doc.text(`${field.label}:`, layout.marginX, y);
      doc.text(wrapped, valueX, y);
      y += layout.lineHeight * wrapped.length;
    }

    y += layout.sectionSpacing / 2;
  }

  ensureRoom(2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(layout.sectionFontSize);
  doc.text("Status history", layout.marginX, y);
  y += layout.lineHeight;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(layout.bodyFontSize);

  if (exportPayload.events.length === 0) {
    ensureRoom(1);
    doc.text("(no events recorded)", layout.marginX, y);
    y += layout.lineHeight;
  } else {
    for (const event of exportPayload.events) {
      const actor = event.actorDisplayName ?? event.actorUserId ?? "system";
      const line = `${event.occurredAt}  ${event.type}  ${actor}`;
      const note = event.message ? `  — ${event.message}` : "";
      const wrapped = doc.splitTextToSize(
        `${line}${note}`,
        PAGE_WIDTH_PT - layout.marginX * 2
      ) as string[];
      ensureRoom(wrapped.length);
      doc.text(wrapped, layout.marginX, y);
      y += layout.lineHeight * wrapped.length;
    }
  }

  const fileName = `application-record-${exportPayload.recordId}.pdf`;
  const blob = doc.output("blob");

  return { blob, fileName };
}
