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
  ImportedXmlComponent,
  ImageRun,
  HeightRule,
  LineRuleType,
  VerticalAlign,
  type IRunOptions,
  type ParagraphChild,
} from "docx";
import katex from "katex";
import "katex/contrib/mhchem";
import { mml2omml } from "mathml2omml";
import { chemRuns, chemistry, splitMath, texToPlain, toPlain } from "./rich";
import { crossword, wordSearch } from "./puzzles";
import {
  LETTERS,
  STUDENT_LINE,
  formatPoints,
  matchingCounterparts,
  matchingKeyLetter,
  orderingShown,
  pictureMarker,
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

type Options = { showKey: boolean; showPoints: boolean };

const text = (t: string, opts: IRunOptions = {}) => new TextRun({ text: t, ...opts });

/** A formula as a Word equation, which teachers can keep editing in Word. */
function equation(tex: string): ParagraphChild | null {
  try {
    const html = katex.renderToString(tex, { output: "mathml", throwOnError: true, strict: "ignore" });
    const mathml = html.match(/<math[\s\S]*<\/math>/)?.[0].replace(/<annotation[\s\S]*?<\/annotation>/, "");
    if (!mathml) return null;
    // fromXmlString wraps the parsed XML in a nameless root; the equation is its only child.
    const wrapper = ImportedXmlComponent.fromXmlString(mml2omml(mathml)) as unknown as { root: ParagraphChild[] };
    return wrapper.root[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Sheet text as Word runs: formulas become equations, chemistry becomes text with
 * sub- and superscripts (as chemists write it in Word), anything unreadable plain text.
 */
function rich(t: string, opts: IRunOptions = {}): ParagraphChild[] {
  return splitMath(t).flatMap((piece) => {
    if (piece.type === "text") return [text(piece.value, opts)];
    const ce = chemistry(piece.tex);
    if (ce !== null)
      return chemRuns(ce).map((r) => text(r.text, { ...opts, subScript: r.script === "sub", superScript: r.script === "sup" }));
    return [equation(piece.tex) ?? text(texToPlain(piece.tex), opts)];
  });
}

const answer = (t: string) => rich(t, { bold: true, color: PRIMARY });
const p = (children: ParagraphChild[], spacingAfter = 120, indent = 0) =>
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

type Picture = { data: Uint8Array; width: number; height: number };

/** The picture of a picture part with its numbered marks drawn in, as Word can't lay shapes over it reliably. */
async function markedPicture(section: Section, start: number): Promise<Picture | null> {
  if (!section.image) return null;
  const image = new Image();
  image.src = section.image;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d")!;
  context.drawImage(image, 0, 0);
  const radius = Math.max(14, Math.round(canvas.width / 30));
  context.font = `bold ${Math.round(radius * 1.1)}px Calibri, Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  section.items.forEach((item, i) => {
    const mark = pictureMarker(item);
    if (!mark) return;
    const x = (mark.x / 100) * canvas.width;
    const y = (mark.y / 100) * canvas.height;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = "#fff";
    context.fill();
    context.lineWidth = Math.max(2, radius / 6);
    context.strokeStyle = `#${PRIMARY}`;
    context.stroke();
    context.fillStyle = `#${PRIMARY}`;
    context.fillText(String(start + i), x, y + 1);
  });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) return null;
  // At most about 12 cm wide and 13 cm tall on the page, in Word's pixels.
  const scale = Math.min(1, 460 / canvas.width, 500 / canvas.height);
  return {
    data: new Uint8Array(await blob.arrayBuffer()),
    width: Math.round(canvas.width * scale),
    height: Math.round(canvas.height * scale),
  };
}

const CELL = 440;
const cellBorder = (color: string, size = 4) => ({
  top: { style: BorderStyle.SINGLE, size, color },
  bottom: { style: BorderStyle.SINGLE, size, color },
  left: { style: BorderStyle.SINGLE, size, color },
  right: { style: BorderStyle.SINGLE, size, color },
});
const letterCell = (
  letter: string,
  opts: { fill?: string; bold?: boolean; color?: string; border?: string; borderSize?: number; width?: number } = {},
) =>
  new TableCell({
    width: { size: opts.width ?? CELL, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    borders: opts.border ? cellBorder(opts.border, opts.borderSize) : NO_BORDERS,
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: "auto" } : undefined,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: letter ? [text(letter, { bold: opts.bold ?? true, color: opts.color })] : [],
      }),
    ],
  });
/** A table of letter boxes; a crossword's first column is wider, for the row numbers. */
const gridTable = (rows: TableCell[][], columns: number, first = CELL) =>
  new Table({
    alignment: AlignmentType.CENTER,
    width: { size: first + CELL * (columns - 1), type: WidthType.DXA },
    columnWidths: [first, ...Array(columns - 1).fill(CELL)],
    borders: NO_BORDERS,
    rows: rows.map((cells) => new TableRow({ height: { value: CELL, rule: HeightRule.EXACT }, children: cells })),
  });

function sectionItems(
  section: Section,
  start: number,
  showKey: boolean,
  picture: Picture | null,
  large: boolean,
): (Paragraph | Table)[] {
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
            children: [num(i), ...rich(item.prompt), text("  "), ...(showKey ? answer(item.answer) : [text(BLANK, { color: LINE })])],
          }),
      );
      const half = Math.ceil(n / 2);
      return [twoColumns(rows.slice(0, half), rows.slice(half))];
    }
    case "multiple_choice":
      return section.items.flatMap((item, i) => {
        const correct = item.answer.trim().toUpperCase().charAt(0);
        return [
          new Paragraph({ ...numbered, spacing: { before: 120, after: 60 }, children: [num(i), ...rich(item.prompt, { bold: true })] }),
          ...item.options.map((o, k) =>
            p(showKey && LETTERS[k] === correct ? answer(`${LETTERS[k]}) ${o}`) : rich(`${LETTERS[k]}) ${o}`), 40, 480),
          ),
        ];
      });
    case "true_false":
      return section.items.map((item, i) => {
        const a = item.answer.trim().toUpperCase().charAt(0);
        const mark = (v: string) => (showKey && a === v ? text(v, { bold: true, color: PRIMARY }) : text(v, { color: MUTED }));
        return new Paragraph({
          ...numbered,
          tabStops: [...numbered.tabStops, { type: TabStopType.RIGHT, position: CONTENT }],
          spacing: { after: 120 },
          children: [num(i), ...rich(item.prompt), text("\t"), mark("P"), text("  /  ", { color: MUTED }), mark("N")],
        });
      });
    case "fill_blank":
      return [
        ...(section.hideBank
          ? []
          : [
              new Paragraph({
                children: rich(wordBank(section.items).join("  ·  ")),
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
              children: [num(i), ...rich(item.prompt), ...(showKey ? [text("   → "), ...answer(item.answer)] : [])],
            }),
        ),
      ];
    case "matching": {
      const left = section.items.map(
        (item, i) =>
          new Paragraph({
            ...numbered,
            spacing: { after: 160 },
            children: [num(i), ...rich(item.prompt), text("  "), showKey ? text(matchingKeyLetter(i, n), { bold: true, color: PRIMARY }) : text("____", { color: LINE })],
          }),
      );
      const right = matchingCounterparts(section.items).map((t, i) => p([text(`${LETTERS[i]}) `, { color: MUTED }), ...rich(t)], 160));
      return [twoColumns(left, right)];
    }
    case "calculation":
      return section.items.flatMap((item, i) => [
        new Paragraph({ ...numbered, spacing: { before: 160, after: 60 }, children: [num(i), ...rich(item.prompt, { bold: true })] }),
        ...(showKey
          ? item.answer.split("\n").map((line) => p(answer(line), 40, 480))
          : [
              // An empty framed box for the working, then the line for the result.
              new Paragraph({
                children: [],
                spacing: { before: 120, after: 0, line: 2400, lineRule: "exact" },
                indent: { left: 480 },
                border: {
                  top: { style: BorderStyle.DASHED, size: 4, color: LINE, space: 4 },
                  bottom: { style: BorderStyle.DASHED, size: 4, color: LINE, space: 4 },
                  left: { style: BorderStyle.DASHED, size: 4, color: LINE, space: 4 },
                  right: { style: BorderStyle.DASHED, size: 4, color: LINE, space: 4 },
                },
              }),
              p([text("Výsledek: ", { color: MUTED }), text(BLANK, { color: LINE })], 120, 480),
            ]),
      ]);
    case "ordering":
      return section.items.flatMap((item, i) => [
        new Paragraph({ ...numbered, spacing: { before: 160, after: 80 }, children: [num(i), ...rich(item.prompt, { bold: true })] }),
        ...orderingShown(item, start + i).map((entry) =>
          p(
            [
              showKey ? text(`[ ${entry.position} ]  `, { bold: true, color: PRIMARY }) : text("[     ]  ", { color: MUTED }),
              ...rich(entry.text),
            ],
            60,
            480,
          ),
        ),
        ...(showKey && item.answer ? [p(answer(item.answer), 60, 480)] : []),
      ]);
    case "picture":
      return [
        ...(picture
          ? [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                // The SVP and large-print line spacing would otherwise cut the picture to one line.
                spacing: { after: 200, line: 240, lineRule: LineRuleType.AUTO },
                children: [new ImageRun({ type: "jpg", data: picture.data, transformation: { width: picture.width, height: picture.height } })],
              }),
            ]
          : []),
        ...section.items.map(
          (item, i) =>
            new Paragraph({
              ...numbered,
              spacing: { after: 200 },
              children: [num(i), ...rich(item.prompt), text("  "), ...(showKey ? answer(item.answer) : [text(BLANK, { color: LINE })])],
            }),
        ),
      ];
    case "word_search": {
      const puzzle = wordSearch(section.items, large);
      const found = new Set(puzzle.placed.flatMap((x) => x.cells.map(([r, c]) => `${r}-${c}`)));
      const rows = puzzle.grid.map((row, r) =>
        row.map((letter, c) =>
          showKey && found.has(`${r}-${c}`)
            ? letterCell(letter, { border: LINE, fill: "DBE4FF", color: PRIMARY })
            : letterCell(letter, { border: LINE, bold: false }),
        ),
      );
      return [
        gridTable(rows, puzzle.grid.length),
        new Paragraph({
          spacing: { before: 240, after: 120 },
          children: [text(section.items.map((item) => `☐ ${item.prompt}`).join("     "))],
        }),
      ];
    }
    case "crossword": {
      const puzzle = crossword(section.items);
      const rows = puzzle.rows.map((row, i) => [
        letterCell(`${start + i}.`, { bold: false, color: MUTED, width: 2 * CELL }),
        ...Array.from({ length: puzzle.width }, (_, k) => {
          const at = k - row.offset;
          if (at < 0 || at >= row.letters.length) return letterCell("");
          const secret = k === puzzle.column;
          return letterCell(showKey ? row.letters[at] : "", {
            border: secret ? PRIMARY : MUTED,
            borderSize: secret ? 12 : 4,
            fill: secret ? "DBE4FF" : undefined,
            color: PRIMARY,
          });
        }),
      ]);
      return [
        gridTable(rows, puzzle.width + 1, 2 * CELL),
        new Paragraph({ spacing: { before: 240 }, children: [] }),
        ...section.items.map(
          (item, i) =>
            new Paragraph({
              ...numbered,
              spacing: { after: 100 },
              children: [num(i), ...rich(item.prompt), ...(showKey ? [text("   → "), ...answer(item.answer)] : [])],
            }),
        ),
        p([text("Tajenka: ", { bold: true }), showKey ? text(puzzle.solution, { bold: true, color: PRIMARY }) : text(BLANK, { color: LINE })], 120),
      ];
    }
    case "short_answer":
    case "open":
      return section.items.flatMap((item, i) => [
        new Paragraph({ ...numbered, spacing: { before: 160, after: 60 }, children: [num(i), ...rich(item.prompt, { bold: true })] }),
        ...(showKey
          ? item.answer.split("\n").map((line) => p(answer(line), 40, 480))
          : Array.from({ length: section.type === "open" ? 6 : 2 }, writingLine)),
      ]);
  }
}

export async function downloadDocx(sheet: Sheet, { showKey, showPoints }: Options) {
  const header = sheet.header ?? { meta: "", student: STUDENT_LINE };
  const starts = sectionStarts(sheet);
  const total = totalPoints(sheet);
  // SVP sheets print larger and with more space between lines, sheets for the youngest larger still.
  const scale = sheet.large ? 1.35 : sheet.svp ? 1.2 : 1;
  const pictures = await Promise.all(sheet.sections.map((s, si) => (s.type === "picture" ? markedPicture(s, starts[si]) : null)));
  const sz = (halfPoints: number) => Math.round(halfPoints * scale);

  const children: (Paragraph | Table)[] = [
    p([text(header.meta, { size: sz(16), color: MUTED })], 60),
    p([text(header.student, { size: sz(18), color: MUTED })], 360),
    p([...rich(sheet.title, { bold: true, size: sz(32) }), ...(showKey ? [text("  · klíč", { bold: true, size: sz(32), color: PRIMARY })] : [])], 80),
    p(rich(sheet.instructions, { color: MUTED }), 360),
    ...(showKey && sheet.settings?.outcome
      ? [p([text(`Ověřovaný výstup z RVP: ${sheet.settings.outcome}`, { size: sz(18), color: PRIMARY })], 360)]
      : []),
  ];

  sheet.sections.forEach((section, si) => {
    children.push(
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT }],
        spacing: { before: 360, after: 40 },
        keepNext: true,
        children: [
          text(`${LETTERS[si]}   `, { bold: true, color: PRIMARY, size: sz(24) }),
          ...rich(section.title, { bold: true, size: sz(24) }),
          ...(showPoints ? [text(`\t___ / ${formatPoints(sectionPoints(section))}`, { size: sz(18), color: MUTED })] : []),
        ],
      }),
      p(rich(section.instructions, { size: sz(20), color: MUTED }), 200, 400),
      ...sectionItems(section, starts[si], showKey, pictures[si], Boolean(sheet.large)),
    );
  });

  if (showPoints) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 600 },
        children: [text(`Body: ______ / ${formatPoints(total)}`, { bold: true, size: sz(24) })],
      }),
    );
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: sz(22) },
          paragraph: sheet.svp || sheet.large ? { spacing: { line: 320 } } : {},
        },
      },
    },
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
  link.download = `${toPlain(sheet.title).replace(/[\\/:*?"<>|]/g, "").trim() || "test"}${showKey ? " – klíč" : ""}.docx`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
