"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";

const shareUrl = (shareId: string) => `${window.location.origin}/sdileny/${shareId}`;

/** Creates or removes a link through which colleagues can view a test and copy it into their Kabinet. */
export function ShareButton({ id }: { id: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setError(null);
    setOpen(true);
    const supabase = getSupabase();
    const { data, error } = await supabase.from("sheets").select("share_id").eq("id", id).single();
    if (error) return setError(`Odkaz se nepodařilo vytvořit: ${error.message}`);
    let shareId: string | null = data.share_id;
    if (!shareId) {
      shareId = crypto.randomUUID();
      const { error } = await supabase.from("sheets").update({ share_id: shareId }).eq("id", id);
      if (error) return setError(`Odkaz se nepodařilo vytvořit: ${error.message}`);
    }
    setLink(shareUrl(shareId));
  }

  async function unshare() {
    const { error } = await getSupabase().from("sheets").update({ share_id: null }).eq("id", id);
    if (error) return setError(`Sdílení se nepodařilo zrušit: ${error.message}`);
    setLink(null);
    setOpen(false);
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={open ? () => setOpen(false) : share}
        className="rounded-xl bg-surface-container-low px-5 py-3 font-medium text-primary-container transition-colors hover:bg-surface-container"
      >
        Sdílet
      </button>
      {open && (
        <div className="flex w-full flex-col gap-3 rounded-xl bg-secondary-container/60 px-5 py-4">
          {error ? (
            <p className="text-on-error-container">{error}</p>
          ) : !link ? (
            <p className="text-on-surface-variant">Vytvářím odkaz…</p>
          ) : (
            <>
              <p className="text-sm text-on-surface">
                Kolega si přes tento odkaz test prohlédne a může si ho uložit do svého Kabinetu. Odkaz ukazuje i klíč,
                proto ho posílejte jen učitelům.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.target.select()}
                  className="min-w-0 flex-1 rounded-lg bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
                />
                <button
                  type="button"
                  onClick={copy}
                  className="bg-assistant rounded-lg px-4 py-2 text-sm font-medium text-on-primary"
                >
                  {copied ? "Zkopírováno" : "Kopírovat"}
                </button>
                <button
                  type="button"
                  onClick={unshare}
                  className="rounded-lg px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low"
                >
                  Zrušit sdílení
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
