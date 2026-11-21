"use strict";
// Text extraction for one resume, run in a worker thread (TASK-024). The parent starts this with a
// memory ceiling (resourceLimits) and a timer that terminates the thread, so a hostile or huge file
// can neither exhaust the API process nor hang it. Nothing here executes document content:
//   - DOCX: the zip directory is listed WITHOUT inflating anything, limits are checked on the
//     declared sizes, then only word/document.xml and a few tiny metadata parts are inflated. The XML
//     is turned into text with plain string replacement (no XML parser, so no entity expansion, no
//     external fetch).
//   - PDF: pdfjs-dist reads the text layer with eval and XFA off and no rendering. Documents that
//     carry JavaScript, launch actions, embedded files or rich media are refused.
// It answers with ONE message: { ok: true, text, pages } or { ok: false, code } (codes from
// RESUME_FAILURE_CODES in packages/types).
const { parentPort, workerData } = require("node:worker_threads");
const { unzipSync } = require("fflate");

const MAX_TEXT_CHARS = 120_000;
const MAX_PDF_PAGES = 15;
const MAX_ZIP_ENTRIES = 400;
const MAX_ZIP_DECLARED_BYTES = 60 * 1024 * 1024; // sum of declared uncompressed sizes
const MAX_XML_BYTES = 6 * 1024 * 1024; // word/document.xml, uncompressed
const MAX_META_BYTES = 256 * 1024; // [Content_Types].xml and *.rels
const MAX_RATIO = 250; // declared uncompressed / compressed, per entry

const UNSAFE_ENTRY = [
  /(^|\/)vbaProject\.bin$/i,
  /(^|\/)vbaData\.xml$/i,
  /(^|\/)(embeddings|activeX|macros)\//i,
  /\.(exe|dll|bat|cmd|com|scr|vbs|vbe|js|jse|ps1|msi|jar|lnk)$/i,
];
const UNSAFE_RELATIONSHIP = /relationships\/(attachedTemplate|oleObject|package|vbaProject|activeXControl)\b/i;
const UNSAFE_CONTENT_TYPE = /(macroEnabled|vbaProject|activeX|oleObject)/i;

const fail = (code) => ({ ok: false, code });
const latin1 = (u8) => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString("latin1");
const utf8 = (u8) => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString("utf8");

function xmlToText(xml) {
  return xml
    .replace(/<w:tab\s*\/>/g, "\t")
    .replace(/<w:(?:br|cr)\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tc>/g, "\t")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|amp|lt|gt|quot|apos);/gi, (m, e) => {
      const k = e.toLowerCase();
      if (k === "amp") return "&";
      if (k === "lt") return "<";
      if (k === "gt") return ">";
      if (k === "quot") return '"';
      if (k === "apos") return "'";
      const cp = k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      return cp > 0 && cp < 0x110000 && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : " ";
    });
}

function extractDocx(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return fail("unreadable");
  const entries = [];
  try {
    // filter returning false lists the central directory without inflating a single byte.
    unzipSync(bytes, {
      filter: (f) => {
        entries.push({ name: f.name, size: f.size, original: f.originalSize });
        return false;
      },
    });
  } catch {
    return fail("unreadable");
  }
  if (entries.length === 0) return fail("unreadable");
  if (entries.length > MAX_ZIP_ENTRIES) return fail("too_complex");
  let declared = 0;
  for (const e of entries) {
    if (UNSAFE_ENTRY.some((re) => re.test(e.name))) return fail("unsafe_content");
    declared += e.original;
    if (declared > MAX_ZIP_DECLARED_BYTES) return fail("too_complex");
    if (e.size > 0 && e.original / e.size > MAX_RATIO && e.original > 1024 * 1024) return fail("too_complex");
  }
  const doc = entries.find((e) => e.name === "word/document.xml");
  if (!doc || !entries.some((e) => e.name === "[Content_Types].xml")) return fail("unreadable");
  if (doc.original > MAX_XML_BYTES) return fail("too_complex");

  const metaNames = new Set(entries.filter((e) => e.name === "[Content_Types].xml" || e.name.endsWith(".rels")).filter((e) => e.original <= MAX_META_BYTES).map((e) => e.name));
  let parts;
  try {
    parts = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" || metaNames.has(f.name) });
  } catch {
    return fail("unreadable");
  }
  for (const [name, data] of Object.entries(parts)) {
    if (name === "word/document.xml") continue;
    const s = utf8(data);
    if (name === "[Content_Types].xml" ? UNSAFE_CONTENT_TYPE.test(s) : UNSAFE_RELATIONSHIP.test(s)) return fail("unsafe_content");
  }
  const xmlBytes = parts["word/document.xml"];
  if (!xmlBytes || xmlBytes.length > MAX_XML_BYTES) return fail("unreadable");
  const text = xmlToText(utf8(xmlBytes)).slice(0, MAX_TEXT_CHARS);
  return text.trim().length === 0 ? fail("no_text") : { ok: true, text, pages: null };
}

// Names in a PDF may hide letters as #xx: normalise before looking for risky keys.
function unsafePdfKeys(bytes) {
  // Compressed stream bodies are skipped: random bytes there would match by chance.
  const raw = latin1(bytes)
    .replace(/stream\r?\n[\s\S]*?endstream/g, "")
    .replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return /\/(JavaScript|JS|Launch|EmbeddedFile|EmbeddedFiles|RichMedia|XFA)\b/.test(raw);
}

async function extractPdf(bytes) {
  if (bytes.length < 5 || latin1(bytes.subarray(0, 5)) !== "%PDF-") return fail("unreadable");
  if (unsafePdfKeys(bytes)) return fail("unsafe_content");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes), // a copy: pdfjs takes ownership of the buffer
    isEvalSupported: false,
    enableXfa: false,
    useSystemFonts: false,
    disableFontFace: true,
    useWorkerFetch: false,
    isOffscreenCanvasSupported: false,
    stopAtErrors: false,
    verbosity: 0,
  });
  let pdf;
  try {
    pdf = await task.promise;
  } catch (e) {
    return fail(e && e.name === "PasswordException" ? "password_protected" : "unreadable");
  }
  try {
    // Object streams can hide keys from the raw scan above, so ask pdfjs as well.
    if ((await pdf.hasJSActions()) || Object.keys((await pdf.getAttachments()) || {}).length > 0) return fail("unsafe_content");
    const pages = Math.min(pdf.numPages, MAX_PDF_PAGES);
    let text = "";
    for (let n = 1; n <= pages && text.length < MAX_TEXT_CHARS; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (typeof item.str !== "string") continue;
        text += item.str + (item.hasEOL ? "\n" : "");
      }
      text += "\n";
      page.cleanup();
    }
    text = text.slice(0, MAX_TEXT_CHARS);
    return text.trim().length === 0 ? fail("no_text") : { ok: true, text, pages: pdf.numPages };
  } catch {
    return fail("unreadable");
  } finally {
    await task.destroy().catch(() => undefined);
  }
}

(async () => {
  const { kind, bytes } = workerData;
  const u8 = new Uint8Array(bytes);
  let result;
  try {
    result = kind === "pdf" ? await extractPdf(u8) : await extractDocx(u8);
  } catch (e) {
    if (process.env.RESUME_WORKER_DEBUG) console.error(e);
    result = fail("failed");
  }
  parentPort.postMessage(result);
})();
