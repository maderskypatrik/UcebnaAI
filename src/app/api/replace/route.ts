import { authorize, errorResponse, recordUsage } from "@/lib/api";
import { cleanImage, replaceItem } from "@/lib/generate";
import { QUESTION_TYPE_IDS, type Section } from "@/lib/schemas";

export const maxDuration = 120;

/** One new question in place of one the teacher didn't like. Doesn't count toward the daily limit. */
export async function POST(request: Request) {
  const { supabase, error: denied } = await authorize(request);
  if (denied) return denied;

  const form = await request.formData();
  const text = (key: string) => String(form.get(key) ?? "").trim();
  let section: Section;
  try {
    section = JSON.parse(text("section"));
  } catch {
    return Response.json({ error: "Chybí část testu." }, { status: 400 });
  }
  const index = Number(text("index"));
  if (!QUESTION_TYPE_IDS.includes(section?.type) || !Array.isArray(section.items) || !section.items[index]) {
    return Response.json({ error: "Chybí část testu." }, { status: 400 });
  }

  try {
    const { item, usage } = await replaceItem({
      meta: text("meta").slice(0, 300),
      title: text("title").slice(0, 300),
      section: { ...section, items: section.items.slice(0, 60), image: cleanImage(section.image) },
      index,
      url: text("url"),
      files: form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0),
    });
    await recordUsage(supabase, "replace", usage);
    return Response.json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}
