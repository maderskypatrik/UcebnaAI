import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { materialsToBlocks } from "./materials";
import { TestSchema, WorksheetSchema, type GenerateResult } from "./schemas";

const MODEL = "claude-opus-5-5";

let client: Anthropic | undefined;

export type GenerateInput = {
  output: "test" | "worksheet";
  school: string;
  grade: string;
  subject: string;
  topic: string;
  count: number;
  difficulty: string;
  url: string;
  files: File[];
};

const SYSTEM = `Jsi zkušený český učitel a autor výukových materiálů. Z podkladů, které učitel nahraje, připravuješ testy a pracovní listy pro české školy.

Pravidla:
- Piš spisovnou češtinou, přiměřeně věku a typu školy žáků.
- Vycházej jen z obsahu podkladů. Pokud podklady téma nepokrývají, drž se jich a nevymýšlej fakta, která v nich nejsou.
- Otázky a úlohy ať ověřují porozumění, ne jen opakování vět z textu.
- Nadpis ať je krátký a věcný, pokyny pro žáky jedna až dvě věty.`;

function taskPrompt(input: GenerateInput): string {
  const context = `Škola: ${input.school}, ${input.grade}. Předmět: ${input.subject}. Téma hodiny: ${input.topic}. Obtížnost: ${input.difficulty}.`;
  if (input.output === "test") {
    return `${context}

Vytvoř test s výběrem odpovědí o ${input.count} otázkách. Každá otázka má právě 4 možnosti, z nichž je právě jedna správná. Správnou odpověď rozmísti náhodně (correctIndex 0 až 3). Špatné možnosti ať jsou věrohodné. Ke každé otázce přidej krátké vysvětlení správné odpovědi pro učitele.`;
  }
  return `${context}

Vytvoř pracovní list s ${input.count} úlohami. Střídej typy úloh:
- fill_blank: věta s mezerami označenými ____, do items dej nabídku slov, nebo nech items prázdné,
- short_answer: otázka na krátkou odpověď, items prázdné,
- matching: do items dej dvojice ve tvaru „pojem – vysvětlení“ (učitel je pro žáky zamíchá),
- true_false: do items dej tvrzení, u kterých žák rozhoduje,
- open: otevřená úloha k zamyšlení, items prázdné.
Do answer napiš správné řešení pro učitele (u matching stačí prázdný řetězec).`;
}

export async function generate(input: GenerateInput): Promise<GenerateResult> {
  const materials = await materialsToBlocks(input.files, input.url);
  const schema = input.output === "test" ? TestSchema : WorksheetSchema;

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
    output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
    system: SYSTEM,
    messages: [{ role: "user", content: [...materials, { type: "text", text: taskPrompt(input) }] }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude tento obsah odmítl zpracovat. Zkuste jiné podklady.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("Výstup se nepodařilo dokončit. Zkuste méně otázek.");
  }

  return input.output === "test"
    ? { kind: "test", data: TestSchema.parse(response.parsed_output) }
    : { kind: "worksheet", data: WorksheetSchema.parse(response.parsed_output) };
}
