"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

type Auth = {
  /** False until Supabase variables are set; the app then works without login. */
  enabled: boolean;
  /** True while the stored session is being restored. */
  loading: boolean;
  session: Session | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth>({
  enabled: false,
  loading: false,
  session: null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = getSupabase();
    // Also completes a sign-in when the page opens from an e-mail link or Google/Microsoft.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await getSupabase().auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext value={{ enabled: supabaseConfigured, loading, session, signOut }}>{children}</AuthContext>
  );
}

export const useAuth = () => use(AuthContext);
