'use client';

import { createContext, useContext } from 'react';
import type { HomeCardKey } from '@/lib/home-card-config';

interface HomeCardContextValue {
  isAdmin: boolean;
  cardVisibility: Record<string, boolean>;
  togglingCard: string | null;
  onToggleCard: (cardKey: HomeCardKey) => void;
}

const HomeCardContext = createContext<HomeCardContextValue>({
  isAdmin: false,
  cardVisibility: {},
  togglingCard: null,
  onToggleCard: () => {},
});

export function HomeCardProvider({
  children,
  isAdmin,
  cardVisibility,
  togglingCard,
  onToggleCard,
}: HomeCardContextValue & { children: React.ReactNode }) {
  return (
    <HomeCardContext.Provider value={{ isAdmin, cardVisibility, togglingCard, onToggleCard }}>
      {children}
    </HomeCardContext.Provider>
  );
}

export function useHomeCard() {
  return useContext(HomeCardContext);
}
