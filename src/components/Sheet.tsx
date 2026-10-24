"use client";

import { createContext, use, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import {
  LETTERS,
  STUDENT_LINE,
  formatPoints,
  matchingCounterparts,
  matchingKeyLetter,
  sectionPoints,
  sectionStarts,
  totalPoints,
  variantB,
  wordBank,
  type Item,
  type Section,
  type Sheet as SheetData,
} from "@/lib/schemas";

/** True while variant B is shown: it is derived from A, so it is read only. */
const ReadOnly = createContext(false);

/** A field that looks like printed text but can be edited in place. */
function Editable(props: { value: string; onChange: (value: string) => void; className?: string }) {
  if (use(ReadOnly)) return <span className={props.className}>{props.value}</span>;
  // Remount when the value changes from outside (a replaced or removed question),
  // so the browser's edited text never lingers over the new value.
  return <EditableText key={props.value} {...props} />;
}

function EditableText({
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
function Blank({ answer, showKey, onAnswer }: { answer: string; showKey: boolean; onAnswer: (v: string) => void }) {
  return showKey ? (
    <Editable value={answer} onChange={onAnswer} className="font-semibold text-primary-container" />
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
  onSection: (patch: Partial<Section>) => void;
  /** Edit mode: answers can be picked and each item shows its tools. */
  editing: boolean;
  tools: (index: number) => React.ReactNode;
};

function Prompt({ item, index, onItem }: { item: Item; index: number; onItem: ItemProps["onItem"] }) {
  return <Editable value={item.prompt} onChange={(prompt) => onItem(index, { prompt })} />;
}

/** Vocabulary in two columns, like a handmade test: "1. word ........". */
function Translation({ section, start, showKey, onItem, tools }: ItemProps) {
  return (
    <ol className="gap-x-10 sm:columns-2 print:columns-2">
      {section.items.map((item, i) => (
        <li key={i} className="mb-4 flex items-end gap-2 break-inside-avoid text-body-lg text-on-surface">
          <span className="w-7 shrink-0 text-on-surface-variant">{start + i}.</span>
          <span className="shrink-0">
            <Prompt item={item} index={i} onItem={onItem} />
          </span>
          <Blank answer={item.answer} showKey={showKey} onAnswer={(answer) => onItem(i, { answer })} />
          {tools(i)}
        </li>
      ))}
    </ol>
  );
}

function MultipleChoice({ section, start, showKey, onItem, editing, tools }: ItemProps) {
  return (
    <ol className="flex flex-col gap-6">
      {section.items.map((item, i) => {
        const correct = item.answer.trim().toUpperCase().charAt(0);
        return (
          <li key={i} className="break-inside-avoid">
            <p className="mb-2 flex gap-2 font-medium text-on-surface">
              <span className="flex-1">
                {start + i}. <Prompt item={item} index={i} onItem={onItem} />
              </span>
              {tools(i)}
            </p>
            <ul className="grid grid-cols-1 gap-x-8 gap-y-1.5 pl-6 sm:grid-cols-2 print:grid-cols-2">
              {item.options.map((option, k) => (
                <li
                  key={k}
                  className={`text-body-lg ${
                    (showKey || editing) && LETTERS[k] === correct ? "font-semibold text-primary-container" : "text-on-surface"
                  }`}
                >
                  {editing ? (
                    <button
                      type="button"
                      title="Označit jako správnou odpověď"
                      onClick={() => onItem(i, { answer: LETTERS[k] })}
                      className="rounded-md px-1 hover:bg-secondary-container"
                    >
                      {LETTERS[k]})
                    </button>
                  ) : (
                    `${LETTERS[k]})`
                  )}{" "}
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

function TrueFalse({ section, start, showKey, onItem, editing, tools }: ItemProps) {
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
                <button
                  type="button"
                  key={v}
                  disabled={!editing}
                  title={editing ? "Označit jako správnou odpověď" : undefined}
                  onClick={() => onItem(i, { answer: v })}
                  className={`flex size-7 items-center justify-center rounded-full text-sm font-semibold ${
                    (showKey || editing) && answer === v
                      ? "bg-primary-container text-on-primary"
                      : "bg-surface-container-low text-on-surface-variant print:outline print:outline-1 print:outline-outline-variant"
                  }`}
                >
                  {v}
                </button>
              ))}
            </span>
            {tools(i)}
          </li>
        );
      })}
    </ol>
  );
}

function FillBlank({ section, start, showKey, onItem, onSection, tools }: ItemProps) {
  const bank = wordBank(section.items);
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-label-md text-on-surface-variant print:hidden">
        <input
          type="checkbox"
          checked={!section.hideBank}
          onChange={(e) => onSection({ hideBank: !e.target.checked })}
        />
        Nabídka slov k doplnění
      </label>
      {!section.hideBank && (
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
              {showKey && (
                <span className="ml-3 font-semibold text-primary-container">
                  → <Editable value={item.answer} onChange={(answer) => onItem(i, { answer })} />
                </span>
              )}
            </span>
            {tools(i)}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Terms on the left, shuffled counterparts on the right. */
function Matching({ section, start, showKey, onItem, tools }: ItemProps) {
  const n = section.items.length;
  const shifted = matchingCounterparts(section.items);
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
              <span className="font-semibold text-primary-container">{matchingKeyLetter(i, n)}</span>
            ) : (
              <span className="w-8 border-b border-dotted border-on-surface-variant/60" />
            )}
            {tools(i)}
          </li>
        ))}
      </ol>
      <ul className="flex flex-col gap-3">
        {shifted.map((text, i) => (
          <li key={i}>
            <span className="text-on-surface-variant">{LETTERS[i]})</span>{" "}
            <Editable value={text} onChange={(answer) => onItem((i + 1) % n, { answer })} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Written({ section, start, showKey, onItem, tools, lines }: ItemProps & { lines: number }) {
  return (
    <ol className="flex flex-col gap-7">
      {section.items.map((item, i) => (
        <li key={i} className="break-inside-avoid">
          <p className="flex gap-2 font-medium text-on-surface">
            <span className="flex-1">
              {start + i}. <Prompt item={item} index={i} onItem={onItem} />
            </span>
            {tools(i)}
          </p>
          {showKey ? (
            <p className="mt-2 whitespace-pre-line pl-6 text-body-lg text-primary-container">
              <Editable value={item.answer} onChange={(answer) => onItem(i, { answer })} />
            </p>
          ) : (
            <WritingLines count={lines} />
          )}
        </li>
      ))}
    </ol>
  );
}

/** A blank question of the section's type for the teacher to fill in. */
function blankItem(type: Section["type"]): Item {
  if (type === "multiple_choice") return { prompt: "Nová otázka", options: ["…", "…", "…", "…"], answer: "A" };
  if (type === "true_false") return { prompt: "Nové tvrzení", options: [], answer: "P" };
  return { prompt: "Nová položka", options: [], answer: "odpověď" };
}

function ItemTools({
  busy,
  onReplace,
  onRemove,
}: {
  busy: boolean;
  onReplace?: () => void;
  onRemove: () => void;
}) {
  const button =
    "rounded-lg px-2 py-1 text-label-md font-medium transition-colors disabled:opacity-50 print:hidden";
  return (
    <span className="flex shrink-0 items-center gap-1 self-start print:hidden">
      {onReplace && (
        <button
          type="button"
          disabled={busy}
          onClick={onReplace}
          title="Nahradit novou otázkou od AI"
          className={`${button} bg-secondary-container/70 text-primary-container hover:bg-secondary-container`}
        >
          {busy ? "Píšu…" : "↻ Vyměnit"}
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={onRemove}
        title="Smazat otázku"
        className={`${button} text-on-surface-variant hover:bg-error-container hover:text-on-error-container`}
      >
        ✕
      </button>
    </span>
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

type SaveState = "saved" | "saving" | "error";

/** Saves edits to the Kabinet a moment after the teacher stops typing. */
function useAutosave(id: string | null | undefined, doc: SheetData): SaveState {
  const [savedDoc, setSavedDoc] = useState(doc);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!id || doc === savedDoc) return;
    const timer = setTimeout(async () => {
      const { error } = await getSupabase()
        .from("sheets")
        .update({ title: doc.title, meta: doc.header?.meta ?? "", data: doc, updated_at: new Date().toISOString() })
        .eq("id", id);
      setFailed(Boolean(error));
      if (!error) setSavedDoc(doc);
    }, 1200);
    return () => clearTimeout(timer);
  }, [id, doc, savedDoc]);
  return failed ? "error" : doc === savedDoc ? "saved" : "saving";
}

const SAVE_LABELS: Record<SaveState, string> = {
  saved: "Uloženo v Kabinetu",
  saving: "Ukládám…",
  error: "Změny se nepodařilo uložit",
};

export function Sheet({
  result,
  id,
  meta,
  onBack,
  backLabel = "Zpět k nastavení",
  onReplace,
}: {
  result: SheetData;
  /** Kabinet id; when set, edits are saved automatically. */
  id?: string | null;
  meta: string;
  onBack: () => void;
  backLabel?: string;
  /** Asks the AI for one new question in place of the one at `index`. */
  onReplace?: (args: { section: Section; index: number; title: string; meta: string }) => Promise<Item>;
}) {
  const [doc, setDoc] = useState<SheetData>({ ...result, header: result.header ?? { meta, student: STUDENT_LINE } });
  const saveState = useAutosave(id, doc);
  const header = doc.header ?? { meta, student: STUDENT_LINE };
  const [showKey, setShowKey] = useState(false);
  const isTest = doc.kind === "test";
  const [showPoints, setShowPoints] = useState(isTest);
  const total = totalPoints(doc);
  const [editingOn, setEditing] = useState(false);
  const [twoVariants, setTwoVariants] = useState(false);
  const [variant, setVariant] = useState<"A" | "B">("A");
  const isB = twoVariants && variant === "B";
  const editing = editingOn && !isB;
  const shown = useMemo(() => {
    const sheet = isB ? variantB(doc) : doc;
    return twoVariants ? { ...sheet, title: `${sheet.title} – varianta ${variant}` } : sheet;
  }, [doc, isB, twoVariants, variant]);
  const [busy, setBusy] = useState<string | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  const updateSection = (si: number, patch: Partial<Section>) =>
    setDoc((d) => ({ ...d, sections: d.sections.map((s, j) => (j === si ? { ...s, ...patch } : s)) }));
  const updateItem = (si: number, ii: number, patch: Partial<Item>) =>
    setDoc((d) => ({
      ...d,
      sections: d.sections.map((s, j) =>
        j === si ? { ...s, items: s.items.map((it, k) => (k === ii ? { ...it, ...patch } : it)) } : s,
      ),
    }));

  const starts = sectionStarts(shown);

  const setItems = (si: number, change: (items: Item[]) => Item[]) =>
    setDoc((d) => ({ ...d, sections: d.sections.map((s, j) => (j === si ? { ...s, items: change(s.items) } : s)) }));

  async function replace(si: number, ii: number) {
    if (!onReplace) return;
    setBusy(`${si}-${ii}`);
    setReplaceError(null);
    try {
      const item = await onReplace({ section: doc.sections[si], index: ii, title: doc.title, meta: header.meta });
      setItems(si, (items) => items.map((it, k) => (k === ii ? item : it)));
    } catch (e) {
      setReplaceError(e instanceof Error ? e.message : "Novou otázku se nepodařilo vytvořit.");
    } finally {
      setBusy(null);
    }
  }

  // The teacher edits a section's total; points per item follow from it.
  const setSectionTotal = (si: number, text: string) => {
    const value = Number(text.replace(",", ".").replace(/[^\d.]/g, ""));
    const count = doc.sections[si].items.length;
    if (value > 0 && count > 0) updateSection(si, { points: value / count });
    else updateSection(si, {});
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl px-3 py-3 font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low"
        >
          {backLabel}
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
          Tisk / PDF
        </button>
        <button
          type="button"
          onClick={async () => {
            // Loaded on demand so the Word library doesn't slow down the first page load.
            const { downloadDocx } = await import("@/lib/docx");
            await downloadDocx(shown, { showKey, showPoints });
          }}
          className="rounded-xl bg-surface-container-low px-5 py-3 font-medium text-primary-container transition-colors hover:bg-surface-container"
        >
          Stáhnout Word
        </button>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-label-md text-on-surface-variant print:hidden">
        <label className={`flex items-center gap-2 ${isB ? "opacity-50" : ""}`}>
          <input
            type="checkbox"
            checked={editing}
            disabled={isB}
            onChange={(e) => setEditing(e.target.checked)}
          />
          Upravovat otázky
        </label>
        {isTest && (
          <span className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={twoVariants} onChange={(e) => setTwoVariants(e.target.checked)} />
              Dvě varianty
            </label>
            {twoVariants && (
              <span className="flex rounded-lg bg-surface-container-low p-0.5">
                {(["A", "B"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVariant(v)}
                    className={`rounded-md px-2.5 py-0.5 font-medium ${
                      variant === v ? "bg-surface-container-lowest text-on-surface shadow-ambient" : ""
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </span>
            )}
          </span>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showPoints} onChange={(e) => setShowPoints(e.target.checked)} />
          Body u částí
        </label>
        <span>Text, hlavičku i body na listu můžete upravit kliknutím přímo do nich.</span>
        {replaceError && <span className="text-on-error-container">{replaceError}</span>}
        {id && (
          <span className={saveState === "error" ? "text-on-error-container" : "font-medium text-primary-container"}>
            {SAVE_LABELS[saveState]}
          </span>
        )}
      </div>

      {/* A4 Digital Sheet */}
      <ReadOnly value={isB}>
      <article className="mx-auto w-full max-w-[210mm] bg-surface-container-lowest px-8 py-12 shadow-ambient sm:px-14 print:max-w-none print:p-0 print:shadow-none">
        <div className="mb-8 flex flex-wrap justify-between gap-4 text-label-md text-on-surface-variant">
          <Editable value={header.meta} onChange={(v) => setDoc((d) => ({ ...d, header: { ...header, meta: v } }))} />
          <Editable
            value={header.student}
            onChange={(v) => setDoc((d) => ({ ...d, header: { ...header, student: v } }))}
          />
        </div>
        <h2 className="mb-2 font-display text-title-lg font-bold text-on-surface">
          <Editable value={doc.title} onChange={(title) => setDoc((d) => ({ ...d, title }))} />
          {twoVariants && <span className="ml-2 text-on-surface-variant">· varianta {variant}</span>}
          {showKey && <span className="ml-2 text-primary-container">· klíč</span>}
        </h2>
        <p className="mb-10 text-body-lg text-on-surface-variant">
          <Editable value={doc.instructions} onChange={(instructions) => setDoc((d) => ({ ...d, instructions }))} />
        </p>

        <div className="flex flex-col gap-12">
          {shown.sections.map((section, si) => (
            <section key={si}>
              <div className="mb-1 flex items-baseline gap-3">
                <span className="font-display text-title-md font-bold text-primary-container">{LETTERS[si]}</span>
                <h3 className="flex-1 font-display text-title-md font-bold text-on-surface">
                  <Editable value={section.title} onChange={(title) => updateSection(si, { title })} />
                </h3>
                {showPoints && (
                  <span className="shrink-0 text-label-md text-on-surface-variant">
                    ___ /{" "}
                    <Editable
                      value={String(sectionPoints(section)).replace(".", ",")}
                      onChange={(v) => setSectionTotal(si, v)}
                    />{" "}
                    b
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
                onSection={(patch) => updateSection(si, patch)}
                editing={editing}
                tools={(ii) =>
                  editing && (
                    <ItemTools
                      busy={busy === `${si}-${ii}`}
                      onReplace={onReplace && (() => replace(si, ii))}
                      onRemove={() => setItems(si, (items) => items.filter((_, k) => k !== ii))}
                    />
                  )
                }
              />
              {editing && (
                <button
                  type="button"
                  onClick={() => setItems(si, (items) => [...items, blankItem(section.type)])}
                  className="mt-4 rounded-lg px-2 py-1 text-sm font-medium text-primary-container hover:bg-surface-container-low print:hidden"
                >
                  + Přidat vlastní otázku
                </button>
              )}
            </section>
          ))}
        </div>

        {showPoints && (
          <p className="mt-14 break-inside-avoid text-right font-display text-title-md font-bold text-on-surface">
            Body: ______ / {formatPoints(total)}
          </p>
        )}
      </article>
      </ReadOnly>
      {isB && (
        <p className="text-center text-label-md text-on-surface-variant print:hidden">
          Varianta B má otázky i možnosti v jiném pořadí. Upravuje se varianta A, B se podle ní přepočítá.
        </p>
      )}
    </div>
  );
}
