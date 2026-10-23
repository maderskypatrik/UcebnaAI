import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
  type IRunOptions,
} from "docx";
import {
  LETTERS,
  STUDENT_LINE,
  formatPoints,
  gradeScaleText,
  matchingCounterparts,
  matchingKeyLetter,
  sectionPoints,
  sectionStarts,
  totalPoints,
  wordBank,
  type Section,
  type Sheet,
} from "./schemas";

// A4 with 18 mm margins, in twentieths of a point.
const PAGE_WIDTH = 11906;
const MARGIN = 1020;
const CONTENT = PAGE_WIDTH - 2 * MARGIN;

const PRIMARY = "1E40AF";
const MUTED = "444653";
const LINE = "C4C5D5";

const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

const BLANK = "…………………………";

type Options = { showKey: boolean; showPoints: boolean; showScale: boolean };

const text = (t: string, opts: IRunOptions = {}) => new TextRun({ text: t, ...opts });
const answer = (t: string) => text(t, { bold: true, color: PRIMARY });
const p = (children: TextRun[], spacingAfter = 120, indent = 0) =>
  new Paragraph({ children, spacing: { after: spacingAfter }, indent: { left: indent } });

/** An empty line the student writes on. */
const writingLine = () =>
  new Paragraph({
    children: [],
    spacing: { before: 280, after: 0 },
    indent: { left: 360 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 1 } },
  });

/** Two columns without borders, filled top to bottom like the sheet on screen. */
function twoColumns(left: Paragraph[], right: Paragraph[]) {
  const cell = (children: Paragraph[]) =>
    new TableCell({ children: children.length ? children : [new Paragraph("")], width: { size: CONTENT / 2, type: WidthType.DXA } });
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [CONTENT / 2, CONTENT / 2],
    borders: NO_BORDERS,
    rows: [new TableRow({ children: [cell(left), cell(right)] })],
  });
}

function sectionItems(section: Section, start: number, showKey: boolean): (Paragraph | Table)[] {
  const n = section.items.length;
  const num = (i: number) => text(`${start + i}.\t`, { color: MUTED });
  const numbered = { tabStops: [{ type: TabStopType.LEFT, position: 480 }], indent: { left: 480, hanging: 480 } };

  switch (section.type) {
    case "translate_to_czech":
    case "translate_from_czech": {
      const rows = section.items.map(
        (item, i) =>
          new Paragraph({
            ...numbered,
            spacing: { after: 200 },
            children: [num(i), text(`${item.prompt}  `), showKey ? answer(item.answer) : text(BLANK, { color: LINE })],
          }),
      );
      const half = Math.ceil(n / 2);
      return [twoColumns(rows.slice(0, half), rows.slice(half))];
    }
    case "multiple_choice":
      return section.items.flatMap((item, i) => {
        const correct = item.answer.trim().toUpperCase().charAt(0);
        return [
          new Paragraph({ ...numbered, spacing: { before: 120, after: 60 }, children: [num(i), text(item.prompt, { bold: true })] }),
          ...item.options.map((o, k) =>
            p([showKey && LETTERS[k] === correct ? answer(`${LETTERS[k]}) ${o}`) : text(`${LETTERS[k]}) ${o}`)], 40, 480),
          ),
        ];
      });
    case "true_false":
      return section.items.map((item, i) => {
        const a = item.answer.trim().toUpperCase().charAt(0);
        const mark = (v: string) => (showKey && a === v ? answer(v) : text(v, { color: MUTED }));
        return new Paragraph({
          ...numbered,
          tabStops: [...numbered.tabStops, { type: TabStopType.RIGHT, position: CONTENT }],
          spacing: { after: 120 },
          children: [num(i), text(item.prompt), text("\t"), mark("P"), text("  /  ", { color: MUTED }), mark("N")],
        });
      });
    case "fill_blank":
      return [
        ...(section.hideBank
          ? []
          : [
              new Paragraph({
                children: [text(wordBank(section.items).join("  ·  "))],
                spacing: { after: 200 },
                shading: { type: ShadingType.CLEAR, fill: "F2F4F6", color: "auto" },
                border: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 },
                  left: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 },
                  right: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 },
                },
              }),
            ]),
        ...section.items.map(
          (item, i) =>
            new Paragraph({
              ...numbered,
              spacing: { after: 160 },
              children: [num(i), text(item.prompt), ...(showKey ? [text("   → "), answer(item.answer)] : [])],
            }),
        ),
      ];
    case "matching": {
      const left = section.items.map(
        (item, i) =>
          new Paragraph({
            ...numbered,
            spacing: { after: 160 },
            children: [num(i), text(`${item.prompt}  `), showKey ? answer(matchingKeyLetter(i, n)) : text("____", { color: LINE })],
          }),
      );
      const right = matchingCounterparts(section.items).map((t, i) => p([text(`${LETTERS[i]}) `, { color: MUTED }), text(t)], 160));
      return [twoColumns(left, right)];
    }
    case "short_answer":
    case "open":
      return section.items.flatMap((item, i) => [
        new Paragraph({ ...numbered, spacing: { before: 160, after: 60 }, children: [num(i), text(item.prompt, { bold: true })] }),
        ...(showKey
          ? item.answer.split("\n").map((line) => p([answer(line)], 40, 480))
          : Array.from({ length: section.type === "open" ? 6 : 2 }, writingLine)),
      ]);
  }
}

export async function downloadDocx(sheet: Sheet, { showKey, showPoints, showScale }: Options) {
  const header = sheet.header ?? { meta: "", student: STUDENT_LINE };
  const starts = sectionStarts(sheet);
  const total = totalPoints(sheet);

  const children: (Paragraph | Table)[] = [
    p([text(header.meta, { size: 16, color: MUTED })], 60),
    p([text(header.student, { size: 18, color: MUTED })], 360),
    p([text(sheet.title, { bold: true, size: 32 }), ...(showKey ? [text("  · klíč", { bold: true, size: 32, color: PRIMARY })] : [])], 80),
    p([text(sheet.instructions, { color: MUTED })], 360),
  ];

  sheet.sections.forEach((section, si) => {
    children.push(
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT }],
        spacing: { before: 360, after: 40 },
        keepNext: true,
        children: [
          text(`${LETTERS[si]}   `, { bold: true, color: PRIMARY, size: 24 }),
          text(section.title, { bold: true, size: 24 }),
          ...(showPoints ? [text(`\t___ / ${formatPoints(sectionPoints(section))}`, { size: 18, color: MUTED })] : []),
        ],
      }),
      p([text(section.instructions, { size: 20, color: MUTED })], 200, 400),
      ...sectionItems(section, starts[si], showKey),
    );
  });

  if (showPoints || showScale) {
    const right = (runs: TextRun[], before = 0) =>
      new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before, after: 60 }, children: runs });
    children.push(
      ...(showPoints ? [right([text(`Body: ______ / ${formatPoints(total)}`, { bold: true, size: 24 })], 600)] : []),
      ...(showScale
        ? [
            right([text(gradeScaleText(total), { size: 16, color: MUTED })], showPoints ? 0 : 600),
            right([text("Známka: ______", { size: 16, color: MUTED })]),
          ]
        : []),
    );
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [
      {
        properties: {
          page: { size: { width: PAGE_WIDTH, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sheet.title.replace(/[\\/:*?"<>|]/g, "").trim() || "test"}${showKey ? " – klíč" : ""}.docx`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
