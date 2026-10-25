"use client";

import { openFeedback } from "@/components/Feedback";

/** Shown instead of a page that crashed, with a way back and a one-click report. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center gap-5 px-6">
      <h1 className="font-display text-display-sm font-bold text-on-surface">Tohle se nepovedlo</h1>
      <p className="text-body-lg text-on-surface-variant">
        Stránka narazila na chybu. Vaše uložené testy jsou v pořádku v Kabinetu. Zkuste to prosím znovu, a pokud se
        chyba opakuje, dejte nám vědět.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="bg-assistant rounded-xl px-6 py-3 font-medium text-on-primary">
          Zkusit znovu
        </button>
        <button
          type="button"
          onClick={() =>
            openFeedback({
              kind: "bug",
              message: `Chyba na stránce ${window.location.pathname}: ${error.message}${error.digest ? ` (${error.digest})` : ""}\n\nCo jsem dělal(a): `,
            })
          }
          className="rounded-xl bg-surface-container-low px-6 py-3 font-medium text-primary-container hover:bg-surface-container"
        >
          Nahlásit chybu
        </button>
      </div>
    </main>
  );
}
