import { createHash } from "crypto";
import { RESUME_MAX_SUGGESTIONS } from "@packetpulse/types";
import type { EducationSuggestionData, ExperienceSuggestionData, ResumeSuggestionKind, SkillSuggestionData } from "@packetpulse/types";

// Turns the plain text of a resume into SUGGESTIONS (TASK-024, PRD-007). Pure functions: no I/O, no
// document content is ever executed or interpreted beyond string matching. Every regex works on one
// line at most MAX_LINE characters long, with bounded repetition, so crafted text cannot make it
// run for long. These are heuristics for a review screen, not a source of truth: the member checks
// each value, and a miss only means the member types it in.

const MAX_LINE = 220;
const MAX_FIELD = 120;
const MIN_YEAR = 1960;

export interface SkillIndexEntry {
  id: string;
  name: string;
  level: "major" | "minor" | "micro";
  /** matchKeyOf() of the name and of every alias. */
  keys: string[];
}

export interface ParsedSuggestion {
  kind: ResumeSuggestionKind;
  data: SkillSuggestionData | EducationSuggestionData | ExperienceSuggestionData;
  fingerprint: string;
}

const fingerprintOf = (kind: ResumeSuggestionKind, data: unknown) =>
  createHash("sha256").update(`${kind}\u0000${JSON.stringify(data)}`).digest("hex").slice(0, 40);

type Section = "skills" | "experience" | "education" | "other";

const HEADINGS: Record<string, Section> = {
  skills: "skills",
  technicalskills: "skills",
  keyskills: "skills",
  coreskills: "skills",
  coreCompetencies: "skills",
  competencies: "skills",
  technologies: "skills",
  toolsandtechnologies: "skills",
  skillssummary: "skills",
  experience: "experience",
  workexperience: "experience",
  professionalexperience: "experience",
  employment: "experience",
  employmenthistory: "experience",
  workhistory: "experience",
  careerhistory: "experience",
  education: "education",
  academics: "education",
  academicqualifications: "education",
  educationalqualifications: "education",
  educationandtraining: "education",
  qualifications: "education",
  projects: "other",
  certifications: "other",
  summary: "other",
  profile: "other",
  objective: "other",
  achievements: "other",
  languages: "other",
  interests: "other",
  references: "other",
  awards: "other",
  publications: "other",
  personaldetails: "other",
  declaration: "other",
};
const HEADING_KEYS = new Map(Object.entries(HEADINGS).map(([k, v]) => [k.toLowerCase(), v]));

function headingOf(line: string): Section | null {
  const t = line.trim();
  if (t.length === 0 || t.length > 40) return null;
  return HEADING_KEYS.get(t.toLowerCase().replace(/[^a-z]/g, "")) ?? null;
}

function toLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").replace(/[\t ]+/g, " ").trim().slice(0, MAX_LINE))
    .slice(0, 4000);
}

/** The section each line belongs to ("other" before the first heading). */
function sectionsOf(lines: string[]): Section[] {
  const out: Section[] = [];
  let current: Section = "other";
  for (const line of lines) {
    const h = headingOf(line);
    if (h) current = h;
    out.push(current);
  }
  return out;
}

// ------------------------------------------------------------------------------------ skills

const LEVEL_RANK = { micro: 0, minor: 1, major: 2 } as const;

export function suggestSkills(lines: string[], sections: Section[], index: SkillIndexEntry[], alreadyHeld: Set<string>): SkillSuggestionData[] {
  const byKey = new Map<string, SkillIndexEntry>();
  for (const s of index) {
    for (const k of s.keys) {
      if (k.length < 3) continue; // "c", "r", "go": too ambiguous to find by wording alone
      const existing = byKey.get(k);
      if (!existing || LEVEL_RANK[s.level] < LEVEL_RANK[existing.level]) byKey.set(k, s);
    }
  }
  const found = new Map<string, SkillSuggestionData>();
  const scan = (line: string, allowMajor: boolean) => {
    const words = line.match(/[\p{L}\p{N}]+/gu) ?? [];
    for (let i = 0; i < words.length; i++) {
      let key = "";
      for (let n = 0; n < 4 && i + n < words.length; n++) {
        key += words[i + n]!.toLowerCase();
        const hit = byKey.get(key);
        if (!hit || found.has(hit.id) || alreadyHeld.has(hit.id)) continue;
        if (hit.level === "major" && !allowMajor) continue;
        found.set(hit.id, { skillId: hit.id, name: hit.name, matchedOn: words.slice(i, i + n + 1).join(" ") });
      }
    }
  };
  lines.forEach((line, i) => scan(line, sections[i] === "skills"));
  return [...found.values()].slice(0, RESUME_MAX_SUGGESTIONS.skill);
}

// --------------------------------------------------------------------------- dates and ranges

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};
const DATE_PART = String.raw`(?:[A-Za-z]{3,9}\.?,?\s+)?\d{4}|\d{1,2}[/.-]\d{4}`;
const RANGE_RE = new RegExp(String.raw`(${DATE_PART})\s{0,3}(?:-|–|—|to|till|until)\s{0,3}(${DATE_PART}|present|current|now|till date|ongoing|today)`, "i");

interface ParsedDate {
  year: number;
  /** "YYYY-MM" or "YYYY" when the month is not written */
  text: string;
}

function parseDatePart(raw: string, now: Date): ParsedDate | null {
  const s = raw.trim().toLowerCase();
  let year: number;
  let month: string | null = null;
  const numeric = /^(\d{1,2})[/.-](\d{4})$/.exec(s);
  if (numeric) {
    year = Number(numeric[2]);
    const m = Number(numeric[1]);
    if (m < 1 || m > 12) return null;
    month = String(m).padStart(2, "0");
  } else {
    const named = /^(?:([a-z]{3,9})\.?,?\s+)?(\d{4})$/.exec(s);
    if (!named) return null;
    year = Number(named[2]);
    if (named[1]) {
      month = MONTHS[named[1].slice(0, 3)] ?? null;
      if (!month) return null; // a word that is not a month ("since 2019" style prose)
    }
  }
  if (year < MIN_YEAR || year > now.getUTCFullYear() + 1) return null;
  return { year, text: month ? `${year}-${month}` : String(year) };
}

const NOW_WORDS = /^(present|current|now|till date|ongoing|today)$/i;

interface Range {
  start: ParsedDate;
  end: ParsedDate | null;
  current: boolean;
  /** the line without the range, for the title / company */
  rest: string;
}

function parseRange(line: string, now: Date): Range | null {
  const m = RANGE_RE.exec(line);
  if (!m) return null;
  const start = parseDatePart(m[1]!, now);
  if (!start) return null;
  const current = NOW_WORDS.test(m[2]!.trim());
  const end = current ? null : parseDatePart(m[2]!, now);
  if (!current && !end) return null;
  if (end && end.text < start.text) return null;
  const rest = (line.slice(0, m.index) + " " + line.slice(m.index + m[0].length)).replace(/[()[\]|]/g, " ").replace(/\s+/g, " ").replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, "");
  return { start, end, current, rest };
}

const clip = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, MAX_FIELD);

// ----------------------------------------------------------------------------- experience

function splitTitleCompany(text: string): { title: string | null; company: string | null } {
  const t = clip(text);
  if (!t) return { title: null, company: null };
  const parts = t.split(/\s+(?:at|@)\s+|\s*[|,]\s*|\s+[–—-]\s+/i).map(clip).filter(Boolean);
  if (parts.length >= 2) return { title: parts[0]!, company: parts.slice(1).join(", ").slice(0, MAX_FIELD) };
  return { title: parts[0] ?? null, company: null };
}

export function suggestExperience(lines: string[], sections: Section[], now: Date): ExperienceSuggestionData[] {
  const hasSection = sections.includes("experience");
  const out: ExperienceSuggestionData[] = [];
  lines.forEach((line, i) => {
    if (hasSection && sections[i] !== "experience") return;
    if (!hasSection && sections[i] === "education") return;
    const range = parseRange(line, now);
    if (!range) return;
    let label = range.rest;
    if (label.length < 3) {
      // The title and company are usually on the line above the dates.
      const prev = (lines[i - 1] ?? "").trim();
      if (prev && !headingOf(prev) && !parseRange(prev, now)) label = prev;
    }
    const { title, company } = splitTitleCompany(label);
    if (!title && !company) return;
    out.push({ title, company, startDate: range.start.text, endDate: range.end?.text ?? null, current: range.current });
  });
  return out.slice(0, RESUME_MAX_SUGGESTIONS.experience);
}

// ------------------------------------------------------------------------------- education

const DEGREE_RE =
  /\b(b\.?\s?tech|m\.?\s?tech|bachelor(?:'s)?|master(?:'s)?|diploma|ph\.?\s?d|doctorate|mca|bca|mba|bba|b\.?\s?sc|m\.?\s?sc|b\.?\s?com|m\.?\s?com|b\.?\s?e\.|m\.?\s?e\.|associate degree|higher secondary|hsc|ssc|10th|12th)\b/i;
const INSTITUTION_RE = /\b(university|college|institute|school|academy|polytechnic|iit|nit)\b/i;
const YEAR_RE = /\b(19[6-9]\d|20\d{2})\b/g;

function yearsIn(line: string, now: Date): { startYear: number | null; endYear: number | null } {
  const range = parseRange(line, now);
  if (range) return { startYear: range.start.year, endYear: range.end?.year ?? null };
  const years = [...line.matchAll(YEAR_RE)].map((m) => Number(m[1])).filter((y) => y >= MIN_YEAR && y <= now.getUTCFullYear() + 6);
  if (years.length === 0) return { startYear: null, endYear: null };
  if (years.length === 1) return { startYear: null, endYear: years[0]! };
  const [a, b] = [Math.min(years[0]!, years[1]!), Math.max(years[0]!, years[1]!)];
  return { startYear: a, endYear: b };
}

export function suggestEducation(lines: string[], sections: Section[], now: Date): EducationSuggestionData[] {
  const hasSection = sections.includes("education");
  const out: EducationSuggestionData[] = [];
  lines.forEach((line, i) => {
    if (hasSection && sections[i] !== "education") return;
    if (!hasSection && sections[i] === "experience") return;
    if (!DEGREE_RE.test(line) && !(hasSection && INSTITUTION_RE.test(line))) return;
    // Look at this line and its neighbours (not other degrees) for the institution and years.
    const near = [line, lines[i + 1] ?? "", lines[i - 1] ?? ""].filter((l) => l && !headingOf(l));
    const instLine = near.find((l) => INSTITUTION_RE.test(l));
    const degreeLine = DEGREE_RE.test(line) ? line : near.find((l) => DEGREE_RE.test(l)) ?? null;
    if (!degreeLine && !instLine) return;
    if (!DEGREE_RE.test(line) && lines[i - 1] && DEGREE_RE.test(lines[i - 1]!)) return; // handled with the degree line above
    const stripYears = (l: string) => l.replace(RANGE_RE, " ").replace(YEAR_RE, " ").replace(/[()[\]|]/g, " ");
    let qualification: string | null = null;
    let institution: string | null = null;
    if (degreeLine) {
      const cleaned = clip(stripYears(degreeLine)).replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, "");
      if (instLine && instLine === degreeLine) {
        const parts = cleaned.split(/\s*[,|]\s*|\s+(?:from|at)\s+|\s+[–—-]\s+/i).map(clip).filter(Boolean);
        const instIdx = parts.findIndex((p) => INSTITUTION_RE.test(p));
        institution = instIdx >= 0 ? parts[instIdx]! : null;
        qualification = parts.filter((_, k) => k !== instIdx).join(", ").slice(0, MAX_FIELD) || null;
      } else {
        qualification = cleaned || null;
      }
    }
    if (instLine && !institution) {
      institution = clip(stripYears(instLine)).replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, "") || null;
    }
    const years = near.map((l) => yearsIn(l, now)).find((y) => y.startYear !== null || y.endYear !== null) ?? { startYear: null, endYear: null };
    if (!qualification && !institution) return;
    out.push({ institution, qualification, startYear: years.startYear, endYear: years.endYear });
  });
  return out.slice(0, RESUME_MAX_SUGGESTIONS.education);
}

// ------------------------------------------------------------------------------------ entry

/**
 * Everything the parser can suggest for this text. `alreadyHeld` are skill ids the member already
 * has on their profile (never suggested again). Results are deduplicated by fingerprint.
 */
export function parseResumeText(text: string, index: SkillIndexEntry[], alreadyHeld: Set<string>, now = new Date()): ParsedSuggestion[] {
  const lines = toLines(text);
  const sections = sectionsOf(lines);
  const all: ParsedSuggestion[] = [];
  const push = (kind: ResumeSuggestionKind, data: ParsedSuggestion["data"]) => all.push({ kind, data, fingerprint: fingerprintOf(kind, data) });
  for (const d of suggestSkills(lines, sections, index, alreadyHeld)) push("skill", d);
  for (const d of suggestEducation(lines, sections, now)) push("education", d);
  for (const d of suggestExperience(lines, sections, now)) push("experience", d);
  const seen = new Set<string>();
  return all.filter((s) => (seen.has(s.fingerprint) ? false : (seen.add(s.fingerprint), true)));
}
