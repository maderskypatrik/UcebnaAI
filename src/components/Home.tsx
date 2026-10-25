"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
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
  { title: "Otázky podle vás", text: "Překlady slovíček, výběr z možností, doplňování, přiřazování, seřazování i otevřené úlohy." },
  { title: "Každý předmět", text: "Vzorce, chemické rovnice a výpočty, úlohy k mapě či schématu, doplňování i/y." },
  { title: "Pro nejmenší", text: "Velké písmo, osmisměrka a křížovka s tajenkou pro 1. stupeň." },
  { title: "I bez podkladů", text: "Opakovací test jen z tématu a ročníku, s úrovní myšlení podle Bloomovy taxonomie." },
  { title: "Body a klíč", text: "Body u každé části a klíč pro učitele jedním kliknutím." },
  { title: "Varianty A a B", text: "Stejný test s jiným pořadím otázek, aby žáci neopisovali." },
  { title: "Rychlá oprava", text: "Záznamový arch pro žáky, šablona pro opravu a stupnice známek." },
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

const TIPS_KEY = "ucebna:tips-seen";
const tipsListeners = new Set<() => void>();
const tipsSeen = () => {
  try {
    return localStorage.getItem(TIPS_KEY) === "1";
  } catch {
    return true;
  }
};

/** Three short tips for a teacher's first visit, until they close them. */
function FirstSteps() {
  const seen = useSyncExternalStore(
    (onChange) => {
      tipsListeners.add(onChange);
      return () => tipsListeners.delete(onChange);
    },
    tipsSeen,
    () => true,
  );
  if (seen) return null;
  const close = () => {
    try {
      localStorage.setItem(TIPS_KEY, "1");
    } catch {}
    tipsListeners.forEach((f) => f());
  };
  return (
    <div className="mb-10 flex flex-col gap-4 rounded-xl bg-secondary-container/60 px-6 py-5">
      <p className="font-medium text-on-surface">Vítejte v Učebně. Tři tipy na začátek:</p>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-on-surface">
        <li>Nafoťte stránky učebnice mobilem, nebo zaškrtněte „Nemám podklady“ a stačí zadat téma.</li>
        <li>Na hotovém testu klikněte do jakéhokoli textu a upravte ho. Otázku, která se nepovedla, vyměníte jedním tlačítkem.</li>
        <li>Klíč, dvě varianty, verzi pro SVP i záznamový arch zapnete nad testem. Všechno se samo ukládá do Kabinetu.</li>
      </ol>
      <p className="text-sm text-on-surface-variant">
        Aplikace je v betě. Když něco nefunguje nebo vás napadne vylepšení, klikněte vpravo dole na Zpětnou vazbu.
      </p>
      <button
        type="button"
        onClick={close}
        className="self-start rounded-lg bg-surface-container-lowest px-4 py-2 text-sm font-medium text-primary-container"
      >
        Rozumím
      </button>
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
      {loading && enabled ? (
        <p className="text-body-lg text-on-surface-variant">Načítám…</p>
      ) : (
        <>
          <FirstSteps />
          <LessonWizard />
        </>
      )}
    </AppShell>
  );
}
