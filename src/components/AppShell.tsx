"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";

function NavLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-xl px-4 py-2 transition-colors ${
        active ? "font-medium text-primary-container" : "text-on-surface-variant hover:bg-surface-container-low"
      }`}
    >
      {children}
    </Link>
  );
}

function Account() {
  const { enabled, loading, session, signOut } = useAuth();
  if (!enabled || loading) return null;
  if (!session) {
    return (
      <Link href="/prihlaseni" className="rounded-xl bg-surface-container-low px-4 py-2 font-medium text-primary-container">
        Přihlásit se
      </Link>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <span className="hidden max-w-48 truncate text-label-md text-on-surface-variant sm:inline">
        {session.user.email}
      </span>
      <button
        type="button"
        onClick={signOut}
        className="rounded-xl px-4 py-2 text-on-surface-variant transition-colors hover:bg-surface-container-low"
      >
        Odhlásit
      </button>
    </span>
  );
}

/** Top bar and page frame shared by all pages. */
export function AppShell({
  title,
  subtitle,
  active,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Which top-bar link to highlight. */
  active?: "new" | "kabinet";
  children: ReactNode;
}) {
  const { enabled } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-6 sm:px-10 print:hidden">
        <Link href="/" className="flex items-center gap-2 font-display text-title-lg font-bold text-primary-container">
          Učebna.ai
          <span
            title="Aplikaci zkoušíme s prvními učiteli. Za každou zpětnou vazbu děkujeme."
            className="rounded-full bg-secondary-container px-2 py-0.5 font-sans text-label-md font-semibold text-primary-container"
          >
            Beta
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <NavLink href="/" active={active === "new"}>
            Nová příprava
          </NavLink>
          {enabled && (
            <NavLink href="/kabinet" active={active === "kabinet"}>
              Kabinet
            </NavLink>
          )}
          <Account />
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 print:max-w-none print:p-0">
        <div className="mb-10 px-2 print:hidden">
          <h1 className="font-display text-display-sm font-bold text-on-surface">{title}</h1>
          {subtitle && <p className="mt-3 text-body-lg text-on-surface-variant">{subtitle}</p>}
        </div>
        <section className="rounded-xl bg-surface-container-lowest px-6 py-10 shadow-ambient sm:px-12 print:p-0 print:shadow-none">
          {children}
        </section>
        <footer className="mt-8 flex justify-center text-label-md text-on-surface-variant print:hidden">
          <Link href="/ochrana-osobnich-udaju" className="rounded-lg px-3 py-1 hover:bg-surface-container-low">
            Ochrana osobních údajů
          </Link>
        </footer>
      </main>
    </div>
  );
}
