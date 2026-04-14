'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { AiContext } from '@/components/ai-assistant-button';

interface AiContextValue {
  aiContext: AiContext | undefined;
  setAiContext: (ctx: AiContext | undefined) => void;
  wizardActive: boolean;
  setWizardActive: (active: boolean) => void;
  isAiActive: boolean;
}

const AiContextCtx = createContext<AiContextValue>({
  aiContext: undefined,
  setAiContext: () => {},
  wizardActive: false,
  setWizardActive: () => {},
  isAiActive: false,
});

export function AiContextProvider({ children }: { children: ReactNode }) {
  const [aiContext, setAiContext] = useState<AiContext | undefined>(undefined);
  const [wizardActive, setWizardActive] = useState(false);
  const [isAiActive, setIsAiActive] = useState(false);

  useEffect(() => {
    supabase
      .from('ai_assistant_config')
      .select('is_active')
      .maybeSingle()
      .then(({ data }) => {
        if (data) setIsAiActive(data.is_active);
      });
  }, []);

  return (
    <AiContextCtx.Provider value={{ aiContext, setAiContext, wizardActive, setWizardActive, isAiActive }}>
      {children}
    </AiContextCtx.Provider>
  );
}

export function useAiContext() {
  return useContext(AiContextCtx);
}
