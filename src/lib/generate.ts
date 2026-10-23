import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { materialsToBlocks } from "./materials";
import { GeneratedSchema, QUESTION_TYPES, type SectionSpec, type Sheet } from "./schemas";

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

export async function generate(input: GenerateInput): Promise<Sheet> {
  const materials = await materialsToBlocks(input.files, input.url);

  // An organization-level API key must name its workspace on every request.
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  client ??= new Anthropic({
    defaultHeaders: workspaceId ? { "anthropic-workspace-id": workspaceId } : undefined,
  });
  const response = await client.beta.messages.parse({
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
