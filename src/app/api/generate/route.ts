import { generate } from "@/lib/generate";
import { MAX_ITEMS, QUESTION_TYPE_IDS, type SectionSpec } from "@/lib/schemas";
import { authorize, errorResponse, recordUsage } from "@/lib/api";

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
  const { supabase, error: denied } = await authorize(request);
  if (denied) return denied;

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

  const input = {
    output: text("output") === "worksheet" ? ("worksheet" as const) : ("test" as const),
    school: text("school"),
    grade: text("grade"),
    subject: text("subject"),
    topic: text("topic"),
    difficulty: text("difficulty") || "Střední",
    instructionLanguage: text("instructionLanguage") === "subject" ? ("subject" as const) : ("czech" as const),
    note: text("note").slice(0, 500),
    sections,
    url,
    files,
  };
  const meta = text("meta");
  const settings = {
    schoolId: text("schoolId"),
    grade: input.grade,
    subject: input.subject,
    difficulty: input.difficulty,
    instructionLanguage: input.instructionLanguage,
  };

  // One JSON object per line: progress while Claude writes, then the result or an error.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        const { sheet, usage } = await generate(input, (done) => send({ type: "progress", done }));
        sheet.settings = settings;
        if (!supabase) {
          send({ type: "done", sheet });
        } else {
          await recordUsage(supabase, "generate", usage);
          const { data: left } = await supabase.rpc("consume_generation");
          const { data: saved, error } = await supabase
            .from("sheets")
            .insert({ kind: sheet.kind, title: sheet.title, meta, data: sheet })
            .select("id")
            .single();
          if (error) console.error("Supabase save", error.message);
          send({ type: "done", sheet, id: saved?.id ?? null, left: left ?? null });
        }
      } catch (error) {
        const response = errorResponse(error);
        send({ type: "error", ...(await response.json()) });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
}
