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
  calculation: {
    label: "Příklad k výpočtu",
    hint: "výpočet s místem na postup",
    points: 3,
    prompt:
      "Příklad k výpočtu: prompt = zadání příkladu nebo slovní úlohy se všemi potřebnými údaji, answer = stručný postup řešení po krocích, každý krok na nový řádek, a na posledním řádku „Výsledek: …“ i s jednotkou. Čísla volej tak, aby výpočet šel bez kalkulačky, pokud podklady nepočítají s kalkulačkou. options prázdné.",
  },
  ordering: {
    label: "Seřazování",
    hint: "časová osa, postup, děj",
    points: 2,
    prompt:
      "Seřazování: prompt = pokyn, co a jak seřadit (např. „Seřaď události od nejstarší po nejnovější.“ nebo „Seřaď kroky pokusu.“), options = 4 až 6 krátkých položek ve SPRÁVNÉM pořadí (aplikace je žákům sama zamíchá), answer = jedna věta, proč je pořadí takové (např. letopočty). Hodí se na dějiny, postupy, děj příběhu, vývojová stadia, kroky výpočtu.",
  },
  picture: {
    label: "Úlohy k obrázku",
    hint: "popis schématu, mapy, grafu",
    points: 1,
    prompt:
      "Úlohy k obrázku: k této části je přiložen obrázek (schéma, mapa, graf, fotografie). prompt = úkol k obrázku, např. „Pojmenuj označenou část.“, „Jaká byla teplota v pátek?“, „Co znázorňuje šipka?“. Pokud se úkol ptá na konkrétní místo, options = právě jedna položka „x,y“ s polohou toho místa v procentech šířky a výšky obrázku (0 až 100, např. „42,63“); aplikace tam nakreslí číslo úlohy, takže v zadání číslo nepiš. Jinak options prázdné. Míst označených na obrázku ať je co nejvíc z různých částí. answer = správná odpověď v několika slovech. Ptej se jen na to, co je na obrázku opravdu vidět.",
  },
  word_search: {
    label: "Osmisměrka",
    hint: "hledání slov, hlavně 1. stupeň",
    points: 1,
    prompt:
      "Osmisměrka: prompt = jedno slovo k vyhledání, velkými písmeny, bez mezer a pomlček, 3 až 10 písmen, s háčky a čárkami, answer = krátká nápověda nebo význam slova. options prázdné. Aplikace z hledaných slov sama sestaví mřížku.",
  },
  crossword: {
    label: "Křížovka s tajenkou",
    hint: "hádanky, hlavně 1. stupeň",
    points: 1,
    prompt:
      "Křížovka s tajenkou: nejdřív si vymysli tajenku k tématu (jedno slovo nebo sousloví bez mezer), která má přesně tolik písmen, kolik je položek. Pro každé písmeno tajenky jedna položka: prompt = krátká nápověda nebo hádanka, answer = hledané slovo velkými písmeny bez mezer, které dané písmeno tajenky obsahuje, options = právě jedna položka s tímto písmenem tajenky (velké písmeno). Položky jdou v pořadí písmen tajenky.",
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

/**
 * One part of the test as the teacher configures it. A picture part carries its picture
 * as a small JPEG data URL, which ends up on the sheet.
 */
export type SectionSpec = { type: QuestionType; count: number; points: number; image?: string };

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
  /** Picture sections: the picture as a data URL; items mark places on it with "x,y" in percent. */
  image?: string;
};

export type SheetSettings = {
  schoolId: string;
  grade: string;
  subject: string;
  difficulty: string;
  instructionLanguage: "czech" | "subject";
  /** Bloom's level the questions aim at, one of THINKING_LEVELS. */
  thinking?: string;
  /** The curriculum outcome (výstup z RVP) the test checks, in the teacher's words. */
  outcome?: string;
};

/** Levels of thinking after Bloom's taxonomy, as Czech teachers know them. */
export const THINKING_LEVELS = [
  { id: "mix", label: "Vyvážený mix", prompt: "Úlohy rozlož napříč úrovněmi: zhruba třetina zapamatování, třetina porozumění a třetina použití nebo zdůvodnění." },
  { id: "remember", label: "Zapamatování a porozumění", prompt: "Úlohy ať ověřují hlavně znalost pojmů, faktů a jejich porozumění (vyjmenuj, vysvětli vlastními slovy, rozliš)." },
  { id: "apply", label: "Použití v nové situaci", prompt: "Úlohy ať hlavně ověřují použití učiva v nových situacích a příkladech, které v podkladech nejsou doslova (použij, vypočítej, urči na příkladu)." },
  { id: "analyze", label: "Analýza a zdůvodnění", prompt: "Úlohy ať hlavně vyžadují analýzu, porovnání, zdůvodnění a hodnocení (porovnej, zdůvodni, co by se stalo, kdyby…, posuď)." },
] as const;

/** What "Podobný test" carries into the wizard: the same settings and parts, new materials. */
export type Template = SheetSettings & { output: "test" | "worksheet"; sections: SectionSpec[] };

export const templateFrom = (sheet: Sheet): Template => ({
  // Sheets saved before settings were kept start the wizard from the first step.
  schoolId: "",
  grade: "",
  subject: "",
  difficulty: "Střední",
  instructionLanguage: "czech",
  ...sheet.settings,
  output: sheet.kind,
  sections: sheet.sections
    .filter((s) => s.items.length > 0)
    .map((s) => ({ type: s.type, count: Math.min(s.items.length, 30), points: s.points })),
});

/** A part or spec without its picture, where only the text is needed. */
export function withoutImage<T extends { image?: string }>(part: T): T {
  const copy = { ...part };
  delete copy.image;
  return copy;
}

/** Specs without their pictures, for keeping in localStorage; a new test needs a new picture anyway. */
export const withoutImages = (sections: SectionSpec[]) => sections.map(withoutImage);

export type Sheet = {
  kind: "test" | "worksheet";
  /** The wizard's choices, kept so the teacher can start a similar test from the Kabinet. */
  settings?: SheetSettings;
  /** Header lines above the title; filled in by the app, editable by the teacher. */
  header?: { meta: string; student: string };
  title: string;
  instructions: string;
  sections: Section[];
  /** Adapted for students with special educational needs: simpler wording, larger print. */
  svp?: boolean;
  /** Large print for the youngest pupils (1. stupeň). */
  large?: boolean;
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
    id: "calculations",
    label: "Výpočty",
    hint: "matematika, fyzika, chemie",
    sections: [
      { type: "multiple_choice", count: 4, points: 1 },
      { type: "fill_blank", count: 4, points: 1 },
      { type: "calculation", count: 4, points: 3 },
    ],
  },
  {
    id: "timeline",
    label: "Dějepis a postupy",
    hint: "seřazování, výběr, krátké odpovědi",
    sections: [
      { type: "ordering", count: 3, points: 2 },
      { type: "multiple_choice", count: 6, points: 1 },
      { type: "short_answer", count: 3, points: 2 },
    ],
  },
  {
    id: "young",
    label: "1. stupeň",
    hint: "pravda/nepravda, křížovka, osmisměrka",
    sections: [
      { type: "true_false", count: 5, points: 1 },
      { type: "crossword", count: 6, points: 1 },
      { type: "word_search", count: 8, points: 1 },
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
export function shuffled<T>(items: T[], seed: number): T[] {
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
      // A crossword's rows spell its secret word, so they keep their order.
      items: (section.type === "crossword" ? section.items : shuffled(section.items, 7 + si)).map((item, ii) => {
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

/** An ordering item as the student sees it: shuffled, each entry with the position it really has. */
export function orderingShown(item: Item, seed: number) {
  const order = shuffled(
    item.options.map((_, k) => k),
    101 + seed * 13,
  );
  return order.map((k) => ({ text: item.options[k], position: k + 1 }));
}

/** A marked place on a picture, "x,y" in percent, or null when the item asks about the whole picture. */
export function pictureMarker(item: Item): { x: number; y: number } | null {
  const match = item.options[0]?.match(/^\s*(\d+(?:[.,]\d+)?)\s*[,;]\s*(\d+(?:[.,]\d+)?)\s*$/);
  if (!match) return null;
  const clamp = (v: string) => Math.min(Math.max(Number(v.replace(",", ".")), 2), 98);
  return { x: clamp(match[1]), y: clamp(match[2]) };
}

export const markerOption = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
