'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  fetchHomeCardConfig,
  setHomeCardVisibility,
  buildCardVisibilityMap,
  buildCardWidthMap,
  type HomeCardConfig,
  type HomeCardKey,
} from '@/lib/home-card-config';

export interface HomeCardsState {
  cardConfigs: HomeCardConfig[];
  togglingCard: string | null;
  cardVisibility: Record<string, boolean>;
  cardWidth: Record<string, 'full' | 'half'>;
  sortedCardKeys: HomeCardKey[];
}

export interface HomeCardsActions {
  loadCardConfigs: () => Promise<void>;
  handleToggleCard: (cardKey: HomeCardKey) => Promise<void>;
}

const DEFAULT_CARD_ORDER: HomeCardKey[] = [
  'onboarding', 'nuvio_score', 'finance_grid', 'savings_investment',
  'overview_checkup', 'savings_goals', 'next_step', 'consumption_status',
];

export function useHomeCards(): HomeCardsState & HomeCardsActions {
  const [cardConfigs, setCardConfigs] = useState<HomeCardConfig[]>([]);
  const [togglingCard, setTogglingCard] = useState<string | null>(null);

  const cardVisibility = useMemo(() => buildCardVisibilityMap(cardConfigs), [cardConfigs]);
  const cardWidth = useMemo(() => buildCardWidthMap(cardConfigs), [cardConfigs]);
  const sortedCardKeys = useMemo<HomeCardKey[]>(
    () => cardConfigs.length > 0 ? cardConfigs.map(c => c.card_key) : DEFAULT_CARD_ORDER,
    [cardConfigs],
  );

  async function loadCardConfigs() {
    try {
      const configs = await fetchHomeCardConfig();
      setCardConfigs(configs);
    } catch {
    }
  }

  async function handleToggleCard(cardKey: HomeCardKey) {
    const cfg = cardConfigs.find(c => c.card_key === cardKey);
    if (!cfg) return;
    const next = !cfg.is_visible;
    setTogglingCard(cardKey);
    try {
      await setHomeCardVisibility(cfg.id, next);
      setCardConfigs(prev => prev.map(c => c.card_key === cardKey ? { ...c, is_visible: next } : c));
      toast.success(next ? `${cfg.label} vist` : `${cfg.label} skjult`);
    } catch {
      toast.error('Kunne ikke ændre synlighed');
    } finally {
      setTogglingCard(null);
    }
  }

  return {
    cardConfigs,
    togglingCard,
    cardVisibility,
    cardWidth,
    sortedCardKeys,
    loadCardConfigs,
    handleToggleCard,
  };
}
