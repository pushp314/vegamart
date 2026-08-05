import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export interface ExportColumn {
  key: string;
  header: string;
}

export type ExportFormat = "csv" | "xlsx" | "pdf";

export function toCsv(columns: ExportColumn[], rows: Array<Record<string, unknown>>): string {
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map((c) => escape(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => escape(row[c.key])).join(","));
  return [header, ...body].join("\r\n");
}

export async function toXlsx(
  columns: ExportColumn[],
  rows: Array<Record<string, unknown>>,
  sheetName = "Report"
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "VegaMart";
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));

  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(12, c.header.length + 6) }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(row);
  }

  return workbook.xlsx.writeBuffer().then((buf) => Buffer.from(buf));
}

export async function toPdf(
  columns: ExportColumn[],
  rows: Array<Record<string, unknown>>,
  title = "Report"
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 36, size: "A4", bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(16).text(title, { align: "center" });
  doc.moveDown();

  const tableTop = 110;
  const pageWidth = doc.page.width - 72;
  const columnWidths = columns.map((c) => {
    const maxHeader = c.header.length + 4;
    const maxCell = rows.reduce((acc, row) => {
      const len = String(row[c.key] ?? "").length + 2;
      return Math.max(acc, len);
    }, 0);
    return Math.max(maxHeader, Math.min(maxCell, 28));
  });
  const totalWidth = columnWidths.reduce((a, b) => a + b, 0);
  const scale = totalWidth > pageWidth ? pageWidth / totalWidth : 1;
  const widths = columnWidths.map((w) => w * scale);

  doc.font("Helvetica-Bold").fontSize(8);
  let x = 36;
  let y = tableTop;
  columns.forEach((c, i) => {
    doc.text(c.header, x + 2, y + 2, { width: widths[i]! - 4 });
    x += widths[i]!;
  });

  doc.moveTo(36, y + 16).lineTo(36 + pageWidth, y + 16).stroke();

  doc.font("Helvetica").fontSize(8);
  y = tableTop + 22;
  for (const row of rows) {
    if (y > doc.page.height - 72) {
      doc.addPage();
      y = 50;
    }
    x = 36;
    columns.forEach((c, i) => {
      doc.text(String(row[c.key] ?? ""), x + 2, y + 2, { width: widths[i]! - 4 });
      x += widths[i]!;
    });
    y += 16;
  }

  doc.end();
  return done;
}

export function contentDisposition(filename: string, format: ExportFormat): string {
  const ext = format === "xlsx" ? "xlsx" : format;
  return `attachment; filename="${filename}.${ext}"`;
}
