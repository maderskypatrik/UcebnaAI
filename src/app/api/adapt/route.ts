import { authorize, errorResponse, recordUsage } from "@/lib/api";
import { adaptSheet } from "@/lib/generate";
import { MAX_ITEMS, QUESTION_TYPE_IDS, type Sheet } from "@/lib/schemas";

export const maxDuration = 300;

/** The teacher's test rewritten for students with special educational needs, saved as a new Kabinet entry. */
export async function POST(request: Request) {
  const { supabase, error: denied } = await authorize(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const sheet = body?.sheet as Sheet | undefined;
  const meta = String(body?.meta ?? "").slice(0, 300);
  const valid =
    sheet &&
    typeof sheet.title === "string" &&
    Array.isArray(sheet.sections) &&
    sheet.sections.length > 0 &&
    sheet.sections.length <= 8 &&
    sheet.sections.every((s) => QUESTION_TYPE_IDS.includes(s?.type) && Array.isArray(s.items)) &&
    sheet.sections.reduce((sum, s) => sum + s.items.length, 0) <= MAX_ITEMS;
  if (!valid) return Response.json({ error: "Chybí test k úpravě." }, { status: 400 });

  try {
    const { sheet: adapted, usage } = await adaptSheet(sheet, meta);
    if (!supabase) return Response.json({ sheet: adapted });

    await recordUsage(supabase, "svp", usage);
    const { data: left } = await supabase.rpc("consume_generation");
    const { data: saved, error } = await supabase
      .from("sheets")
      .insert({ kind: adapted.kind, title: adapted.title, meta: adapted.header?.meta ?? meta, data: adapted })
      .select("id")
      .single();
    if (error) console.error("Supabase save", error.message);
    return Response.json({ sheet: adapted, id: saved?.id ?? null, left: left ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}
