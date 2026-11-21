import { strToU8 } from "fflate";
import { DocumentExtractor } from "../src/modules/resumes/infrastructure/document-extractor";
import { parseResumeText, SkillIndexEntry } from "../src/modules/resumes/domain/resume-text-parser";
import { makeDocx, makeLyingZipDocx, makePdf, makeZipBombDocx, SAMPLE_LINES } from "./helpers/resume-fixtures";

// TEST-004 (TASK-024): the extraction worker and the text parser, with synthetic documents only.
// Malformed and hostile files must end in a plain failure code, never in a crash or a hang.
jest.setTimeout(60_000);

describe("Resume text extraction (worker thread)", () => {
  const extractor = new DocumentExtractor();

  it("reads the text of a PDF and of a DOCX", async () => {
    const pdf = await extractor.extract(makePdf(SAMPLE_LINES), "pdf");
    expect(pdf).toMatchObject({ ok: true, pages: 1 });
    expect(pdf.ok && pdf.text).toContain("Senior Network Engineer, Example Networks Pvt Ltd");
    const docx = await extractor.extract(makeDocx(SAMPLE_LINES), "docx");
    expect(docx.ok && docx.text).toContain("B.Tech in Computer Science");
  });

  it("reads only the first pages of a long PDF", async () => {
    const many = Array.from({ length: 45 * 20 }, (_, i) => `Line ${i}`);
    const res = await extractor.extract(makePdf(many), "pdf");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.pages).toBe(20);
      expect(res.text).toContain("Line 0");
      expect(res.text).not.toContain("Line 899"); // page 20 is past the 15-page limit
    }
  });

  it("reports a document without text as no_text", async () => {
    expect(await extractor.extract(makePdf([]), "pdf")).toEqual({ ok: false, code: "no_text" });
    expect(await extractor.extract(makeDocx([]), "docx")).toEqual({ ok: false, code: "no_text" });
  });

  it("refuses garbage with the right type signature, and the wrong container", async () => {
    expect(await extractor.extract(Buffer.from("%PDF-1.4 this is not a pdf"), "pdf")).toEqual({ ok: false, code: "unreadable" });
    expect(await extractor.extract(Buffer.from("PK\u0003\u0004 not a zip at all"), "docx")).toEqual({ ok: false, code: "unreadable" });
    expect(await extractor.extract(makePdf(SAMPLE_LINES), "docx")).toEqual({ ok: false, code: "unreadable" });
    expect(await extractor.extract(makeDocx(SAMPLE_LINES), "pdf")).toEqual({ ok: false, code: "unreadable" });
  });

  it("refuses a zip bomb from its declared sizes, without inflating it", async () => {
    const started = Date.now();
    expect(await extractor.extract(makeZipBombDocx(80), "docx")).toEqual({ ok: false, code: "too_complex" });
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it("survives a zip whose directory lies about the size (output stays bounded)", async () => {
    const res = await extractor.extract(makeLyingZipDocx(96), "docx");
    // Either refused, or read as the few bytes the directory declared: never 96 MB of text.
    if (res.ok) expect(res.text.length).toBeLessThanOrEqual(120_000);
  });

  it("refuses a DOCX that carries macros, embedded objects or a remote template", async () => {
    for (const extra of [
      { "word/vbaProject.bin": "binary" },
      { "word/embeddings/oleObject1.bin": "ole" },
      { "word/activeX/activeX1.xml": "<x/>" },
      { "[Content_Types].xml": `<Types><Override PartName="/word/document.xml" ContentType="application/vnd.ms-word.document.macroEnabled.main+xml"/></Types>` },
      { "word/_rels/settings.xml.rels": `<Relationships><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="https://example.invalid/t.dotm" TargetMode="External"/></Relationships>` },
    ]) {
      expect(await extractor.extract(makeDocx(SAMPLE_LINES, extra), "docx")).toEqual({ ok: false, code: "unsafe_content" });
    }
  });

  it("refuses a PDF with JavaScript or a launch action, even with a hidden name", async () => {
    expect(await extractor.extract(makePdf(SAMPLE_LINES, { extraDict: "/OpenAction << /S /JavaScript /JS (app.alert(1)) >>" }), "pdf")).toEqual({ ok: false, code: "unsafe_content" });
    expect(await extractor.extract(makePdf(SAMPLE_LINES, { extraDict: "/OpenAction << /S /Launch /F (cmd.exe) >>" }), "pdf")).toEqual({ ok: false, code: "unsafe_content" });
    expect(await extractor.extract(makePdf(SAMPLE_LINES, { extraDict: "/OpenAction << /S /J#61vaScript /JS (x) >>" }), "pdf")).toEqual({ ok: false, code: "unsafe_content" });
  });

  it("stops a parse that takes too long", async () => {
    // A 1 ms budget cannot finish: the worker is terminated and the result is a plain timeout.
    expect(await extractor.extract(makePdf(SAMPLE_LINES), "pdf", 1)).toEqual({ ok: false, code: "timeout" });
  });

  it("does not expand XML entities or follow external references in a DOCX", async () => {
    const xxe = `<?xml version="1.0"?><!DOCTYPE d [<!ENTITY e SYSTEM "file:///etc/passwd">]><w:document xmlns:w="x"><w:body><w:p><w:r><w:t>&e; visible</w:t></w:r></w:p></w:body></w:document>`;
    const res = await extractor.extract(makeDocx([], { "word/document.xml": xxe }), "docx");
    expect(res.ok && res.text).not.toContain("root:");
  });
});

describe("Resume text parser", () => {
  const skill = (id: string, name: string, level: SkillIndexEntry["level"], aliases: string[] = []): SkillIndexEntry => ({
    id,
    name,
    level,
    keys: [name, ...aliases].map((n) => n.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")),
  });
  const index = [
    skill("s-ospf", "OSPF", "micro", ["Open Shortest Path First"]),
    skill("s-bgp", "BGP", "micro"),
    skill("s-routing", "Cisco Routing", "minor"),
    skill("s-net", "Networking", "major"),
    skill("s-c", "C", "micro"),
  ];
  const now = new Date("2026-11-21T00:00:00Z");
  const kinds = (text: string, held = new Set<string>()) => parseResumeText(text, index, held, now);

  it("matches skills by name and alias, and never by one-letter names", () => {
    const s = kinds(SAMPLE_LINES.join("\n") + "\nExperienced with Open Shortest Path First and C programming").filter((x) => x.kind === "skill");
    const ids = s.map((x) => (x.data as { skillId: string }).skillId).sort();
    expect(ids).toEqual(["s-bgp", "s-ospf", "s-routing"]);
  });

  it("matches a broad (major) skill only inside the skills section", () => {
    const prose = kinds("Summary\nI enjoy networking events\n");
    expect(prose.some((x) => (x.data as { skillId?: string }).skillId === "s-net")).toBe(false);
    const listed = kinds("SKILLS\nNetworking, Python\n");
    expect(listed.some((x) => (x.data as { skillId?: string }).skillId === "s-net")).toBe(true);
  });

  it("never suggests a skill the member already has", () => {
    const s = kinds("SKILLS\nOSPF, BGP", new Set(["s-ospf"]));
    expect(s.map((x) => (x.data as { skillId: string }).skillId)).toEqual(["s-bgp"]);
  });

  it("finds experience with its date range, and an open-ended current role", () => {
    const exp = kinds(SAMPLE_LINES.join("\n")).filter((x) => x.kind === "experience").map((x) => x.data);
    expect(exp).toEqual([
      { title: "Senior Network Engineer", company: "Example Networks Pvt Ltd", startDate: "2019-01", endDate: null, current: true },
      { title: "Network Engineer", company: "Sample Telecom", startDate: "2015-03", endDate: "2018-12", current: false },
    ]);
  });

  it("drops impossible dates (end before start, far future, year 1800)", () => {
    const t = "EXPERIENCE\nDeveloper, A Co 2020 - 2018\nTester, B Co 1800 - 1850\nAnalyst, C Co 2090 - 2095\n";
    expect(kinds(t).filter((x) => x.kind === "experience")).toEqual([]);
  });

  it("finds education with institution and years", () => {
    const edu = kinds(SAMPLE_LINES.join("\n")).filter((x) => x.kind === "education").map((x) => x.data);
    expect(edu).toEqual([{ institution: "Example Institute of Technology", qualification: "B.Tech in Computer Science", startYear: 2011, endYear: 2015 }]);
  });

  it("gives every suggestion a stable fingerprint, so a re-run adds nothing", () => {
    const a = kinds(SAMPLE_LINES.join("\n"));
    const b = kinds(SAMPLE_LINES.join("\n"));
    expect(a.map((x) => x.fingerprint)).toEqual(b.map((x) => x.fingerprint));
    expect(new Set(a.map((x) => x.fingerprint)).size).toBe(a.length);
  });

  it("returns nothing for text with no structure, and stays quick on hostile input", () => {
    expect(kinds("hello world")).toEqual([]);
    const started = Date.now();
    kinds("a".repeat(100_000) + "\n" + "2019 - ".repeat(20_000) + "\n" + "Jan ".repeat(20_000));
    kinds(("EXPERIENCE\n" + "x ".repeat(100) + "Jan 2019 - Present\n").repeat(2_000));
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it("treats embedded markup and script text as plain text", () => {
    const out = kinds(`SKILLS\nOSPF <script>alert(1)</script> ${strToU8("x").length}`);
    expect(out).toHaveLength(1);
    expect(JSON.stringify(out)).not.toContain("<script>");
  });
});
