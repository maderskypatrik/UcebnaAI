"use client";

import Link from "next/link";
import { SAMPLE_META, SAMPLE_SHEET } from "@/lib/sample";
import { AppShell } from "./AppShell";
import { useAuth } from "./AuthProvider";
import { LessonWizard } from "./LessonWizard";
import { Sheet } from "./Sheet";

const STEPS = [
  { title: "Škola a předmět", text: "Vyberete typ školy, ročník a předmět. Příště si je aplikace pamatuje." },
  { title: "Podklady", text: "Nafotíte stránky učebnice, nahrajete PDF nebo prezentaci, případně vložíte odkaz." },
  { title: "Hotový test", text: "Za minutu máte test s body a klíčem, který upravíte, vytisknete nebo stáhnete." },
];

const FEATURES = [
  { title: "Otázky podle vás", text: "Překlady slovíček, výběr z možností, doplňování, přiřazování i otevřené úlohy." },
  { title: "Body a klíč", text: "Body u každé části a klíč pro učitele jedním kliknutím." },
  { title: "Varianty A a B", text: "Stejný test s jiným pořadím otázek, aby žáci neopisovali." },
  { title: "Verze pro SVP", text: "Jednodušší zadání s nápovědami a větším písmem pro žáky s podpůrnými opatřeními." },
  { title: "Word i online", text: "Stažení do Wordu, Google Formulářů, Moodlu, Kahootu nebo Quizletu." },
  { title: "Kabinet", text: "Všechny testy na jednom místě, ve složkách, a sdílení s kolegy odkazem." },
];

function Landing() {
  return (
    <div className="flex flex-col gap-14">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/prihlaseni" className="bg-assistant rounded-xl px-6 py-3 font-medium text-on-primary">
          Vyzkoušet zdarma
        </Link>
        <a
          href="#ukazka"
          className="rounded-xl bg-surface-container-low px-6 py-3 font-medium text-primary-container hover:bg-surface-container"
        >
          Podívat se na ukázku
        </a>
        <span className="text-sm text-on-surface-variant">Stačí e-mail, heslo není potřeba. Až 20 testů denně.</span>
      </div>

      <section className="flex flex-col gap-5">
        <h2 className="font-display text-title-lg font-bold text-on-surface">Jak to funguje</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-2 rounded-xl bg-surface-container-low px-5 py-5">
              <span className="font-display text-title-lg font-bold text-primary-container">{i + 1}</span>
              <span className="font-medium text-on-surface">{step.title}</span>
              <span className="text-sm text-on-surface-variant">{step.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="font-display text-title-lg font-bold text-on-surface">Co umí</h2>
        <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex flex-col gap-1">
              <span className="font-medium text-on-surface">{f.title}</span>
              <span className="text-sm text-on-surface-variant">{f.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="ukazka" className="flex scroll-mt-6 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-title-lg font-bold text-on-surface">Ukázka: test z učebnice přírodopisu</h2>
          <p className="text-sm text-on-surface-variant">
            Takhle vypadá výsledek ze dvou nafocených stránek. Přepněte si klíč, zkuste dvě varianty nebo test stáhněte.
          </p>
        </div>
        <Sheet result={SAMPLE_SHEET} meta={SAMPLE_META} />
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-secondary-container/60 px-6 py-5">
        <p className="flex-1 text-body-lg text-on-surface">Vyzkoušejte to na podkladech pro vaši příští hodinu.</p>
        <Link href="/prihlaseni" className="bg-assistant rounded-xl px-6 py-3 font-medium text-on-primary">
          Vyzkoušet zdarma
        </Link>
      </div>
    </div>
  );
}

/** Signed-out teachers see what the app does; signed-in ones go straight to the wizard. */
export function Home() {
  const { enabled, loading, session } = useAuth();
  const visitor = enabled && !loading && !session;
  if (visitor) {
    return (
      <AppShell
        active="new"
        title="Test z vašich materiálů za minutu"
        subtitle="Nahrajte fotky z učebnice, PDF nebo prezentaci. Učebna.ai z nich připraví test nebo pracovní list s body a klíčem."
      >
        <Landing />
      </AppShell>
    );
  }
  return (
    <AppShell
      active="new"
      title="Dobrý den"
      subtitle="Ve třech krocích vytvoříme test nebo pracovní list z vašich materiálů."
    >
      {loading && enabled ? <p className="text-body-lg text-on-surface-variant">Načítám…</p> : <LessonWizard />}
    </AppShell>
  );
}
