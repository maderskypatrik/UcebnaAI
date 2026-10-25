import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { materialsToBlocks } from "./materials";
import { z } from "zod";
import {
  GeneratedSchema,
  QUESTION_TYPES,
  THINKING_LEVELS,
  type Item,
  type QuestionType,
  type Section,
  type SectionSpec,
  type Sheet,
} from "./schemas";

type Block = Anthropic.Beta.BetaContentBlockParam;

const IMAGE_DATA_URL = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/;
/** A picture for a picture part is shrunk in the browser; anything much bigger is not one of ours. */
const MAX_IMAGE_CHARS = 1_500_000;

/** The picture of a picture part when it is a small image data URL, otherwise nothing. */
export function cleanImage(value: unknown): string | undefined {
  return typeof value === "string" && value.length <= MAX_IMAGE_CHARS && IMAGE_DATA_URL.test(value) ? value : undefined;
}

function imageBlock(dataUrl: string): Block[] {
  const match = dataUrl.match(IMAGE_DATA_URL);
  if (!match) return [];
  const media_type = match[1] as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  return [{ type: "image", source: { type: "base64", media_type, data: match[2] } }];
}

/** Each picture part's picture, labelled so Claude knows which part it belongs to. */
const pictureBlocks = (sections: { image?: string }[], label = (i: number) => `Obrázek k ${i + 1}. části:`): Block[] =>
  sections.flatMap((s, i) => (s.image ? [{ type: "text" as const, text: label(i) }, ...imageBlock(s.image)] : []));

const MODEL = "claude-opus-5-5";

let client: Anthropic | undefined;

/** Tokens one Claude call used, kept so the cost per test can be measured. */
export type Usage = { model: string; input: number; output: number; cacheRead: number; cacheWrite: number };

function usageOf(response: { model: string; usage: Anthropic.Beta.BetaUsage }): Usage {
  return {
    // With fallbacks on, the model that answered can differ from the one requested.
    model: response.model,
    input: response.usage.input_tokens,
    output: response.usage.output_tokens,
    cacheRead: response.usage.cache_read_input_tokens ?? 0,
    cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
  };
}

export type GenerateInput = {
  output: "test" | "worksheet";
  school: string;
  grade: string;
  subject: string;
  topic: string;
  difficulty: string;
  instructionLanguage: "czech" | "subject";
  /** One of THINKING_LEVELS. */
  thinking: string;
  /** The curriculum outcome the test checks, if the teacher named one. */
  outcome: string;
  /** Pupils of the first five years: plainer language and large print. */
  young: boolean;
  note: string;
  sections: SectionSpec[];
  url: string;
  files: File[];
};

const SYSTEM = `Jsi zkušený český učitel a autor výukových materiálů. Z podkladů, které učitel nahraje, připravuješ testy a pracovní listy pro české školy.

Pravidla:
- Piš spisovně, přiměřeně věku a typu školy žáků.
- Když jsou přiložené podklady, vycházej jen z jejich obsahu. Nevymýšlej fakta ani slovíčka, která v nich nejsou.
- U slovní zásoby používej výrazy přesně z podkladů a vybírej je napříč celým seznamem, ne jen ze začátku.
- Úlohy ať ověřují porozumění, ne jen opakování vět z textu. Žádná položka se neopakuje a jedna úloha neprozrazuje odpověď na jinou.
- Nadpis ať je krátký a věcný. Pokyny pro žáky jedna krátká věta.

Zápis vzorců (platí pro všechny předměty a všechna pole včetně možností a odpovědí):
- Matematické výrazy, rovnice, zlomky, mocniny, odmocniny, jednotky s exponenty a fyzikální vzorce piš v LaTeXu mezi dolary, např. $\\frac{3}{4}$, $x^2 - 5x + 6 = 0$, $\\sqrt{2}$, $v = \\frac{s}{t}$, $9{,}81\\,\\text{m/s}^2$.
- Chemické vzorce a rovnice piš jako $\\ce{…}$, např. $\\ce{H2SO4}$, $\\ce{SO4^2-}$, $\\ce{2H2 + O2 -> 2H2O}$, $\\ce{N2 + 3H2 <=> 2NH3}$.
- Obyčejná čísla a text bez vzorců piš normálně, bez dolarů. Desetinnou čárku piš česky, v LaTeXu jako {,}.
- Znak dolaru jako měnu piš jako \\$ (např. \\$5).
- U doplňování může být vynechané místo ____ i uvnitř věty se vzorcem, ale ne uvnitř dolarů.`;

const YOUNG_RULES =
  "Žáci jsou malé děti z 1. stupně: velmi krátké a jednoduché věty, běžná slova, žádné pojmy navíc. U výběru z možností a u přiřazování můžeš místo slov nebo vedle nich použít emoji obrázky (např. 🍎, 🐟, ☀️), když to dětem pomůže.";

function taskPrompt(input: GenerateInput): string {
  const lines = input.sections.map((s, i) => {
    const t = QUESTION_TYPES[s.type];
    return `${i + 1}. část: ${t.label}, přesně ${s.count} položek. ${t.prompt}`;
  });
  const language =
    input.instructionLanguage === "subject"
      ? "Nadpisy částí a pokyny piš v jazyce předmětu (např. v angličtině u angličtiny), jako to bývá v učebnicích."
      : "Nadpisy částí a pokyny piš česky.";
  const thinking = THINKING_LEVELS.find((t) => t.id === input.thinking) ?? THINKING_LEVELS[0];
  const extra = [
    `Úroveň myšlení: ${thinking.prompt}`,
    input.outcome && `Test ověřuje tento očekávaný výstup z RVP: „${input.outcome}“. Každá úloha ať k němu přispívá.`,
    input.young && YOUNG_RULES,
    !input.files.length &&
      !input.url &&
      "Podklady nejsou přiložené. Vycházej z běžného učiva tohoto předmětu a ročníku podle RVP a českých učebnic. Používej jen ověřená, obecně známá fakta a nic, co by se dalo zpochybnit. Když si u otázky nejsi jistý, napiš jinou.",
    input.note && `Poznámka učitele: ${input.note}`,
  ].filter(Boolean);
  return `Škola: ${input.school}, ${input.grade}. Předmět: ${input.subject}. Téma: ${input.topic}. Obtížnost: ${input.difficulty}.

Vytvoř ${input.output === "test" ? "test" : "pracovní list"} rozdělený přesně do těchto částí, ve stejném pořadí:
${lines.join("\n")}

Každá část má krátký nadpis (např. „English → Czech“ nebo „Doplňte správný tvar“, bez písmena a bez čísla) a jednovětý pokyn pro žáky. ${language}

${extra.join("\n\n")}`;
}

function getClient(): Anthropic {
  // An organization-level API key must name its workspace on every request.
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  client ??= new Anthropic({
    defaultHeaders: workspaceId ? { "anthropic-workspace-id": workspaceId } : undefined,
  });
  return client;
}

/** Called while Claude writes, with how many questions are done so far. */
export type OnProgress = (done: number) => void;

export async function generate(input: GenerateInput, onProgress?: OnProgress): Promise<{ sheet: Sheet; usage: Usage }> {
  const materials = await materialsToBlocks(input.files, input.url);
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(GeneratedSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [...materials, ...pictureBlocks(input.sections), { type: "text", text: taskPrompt(input) }],
      },
    ],
  });
  // Each finished question in the JSON so far has its "prompt" key; enough to show the teacher progress.
  let done = 0;
  stream.on("text", (_, snapshot) => {
    const count = snapshot.split('"prompt"').length - 2;
    if (count > done) onProgress?.((done = count));
  });
  const response = await stream.finalMessage();

  if (response.stop_reason === "refusal") {
    throw new Error("Claude tento obsah odmítl zpracovat. Zkuste jiné podklady.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("Výstup se nepodařilo dokončit. Zkuste méně otázek.");
  }

  const generated = GeneratedSchema.parse(response.parsed_output);
  // Types and points come from the teacher's settings, so a section Claude
  // mislabels or adds can't change how the sheet is scored.
  const sheet: Sheet = {
    kind: input.output,
    large: input.young || undefined,
    title: generated.title,
    instructions: generated.instructions,
    sections: input.sections.map((spec, i) => {
      const section = generated.sections[i];
      return {
        type: spec.type,
        points: spec.points,
        title: section?.title ?? QUESTION_TYPES[spec.type].label,
        instructions: section?.instructions ?? "",
        items: section?.items ?? [],
        ...(spec.image && { image: spec.image }),
      };
    }),
  };
  return { sheet, usage: usageOf(response) };
}

const ItemSchema = z.object({ prompt: z.string(), options: z.array(z.string()), answer: z.string() });

export type ReplaceInput = {
  /** Subject, school and grade as shown in the sheet header. */
  meta: string;
  title: string;
  section: Section;
  /** Index of the item to replace within the section. */
  index: number;
  url: string;
  files: File[];
};

/** One new item for a section, different from the ones already there. */
export async function replaceItem(input: ReplaceInput): Promise<{ item: Item; usage: Usage }> {
  const materials = await materialsToBlocks(input.files, input.url);
  const t = QUESTION_TYPES[input.section.type];
  const others = input.section.items
    .map((item, i) => `${i === input.index ? "NAHRADIT → " : ""}${item.prompt} = ${item.answer}`)
    .join("\n");
  const source = input.section.image
    ? "Vycházej z přiloženého obrázku."
    : materials.length
      ? "Vycházej jen z přiložených podkladů."
      : "Podklady už nejsou k dispozici, drž se proto tématu a úrovně ostatních položek.";
  const secret = input.section.type === "crossword" ? input.section.items[input.index].options[0] : "";
  const keep = secret ? ` Nové slovo musí obsahovat písmeno tajenky „${secret}“ a options = ["${secret}"].` : "";
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(ItemSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          ...materials,
          ...pictureBlocks([input.section], () => "Obrázek k této části:"),
          {
            type: "text",
            text: `${input.meta}. Test: ${input.title}. Část „${input.section.title}“ (${input.section.instructions}).
Typ položek: ${t.prompt}

Současné položky této části:
${others}

Napiš jednu novou položku místo té označené „NAHRADIT“. Musí být jiná než všechny současné, stejného typu a podobně obtížná.${keep} ${source}`,
          },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("Novou otázku se nepodařilo vytvořit, zkuste to znovu.");
  }
  return { item: ItemSchema.parse(response.parsed_output), usage: usageOf(response) };
}

const SectionSchema = GeneratedSchema.shape.sections.element;

export type SectionInput = {
  meta: string;
  sheet: Sheet;
  spec: SectionSpec;
  url: string;
  files: File[];
};

/** One more part for a finished test, on the same topic and not repeating its questions. */
export async function addSection(input: SectionInput): Promise<{ section: Section; usage: Usage }> {
  const materials = await materialsToBlocks(input.files, input.url);
  const t = QUESTION_TYPES[input.spec.type];
  const picture = input.spec.image ? pictureBlocks([input.spec], () => "Obrázek k nové části:") : [];
  const existing = input.sheet.sections
    .map((s) => `„${s.title}“: ${s.items.map((item) => item.prompt).join(" | ")}`)
    .join("\n");
  const source = picture.length
    ? "Úlohy piš k přiloženému obrázku."
    : materials.length
      ? "Vycházej jen z přiložených podkladů."
      : "Podklady už nejsou k dispozici, drž se proto tématu a úrovně stávajících částí.";
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(SectionSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          ...materials,
          ...picture,
          {
            type: "text",
            text: `${input.meta}. ${input.sheet.kind === "test" ? "Test" : "Pracovní list"}: ${input.sheet.title}.

Stávající části a jejich otázky:
${existing}

Napiš jednu novou část: ${t.label}, přesně ${input.spec.count} položek. ${t.prompt}
Otázky se nesmí opakovat se stávajícími. Část má krátký nadpis bez písmena a jednovětý pokyn pro žáky, ve stejném jazyce jako nadpisy stávajících částí. ${source}`,
          },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("Novou část se nepodařilo vytvořit, zkuste to znovu.");
  }
  const section = SectionSchema.parse(response.parsed_output);
  return {
    section: {
      ...section,
      type: input.spec.type,
      points: input.spec.points,
      ...(input.spec.image && { image: input.spec.image }),
    },
    usage: usageOf(response),
  };
}

const SVP_RULES = `Upravuješ hotový test pro žáky se speciálními vzdělávacími potřebami (SVP), například s dyslexií, poruchou pozornosti nebo slabší češtinou.

Pravidla úpravy:
- Zachovej obsah, učivo a cíl každé položky. Odpovědi musí zůstat správné a odpovídat nové podobě otázky.
- Krátké a jednoduché věty, běžná slova, jedna informace ve větě. Žádné dvojité zápory ani chytáky.
- Pokyn každé části napiš jako jednoduchý krok („Zakroužkuj…“, „Napiš…“) a přidej krátký příklad nebo nápovědu, jak úlohu řešit.
- U výběru z možností nech nejvýš tři možnosti (A–C), správná odpověď je písmeno.
- U otevřených otázek dej oporu: začátek odpovědi, nápovědné otázky nebo slova, která mají v odpovědi být.
- U slovíček (překlady, přiřazování, doplňování) ponech stejná slovíčka a odpovědi, uprav jen pokyny.
- Zachovej stejný počet částí a stejný počet položek v každé části, ve stejném pořadí.
- U seřazování, úloh k obrázku, osmisměrky a křížovky ponech položky (options) a odpovědi beze změny, uprav jen zadání a nápovědy.
- Nadpis testu ponech, na listu se o SVP nepíše.`;

/** What of an item the SVP version must keep: puzzle words, picture marks and the right order. */
function keepForSvp(type: QuestionType, original: Item, adapted: Item): Item {
  switch (type) {
    case "word_search":
      return original;
    case "crossword":
      return { ...adapted, answer: original.answer, options: original.options };
    case "picture":
    case "ordering":
      return { ...adapted, options: original.options };
    default:
      return adapted;
  }
}

/** The same test rewritten for students with special educational needs. */
export async function adaptSheet(sheet: Sheet, meta: string): Promise<{ sheet: Sheet; usage: Usage }> {
  const content = {
    title: sheet.title,
    instructions: sheet.instructions,
    sections: sheet.sections.map((s) => ({
      type: QUESTION_TYPES[s.type].label,
      title: s.title,
      instructions: s.instructions,
      items: s.items,
    })),
  };
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(GeneratedSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `${SVP_RULES}\n\n${meta}\n\nPůvodní test:\n${JSON.stringify(content, null, 1)}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") {
    throw new Error("Úpravu se nepodařilo vytvořit, zkuste to znovu.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("Úpravu se nepodařilo dokončit. Zkuste test s méně otázkami.");
  }
  const adapted = GeneratedSchema.parse(response.parsed_output);
  // Structure, types and points stay the teacher's; a part Claude drops keeps its original items.
  return {
    sheet: {
      ...sheet,
      svp: true,
      title: adapted.title || sheet.title,
      instructions: adapted.instructions,
      sections: sheet.sections.map((s, i) => {
        const a = adapted.sections[i];
        if (!a?.items.length) return s;
        const items = a.items.map((item, k) => (s.items[k] ? keepForSvp(s.type, s.items[k], item) : item));
        return { ...s, title: a.title, instructions: a.instructions, items, hideBank: false };
      }),
    },
    usage: usageOf(response),
  };
}
