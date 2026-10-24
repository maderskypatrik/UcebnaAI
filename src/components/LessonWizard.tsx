"use client";

import { useState } from "react";
import {
  MAX_ITEMS,
  PRESETS,
  QUESTION_TYPES,
  QUESTION_TYPE_IDS,
  type QuestionType,
  type SectionSpec,
  type Sheet as SheetData,
  type Template,
} from "@/lib/schemas";
import { SCHOOL_TYPES, SUBJECTS } from "@/lib/schools";
import { AssistantButton } from "./AssistantButton";
import { requestGeneration, requestReplacement, requestSection } from "@/lib/client-api";
import { formatSize, shrinkImage } from "@/lib/shrink-image";
import Link from "next/link";
import { saveLastSettings, useLastSettings } from "@/lib/last-settings";
import { useAuth } from "./AuthProvider";
import { Sheet } from "./Sheet";

const STEPS = ["Škola a předmět", "Podklady", "Výstup"] as const;
const OUTPUTS = [
  { id: "test", label: "Test", hint: "s body za každou část" },
  { id: "worksheet", label: "Pracovní list", hint: "k procvičování" },
] as const;

const isForeignLanguage = (subject: string) =>
  /jazyk|english|deutsch|angli|němč|nemc|franc|španěl|rušt|ruský/i.test(subject) && !/český/i.test(subject);

// Vercel rejects request bodies over 4.5 MB.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const fieldClass =
  "w-full rounded-xl bg-surface-container-high px-4 py-3 text-body-lg text-on-surface outline-none placeholder:text-on-surface-variant/70 focus:ghost-border";

function Option({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl px-4 py-3 text-left transition-colors ${
        selected
          ? "bg-primary-container text-on-primary"
          : "bg-surface-container-low text-on-surface hover:bg-surface-container"
      }`}
    >
      {children}
    </button>
  );
}

/** What Claude is doing while the teacher waits, with the questions written so far. */
function GenerationProgress({ done, total }: { done: number; total: number }) {
  const label =
    done === 0
      ? "Claude čte podklady a vybírá učivo…"
      : done < total
        ? `Hotovo ${done} z ${total} otázek…`
        : "Kontroluji klíč a ukládám…";
  // Reading the materials takes the first share of the time, so the bar starts there.
  const share = done === 0 ? 0.1 : 0.15 + 0.8 * Math.min(done / total, 1);
  return (
    <span className="flex min-w-56 flex-1 flex-col gap-1.5" role="status">
      <span className="text-sm text-on-surface-variant">{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-surface-container">
        <span
          className="bg-assistant block h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.round(share * 100)}%` }}
        />
      </span>
    </span>
  );
}

/**
 * The three-step wizard. A template from the Kabinet pre-fills everything but the materials;
 * without one, the wizard starts from the teacher's last settings on this device.
 */
export function LessonWizard({ template }: { template?: Template }) {
  const last = useLastSettings();
  const start = template ?? last ?? undefined;
  return <Wizard key={template ? "template" : last ? "last" : "new"} template={start} remembered={!template && !!last} />;
}

function Wizard({ template, remembered }: { template?: Template; remembered: boolean }) {
  const [step, setStep] = useState(template?.schoolId && template.grade ? 1 : 0);
  const [schoolId, setSchoolId] = useState<string | null>(template?.schoolId || null);
  const [grade, setGrade] = useState<string | null>(template?.grade || null);
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [topic, setTopic] = useState("");
  const [output, setOutput] = useState<"test" | "worksheet">(template?.output ?? "test");
  const [presetId, setPresetId] = useState<string | null>(template ? null : PRESETS[1].id);
  const [sections, setSections] = useState<SectionSpec[]>(template?.sections ?? PRESETS[1].sections);
  const [instructionLanguage, setInstructionLanguage] = useState<"czech" | "subject" | null>(
    template?.instructionLanguage ?? null,
  );
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [difficulty, setDifficulty] = useState(template?.difficulty ?? "Střední");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sheet: SheetData; id: string | null } | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const auth = useAuth();
  const needsLogin = auth.enabled && !auth.loading && !auth.session;

  const school = SCHOOL_TYPES.find((s) => s.id === schoolId);
  const uploadBytes = files.reduce((sum, f) => sum + f.size, 0);
  const tooBig = uploadBytes > MAX_UPLOAD_BYTES;
  const itemCount = sections.reduce((sum, x) => sum + x.count, 0);
  const pointCount = sections.reduce((sum, x) => sum + x.count * x.points, 0);
  const language = instructionLanguage ?? (isForeignLanguage(subject) ? "subject" : "czech");
  const meta = `${subject} · ${school?.name} · ${grade}`;
  const canContinue = [
    Boolean(school && grade && subject),
    Boolean(topic && (files.length > 0 || url) && !tooBig && !preparing),
    sections.length > 0 && itemCount <= MAX_ITEMS,
  ][step];

  const updateSection = (i: number, patch: Partial<SectionSpec>) => {
    setPresetId(null);
    setSections(sections.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setPreparing(true);
    setFileError(null);
    const added: File[] = [];
    for (const file of Array.from(list)) {
      try {
        added.push(await shrinkImage(file));
      } catch (e) {
        setFileError(e instanceof Error ? e.message : `Soubor „${file.name}“ se nepodařilo načíst.`);
      }
    }
    setFiles((current) => [...current, ...added]);
    setPreparing(false);
  }

  async function submit() {
    setLoading(true);
    setProgress(0);
    setError(null);
    const form = new FormData();
    form.set("output", output);
    form.set("school", school?.name ?? "");
    form.set("schoolId", schoolId ?? "");
    form.set("grade", grade ?? "");
    form.set("subject", subject);
    form.set("topic", topic);
    form.set("url", url);
    form.set("difficulty", difficulty);
    form.set("sections", JSON.stringify(sections));
    form.set("instructionLanguage", language);
    form.set("note", note);
    form.set("meta", meta);
    files.forEach((f) => form.append("files", f));
    try {
      const body = await requestGeneration(form, setProgress);
      setResult({ sheet: body.sheet as SheetData, id: body.id ?? null });
      saveLastSettings({
        schoolId: schoolId ?? "",
        grade: grade ?? "",
        subject,
        difficulty,
        instructionLanguage: language,
        output,
        sections,
      });
      if (typeof body.left === "number") setLeft(body.left);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generování se nepovedlo.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <Sheet
        result={result.sheet}
        id={result.id}
        meta={meta}
        onBack={() => setResult(null)}
        onReplace={(args) => requestReplacement({ ...args, files, url })}
        onAddSection={(args) => requestSection({ ...args, files, url })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {needsLogin && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-secondary-container/60 px-6 py-4">
          <p className="text-body-lg text-on-surface">
            Pro vytváření testů se prosím přihlaste. Hotové testy se vám pak ukládají do Kabinetu.
          </p>
          <Link href="/prihlaseni" className="bg-assistant rounded-xl px-5 py-2.5 font-medium text-on-primary">
            Přihlásit se
          </Link>
        </div>
      )}
      <ol className="flex flex-wrap gap-x-8 gap-y-3">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-3">
            <span
              className={`flex size-8 items-center justify-center rounded-full font-display text-sm font-bold ${
                i <= step
                  ? "bg-assistant text-on-primary"
                  : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              {i + 1}
            </span>
            <span
              className={i === step ? "font-medium text-on-surface" : "text-on-surface-variant"}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="flex flex-col gap-8">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-label-md text-on-surface-variant">Typ školy</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SCHOOL_TYPES.map((s) => (
                <Option
                  key={s.id}
                  selected={s.id === schoolId}
                  onClick={() => {
                    setSchoolId(s.id);
                    setGrade(null);
                  }}
                >
                  <span className="block font-medium">{s.name}</span>
                  <span className="block text-label-md opacity-75">{s.hint}</span>
                </Option>
              ))}
            </div>
          </fieldset>

          {school && (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-3 text-label-md text-on-surface-variant">
                {school.id === "zs" ? "Třída" : "Ročník"}
              </legend>
              <div className="flex flex-wrap gap-2">
                {school.grades.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrade(g)}
                    aria-pressed={g === grade}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      g === grade
                        ? "bg-primary-container text-on-primary"
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <label className="flex flex-col gap-2">
            <span className="text-label-md text-on-surface-variant">Předmět</span>
            <input
              className={fieldClass}
              list="subjects"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Vyberte nebo napište předmět"
            />
            <datalist id="subjects">
              {SUBJECTS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-6">
          {remembered && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-on-surface-variant">
              <span>
                Stejně jako minule: <strong className="text-on-surface">{meta}</strong>
              </span>
              <button
                type="button"
                onClick={() => setStep(0)}
                className="font-medium text-primary-container hover:underline"
              >
                Změnit
              </button>
            </p>
          )}
          <label className="flex flex-col gap-2">
            <span className="text-label-md text-on-surface-variant">Zadejte téma hodiny</span>
            <input
              className={fieldClass}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="např. Fotosyntéza"
            />
          </label>

          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl bg-surface-container-low px-6 py-12 text-center transition-colors hover:bg-surface-container">
            <span className="font-medium text-on-surface">Nahrajte podklady</span>
            <span className="text-label-md text-on-surface-variant">
              Fotografie stránek (i víc najednou), PDF, PowerPoint (PPTX)
            </span>
            <span className="text-label-md text-on-surface-variant">
              Fotky z mobilu aplikace sama zmenší, aby se jich vešlo víc.
            </span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.pdf,.pptx"
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          {files.length > 0 && (
            <ul className="flex flex-col gap-2">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-2 text-sm"
                >
                  <span className="truncate text-on-surface">{f.name}</span>
                  <span className="ml-auto shrink-0 pl-4 text-label-md text-on-surface-variant">
                    {formatSize(f.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="ml-4 shrink-0 text-on-surface-variant hover:text-on-surface"
                  >
                    Odebrat
                  </button>
                </li>
              ))}
            </ul>
          )}
          {preparing && <p className="text-sm text-on-surface-variant">Připravuji fotky…</p>}
          {files.length > 0 && !tooBig && (
            <p className="text-label-md text-on-surface-variant">
              Celkem {formatSize(uploadBytes)} ze 4 MB
            </p>
          )}
          {fileError && (
            <p className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container">{fileError}</p>
          )}
          {tooBig && (
            <p className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container">
              Soubory mají dohromady {formatSize(uploadBytes)}, víc než 4 MB. Odeberte některý soubor, nejčastěji
              velké PDF.
            </p>
          )}

          <label className="flex flex-col gap-2">
            <span className="text-label-md text-on-surface-variant">
              Nebo vložte odkaz na webovou stránku
            </span>
            <input
              className={fieldClass}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value.trim())}
              placeholder="https://"
            />
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-8">
          <div className="grid gap-3 sm:grid-cols-2">
            {OUTPUTS.map((o) => (
              <Option key={o.id} selected={output === o.id} onClick={() => setOutput(o.id)}>
                <span className="block font-medium">{o.label}</span>
                <span className="block text-label-md opacity-75">{o.hint}</span>
              </Option>
            ))}
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-label-md text-on-surface-variant">Šablona</legend>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.hint}
                  aria-pressed={presetId === p.id}
                  onClick={() => {
                    setPresetId(p.id);
                    setSections(p.sections);
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    presetId === p.id
                      ? "bg-primary-container text-on-primary"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-label-md text-on-surface-variant">
              Části {output === "test" ? "testu" : "listu"}
            </legend>
            {sections.map((sec, i) => (
              <div
                key={i}
                className="grid grid-cols-[2rem_1fr] items-center gap-3 rounded-xl bg-surface-container-low p-3 sm:grid-cols-[2rem_1fr_6rem_6rem_auto]"
              >
                <span className="font-display font-bold text-primary-container">
                  {String.fromCharCode(65 + i)}
                </span>
                <select
                  aria-label="Typ úloh"
                  className={fieldClass}
                  value={sec.type}
                  onChange={(e) => {
                    const type = e.target.value as QuestionType;
                    updateSection(i, { type, points: QUESTION_TYPES[type].points });
                  }}
                >
                  {QUESTION_TYPE_IDS.map((t) => (
                    <option key={t} value={t}>
                      {QUESTION_TYPES[t].label} ({QUESTION_TYPES[t].hint})
                    </option>
                  ))}
                </select>
                <label className="col-start-2 flex items-center gap-2 text-sm text-on-surface-variant sm:col-start-auto">
                  <input
                    className={`${fieldClass} px-3`}
                    type="number"
                    min={1}
                    max={30}
                    value={sec.count}
                    onChange={(e) => updateSection(i, { count: Number(e.target.value) })}
                  />
                  <span>×</span>
                </label>
                <label className="col-start-2 flex items-center gap-2 text-sm text-on-surface-variant sm:col-start-auto">
                  <input
                    className={`${fieldClass} px-3`}
                    type="number"
                    min={0.5}
                    max={20}
                    step={0.5}
                    value={sec.points}
                    onChange={(e) => updateSection(i, { points: Number(e.target.value) })}
                  />
                  <span>b</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setPresetId(null);
                    setSections(sections.filter((_, j) => j !== i));
                  }}
                  className="col-start-2 justify-self-start rounded-xl px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container sm:col-start-auto"
                >
                  Odebrat
                </button>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={sections.length >= 8}
                onClick={() => {
                  setPresetId(null);
                  setSections([...sections, { type: "short_answer", count: 3, points: 2 }]);
                }}
                className="rounded-xl px-4 py-2 text-sm font-medium text-primary-container hover:bg-surface-container-low disabled:opacity-50"
              >
                + Přidat část
              </button>
              <span
                className={`text-sm ${itemCount > MAX_ITEMS ? "text-on-error-container" : "text-on-surface-variant"}`}
              >
                Celkem {itemCount} položek · {pointCount} bodů
                {itemCount > MAX_ITEMS && ` (nejvýš ${MAX_ITEMS} položek)`}
              </span>
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-label-md text-on-surface-variant">Obtížnost</span>
              <select
                className={fieldClass}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option>Lehká</option>
                <option>Střední</option>
                <option>Náročná</option>
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-label-md text-on-surface-variant">Pokyny a nadpisy psát</span>
              <select
                className={fieldClass}
                value={language}
                onChange={(e) => setInstructionLanguage(e.target.value as "czech" | "subject")}
              >
                <option value="czech">česky</option>
                <option value="subject">v jazyce předmětu</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-label-md text-on-surface-variant">
              Poznámka pro AI (nepovinné)
            </span>
            <textarea
              className={`${fieldClass} min-h-24`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="např. jen slovíčka ze strany 42, zaměř se na frázová slovesa"
            />
          </label>

          <p className="text-label-md text-on-surface-variant">
            {school?.name} · {grade} · {subject} · {topic}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="rounded-xl px-5 py-3 font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            Zpět
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <AssistantButton type="button" disabled={!canContinue} onClick={() => setStep(step + 1)}>
            Pokračovat
          </AssistantButton>
        ) : (
          <AssistantButton type="button" disabled={loading || !canContinue || needsLogin} onClick={submit}>
            {loading
              ? "Claude připravuje…"
              : output === "test"
                ? "Vytvořit test"
                : "Vytvořit pracovní list"}
          </AssistantButton>
        )}
        {loading && <GenerationProgress done={progress} total={itemCount} />}
        {!loading && left !== null && (
          <span className="text-sm text-on-surface-variant">Dnes můžete vytvořit ještě {left}×.</span>
        )}
        {error && (
          <span className="rounded-xl bg-error-container px-4 py-2 text-sm text-on-error-container">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
