"use client";

import { useState } from "react";
import {
  GRADE_SCALE,
  sectionPoints,
  totalPoints,
  type Item,
  type Section,
  type Sheet as SheetData,
} from "@/lib/schemas";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const formatPoints = (n: number) => `${String(n).replace(".", ",")} b`;

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

/** Answer written in the key, or an empty line in the student version. */
function Blank({ answer, showKey }: { answer: string; showKey: boolean }) {
  return showKey ? (
    <span className="font-semibold text-primary-container">{answer}</span>
  ) : (
    <span className="inline-block min-w-32 flex-1 border-b border-dotted border-on-surface-variant/60" />
  );
}

function WritingLines({ count }: { count: number }) {
  return (
    <div className="mt-3 flex flex-col gap-7 pl-6">
      {Array.from({ length: count }, (_, k) => (
        <div key={k} className="h-px bg-outline-variant/70" />
      ))}
    </div>
  );
}

type ItemProps = {
  section: Section;
  start: number;
  showKey: boolean;
  onItem: (index: number, patch: Partial<Item>) => void;
};

function Prompt({ item, index, onItem }: { item: Item; index: number; onItem: ItemProps["onItem"] }) {
  return <Editable value={item.prompt} onChange={(prompt) => onItem(index, { prompt })} />;
}

/** Vocabulary in two columns, like a handmade test: "1. word ........". */
function Translation({ section, start, showKey, onItem }: ItemProps) {
  return (
    <ol className="gap-x-10 sm:columns-2 print:columns-2">
      {section.items.map((item, i) => (
        <li key={i} className="mb-4 flex items-end gap-2 break-inside-avoid text-body-lg text-on-surface">
          <span className="w-7 shrink-0 text-on-surface-variant">{start + i}.</span>
          <span className="shrink-0">
            <Prompt item={item} index={i} onItem={onItem} />
          </span>
          <Blank answer={item.answer} showKey={showKey} />
        </li>
      ))}
    </ol>
  );
}

function MultipleChoice({ section, start, showKey, onItem }: ItemProps) {
  return (
    <ol className="flex flex-col gap-6">
      {section.items.map((item, i) => {
        const correct = item.answer.trim().toUpperCase().charAt(0);
        return (
          <li key={i} className="break-inside-avoid">
            <p className="mb-2 font-medium text-on-surface">
              {start + i}. <Prompt item={item} index={i} onItem={onItem} />
            </p>
            <ul className="grid grid-cols-1 gap-x-8 gap-y-1.5 pl-6 sm:grid-cols-2 print:grid-cols-2">
              {item.options.map((option, k) => (
                <li
                  key={k}
                  className={`text-body-lg ${
                    showKey && LETTERS[k] === correct ? "font-semibold text-primary-container" : "text-on-surface"
                  }`}
                >
                  {LETTERS[k]}){" "}
                  <Editable
                    value={option}
                    onChange={(v) => onItem(i, { options: item.options.map((o, m) => (m === k ? v : o)) })}
                  />
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

function TrueFalse({ section, start, showKey, onItem }: ItemProps) {
  return (
    <ol className="flex flex-col gap-3">
      {section.items.map((item, i) => {
        const answer = item.answer.trim().toUpperCase().charAt(0);
        return (
          <li key={i} className="flex items-start gap-4 break-inside-avoid text-body-lg text-on-surface">
            <span className="w-7 shrink-0 text-on-surface-variant">{start + i}.</span>
            <span className="flex-1">
              <Prompt item={item} index={i} onItem={onItem} />
            </span>
            <span className="flex shrink-0 gap-2">
              {["P", "N"].map((v) => (
                <span
                  key={v}
                  className={`flex size-7 items-center justify-center rounded-full text-sm font-semibold ${
                    showKey && answer === v
                      ? "bg-primary-container text-on-primary"
                      : "bg-surface-container-low text-on-surface-variant print:outline print:outline-1 print:outline-outline-variant"
                  }`}
                >
                  {v}
                </span>
              ))}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function FillBlank({ section, start, showKey, onItem }: ItemProps) {
  const [withBank, setWithBank] = useState(true);
  const bank = section.items.map((item) => item.answer).sort((a, b) => a.localeCompare(b, "cs"));
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-label-md text-on-surface-variant print:hidden">
        <input type="checkbox" checked={withBank} onChange={(e) => setWithBank(e.target.checked)} />
        Nabídka slov k doplnění
      </label>
      {withBank && (
        <p className="rounded-xl bg-surface-container-low px-5 py-3 text-body-lg text-on-surface print:bg-transparent print:outline print:outline-1 print:outline-outline-variant">
          {bank.join(" · ")}
        </p>
      )}
      <ol className="flex flex-col gap-4">
        {section.items.map((item, i) => (
          <li key={i} className="flex gap-2 break-inside-avoid text-body-lg text-on-surface">
            <span className="w-7 shrink-0 text-on-surface-variant">{start + i}.</span>
            <span className="flex-1">
              <Prompt item={item} index={i} onItem={onItem} />
              {showKey && <span className="ml-3 font-semibold text-primary-container">→ {item.answer}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Terms on the left, counterparts shifted by one on the right, so no counterpart
 * sits next to its own term. Term i's counterpart is at letter i - 1.
 */
function Matching({ section, start, showKey, onItem }: ItemProps) {
  const n = section.items.length;
  const shifted = section.items.map((_, i) => section.items[(i + 1) % n].answer);
  return (
    <div className="grid grid-cols-2 gap-x-10 text-body-lg text-on-surface">
      <ol className="flex flex-col gap-3">
        {section.items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-7 shrink-0 text-on-surface-variant">{start + i}.</span>
            <span className="flex-1">
              <Prompt item={item} index={i} onItem={onItem} />
            </span>
            {showKey ? (
              <span className="font-semibold text-primary-container">{LETTERS[(i - 1 + n) % n]}</span>
            ) : (
              <span className="w-8 border-b border-dotted border-on-surface-variant/60" />
            )}
          </li>
        ))}
      </ol>
      <ul className="flex flex-col gap-3">
        {shifted.map((text, i) => (
          <li key={i}>
            <span className="text-on-surface-variant">{LETTERS[i]})</span> {text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Written({ section, start, showKey, onItem, lines }: ItemProps & { lines: number }) {
  return (
    <ol className="flex flex-col gap-7">
      {section.items.map((item, i) => (
        <li key={i} className="break-inside-avoid">
          <p className="font-medium text-on-surface">
            {start + i}. <Prompt item={item} index={i} onItem={onItem} />
          </p>
          {showKey ? (
            <p className="mt-2 whitespace-pre-line pl-6 text-body-lg text-primary-container">{item.answer}</p>
          ) : (
            <WritingLines count={lines} />
          )}
        </li>
      ))}
    </ol>
  );
}

function SectionItems(props: ItemProps) {
  switch (props.section.type) {
    case "translate_to_czech":
    case "translate_from_czech":
      return <Translation {...props} />;
    case "multiple_choice":
      return <MultipleChoice {...props} />;
    case "true_false":
      return <TrueFalse {...props} />;
    case "fill_blank":
      return <FillBlank {...props} />;
    case "matching":
      return <Matching {...props} />;
    case "short_answer":
      return <Written {...props} lines={2} />;
    case "open":
      return <Written {...props} lines={6} />;
  }
}

function GradeScale({ total }: { total: number }) {
  return (
    <p className="text-label-md text-on-surface-variant">
      Hodnocení:{" "}
      {GRADE_SCALE.map(({ grade, min }) => `${grade} od ${formatPoints(Math.ceil(min * total * 2) / 2)}`).join(
        " · ",
      )}
    </p>
  );
}

export function Sheet({
  result,
  meta,
  onBack,
}: {
  result: SheetData;
  meta: string;
  onBack: () => void;
}) {
  const [doc, setDoc] = useState(result);
  const [showKey, setShowKey] = useState(false);
  const isTest = doc.kind === "test";
  const [showPoints, setShowPoints] = useState(isTest);
  const [showScale, setShowScale] = useState(isTest);
  const total = totalPoints(doc);

  const updateSection = (si: number, patch: Partial<Section>) =>
    setDoc((d) => ({ ...d, sections: d.sections.map((s, j) => (j === si ? { ...s, ...patch } : s)) }));
  const updateItem = (si: number, ii: number, patch: Partial<Item>) =>
    setDoc((d) => ({
      ...d,
      sections: d.sections.map((s, j) =>
        j === si ? { ...s, items: s.items.map((it, k) => (k === ii ? { ...it, ...patch } : it)) } : s,
      ),
    }));

  // Numbering continues across sections, as on a printed test.
  const starts = doc.sections.reduce<number[]>(
    (acc, s, i) => [...acc, i === 0 ? 1 : acc[i - 1] + doc.sections[i - 1].items.length],
    [],
  );

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
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-label-md text-on-surface-variant print:hidden">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showPoints} onChange={(e) => setShowPoints(e.target.checked)} />
          Body u částí
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showScale} onChange={(e) => setShowScale(e.target.checked)} />
          Známkovací stupnice
        </label>
        <span>Text na listu můžete upravit kliknutím přímo do něj.</span>
      </div>

      {/* A4 Digital Sheet */}
      <article className="mx-auto w-full max-w-[210mm] bg-surface-container-lowest px-8 py-12 shadow-ambient sm:px-14 print:max-w-none print:p-0 print:shadow-none">
        <div className="mb-8 flex flex-wrap justify-between gap-4 text-label-md text-on-surface-variant">
          <span>{meta}</span>
          <span>Jméno: ______________________ Třída: ______ Datum: __________</span>
        </div>
        <h2 className="mb-2 font-display text-title-lg font-bold text-on-surface">
          <Editable value={doc.title} onChange={(title) => setDoc((d) => ({ ...d, title }))} />
          {showKey && <span className="ml-2 text-primary-container">· klíč</span>}
        </h2>
        <p className="mb-10 text-body-lg text-on-surface-variant">
          <Editable value={doc.instructions} onChange={(instructions) => setDoc((d) => ({ ...d, instructions }))} />
        </p>

        <div className="flex flex-col gap-12">
          {doc.sections.map((section, si) => (
            <section key={si}>
              <div className="mb-1 flex items-baseline gap-3">
                <span className="font-display text-title-md font-bold text-primary-container">{LETTERS[si]}</span>
                <h3 className="flex-1 font-display text-title-md font-bold text-on-surface">
                  <Editable value={section.title} onChange={(title) => updateSection(si, { title })} />
                </h3>
                {showPoints && (
                  <span className="shrink-0 text-label-md text-on-surface-variant">
                    ___ / {formatPoints(sectionPoints(section))}
                  </span>
                )}
              </div>
              <p className="mb-5 pl-7 text-sm text-on-surface-variant">
                <Editable value={section.instructions} onChange={(instructions) => updateSection(si, { instructions })} />
              </p>
              <SectionItems
                section={section}
                start={starts[si]}
                showKey={showKey}
                onItem={(ii, patch) => updateItem(si, ii, patch)}
              />
            </section>
          ))}
        </div>

        {(showPoints || showScale) && (
          <div className="mt-14 flex flex-col items-end gap-2 break-inside-avoid">
            {showPoints && (
              <p className="font-display text-title-md font-bold text-on-surface">
                Body: ______ / {formatPoints(total)}
              </p>
            )}
            {showScale && <GradeScale total={total} />}
            {showScale && <p className="text-label-md text-on-surface-variant">Známka: ______</p>}
          </div>
        )}
      </article>
    </div>
  );
}
