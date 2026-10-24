"use client";

import { useState } from "react";
import type { Exported } from "@/lib/exports";
import type { Sheet } from "@/lib/schemas";

type Target = "word" | "moodle" | "kahoot" | "quizlet" | "forms";

const TARGETS: { id: Target; label: string; hint: string }[] = [
  { id: "word", label: "Word", hint: "k úpravám a tisku" },
  { id: "forms", label: "Google Formuláře", hint: "online test s opravou" },
  { id: "moodle", label: "Moodle", hint: "banka úloh, formát GIFT" },
  { id: "kahoot", label: "Kahoot", hint: "jen otázky s výběrem" },
  { id: "quizlet", label: "Quizlet", hint: "kartičky k procvičování" },
];

const STEPS: Record<Exclude<Target, "word">, string[]> = {
  forms: [
    "Otevřete script.google.com a klikněte na Nový projekt.",
    "Smažte, co tam je, a vložte skript (tlačítko Kopírovat skript níže nebo obsah staženého souboru).",
    "Klikněte na Spustit (▶) a povolte přístup ke Google Formulářům.",
    "Dole v Protokolu provádění najdete odkaz pro žáky a odkaz na úpravy. Formulář je i ve vašem Disku.",
  ],
  moodle: [
    "V kurzu otevřete Banka úloh → Import.",
    "Zvolte formát GIFT, nahrajte stažený soubor a potvrďte Import.",
    "Úlohy se objeví v kategorii s názvem testu, odkud je přidáte do testu v Moodlu.",
  ],
  kahoot: [
    "V Kahootu klikněte na Create → Kahoot a vpravo na Add question → Import spreadsheet.",
    "Nahrajte stažený soubor .xlsx a zkontrolujte náhled otázek.",
  ],
  quizlet: [
    "V Quizletu vytvořte novou sadu a klikněte na Import.",
    "Vložte obsah staženého souboru. Oddělovač je tabulátor, řádky jsou nový řádek.",
  ],
};

function save(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "Stáhnout" with a choice of where the test goes next, and how to get it in there. */
export function ExportMenu({ sheet, showKey, showPoints }: { sheet: Sheet; showKey: boolean; showPoints: boolean }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<{ target: Exclude<Target, "word">; result: Exported; script?: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  async function run(target: Target) {
    setOpen(false);
    setDone(null);
    if (target === "word") {
      // Loaded on demand so the Word library doesn't slow down the first page load.
      const { downloadDocx } = await import("@/lib/docx");
      return downloadDocx(sheet, { showKey, showPoints });
    }
    const exports = await import("@/lib/exports");
    const result =
      target === "moodle"
        ? exports.toMoodle(sheet)
        : target === "kahoot"
          ? await exports.toKahoot(sheet)
          : target === "quizlet"
            ? exports.toQuizlet(sheet)
            : exports.toGoogleForms(sheet);
    if (result.count > 0) save(result.blob, result.fileName);
    setDone({ target, result, script: target === "forms" ? await result.blob.text() : undefined });
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="rounded-xl bg-surface-container-low px-5 py-3 font-medium text-primary-container transition-colors hover:bg-surface-container"
        >
          Stáhnout ▾
        </button>
        {open && <button type="button" aria-label="Zavřít" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />}
        {open && (
          <ul className="absolute left-0 z-20 mt-2 w-64 rounded-xl bg-surface-container-lowest p-1.5 shadow-ambient ghost-border">
            {TARGETS.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => run(t.id)}
                  className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-surface-container-low"
                >
                  <span className="font-medium text-on-surface">{t.label}</span>
                  <span className="text-label-md text-on-surface-variant">{t.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {done && (
        <div className="flex w-full flex-col gap-2 rounded-xl bg-secondary-container/60 px-5 py-4 text-sm text-on-surface">
          <div className="flex items-start justify-between gap-4">
            <p className="font-medium">
              {done.result.count === 0
                ? `Pro ${TARGETS.find((t) => t.id === done.target)?.label} tu není žádná vhodná otázka.`
                : `Staženo ${done.result.count} ${done.result.count === 1 ? "otázka" : done.result.count < 5 ? "otázky" : "otázek"}.`}
              {done.result.skipped > 0 &&
                ` ${done.result.skipped} ${done.target === "kahoot" ? "otázek bez výběru možností" : "položek"} se do tohoto formátu nevejde.`}
            </p>
            <button
              type="button"
              onClick={() => setDone(null)}
              aria-label="Zavřít"
              className="text-on-surface-variant hover:text-on-surface"
            >
              ✕
            </button>
          </div>
          {done.result.count > 0 && (
            <ol className="list-decimal space-y-1 pl-5 text-on-surface-variant">
              {STEPS[done.target].map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
          {done.script && (
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(done.script!).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="bg-assistant self-start rounded-lg px-4 py-1.5 font-medium text-on-primary"
            >
              {copied ? "Zkopírováno" : "Kopírovat skript"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
