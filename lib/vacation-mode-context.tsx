'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { VACATION_MODE_CHANGED_EVENT } from '@/lib/vacation-mode-events';
import { getActiveVacationMode, getPlannedVacationMode, type VacationMode } from '@/lib/vacation-mode-service';

interface VacationModeContextValue {
  activeVacationMode: VacationMode | null;
  plannedVacationMode: VacationMode | null;
  isVacationMode: boolean;
  isResolved: boolean;
  refreshVacationMode: () => Promise<VacationMode | null>;
}

const VacationModeContext = createContext<VacationModeContextValue>({
  activeVacationMode: null,
  plannedVacationMode: null,
  isVacationMode: false,
  isResolved: false,
  refreshVacationMode: async () => null,
});

export function VacationModeProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [activeVacationMode, setActiveVacationMode] = useState<VacationMode | null>(null);
  const [plannedVacationMode, setPlannedVacationMode] = useState<VacationMode | null>(null);
  const [isResolved, setIsResolved] = useState(false);

  const refreshVacationMode = useCallback(async () => {
    if (loading) return null;

    if (!user?.id) {
      setActiveVacationMode(null);
      setPlannedVacationMode(null);
      setIsResolved(true);
      return null;
    }

    try {
      const [activeVacation, plannedVacation] = await Promise.all([
        getActiveVacationMode(user.id),
        getPlannedVacationMode(user.id),
      ]);
      setActiveVacationMode(activeVacation);
      setPlannedVacationMode(plannedVacation);
      setIsResolved(true);
      return activeVacation;
    } catch (error) {
      console.warn('Kunne ikke hente aktiv feriekuvert', error);
      setActiveVacationMode(null);
      setPlannedVacationMode(null);
      setIsResolved(true);
      return null;
    }
  }, [loading, user?.id]);

  useEffect(() => {
    if (loading) return;
    refreshVacationMode();
  }, [loading, refreshVacationMode]);

  useEffect(() => {
    window.addEventListener(VACATION_MODE_CHANGED_EVENT, refreshVacationMode);
    return () => {
      window.removeEventListener(VACATION_MODE_CHANGED_EVENT, refreshVacationMode);
    };
  }, [refreshVacationMode]);

  const value = useMemo(
    () => ({
      activeVacationMode,
      plannedVacationMode,
      isVacationMode: Boolean(activeVacationMode),
      isResolved,
      refreshVacationMode,
    }),
    [activeVacationMode, plannedVacationMode, isResolved, refreshVacationMode],
  );

  return (
    <VacationModeContext.Provider value={value}>
      {children}
    </VacationModeContext.Provider>
  );
}

export function useVacationMode() {
  return useContext(VacationModeContext);
}
