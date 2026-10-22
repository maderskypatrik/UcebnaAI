"use client";

import { useState } from "react";
import { SCHOOL_TYPES, SUBJECTS } from "@/lib/schools";
import { AssistantButton } from "./AssistantButton";

const STEPS = ["Škola a předmět", "Podklady", "Výstup"] as const;
const OUTPUTS = ["Test s výběrem odpovědí", "Pracovní list"] as const;

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

export function LessonWizard() {
  const [step, setStep] = useState(0);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [output, setOutput] = useState<(typeof OUTPUTS)[number]>(OUTPUTS[0]);
  const [notice, setNotice] = useState(false);

  const school = SCHOOL_TYPES.find((s) => s.id === schoolId);
  const canContinue = [Boolean(school && grade && subject), Boolean(topic), true][step];

  return (
    <div className="flex flex-col gap-10">
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
              Fotografie, PDF, PowerPoint (PPTX)
            </span>
            <input type="file" multiple accept="image/*,.pdf,.pptx" className="sr-only" />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-label-md text-on-surface-variant">
              Nebo vložte odkaz na webovou stránku
            </span>
            <input className={fieldClass} type="url" placeholder="https://" />
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-8">
          <div className="grid gap-3 sm:grid-cols-2">
            {OUTPUTS.map((o) => (
              <Option key={o} selected={output === o} onClick={() => setOutput(o)}>
                <span className="font-medium">{o}</span>
              </Option>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-label-md text-on-surface-variant">
                {output === OUTPUTS[0] ? "Počet otázek" : "Počet úloh"}
              </span>
              <input className={fieldClass} type="number" min={1} max={30} defaultValue={10} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-label-md text-on-surface-variant">Obtížnost</span>
              <select className={fieldClass} defaultValue="Střední">
                <option>Lehká</option>
                <option>Střední</option>
                <option>Náročná</option>
              </select>
            </label>
          </div>

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
          <AssistantButton type="button" onClick={() => setNotice(true)}>
            {output === OUTPUTS[0] ? "Vytvořit kvíz" : "Vytvořit pracovní list"}
          </AssistantButton>
        )}
        {notice && (
          <span className="rounded-xl bg-secondary-container/60 px-4 py-2 text-sm text-on-secondary-container">
            Generování spustíme v příští verzi.
          </span>
        )}
      </div>
    </div>
  );
}
