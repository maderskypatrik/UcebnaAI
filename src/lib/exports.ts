import JSZip from "jszip";
import { LETTERS, matchingCounterparts, type Item, type Section, type Sheet } from "./schemas";

/** Exports to other tools. Each returns a file and how many questions made it in. */
export type Exported = { blob: Blob; fileName: string; count: number; skipped: number };

const BLANK = /_{3,}/;
const baseName = (sheet: Sheet) => sheet.title.replace(/[\\/:*?"<>|]/g, "").trim() || "test";
const textBlob = (text: string) => new Blob([text], { type: "text/plain;charset=utf-8" });

const correctLetter = (item: Item) => item.answer.trim().toUpperCase().charAt(0);
const correctIndex = (item: Item) => LETTERS.indexOf(correctLetter(item));
const isTrue = (item: Item) => correctLetter(item) === "P";

// ── Moodle (GIFT) ───────────────────────────────────────────────────────────

const gift = (text: string) => text.replace(/([~=#{}:\\])/g, "\\$1").replace(/\n/g, " ");

function giftSection(section: Section, start: number): string[] {
  const name = (i: number) => `::${start + i}. ${gift(section.title).slice(0, 40)}::`;
  switch (section.type) {
    case "multiple_choice":
      return section.items.map(
        (item, i) =>
          `${name(i)}${gift(item.prompt)} {\n${item.options
            .map((o, k) => `  ${k === correctIndex(item) ? "=" : "~"}${gift(o)}`)
            .join("\n")}\n}`,
      );
    case "true_false":
      return section.items.map((item, i) => `${name(i)}${gift(item.prompt)} {${isTrue(item) ? "T" : "F"}}`);
    case "fill_blank":
      return section.items.map((item, i) => {
        const answers = item.answer.split("/").map((a) => `=${gift(a.trim())}`).join(" ");
        return BLANK.test(item.prompt)
          ? `${name(i)}${item.prompt.split(BLANK).map(gift).join(`{${answers}}`)}`
          : `${name(i)}${gift(item.prompt)} {${answers}}`;
      });
    case "matching":
      // Moodle needs at least three pairs in one matching question.
      if (section.items.length < 3) return [];
      return [
        `${name(0)}${gift(section.instructions || section.title)} {\n${section.items
          .map((item) => `  =${gift(item.prompt)} -> ${gift(item.answer)}`)
          .join("\n")}\n}`,
      ];
    case "translate_to_czech":
    case "translate_from_czech":
      return section.items.map(
        (item, i) =>
          `${name(i)}${gift(item.prompt)} {${item.answer
            .split("/")
            .map((a) => `=${gift(a.trim())}`)
            .join(" ")}}`,
      );
    case "short_answer":
    case "open":
      // A model answer of a whole sentence would never match word for word, so these are graded by hand.
      return section.items.map((item, i) => `${name(i)}${gift(item.prompt)} {}`);
  }
}

/** A GIFT file for Moodle: Question bank → Import → GIFT format. */
export function toMoodle(sheet: Sheet): Exported {
  let start = 1;
  const questions: string[] = [];
  for (const section of sheet.sections) {
    questions.push(`$CATEGORY: $course$/${gift(sheet.title)}/${gift(section.title)}`, "");
    questions.push(...giftSection(section, start).flatMap((q) => [q, ""]));
    start += section.items.length;
  }
  const count = sheet.sections.reduce(
    (n, s) => n + (s.type === "matching" ? (s.items.length >= 3 ? 1 : 0) : s.items.length),
    0,
  );
  const skipped = sheet.sections.filter((s) => s.type === "matching" && s.items.length < 3).length;
  return { blob: textBlob(questions.join("\n")), fileName: `${baseName(sheet)} – Moodle.gift.txt`, count, skipped };
}

// ── Quizlet ─────────────────────────────────────────────────────────────────

/** Term and definition per line, separated by a tab: Quizlet → Create → Import. */
export function toQuizlet(sheet: Sheet): Exported {
  const lines: string[] = [];
  let skipped = 0;
  for (const section of sheet.sections) {
    for (const item of section.items) {
      const clean = (t: string) => t.replace(/[\t\n]+/g, " ").trim();
      if (section.type === "multiple_choice") lines.push(`${clean(item.prompt)}\t${clean(item.options[correctIndex(item)] ?? "")}`);
      else if (section.type === "true_false") lines.push(`${clean(item.prompt)}\t${isTrue(item) ? "Pravda" : "Nepravda"}`);
      else if (section.type === "open") skipped++;
      else lines.push(`${clean(item.prompt)}\t${clean(item.answer)}`);
    }
  }
  return { blob: textBlob(lines.join("\n")), fileName: `${baseName(sheet)} – Quizlet.txt`, count: lines.length, skipped };
}

// ── Kahoot ──────────────────────────────────────────────────────────────────

const xml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A minimal .xlsx with one sheet of text and number cells. */
async function xlsx(rows: (string | number | null)[][]): Promise<Blob> {
  const col = (i: number) => String.fromCharCode(65 + i);
  const sheetRows = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          if (value === null || value === "") return "";
          const ref = `${col(c)}${r + 1}`;
          return typeof value === "number"
            ? `<c r="${ref}"><v>${value}</v></c>`
            : `<c r="${ref}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
  );
  zip.file(
    "xl/worksheets/sheet1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
  );
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/**
 * A spreadsheet in the layout of Kahoot's quiz template (Create → Import spreadsheet).
 * Kahoot only takes questions with answers to pick, so other question types are left out.
 */
export async function toKahoot(sheet: Sheet): Promise<Exported> {
  const rows: (string | number | null)[][] = [];
  let skipped = 0;
  const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
  for (const section of sheet.sections) {
    for (const item of section.items) {
      if (section.type === "multiple_choice") {
        const options = item.options.slice(0, 4).map((o) => cut(o, 75));
        rows.push([cut(item.prompt, 120), ...options, ...Array(4 - options.length).fill(null), 30, correctIndex(item) + 1]);
      } else if (section.type === "true_false") {
        rows.push([cut(item.prompt, 120), "Pravda", "Nepravda", null, null, 20, isTrue(item) ? 1 : 2]);
      } else {
        skipped++;
      }
    }
  }
  const template: (string | number | null)[][] = [
    [],
    [null, "Quiz template"],
    [null, "Add questions, at least two answer alternatives, time limit and choose correct answers (at least one)."],
    [],
    [],
    [],
    [],
    [
      null,
      "Question - max 120 characters",
      "Answer 1 - max 75 characters",
      "Answer 2 - max 75 characters",
      "Answer 3 - max 75 characters",
      "Answer 4 - max 75 characters",
      "Time limit (sec) – 5, 10, 20, 30, 60, 90, 120, or 240 secs",
      "Correct answer(s) - choose at least one",
    ],
    ...rows.map((row, i) => [i + 1, ...row]),
  ];
  return { blob: await xlsx(template), fileName: `${baseName(sheet)} – Kahoot.xlsx`, count: rows.length, skipped };
}

// ── Google Forms ────────────────────────────────────────────────────────────

/**
 * An Apps Script that builds the test as a Google Forms quiz in the teacher's own Drive.
 * Closed questions get their correct answers; written ones are scored by hand in Forms.
 */
export function toGoogleForms(sheet: Sheet): Exported {
  const js = (t: string) => JSON.stringify(t);
  const lines: string[] = [
    `// Učebna.ai: ${sheet.title}`,
    "// Spusťte tlačítkem Spustit (▶). Odkaz na hotový formulář najdete dole v Protokolu provádění.",
    "function vytvoritTest() {",
    `  var form = FormApp.create(${js(sheet.title)});`,
    "  form.setIsQuiz(true);",
    `  form.setDescription(${js(sheet.instructions)});`,
    '  form.addTextItem().setTitle("Jméno a třída").setRequired(true);',
    "  var item;",
  ];
  let count = 0;
  for (const section of sheet.sections) {
    lines.push(`  form.addSectionHeaderItem().setTitle(${js(section.title)}).setHelpText(${js(section.instructions)});`);
    const points = Math.max(1, Math.round(section.points));
    if (section.type === "matching") {
      const columns = [...new Set(matchingCounterparts(section.items))];
      lines.push(
        "  item = form.addGridItem();",
        `  item.setTitle(${js(section.instructions || section.title)}).setRows(${JSON.stringify(section.items.map((i) => i.prompt))}).setColumns(${JSON.stringify(columns)});`,
      );
      count++;
      continue;
    }
    for (const item of section.items) {
      count++;
      if (section.type === "multiple_choice" || section.type === "true_false") {
        const options =
          section.type === "true_false"
            ? [
                ["Pravda", isTrue(item)],
                ["Nepravda", !isTrue(item)],
              ]
            : item.options.map((o, k) => [o, k === correctIndex(item)]);
        lines.push(
          "  item = form.addMultipleChoiceItem();",
          `  item.setTitle(${js(item.prompt)}).setPoints(${points}).setChoices([${options
            .map(([o, ok]) => `item.createChoice(${js(o as string)}, ${ok})`)
            .join(", ")}]);`,
        );
      } else if (section.type === "open") {
        lines.push(`  form.addParagraphTextItem().setTitle(${js(item.prompt)}).setPoints(${points});`);
      } else {
        lines.push(`  form.addTextItem().setTitle(${js(item.prompt)}).setPoints(${points});`);
      }
    }
  }
  lines.push(
    '  Logger.log("Formulář pro žáky: " + form.getPublishedUrl());',
    '  Logger.log("Úpravy a výsledky: " + form.getEditUrl());',
    "}",
    "",
  );
  return { blob: textBlob(lines.join("\n")), fileName: `${baseName(sheet)} – Google Formuláře.gs.txt`, count, skipped: 0 };
}
