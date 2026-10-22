import Link from "next/link";
import { LessonWizard } from "@/components/LessonWizard";

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="print:hidden flex items-center justify-between px-6 py-6 sm:px-10">
        <span className="font-display text-title-lg font-bold text-primary-container">
          Učebna.ai
        </span>
        <nav className="flex gap-1 text-sm">
          <Link href="/" className="rounded-xl px-4 py-2 font-medium text-primary-container">
            Nová příprava
          </Link>
          <Link
            href="/"
            className="rounded-xl px-4 py-2 text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            Kabinet
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 print:max-w-none print:p-0">
        <div className="mb-10 px-2 print:hidden">
          <h1 className="font-display text-display-sm font-bold text-on-surface">
            Dobrý den, pane učiteli
          </h1>
          <p className="mt-3 text-body-lg text-on-surface-variant">
            Ve třech krocích vytvoříme test nebo pracovní list z vašich materiálů.
          </p>
        </div>

        <section className="rounded-xl bg-surface-container-lowest px-6 py-10 shadow-ambient sm:px-12 print:p-0 print:shadow-none">
          <LessonWizard />
        </section>
      </main>
    </div>
  );
}
