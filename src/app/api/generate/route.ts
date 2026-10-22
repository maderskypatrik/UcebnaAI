import Anthropic from "@anthropic-ai/sdk";
import { generate } from "@/lib/generate";

// Generating from a long PDF can take a minute or two.
export const maxDuration = 300;

const MAX_COUNT = 30;

export async function POST(request: Request) {
  const form = await request.formData();
  const text = (key: string) => String(form.get(key) ?? "").trim();

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const url = text("url");
  if (files.length === 0 && !url) {
    return Response.json({ error: "Nahrajte aspoň jeden soubor nebo vložte odkaz." }, { status: 400 });
  }

  try {
    const result = await generate({
      output: text("output") === "worksheet" ? "worksheet" : "test",
      school: text("school"),
      grade: text("grade"),
      subject: text("subject"),
      topic: text("topic"),
      count: Math.min(Math.max(Number(text("count")) || 10, 1), MAX_COUNT),
      difficulty: text("difficulty") || "Střední",
      url,
      files,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "Chybí nebo je neplatný API klíč pro Claude." }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Claude je teď přetížený, zkuste to za chvíli." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Claude API error", error.status, error.message);
      return Response.json({ error: "Generování se nepovedlo, zkuste to znovu." }, { status: 502 });
    }
    const message = error instanceof Error ? error.message : "Neznámá chyba.";
    return Response.json({ error: message }, { status: 400 });
  }
}
