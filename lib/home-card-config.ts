import { supabase } from './supabase';

export const USER_CONFIGURABLE_CARD_KEYS = ['nuvio_score_standalone', 'quick_expense_action', 'budget_status', 'flow_savings', 'streak_count'] as const;
export type UserConfigurableCardKey = typeof USER_CONFIGURABLE_CARD_KEYS[number];

export interface UserHomeCardConfig {
  id: string;
  user_id: string;
  card_key: UserConfigurableCardKey;
  is_visible: boolean;
  sort_order: number;
}

export const USER_CARD_LABELS: Record<UserConfigurableCardKey, string> = {
  nuvio_score_standalone: 'Din Score',
  quick_expense_action: 'Tilføj udgift',
  budget_status: 'Udgifter',
  flow_savings: 'Sparet',
  streak_count: 'Streak Count',
};

export const USER_CARD_DESCRIPTIONS: Record<UserConfigurableCardKey, string> = {
  nuvio_score_standalone: 'Din daglige stræk og finansielle score',
  quick_expense_action: 'Mini-knap til hurtig registrering af udgifter',
  budget_status: 'Rådighedsbeløb, score og ugebudget',
  flow_savings: 'Penge sparet via Udgifter',
  streak_count: 'Din aktive udgifts-streak',
};

export async function fetchUserHomeCardConfig(): Promise<UserHomeCardConfig[]> {
  const { data, error } = await supabase
    .from('user_home_card_config')
    .select('id, user_id, card_key, is_visible, sort_order')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as UserHomeCardConfig[];
}

export async function upsertUserHomeCardConfig(
  updates: Array<{ card_key: UserConfigurableCardKey; is_visible: boolean; sort_order: number }>
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const now = new Date().toISOString();
  const rows = updates.map(u => ({
    user_id: user.id,
    card_key: u.card_key,
    is_visible: u.is_visible,
    sort_order: u.sort_order,
    updated_at: now,
  }));
  const { error } = await supabase
    .from('user_home_card_config')
    .upsert(rows, { onConflict: 'user_id,card_key' });
  if (error) throw error;
}

export function buildUserCardDefaults(): UserHomeCardConfig[] {
  return USER_CONFIGURABLE_CARD_KEYS.map((key, index) => ({
    id: '',
    user_id: '',
    card_key: key,
    is_visible: true,
    sort_order: (index + 1) * 10,
  }));
}

export type HomeCardKey =
  | 'onboarding'
  | 'nuvio_score'
  | 'nuvio_score_standalone'
  | 'finance_grid'
  | 'savings_investment'
  | 'overview_checkup'
  | 'savings_goals'
  | 'next_step'
  | 'consumption_status'
  | 'budget_status'
  | 'flow_savings'
  | 'streak_count'
  | 'quick_expense_action';

export type HomeCardWidth = 'full' | 'half';

export interface HomeCardConfig {
  id: string;
  card_key: HomeCardKey;
  label: string;
  is_visible: boolean;
  sort_order: number;
  width: HomeCardWidth;
}

export async function fetchHomeCardConfig(): Promise<HomeCardConfig[]> {
  const { data, error } = await supabase
    .from('home_card_config')
    .select('id, card_key, label, is_visible, sort_order, width')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as HomeCardConfig[];
}

export async function setHomeCardVisibility(id: string, isVisible: boolean): Promise<void> {
  const { error } = await supabase
    .from('home_card_config')
    .update({ is_visible: isVisible, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function setHomeCardVisibilityByKey(cardKey: HomeCardKey, isVisible: boolean): Promise<void> {
  const { error } = await supabase
    .from('home_card_config')
    .update({ is_visible: isVisible, updated_at: new Date().toISOString() })
    .eq('card_key', cardKey);
  if (error) throw error;
}

export async function setHomeCardWidth(id: string, width: HomeCardWidth): Promise<void> {
  const { error } = await supabase
    .from('home_card_config')
    .update({ width, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function setHomeCardSortOrder(id: string, sortOrder: number): Promise<void> {
  const { error } = await supabase
    .from('home_card_config')
    .update({ sort_order: sortOrder, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function bulkUpdateHomeCardConfig(
  updates: Array<{ id: string; sort_order: number; is_visible: boolean; width: HomeCardWidth }>
): Promise<void> {
  const now = new Date().toISOString();
  const promises = updates.map(({ id, sort_order, is_visible, width }) =>
    supabase
      .from('home_card_config')
      .update({ sort_order, is_visible, width, updated_at: now })
      .eq('id', id)
  );
  const results = await Promise.all(promises);
  const failed = results.find(r => r.error);
  if (failed?.error) throw failed.error;
}

export function buildCardVisibilityMap(configs: HomeCardConfig[]): Record<HomeCardKey, boolean> {
  const defaults: Record<HomeCardKey, boolean> = {
    onboarding: true,
    nuvio_score: true,
    nuvio_score_standalone: true,
    finance_grid: true,
    savings_investment: true,
    overview_checkup: true,
    savings_goals: true,
    next_step: true,
    consumption_status: true,
    budget_status: false,
    flow_savings: true,
    streak_count: true,
    quick_expense_action: true,
  };
  for (const cfg of configs) {
    defaults[cfg.card_key] = cfg.is_visible;
  }
  return defaults;
}

export function buildCardWidthMap(configs: HomeCardConfig[]): Record<HomeCardKey, HomeCardWidth> {
  const defaults: Record<HomeCardKey, HomeCardWidth> = {
    onboarding: 'full',
    nuvio_score: 'full',
    nuvio_score_standalone: 'full',
    finance_grid: 'full',
    savings_investment: 'full',
    overview_checkup: 'full',
    savings_goals: 'full',
    next_step: 'full',
    consumption_status: 'full',
    budget_status: 'full',
    flow_savings: 'full',
    streak_count: 'full',
    quick_expense_action: 'full',
  };
  for (const cfg of configs) {
    defaults[cfg.card_key] = cfg.width ?? 'full';
  }
  return defaults;
}
