'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  fetchHomeCardConfig,
  fetchUserHomeCardConfig,
  buildUserCardDefaults,
  setHomeCardVisibility,
  USER_CONFIGURABLE_CARD_KEYS,
  buildCardVisibilityMap,
  buildCardWidthMap,
  type HomeCardConfig,
  type HomeCardKey,
  type UserHomeCardConfig,
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

const USER_CONFIGURABLE_KEY_SET = new Set<HomeCardKey>(USER_CONFIGURABLE_CARD_KEYS);

const DEFAULT_CARD_ORDER: HomeCardKey[] = [
  'onboarding', 'nuvio_score', 'nuvio_score_standalone', 'quick_expense_action', 'streak_count',
  'budget_status', 'flow_savings', 'finance_grid', 'savings_investment',
  'overview_checkup', 'savings_goals', 'next_step', 'consumption_status',
];

function mergeUserCardDefaults(data: UserHomeCardConfig[]): UserHomeCardConfig[] {
  const defaults = buildUserCardDefaults();
  const merged = defaults.map(def => {
    const saved = data.find(item => item.card_key === def.card_key);
    return saved ?? def;
  });
  return merged.sort((a, b) => a.sort_order - b.sort_order);
}

export function useHomeCards(): HomeCardsState & HomeCardsActions {
  const [cardConfigs, setCardConfigs] = useState<HomeCardConfig[]>([]);
  const [userCardConfigs, setUserCardConfigs] = useState<UserHomeCardConfig[]>([]);
  const [togglingCard, setTogglingCard] = useState<string | null>(null);

  const cardVisibility = useMemo(() => {
    const visibility = buildCardVisibilityMap(cardConfigs);
    for (const cfg of userCardConfigs) {
      visibility[cfg.card_key] = visibility[cfg.card_key] !== false && cfg.is_visible;
    }
    return visibility;
  }, [cardConfigs, userCardConfigs]);

  const cardWidth = useMemo(() => buildCardWidthMap(cardConfigs), [cardConfigs]);
  const sortedCardKeys = useMemo<HomeCardKey[]>(
    () => {
      const baseKeys = (() => {
        if (cardConfigs.length === 0) return DEFAULT_CARD_ORDER;
        const configuredKeys = cardConfigs.map(c => c.card_key);
        const missingDefaults = DEFAULT_CARD_ORDER.filter(key => !configuredKeys.includes(key));
        return [...configuredKeys, ...missingDefaults];
      })();

      if (userCardConfigs.length === 0) return baseKeys;

      const userOrderedKeys = userCardConfigs.map(c => c.card_key);
      const firstUserCardIndex = baseKeys.findIndex(key => USER_CONFIGURABLE_KEY_SET.has(key));
      const insertIndex = firstUserCardIndex >= 0 ? firstUserCardIndex : 0;
      const nonUserKeys = baseKeys.filter(key => !USER_CONFIGURABLE_KEY_SET.has(key));
      return [
        ...nonUserKeys.slice(0, insertIndex),
        ...userOrderedKeys,
        ...nonUserKeys.slice(insertIndex),
      ];
    },
    [cardConfigs, userCardConfigs],
  );

  async function loadCardConfigs() {
    try {
      const [globalResult, userResult] = await Promise.allSettled([
        fetchHomeCardConfig(),
        fetchUserHomeCardConfig(),
      ]);

      if (globalResult.status === 'fulfilled') {
        setCardConfigs(globalResult.value);
      }
      if (userResult.status === 'fulfilled') {
        setUserCardConfigs(mergeUserCardDefaults(userResult.value));
      } else {
        setUserCardConfigs(buildUserCardDefaults());
      }
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
