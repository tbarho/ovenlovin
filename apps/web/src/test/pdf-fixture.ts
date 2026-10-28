import { deflateSync } from "node:zlib";

/**
 * Tiny hand-built PDFs. A 50MB fixture is impractical in CI; page counting
 * and the upload path only care about structure, not size.
 */
export const pdfBytes = (text: string) => new Uint8Array(Buffer.from(text, "latin1"));

export const pageObjects = (count: number, first = 3) =>
  Array.from(
    { length: count },
    (_, index) => `${first + index} 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n`
  ).join("");

export function plainPdf(pages: number) {
  const kids = Array.from({ length: pages }, (_, index) => `${3 + index} 0 R`).join(" ");
  return pdfBytes(
    `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
      `2 0 obj\n<< /Kids [${kids}] /Count ${pages} /Type /Pages >>\nendobj\n` +
      pageObjects(pages) +
      `trailer\n<< /Root 1 0 R >>\n%%EOF\n`
  );
}

/** PDF 1.5 style: the page tree lives inside a compressed object stream. */
export function packedPdf(pages: number) {
  const packed = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Count ${pages} /Kids [] >>`,
  ];
  const header = packed
    .reduce(
      (memo: { parts: string[]; offset: number }, body, index) => ({
        parts: [...memo.parts, `${index + 1} ${memo.offset}`],
        offset: memo.offset + body.length + 1,
      }),
      { parts: [], offset: 0 }
    )
    .parts.join(" ");
  const content = `${header}\n${packed.join("\n")}\n`;
  const data = deflateSync(Buffer.from(content, "latin1")).toString("latin1");
  return pdfBytes(
    `%PDF-1.5\n9 0 obj\n<< /Type /ObjStm /N 2 /First ${header.length + 1} /Filter /FlateDecode /Length ${data.length} >>\nstream\n${data}\nendstream\nendobj\n%%EOF\n`
  );
}
