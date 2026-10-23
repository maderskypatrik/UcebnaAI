import Anthropic from "@anthropic-ai/sdk";
import { generate } from "@/lib/generate";
import { MAX_ITEMS, QUESTION_TYPE_IDS, type SectionSpec } from "@/lib/schemas";

// Generating from a long PDF can take a minute or two.
export const maxDuration = 300;

function parseSections(raw: string): SectionSpec[] {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((s) => QUESTION_TYPE_IDS.includes(s?.type))
    .map((s) => ({
      type: s.type,
      count: Math.min(Math.max(Math.round(Number(s.count)) || 1, 1), 30),
      points: Math.min(Math.max(Number(s.points) || 1, 0.5), 20),
    }))
    .slice(0, 8);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const text = (key: string) => String(form.get(key) ?? "").trim();

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const url = text("url");
  if (files.length === 0 && !url) {
    return Response.json({ error: "Nahrajte aspoň jeden soubor nebo vložte odkaz." }, { status: 400 });
  }
  const sections = parseSections(text("sections"));
  if (sections.length === 0) {
    return Response.json({ error: "Přidejte aspoň jednu část testu." }, { status: 400 });
  }
  if (sections.reduce((sum, s) => sum + s.count, 0) > MAX_ITEMS) {
    return Response.json({ error: `Test může mít nejvýš ${MAX_ITEMS} položek.` }, { status: 400 });
  }

  try {
    const sheet = await generate({
      output: text("output") === "worksheet" ? "worksheet" : "test",
      school: text("school"),
      grade: text("grade"),
      subject: text("subject"),
      topic: text("topic"),
      difficulty: text("difficulty") || "Střední",
      instructionLanguage: text("instructionLanguage") === "subject" ? "subject" : "czech",
      note: text("note").slice(0, 500),
      sections,
      url,
      files,
    });
    return Response.json(sheet);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "Chybí nebo je neplatný API klíč pro Claude." }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Claude je teď přetížený, zkuste to za chvíli." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Claude API error", error.status, error.message);
      return Response.json(
        { error: `Generování se nepovedlo (chyba ${error.status ?? "spojení"}: ${error.message})` },
        { status: 502 },
      );
    }
    const message = error instanceof Error ? error.message : "Neznámá chyba.";
    return Response.json({ error: message }, { status: 400 });
  }
}
