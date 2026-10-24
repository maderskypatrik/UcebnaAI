"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { takeReturn } from "@/lib/return-to";
import { getSupabase, oauthProviders } from "@/lib/supabase";
import { AssistantButton } from "./AssistantButton";
import { useAuth } from "./AuthProvider";

const PROVIDER_LABELS = { google: "Pokračovat přes Google", azure: "Pokračovat přes Microsoft" };

export function LoginForm() {
  const { enabled, session } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed in (also right after returning from Google or Microsoft): continue where the teacher was going.
  useEffect(() => {
    if (session) router.replace(takeReturn());
  }, [session, router]);

  if (!enabled) {
    return <p className="text-body-lg text-on-surface-variant">Přihlašování zatím není zapnuté.</p>;
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/prihlaseni` },
    });
    setBusy(false);
    if (error) setError(`Odkaz se nepodařilo odeslat: ${error.message}`);
    else setSent(true);
  }

  async function signInWith(provider: "google" | "azure") {
    setError(null);
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/prihlaseni`,
        scopes: provider === "azure" ? "email" : undefined,
      },
    });
    if (error) setError(`Přihlášení se nepovedlo: ${error.message}`);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-title-lg font-bold text-on-surface">Zkontrolujte e-mail</h2>
        <p className="text-body-lg text-on-surface-variant">
          Na adresu <strong className="text-on-surface">{email}</strong> jsme poslali odkaz pro přihlášení. Otevřete ho
          ve stejném prohlížeči, heslo není potřeba. Pokud e-mail nevidíte, podívejte se do spamu.
        </p>
        <button type="button" onClick={() => setSent(false)} className="self-start text-sm font-medium text-primary-container">
          Zadat jinou adresu
        </button>
      </div>
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-8">
      {oauthProviders.length > 0 && (
        <div className="flex flex-col gap-3">
          {oauthProviders.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => signInWith(p)}
              className="rounded-xl bg-surface-container-low px-6 py-3 font-medium text-on-surface transition-colors hover:bg-surface-container"
            >
              {PROVIDER_LABELS[p]}
            </button>
          ))}
          <p className="text-center text-label-md text-on-surface-variant">nebo e-mailem</p>
        </div>
      )}
      <form onSubmit={sendLink} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-label-md text-on-surface-variant">Školní nebo osobní e-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jmeno@skola.cz"
            className="rounded-xl bg-surface-container-low px-4 py-3 text-body-lg text-on-surface outline-none focus:bg-surface-container"
          />
        </label>
        <AssistantButton type="submit" disabled={busy || !email.trim()}>
          {busy ? "Odesílám…" : "Poslat přihlašovací odkaz"}
        </AssistantButton>
        {error && <p className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container">{error}</p>}
      </form>
      <p className="text-label-md text-on-surface-variant">
        Jak nakládáme s vaším e-mailem a testy, popisuje{" "}
        <Link href="/ochrana-osobnich-udaju" className="font-medium text-primary-container">
          ochrana osobních údajů
        </Link>
        .
      </p>
    </div>
  );
}
