'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'nuvio-typo-inspector';

interface TypographyInspectorContextValue {
  active: boolean;
  toggle: () => void;
}

const TypographyInspectorContext = createContext<TypographyInspectorContextValue>({
  active: false,
  toggle: () => {},
});

export function TypographyInspectorProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') setActive(true);
  }, []);

  function toggle() {
    setActive(prev => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <TypographyInspectorContext.Provider value={{ active, toggle }}>
      {children}
    </TypographyInspectorContext.Provider>
  );
}

export function useTypographyInspector() {
  return useContext(TypographyInspectorContext);
}
