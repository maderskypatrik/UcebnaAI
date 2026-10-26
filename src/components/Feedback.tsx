"use client";

import { useEffect, useState } from "react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

const CONTACT = "pmadersky@gmail.com";
const KINDS = [
  { id: "bug", label: "Něco nefunguje" },
  { id: "idea", label: "Nápad" },
  { id: "praise", label: "Pochvala" },
] as const;
type Kind = (typeof KINDS)[number]["id"];

/** Opens the feedback form from anywhere, e.g. the error page, with a message filled in. */
export function openFeedback(detail: { kind?: Kind; message?: string } = {}) {
  window.dispatchEvent(new CustomEvent("ucebna:feedback", { detail }));
}

/** A button in the corner on every page, so beta testers can report a problem or an idea in a few seconds. */
export function Feedback() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("bug");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ kind?: Kind; message?: string }>).detail ?? {};
      if (detail.kind) setKind(detail.kind);
      if (detail.message) setMessage(detail.message);
      setState("idle");
      setOpen(true);
    };
    window.addEventListener("ucebna:feedback", onOpen);
    return () => window.removeEventListener("ucebna:feedback", onOpen);
  }, []);

  const mailto = `mailto:${CONTACT}?subject=${encodeURIComponent("Učebna.ai – zpětná vazba")}&body=${encodeURIComponent(message)}`;

  async function send() {
    if (!supabaseConfigured) {
      window.location.href = mailto;
      return;
    }
    setState("sending");
    const { error } = await getSupabase()
      .from("beta_feedback")
      .insert({
        kind,
        message: message.trim().slice(0, 4000),
        page: window.location.pathname,
        user_agent: navigator.userAgent.slice(0, 300),
      });
    setState(error ? "error" : "sent");
    if (!error) {
      setMessage("");
      setTimeout(() => setOpen(false), 2500);
    }
  }

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 print:hidden">
      {open && (
        <div
          role="dialog"
          aria-label="Zpětná vazba"
          className="flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 rounded-xl bg-surface-container-lowest p-5 shadow-ambient ring-1 ring-outline-variant/40"
        >
          {state === "sent" ? (
            <>
              <p className="font-medium text-on-surface">Děkujeme, máme to.</p>
              <p className="text-sm text-on-surface-variant">Každá zpráva nám pomáhá udělat Učebnu lepší.</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="self-end rounded-lg px-3 py-1.5 text-sm font-medium text-primary-container hover:bg-surface-container-low"
              >
                Zavřít
              </button>
            </>
          ) : (
            <>
              <p className="font-medium text-on-surface">Jak se vám s Učebnou pracuje?</p>
              <div className="flex flex-wrap gap-1.5">
                {KINDS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    aria-pressed={kind === k.id}
                    onClick={() => setKind(k.id)}
                    className={`rounded-full px-3 py-1 text-sm ${
                      kind === k.id
                        ? "bg-primary-container text-on-primary"
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={4000}
                rows={4}
                placeholder={
                  kind === "bug" ? "Co jste dělali a co se stalo?" : kind === "idea" ? "Co by vám ušetřilo čas?" : "Co se vám líbí?"
                }
                className="rounded-lg bg-surface-container-high px-3 py-2 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/70"
              />
              {state === "error" && (
                <p className="text-sm text-on-error-container">
                  Zprávu se nepodařilo odeslat. Napište nám prosím na{" "}
                  <a href={mailto} className="underline">
                    {CONTACT}
                  </a>
                  .
                </p>
              )}
              <div className="flex items-center justify-between gap-2">
                <a href={mailto} className="text-label-md text-on-surface-variant hover:underline">
                  nebo e-mailem
                </a>
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-low"
                  >
                    Zrušit
                  </button>
                  <button
                    type="button"
                    disabled={!message.trim() || state === "sending"}
                    onClick={send}
                    className="bg-assistant rounded-lg px-4 py-1.5 text-sm font-medium text-on-primary disabled:opacity-50"
                  >
                    {state === "sending" ? "Odesílám…" : "Odeslat"}
                  </button>
                </span>
              </div>
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setState("idle");
          setOpen(!open);
        }}
        className="rounded-full bg-surface-container-lowest px-4 py-2.5 text-sm font-medium text-primary-container shadow-ambient ring-1 ring-outline-variant/40 hover:bg-surface-container-low"
      >
        💬 Zpětná vazba
      </button>
    </div>
  );
}
