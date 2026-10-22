"use client";

import { useState } from "react";
import { AssistantButton } from "./AssistantButton";

const OUTPUTS = ["Test s výběrem odpovědí", "Pracovní list"] as const;

const fieldClass =
  "w-full rounded-xl bg-surface-container-high px-4 py-3 text-body-lg text-on-surface outline-none placeholder:text-on-surface-variant/70 focus:ghost-border";

export function LessonForm() {
  const [output, setOutput] = useState<(typeof OUTPUTS)[number]>(OUTPUTS[0]);
  const [notice, setNotice] = useState(false);

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        setNotice(true);
      }}
    >
      <div className="flex flex-wrap gap-2">
        {OUTPUTS.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setOutput(o)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              output === o
                ? "bg-primary-container text-on-primary"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {o}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-label-md text-on-surface-variant">Zadejte téma hodiny</span>
        <input className={fieldClass} placeholder="např. Fotosyntéza, 7. ročník" />
      </label>

      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl bg-surface-container-low px-6 py-10 text-center transition-colors hover:bg-surface-container">
        <span className="font-medium text-on-surface">Nahrajte podklady</span>
        <span className="text-label-md text-on-surface-variant">
          Fotografie, PDF, PowerPoint (PPTX)
        </span>
        <input type="file" multiple accept="image/*,.pdf,.pptx" className="sr-only" />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-label-md text-on-surface-variant">Nebo vložte odkaz na webovou stránku</span>
        <input className={fieldClass} type="url" placeholder="https://" />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-label-md text-on-surface-variant">Počet otázek</span>
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

      <div className="flex flex-wrap items-center gap-4">
        <AssistantButton type="submit">
          {output === OUTPUTS[0] ? "Vytvořit kvíz" : "Vytvořit pracovní list"}
        </AssistantButton>
        {notice && (
          <span className="rounded-xl bg-secondary-container/60 px-4 py-2 text-sm text-on-secondary-container">
            Generování spustíme v příští verzi.
          </span>
        )}
      </div>
    </form>
  );
}
