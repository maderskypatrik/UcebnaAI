import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { materialsToBlocks } from "./materials";
import { z } from "zod";
import { GeneratedSchema, QUESTION_TYPES, type Item, type Section, type SectionSpec, type Sheet } from "./schemas";

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
  note: string;
  sections: SectionSpec[];
  url: string;
  files: File[];
};

const SYSTEM = `Jsi zkušený český učitel a autor výukových materiálů. Z podkladů, které učitel nahraje, připravuješ testy a pracovní listy pro české školy.

Pravidla:
- Piš spisovně, přiměřeně věku a typu školy žáků.
- Vycházej jen z obsahu podkladů. Nevymýšlej fakta ani slovíčka, která v nich nejsou.
- U slovní zásoby používej výrazy přesně z podkladů a vybírej je napříč celým seznamem, ne jen ze začátku.
- Úlohy ať ověřují porozumění, ne jen opakování vět z textu. Žádná položka se neopakuje a jedna úloha neprozrazuje odpověď na jinou.
- Nadpis ať je krátký a věcný. Pokyny pro žáky jedna krátká věta.`;

function taskPrompt(input: GenerateInput): string {
  const lines = input.sections.map((s, i) => {
    const t = QUESTION_TYPES[s.type];
    return `${i + 1}. část: ${t.label}, přesně ${s.count} položek. ${t.prompt}`;
  });
  const language =
    input.instructionLanguage === "subject"
      ? "Nadpisy částí a pokyny piš v jazyce předmětu (např. v angličtině u angličtiny), jako to bývá v učebnicích."
      : "Nadpisy částí a pokyny piš česky.";
  return `Škola: ${input.school}, ${input.grade}. Předmět: ${input.subject}. Téma: ${input.topic}. Obtížnost: ${input.difficulty}.

Vytvoř ${input.output === "test" ? "test" : "pracovní list"} rozdělený přesně do těchto částí, ve stejném pořadí:
${lines.join("\n")}

Každá část má krátký nadpis (např. „English → Czech“ nebo „Doplňte správný tvar“, bez písmena a bez čísla) a jednovětý pokyn pro žáky. ${language}${input.note ? `\n\nPoznámka učitele: ${input.note}` : ""}`;
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
    messages: [{ role: "user", content: [...materials, { type: "text", text: taskPrompt(input) }] }],
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
  const source = materials.length
    ? "Vycházej jen z přiložených podkladů."
    : "Podklady už nejsou k dispozici, drž se proto tématu a úrovně ostatních položek.";
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
          {
            type: "text",
            text: `${input.meta}. Test: ${input.title}. Část „${input.section.title}“ (${input.section.instructions}).
Typ položek: ${t.prompt}

Současné položky této části:
${others}

Napiš jednu novou položku místo té označené „NAHRADIT“. Musí být jiná než všechny současné, stejného typu a podobně obtížná. ${source}`,
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
  const existing = input.sheet.sections
    .map((s) => `„${s.title}“: ${s.items.map((item) => item.prompt).join(" | ")}`)
    .join("\n");
  const source = materials.length
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
    section: { ...section, type: input.spec.type, points: input.spec.points },
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
- Nadpis testu ponech, na listu se o SVP nepíše.`;

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
        return a?.items.length
          ? { ...s, title: a.title, instructions: a.instructions, items: a.items, hideBank: false }
          : s;
      }),
    },
    usage: usageOf(response),
  };
}
