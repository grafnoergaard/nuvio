'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';

interface UIStringsContextValue {
  getString: (key: string, fallback: string) => string;
  updateString: (key: string, value: string) => Promise<void>;
  loaded: boolean;
}

const UIStringsContext = createContext<UIStringsContextValue>({
  getString: (_key, fallback) => fallback,
  updateString: async () => {},
  loaded: false,
});

export function UIStringsProvider({ children }: { children: React.ReactNode }) {
  const [strings, setStrings] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from('ui_strings')
      .select('key, value')
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((row) => { map[row.key] = row.value; });
          setStrings(map);
        }
        setLoaded(true);
      });
  }, []);

  const getString = useCallback((key: string, fallback: string): string => {
    return strings[key] ?? fallback;
  }, [strings]);

  const updateString = useCallback(async (key: string, value: string): Promise<void> => {
    const { data: existing } = await supabase
      .from('ui_strings')
      .select('id')
      .eq('key', key)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from('ui_strings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key));
    } else {
      ({ error } = await supabase
        .from('ui_strings')
        .insert({ key, value }));
    }

    if (!error) {
      setStrings((prev) => ({ ...prev, [key]: value }));
    } else {
      throw error;
    }
  }, []);

  return (
    <UIStringsContext.Provider value={{ getString, updateString, loaded }}>
      {children}
    </UIStringsContext.Provider>
  );
}

export function useUIStrings() {
  return useContext(UIStringsContext);
}
