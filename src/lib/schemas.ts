import { z } from "zod";

export const QUESTION_TYPES = {
  translate_to_czech: {
    label: "Překlad do češtiny",
    hint: "slovíčka a fráze z cizího jazyka",
    points: 1,
    prompt:
      "Překlad do češtiny: prompt = slovo nebo fráze v cizím jazyce přesně tak, jak je v podkladech, answer = český překlad (případně více variant oddělených lomítkem). options prázdné.",
  },
  translate_from_czech: {
    label: "Překlad z češtiny",
    hint: "česká slovíčka do cizího jazyka",
    points: 1,
    prompt:
      "Překlad z češtiny: prompt = české slovo nebo fráze, answer = výraz v cizím jazyce z podkladů. options prázdné.",
  },
  multiple_choice: {
    label: "Výběr z možností",
    hint: "uzavřená otázka A–D",
    points: 1,
    prompt:
      "Výběr z možností: prompt = otázka, options = právě 4 možnosti, z nichž je právě jedna správná, answer = písmeno správné možnosti (A, B, C nebo D). Správné odpovědi rozmísti mezi písmena rovnoměrně. Špatné možnosti ať jsou věrohodné.",
  },
  true_false: {
    label: "Pravda / nepravda",
    hint: "žák rozhoduje o tvrzení",
    points: 1,
    prompt:
      "Pravda / nepravda: prompt = jedno tvrzení, answer = „P“ (pravda) nebo „N“ (nepravda). Zhruba polovina tvrzení ať je nepravdivá. options prázdné.",
  },
  fill_blank: {
    label: "Doplňování",
    hint: "věty s vynechaným slovem",
    points: 1,
    prompt:
      "Doplňování: prompt = věta s jedním vynechaným místem označeným ____, answer = doplněné slovo nebo tvar. options nech prázdné, nabídku slov k celé části vloží učitel z odpovědí sám.",
  },
  matching: {
    label: "Přiřazování",
    hint: "pojem ke správnému vysvětlení",
    points: 1,
    prompt:
      "Přiřazování: prompt = pojem, answer = jeho vysvětlení nebo protějšek (krátce, bez čísla). Aplikace protějšky pro žáky sama zamíchá. options prázdné.",
  },
  short_answer: {
    label: "Krátká odpověď",
    hint: "otevřená otázka na pár slov",
    points: 2,
    prompt:
      "Krátká odpověď: prompt = otázka, na kterou stačí odpověď o několika slovech nebo jedné větě, answer = vzorová odpověď. options prázdné.",
  },
  open: {
    label: "Otevřená úloha",
    hint: "delší odpověď, vysvětlení, sloh",
    points: 5,
    prompt:
      "Otevřená úloha: prompt = úloha vyžadující delší odpověď (vysvětli, porovnej, napiš krátký text), answer = co má dobrá odpověď obsahovat, v bodech. options prázdné.",
  },
} as const;

export type QuestionType = keyof typeof QUESTION_TYPES;
export const QUESTION_TYPE_IDS = Object.keys(QUESTION_TYPES) as QuestionType[];

/** One part of the test as the teacher configures it. */
export type SectionSpec = { type: QuestionType; count: number; points: number };

/** What Claude returns: the content only. Types and points stay with the teacher's spec. */
export const GeneratedSchema = z.object({
  title: z.string(),
  instructions: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      instructions: z.string(),
      items: z.array(
        z.object({
          prompt: z.string(),
          options: z.array(z.string()),
          answer: z.string(),
        }),
      ),
    }),
  ),
});

export type Item = z.infer<typeof GeneratedSchema>["sections"][number]["items"][number];

export type Section = {
  type: QuestionType;
  points: number;
  title: string;
  instructions: string;
  items: Item[];
  /** Fill-in sections only: leave out the word bank. */
  hideBank?: boolean;
};

export type Sheet = {
  kind: "test" | "worksheet";
  /** Header lines above the title; filled in by the app, editable by the teacher. */
  header?: { meta: string; student: string };
  title: string;
  instructions: string;
  sections: Section[];
};

export type Preset = { id: string; label: string; hint: string; sections: SectionSpec[] };

export const PRESETS: Preset[] = [
  {
    id: "vocabulary",
    label: "Test slovíček",
    hint: "překlad oběma směry",
    sections: [
      { type: "translate_to_czech", count: 10, points: 1 },
      { type: "translate_from_czech", count: 10, points: 1 },
    ],
  },
  {
    id: "classic",
    label: "Klasický test",
    hint: "výběr, pravda/nepravda, krátké odpovědi",
    sections: [
      { type: "multiple_choice", count: 8, points: 1 },
      { type: "true_false", count: 5, points: 1 },
      { type: "short_answer", count: 3, points: 2 },
    ],
  },
  {
    id: "grammar",
    label: "Gramatika",
    hint: "doplňování a výběr tvaru",
    sections: [
      { type: "fill_blank", count: 10, points: 1 },
      { type: "multiple_choice", count: 5, points: 1 },
    ],
  },
  {
    id: "comprehension",
    label: "Porozumění textu",
    hint: "pravda/nepravda, otázky, úvaha",
    sections: [
      { type: "true_false", count: 6, points: 1 },
      { type: "short_answer", count: 4, points: 2 },
      { type: "open", count: 1, points: 5 },
    ],
  },
  {
    id: "terms",
    label: "Pojmy a definice",
    hint: "přiřazování a doplňování",
    sections: [
      { type: "matching", count: 8, points: 1 },
      { type: "fill_blank", count: 6, points: 1 },
    ],
  },
];

export const MAX_ITEMS = 60;

export const sectionPoints = (s: { points: number; items: unknown[] }) => s.points * s.items.length;
export const totalPoints = (sheet: Sheet) => sheet.sections.reduce((sum, s) => sum + sectionPoints(s), 0);

export const STUDENT_LINE = "Jméno: ______________________ Třída: ______ Datum: __________";

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const formatPoints = (n: number) => `${String(n).replace(".", ",")} b`;

/** First item number of each section; numbering continues across sections, as on a printed test. */
export const sectionStarts = (sheet: Sheet) =>
  sheet.sections.reduce<number[]>(
    (acc, _, i) => [...acc, i === 0 ? 1 : acc[i - 1] + sheet.sections[i - 1].items.length],
    [],
  );

/**
 * Matching counterparts shifted by one, so none sits next to its own term.
 * Term i's counterpart ends up at letter i - 1.
 */
export const matchingCounterparts = (items: Item[]) => items.map((_, i) => items[(i + 1) % items.length].answer);
export const matchingKeyLetter = (i: number, n: number) => LETTERS[(i - 1 + n) % n];

/** Fill-in word bank: all answers in alphabetical order. */
export const wordBank = (items: Item[]) => items.map((item) => item.answer).sort((a, b) => a.localeCompare(b, "cs"));

/** Deterministic shuffle, so variant B looks the same every time it is shown or printed. */
function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let state = seed;
  const random = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // A shuffle can land on the original order; then rotate so B always differs.
  if (out.length > 1 && out.every((x, i) => x === items[i])) out.push(out.shift()!);
  return out;
}

/** Variant B of a sheet: questions and answer options in a different order, with the key to match. */
export function variantB(sheet: Sheet): Sheet {
  return {
    ...sheet,
    sections: sheet.sections.map((section, si) => ({
      ...section,
      items: shuffled(section.items, 7 + si).map((item, ii) => {
        if (section.type !== "multiple_choice" || item.options.length < 2) return item;
        const correct = LETTERS.indexOf(item.answer.trim().toUpperCase().charAt(0));
        const order = shuffled(
          item.options.map((_, k) => k),
          31 + si * 61 + ii,
        );
        return {
          ...item,
          options: order.map((k) => item.options[k]),
          answer: correct >= 0 ? LETTERS[order.indexOf(correct)] : item.answer,
        };
      }),
    })),
  };
}
