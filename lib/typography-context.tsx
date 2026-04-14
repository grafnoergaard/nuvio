'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  fetchTypographyTokens,
  bulkUpsertTypographyTokens,
  resetTypographyTokensToDefaults,
  tokenToCssVar,
  DEFAULT_TYPOGRAPHY_TOKENS,
  type TypographyToken,
} from './typography-tokens';

interface TypographyContextValue {
  tokens: Record<string, string>;
  tokenRows: TypographyToken[];
  loaded: boolean;
  previewToken: (key: string, value: string) => void;
  saveTokens: (current: Record<string, string>) => Promise<void>;
  previewReset: () => void;
  saveReset: () => Promise<void>;
}

const TypographyContext = createContext<TypographyContextValue>({
  tokens: DEFAULT_TYPOGRAPHY_TOKENS,
  tokenRows: [],
  loaded: false,
  previewToken: () => {},
  saveTokens: async () => {},
  previewReset: () => {},
  saveReset: async () => {},
});

export function TypographyProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokens] = useState<Record<string, string>>(DEFAULT_TYPOGRAPHY_TOKENS);
  const [tokenRows, setTokenRows] = useState<TypographyToken[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchTypographyTokens()
      .then((rows) => {
        if (rows.length > 0) {
          const map: Record<string, string> = { ...DEFAULT_TYPOGRAPHY_TOKENS };
          rows.forEach(r => { map[r.key] = r.value; });
          setTokens(map);
          setTokenRows(rows);
        }
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    Object.entries(tokens).forEach(([key, value]) => {
      root.style.setProperty(tokenToCssVar(key), value);
    });
  }, [tokens]);

  const previewToken = useCallback((key: string, value: string) => {
    setTokens(prev => ({ ...prev, [key]: value }));
  }, []);

  const saveTokens = useCallback(async (current: Record<string, string>) => {
    await bulkUpsertTypographyTokens(
      Object.entries(current).map(([key, value]) => ({ key, value }))
    );
  }, []);

  const previewReset = useCallback(() => {
    setTokens({ ...DEFAULT_TYPOGRAPHY_TOKENS });
  }, []);

  const saveReset = useCallback(async () => {
    await resetTypographyTokensToDefaults();
    const rows = await fetchTypographyTokens();
    const map: Record<string, string> = { ...DEFAULT_TYPOGRAPHY_TOKENS };
    rows.forEach(r => { map[r.key] = r.value; });
    setTokens(map);
    setTokenRows(rows);
  }, []);

  return (
    <TypographyContext.Provider value={{
      tokens,
      tokenRows,
      loaded,
      previewToken,
      saveTokens,
      previewReset,
      saveReset,
    }}>
      {children}
    </TypographyContext.Provider>
  );
}

export function useTypography() {
  return useContext(TypographyContext);
}
