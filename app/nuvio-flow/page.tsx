'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Check, Trash2, Settings2, X, ChevronLeft, ChevronRight, Receipt, CalendarDays, TrendingDown, TriangleAlert as AlertTriangle, Info, Crown, Sparkles, Star, Gauge, Flame, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { useSettings, getCardStyle, getTopBarStyle } from '@/lib/settings-context';
import { type FlowAiContext } from '@/components/ai-assistant-button';
import { useAiContext } from '@/lib/ai-context';
import {
  getQuickExpensesForMonth,
  addQuickExpense,
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
import { supabase } from '@/lib/supabase';
import MonthTransitionModal from '@/components/month-transition-modal';
import StreakBadge from '@/components/streak-badge';
import EditExpenseModal from '@/components/edit-expense-modal';
import { WeekTransitionBottomSheet, WeekTransitionWizard } from '@/components/week-transition-wizard';
import { useWeekTransition } from '@/hooks/use-week-transition';
import { FlowSavingsModal } from '@/components/flow-savings-modal';
import NuvioFlowGuideModal from '@/components/nuvio-flow-guide-modal';

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
  badgeFlow: 'Nuvio Flow',
  headlineOver: 'Du har overskredet dit budget',
  headlineWarn: 'Hold igen på forbruget',
  headlineKursen: 'Du er på rette spor',
  headlineTempo: 'Du klarer det fremragende',
  headlineFlow: 'Du er i Nuvio Flow',
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

function resolveCardStyle(cardBgValue: string, badgeBgValue?: string): { className: string; inlineStyle: React.CSSProperties | undefined } {
  if (badgeBgValue) {
    const hex = extractBadgeHex(badgeBgValue);
    if (hex) {
      return {
        className: 'rounded-2xl border shadow-sm',
        inlineStyle: badgeHexToCardStyle(hex),
      };
    }
  }
  const hexMatch = cardBgValue.match(/from-\[([^\]]+)\]\s+via-\[([^\]]+)\]\s+to-\[([^\]]+)\]/);
  if (hexMatch) {
    return {
      className: 'rounded-2xl border shadow-sm',
      inlineStyle: {
        background: `linear-gradient(to bottom right, ${hexMatch[1]}, ${hexMatch[2]}, ${hexMatch[3]})`,
        borderColor: `${hexMatch[1]}99`,
      },
    };
  }
  return { className: cn('rounded-2xl border shadow-sm', cardBgValue), inlineStyle: undefined };
}

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(d)}. ${DANISH_MONTHS[parseInt(m) - 1]}`;
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
  const { design } = useSettings();
  const { setAiContext, setWizardActive } = useAiContext();
  const now = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [expenses, setExpenses] = useState<QuickExpense[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountRaw, setAmountRaw] = useState('');
  const [note, setNote] = useState('');
  const [showBudgetEditor, setShowBudgetEditor] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<QuickExpense | null>(null);
  const [variableEstimate, setVariableEstimate] = useState<number | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const weekTransition = useWeekTransition();

  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [prevSummary, setPrevSummary] = useState<MonthSummary | null>(null);
  const [streak, setStreak] = useState<QuickExpenseStreak | null>(null);
  const [lastKnownBudget, setLastKnownBudget] = useState<number>(0);
  const [flowScoreThreshold, setFlowScoreThreshold] = useState<number>(0.15);
  const [flowStatusConfig, setFlowStatusConfig] = useState<FlowStatusConfig>(FLOW_STATUS_DEFAULTS);
  const [weeklyStatus, setWeeklyStatus] = useState<WeeklyCarryOverSummary | null>(null);
  const [weeklyExpanded, setWeeklyExpanded] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showStreakPopup, setShowStreakPopup] = useState(false);
  const [weekStartDay, setWeekStartDay] = useState<number>(1);
  const flowCacheKey = user ? `${user.id}:${viewYear}-${viewMonth}` : null;

  useEffect(() => {
    setWizardActive(showGuide);
    return () => setWizardActive(false);
  }, [showGuide, setWizardActive]);

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1;

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
        getQuickExpensesForMonth(viewYear, viewMonth),
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
      const budgetAmount = budget?.budget_amount ?? 0;
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
        const t = (key: string, fallback: string) => m.get(key)?.value_text ?? fallback;
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

      if (budgetAmount > 0) {
        const weekly = computeWeeklyCarryOver(budgetAmount, viewYear, viewMonth, exps, now, userWeekStartDay);
        setWeeklyStatus(weekly);

        if (isCurrentMonth) {
          updateWeeklyCarryOver(viewYear, viewMonth, weekly.accumulatedCarryOver).catch(() => null);
        }
      } else {
        setWeeklyStatus(null);
      }

      if (isCurrentMonth) {
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
  }, [user, viewYear, viewMonth, isCurrentMonth, flowCacheKey, now]);

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
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remDays = dim - now.getDate() + 1;
    return {
      totalSpent: spent,
      remaining: rem,
      usedPct: monthlyBudget > 0 ? Math.min((spent / monthlyBudget) * 100, 100) : 0,
      overBudget: monthlyBudget > 0 && spent > monthlyBudget,
      daysInMonth: dim,
      remainingDays: remDays,
      dailyAvailable: remDays > 0 && rem > 0 ? rem / remDays : 0,
    };
  }, [expenses, monthlyBudget, now]);

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

  const isNextDisabled = viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1;

  async function handleAdd() {
    const parsed = parseFloat(amountRaw.replace(',', '.'));
    if (!parsed || parsed <= 0 || parsed > 999999) {
      setError('Indtast et gyldigt beløb (1 – 999.999 kr.)');
      amountRef.current?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const exp = await addQuickExpense(parsed, note.trim() || null);
      if (isCurrentMonth) {
        const newExpenses = [exp, ...expenses];
        setExpenses(newExpenses);
        if (monthlyBudget > 0) {
          const weekly = computeWeeklyCarryOver(monthlyBudget, viewYear, viewMonth, newExpenses, now, weekStartDay);
          setWeeklyStatus(weekly);
          updateWeeklyCarryOver(viewYear, viewMonth, weekly.accumulatedCarryOver).catch(() => null);
        }
      }
      setAmountRaw('');
      setNote('');
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      amountRef.current?.focus();
    } catch {
      setError('Kunne ikke gemme. Prøv igen.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteQuickExpense(id);
      const newExpenses = expenses.filter(e => e.id !== id);
      setExpenses(newExpenses);
      if (monthlyBudget > 0) {
        const weekly = computeWeeklyCarryOver(monthlyBudget, viewYear, viewMonth, newExpenses, now, weekStartDay);
        setWeeklyStatus(weekly);
        if (isCurrentMonth) {
          updateWeeklyCarryOver(viewYear, viewMonth, weekly.accumulatedCarryOver).catch(() => null);
        }
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
    const stillInMonth = updated.expense_date >= start && updated.expense_date <= end;

    const newExpenses = stillInMonth
      ? expenses.map(e => e.id === updated.id ? updated : e)
      : expenses.filter(e => e.id !== updated.id);

    setExpenses(newExpenses);
    if (monthlyBudget > 0) {
      const weekly = computeWeeklyCarryOver(monthlyBudget, viewYear, viewMonth, newExpenses, now, weekStartDay);
      setWeeklyStatus(weekly);
      if (isCurrentMonth) {
        updateWeeklyCarryOver(viewYear, viewMonth, weekly.accumulatedCarryOver).catch(() => null);
      }
    }
    setEditingExpense(null);
  }

  async function handleSaveBudget() {
    const parsed = parseFloat(budgetDraft.replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) return;
    try {
      await upsertMonthlyBudget(viewYear, viewMonth, parsed);
      setMonthlyBudget(parsed);
      const weekly = computeWeeklyCarryOver(parsed, viewYear, viewMonth, expenses, now, weekStartDay);
      setWeeklyStatus(weekly);
      if (isCurrentMonth) {
        updateWeeklyCarryOver(viewYear, viewMonth, weekly.accumulatedCarryOver).catch(() => null);
      }
      setShowBudgetEditor(false);
    } catch {
      setError('Kunne ikke gemme rådighedsbeløb.');
    }
  }

  async function handleTransitionConfirm(budgetAmount: number) {
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const prev = getPrevMonthRef(curYear, curMonth);

    await upsertMonthlyBudget(curYear, curMonth, budgetAmount);
    await acknowledgeMonthTransition(curYear, curMonth, prev.year, prev.month);

    setMonthlyBudget(budgetAmount);
    const weekly = computeWeeklyCarryOver(budgetAmount, curYear, curMonth, expenses, now, weekStartDay);
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
    weeklyStatus ? Math.abs(Math.min(0, weeklyStatus.accumulatedCarryOver)) : 0,
  [weeklyStatus]);

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
  const cardStyleBase = getCardStyle(cardMedium, design.gradientFrom, design.gradientTo);
  const topBarStyleOverride = getTopBarStyle(cardMedium, design.gradientFrom, design.gradientTo);

  const { statusCardStyle, badgeHex, progressBarStyle, progressDotColor, progressGlowColor } = useMemo(() => {
    const cardStyle = resolveCardStyle(
      monthlyBudget > 0 ? cfg.cardBg : 'bg-white/80 backdrop-blur border-white/30',
      monthlyBudget > 0 ? cfg.badgeBg : undefined,
    );
    const hex = extractBadgeHex(cfg.badgeBg);
    return {
      statusCardStyle: cardStyle,
      badgeHex: hex,
      progressBarStyle: hex ? { background: `linear-gradient(to right, ${hex}cc, ${hex})` } as React.CSSProperties : undefined,
      progressDotColor: hex ?? (overBudget ? '#ef4444' : healthPct >= 60 ? '#34d399' : '#fbbf24'),
      progressGlowColor: hex ? `${hex}55` : undefined,
    };
  }, [cfg.cardBg, cfg.badgeBg, monthlyBudget, overBudget, healthPct]);

  const currentWeek = weeklyStatus?.weeks.find(w => w.isCurrentWeek);

  const weeklyTransactionCount = useMemo(() => {
    if (!isCurrentMonth) return 0;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
    return expenses.filter(e => e.expense_date >= weekStartStr).length;
  }, [isCurrentMonth, expenses, now]);

  useEffect(() => {
    if (isCurrentMonth && monthlyBudget > 0) {
      setAiContext({
        page: 'nuvio-flow',
        score: healthPct,
        status: statusState,
        statusLabel: cfg.badgeText,
        remaining,
        monthlyBudget,
        totalSpent,
        remainingDays,
        dailyAvailable,
        streak: streak?.current_streak ?? 0,
        carryOverPenalty,
        month: `${DANISH_MONTHS[viewMonth - 1]} ${viewYear}`,
        weeklyTransactionCount,
      });
    } else {
      setAiContext(undefined);
    }
    return () => setAiContext(undefined);
  }, [isCurrentMonth, monthlyBudget, healthPct, statusState, cfg.badgeText, remaining, totalSpent, remainingDays, dailyAvailable, streak, carryOverPenalty, viewMonth, viewYear, weeklyTransactionCount, setAiContext]);

  const pageBackground = useMemo(() => {
    if (statusState === 'kursen') {
      return {
        top: 'rgb(240,253,250)',
        gradient: 'linear-gradient(to bottom, rgba(240,253,250,0.7), rgba(236,253,245,0.3), #ffffff)',
      };
    }
    if (statusState === 'tempo') {
      return {
        top: 'rgb(236,253,245)',
        gradient: 'linear-gradient(to bottom, rgba(236,253,245,0.7), rgba(240,253,250,0.25), #ffffff)',
      };
    }
    if (statusState === 'warn') {
      return {
        top: 'rgb(255,251,235)',
        gradient: 'linear-gradient(to bottom, rgba(255,251,235,0.7), rgba(255,247,237,0.25), #ffffff)',
      };
    }
    if (statusState === 'over') {
      return {
        top: 'rgb(254,242,242)',
        gradient: 'linear-gradient(to bottom, rgba(254,242,242,0.7), rgba(255,241,242,0.25), #ffffff)',
      };
    }
    return {
      top: '#dfe9e7',
      gradient: 'linear-gradient(to bottom, rgba(223,233,231,0.9), rgba(237,243,241,0.7), #ffffff)',
    };
  }, [statusState]);

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
              {DANISH_MONTHS[now.getMonth()]} {now.getFullYear()}
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Nuvio Flow
            </h1>
          </div>
          <button
            onClick={() => setShowGuide(true)}
            className="h-10 w-10 rounded-full border-2 border-emerald-400/60 bg-white/70 flex items-center justify-center text-emerald-600 hover:border-emerald-500 hover:bg-emerald-50 transition-all duration-200 shadow-sm shrink-0"
            aria-label="Om Nuvio Flow"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>

        {/* Budget Status Card */}
        <div
          className={cn('mb-4 transition-all duration-500', statusCardStyle.className)}
          style={{ ...cardStyleBase, ...statusCardStyle.inlineStyle }}
        >
          {topBarStyleOverride && monthlyBudget > 0 && (
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
                  {DANISH_MONTHS[viewMonth - 1]} {viewYear}
                </p>
                {monthlyBudget > 0 && (
                  cfg.badgeCustom ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tracking-wide bg-gradient-to-r from-slate-700 to-slate-800 border border-yellow-400/40 shadow-sm">
                      <Crown className="h-2.5 w-2.5 text-yellow-400" />
                      <span className="text-yellow-300">Nuvio Flow</span>
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
            <button
              onClick={() => { setBudgetDraft(monthlyBudget > 0 ? String(monthlyBudget) : ''); setShowBudgetEditor(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-black/5 transition-all duration-200"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Rådighedsbeløb
            </button>
          </div>

          {monthlyBudget === 0 ? (
            <div className="px-4 pb-4 text-center">
              <p className="text-sm font-semibold text-foreground mb-1">Intet rådighedsbeløb sat</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sæt et månedligt beløb for at se din budgetstatus.
              </p>
            </div>
          ) : (
            <div className="px-4 pb-4 space-y-3">

              {/* Primary amount + headline */}
              <div className="flex items-end justify-between gap-4">
                <div>
                  {isCurrentMonth && (
                    <p className={cn('text-xs font-medium leading-snug mb-1', cfg.headlineColor)}>
                      {cfg.headline}
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
                {isCurrentMonth && !overBudget && (
                  <div className="flex gap-2 shrink-0">
                    <div className="rounded-xl bg-white/60 border border-black/5 px-3 py-2 text-center min-w-[56px]">
                      <p className="text-xs font-medium text-muted-foreground/70 leading-snug mb-0.5">Dage tilbage</p>
                      <p className="text-sm font-semibold tracking-tight text-foreground">{remainingDays}</p>
                    </div>
                    <div className={cn(
                      'rounded-xl border px-3 py-2 text-center min-w-[56px]',
                      (statusState === 'tempo' || statusState === 'kursen' || statusState === 'flow') ? 'bg-emerald-50/80 border-emerald-100/60' :
                      statusState === 'warn' ? 'bg-amber-50/80 border-amber-100/60' :
                      'bg-red-50/80 border-red-100/60'
                    )}>
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

              {/* Månedsscore */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                    Månedsscore
                  </span>
                  <div className="flex items-center gap-2">
                    {streak && streak.current_streak > 0 && (
                      <button
                        onClick={() => setShowStreakPopup(true)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/60 hover:bg-amber-100 transition-colors"
                      >
                        <Flame className="h-3 w-3 text-amber-500" />
                        <span className="text-xs font-bold tabular-nums text-amber-700">{streak.current_streak}</span>
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
                        'absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out shadow-sm',
                        !progressBarStyle && cn('bg-gradient-to-r', healthBarColor),
                        !progressBarStyle && (progressGlowColor ?? healthGlow),
                        isCurrentMonth && healthPct >= 60 && 'health-bar-pulse'
                      )}
                      style={{ width: `${healthBarPct}%`, ...(progressBarStyle ?? {}), boxShadow: progressGlowColor ? `0 0 6px 1px ${progressGlowColor}` : undefined }}
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

              {/* Ugebudget — integrated */}
              {weeklyStatus && (
                <div className="-mx-5 -mb-5 border-t border-black/5">
                  <button
                    onClick={() => setWeeklyExpanded(o => !o)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-black/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <CalendarDays className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div className="text-left">
                        <p className="text-xs font-semibold text-foreground">Ugebudget</p>
                        {currentWeek && isCurrentMonth ? (
                          <p className="text-label text-muted-foreground leading-snug">
                            {formatDKK(Math.round(weeklyStatus.effectiveWeeklyBudget))} denne uge
                          </p>
                        ) : (
                          <p className="text-label text-muted-foreground leading-snug">
                            {formatDKK(Math.round(weeklyStatus.weeklyBase))} pr. uge (base)
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {currentWeek && isCurrentMonth && (
                        <WeekPill week={currentWeek} effectiveBudget={weeklyStatus.effectiveWeeklyBudget} />
                      )}
                      <ChevronRight className={cn('h-4 w-4 text-muted-foreground/50 transition-transform duration-200', weeklyExpanded && 'rotate-90')} />
                    </div>
                  </button>

                  {weeklyExpanded && (
                    <div className="border-t border-border/40 divide-y divide-border/30">
                      <div className="px-5 py-3 bg-secondary/10">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Dagligt budget: {formatDKK(monthlyBudget)} / {new Date(viewYear, viewMonth, 0).getDate()} dage = {formatDKK(Math.round((monthlyBudget / new Date(viewYear, viewMonth, 0).getDate()) * 100) / 100)} pr. dag.
                          Uger der starter eller slutter midt i måneden beregnes efter faktisk antal dage. Overtræk fordeles ligeligt over de resterende uger.
                        </p>
                      </div>

                {(() => {
                  const nowStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
                  return weeklyStatus.weeks.map((week) => {
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
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Entry Form */}
        {isCurrentMonth && (
          <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/30 shadow-sm p-4 mb-4">
            <p className="text-sm font-semibold text-foreground mb-3">Tilføj udgift</p>

            <div className="space-y-2.5">
              <div className="relative">
                <input
                  ref={amountRef}
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={amountRaw}
                  onChange={e => { setAmountRaw(e.target.value); setError(null); }}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  className={cn(
                    'w-full h-12 rounded-xl border bg-background px-4 pr-16 text-xl font-semibold tracking-tight',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2',
                    'transition-all duration-200',
                    error ? 'border-red-300' : 'border-border'
                  )}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground pointer-events-none">
                  kr.
                </span>
              </div>

              <input
                type="text"
                placeholder="Note (valgfri)"
                value={note}
                onChange={e => setNote(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                maxLength={120}
                className={cn(
                  'w-full h-11 rounded-xl border border-border bg-background px-4 text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2',
                  'transition-all duration-200 placeholder:text-muted-foreground/50'
                )}
              />

              {error && (
                <p className="text-xs text-red-600 flex items-center gap-1.5">
                  <X className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}

              <button
                onClick={handleAdd}
                disabled={saving || !amountRaw}
                className={cn(
                  'nuvio-action-button w-full h-11 rounded-full text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2',
                  saved
                    ? 'bg-emerald-500 text-white scale-[0.98]'
                    : 'hover:shadow-md active:scale-[0.97]'
                )}
              >
                {saved ? (
                  <>
                    <Check className="h-4 w-4" />
                    Gemt
                  </>
                ) : saving ? (
                  <span className="animate-pulse">Gemmer…</span>
                ) : (
                  'Gem udgift'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Month Navigator + History */}
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/30 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold capitalize">
                {DANISH_MONTHS[viewMonth - 1]} {viewYear}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {expenses.length} poster · {formatDKK(totalSpent)}
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
              <p className="text-sm font-medium text-muted-foreground">Ingen udgifter dette måned</p>
              {isCurrentMonth && (
                <p className="text-xs text-muted-foreground/60 mt-1">Registrer din første udgift ovenfor</p>
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
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(exp.expense_date)}</p>
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
      {showBudgetEditor && (
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
          onSave={handleEditSave}
          onClose={() => setEditingExpense(null)}
        />
      )}

      {weekTransition.showBottomSheet && weekTransition.summaryData && (
        <WeekTransitionBottomSheet
          summaryData={weekTransition.summaryData}
          dismissCount={weekTransition.dismissCount}
          onOpen={weekTransition.onOpenWizard}
          onDismiss={weekTransition.onDismiss}
        />
      )}

      {weekTransition.showWizard && weekTransition.summaryData && (
        <WeekTransitionWizard
          summaryData={weekTransition.summaryData}
          cachedAiSummary={weekTransition.cachedAiSummary}
          monthlySavings={weekTransition.monthlySavings}
          onAcknowledge={weekTransition.onAcknowledge}
          onDismiss={weekTransition.onDismiss}
          onExpenseAdded={weekTransition.recomputeSummary}
        />
      )}

      {weekTransition.showFlowSavingsModal && weekTransition.summaryData && (
        <FlowSavingsModal
          summaryData={weekTransition.summaryData}
          currentBalance={weekTransition.flowSavingsTotals?.current_balance ?? 0}
          lifetimeTotal={weekTransition.flowSavingsTotals?.lifetime_total ?? 0}
          weekCount={weekTransition.flowSavingsTotals?.week_count ?? 0}
          onConfirm={weekTransition.onFlowSavingsConfirm}
          onDismiss={weekTransition.onFlowSavingsDismiss}
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
