import { Chip } from "@/components/Chip";
import { LessonForm } from "@/components/LessonForm";
import { Sidebar } from "@/components/Sidebar";

export default function Home() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 px-6 py-12 sm:px-10 lg:px-16">
        <header className="mb-12 max-w-3xl">
          <p className="mb-3 text-label-md uppercase tracking-widest text-on-surface-variant">
            Přehled
          </p>
          <h1 className="font-display text-display-sm font-bold text-on-surface sm:text-display-lg">
            Dobrý den, pane učiteli
          </h1>
          <p className="mt-4 text-body-lg text-on-surface-variant">
            Nahrajte své materiály a během chvíle z nich vytvoříme test nebo pracovní list.
          </p>
        </header>

        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]">
          {/* A4 Digital Sheet */}
          <section className="mx-auto w-full max-w-[210mm] rounded-sm bg-surface-container-lowest px-8 py-12 shadow-ambient sm:px-14">
            <div className="mb-8 flex flex-wrap gap-x-6 gap-y-1 text-label-md text-on-surface-variant">
              <span>Předmět: —</span>
              <span>Ročník: —</span>
            </div>
            <h2 className="mb-2 font-display text-title-lg font-semibold text-on-surface">
              Příprava na hodinu
            </h2>
            <p className="mb-10 text-body-lg text-on-surface-variant">
              Zatím zde nejsou žádné přípravy. Začněte tím, že napíšete téma hodiny.
            </p>
            <LessonForm />
          </section>

          {/* AI suggestions column */}
          <aside className="flex flex-col gap-6">
            <div className="glass rounded-xl p-6">
              <h3 className="mb-3 font-display text-title-md font-semibold text-primary-container">
                Asistent navrhuje
              </h3>
              <p className="mb-4 text-sm leading-relaxed text-on-surface-variant">
                Cíle, které AI doplní k vaší hodině:
              </p>
              <div className="flex flex-wrap gap-2">
                <Chip>Kritické myšlení</Chip>
                <Chip>Spolupráce</Chip>
                <Chip>Porozumění textu</Chip>
              </div>
            </div>

            <div className="rounded-xl bg-tertiary-container/40 p-6">
              <h3 className="mb-2 font-display text-title-md font-semibold text-tertiary">
                Tip pro učitele
              </h3>
              <p className="text-sm leading-relaxed text-on-surface">
                Čím kvalitnější fotka nebo PDF, tím přesnější otázky. Stačí i fotka
                stránky z učebnice.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
