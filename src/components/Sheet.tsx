"use client";

import { useState } from "react";
import { TASK_KIND_LABELS, type GenerateResult } from "@/lib/schemas";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Matching explanations are rotated by one so none stays next to its own term,
// so term i's explanation sits at letter i - 1.
function matchingKey(n: number): string {
  return Array.from({ length: n }, (_, i) => `${i + 1} – ${LETTERS[(i - 1 + n) % n]}`).join(", ");
}

/** Student view of a matching task: terms on the left, explanations shuffled on the right. */
function Matching({ items }: { items: string[] }) {
  const pairs = items.map((item) => {
    const [term, ...rest] = item.split(/\s[–-]\s/);
    return { term, definition: rest.join(" – ") };
  });
  const shuffled = pairs.map((_, i) => pairs[(i + 1) % pairs.length].definition);
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-2 pl-5 text-body-lg text-on-surface">
      <ol className="flex flex-col gap-2">
        {pairs.map((p, i) => (
          <li key={i}>
            {i + 1}. {p.term} ___
          </li>
        ))}
      </ol>
      <ul className="flex flex-col gap-2">
        {shuffled.map((d, i) => (
          <li key={i}>
            {LETTERS[i]}) {d}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A field that looks like printed text but can be edited in place. */
function Editable({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.textContent ?? "")}
      className={`rounded-sm outline-none focus:bg-surface-container-low print:bg-transparent ${className}`}
    >
      {value}
    </span>
  );
}

export function Sheet({
  result,
  meta,
  onBack,
}: {
  result: GenerateResult;
  meta: string;
  onBack: () => void;
}) {
  const [doc, setDoc] = useState(result);
  const [showKey, setShowKey] = useState(false);

  const setField = (field: "title" | "instructions", value: string) =>
    setDoc((d) => ({ ...d, data: { ...d.data, [field]: value } }) as GenerateResult);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl px-5 py-3 font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low"
        >
          Zpět k nastavení
        </button>
        <div className="flex rounded-xl bg-surface-container-low p-1">
          {[false, true].map((key) => (
            <button
              key={String(key)}
              type="button"
              onClick={() => setShowKey(key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                showKey === key ? "bg-surface-container-lowest text-on-surface shadow-ambient" : "text-on-surface-variant"
              }`}
            >
              {key ? "Klíč pro učitele" : "Verze pro žáky"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="bg-assistant rounded-xl px-6 py-3 font-medium text-on-primary"
        >
          Vytisknout / uložit PDF
        </button>
      </div>
      <p className="text-label-md text-on-surface-variant print:hidden">
        Text na listu můžete upravit kliknutím přímo do něj.
      </p>

      {/* A4 Digital Sheet */}
      <article className="mx-auto w-full max-w-[210mm] bg-surface-container-lowest px-8 py-12 shadow-ambient sm:px-14 print:max-w-none print:p-0 print:shadow-none">
        <div className="mb-6 flex flex-wrap justify-between gap-4 text-label-md text-on-surface-variant">
          <span>{meta}</span>
          <span>Jméno: ______________________ Datum: __________</span>
        </div>
        <h2 className="mb-2 font-display text-title-lg font-bold text-on-surface">
          <Editable value={doc.data.title} onChange={(v) => setField("title", v)} />
          {showKey && <span className="ml-2 text-primary-container">· klíč</span>}
        </h2>
        <p className="mb-10 text-body-lg text-on-surface-variant">
          <Editable value={doc.data.instructions} onChange={(v) => setField("instructions", v)} />
        </p>

        <ol className="flex flex-col gap-8">
          {doc.kind === "test"
            ? doc.data.questions.map((q, i) => (
                <li key={i} className="break-inside-avoid">
                  <p className="mb-3 font-medium text-on-surface">
                    {i + 1}.{" "}
                    <Editable
                      value={q.question}
                      onChange={(v) =>
                        setDoc((d) => {
                          if (d.kind !== "test") return d;
                          const questions = d.data.questions.map((x, j) => (j === i ? { ...x, question: v } : x));
                          return { ...d, data: { ...d.data, questions } };
                        })
                      }
                    />
                  </p>
                  <ul className="flex flex-col gap-2 pl-5">
                    {q.options.map((o, k) => (
                      <li
                        key={k}
                        className={`text-body-lg ${
                          showKey && k === q.correctIndex ? "font-semibold text-primary-container" : "text-on-surface"
                        }`}
                      >
                        {LETTERS[k]}){" "}
                        <Editable
                          value={o}
                          onChange={(v) =>
                            setDoc((d) => {
                              if (d.kind !== "test") return d;
                              const questions = d.data.questions.map((x, j) =>
                                j === i ? { ...x, options: x.options.map((y, m) => (m === k ? v : y)) } : x,
                              );
                              return { ...d, data: { ...d.data, questions } };
                            })
                          }
                        />
                      </li>
                    ))}
                  </ul>
                  {showKey && (
                    <p className="mt-2 pl-5 text-sm text-on-surface-variant">{q.explanation}</p>
                  )}
                </li>
              ))
            : doc.data.tasks.map((t, i) => (
                <li key={i} className="break-inside-avoid">
                  <p className="mb-1 text-label-md uppercase tracking-wider text-on-surface-variant">
                    {TASK_KIND_LABELS[t.kind]}
                  </p>
                  <p className="mb-3 font-medium text-on-surface">
                    {i + 1}.{" "}
                    <Editable
                      value={t.prompt}
                      onChange={(v) =>
                        setDoc((d) => {
                          if (d.kind !== "worksheet") return d;
                          const tasks = d.data.tasks.map((x, j) => (j === i ? { ...x, prompt: v } : x));
                          return { ...d, data: { ...d.data, tasks } };
                        })
                      }
                    />
                  </p>
                  {t.kind === "matching" && !showKey ? (
                    <Matching items={t.items} />
                  ) : t.items.length > 0 && (
                    <ul className="flex flex-col gap-2 pl-5 text-body-lg text-on-surface">
                      {t.items.map((item, k) => (
                        <li key={k}>
                          {t.kind === "true_false" ? "☐ P  ☐ N  " : "• "}
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                  {showKey ? (
                    <p className="mt-2 pl-5 text-sm font-semibold text-primary-container">
                      {t.kind === "matching" ? matchingKey(t.items.length) : t.answer}
                    </p>
                  ) : (
                    (t.kind === "short_answer" || t.kind === "open") && (
                      <div className="mt-3 flex flex-col gap-6 pl-5">
                        {Array.from({ length: t.kind === "open" ? 4 : 2 }, (_, k) => (
                          <div key={k} className="h-px bg-outline-variant/60" />
                        ))}
                      </div>
                    )
                  )}
                </li>
              ))}
        </ol>
      </article>
    </div>
  );
}
