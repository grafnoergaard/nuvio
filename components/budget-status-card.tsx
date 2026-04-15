'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TriangleAlert as AlertTriangle, Gauge, Star, Sparkles, Crown, Settings2, ChevronRight, Flame, Plus, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { useSettings, getCardStyle, getTopBarStyle } from '@/lib/settings-context';
import {
  getQuickExpensesForMonth,
  getMonthlyBudget,
  upsertMonthlyBudget,
  addQuickExpense,
  computeWeeklyCarryOver,
  updateWeeklyCarryOver,
  getStreak,
  getUserWeekStartDay,
  type QuickExpense,
  type QuickExpenseStreak,
  type WeeklyCarryOverSummary,
} from '@/lib/quick-expense-service';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toKuvertCopy } from '@/lib/kuvert-copy';

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
      return { className: 'rounded-2xl border shadow-sm', inlineStyle: badgeHexToCardStyle(hex) };
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

export default function BudgetStatusCard() {
  const { user } = useAuth();
  const { design } = useSettings();
  const router = useRouter();
  const now = new Date();

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [expenses, setExpenses] = useState<QuickExpense[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [flowStatusConfig, setFlowStatusConfig] = useState<FlowStatusConfig>(FLOW_STATUS_DEFAULTS);
  const [flowScoreThreshold, setFlowScoreThreshold] = useState<number>(0.15);
  const [weeklyStatus, setWeeklyStatus] = useState<WeeklyCarryOverSummary | null>(null);
  const [showBudgetEditor, setShowBudgetEditor] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [streak, setStreak] = useState<QuickExpenseStreak | null>(null);
  const [weekStartDay, setWeekStartDay] = useState<number>(1);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseSaved, setExpenseSaved] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [exps, budget, flowConfigEntries, streakData, userWeekStartDay] = await Promise.all([
        getQuickExpensesForMonth(currentYear, currentMonth),
        getMonthlyBudget(currentYear, currentMonth),
        supabase
          .from('standard_data_entries')
          .select('key, value_numeric, value_text')
          .eq('section', 'nuvio_flow'),
        getStreak(),
        getUserWeekStartDay(),
      ]);

      setExpenses(exps);
      setStreak(streakData);
      const budgetAmount = budget?.budget_amount ?? 0;
      setMonthlyBudget(budgetAmount);
      const flowMap = new Map((flowConfigEntries.data ?? []).map((e: any) => [e.key, e]));
      setFlowScoreThreshold((flowMap.get('NUVIO_FLOW_SCORE_PERFECT_THRESHOLD') as any)?.value_numeric ?? 0.15);
      setWeekStartDay(userWeekStartDay);

      if (flowConfigEntries.data && flowConfigEntries.data.length > 0) {
        const m = new Map(flowConfigEntries.data.map((e: any) => [e.key, e]));
        const n = (key: string, fallback: number) => (m.get(key) as any)?.value_numeric ?? fallback;
        const t = (key: string, fallback: string) => toKuvertCopy((m.get(key) as any)?.value_text ?? fallback);
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
        const weekly = computeWeeklyCarryOver(budgetAmount, currentYear, currentMonth, exps, now, userWeekStartDay);
        setWeeklyStatus(weekly);
        updateWeeklyCarryOver(currentYear, currentMonth, weekly.accumulatedCarryOver).catch(() => null);
      } else {
        setWeeklyStatus(null);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user, currentYear, currentMonth]);

  useEffect(() => { load(); }, [load]);

  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const remaining = monthlyBudget - totalSpent;
  const usedPct = monthlyBudget > 0 ? Math.min((totalSpent / monthlyBudget) * 100, 100) : 0;
  const overBudget = monthlyBudget > 0 && totalSpent > monthlyBudget;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = daysInMonth - now.getDate() + 1;
  const dailyAvailable = remainingDays > 0 && remaining > 0 ? remaining / remainingDays : 0;

  const carryOverPenalty = weeklyStatus ? Math.abs(Math.min(0, weeklyStatus.accumulatedCarryOver)) : 0;

  const { healthPct, healthBarPct, healthBarColor, healthGlow } = useMemo(() => {
    const rawFlowScore = (() => {
      if (monthlyBudget <= 0) return 0;
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
  }, [monthlyBudget, overBudget, totalSpent, remainingDays, daysInMonth, carryOverPenalty, flowScoreThreshold]);

  const progressColor = overBudget ? 'bg-red-500' : usedPct > 80 ? 'bg-amber-500' : 'bg-emerald-500';

  const fsc = flowStatusConfig;

  const statusState: 'over' | 'warn' | 'tempo' | 'kursen' | 'flow' = overBudget
    ? 'over'
    : healthPct < fsc.warnHealthMin ? 'warn'
    : healthPct >= fsc.flowHealthMin ? 'flow'
    : healthPct >= fsc.tempoHealthMin ? 'tempo'
    : 'kursen';

  const statusConfig = useMemo(() => ({
    over: {
      cardBg: fsc.colorOverCard,
      iconBg: 'bg-red-100',
      icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
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
      icon: <Gauge className="h-4 w-4 text-amber-600" />,
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
      icon: <Star className="h-4 w-4 text-emerald-600" />,
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
      icon: <Sparkles className="h-4 w-4 text-emerald-600" />,
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
      icon: <Crown className="h-4 w-4 text-white" />,
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

  async function handleAddExpense() {
    const parsed = parseFloat(expenseAmount.replace(',', '.'));
    if (!parsed || parsed <= 0 || parsed > 999999) {
      setExpenseError('Indtast et gyldigt beløb (1 – 999.999 kr.)');
      amountRef.current?.focus();
      return;
    }
    setExpenseSaving(true);
    setExpenseError(null);
    try {
      const exp = await addQuickExpense(parsed, expenseNote.trim() || null);
      const newExpenses = [exp, ...expenses];
      setExpenses(newExpenses);
      if (monthlyBudget > 0) {
        const weekly = computeWeeklyCarryOver(monthlyBudget, currentYear, currentMonth, newExpenses, now, weekStartDay);
        setWeeklyStatus(weekly);
        updateWeeklyCarryOver(currentYear, currentMonth, weekly.accumulatedCarryOver).catch(() => null);
      }
      setExpenseSaved(true);
      setTimeout(() => {
        setExpenseSaved(false);
        setShowAddExpense(false);
        setExpenseAmount('');
        setExpenseNote('');
      }, 1200);
    } catch {
      setExpenseError('Kunne ikke gemme. Prøv igen.');
    } finally {
      setExpenseSaving(false);
    }
  }

  async function handleSaveBudget() {
    const parsed = parseFloat(budgetDraft.replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) return;
    try {
      await upsertMonthlyBudget(currentYear, currentMonth, parsed);
      setMonthlyBudget(parsed);
      const weekly = computeWeeklyCarryOver(parsed, currentYear, currentMonth, expenses, now, weekStartDay);
      setWeeklyStatus(weekly);
      updateWeeklyCarryOver(currentYear, currentMonth, weekly.accumulatedCarryOver).catch(() => null);
      setShowBudgetEditor(false);
    } catch {
      // silent
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card shadow-sm animate-pulse" style={{ height: 140 }} />
    );
  }

  return (
    <>
      <div
        className={cn('transition-all duration-500', statusCardStyle.className)}
        style={{ ...cardStyleBase, ...statusCardStyle.inlineStyle }}
      >
        {topBarStyleOverride && monthlyBudget > 0 && (
          <div style={topBarStyleOverride} />
        )}

        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-2 transition-all duration-500',
              monthlyBudget > 0 ? cfg.iconBg : 'bg-muted/20',
              monthlyBudget > 0 ? cfg.ringColor : 'ring-muted/10'
            )}>
              {monthlyBudget > 0 ? cfg.icon : <Star className="h-4 w-4 text-muted-foreground/40" />}
            </div>
            <div>
              <p className="text-label font-semibold uppercase tracking-widest text-muted-foreground/50 leading-none mb-0.5">
                {DANISH_MONTHS[currentMonth - 1]} {currentYear}
              </p>
              {monthlyBudget > 0 && (
                cfg.badgeCustom ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tracking-wide bg-gradient-to-r from-slate-700 to-slate-800 border border-yellow-400/40 shadow-sm">
                    <Crown className="h-2.5 w-2.5 text-yellow-400" />
                    <span className="text-yellow-300">Udgifter</span>
                  </span>
                ) : cfg.badgeBg.startsWith('bg-[') ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold tracking-wide text-white" style={{ backgroundColor: cfg.badgeBg.slice(4, -1) }}>
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setBudgetDraft(monthlyBudget > 0 ? String(monthlyBudget) : ''); setShowBudgetEditor(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-black/5 transition-all duration-200"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Rådighedsbeløb
            </button>
            <button
              onClick={() => router.push('/udgifter')}
              className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {monthlyBudget === 0 ? (
          <div className="px-5 pb-6 text-center">
            <p className="text-sm font-semibold text-foreground mb-1">Intet rådighedsbeløb sat</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sæt et månedligt beløb for at se din budgetstatus.
            </p>
            <button
              onClick={() => router.push('/udgifter')}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
            >
              Åbn Udgifter <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="px-5 pb-5 space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className={cn('text-xs font-medium leading-snug mb-1', cfg.headlineColor)}>
                  {cfg.headline}
                </p>
                <p className={cn('text-3xl font-semibold tracking-tight tabular-nums leading-none', cfg.amountColor)}>
                  {formatDKK(Math.abs(remaining))}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {overBudget ? 'over budget' : 'tilbage af ' + formatDKK(monthlyBudget)}
                </p>
              </div>
              {!overBudget && (
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

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground tracking-wide">Din Score</span>
                <div className="flex items-center gap-2">
                  {streak && streak.current_streak > 0 && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/60">
                      <Flame className="h-3 w-3 text-amber-500" />
                      <span className="text-xs font-bold tabular-nums text-amber-700">{streak.current_streak}</span>
                    </div>
                  )}
                  {!overBudget && (
                    <span className={cn('text-xs font-bold tabular-nums', cfg.amountColor)}>{healthPct}</span>
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
                      healthPct >= 60 && 'health-bar-pulse'
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
                  : `${formatDKK(totalSpent)} brugt · ${formatDKK(Math.round(dailyAvailable))} pr. dag`
                }
              </p>
            </div>

            {overBudget && (
              <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-black/5">
                <span>{formatDKK(totalSpent)} brugt</span>
                <span>{formatDKK(monthlyBudget)} i alt</span>
              </div>
            )}

            <div className="-mx-5 -mb-5 border-t border-black/5">
              <button
                onClick={() => { setShowAddExpense(true); setExpenseError(null); setTimeout(() => amountRef.current?.focus(), 80); }}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50/60 transition-colors rounded-b-2xl"
              >
                <Plus className="h-4 w-4" />
                Tilføj udgift
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddExpense && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 sm:p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}>
          <div
            className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            style={{ animation: 'slideUp 260ms cubic-bezier(0.22,1,0.36,1) forwards' }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold">Tilføj udgift</h2>
                <button
                  onClick={() => { setShowAddExpense(false); setExpenseAmount(''); setExpenseNote(''); setExpenseError(null); }}
                  className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2.5">
                <div className="relative">
                  <input
                    ref={amountRef}
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={expenseAmount}
                    onChange={e => { setExpenseAmount(e.target.value); setExpenseError(null); }}
                    onKeyDown={e => e.key === 'Enter' && handleAddExpense()}
                    className={cn(
                      'w-full h-14 rounded-2xl border bg-muted/30 px-5 pr-16 text-2xl font-semibold tracking-tight',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2',
                      'transition-all duration-200',
                      expenseError ? 'border-red-300' : 'border-border/50'
                    )}
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground pointer-events-none">
                    kr.
                  </span>
                </div>

                <input
                  type="text"
                  placeholder="Note (valgfri)"
                  value={expenseNote}
                  onChange={e => setExpenseNote(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddExpense()}
                  maxLength={120}
                  className={cn(
                    'w-full h-12 rounded-2xl border border-border/50 bg-muted/30 px-5 text-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2',
                    'transition-all duration-200 placeholder:text-muted-foreground/50'
                  )}
                />

                {expenseError && (
                  <p className="text-xs text-red-600 flex items-center gap-1.5 px-1">
                    <X className="h-3.5 w-3.5 shrink-0" />
                    {expenseError}
                  </p>
                )}

                <button
                  onClick={handleAddExpense}
                  disabled={expenseSaving || (!expenseAmount && !expenseSaved)}
                  className={cn(
                    'nuvio-action-button w-full h-13 rounded-full text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 mt-1',
                    expenseSaved
                      ? 'bg-emerald-500 text-white scale-[0.98]'
                      : 'text-white'
                  )}
                  style={{ height: '52px' }}
                >
                  {expenseSaved ? (
                    <>
                      <Check className="h-4 w-4" />
                      Gemt
                    </>
                  ) : expenseSaving ? (
                    <span className="animate-pulse">Gemmer…</span>
                  ) : (
                    'Gem udgift'
                  )}
                </button>
              </div>
            </div>
          </div>
          <style jsx>{`
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {showBudgetEditor && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Rådighedsbeløb</h2>
                <button onClick={() => setShowBudgetEditor(false)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                Hvad er dit månedlige rådighedsbeløb for {DANISH_MONTHS[currentMonth - 1]}?
              </p>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Beløb (kr.)</Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      value={budgetDraft}
                      onChange={e => setBudgetDraft(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveBudget()}
                      className="h-11 rounded-xl pr-12"
                      placeholder="f.eks. 5000"
                      autoFocus
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">kr.</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1 rounded-xl h-10" onClick={() => setShowBudgetEditor(false)}>Annuller</Button>
                  <Button className="flex-1 rounded-xl h-10" onClick={handleSaveBudget}>Gem</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
