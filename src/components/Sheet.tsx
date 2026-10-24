"use client";

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { requestAdaptation } from "@/lib/client-api";
import { ExportMenu } from "./ExportMenu";
import { MathText } from "./MathText";
import { hasMath } from "@/lib/rich";
import { ShareButton } from "./ShareButton";
import { useAuth } from "./AuthProvider";
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
  QUESTION_TYPES,
  QUESTION_TYPE_IDS,
  type Item,
  type QuestionType,
  type Section,
  type SectionSpec,
  type Sheet as SheetData,
} from "@/lib/schemas";

/** True while variant B is shown: it is derived from A, so it is read only. */
const ReadOnly = createContext(false);

/** A field that looks like printed text but can be edited in place. */
function Editable(props: { value: string; onChange: (value: string) => void; className?: string }) {
  if (use(ReadOnly))
    return (
      <span className={props.className}>
        <MathText text={props.value} />
      </span>
    );
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
  // Text with formulas shows them typeset; a click switches to the source, e.g. "$\frac{3}{4}$".
  const [source, setSource] = useState(false);
  const field = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (source) field.current?.focus();
  }, [source]);
  if (hasMath(value) && !source) {
    return (
      <span
        tabIndex={0}
        onClick={() => setSource(true)}
        onFocus={() => setSource(true)}
        title="Kliknutím upravíte vzorec"
        className={`cursor-text rounded-sm hover:bg-surface-container-low print:bg-transparent ${className}`}
      >
        <MathText text={value} />
      </span>
    );
  }
  return (
    <span
      ref={field}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => {
        setSource(false);
        onChange(e.currentTarget.textContent ?? "");
      }}
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
          {bank.map((word, i) => (
            <span key={i}>
              {i > 0 && " · "}
              <MathText text={word} />
            </span>
          ))}
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

type Rating = 1 | -1;

/** Saves a teacher's thumbs up or down on one question, for improving the prompts later. */
async function rateItem(rating: Rating, item: Item, type: Section["type"], title: string, meta: string) {
  if (!supabaseConfigured) return;
  const { error } = await getSupabase()
    .from("question_feedback")
    .insert({ rating, item, question_type: type, sheet_title: title, meta });
  if (error) console.error("Feedback", error.message);
}

/** Lets the teacher ask for one more part of the test: its question type, count and points. */
function AddSection({ onAdd }: { onAdd: (spec: SectionSpec) => Promise<void> }) {
  const [type, setType] = useState<QuestionType>("multiple_choice");
  const [count, setCount] = useState(5);
  const [points, setPoints] = useState(1);
  const [busy, setBusy] = useState(false);
  const field = "rounded-lg bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant print:hidden">
      <span className="font-medium text-on-surface">Přidat část:</span>
      <select value={type} onChange={(e) => setType(e.target.value as QuestionType)} className={field}>
        {QUESTION_TYPE_IDS.map((id) => (
          <option key={id} value={id}>
            {QUESTION_TYPES[id].label}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1">
        <input
          type="number"
          min={1}
          max={20}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className={`${field} w-16`}
        />
        položek
      </label>
      <label className="flex items-center gap-1">
        po
        <input
          type="number"
          min={0.5}
          max={20}
          step={0.5}
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          className={`${field} w-16`}
        />
        b
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onAdd({ type, count, points }).finally(() => setBusy(false));
        }}
        className="bg-assistant rounded-lg px-4 py-1.5 font-medium text-on-primary disabled:opacity-60"
      >
        {busy ? "Claude píše…" : "Vytvořit část"}
      </button>
    </div>
  );
}

/** A problem with room for the working and a line for the result; the key shows the steps. */
function Calculation({ section, start, showKey, onItem, tools }: ItemProps) {
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
            <div className="mt-3 ml-6 flex flex-col gap-3">
              <div className="h-36 rounded-lg border border-dashed border-outline-variant" aria-label="Místo na postup" />
              <p className="text-body-lg text-on-surface-variant">
                Výsledek: <span className="inline-block w-48 border-b border-dotted border-on-surface-variant/60" />
              </p>
            </div>
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
  rating,
  onRate,
}: {
  busy: boolean;
  onReplace?: () => void;
  onRemove: () => void;
  rating?: Rating;
  onRate?: (rating: Rating) => void;
}) {
  const button =
    "rounded-lg px-2 py-1 text-label-md font-medium transition-colors disabled:opacity-50 print:hidden";
  return (
    <span className="flex shrink-0 items-center gap-1 self-start print:hidden">
      {onRate &&
        ([1, -1] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onRate(r)}
            aria-pressed={rating === r}
            title={r === 1 ? "Dobrá otázka" : "Slabá otázka (pomůže nám zlepšit Clauda)"}
            className={`${button} ${
              rating === r ? "bg-secondary-container text-primary-container" : "text-on-surface-variant hover:bg-surface-container-low"
            }`}
          >
            {r === 1 ? "👍" : "👎"}
          </button>
        ))}
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
    case "calculation":
      return <Calculation {...props} />;
  }
}

/** The sheet with a history of edits, so the teacher can step back. */
function useUndoable<T>(initial: T) {
  const [state, setState] = useState<{ doc: T; past: T[] }>({ doc: initial, past: [] });
  const setDoc = useCallback((change: T | ((doc: T) => T)) => {
    setState((s) => {
      const next = typeof change === "function" ? (change as (doc: T) => T)(s.doc) : change;
      // Leaving a field without changing it still reports its text; that is not an edit.
      if (JSON.stringify(next) === JSON.stringify(s.doc)) return s;
      return { doc: next, past: [...s.past.slice(-49), s.doc] };
    });
  }, []);
  const undo = useCallback(
    () => setState((s) => (s.past.length ? { doc: s.past[s.past.length - 1], past: s.past.slice(0, -1) } : s)),
    [],
  );
  const canUndo = state.past.length > 0;

  // Ctrl+Z / Cmd+Z outside a text field steps back; inside one the browser undoes the typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  return { doc: state.doc, setDoc, undo, canUndo };
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
  onAddSection,
}: {
  result: SheetData;
  /** Kabinet id; when set, edits are saved automatically. */
  id?: string | null;
  meta: string;
  /** Without it there is no back button, as in the sample on the home page. */
  onBack?: () => void;
  backLabel?: string;
  /** Asks the AI for one new question in place of the one at `index`. */
  onReplace?: (args: { section: Section; index: number; title: string; meta: string }) => Promise<Item>;
  /** Asks the AI for one more part of the test. */
  onAddSection?: (args: { sheet: SheetData; spec: SectionSpec; meta: string }) => Promise<Section>;
}) {
  const { doc, setDoc, undo, canUndo } = useUndoable<SheetData>({
    ...result,
    header: result.header ?? { meta, student: STUDENT_LINE },
  });
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
  const [adapting, setAdapting] = useState(false);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const auth = useAuth();
  const [adapted, setAdapted] = useState<{ sheet: SheetData; id: string | null } | null>(null);

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

  async function adapt() {
    setAdapting(true);
    setReplaceError(null);
    try {
      const body = await requestAdaptation(doc, header.meta);
      setAdapted({ sheet: body.sheet, id: body.id ?? null });
    } catch (e) {
      setReplaceError(e instanceof Error ? e.message : "Úpravu pro SVP se nepodařilo vytvořit.");
    } finally {
      setAdapting(false);
    }
  }

  if (adapted) {
    return (
      <Sheet
        result={adapted.sheet}
        id={adapted.id}
        meta={header.meta}
        onBack={() => setAdapted(null)}
        backLabel="Zpět na původní test"
        onReplace={onReplace}
        onAddSection={onAddSection}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl px-3 py-3 font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            {backLabel}
          </button>
        )}
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
        <ExportMenu sheet={shown} showKey={showKey} showPoints={showPoints} />
        {!doc.svp && (!auth.enabled || auth.session) && (
          <button
            type="button"
            onClick={adapt}
            disabled={adapting}
            title="Jednodušší zadání, nápovědy a větší písmo"
            className="rounded-xl bg-surface-container-low px-5 py-3 font-medium text-primary-container transition-colors hover:bg-surface-container disabled:opacity-60"
          >
            {adapting ? "Upravuji pro SVP…" : "Verze pro SVP"}
          </button>
        )}
        {id && <ShareButton id={id} />}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-label-md text-on-surface-variant print:hidden">
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          title="Vrátit poslední úpravu (Ctrl+Z)"
          className="rounded-lg px-2 py-0.5 font-medium text-primary-container hover:bg-surface-container-low disabled:text-on-surface-variant disabled:opacity-50"
        >
          ↶ Vrátit úpravu
        </button>
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
        {doc.svp && (
          <span className="font-medium text-on-surface">
            Verze pro žáky se SVP: jednodušší zadání, nápovědy a větší písmo.
          </span>
        )}
        {adapting && <span>Úprava trvá asi minutu. Uloží se do Kabinetu jako nový test.</span>}
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
      <article className={`${doc.svp ? "svp-sheet " : ""}mx-auto w-full max-w-[210mm] bg-surface-container-lowest px-8 py-12 shadow-ambient sm:px-14 print:max-w-none print:p-0 print:shadow-none`}>
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
                      rating={ratings[`${si}-${section.items[ii].prompt}`]}
                      onRate={
                        auth.session
                          ? (r) => {
                              setRatings((x) => ({ ...x, [`${si}-${section.items[ii].prompt}`]: r }));
                              rateItem(r, section.items[ii], section.type, doc.title, header.meta);
                            }
                          : undefined
                      }
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
          {editing && onAddSection && doc.sections.length < 8 && (
            <AddSection
              onAdd={async (spec) => {
                setReplaceError(null);
                try {
                  const section = await onAddSection({ sheet: doc, spec, meta: header.meta });
                  setDoc((d) => ({ ...d, sections: [...d.sections, section] }));
                } catch (e) {
                  setReplaceError(e instanceof Error ? e.message : "Novou část se nepodařilo vytvořit.");
                }
              }}
            />
          )}
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
