"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  templateFrom,
  type Sheet as SheetData,
  type Template,
} from "@/lib/schemas";
import { requestReplacement } from "@/lib/client-api";
import { getSupabase, type SheetRow } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import { LessonWizard } from "./LessonWizard";
import { Sheet } from "./Sheet";

/** Lowercase without diacritics, so "fotosynteza" finds "Fotosyntéza". */
const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const dateFormat = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

function Message({ children }: { children: React.ReactNode }) {
  return <p className="text-body-lg text-on-surface-variant">{children}</p>;
}

/** Shown instead of the Kabinet while the session loads or when nobody is signed in. */
function useSignedIn() {
  const { enabled, loading, session } = useAuth();
  if (!enabled) return <Message>Kabinet zatím není zapnutý.</Message>;
  if (loading) return <Message>Načítám…</Message>;
  if (!session)
    return (
      <Message>
        Kabinet uvidíte po{" "}
        <Link href="/prihlaseni" className="font-medium text-primary-container">
          přihlášení
        </Link>
        .
      </Message>
    );
  return null;
}

export function Kabinet() {
  const gate = useSignedIn();
  const [rows, setRows] = useState<SheetRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [template, setTemplate] = useState<Template | null>(null);

  useEffect(() => {
    if (gate) return;
    getSupabase()
      .from("sheets")
      .select("id, kind, title, meta, created_at, updated_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(`Kabinet se nepodařilo načíst: ${error.message}`);
        else setRows(data);
      });
  }, [gate]);

  async function remove(row: SheetRow) {
    if (
      !window.confirm(`Opravdu smazat „${row.title}“? Tento krok nejde vrátit.`)
    )
      return;
    const { error } = await getSupabase()
      .from("sheets")
      .delete()
      .eq("id", row.id);
    if (error) setError(`Smazání se nepovedlo: ${error.message}`);
    else setRows((r) => r?.filter((x) => x.id !== row.id) ?? null);
  }

  async function startSimilar(row: SheetRow) {
    const { data, error } = await getSupabase()
      .from("sheets")
      .select("data")
      .eq("id", row.id)
      .single();
    if (error) setError(`Test se nepodařilo načíst: ${error.message}`);
    else setTemplate(templateFrom(data.data as SheetData));
  }

  if (gate) return gate;
  if (error)
    return (
      <p className="rounded-xl bg-error-container px-4 py-3 text-on-error-container">
        {error}
      </p>
    );
  if (template)
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setTemplate(null)}
            className="rounded-xl px-3 py-2 font-medium text-on-surface-variant hover:bg-surface-container-low"
          >
            Zpět do Kabinetu
          </button>
          <span className="text-label-md text-on-surface-variant">
            Nastavení je stejné jako u původního testu. Stačí nahrát nové
            podklady.
          </span>
        </div>
        <LessonWizard template={template} />
      </div>
    );
  if (!rows) return <Message>Načítám…</Message>;
  if (rows.length === 0)
    return (
      <Message>
        Zatím tu nic není. Každý test, který{" "}
        <Link href="/" className="font-medium text-primary-container">
          vytvoříte
        </Link>
        , se sem uloží sám.
      </Message>
    );

  const words = plain(query).split(/\s+/).filter(Boolean);
  const found = rows.filter((row) =>
    words.every((w) => plain(`${row.title} ${row.meta}`).includes(w)),
  );

  return (
    <div className="flex flex-col gap-5">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Hledat podle názvu, předmětu nebo třídy"
        className="rounded-xl bg-surface-container-low px-4 py-3 text-body-lg text-on-surface outline-none focus:bg-surface-container"
      />
      {found.length === 0 && <Message>Nic takového v Kabinetu není.</Message>}
      <ul className="flex flex-col gap-3">
        {found.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center gap-4 rounded-xl bg-surface-container-low px-5 py-4 transition-colors hover:bg-surface-container"
          >
            <Link
              href={`/kabinet/${row.id}`}
              className="flex min-w-0 flex-1 flex-col gap-1"
            >
              <span className="truncate font-display text-title-md font-bold text-on-surface">
                {row.title}
              </span>
              <span className="truncate text-label-md text-on-surface-variant">
                {row.kind === "test" ? "Test" : "Pracovní list"} · {row.meta} ·{" "}
                {dateFormat.format(new Date(row.created_at))}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => startSimilar(row)}
              title="Stejné nastavení, nové podklady"
              className="rounded-xl px-3 py-2 text-sm font-medium text-primary-container transition-colors hover:bg-secondary-container"
            >
              Podobný test
            </button>
            <button
              type="button"
              onClick={() => remove(row)}
              className="rounded-xl px-3 py-2 text-sm text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
            >
              Smazat
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SavedSheet({ id }: { id: string }) {
  const gate = useSignedIn();
  const router = useRouter();
  const [row, setRow] = useState<(SheetRow & { data: SheetData }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (gate) return;
    getSupabase()
      .from("sheets")
      .select("id, kind, title, meta, created_at, updated_at, data")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(`Test se nepodařilo načíst: ${error.message}`);
        else if (!data) setError("Tento test v Kabinetu není.");
        else setRow(data);
      });
  }, [gate, id]);

  if (gate) return gate;
  if (error)
    return (
      <p className="rounded-xl bg-error-container px-4 py-3 text-on-error-container">
        {error}
      </p>
    );
  if (!row) return <Message>Načítám…</Message>;
  return (
    <Sheet
      result={row.data}
      id={row.id}
      meta={row.meta}
      onBack={() => router.push("/kabinet")}
      backLabel="Zpět do Kabinetu"
      onReplace={requestReplacement}
    />
  );
}
