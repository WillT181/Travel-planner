/**
 * Tiny dependency-free PDF generator.
 *
 * Produces a single-page A4 PDF from a list of text lines. This avoids pulling
 * in a heavy PDF library for what is essentially a formatted text summary.
 * Uses the two standard Helvetica fonts (regular + bold), so no font embedding
 * is required. Text is WinAnsi; we deliberately avoid the £ glyph and write
 * "GBP" instead to sidestep encoding edge cases.
 */

export interface PdfLine {
  text: string;
  size?: number;
  bold?: boolean;
  /** Extra vertical gap (pt) before this line. */
  gapBefore?: number;
}

const PAGE_WIDTH = 595; // A4 @ 72dpi
const PAGE_HEIGHT = 842;
const MARGIN_X = 56;
const TOP_Y = 786;

function escapeText(text: string): string {
  return (
    text
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      // Drop anything outside basic latin to stay WinAnsi-safe.
      .replace(/[^\x20-\x7e]/g, "")
  );
}

function buildContentStream(lines: PdfLine[]): string {
  const parts: string[] = ["BT", `${MARGIN_X} ${TOP_Y} Td`];
  let firstLine = true;
  let prevSize = 0;

  for (const line of lines) {
    const size = line.size ?? 11;
    const leading = Math.round(size * 1.6);
    const gap = line.gapBefore ?? 0;

    if (firstLine) {
      firstLine = false;
    } else {
      parts.push(`0 ${-(leading + gap)} Td`);
    }

    const font = line.bold ? "/F2" : "/F1";
    if (size !== prevSize || true) {
      parts.push(`${font} ${size} Tf`);
      prevSize = size;
    }
    parts.push(`(${escapeText(line.text)}) Tj`);
  }

  parts.push("ET");
  return parts.join("\n");
}

/** Returns the PDF as a base64 string. */
export function buildPdf(lines: PdfLine[]): string {
  const content = buildContentStream(lines);

  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
  objects[3] =
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
    `/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`;
  objects[4] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[5] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objects[6] = `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(pdf, "latin1");
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  const count = objects.length; // includes the free object 0
  pdf += `xref\n0 ${count}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < objects.length; i++) {
    pdf += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1").toString("base64");
}
