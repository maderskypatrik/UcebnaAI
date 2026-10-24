import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Login and Kabinet switch on once both Supabase variables are set in Vercel. */
export const supabaseConfigured = Boolean(url && anonKey);

/** Sign-in buttons to show besides e-mail, e.g. "google,azure". Each must be enabled in Supabase first. */
export const oauthProviders = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "")
  .split(",")
  .map((p) => p.trim())
  .filter((p): p is "google" | "azure" => p === "google" || p === "azure");

let browserClient: SupabaseClient | undefined;

/** The browser's client: keeps the teacher's session and reads the Kabinet under row level security. */
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) throw new Error("Supabase není nastavený.");
  browserClient ??= createClient(url, anonKey, { auth: { flowType: "pkce" } });
  return browserClient;
}

/** A server-side client that acts as the teacher whose access token came with the request. */
export function supabaseForToken(token: string): SupabaseClient {
  if (!url || !anonKey) throw new Error("Supabase není nastavený.");
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export type SheetRow = {
  id: string;
  kind: "test" | "worksheet";
  title: string;
  meta: string;
  /** Kabinet folder, e.g. a class or subject; empty when the test is in none. */
  folder: string;
  /** Adapted for students with special educational needs. */
  svp: boolean | null;
  created_at: string;
  updated_at: string;
};

/** Columns for SheetRow; `svp` is read from inside the saved sheet. */
export const SHEET_ROW_COLUMNS = "id, kind, title, meta, folder, svp:data->svp, created_at, updated_at";
