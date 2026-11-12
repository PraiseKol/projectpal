import { getScaleLabels, type QuestionnaireData, type QuestionType, type ScaleDirection } from "./types";

export interface SharedForm {
  id: string;
  slug: string;
  title: string;
  schema: QuestionnaireData;
  require_all: boolean;
  is_open: boolean;
  closes_at: string | null;
  response_limit: number | null;
  thank_you_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormResponse {
  id: string;
  form_id: string;
  answers: Record<string, string | number>;
  submitted_at: string;
}

export interface FlatQuestion {
  id: string;
  number: number;
  text: string;
  type: QuestionType;
  options: string[];
  scaleDirection: ScaleDirection;
  section: string;
}

export const formUrl = (slug: string) => `${window.location.origin}/f/${slug}`;

/** Every question of the questionnaire in order, numbered like the preview */
export const flattenQuestions = (schema: QuestionnaireData): FlatQuestion[] => {
  const out: FlatQuestion[] = [];
  let n = 0;
  for (const section of schema?.sections ?? []) {
    for (const q of section.questions ?? []) {
      n += 1;
      out.push({
        id: q.id,
        number: n,
        text: q.text || `Question ${n}`,
        type: q.type,
        options: q.type === "yes_no" ? ["Yes", "No"] : q.options ?? [],
        scaleDirection: q.scaleDirection ?? "1to5",
        section: section.title,
      });
    }
  }
  return out;
};

const isAnswered = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== "";

// ---------------------------------------------------------------------------------------------
// Statistics (what Google Forms shows in its Summary)
// ---------------------------------------------------------------------------------------------
export interface ChoiceStat {
  label: string;
  value: string | number;
  count: number;
  percent: number;
}

export interface QuestionStat {
  question: FlatQuestion;
  answered: number;
  skipped: number;
  choices?: ChoiceStat[];
  mean?: number;
  sd?: number;
  median?: number;
  texts?: string[];
}

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

export const computeStats = (questions: FlatQuestion[], responses: FormResponse[]): QuestionStat[] =>
  questions.map((question) => {
    const values = responses.map((r) => r.answers?.[question.id]).filter(isAnswered) as (string | number)[];
    const answered = values.length;
    const base: QuestionStat = { question, answered, skipped: responses.length - answered };

    if (question.type === "short_text" || question.type === "long_text") {
      return { ...base, texts: values.map(String).reverse() };
    }

    if (question.type === "rating_scale") {
      const nums = values.map(Number).filter((n) => Number.isFinite(n));
      const labelFor = new Map(getScaleLabels(question.scaleDirection).map((x) => [x.value, x.label]));
      const choices: ChoiceStat[] = [1, 2, 3, 4, 5].map((v) => {
        const count = nums.filter((n) => n === v).length;
        return {
          label: `${v} - ${labelFor.get(v) ?? ""}`.trim(),
          value: v,
          count,
          percent: nums.length ? round((count / nums.length) * 100, 1) : 0,
        };
      });
      const mean = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : undefined;
      const sd =
        nums.length > 1 && mean !== undefined
          ? Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / (nums.length - 1))
          : undefined;
      const sorted = [...nums].sort((a, b) => a - b);
      const median = sorted.length
        ? sorted.length % 2
          ? sorted[(sorted.length - 1) / 2]
          : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : undefined;
      return {
        ...base,
        choices,
        mean: mean !== undefined ? round(mean) : undefined,
        sd: sd !== undefined ? round(sd) : undefined,
        median,
      };
    }

    // yes_no and multiple_choice
    const total = values.length;
    const choices: ChoiceStat[] = question.options.map((opt) => {
      const count = values.filter((v) => String(v) === opt).length;
      return { label: opt, value: opt, count, percent: total ? round((count / total) * 100, 1) : 0 };
    });
    return { ...base, choices };
  });

export const responsesPerDay = (responses: FormResponse[]): { date: string; count: number }[] => {
  if (!responses.length) return [];
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const counts = new Map<string, number>();
  for (const r of responses) {
    const k = key(new Date(r.submitted_at));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const days = [...counts.keys()].sort();
  const start = new Date(days[0] + "T00:00:00");
  const end = new Date(days[days.length - 1] + "T00:00:00");
  const out: { date: string; count: number }[] = [];
  for (let d = new Date(start), i = 0; d <= end && i < 120; d.setDate(d.getDate() + 1), i++) {
    const k = key(d);
    out.push({ date: k, count: counts.get(k) ?? 0 });
  }
  return out;
};

export const completionRate = (questions: FlatQuestion[], responses: FormResponse[]): number => {
  if (!questions.length || !responses.length) return 0;
  const answered = responses.reduce(
    (sum, r) => sum + questions.filter((q) => isAnswered(r.answers?.[q.id])).length,
    0
  );
  return round((answered / (questions.length * responses.length)) * 100, 1);
};

// ---------------------------------------------------------------------------------------------
// Tables for CSV / Excel / Data Analysis
// ---------------------------------------------------------------------------------------------
export type Cell = string | number | null;

const stamp = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const headerFor = (q: FlatQuestion) => {
  const text = q.text.replace(/\s+/g, " ").trim();
  return `Q${q.number}. ${text.length > 90 ? text.slice(0, 87) + "..." : text}`;
};

/**
 * "full" keeps the time stamp and the written answers (for reading and sharing).
 * "analysis" keeps only the question columns that can be analysed statistically, with rating
 * scales as numbers 1 to 5, so the file can go straight into the Data Analysis tool.
 */
export const buildTable = (
  questions: FlatQuestion[],
  responses: FormResponse[],
  mode: "full" | "analysis"
): { header: string[]; rows: Cell[][] } => {
  const used = mode === "analysis" ? questions.filter((q) => q.type !== "short_text" && q.type !== "long_text") : questions;
  const header = [...(mode === "full" ? ["Submitted at"] : []), ...used.map(headerFor)];
  const rows = responses.map((r) => [
    ...(mode === "full" ? [stamp(r.submitted_at)] : []),
    ...used.map((q): Cell => {
      const v = r.answers?.[q.id];
      if (!isAnswered(v)) return null;
      if (q.type === "rating_scale") return Number(v);
      return String(v);
    }),
  ]);
  return { header, rows };
};

const csvEscape = (c: Cell) => {
  if (c === null || c === undefined) return "";
  const s = String(c);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (header: string[], rows: Cell[][], withBom = true): string =>
  (withBom ? "\uFEFF" : "") + [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");

export const downloadText = (filename: string, text: string, mime = "text/csv;charset=utf-8") => {
  const blob = new Blob([text], { type: mime });
  downloadBlob(filename, blob);
};

export const downloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const safeFileName = (title: string) =>
  (title || "questionnaire").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 50) || "questionnaire";

/** A summary sheet like the Google Forms summary: one block per question */
export const buildSummaryRows = (stats: QuestionStat[], total: number): Cell[][] => {
  const rows: Cell[][] = [["Question", "Answer / statistic", "Count / value", "Percent"]];
  rows.push(["Total responses", null, total, null]);
  for (const s of stats) {
    const label = headerFor(s.question);
    if (s.choices) {
      for (const c of s.choices) rows.push([label, c.label, c.count, c.percent]);
      if (s.mean !== undefined) rows.push([label, "Mean", s.mean, null]);
      if (s.sd !== undefined) rows.push([label, "Standard deviation", s.sd, null]);
      if (s.median !== undefined) rows.push([label, "Median", s.median, null]);
    } else {
      rows.push([label, "Written answers", s.answered, null]);
    }
    rows.push([label, "Skipped", s.skipped, null]);
  }
  return rows;
};

// ---------------------------------------------------------------------------------------------
// Excel (.xlsx) writer: plain XML parts zipped with JSZip (already installed as part of "docx")
// ---------------------------------------------------------------------------------------------
export interface XlsxSheet {
  name: string;
  rows: Cell[][];
  widths?: number[];
}

const xmlEscape = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const colName = (index: number): string => {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const sheetXml = (sheet: XlsxSheet): string => {
  const widths = sheet.widths ?? [];
  const cols = widths.length
    ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const rowsXml = sheet.rows
    .map((row, r) => {
      const cells = row
        .map((cell, c) => {
          if (cell === null || cell === undefined || cell === "") return "";
          const ref = `${colName(c)}${r + 1}`;
          const style = r === 0 ? ' s="1"' : "";
          if (typeof cell === "number" && Number.isFinite(cell)) return `<c r="${ref}"${style}><v>${cell}</v></c>`;
          const text = xmlEscape(String(cell));
          return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    cols +
    `<sheetData>${rowsXml}</sheetData></worksheet>`
  );
};

const cleanSheetName = (name: string, index: number) =>
  name.replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 31) || `Sheet${index + 1}`;

export const buildXlsxParts = (sheets: XlsxSheet[]): Record<string, string> => {
  const names = sheets.map((s, i) => cleanSheetName(s.name, i));
  const parts: Record<string, string> = {};

  parts["[Content_Types].xml"] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    sheets
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join("") +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`;

  parts["_rels/.rels"] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  parts["xl/workbook.xml"] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>${names.map((n, i) => `<sheet name="${xmlEscape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>` +
    `</workbook>`;

  parts["xl/_rels/workbook.xml.rels"] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join("") +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  parts["xl/styles.xml"] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FFE8F0FE"/><bgColor indexed="64"/></patternFill></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`;

  sheets.forEach((s, i) => {
    parts[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s);
  });
  return parts;
};

export const downloadXlsx = async (filename: string, sheets: XlsxSheet[]) => {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const [path, content] of Object.entries(buildXlsxParts(sheets))) zip.file(path, content);
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    compression: "DEFLATE",
  });
  downloadBlob(filename, blob);
};

/** Reasonable column widths from the header text and the first rows */
export const guessWidths = (header: string[], rows: Cell[][]): number[] =>
  header.map((h, c) => {
    const longest = Math.max(h.length, ...rows.slice(0, 50).map((r) => String(r[c] ?? "").length));
    return Math.min(60, Math.max(12, Math.round(longest * 0.9) + 2));
  });

// ---------------------------------------------------------------------------------------------
// Sending the responses to the Data Analysis tool
// ---------------------------------------------------------------------------------------------
export const FORWARD_KEY = "pp_forward_dataset";

export const forwardToAnalysis = (title: string, questions: FlatQuestion[], responses: FormResponse[]) => {
  const { header, rows } = buildTable(questions, responses, "analysis");
  const csv = toCsv(header, rows, false);
  sessionStorage.setItem(FORWARD_KEY, JSON.stringify({ fileName: `${safeFileName(title)}_responses.csv`, csv }));
};
