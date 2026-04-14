import { supabase } from './supabase';

export type NudgeLevel = 'NONE' | 'SOFT' | 'STRONG' | 'REACTIVATE';
export type CheckupVariant = 'QUICK' | 'STANDARD' | 'DEEP';

export interface CheckupTriggerSettings {
  id: string;
  soft_days: number;
  strong_days: number;
  reactivate_days: number;
  soft_min_completion: number;
  strong_min_completion: number;
  reactivate_min_completion: number;
  banner_cooldown_soft_days: number;
  banner_cooldown_strong_days: number;
  modal_cooldown_hours: number;
  modal_enabled: boolean;
  badge_enabled: boolean;
  allow_snooze: boolean;
  snooze_days: number;
  hard_snooze_days: number;
  min_activity_days: number;
  min_sessions_soft: number;
  skip_if_onboarding_incomplete: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface CheckupUserState {
  id?: string;
  budget_id: string;
  user_id: string;
  last_prompted_at: string | null;
  last_modal_shown_at: string | null;
  last_banner_shown_at: string | null;
  snoozed_until: string | null;
  last_checkup_completed_at: string | null;
  impressions_7d: number;
  current_level: NudgeLevel;
}

export interface TriggerResult {
  level: NudgeLevel;
  showModal: boolean;
  showBanner: boolean;
  showBadge: boolean;
  variant: CheckupVariant;
  snoozeDays: number;
  hardSnoozeDays: number;
  allowSnooze: boolean;
}

function daysBetween(a: string | null, b: Date = new Date()): number | null {
  if (!a) return null;
  const ms = b.getTime() - new Date(a).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function hoursBetween(a: string | null, b: Date = new Date()): number | null {
  if (!a) return null;
  const ms = b.getTime() - new Date(a).getTime();
  return Math.floor(ms / (1000 * 60 * 60));
}

export const DEFAULT_TRIGGER_SETTINGS: CheckupTriggerSettings = {
  id: '',
  soft_days: 30,
  strong_days: 60,
  reactivate_days: 90,
  soft_min_completion: 70,
  strong_min_completion: 50,
  reactivate_min_completion: 30,
  banner_cooldown_soft_days: 7,
  banner_cooldown_strong_days: 3,
  modal_cooldown_hours: 24,
  modal_enabled: true,
  badge_enabled: true,
  allow_snooze: true,
  snooze_days: 7,
  hard_snooze_days: 30,
  min_activity_days: 180,
  min_sessions_soft: 2,
  skip_if_onboarding_incomplete: true,
  updated_by: null,
  updated_at: new Date().toISOString(),
};

export async function loadTriggerSettings(): Promise<CheckupTriggerSettings> {
  try {
    const { data } = await supabase
      .from('mini_checkup_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    return data ?? DEFAULT_TRIGGER_SETTINGS;
  } catch {
    return DEFAULT_TRIGGER_SETTINGS;
  }
}

export async function loadUserState(budgetId: string, userId: string): Promise<CheckupUserState | null> {
  try {
    const { data } = await supabase
      .from('mini_checkup_user_state')
      .select('*')
      .eq('budget_id', budgetId)
      .eq('user_id', userId)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

export async function upsertUserState(state: Partial<CheckupUserState> & { budget_id: string; user_id: string }): Promise<void> {
  try {
    await supabase
      .from('mini_checkup_user_state')
      .upsert({ ...state, updated_at: new Date().toISOString() }, { onConflict: 'budget_id,user_id' });
  } catch {
  }
}

export function evaluateTrigger(opts: {
  settings: CheckupTriggerSettings;
  userState: CheckupUserState | null;
  daysSinceUpdate: number | null;
  completionScore: number;
  onboardingComplete: boolean;
  lastLoginAt: string | null;
  sessionsLast30d: number;
}): TriggerResult {
  const { settings, userState, daysSinceUpdate, completionScore, onboardingComplete, lastLoginAt, sessionsLast30d } = opts;
  const now = new Date();

  const noTrigger: TriggerResult = {
    level: 'NONE',
    showModal: false,
    showBanner: false,
    showBadge: false,
    variant: 'QUICK',
    snoozeDays: settings.snooze_days,
    hardSnoozeDays: settings.hard_snooze_days,
    allowSnooze: settings.allow_snooze,
  };

  if (settings.skip_if_onboarding_incomplete && !onboardingComplete) return noTrigger;

  const activityDays = daysBetween(lastLoginAt);
  if (activityDays !== null && activityDays > settings.min_activity_days) return noTrigger;

  if (userState?.snoozed_until && new Date(userState.snoozed_until) > now) return noTrigger;

  if (daysSinceUpdate === null) return noTrigger;

  let level: NudgeLevel = 'NONE';
  let variant: CheckupVariant = 'QUICK';

  if (daysSinceUpdate >= settings.reactivate_days && completionScore >= settings.reactivate_min_completion) {
    level = 'REACTIVATE';
    variant = 'DEEP';
  } else if (daysSinceUpdate >= settings.strong_days && completionScore >= settings.strong_min_completion) {
    level = 'STRONG';
    variant = 'STANDARD';
  } else if (daysSinceUpdate >= settings.soft_days && completionScore >= settings.soft_min_completion && sessionsLast30d >= settings.min_sessions_soft) {
    level = 'SOFT';
    variant = 'QUICK';
  }

  if (level === 'NONE') return noTrigger;

  const cooldownDays = level === 'SOFT' ? settings.banner_cooldown_soft_days : settings.banner_cooldown_strong_days;
  const daysSinceBanner = daysBetween(userState?.last_banner_shown_at ?? null);
  const hoursSinceModal = hoursBetween(userState?.last_modal_shown_at ?? null);

  const bannerAllowed = daysSinceBanner === null || daysSinceBanner >= cooldownDays;
  const modalAllowed = (hoursSinceModal === null || hoursSinceModal >= settings.modal_cooldown_hours) && settings.modal_enabled;

  const showBadge = settings.badge_enabled && (level === 'STRONG' || level === 'REACTIVATE');
  const showBanner = bannerAllowed;
  const showModal = modalAllowed && (level === 'STRONG' || level === 'REACTIVATE');

  if (!showBanner && !showModal && !showBadge) return noTrigger;

  return {
    level,
    showModal,
    showBanner,
    showBadge,
    variant,
    snoozeDays: settings.snooze_days,
    hardSnoozeDays: settings.hard_snooze_days,
    allowSnooze: settings.allow_snooze,
  };
}
