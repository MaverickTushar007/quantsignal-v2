"use client";
import { useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
export interface AuthState {
  user: User | null;
  session: Session | null;
  isPro: boolean;
  loading: boolean;
}
export function useAuth(): AuthState {
  const [user,    setUser]    = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isPro,   setIsPro]   = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      checkPro(data.session?.user ?? null).finally(() => setLoading(false));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      checkPro(s?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  async function checkPro(u: User | null) {
    if (!u) { setIsPro(false); return; }
    try {
      const { data } = await supabase
        .from("profiles")
        .select("tier")
        .eq("id", u.id)
        .single();
      setIsPro(data?.tier === "pro" || data?.tier === "institutional");
    } catch {
      setIsPro(false); // table missing or error — default to free
    }
  }
  return { user, session, isPro, loading };
}
