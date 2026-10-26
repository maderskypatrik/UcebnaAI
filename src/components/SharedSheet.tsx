"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Sheet as SheetData } from "@/lib/schemas";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { rememberReturn } from "@/lib/return-to";
import { useAuth } from "./AuthProvider";
import { Sheet } from "./Sheet";

type Shared = { kind: "test" | "worksheet"; title: string; meta: string; data: SheetData };

/** A test a colleague shared by link: viewable by anyone with the link, copyable into one's own Kabinet. */
export function SharedSheet({ shareId }: { shareId: string }) {
  const { session } = useAuth();
  const router = useRouter();
  const [shared, setShared] = useState<Shared | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    getSupabase()
      .rpc("shared_sheet", { share: shareId })
      .then(({ data, error }) => {
        const row = (data as Shared[] | null)?.[0];
        if (error || !row) setError("Tento odkaz už neplatí. Požádejte kolegu o nový.");
        else setShared(row);
      });
  }, [shareId]);

  async function saveCopy() {
    if (!shared) return;
    setSaving(true);
    const { data, error } = await getSupabase()
      .from("sheets")
      .insert({ kind: shared.kind, title: shared.title, meta: shared.meta, data: shared.data })
      .select("id")
      .single();
    setSaving(false);
    if (error) setError(`Uložení se nepovedlo: ${error.message}`);
    else router.push(`/kabinet/${data.id}`);
  }

  if (!supabaseConfigured) return <p className="text-body-lg text-on-surface-variant">Sdílení zatím není zapnuté.</p>;
  if (error) return <p className="rounded-xl bg-error-container px-4 py-3 text-on-error-container">{error}</p>;
  if (!shared) return <p className="text-body-lg text-on-surface-variant">Načítám…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-secondary-container/60 px-6 py-4 print:hidden">
        <p className="text-body-lg text-on-surface">
          Tento test s vámi sdílí kolega. Uložte si ho do Kabinetu a můžete ho upravovat po svém.
        </p>
        {session ? (
          <button
            type="button"
            onClick={saveCopy}
            disabled={saving}
            className="bg-assistant rounded-xl px-5 py-2.5 font-medium text-on-primary disabled:opacity-60"
          >
            {saving ? "Ukládám…" : "Uložit do mého Kabinetu"}
          </button>
        ) : (
          <Link
            href="/prihlaseni"
            onClick={() => rememberReturn(`/sdileny/${shareId}`)}
            className="bg-assistant rounded-xl px-5 py-2.5 font-medium text-on-primary"
          >
            Přihlásit se a uložit
          </Link>
        )}
      </div>
      <Sheet result={shared.data} meta={shared.meta} onBack={() => router.push("/")} backLabel="Vytvořit vlastní test" />
    </div>
  );
}
