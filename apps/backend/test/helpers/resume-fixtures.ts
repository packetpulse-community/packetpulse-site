import { strToU8, zipSync } from "fflate";

// Synthetic resumes for the TASK-024 tests. Everything is generated here: no real person's data.

export const SAMPLE_LINES = [
  "Asha Test",
  "Network Engineer",
  "",
  "EXPERIENCE",
  "Senior Network Engineer, Example Networks Pvt Ltd",
  "Jan 2019 - Present",
  "Network Engineer, Sample Telecom",
  "Mar 2015 - Dec 2018",
  "",
  "EDUCATION",
  "B.Tech in Computer Science, Example Institute of Technology",
  "2011 - 2015",
  "",
  "SKILLS",
  "OSPF, BGP, Cisco Routing, Python",
];

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/** A valid one-or-more-page PDF with a text layer (Helvetica), correct xref table. */
export function makePdf(lines: string[], opts: { extraDict?: string; linesPerPage?: number } = {}): Buffer {
  const perPage = opts.linesPerPage ?? 45;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  if (pages.length === 0) pages.push([]);

  const objs: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objs[1] = `<< /Type /Catalog /Pages 2 0 R${opts.extraDict ? " " + opts.extraDict : ""} >>`;
  objs[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((pl, i) => {
    const content = ["BT", "/F1 11 Tf", "14 TL", "50 780 Td", ...pl.map((l) => `(${esc(l)}) Tj T*`), "ET"].join("\n");
    objs[4 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`;
    objs[5 + i * 2] = `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`;
  });
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let n = 1; n < objs.length; n++) {
    offsets[n] = Buffer.byteLength(out, "latin1");
    out += `${n} 0 obj\n${objs[n]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let n = 1; n < objs.length; n++) out += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;

/** A minimal valid DOCX. `extra` adds or overrides zip entries (name -> content). */
export function makeDocx(lines: string[], extra: Record<string, string | Uint8Array> = {}): Buffer {
  const body = lines.map((l) => `<w:p><w:r><w:t xml:space="preserve">${xmlEsc(l)}</w:t></w:r></w:p>`).join("");
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(CONTENT_TYPES),
    "_rels/.rels": strToU8(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    "word/document.xml": strToU8(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`),
  };
  for (const [name, content] of Object.entries(extra)) files[name] = typeof content === "string" ? strToU8(content) : content;
  return Buffer.from(zipSync(files, { level: 6 }));
}

/** A DOCX that inflates to ~`megabytes` MB from a few KB (a zip bomb). */
export function makeZipBombDocx(megabytes = 40): Buffer {
  const huge = new Uint8Array(megabytes * 1024 * 1024).fill(0x41);
  return Buffer.from(
    zipSync({
      "[Content_Types].xml": strToU8(CONTENT_TYPES),
      "word/document.xml": huge,
    }),
  );
}

/**
 * A zip whose central directory LIES: it declares a tiny document.xml but the compressed data
 * inflates to `megabytes` MB. Built by patching the declared uncompressed size.
 */
export function makeLyingZipDocx(megabytes = 64): Buffer {
  const real = Buffer.from(makeZipBombDocx(megabytes));
  const buf = Buffer.from(real);
  // Patch every uncompressed-size field (central header offset 24, local header offset 22) to 1 KB.
  for (let i = 0; i < buf.length - 4; i++) {
    if (buf.readUInt32LE(i) === 0x02014b50 && buf.readUInt32LE(i + 24) > 1024 * 1024) buf.writeUInt32LE(1024, i + 24);
    if (buf.readUInt32LE(i) === 0x04034b50 && buf.readUInt32LE(i + 22) > 1024 * 1024) buf.writeUInt32LE(1024, i + 22);
  }
  return buf;
}

export const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const PDF_TYPE = "application/pdf";
