import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Usage } from "./generate";
import { supabaseConfigured, supabaseForToken } from "./supabase";

type Authorized = { supabase?: SupabaseClient; error?: Response };

/**
 * With Supabase set up, only signed-in teachers with generations left today may call Claude.
 * Without it the app runs open, as before login existed.
 */
export async function authorize(request: Request): Promise<Authorized> {
  if (!supabaseConfigured) return {};
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  const supabase = token ? supabaseForToken(token) : undefined;
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!supabase || !data.user) {
    return { error: Response.json({ error: "Pro vytvoření testu se prosím přihlaste." }, { status: 401 }) };
  }
  const { data: left, error } = await supabase.rpc("generations_left");
  if (error) {
    console.error("Supabase generations_left", error.message);
    return {
      error: Response.json({ error: "Nepodařilo se ověřit denní limit, zkuste to znovu." }, { status: 500 }),
    };
  }
  if (left <= 0) {
    return {
      error: Response.json(
        { error: "Dnešní limit generování je vyčerpaný. Zítra můžete pokračovat." },
        { status: 429 },
      ),
    };
  }
  return { supabase };
}

/** Logs one Claude call for the cost overview. A failed log never fails the teacher's request. */
export async function recordUsage(supabase: SupabaseClient | undefined, kind: "generate" | "replace" | "svp" | "section", usage: Usage) {
  if (!supabase) return;
  const { error } = await supabase.from("claude_calls").insert({
    kind,
    model: usage.model,
    input_tokens: usage.input,
    output_tokens: usage.output,
    cache_read_tokens: usage.cacheRead,
    cache_write_tokens: usage.cacheWrite,
  });
  if (error) console.error("Supabase claude_calls", error.message);
}

/** Turns a failed Claude call into a message a teacher can act on. */
export function errorResponse(error: unknown): Response {
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
