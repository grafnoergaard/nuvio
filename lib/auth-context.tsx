'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
});

function getIsAdmin(user: User | null): boolean {
  return user?.app_metadata?.is_admin === true || user?.app_metadata?.role === 'admin';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let hasResolvedInitialSession = false;

    const loadingFallback = window.setTimeout(() => {
      if (!mounted || hasResolvedInitialSession) return;
      console.warn('Supabase session check timed out. Releasing auth loading state.');
      setSession(null);
      setUser(null);
      setLoading(false);
    }, 5000);

    function finishSessionLoad(nextSession: Session | null) {
      if (!mounted) return;
      hasResolvedInitialSession = true;
      window.clearTimeout(loadingFallback);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      finishSessionLoad(session);
    }).catch((error) => {
      console.warn('Supabase session check failed.', error);
      finishSessionLoad(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      finishSessionLoad(session);
    });

    return () => {
      mounted = false;
      window.clearTimeout(loadingFallback);
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-')) localStorage.removeItem(key);
      });
      window.location.replace('/login');
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin: getIsAdmin(user), signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
