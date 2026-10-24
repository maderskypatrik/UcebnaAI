import { generate } from "@/lib/generate";
import { MAX_ITEMS, QUESTION_TYPE_IDS, type SectionSpec } from "@/lib/schemas";
import { authorize, errorResponse } from "@/lib/api";

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
    sheet.settings = {
      schoolId: text("schoolId"),
      grade: text("grade"),
      subject: text("subject"),
      difficulty: text("difficulty") || "Střední",
      instructionLanguage: text("instructionLanguage") === "subject" ? "subject" : "czech",
    };
    if (!supabase) return Response.json({ sheet });

    const { data: left } = await supabase.rpc("consume_generation");
    const { data: saved, error } = await supabase
      .from("sheets")
      .insert({ kind: sheet.kind, title: sheet.title, meta: text("meta"), data: sheet })
      .select("id")
      .single();
    if (error) console.error("Supabase save", error.message);
    return Response.json({ sheet, id: saved?.id ?? null, left: left ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}
