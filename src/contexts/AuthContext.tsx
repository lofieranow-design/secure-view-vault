import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAdmin = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });

      const admin = !error && !!data;
      setIsAdmin(admin);
      return admin;
    } catch {
      setIsAdmin(false);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const syncAuthState = async (nextSession: Session | null) => {
      if (!mounted) return;

      // Mark loading BEFORE async work so consumers wait for the result
      setIsLoading(true);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      try {
        if (nextSession?.user) {
          await checkAdmin(nextSession.user.id);
        } else {
          setIsAdmin(false);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncAuthState(nextSession);
    });

    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => syncAuthState(session))
      .catch(() => {
        if (!mounted) return;
        setUser(null);
        setSession(null);
        setIsAdmin(false);
        setIsLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
