import { authorize, errorResponse, recordUsage } from "@/lib/api";
import { addSection, cleanImage } from "@/lib/generate";
import { QUESTION_TYPE_IDS, withoutImage, type Sheet } from "@/lib/schemas";

export const maxDuration = 300;

/** One more part for a finished test. Like replacing a question, it doesn't count toward the daily limit. */
export async function POST(request: Request) {
  const { supabase, error: denied } = await authorize(request);
  if (denied) return denied;

  const form = await request.formData();
  const text = (key: string) => String(form.get(key) ?? "").trim();
  let sheet: Sheet;
  let spec: { type: string; count: number; points: number; image?: unknown };
  try {
    sheet = JSON.parse(text("sheet"));
    spec = JSON.parse(text("spec"));
  } catch {
    return Response.json({ error: "Chybí test." }, { status: 400 });
  }
  if (!Array.isArray(sheet?.sections) || !QUESTION_TYPE_IDS.includes(spec?.type as never)) {
    return Response.json({ error: "Chybí test." }, { status: 400 });
  }
  const image = spec.type === "picture" ? cleanImage(spec.image) : undefined;
  if (spec.type === "picture" && !image) {
    return Response.json({ error: "K části s úlohami k obrázku vyberte obrázek." }, { status: 400 });
  }
  if (sheet.sections.length >= 8) {
    return Response.json({ error: "Test může mít nejvýš 8 částí." }, { status: 400 });
  }

  try {
    const { section, usage } = await addSection({
      meta: text("meta").slice(0, 300),
      sheet: {
        ...sheet,
        sections: sheet.sections.slice(0, 8).map((s) => ({ ...withoutImage(s), items: s.items.slice(0, 30) })),
      },
      spec: {
        type: spec.type as (typeof QUESTION_TYPE_IDS)[number],
        count: Math.min(Math.max(Math.round(Number(spec.count)) || 1, 1), 20),
        points: Math.min(Math.max(Number(spec.points) || 1, 0.5), 20),
        image,
      },
      url: text("url"),
      files: form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0),
    });
    await recordUsage(supabase, "section", usage);
    return Response.json({ section });
  } catch (error) {
    return errorResponse(error);
  }
}
