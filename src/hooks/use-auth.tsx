import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const Ctx = createContext<AuthState>({ session: null, user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let gotEvent = false;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      gotEvent = true;
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      // Don't clobber a session that onAuthStateChange already delivered.
      if (!gotEvent) {
        setSession(data.session);
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
