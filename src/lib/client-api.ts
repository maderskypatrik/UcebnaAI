import { withoutImage, type Item, type Section, type SectionSpec, type Sheet } from "./schemas";
import { getSupabase, supabaseConfigured } from "./supabase";

/** The signed-in teacher's token for our API routes, when login is switched on. */
export async function authHeaders(): Promise<HeadersInit> {
  if (!supabaseConfigured) return {};
  const { data } = await getSupabase().auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

/** POSTs a form to one of our API routes and returns its JSON, or throws its Czech error message. */
export async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(path, { method: "POST", body: form, headers: await authHeaders() });
  const body = await res.json().catch(() => ({ error: "Server neodpověděl, zkuste to znovu." }));
  if (!res.ok) throw new Error(body.error);
  return body as T;
}

type Generated = { sheet: Sheet; id?: string | null; left?: number | null };

/** Creates a test, reporting how many questions Claude has written so far. */
export async function requestGeneration(form: FormData, onProgress: (done: number) => void): Promise<Generated> {
  const res = await fetch("/api/generate", { method: "POST", body: form, headers: await authHeaders() });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({ error: "Server neodpověděl, zkuste to znovu." }));
    throw new Error(body.error);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines.filter(Boolean)) {
      const event = JSON.parse(line);
      if (event.type === "progress") onProgress(event.done);
      if (event.type === "error") throw new Error(event.error);
      if (event.type === "done") return event as Generated;
    }
  }
  throw new Error("Spojení se přerušilo, zkuste to prosím znovu.");
}

/** The test rewritten for students with special educational needs; saved to the Kabinet when login is on. */
export async function requestAdaptation(sheet: Sheet, meta: string) {
  const res = await fetch("/api/adapt", {
    method: "POST",
    body: JSON.stringify({ sheet, meta }),
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
  });
  const body = await res.json().catch(() => ({ error: "Server neodpověděl, zkuste to znovu." }));
  if (!res.ok) throw new Error(body.error);
  return body as { sheet: Sheet; id?: string | null; left?: number | null };
}

/** One new question from the AI; materials are sent along while the teacher still has them. */
export async function requestReplacement(args: {
  section: Section;
  index: number;
  title: string;
  meta: string;
  files?: File[];
  url?: string;
}): Promise<Item> {
  const form = new FormData();
  form.set("section", JSON.stringify(args.section));
  form.set("index", String(args.index));
  form.set("title", args.title);
  form.set("meta", args.meta);
  form.set("url", args.url ?? "");
  args.files?.forEach((f) => form.append("files", f));
  const { item } = await postForm<{ item: Item }>("/api/replace", form);
  return item;
}

/** One more part for a finished test; materials are sent along while the teacher still has them. */
export async function requestSection(args: {
  sheet: Sheet;
  spec: SectionSpec;
  meta: string;
  files?: File[];
  url?: string;
}): Promise<Section> {
  const form = new FormData();
  // The other parts' pictures are not needed for writing a new part.
  form.set("sheet", JSON.stringify({ ...args.sheet, sections: args.sheet.sections.map(withoutImage) }));
  form.set("spec", JSON.stringify(args.spec));
  form.set("meta", args.meta);
  form.set("url", args.url ?? "");
  args.files?.forEach((f) => form.append("files", f));
  const { section } = await postForm<{ section: Section }>("/api/section", form);
  return section;
}
