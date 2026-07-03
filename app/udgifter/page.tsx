'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Trash2, Settings2, X, ChevronLeft, ChevronRight, Receipt, CalendarDays, TrendingDown, TriangleAlert as AlertTriangle, Info, Crown, Sparkles, Star, Gauge, Flame, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { useSettings, getCardStyle, getTopBarStyle } from '@/lib/settings-context';
import { getVacationAccentColor, getVacationCardSurfaceStyle, getVacationTopBarCard, withAlpha } from '@/lib/vacation-theme';
import { useVacationMode } from '@/lib/vacation-mode-context';
import { getNormalUntilVacationPeriod } from '@/lib/normal-until-vacation';
import { type FlowAiContext } from '@/components/ai-assistant-button';
import { useAiContext } from '@/lib/ai-context';
import {
  getQuickExpensesForMonth,
  getQuickExpensesForVacationMode,
  deleteQuickExpense,
  getMonthlyBudget,
  upsertMonthlyBudget,
  hasAcknowledgedTransition,
  acknowledgeMonthTransition,
  getPreviousMonthSummary,
  getStreak,
  evaluateAndUpdateStreak,
  backfillStreakFromHistory,
  computeWeeklyCarryOver,
  updateWeeklyCarryOver,
  getUserWeekStartDay,
  QuickExpense,
  MonthSummary,
  QuickExpenseStreak,
  WeeklyCarryOverSummary,
} from '@/lib/quick-expense-service';
import { getVacationBudgetDayStatuses } from '@/lib/vacation-budget';
import { supabase } from '@/lib/supabase';
import MonthTransitionModal from '@/components/month-transition-modal';
import StreakBadge from '@/components/streak-badge';
import EditExpenseModal from '@/components/edit-expense-modal';
import NuvioFlowGuideModal from '@/components/nuvio-flow-guide-modal';
import { toKuvertCopy } from '@/lib/kuvert-copy';
import { addDaysToIsoDate, upsertPlannedVacationMode } from '@/lib/vacation-mode-service';

const GUIDE_SEEN_KEY = 'nuvio_flow_guide_seen_v1';

interface FlowStatusConfig {
  warnHealthMin: number;
  kursenHealthMin: number;
  tempoHealthMin: number;
  flowHealthMin: number;
  badgeOver: string;
  badgeWarn: string;
  badgeKursen: string;
  badgeTempo: string;
  badgeFlow: string;
  headlineOver: string;
  headlineWarn: string;
  headlineKursen: string;
  headlineTempo: string;
  headlineFlow: string;
  colorOverBadge: string;
  colorWarnBadge: string;
  colorKursenBadge: string;
  colorTempoBadge: string;
  colorFlowBadge: string;
  colorOverCard: string;
  colorWarnCard: string;
  colorGoodCard: string;
  colorFlowCard: string;
}

const FLOW_STATUS_DEFAULTS: FlowStatusConfig = {
  warnHealthMin: 30,
  kursenHealthMin: 0,
  tempoHealthMin: 60,
  flowHealthMin: 80,
  badgeOver: 'Over budget',
  badgeWarn: 'Stram op',
  badgeKursen: 'Hold kursen',
  badgeTempo: 'Godt tempo',
  badgeFlow: 'Udgifter',
  headlineOver: 'Du har overskredet dit budget',
  headlineWarn: 'Hold igen på forbruget',
  headlineKursen: 'Du er på rette spor',
  headlineTempo: 'Du klarer det fremragende',
  headlineFlow: 'Du har styr på udgifterne',
  colorOverBadge: 'bg-red-500',
  colorWarnBadge: 'bg-amber-500',
  colorKursenBadge: 'bg-emerald-500',
  colorTempoBadge: 'bg-emerald-500',
  colorFlowBadge: 'bg-amber-500',
  colorOverCard: 'bg-gradient-to-br from-red-50 via-rose-50/60 to-white border-red-200/60',
  colorWarnCard: 'bg-gradient-to-br from-amber-50 via-orange-50/40 to-white border-amber-200/60',
  colorGoodCard: 'bg-gradient-to-br from-emerald-50/80 via-teal-50/30 to-white border-emerald-200/50',
  colorFlowCard: 'bg-gradient-to-br from-slate-50 via-gray-50/80 to-white border-yellow-300/40',
};

interface NuvioFlowCacheData {
  expenses: QuickExpense[];
  monthlyBudget: number;
  variableEstimate: number | null;
  prevSummary: MonthSummary | null;
  streak: QuickExpenseStreak | null;
  lastKnownBudget: number;
  flowScoreThreshold: number;
  flowStatusConfig: FlowStatusConfig;
  weeklyStatus: WeeklyCarryOverSummary | null;
  weekStartDay: number;
}

const NUVIO_FLOW_CACHE_TTL = 60_000;
const nuvioFlowCache = new Map<string, { at: number; data: NuvioFlowCacheData }>();

function getNuvioFlowCache(key: string | null): NuvioFlowCacheData | null {
  if (!key) return null;
  const cached = nuvioFlowCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.at > NUVIO_FLOW_CACHE_TTL) {
    nuvioFlowCache.delete(key);
    return null;
  }
  return cached.data;
}

const DANISH_MONTHS = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
];

function formatDKK(value: number): string {
  return value.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function extractBadgeHex(badgeValue: string): string | null {
  const m = badgeValue.match(/bg-\[([^\]]+)\]/);
  return m ? m[1] : null;
}

function badgeHexToCardStyle(hex: string): React.CSSProperties {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const tint = `rgba(${r},${g},${b},0.10)`;
  const tintMid = `rgba(${r},${g},${b},0.04)`;
  return {
    background: `linear-gradient(to bottom right, ${tint}, ${tintMid}, #ffffff)`,
    borderColor: `rgba(${r},${g},${b},0.20)`,
  };
}

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(d)}. ${DANISH_MONTHS[parseInt(m) - 1]}`;
}

function parseDateStringLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getDaysLeftInRange(endDate: string, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = parseDateStringLocal(endDate);
  return Math.max(0, Math.floor((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)) + 1);
}

function formatShortDate(date: Date): string {
  const d = date.getDate();
  const m = DANISH_MONTHS[date.getMonth()].slice(0, 3);
  return `${d}. ${m}`;
}

function getPrevMonthRef(year: number, month: number): { year: number; month: number } {
  const d = new Date(year, month - 2, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function NuvioFlowPage() {
  const { user } = useAuth();
  const { activeVacationMode, plannedVacationMode, isResolved: vacationModeResolved } = useVacationMode();
  const { design } = useSettings();
  const { setAiContext, setWizardActive } = useAiContext();
  const now = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [expenses, setExpenses] = useState<QuickExpense[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBudgetEditor, setShowBudgetEditor] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<QuickExpense | null>(null);
  const [variableEstimate, setVariableEstimate] = useState<number | null>(null);

  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [prevSummary, setPrevSummary] = useState<MonthSummary | null>(null);
  const [streak, setStreak] = useState<QuickExpenseStreak | null>(null);
  const [lastKnownBudget, setLastKnownBudget] = useState<number>(0);
  const [flowScoreThreshold, setFlowScoreThreshold] = useState<number>(0.15);
  const [flowStatusConfig, setFlowStatusConfig] = useState<FlowStatusConfig>(FLOW_STATUS_DEFAULTS);
  const [weeklyStatus, setWeeklyStatus] = useState<WeeklyCarryOverSummary | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showStreakPopup, setShowStreakPopup] = useState(false);
  const [weekStartDay, setWeekStartDay] = useState<number>(1);

  useEffect(() => {
    setWizardActive(showGuide);
    return () => setWizardActive(false);
  }, [showGuide, setWizardActive]);

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1;
  const isVacationMode = Boolean(activeVacationMode);
  const isCurrentPeriod = isVacationMode || isCurrentMonth;
  const normalUntilVacationPeriod = useMemo(
    () => !activeVacationMode ? getNormalUntilVacationPeriod(plannedVacationMode ?? null, viewYear, viewMonth, now) : null,
    [activeVacationMode, plannedVacationMode, viewYear, viewMonth, now],
  );
  const flowCacheKey = user
    ? `${user.id}:${viewYear}-${viewMonth}:${activeVacationMode?.id ?? 'normal'}:${normalUntilVacationPeriod?.endDate ?? 'full'}`
    : null;
  const vacationPeriodLabel = activeVacationMode
    ? `${formatDate(activeVacationMode.start_date)} - ${formatDate(activeVacationMode.end_date)}`
    : '';

  const load = useCallback(async () => {
    if (!user) return;
    const cached = getNuvioFlowCache(flowCacheKey);
    if (cached) {
      setExpenses(cached.expenses);
      setMonthlyBudget(cached.monthlyBudget);
      setVariableEstimate(cached.variableEstimate);
      setPrevSummary(cached.prevSummary);
      setStreak(cached.streak);
      setLastKnownBudget(cached.lastKnownBudget);
      setFlowScoreThreshold(cached.flowScoreThreshold);
      setFlowStatusConfig(cached.flowStatusConfig);
      setWeeklyStatus(cached.weeklyStatus);
      setWeekStartDay(cached.weekStartDay);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const curYear = now.getFullYear();
      const curMonth = now.getMonth() + 1;
      const prev = getPrevMonthRef(curYear, curMonth);

      const [exps, budget, streakData, flowConfigEntries, userWeekStartDay, householdData, backfillResult] = await Promise.all([
        activeVacationMode
          ? getQuickExpensesForVacationMode(activeVacationMode.id, activeVacationMode.start_date, activeVacationMode.end_date)
          : getQuickExpensesForMonth(viewYear, viewMonth),
        getMonthlyBudget(viewYear, viewMonth),
        getStreak(),
        supabase
          .from('standard_data_entries')
          .select('key, value_numeric, value_text')
          .eq('section', 'nuvio_flow'),
        getUserWeekStartDay(),
        supabase
          .from('household')
          .select('variable_expense_estimate')
          .eq('user_id', user.id)
          .maybeSingle(),
        backfillStreakFromHistory().catch(() => null),
      ]);

      setExpenses(exps);
      const budgetAmount = activeVacationMode ? Number(activeVacationMode.budget_amount) : (budget?.budget_amount ?? 0);
      setMonthlyBudget(budgetAmount);
      setWeekStartDay(userWeekStartDay);

      const finalStreak = backfillResult?.finalStreak ?? streakData;
      setStreak(finalStreak);

      // Load Variable Udgifter estimate
      if (householdData.data?.variable_expense_estimate != null) {
        setVariableEstimate(Number(householdData.data.variable_expense_estimate));
      }

      if (flowConfigEntries.data && flowConfigEntries.data.length > 0) {
        const m = new Map(flowConfigEntries.data.map(e => [e.key, e]));
        setFlowScoreThreshold(m.get('NUVIO_FLOW_SCORE_PERFECT_THRESHOLD')?.value_numeric ?? 0.15);
        const n = (key: string, fallback: number) => m.get(key)?.value_numeric ?? fallback;
        const t = (key: string, fallback: string) => toKuvertCopy(m.get(key)?.value_text ?? fallback);
        const d = FLOW_STATUS_DEFAULTS;
        setFlowStatusConfig({
          warnHealthMin: n('FLOW_STATUS_WARN_HEALTH_MIN', d.warnHealthMin),
          kursenHealthMin: n('FLOW_STATUS_KURSEN_HEALTH_MIN', d.kursenHealthMin),
          tempoHealthMin: n('FLOW_STATUS_TEMPO_HEALTH_MIN', d.tempoHealthMin),
          flowHealthMin: n('FLOW_STATUS_FLOW_HEALTH_MIN', d.flowHealthMin),
          badgeOver: t('FLOW_BADGE_OVER', d.badgeOver),
          badgeWarn: t('FLOW_BADGE_WARN', d.badgeWarn),
          badgeKursen: t('FLOW_BADGE_KURSEN', d.badgeKursen),
          badgeTempo: t('FLOW_BADGE_TEMPO', d.badgeTempo),
          badgeFlow: t('FLOW_BADGE_FLOW', d.badgeFlow),
          headlineOver: t('FLOW_HEADLINE_OVER', d.headlineOver),
          headlineWarn: t('FLOW_HEADLINE_WARN', d.headlineWarn),
          headlineKursen: t('FLOW_HEADLINE_KURSEN', d.headlineKursen),
          headlineTempo: t('FLOW_HEADLINE_TEMPO', d.headlineTempo),
          headlineFlow: t('FLOW_HEADLINE_FLOW', d.headlineFlow),
          colorOverBadge: t('FLOW_COLOR_OVER_BADGE', d.colorOverBadge),
          colorWarnBadge: t('FLOW_COLOR_WARN_BADGE', d.colorWarnBadge),
          colorKursenBadge: t('FLOW_COLOR_KURSEN_BADGE', d.colorKursenBadge),
          colorTempoBadge: t('FLOW_COLOR_TEMPO_BADGE', d.colorTempoBadge),
          colorFlowBadge: t('FLOW_COLOR_FLOW_BADGE', d.colorFlowBadge),
          colorOverCard: t('FLOW_COLOR_OVER_CARD', d.colorOverCard),
          colorWarnCard: t('FLOW_COLOR_WARN_CARD', d.colorWarnCard),
          colorGoodCard: t('FLOW_COLOR_GOOD_CARD', d.colorGoodCard),
          colorFlowCard: t('FLOW_COLOR_FLOW_CARD', d.colorFlowCard),
        });
      }

      if (!activeVacationMode && budgetAmount > 0) {
        const weekly = computeWeeklyCarryOver(budgetAmount, viewYear, viewMonth, exps, now, userWeekStartDay, {
          periodStartDate: normalUntilVacationPeriod?.startDate,
          periodEndDate: normalUntilVacationPeriod?.endDate,
        });
        setWeeklyStatus(weekly);

        if (isCurrentMonth) {
          updateWeeklyCarryOver(viewYear, viewMonth, weekly.accumulatedCarryOver).catch(() => null);
        }
      } else {
        setWeeklyStatus(null);
      }

      if (!activeVacationMode && isCurrentMonth) {
        const [acknowledged, summary, prevBudget] = await Promise.all([
          hasAcknowledgedTransition(curYear, curMonth),
          getPreviousMonthSummary(curYear, curMonth),
          getMonthlyBudget(prev.year, prev.month),
        ]);

        setPrevSummary(summary);
        setLastKnownBudget(prevBudget?.budget_amount ?? 0);

        if (!acknowledged) {
          const prevUsageRatio = summary.budgetAmount > 0 ? Math.min(1, summary.totalSpent / summary.budgetAmount) : undefined;
          const updatedStreak = await evaluateAndUpdateStreak(prev.year, prev.month, summary.wasOnBudget, prevUsageRatio);
          setStreak(updatedStreak);
          setShowTransitionModal(true);
        }
      }
    } catch {
      setError('Kunne ikke hente data. Prøv igen.');
    } finally {
      setLoading(false);
    }
  }, [user, viewYear, viewMonth, isCurrentMonth, flowCacheKey, now, activeVacationMode, normalUntilVacationPeriod]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (loading || !flowCacheKey) return;
    nuvioFlowCache.set(flowCacheKey, {
      at: Date.now(),
      data: {
        expenses,
        monthlyBudget,
        variableEstimate,
        prevSummary,
        streak,
        lastKnownBudget,
        flowScoreThreshold,
        flowStatusConfig,
        weeklyStatus,
        weekStartDay,
      },
    });
  }, [
    loading,
    flowCacheKey,
    expenses,
    activeVacationMode,
    monthlyBudget,
    variableEstimate,
    prevSummary,
    streak,
    lastKnownBudget,
    flowScoreThreshold,
    flowStatusConfig,
    weeklyStatus,
    weekStartDay,
  ]);

  useEffect(() => {
    const seen = localStorage.getItem(GUIDE_SEEN_KEY);
    if (!seen) {
      const t = setTimeout(() => setShowGuide(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const { totalSpent, remaining, usedPct, overBudget, daysInMonth, remainingDays, dailyAvailable } = useMemo(() => {
    const spent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const rem = monthlyBudget - spent;
    const dim = activeVacationMode?.number_of_days ?? normalUntilVacationPeriod?.totalDays ?? new Date(viewYear, viewMonth, 0).getDate();
    const remDays = activeVacationMode
      ? getDaysLeftInRange(activeVacationMode.end_date, now)
      : normalUntilVacationPeriod?.remainingDays ?? (dim - now.getDate() + 1);
    return {
      totalSpent: spent,
      remaining: rem,
      usedPct: monthlyBudget > 0 ? Math.min((spent / monthlyBudget) * 100, 100) : 0,
      overBudget: monthlyBudget > 0 && spent > monthlyBudget,
      daysInMonth: dim,
      remainingDays: remDays,
      dailyAvailable: remDays > 0 && rem > 0 ? rem / remDays : 0,
    };
  }, [expenses, monthlyBudget, now, activeVacationMode, normalUntilVacationPeriod, viewYear, viewMonth]);
  const normalModePeriodDays = normalUntilVacationPeriod?.totalDays ?? new Date(viewYear, viewMonth, 0).getDate();
  const normalModeDailyBudget = normalModePeriodDays > 0 ? monthlyBudget / normalModePeriodDays : 0;
  const displayWeeklyStatus = useMemo(
    () => !isVacationMode && monthlyBudget > 0
      ? computeWeeklyCarryOver(monthlyBudget, viewYear, viewMonth, expenses, now, weekStartDay, {
          periodStartDate: normalUntilVacationPeriod?.startDate,
          periodEndDate: normalUntilVacationPeriod?.endDate,
        })
      : null,
    [isVacationMode, monthlyBudget, viewYear, viewMonth, expenses, now, weekStartDay, normalUntilVacationPeriod],
  );

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    const futureYear = viewMonth === 12 ? viewYear + 1 : viewYear;
    const futureMonth = viewMonth === 12 ? 1 : viewMonth + 1;
    if (futureYear > now.getFullYear() || (futureYear === now.getFullYear() && futureMonth > now.getMonth() + 1)) return;
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  }

  const isNextDisabled = isVacationMode || (viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteQuickExpense(id);
      const newExpenses = expenses.filter(e => e.id !== id);
      setExpenses(newExpenses);
      if (!isVacationMode && monthlyBudget > 0) {
        const weekly = computeWeeklyCarryOver(monthlyBudget, viewYear, viewMonth, newExpenses, now, weekStartDay, {
          periodStartDate: normalUntilVacationPeriod?.startDate,
          periodEndDate: normalUntilVacationPeriod?.endDate,
        });
        setWeeklyStatus(weekly);
        if (isCurrentMonth) {
          updateWeeklyCarryOver(viewYear, viewMonth, weekly.accumulatedCarryOver).catch(() => null);
        }
      } else {
        setWeeklyStatus(null);
      }
    } catch {
      setError('Kunne ikke slette posten.');
    } finally {
      setDeletingId(null);
    }
  }

  function handleEditSave(updated: QuickExpense) {
    const start = `${viewYear}-${String(viewMonth).padStart(2, '0')}-01`;
    const endDate = new Date(viewYear, viewMonth, 0);
    const end = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    const stillInScope = activeVacationMode
      ? updated.mode === 'vacation' &&
        updated.vacation_mode_id === activeVacationMode.id &&
        updated.expense_date >= activeVacationMode.start_date &&
        updated.expense_date <= activeVacationMode.end_date
      : (updated.mode ?? 'normal') === 'normal' && updated.expense_date >= start && updated.expense_date <= end;

    const newExpenses = stillInScope
      ? expenses.map(e => e.id === updated.id ? updated : e)
      : expenses.filter(e => e.id !== updated.id);

    setExpenses(newExpenses);
    if (!isVacationMode && monthlyBudget > 0) {
      const weekly = computeWeeklyCarryOver(monthlyBudget, viewYear, viewMonth, newExpenses, now, weekStartDay, {
        periodStartDate: normalUntilVacationPeriod?.startDate,
        periodEndDate: normalUntilVacationPeriod?.endDate,
      });
      setWeeklyStatus(weekly);
      if (isCurrentMonth) {
        updateWeeklyCarryOver(viewYear, viewMonth, weekly.accumulatedCarryOver).catch(() => null);
      }
    } else {
      setWeeklyStatus(null);
    }
    setEditingExpense(null);
  }

  async function handleSaveBudget() {
    if (isVacationMode) return;
    const parsed = parseFloat(budgetDraft.replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) return;
    try {
      await upsertMonthlyBudget(viewYear, viewMonth, parsed);
      setMonthlyBudget(parsed);
      const weekly = computeWeeklyCarryOver(parsed, viewYear, viewMonth, expenses, now, weekStartDay, {
        periodStartDate: normalUntilVacationPeriod?.startDate,
        periodEndDate: normalUntilVacationPeriod?.endDate,
      });
      setWeeklyStatus(weekly);
      if (isCurrentMonth) {
        updateWeeklyCarryOver(viewYear, viewMonth, weekly.accumulatedCarryOver).catch(() => null);
      }
      setShowBudgetEditor(false);
    } catch {
      setError('Kunne ikke gemme rådighedsbeløb.');
    }
  }

  async function handleTransitionConfirm(input: {
    budgetAmount: number;
    vacationPlan: null | {
      startDate: string;
      numberOfDays: number;
      budgetAmount: number | null;
    };
  }) {
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const prev = getPrevMonthRef(curYear, curMonth);

    await upsertMonthlyBudget(curYear, curMonth, input.budgetAmount);
    if (user && input.vacationPlan) {
      await upsertPlannedVacationMode(user.id, {
        budget_amount: input.vacationPlan.budgetAmount ?? 0,
        start_date: input.vacationPlan.startDate,
        end_date: addDaysToIsoDate(input.vacationPlan.startDate, input.vacationPlan.numberOfDays - 1),
        number_of_days: input.vacationPlan.numberOfDays,
      });
    }
    await acknowledgeMonthTransition(curYear, curMonth, prev.year, prev.month);

    setMonthlyBudget(input.budgetAmount);
    const transitionPeriod = getNormalUntilVacationPeriod(
      input.vacationPlan
        ? {
            id: '',
            user_id: user?.id ?? '',
            status: 'planned',
            budget_amount: input.vacationPlan.budgetAmount ?? 0,
            start_date: input.vacationPlan.startDate,
            end_date: addDaysToIsoDate(input.vacationPlan.startDate, input.vacationPlan.numberOfDays - 1),
            number_of_days: input.vacationPlan.numberOfDays,
            activated_at: null,
            ended_at: null,
            created_at: '',
            updated_at: '',
          }
        : plannedVacationMode,
      curYear,
      curMonth,
      now,
    );
    const weekly = computeWeeklyCarryOver(input.budgetAmount, curYear, curMonth, expenses, now, weekStartDay, {
      periodStartDate: transitionPeriod?.startDate,
      periodEndDate: transitionPeriod?.endDate,
    });
    setWeeklyStatus(weekly);
    updateWeeklyCarryOver(curYear, curMonth, weekly.accumulatedCarryOver).catch(() => null);
    setShowTransitionModal(false);
  }

  function handleTransitionDismiss() {
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const prev = getPrevMonthRef(curYear, curMonth);
    acknowledgeMonthTransition(curYear, curMonth, prev.year, prev.month).catch(() => null);
    setShowTransitionModal(false);
  }

  const progressColor = useMemo(() =>
    overBudget ? 'bg-red-500' : usedPct > 80 ? 'bg-amber-500' : 'bg-emerald-500',
  [overBudget, usedPct]);

  const carryOverPenalty = useMemo(() =>
    displayWeeklyStatus ? Math.abs(Math.min(0, displayWeeklyStatus.accumulatedCarryOver)) : 0,
  [displayWeeklyStatus]);

  const { healthPct, healthBarPct, healthBarColor, healthGlow } = useMemo(() => {
    const rawFlowScore = (() => {
      if (!isCurrentMonth || monthlyBudget <= 0) return 0;
      if (overBudget) return 0;
      const remainingBudget = monthlyBudget - totalSpent;
      if (remainingDays <= 0) return remainingBudget >= 0 ? 100 : 0;
      const idealDailyRate = monthlyBudget / daysInMonth;
      const affordableDailyRate = remainingBudget / remainingDays;
      const recoveryRatio = affordableDailyRate / idealDailyRate;
      const carryOverPenaltyRatio = monthlyBudget > 0 ? carryOverPenalty / monthlyBudget : 0;
      const penaltyFactor = Math.max(0, 1 - carryOverPenaltyRatio * 2);
      const baseScore = (() => {
        if (recoveryRatio >= 1 + flowScoreThreshold) return 100;
        if (recoveryRatio <= 0) return 0;
        return Math.max(0, Math.min(100, (recoveryRatio / (1 + flowScoreThreshold)) * 100));
      })();
      return Math.round(baseScore * penaltyFactor);
    })();
    const pct = Math.round(rawFlowScore);
    return {
      healthPct: pct,
      healthBarPct: Math.min(100, Math.max(4, pct)),
      healthBarColor: pct >= 60 ? 'from-emerald-400 to-teal-400' : pct >= 30 ? 'from-amber-400 to-orange-300' : 'from-red-400 to-rose-400',
      healthGlow: pct >= 60 ? 'shadow-emerald-300/60' : pct >= 30 ? 'shadow-amber-300/60' : 'shadow-red-300/60',
    };
  }, [isCurrentMonth, monthlyBudget, overBudget, totalSpent, remainingDays, daysInMonth, carryOverPenalty, flowScoreThreshold]);

  const fsc = flowStatusConfig;

  const statusState: 'over' | 'warn' | 'tempo' | 'kursen' | 'flow' = overBudget
    ? 'over'
    : healthPct < fsc.warnHealthMin
    ? 'warn'
    : healthPct >= fsc.flowHealthMin
    ? 'flow'
    : healthPct >= fsc.tempoHealthMin
    ? 'tempo'
    : 'kursen';

  const statusConfig = useMemo(() => ({
    over: {
      cardBg: fsc.colorOverCard,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-500',
      icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
      iconChar: '',
      badgeBg: fsc.colorOverBadge,
      badgeText: fsc.badgeOver,
      badgeCustom: false,
      headline: fsc.headlineOver,
      headlineColor: 'text-red-700',
      amountColor: 'text-red-600',
      ringColor: 'ring-red-200',
    },
    warn: {
      cardBg: fsc.colorWarnCard,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      icon: <Gauge className="h-4 w-4 text-amber-600" />,
      iconChar: '',
      badgeBg: fsc.colorWarnBadge,
      badgeText: fsc.badgeWarn,
      badgeCustom: false,
      headline: fsc.headlineWarn,
      headlineColor: 'text-amber-800',
      amountColor: 'text-amber-700',
      ringColor: 'ring-amber-200',
    },
    kursen: {
      cardBg: fsc.colorGoodCard,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      icon: <Star className="h-4 w-4 text-emerald-600" />,
      iconChar: '',
      badgeBg: fsc.colorKursenBadge,
      badgeText: fsc.badgeKursen,
      badgeCustom: false,
      headline: fsc.headlineKursen,
      headlineColor: 'text-emerald-800',
      amountColor: 'text-emerald-700',
      ringColor: 'ring-emerald-200',
    },
    tempo: {
      cardBg: fsc.colorGoodCard,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      icon: <Sparkles className="h-4 w-4 text-emerald-600" />,
      iconChar: '',
      badgeBg: fsc.colorTempoBadge,
      badgeText: fsc.badgeTempo,
      badgeCustom: false,
      headline: fsc.headlineTempo,
      headlineColor: 'text-emerald-800',
      amountColor: 'text-emerald-700',
      ringColor: 'ring-emerald-200',
    },
    flow: {
      cardBg: fsc.colorFlowCard,
      iconBg: 'bg-gradient-to-br from-yellow-400 to-amber-500',
      iconColor: 'text-white',
      icon: <Crown className="h-4 w-4 text-white" />,
      iconChar: '',
      badgeBg: fsc.colorFlowBadge,
      badgeText: fsc.badgeFlow,
      badgeCustom: true,
      headline: fsc.headlineFlow,
      headlineColor: 'text-slate-800',
      amountColor: 'text-slate-700',
      ringColor: 'ring-yellow-300/60',
    },
  }), [fsc]);

  const cfg = statusConfig[statusState];

  const cardMedium = design.cardMedium;
  const vacationAccent = getVacationAccentColor(design);
  const activeCardMedium = isVacationMode ? getVacationTopBarCard(cardMedium, vacationAccent) : cardMedium;
  const activeGradientTo = isVacationMode ? vacationAccent : design.gradientTo;
  const cardStyleBase = getCardStyle(activeCardMedium, design.gradientFrom, activeGradientTo);
  const topBarStyleOverride = getTopBarStyle(activeCardMedium, design.gradientFrom, activeGradientTo);
  const sharedCardClassName = cn(
    'relative rounded-2xl border shadow-sm overflow-hidden transition-all duration-500',
    isVacationMode
      ? 'bg-gradient-to-br from-white via-white to-white'
      : 'bg-gradient-to-br from-emerald-50/80 via-teal-50/30 to-white border-emerald-200/50'
  );
  const vacationCardTintStyle = isVacationMode
    ? getVacationCardSurfaceStyle(vacationAccent)
    : undefined;

  const { progressBarStyle, progressDotColor } = useMemo(() => {
    const hex = isVacationMode ? vacationAccent : extractBadgeHex(cfg.badgeBg);
    return {
      progressBarStyle: hex ? { background: `linear-gradient(to right, ${hex}cc, ${hex})` } as React.CSSProperties : undefined,
      progressDotColor: hex ?? (overBudget ? '#ef4444' : healthPct >= 60 ? '#34d399' : '#fbbf24'),
    };
  }, [cfg.badgeBg, overBudget, healthPct, isVacationMode, vacationAccent]);

  const currentWeek = displayWeeklyStatus?.weeks.find(w => w.isCurrentWeek);
  const vacationDayStatuses = useMemo(() => {
    if (!activeVacationMode) return [];
    return getVacationBudgetDayStatuses(activeVacationMode, expenses, now);
  }, [activeVacationMode, expenses, now]);
  const currentVacationDayStatus = useMemo(
    () => vacationDayStatuses.find(day => day.isCurrent) ?? vacationDayStatuses.find(day => day.isFuture) ?? null,
    [vacationDayStatuses]
  );
  const vacationStartingDailyBudget = useMemo(() => {
    if (!activeVacationMode || activeVacationMode.number_of_days <= 0) return 0;
    return monthlyBudget / activeVacationMode.number_of_days;
  }, [activeVacationMode, monthlyBudget]);
  const weeklyTransactionCount = useMemo(() => {
    if (!isCurrentMonth) return 0;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
    return expenses.filter(e => e.expense_date >= weekStartStr).length;
  }, [isCurrentMonth, expenses, now]);

  useEffect(() => {
    if (isCurrentPeriod && monthlyBudget > 0) {
      setAiContext({
        page: 'nuvio-flow',
        score: healthPct,
        status: statusState,
        statusLabel: isVacationMode ? 'Ferie' : cfg.badgeText,
        remaining,
        monthlyBudget,
        totalSpent,
        remainingDays,
        dailyAvailable,
        streak: streak?.current_streak ?? 0,
        carryOverPenalty,
        month: isVacationMode && vacationPeriodLabel ? vacationPeriodLabel : `${DANISH_MONTHS[viewMonth - 1]} ${viewYear}`,
        weeklyTransactionCount,
      });
    } else {
      setAiContext(undefined);
    }
    return () => setAiContext(undefined);
  }, [isCurrentPeriod, isVacationMode, monthlyBudget, healthPct, statusState, cfg.badgeText, remaining, totalSpent, remainingDays, dailyAvailable, streak, carryOverPenalty, viewMonth, viewYear, vacationPeriodLabel, weeklyTransactionCount, setAiContext]);

  const pageBackground = useMemo(() => {
    if (activeVacationMode) {
      const top = withAlpha(getVacationAccentColor(design), 0.16);
      return {
        top,
        gradient: `linear-gradient(to bottom, ${top}, #ffffff 42%, #ffffff)`,
      };
    }
    if (statusState === 'kursen') {
      return {
        top: 'rgb(236,253,245)',
        gradient: 'linear-gradient(to bottom, rgba(236,253,245,0.60), #ffffff, #ffffff)',
      };
    }
    if (statusState === 'tempo') {
      return {
        top: 'rgb(236,253,245)',
        gradient: 'linear-gradient(to bottom, rgba(236,253,245,0.60), #ffffff, #ffffff)',
      };
    }
    if (statusState === 'warn') {
      return {
        top: 'rgb(236,253,245)',
        gradient: 'linear-gradient(to bottom, rgba(236,253,245,0.60), #ffffff, #ffffff)',
      };
    }
    if (statusState === 'over') {
      return {
        top: 'rgb(236,253,245)',
        gradient: 'linear-gradient(to bottom, rgba(236,253,245,0.60), #ffffff, #ffffff)',
      };
    }
    return {
      top: 'rgb(236,253,245)',
      gradient: 'linear-gradient(to bottom, rgba(236,253,245,0.60), #ffffff, #ffffff)',
    };
  }, [activeVacationMode, statusState, design]);

  const topBgColor = pageBackground.top;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const previousHtmlBackground = document.documentElement.style.backgroundColor;
    const previousBodyBackground = document.body.style.backgroundColor;
    document.body.style.backgroundColor = topBgColor;
    document.documentElement.style.backgroundColor = topBgColor;
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = topBgColor;
    return () => {
      document.body.style.backgroundColor = previousBodyBackground;
      document.documentElement.style.backgroundColor = previousHtmlBackground;
      if (meta) meta.content = '#f8f9f2';
    };
  }, [topBgColor]);

  if (user && !vacationModeResolved) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-lg mx-auto px-4 pb-32 sm:pb-16" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}>
          <div className="mb-6">
            <div className="h-3 w-24 rounded-full bg-black/6 animate-pulse" />
            <div className="mt-3 h-10 w-52 rounded-2xl bg-black/6 animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="h-80 rounded-2xl border border-black/6 bg-white shadow-sm animate-pulse" />
            <div className="h-56 rounded-2xl border border-black/6 bg-white shadow-sm animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'min-h-screen transition-colors duration-700',
      )}
      style={{ background: pageBackground.gradient, backgroundColor: topBgColor }}
    >
      <div className="max-w-lg mx-auto px-4 pb-32 sm:pb-16" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}>

        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1">
              {isVacationMode ? 'Ferie mode' : `${DANISH_MONTHS[now.getMonth()]} ${now.getFullYear()}`}
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              {isVacationMode ? 'Ferie Udgifter' : 'Udgifter'}
            </h1>
          </div>
          <button
            onClick={() => setShowGuide(true)}
            className="h-10 w-10 rounded-full border-2 border-emerald-400/60 bg-white/70 flex items-center justify-center text-emerald-600 hover:border-emerald-500 hover:bg-emerald-50 transition-all duration-200 shadow-sm shrink-0"
            aria-label={isVacationMode ? 'Om Ferie Udgifter' : 'Om Udgifter'}
          >
            <Info className="h-4 w-4" />
          </button>
        </div>

        {/* Budget Status Card */}
        <div
          className={cn('mb-4', sharedCardClassName)}
          style={{ ...cardStyleBase, ...vacationCardTintStyle }}
        >
          {topBarStyleOverride && (
            <div style={topBarStyleOverride} />
          )}

          {/* Card header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-2 transition-all duration-500',
                monthlyBudget > 0 ? cfg.iconBg : 'bg-muted/20',
                monthlyBudget > 0 ? cfg.ringColor : 'ring-muted/10'
              )}>
                {monthlyBudget > 0 ? (
                  cfg.icon
                ) : (
                  <Star className="h-4 w-4 text-muted-foreground/40" />
                )}
              </div>
              <div>
                <p className="text-label font-semibold uppercase tracking-widest text-muted-foreground/50 leading-none mb-0.5">
                  {isVacationMode ? 'Feriekuvert' : `${DANISH_MONTHS[viewMonth - 1]} ${viewYear}`}
                </p>
                {monthlyBudget > 0 && (
                  cfg.badgeCustom ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tracking-wide bg-gradient-to-r from-slate-700 to-slate-800 shadow-sm"
                      style={isVacationMode ? { borderColor: withAlpha(vacationAccent, 0.4) } : undefined}
                    >
                      <Crown
                        className="h-2.5 w-2.5"
                        style={isVacationMode ? { color: vacationAccent } : undefined}
                      />
                      <span style={isVacationMode ? { color: vacationAccent } : undefined}>{isVacationMode ? 'Ferie' : 'Udgifter'}</span>
                    </span>
                  ) : cfg.badgeBg.startsWith('bg-[') ? (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold tracking-wide text-white"
                      style={{ backgroundColor: cfg.badgeBg.slice(4, -1) }}
                    >
                      {cfg.badgeText}
                    </span>
                  ) : (
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold tracking-wide text-white', cfg.badgeBg)}>
                      {cfg.badgeText}
                    </span>
                  )
                )}
              </div>
            </div>
            {isVacationMode ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground">
                <Settings2 className="h-3.5 w-3.5" />
                Feriebudget
              </div>
            ) : (
              <button
                onClick={() => { setBudgetDraft(monthlyBudget > 0 ? String(monthlyBudget) : ''); setShowBudgetEditor(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-black/5 transition-all duration-200"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Rådighedsbeløb
              </button>
            )}
          </div>

          {monthlyBudget === 0 ? (
            <div className="px-4 pb-4 text-center">
              <p className="text-sm font-semibold text-foreground mb-1">
                {isVacationMode ? 'Intet feriebudget sat' : 'Intet rådighedsbeløb sat'}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isVacationMode
                  ? 'Planlæg eller aktivér en feriekuvert for at se feriestatus.'
                  : 'Sæt et månedligt beløb for at se din budgetstatus.'}
              </p>
            </div>
          ) : (
            <div className="px-4 pb-4 space-y-3">

              {/* Primary amount + headline */}
              <div className="flex items-end justify-between gap-4">
                <div>
                  {isCurrentPeriod && (
                    <p className={cn('text-xs font-medium leading-snug mb-1', cfg.headlineColor)}>
                      {isVacationMode ? 'Din feriekuvert er aktiv' : cfg.headline}
                    </p>
                  )}
                  <p className={cn('text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums leading-none', cfg.amountColor)}>
                    {formatDKK(Math.abs(remaining))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {overBudget ? 'over budget' : 'tilbage af ' + formatDKK(monthlyBudget)}
                  </p>
                </div>

                {/* Stats column — only for current month, not over budget */}
                {isCurrentPeriod && !overBudget && (
                  <div className="flex gap-2 shrink-0">
                    <div className="rounded-xl bg-white/60 border border-black/5 px-3 py-2 text-center min-w-[56px]">
                      <p className="text-xs font-medium text-muted-foreground/70 leading-snug mb-0.5">Dage tilbage</p>
                      <p className="text-sm font-semibold tracking-tight text-foreground">{remainingDays}</p>
                    </div>
                    <div
                      className={cn(
                        'rounded-xl border px-3 py-2 text-center min-w-[56px]',
                        !isVacationMode && (
                          (statusState === 'tempo' || statusState === 'kursen' || statusState === 'flow') ? 'bg-emerald-50/80 border-emerald-100/60' :
                          statusState === 'warn' ? 'bg-amber-50/80 border-amber-100/60' :
                          'bg-red-50/80 border-red-100/60'
                        )
                      )}
                      style={isVacationMode
                        ? {
                            backgroundColor: withAlpha(vacationAccent, 0.10),
                            borderColor: withAlpha(vacationAccent, 0.20),
                          }
                        : undefined}
                    >
                      <p className="text-xs font-medium text-muted-foreground/70 leading-snug mb-0.5">Per dag</p>
                      <p className={cn('text-sm font-semibold tracking-tight', cfg.amountColor)}>
                        {dailyAvailable > 0
                          ? dailyAvailable.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', minimumFractionDigits: 0, maximumFractionDigits: 0 })
                          : '0 kr.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Budgetstatus */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                    Budgetstatus
                  </span>
                  <div className="flex items-center gap-2">
                    {streak && streak.current_streak > 0 && (
                      <button
                        onClick={() => setShowStreakPopup(true)}
                        className={cn(
                          'flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors',
                          isVacationMode ? 'hover:brightness-[0.98]' : 'bg-amber-50 border border-amber-200/60 hover:bg-amber-100'
                        )}
                        style={isVacationMode
                          ? {
                              backgroundColor: withAlpha(vacationAccent, 0.12),
                              border: `1px solid ${withAlpha(vacationAccent, 0.24)}`,
                            }
                          : undefined}
                      >
                        <Flame
                          className="h-3 w-3"
                          style={isVacationMode ? { color: vacationAccent } : undefined}
                        />
                        <span
                          className="text-xs font-bold tabular-nums"
                          style={isVacationMode ? { color: '#0E3B43' } : undefined}
                        >
                          {streak.current_streak}
                        </span>
                      </button>
                    )}
                    {!overBudget && (
                      <span className={cn('text-xs font-bold tabular-nums', cfg.amountColor)}>
                        {healthPct}
                      </span>
                    )}
                  </div>
                </div>

                <div className="relative h-2 rounded-full bg-black/[0.06] overflow-visible">
                  {!overBudget ? (
                    <div
                      className={cn(
                        'absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out',
                        !progressBarStyle && cn('bg-gradient-to-r', healthBarColor)
                      )}
                      style={{ width: `${healthBarPct}%`, ...(progressBarStyle ?? {}) }}
                    >
                      <div
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-md border-2"
                        style={{ borderColor: progressDotColor }}
                      />
                    </div>
                  ) : (
                    <div
                      className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-500', !progressBarStyle && progressColor)}
                      style={{ width: `${usedPct}%`, ...(progressBarStyle ?? {}) }}
                    />
                  )}
                </div>

                <p className="text-label text-muted-foreground/60 leading-snug">
                  {overBudget
                    ? `${formatDKK(totalSpent)} brugt af ${formatDKK(monthlyBudget)}`
                    : isVacationMode
                    ? `${formatDKK(totalSpent)} brugt af ${formatDKK(monthlyBudget)}`
                    : isCurrentMonth
                    ? `${formatDKK(totalSpent)} brugt · ${formatDKK(Math.round(dailyAvailable))} pr. dag`
                    : `${formatDKK(totalSpent)} brugt af ${formatDKK(monthlyBudget)}`
                  }
                </p>
              </div>

              {(!isCurrentMonth || overBudget) && (
                <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-black/5">
                  <span>{formatDKK(totalSpent)} brugt</span>
                  <span>{formatDKK(monthlyBudget)} i alt</span>
                </div>
              )}

              {/* Ferie dagsbudget / Ugebudget — integrated */}
              {isVacationMode && activeVacationMode && (
                <div className="-mx-5 -mb-5 border-t border-black/5">
                  <div className="w-full flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <CalendarDays className="h-4 w-4 shrink-0" style={{ color: vacationAccent }} />
                      <div className="text-left">
                        <p className="text-xs font-semibold text-foreground">Ferie dagsbudget</p>
                        <p className="text-label text-muted-foreground leading-snug">
                          {formatDKK(currentVacationDayStatus?.budgetForDay ?? vacationStartingDailyBudget)} pr. feriedag
                        </p>
                      </div>
                    </div>
                    <div
                      className="rounded-full px-2 py-0.5 text-label font-semibold tabular-nums"
                      style={{
                        backgroundColor: withAlpha(vacationAccent, 0.14),
                        color: vacationAccent,
                      }}
                    >
                      {activeVacationMode.number_of_days} dage
                    </div>
                  </div>

                  <div className="border-t border-border/40 divide-y divide-border/30">
                    <div className="px-5 py-3 bg-secondary/10">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Startbudget: {formatDKK(monthlyBudget)} / {activeVacationMode.number_of_days} dage = {formatDKK(vacationStartingDailyBudget)} pr. dag.
                        Bruger du mindre en dag, fordeles resten automatisk over de resterende feriedage.
                      </p>
                    </div>

                    {vacationDayStatuses.map((day) => {
                      const dayBudget = day.budgetForDay;
                      const currentDayTotal = day.isCurrent ? day.spent + dayBudget : dayBudget;
                      const daySpentPct = currentDayTotal > 0 ? Math.min((day.spent / currentDayTotal) * 100, 100) : 0;
                      const dayRemaining = day.isCurrent ? dayBudget : dayBudget - day.spent;
                      const isOverDayBudget = day.isCurrent ? dayBudget < 0 : day.spent > dayBudget;

                      return (
                        <div
                          key={day.date}
                          className={cn(
                            'px-5 py-3.5',
                            day.isFuture && 'opacity-60'
                          )}
                          style={day.isCurrent ? { backgroundColor: withAlpha(vacationAccent, 0.08) } : undefined}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-foreground">
                                  Dag {day.index}
                                </span>
                                {day.isCurrent && (
                                  <span
                                    className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: withAlpha(vacationAccent, 0.18),
                                      color: '#0E3B43',
                                    }}
                                  >
                                    Nu
                                  </span>
                                )}
                                {day.isPast && day.keptBudget === false && (
                                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 flex items-center gap-0.5">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    Overskredet
                                  </span>
                                )}
                                {day.isPast && day.keptBudget === true && (
                                  <span
                                    className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: withAlpha(vacationAccent, 0.18),
                                      color: '#0E3B43',
                                    }}
                                  >
                                    Indenfor budget
                                  </span>
                                )}
                              </div>
                              <p className="text-label text-muted-foreground mt-0.5">
                                {formatDate(day.date)}
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              {day.isCurrent ? (
                                <>
                                  <p className="text-sm font-semibold tabular-nums text-foreground">
                                    {formatDKK(Math.round(dayRemaining))}
                                  </p>
                                  <p className="text-label text-muted-foreground mt-0.5">
                                    {dayRemaining >= 0 ? 'tilbage i dag' : 'over dagens budget'}
                                  </p>
                                </>
                              ) : day.isFuture ? (
                                <>
                                  <p className="text-sm font-semibold tabular-nums text-foreground">
                                    {formatDKK(Math.round(dayBudget))}
                                  </p>
                                  <p className="text-label text-muted-foreground mt-0.5">budget</p>
                                </>
                              ) : (
                                <>
                                  <p className="text-sm font-semibold tabular-nums text-foreground">
                                    {formatDKK(Math.round(day.spent))}
                                  </p>
                                  <p className="text-label text-muted-foreground mt-0.5">
                                    af {formatDKK(Math.round(dayBudget))}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>

                          {!day.isFuture && (
                            <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
                              <div
                                className={cn('h-full rounded-full transition-all duration-500')}
                                style={{
                                  width: `${daySpentPct}%`,
                                  backgroundColor: isOverDayBudget
                                    ? '#f87171'
                                    : daySpentPct > 80
                                    ? '#fbbf24'
                                    : vacationAccent,
                                }}
                              />
                            </div>
                          )}

                          {day.isPast && isOverDayBudget && (
                            <p className="text-label text-red-600 mt-1.5 flex items-center gap-1">
                              <TrendingDown className="h-3 w-3" />
                              {formatDKK(Math.round(Math.abs(dayRemaining)))} over dagens budget
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!isVacationMode && displayWeeklyStatus && (
                <div className="-mx-5 -mb-5 border-t border-black/5">
                  <div className="w-full flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <CalendarDays className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div className="text-left">
                        <p className="text-xs font-semibold text-foreground">Ugebudget</p>
                        {currentWeek && isCurrentMonth ? (
                          <p className="text-label text-muted-foreground leading-snug">
                            {formatDKK(Math.round(displayWeeklyStatus.effectiveWeeklyBudget))} denne uge
                          </p>
                        ) : (
                          <p className="text-label text-muted-foreground leading-snug">
                            {formatDKK(Math.round(displayWeeklyStatus.weeklyBase))} pr. uge (base)
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {currentWeek && isCurrentMonth && (
                        <WeekPill week={currentWeek} effectiveBudget={displayWeeklyStatus.effectiveWeeklyBudget} />
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border/40 divide-y divide-border/30">
                      <div className="px-5 py-3 bg-secondary/10">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Dagligt budget: {formatDKK(monthlyBudget)} / {normalModePeriodDays} dage = {formatDKK(Math.round(normalModeDailyBudget * 100) / 100)} pr. dag.
                          Uger der starter eller slutter midt i måneden beregnes efter faktisk antal dage. Overtræk fordeles ligeligt over de resterende uger.
                        </p>
                      </div>

                {(() => {
                  const nowStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
                  return displayWeeklyStatus.weeks.map((week) => {
                  const weekStartStr = `${week.weekStart.getFullYear()}-${String(week.weekStart.getMonth()+1).padStart(2,'0')}-${String(week.weekStart.getDate()).padStart(2,'0')}`;
                  const weekEndStr = `${week.weekEnd.getFullYear()}-${String(week.weekEnd.getMonth()+1).padStart(2,'0')}-${String(week.weekEnd.getDate()).padStart(2,'0')}`;
                  const isFuture = weekStartStr > nowStr && !week.isCurrentWeek;
                  const isPast = weekEndStr < nowStr && !week.isCurrentWeek;
                  const effectiveBudgetForWeek = week.effectiveBudget;
                  const weekSpentPct = effectiveBudgetForWeek > 0
                    ? Math.min((week.spent / effectiveBudgetForWeek) * 100, 100)
                    : 0;

                  const weekLabel = `Uge ${week.isoWeekNumber}`;
                  const displayStart = week.weekStart;
                  const displayEnd = week.weekEnd;

                  return (
                    <div
                      key={week.weekNumber}
                      className={cn(
                        'px-5 py-3.5',
                        week.isCurrentWeek && 'bg-emerald-50/40',
                        isFuture && 'opacity-50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-foreground">
                              {weekLabel}
                            </span>
                            {week.isCurrentWeek && (
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                Nu
                              </span>
                            )}
                            {isPast && week.isOver && (
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 flex items-center gap-0.5">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Overskredet
                              </span>
                            )}
                            {isPast && week.isAhead && (
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                Foran budget
                              </span>
                            )}
                            {isPast && !week.isOver && !week.isAhead && (
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                                OK
                              </span>
                            )}
                          </div>
                          <p className="text-label text-muted-foreground mt-0.5">
                            {formatShortDate(displayStart)} – {formatShortDate(displayEnd)}
                            {week.daysInMonth < 7 && (
                              <span className="ml-1 text-xs text-muted-foreground/70">({week.daysInMonth} dage)</span>
                            )}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {week.isCurrentWeek && !isFuture ? (
                            <>
                              <p className="text-sm font-semibold tabular-nums text-foreground">
                                {formatDKK(Math.round(week.remaining))}
                              </p>
                              <p className="text-label text-muted-foreground mt-0.5">
                                tilbage til {weekLabel}
                              </p>
                            </>
                          ) : isFuture ? (
                            <>
                              <p className="text-sm font-semibold tabular-nums text-foreground">
                                {formatDKK(Math.round(effectiveBudgetForWeek))}
                              </p>
                              <p className="text-label text-muted-foreground mt-0.5">budget</p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-semibold tabular-nums text-foreground">
                                {formatDKK(Math.round(week.spent))}
                              </p>
                              <p className="text-label text-muted-foreground mt-0.5">
                                af {formatDKK(Math.round(effectiveBudgetForWeek))}
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      {!isFuture && (
                        <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              week.isOver
                                ? 'bg-red-400'
                                : weekSpentPct > 80
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                            )}
                            style={{ width: `${weekSpentPct}%` }}
                          />
                        </div>
                      )}

                      {isPast && week.isOver && (
                        <p className="text-label text-red-600 mt-1.5 flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" />
                          {formatDKK(Math.round(week.overageAmount))} fordelt over resterende uger
                        </p>
                      )}
                    </div>
                  );
                });
                })()}
                    </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Month Navigator + History */}
        <div className={sharedCardClassName} style={{ ...cardStyleBase, ...vacationCardTintStyle }}>
          {topBarStyleOverride && (
            <div style={topBarStyleOverride} />
          )}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <button
              onClick={prevMonth}
              disabled={isVacationMode}
              className={cn(
                'p-2 rounded-lg transition-colors',
                isVacationMode
                  ? 'text-muted-foreground/30 cursor-not-allowed'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold capitalize">
                {isVacationMode ? 'Ferie Udgifter' : `Udgifter ${DANISH_MONTHS[viewMonth - 1]} ${viewYear}`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isVacationMode && vacationPeriodLabel
                  ? `${vacationPeriodLabel} · ${expenses.length} poster · ${formatDKK(totalSpent)}`
                  : `${expenses.length} poster · ${formatDKK(totalSpent)}`}
              </p>
            </div>
            <button
              onClick={nextMonth}
              disabled={isNextDisabled}
              className={cn(
                'p-2 rounded-lg transition-colors',
                isNextDisabled
                  ? 'text-muted-foreground/30 cursor-not-allowed'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-1 p-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 rounded-xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                <Receipt className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {isVacationMode ? 'Ingen ferieudgifter endnu' : 'Ingen udgifter dette måned'}
              </p>
              {isCurrentPeriod && (
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {isVacationMode ? 'Registrer den første ferieudgift fra Hjem.' : 'Registrer din første udgift ovenfor'}
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {expenses.map(exp => (
                <div
                  key={exp.id}
                  className={cn(
                    'flex items-center gap-3 px-5 py-3.5 transition-colors group',
                    'hover:bg-muted/20 cursor-pointer active:bg-muted/30'
                  )}
                  onClick={() => setEditingExpense(exp)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {exp.note ?? 'Udgift'}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <p className="text-xs text-muted-foreground">{formatDate(exp.expense_date)}</p>
                      {!isVacationMode && exp.spread_over_month && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                          Fordelt
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-foreground shrink-0">{formatDKK(Number(exp.amount))}</p>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(exp.id); }}
                    disabled={deletingId === exp.id}
                    className={cn(
                      'p-1.5 rounded-lg text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 transition-all duration-200',
                      'opacity-0 group-hover:opacity-100 sm:opacity-100',
                      deletingId === exp.id && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Budget Editor Overlay */}
      {showBudgetEditor && !isVacationMode && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowBudgetEditor(false)}
          />
          <div
            className="relative w-full max-w-md bg-card rounded-2xl shadow-2xl p-6"
            style={{ animation: 'slideUp 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">Månedligt rådighedsbeløb</h2>
              <button
                onClick={() => setShowBudgetEditor(false)}
                className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Hvor meget har du til rådighed til variable udgifter denne måned?
            </p>

            {/* Variable Udgifter forslag */}
            {variableEstimate !== null && variableEstimate > 0 && (
              <div className="mb-4 rounded-xl bg-amber-50/80 border border-amber-200/60 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-amber-800 mb-1">Foreslået fra Variable Udgifter</p>
                    <p className="text-sm text-amber-700/80">
                      {variableEstimate.toLocaleString('da-DK')} kr./måned
                    </p>
                    <p className="text-xs text-amber-600/70 mt-1 leading-relaxed">
                      Baseret på din husstand og forbrug
                    </p>
                  </div>
                  <button
                    onClick={() => setBudgetDraft(String(variableEstimate))}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-800 underline underline-offset-2 shrink-0"
                  >
                    Brug
                  </button>
                </div>
              </div>
            )}

            <div className="relative mb-4">
              <input
                type="number"
                inputMode="decimal"
                placeholder="eks. 4000"
                value={budgetDraft}
                onChange={e => setBudgetDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveBudget()}
                autoFocus
                className={cn(
                  'w-full h-12 rounded-xl border border-border bg-background px-4 pr-14 text-lg font-semibold',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2'
                )}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground pointer-events-none">
                kr.
              </span>
            </div>
            <button
              onClick={handleSaveBudget}
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all duration-200 hover:shadow-md"
            >
              Gem rådighedsbeløb
            </button>
          </div>
        </div>
      )}

      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          year={viewYear}
          month={viewMonth}
          allowMonthlyDistribution={!isVacationMode}
          onSave={handleEditSave}
          onClose={() => setEditingExpense(null)}
        />
      )}

      <NuvioFlowGuideModal
        open={showGuide}
        onClose={() => {
          setShowGuide(false);
          localStorage.setItem(GUIDE_SEEN_KEY, '1');
        }}
      />

      {showTransitionModal && prevSummary && (
        <MonthTransitionModal
          currentYear={now.getFullYear()}
          currentMonth={now.getMonth() + 1}
          prevSummary={prevSummary}
          streak={streak}
          defaultBudget={lastKnownBudget}
          onConfirm={handleTransitionConfirm}
          onDismiss={handleTransitionDismiss}
        />
      )}

      {showStreakPopup && streak && (
        <StreakPopup streak={streak} onClose={() => setShowStreakPopup(false)} />
      )}

      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes healthPulse {
          0%, 100% { box-shadow: 0 2px 8px rgba(52, 211, 153, 0.4); }
          50% { box-shadow: 0 2px 16px rgba(52, 211, 153, 0.7); }
        }
        .health-bar-pulse {
          animation: healthPulse 2.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

interface WeekPillProps {
  week: { spent: number; isOver: boolean };
  effectiveBudget: number;
}

function WeekPill({ week, effectiveBudget }: WeekPillProps) {
  const remaining = effectiveBudget - week.spent;
  if (week.isOver) {
    return (
      <span className="text-label font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 tabular-nums">
        -{Math.round(Math.abs(remaining)).toLocaleString('da-DK')} kr.
      </span>
    );
  }
  return (
    <span className="text-label font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 tabular-nums">
      {Math.round(remaining).toLocaleString('da-DK')} kr. tilbage
    </span>
  );
}

interface StreakPopupProps {
  streak: QuickExpenseStreak;
  onClose: () => void;
}

const MILESTONE_LABELS: Record<number, string> = { 3: 'Tre i træk', 6: 'Et halvt år', 12: 'Et helt år', 24: 'To år' };

function StreakPopup({ streak, onClose }: StreakPopupProps) {
  const s = streak.current_streak;
  const isRec = s >= streak.longest_streak && s > 1;
  const tierColor = s >= 12 ? 'from-amber-400 to-orange-500' : s >= 6 ? 'from-orange-400 to-red-400' : 'from-orange-300 to-amber-400';
  const tierBg = s >= 12 ? 'bg-amber-50 border-amber-200/60' : s >= 6 ? 'bg-orange-50 border-orange-200/60' : 'bg-orange-50/70 border-orange-200/40';
  const milestone = [24, 12, 6, 3].reduce<string | null>((acc, m) => acc ?? (s >= m ? MILESTONE_LABELS[m] : null), null);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        style={{ animation: 'slideUp 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
      >
        <div className={cn('px-6 pt-8 pb-6 text-center', tierBg)}>
          <div className={cn('w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center mx-auto mb-4', tierColor)}>
            {isRec ? <Award className="h-8 w-8 text-white" /> : <Flame className="h-8 w-8 text-white" />}
          </div>
          <p className="text-2xl font-bold text-orange-900 mb-1">{s} {s === 1 ? 'måned' : 'måneder'} i træk</p>
          {milestone && (
            <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full bg-orange-200/70 text-orange-700 uppercase tracking-wide mb-2">
              {milestone}
            </span>
          )}
          <p className="text-sm text-orange-700/70">
            {isRec ? 'Du slår din personlige rekord!' : `Personlig rekord: ${streak.longest_streak} måneder`}
          </p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground mb-1.5">Hvad er en streak?</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              En streak tæller det antal måneder i træk, du har holdt dig inden for dit rådighedsbeløb. Hver måned du afslutter uden at overskride budgettet, forlænges din streak med én.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground mb-1.5">Hvad sker der ved overskridelse?</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Hvis du overskrider budgettet i en måned, nulstilles streaken til nul. Din personlige rekord gemmes dog altid.
            </p>
          </div>
          <div className="rounded-xl bg-orange-50/80 border border-orange-100/60 px-4 py-3">
            <p className="text-xs font-semibold text-orange-800 mb-1">Tanken bag</p>
            <p className="text-xs text-orange-700/80 leading-relaxed">
              Konsistens slår perfektionisme. Det er ikke om at spare mest muligt — det handler om at opbygge en stabil vane med at leve inden for dine egne rammer, måned efter måned.
            </p>
          </div>
        </div>
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-all duration-200"
          >
            Forstået
          </button>
        </div>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-orange-700/50 hover:text-orange-700 hover:bg-orange-100/60 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
