import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { materialsToBlocks } from "./materials";
import { z } from "zod";
import { GeneratedSchema, QUESTION_TYPES, type Item, type Section, type SectionSpec, type Sheet } from "./schemas";

const MODEL = "claude-opus-5-5";

let client: Anthropic | undefined;

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

export async function generate(input: GenerateInput): Promise<Sheet> {
  const materials = await materialsToBlocks(input.files, input.url);
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(GeneratedSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: [...materials, { type: "text", text: taskPrompt(input) }] }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude tento obsah odmítl zpracovat. Zkuste jiné podklady.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("Výstup se nepodařilo dokončit. Zkuste méně otázek.");
  }

  const generated = GeneratedSchema.parse(response.parsed_output);
  // Types and points come from the teacher's settings, so a section Claude
  // mislabels or adds can't change how the sheet is scored.
  return {
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
export async function replaceItem(input: ReplaceInput): Promise<Item> {
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
  return ItemSchema.parse(response.parsed_output);
}
