'use client';

import { useState, type CSSProperties } from 'react';
import { Flame, Palmtree, Plus, Trophy, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuickExpense, QuickExpenseStreak, QuickExpenseWeeklyStreak, WeeklyCarryOverSummary } from '@/lib/quick-expense-service';
import type { VacationMode } from '@/lib/vacation-mode-service';
import type { FlowStatusConfig } from '@/hooks/use-home-data';
import type { KuvertHomeVariant } from '@/lib/kuvert-home-variant';
import { QuickExpenseInlineForm } from '@/components/quick-expense-inline-form';
import { computeKuvertLiveScore } from '@/lib/kuvert-live-score';
import { getCardStyle, getTopBarStyle, useSettings } from '@/lib/settings-context';
import { getVacationBudgetDayStatuses } from '@/lib/vacation-budget';
import { getNormalUntilVacationPeriod } from '@/lib/normal-until-vacation';
import {
  getVacationAccentColor,
  getVacationAccentMid,
  getVacationAccentSoft,
  getVacationTopBarCard,
  VACATION_CARD_STROKE,
  withAlpha,
} from '@/lib/vacation-theme';

interface KuvertHeroCardProps {
  quickStreak: QuickExpenseStreak | null;
  weeklyStreak: QuickExpenseWeeklyStreak | null;
  flowMonthlyBudget: number;
  flowMonthlySpent: number;
  flowScoreThreshold: number;
  flowStatusConfig: FlowStatusConfig;
  flowWeeklyStatus: WeeklyCarryOverSummary | null;
  quickExpenses: QuickExpense[];
  vacationMode?: VacationMode | null;
  plannedVacationMode?: VacationMode | null;
  showStreak: boolean;
  showQuickExpense: boolean;
  onShowQuickExpense: () => void;
  onQuickExpenseSaved: () => void;
  onPlanVacation?: () => void;
  onEndVacation?: () => void;
  variant: KuvertHomeVariant;
}

const WEEKS_PER_STREAK_MONTH = 4;

const DANISH_MONTHS = [
  'Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'December',
];

function getStreakTone(currentStreak: number) {
  if (currentStreak >= 12) return { label: 'Legendarisk', accent: '#5FE7C2', badge: 'bg-[#2ED3A7]/16 text-[#0E3B43] border-[#2ED3A7]/35' };
  if (currentStreak >= 6) return { label: 'Stærk rytme', accent: '#5FE7C2', badge: 'bg-[#2ED3A7]/16 text-[#0E3B43] border-[#2ED3A7]/35' };
  if (currentStreak >= 1) return { label: 'Aktiv', accent: '#5FE7C2', badge: 'bg-[#2ED3A7]/16 text-[#0E3B43] border-[#2ED3A7]/35' };
  return { label: 'Klar', accent: '#94a3b8', badge: 'bg-slate-100 text-slate-700 border-slate-200' };
}

function getCumulativeScoreTier(score: number) {
  if (score >= 2000) return { label: 'Legendarisk', accent: '#0E3B43', badge: 'bg-[#0E3B43] text-white border-[#0E3B43]/70' };
  if (score >= 900) return { label: 'Mester', accent: '#0E3B43', badge: 'bg-[#0E3B43]/90 text-white border-[#0E3B43]/60' };
  if (score >= 400) return { label: 'Erfaren', accent: '#0E3B43', badge: 'bg-[#0E3B43]/16 text-[#0E3B43] border-[#0E3B43]/20' };
  if (score >= 150) return { label: 'Aktiv', accent: '#0E3B43', badge: 'bg-[#2ED3A7]/16 text-[#0E3B43] border-[#2ED3A7]/35' };
  return { label: 'Begynder', accent: '#64748b', badge: 'bg-slate-100 text-slate-700 border-slate-200' };
}

function formatDKK(value: number): string {
  return value.toLocaleString('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function extractBadgeHex(badgeValue: string): string | null {
  const m = badgeValue.match(/bg-\[([^\]]+)\]/);
  return m ? m[1] : null;
}

function badgeHexToCardStyle(hex: string): CSSProperties {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    background: `linear-gradient(to bottom right, rgba(${r},${g},${b},0.10), rgba(${r},${g},${b},0.04), #ffffff)`,
    borderColor: `rgba(${r},${g},${b},0.20)`,
  };
}

function hexToRgbString(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function resolveFlowCardStyle(cardBgValue: string, badgeBgValue?: string): { className: string; inlineStyle: CSSProperties | undefined } {
  if (badgeBgValue) {
    const hex = extractBadgeHex(badgeBgValue);
    if (hex) return { className: 'border shadow-sm', inlineStyle: badgeHexToCardStyle(hex) };
  }
  const hexMatch = cardBgValue.match(/from-\[([^\]]+)\]\s+via-\[([^\]]+)\]\s+to-\[([^\]]+)\]/);
  if (hexMatch) {
    return {
      className: 'border shadow-sm',
      inlineStyle: {
        background: `linear-gradient(to bottom right, ${hexMatch[1]}, ${hexMatch[2]}, ${hexMatch[3]})`,
        borderColor: `${hexMatch[1]}99`,
      },
    };
  }
  return { className: cn('border shadow-sm', cardBgValue), inlineStyle: undefined };
}

function getWeekProgressPct(weekStart: string, weekEnd: string, now: Date): number {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(`${weekEnd}T23:59:59.999`);
  const total = end.getTime() - start.getTime();
  if (!Number.isFinite(total) || total <= 0) return 0;
  const elapsed = now.getTime() - start.getTime();
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

function getDaysLeftInRange(end: Date | string, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDate = end instanceof Date ? end : new Date(`${end}T00:00:00`);
  const rangeEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.max(0, Math.floor((rangeEnd.getTime() - today.getTime()) / 86400000) + 1);
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function toIsoDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getInclusiveDays(startDate: string, endDate: string): number {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
}

type StreakPeriodItem = {
  iso_week_number: number;
  week_start: string;
  week_end: string;
  kept_budget?: boolean;
  is_completed?: boolean;
  is_current?: boolean;
  label?: string;
};

function getVisibleStreakItems<T extends { is_current?: boolean }>(items: T[], maxItems = 5): T[] {
  if (items.length <= maxItems) return items;
  const currentIndex = items.findIndex(item => item.is_current);
  if (currentIndex === -1) return items.slice(0, maxItems);
  const start = Math.min(Math.max(0, currentIndex - 2), Math.max(0, items.length - maxItems));
  return items.slice(start, start + maxItems);
}

function buildVacationDayItems(vacationMode: VacationMode, expenses: QuickExpense[], now: Date): StreakPeriodItem[] {
  return getVacationBudgetDayStatuses(vacationMode, expenses, now).map(day => ({
    iso_week_number: day.index,
    week_start: day.date,
    week_end: day.date,
    label: `Dag ${day.index}`,
    is_current: day.isCurrent,
    is_completed: day.isPast,
    kept_budget: day.keptBudget,
  }));
}

function getStreakPeriodLabel(period: { label?: string; iso_week_number: number }): string {
  return period.label ?? `Uge ${period.iso_week_number}`;
}

export function KuvertHeroCard({
  quickStreak,
  weeklyStreak,
  flowMonthlyBudget,
  flowMonthlySpent,
  flowScoreThreshold,
  flowStatusConfig,
  flowWeeklyStatus,
  quickExpenses,
  vacationMode,
  plannedVacationMode,
  showStreak,
  showQuickExpense,
  onShowQuickExpense,
  onQuickExpenseSaved,
  onPlanVacation,
  onEndVacation,
  variant,
}: KuvertHeroCardProps) {
  const [showStreakInfo, setShowStreakInfo] = useState(false);
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const { design } = useSettings();
  const vacationAccent = getVacationAccentColor(design);
  const vacationAccentMid = getVacationAccentMid(vacationAccent);
  const vacationAccentSoft = getVacationAccentSoft(vacationAccent);

  const now = new Date();
  const activeVacation = vacationMode?.status === 'active' ? vacationMode : null;
  const isVacationMode = Boolean(activeVacation);
  const vacationExpenses = activeVacation
    ? quickExpenses.filter(expense => expense.mode === 'vacation' && expense.vacation_mode_id === activeVacation.id)
    : [];
  const vacationTotalDays = activeVacation
    ? Math.max(1, activeVacation.number_of_days || getInclusiveDays(activeVacation.start_date, activeVacation.end_date))
    : 0;
  const vacationBudget = activeVacation ? Number(activeVacation.budget_amount) || 0 : 0;
  const vacationSpent = vacationExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const vacationDayItems = activeVacation ? buildVacationDayItems(activeVacation, vacationExpenses, now) : [];
  const vacationStreakCount = vacationDayItems.filter(day => day.kept_budget === true).length;
  const vacationVisibleDays = getVisibleStreakItems(vacationDayItems);

  const currentWeekStreak = isVacationMode ? vacationStreakCount : (weeklyStreak?.current_streak ?? 0);
  const longestWeekStreak = isVacationMode ? Math.max(vacationStreakCount, vacationDayItems.filter(day => day.is_completed || day.is_current).length) : (weeklyStreak?.longest_streak ?? 0);
  const tone = isVacationMode
    ? { label: 'Ferie', accent: vacationAccent, badge: 'border-[#0E3B43]/10 bg-white/60 text-[#0E3B43]' }
    : getStreakTone(currentWeekStreak);
  const hasWeekStreak = isVacationMode ? true : currentWeekStreak > 0;
  const completedStreakMonths = Math.floor(currentWeekStreak / WEEKS_PER_STREAK_MONTH);
  const bestWeekStreak = Math.max(longestWeekStreak, currentWeekStreak);
  const recordProgress = bestWeekStreak > 0 ? Math.min(100, Math.max(12, (currentWeekStreak / bestWeekStreak) * 100)) : 0;
  const periodScoreLabel = 'Budgetstatus';
  const streakWeekKeys = new Set((weeklyStreak?.streak_weeks ?? []).map(week => `${week.week_start}-${week.week_end}`));
  const normalMonthWeeks = weeklyStreak?.current_month_weeks?.length
    ? weeklyStreak.current_month_weeks
    : (weeklyStreak?.streak_weeks ?? []).slice(-WEEKS_PER_STREAK_MONTH).map(week => ({
        ...week,
        kept_budget: true,
        is_completed: true,
        is_current: false,
      }));
  const monthWeeks = isVacationMode ? vacationVisibleDays : normalMonthWeeks;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const cumulativeScoreSegments = [
    { label: 'Begynder', min: 0 },
    { label: 'Aktiv', min: 150 },
    { label: 'Erfaren', min: 400 },
    { label: 'Mester', min: 900 },
    { label: 'Legendarisk', min: 2000 },
  ];
  const currentWeekStatus = flowWeeklyStatus?.weeks.find(week => week.isCurrentWeek) ?? null;
  const normalUntilVacationPeriod = !isVacationMode
    ? getNormalUntilVacationPeriod(plannedVacationMode ?? null, now.getFullYear(), now.getMonth() + 1, now)
    : null;
  const budgetPeriodLabel = isVacationMode ? 'Feriebudget' : currentWeekStatus ? 'Ugebudget' : 'Budget';
  const activeBudget = isVacationMode ? vacationBudget : (currentWeekStatus?.effectiveBudget ?? flowMonthlyBudget);
  const activeSpent = isVacationMode ? vacationSpent : (currentWeekStatus?.spent ?? flowMonthlySpent);
  const activePeriodDays = isVacationMode
    ? vacationTotalDays
    : (currentWeekStatus?.daysInMonth ?? normalUntilVacationPeriod?.totalDays ?? daysInMonth);
  const scoreBudget = isVacationMode ? vacationBudget : flowMonthlyBudget;
  const scoreSpent = isVacationMode ? vacationSpent : flowMonthlySpent;
  const scoreTotalDays = isVacationMode ? vacationTotalDays : (normalUntilVacationPeriod?.totalDays ?? daysInMonth);
  const monthlyRemaining = scoreBudget - scoreSpent;
  const monthlyRemainingDays = activeVacation
    ? getDaysLeftInRange(activeVacation.end_date, now)
    : (normalUntilVacationPeriod?.remainingDays ?? (daysInMonth - now.getDate() + 1));
  const monthlyDailyAvailable = monthlyRemainingDays > 0 && monthlyRemaining > 0 ? monthlyRemaining / monthlyRemainingDays : 0;
  const monthlyOverBudget = scoreBudget > 0 && scoreSpent > scoreBudget;
  const carryOverPenalty = !isVacationMode && flowWeeklyStatus ? Math.abs(Math.min(0, flowWeeklyStatus.accumulatedCarryOver)) : 0;
  const remainingDays = activeVacation
    ? getDaysLeftInRange(activeVacation.end_date, now)
    : currentWeekStatus
    ? getDaysLeftInRange(currentWeekStatus.weekEnd, now)
    : (normalUntilVacationPeriod?.remainingDays ?? (daysInMonth - now.getDate() + 1));
  const remaining = activeBudget - activeSpent;
  const overBudget = activeBudget > 0 && activeSpent > activeBudget;
  const dailyAvailable = remainingDays > 0 && remaining > 0 ? remaining / remainingDays : 0;
  const usedPct = activeBudget > 0 ? Math.min(100, (activeSpent / activeBudget) * 100) : 0;
  const flowScore = (() => {
    if (activeBudget <= 0) return 0;
    if (overBudget) return 0;
    if (remainingDays <= 0) return remaining >= 0 ? 100 : 0;
    const idealDailyRate = activeBudget / activePeriodDays;
    const affordableDailyRate = remaining / remainingDays;
    const recoveryRatio = idealDailyRate > 0 ? affordableDailyRate / idealDailyRate : 0;
    if (recoveryRatio >= 1 + flowScoreThreshold) return 100;
    if (recoveryRatio <= 0) return 0;
    return Math.round(Math.max(0, Math.min(100, (recoveryRatio / (1 + flowScoreThreshold)) * 100)));
  })();
  const flowBarPct = Math.min(100, Math.max(4, flowScore));
  const flowBarColor = flowScore >= 60 ? 'from-emerald-400 to-teal-400' : flowScore >= 30 ? 'from-amber-400 to-orange-300' : 'from-red-400 to-rose-400';
  const flowGlow = flowScore >= 60 ? 'shadow-emerald-300/60' : flowScore >= 30 ? 'shadow-amber-300/60' : 'shadow-red-300/60';
  const monthScore = (() => {
    if (scoreBudget <= 0) return 0;
    if (monthlyOverBudget) return 0;
    if (monthlyRemainingDays <= 0) return monthlyRemaining >= 0 ? 100 : 0;
    const idealDailyRate = scoreBudget / scoreTotalDays;
    const affordableDailyRate = monthlyRemaining / monthlyRemainingDays;
    const recoveryRatio = idealDailyRate > 0 ? affordableDailyRate / idealDailyRate : 0;
    const carryOverPenaltyRatio = scoreBudget > 0 ? carryOverPenalty / scoreBudget : 0;
    const penaltyFactor = Math.max(0, 1 - carryOverPenaltyRatio * 2);
    const baseScore = (() => {
      if (recoveryRatio >= 1 + flowScoreThreshold) return 100;
      if (recoveryRatio <= 0) return 0;
      return Math.max(0, Math.min(100, (recoveryRatio / (1 + flowScoreThreshold)) * 100));
    })();
    return Math.round(baseScore * penaltyFactor);
  })();
  const cumulativeScore = computeKuvertLiveScore({
    permanentScore: quickStreak?.cumulative_score ?? 0,
    monthScore,
    currentWeekBudget: currentWeekStatus?.effectiveBudget ?? (isVacationMode ? activeBudget : null),
    currentWeekSpent: currentWeekStatus?.spent ?? (isVacationMode ? activeSpent : null),
    currentWeekDaysInPeriod: currentWeekStatus?.daysInMonth ?? (isVacationMode ? activePeriodDays : null),
    currentWeekDaysRemaining: currentWeekStatus || isVacationMode ? remainingDays : null,
    flowScoreThreshold,
  }).displayScore;
  const displayScore = cumulativeScore;
  const scoreSegments = cumulativeScoreSegments;
  const segmentProgressScore = cumulativeScore;
  const nextCumulativeMilestone = scoreSegments.find((segment) => segment.min > segmentProgressScore) ?? null;
  const cumulativeScoreTier = getCumulativeScoreTier(displayScore);
  const monthScoreBarPct = Math.min(100, Math.max(4, monthScore));
  const monthScoreBarColor = monthScore >= 60 ? 'from-emerald-400 to-teal-400' : monthScore >= 30 ? 'from-amber-400 to-orange-300' : 'from-red-400 to-rose-400';
  const monthScoreGlow = monthScore >= 60 ? 'shadow-emerald-300/60' : monthScore >= 30 ? 'shadow-amber-300/60' : 'shadow-red-300/60';
  const fsc = flowStatusConfig;
  const statusState: 'over' | 'warn' | 'tempo' | 'kursen' | 'flow' = overBudget
    ? 'over'
    : flowScore < fsc.warnHealthMin
      ? 'warn'
      : flowScore >= fsc.flowHealthMin
        ? 'flow'
        : flowScore >= fsc.tempoHealthMin
          ? 'tempo'
          : 'kursen';
  const flowStatus = {
    over: {
      cardBg: fsc.colorOverCard,
      badgeBg: fsc.colorOverBadge,
      amountColor: 'text-red-600',
      headlineColor: 'text-red-700',
    },
    warn: {
      cardBg: fsc.colorWarnCard,
      badgeBg: fsc.colorWarnBadge,
      amountColor: 'text-amber-700',
      headlineColor: 'text-amber-800',
    },
    kursen: {
      cardBg: fsc.colorGoodCard,
      badgeBg: fsc.colorKursenBadge,
      amountColor: 'text-emerald-700',
      headlineColor: 'text-emerald-800',
    },
    tempo: {
      cardBg: fsc.colorGoodCard,
      badgeBg: fsc.colorTempoBadge,
      amountColor: 'text-emerald-700',
      headlineColor: 'text-emerald-800',
    },
    flow: {
      cardBg: fsc.colorFlowCard,
      badgeBg: fsc.colorFlowBadge,
      amountColor: 'text-slate-700',
      headlineColor: 'text-slate-800',
    },
  }[statusState];
  const statusCardStyle = resolveFlowCardStyle(flowStatus.cardBg, flowStatus.badgeBg);
  const badgeHex = extractBadgeHex(flowStatus.badgeBg);
  const activeAccent = isVacationMode ? vacationAccent : (badgeHex ?? '#2ED3A7');
  const flameStart = isVacationMode ? vacationAccent : '#2ED3A7';
  const flameMid = isVacationMode ? vacationAccentMid : '#8FF1D7';
  const flameEnd = isVacationMode ? vacationAccentSoft : '#BFF8EA';
  const progressBarStyle = isVacationMode
    ? { background: `linear-gradient(to right, ${withAlpha(vacationAccent, 0.8)}, ${vacationAccentMid})` } as CSSProperties
    : badgeHex
      ? { background: `linear-gradient(to right, ${badgeHex}cc, ${badgeHex})` } as CSSProperties
      : undefined;
  const progressDotColor = isVacationMode ? vacationAccent : (badgeHex ?? (overBudget ? '#ef4444' : flowScore >= 60 ? '#34d399' : '#fbbf24'));
  const progressGlowColor = isVacationMode ? withAlpha(vacationAccent, 0.34) : (badgeHex ? `${badgeHex}55` : undefined);
  const showScoreInHero =
    variant === 'score_streak_focus' ||
    variant === 'score_streak_focus_native' ||
    variant === 'score_streak_focus_native_cards';
  const isNativeHero =
    variant === 'score_streak_focus_native' ||
    variant === 'score_streak_focus_native_cards';
  const isSplitCards = variant === 'score_streak_focus_native_cards';
  const nativeToneRgb = hexToRgbString(tone.accent);
  const nativeBadgeRgb = badgeHex ? hexToRgbString(badgeHex) : nativeToneRgb;
  const streakPanelStyle: CSSProperties | undefined = isNativeHero ? { background: 'transparent' } : undefined;
  const budgetPanelStyle: CSSProperties | undefined = isNativeHero ? { background: 'transparent' } : statusCardStyle.inlineStyle;
  const nativeCardClass = 'relative overflow-hidden rounded-[28px] border border-foreground/8 bg-white';
  const cardHeadingClass = 'mb-0.5 text-[0.95rem] font-medium leading-snug text-foreground/82';
  const splitCardBackground = isVacationMode
    ? `linear-gradient(to bottom right, ${withAlpha(vacationAccentSoft, 0.86)}, rgba(255,255,255,0.68), #ffffff)`
    : 'linear-gradient(to bottom right, rgba(236,253,245,0.80), rgba(240,253,250,0.30), #ffffff)';
  const activeLargeCard = isVacationMode ? getVacationTopBarCard(design.cardLarge, vacationAccent) : design.cardLarge;
  const activeMediumCard = isVacationMode ? getVacationTopBarCard(design.cardMedium, vacationAccent) : design.cardMedium;
  const activeGradientTo = isVacationMode ? vacationAccent : design.gradientTo;
  const splitLargeCardStyle: CSSProperties = {
    ...getCardStyle(activeLargeCard, design.gradientFrom, activeGradientTo),
    background: splitCardBackground,
    ...(isVacationMode ? { borderColor: VACATION_CARD_STROKE } : {}),
  };
  const splitMediumCardStyle: CSSProperties = {
    ...getCardStyle(activeMediumCard, design.gradientFrom, activeGradientTo),
    background: splitCardBackground,
    ...(isVacationMode ? { borderColor: VACATION_CARD_STROKE } : {}),
  };
  const splitLargeTopBarStyle = getTopBarStyle(activeLargeCard, design.gradientFrom, activeGradientTo);
  const splitMediumTopBarStyle = getTopBarStyle(activeMediumCard, design.gradientFrom, activeGradientTo);

  return (
    <>
      <section
        className="relative w-full overflow-hidden bg-transparent"
      >
        <div className="pb-3 pt-0 sm:pb-4 sm:pt-1">
        {isSplitCards && !isVacationMode && onPlanVacation && (
          <div className="mb-2.5 flex items-center justify-start px-1 pt-[max(0.2rem,env(safe-area-inset-top,0px))] sm:mb-3 sm:pt-1">
            <button
              type="button"
              onClick={onPlanVacation}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.72rem] font-semibold text-[#0E3B43] transition-transform active:scale-[0.98] sm:text-[0.76rem]"
              style={{
                borderColor: withAlpha(vacationAccent, 0.35),
                backgroundColor: withAlpha(vacationAccent, 0.12),
              }}
            >
              <Palmtree className="h-3.5 w-3.5" />
              Planlæg ferie
            </button>
          </div>
        )}

        {isSplitCards && isVacationMode && onEndVacation && (
          <div className="mb-2.5 flex items-center justify-start px-1 pt-[max(0.2rem,env(safe-area-inset-top,0px))] sm:mb-3 sm:pt-1">
            <button
              type="button"
              onClick={onEndVacation}
              className="inline-flex items-center gap-1.5 rounded-full border bg-white/80 px-3 py-1.5 text-[0.72rem] font-semibold text-[#0E3B43] transition-transform active:scale-[0.98] sm:text-[0.76rem]"
              style={{ borderColor: withAlpha(vacationAccent, 0.35) }}
            >
              <Palmtree className="h-3.5 w-3.5" />
              Afslut ferie
            </button>
          </div>
        )}

        {showStreak && (
          <>
            {showScoreInHero ? (
              <div
                className={cn(
                  isNativeHero ? 'mt-0.5 sm:mt-4' : 'mt-1',
                  isSplitCards && nativeCardClass,
                  isSplitCards && 'px-4 pb-3 pt-2.5 sm:px-5 sm:pb-4 sm:pt-3'
                )}
                style={isSplitCards ? splitLargeCardStyle : undefined}
              >
                {isSplitCards && splitLargeTopBarStyle && (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 z-[1]"
                    style={splitLargeTopBarStyle}
                  />
                )}
                <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
                  <defs>
                    <linearGradient id="kuvert-flame-gradient" x1="4" y1="4" x2="20" y2="21" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor={flameStart} />
                      <stop offset="58%" stopColor={flameMid} />
                      <stop offset="100%" stopColor={flameEnd} />
                    </linearGradient>
                  </defs>
                </svg>

                <div className={cn(
                  'grid gap-x-3 gap-y-0.5',
                  isSplitCards
                    ? hasWeekStreak
                      ? 'grid-cols-[minmax(0,1fr)_5.4rem] items-end sm:grid-cols-[minmax(0,1fr)_10rem] sm:gap-x-5'
                      : 'grid-cols-1 items-start'
                    : isNativeHero
                      ? hasWeekStreak
                        ? 'grid-cols-[minmax(0,1fr)_6.5rem] items-start sm:grid-cols-[minmax(0,1fr)_13rem] sm:gap-x-6'
                        : 'grid-cols-1 items-start'
                      : 'items-end sm:grid-cols-[minmax(0,1fr)_15rem]'
                )}>
                  <button
                    type="button"
                    onClick={() => setShowScoreInfo(true)}
                    className={cn(
                      'min-w-0 text-left outline-none transition-transform duration-200 active:scale-[0.99]',
                      isSplitCards ? 'flex h-full flex-col justify-end pt-2 sm:pt-3' : isNativeHero ? 'pt-0' : 'pt-4'
                    )}
                    aria-label="Læs om Kuvert Score"
                  >
                    <div className={cn(isSplitCards ? 'mt-0' : isNativeHero ? 'mt-0' : 'mt-1')}>
                      <p className={cn(
                        isSplitCards
                          ? 'mb-[-0.12rem] text-[0.95rem] font-medium leading-none text-foreground/82'
                          : isNativeHero
                            ? 'mb-[-0.28rem] text-[0.82rem] font-medium leading-none text-foreground/66 sm:text-[0.9rem]'
                            : 'mb-3 text-base font-medium text-muted-foreground/75'
                      )}>
                        Din score
                      </p>
                      <p className={cn(
                        'font-semibold leading-[0.82] tracking-tight tabular-nums text-[#0E3B43]',
                        isSplitCards
                          ? 'text-left text-[3.05rem] sm:text-[4.25rem]'
                          : isNativeHero
                            ? 'text-left text-[3.65rem] sm:text-[5rem]'
                            : 'text-7xl sm:text-8xl'
                      )}>
                        {displayScore}
                      </p>
                    </div>
                  </button>

                  {hasWeekStreak && (
                    <button
                      type="button"
                      onClick={() => setShowStreakInfo(true)}
                      className={cn(
                        'group flex flex-col outline-none transition-transform duration-200 active:scale-[0.99]',
                        isSplitCards
                          ? 'mt-0 w-[5.4rem] self-end justify-self-end items-center text-center sm:w-auto sm:items-end sm:text-right'
                          : isNativeHero
                            ? 'w-[6.5rem] justify-self-end items-center text-center sm:w-auto sm:items-end sm:text-right'
                            : 'items-center text-center'
                      )}
                      aria-label="Læs om streak-funktionen"
                    >
                      <div className={cn(
                        'flex w-full items-start',
                        isSplitCards
                          ? 'h-[4.5rem] justify-center sm:h-[6.4rem] sm:justify-end'
                          : isNativeHero
                            ? 'h-[6rem] justify-center sm:h-[8.5rem] sm:justify-end'
                            : 'justify-center h-[10rem]'
                      )}>
                        <div className={cn(
                          'relative',
                          isSplitCards
                            ? 'h-[4.5rem] w-[4.5rem] sm:h-[6.4rem] sm:w-[6.4rem]'
                            : isNativeHero
                              ? 'h-[6rem] w-[6rem] sm:h-[8.5rem] sm:w-[8.5rem]'
                              : 'h-[10rem] w-[10rem]'
                        )}>
                          <Flame
                            className={cn(
                              'transition-transform duration-200 group-hover:scale-[1.02]',
                              isSplitCards
                                ? 'h-[4.5rem] w-[4.5rem] sm:h-[6.4rem] sm:w-[6.4rem]'
                                : isNativeHero
                                  ? 'h-[6rem] w-[6rem] sm:h-[8.5rem] sm:w-[8.5rem]'
                                  : 'h-[10rem] w-[10rem] drop-shadow-sm'
                            )}
                            fill="url(#kuvert-flame-gradient)"
                            stroke="url(#kuvert-flame-gradient)"
                            strokeWidth={1.5}
                          />
                          <span className={cn(
                            'absolute inset-0 flex items-center justify-center font-semibold tabular-nums leading-none tracking-normal text-[#0E3B43]',
                            isSplitCards
                              ? 'translate-x-[0.01rem] translate-y-[0.2rem] text-[1.72rem] sm:translate-x-[0.08rem] sm:translate-y-[0.2rem] sm:text-[2.45rem]'
                              : isNativeHero
                                ? 'translate-x-[0.06rem] translate-y-[0.3rem] text-[2.25rem] sm:translate-x-[0.12rem] sm:translate-y-[0.2rem] sm:text-[3.2rem]'
                                : 'pt-6 text-6xl drop-shadow-[0_1px_4px_rgba(255,255,255,0.45)]'
                          )}>
                            {currentWeekStreak}
                          </span>
                        </div>
                      </div>
                      <p className={cn(
                        'font-semibold tracking-normal text-[#111827]',
                        isSplitCards
                          ? 'mt-1 text-[0.72rem] leading-tight sm:mt-1.5 sm:text-[0.92rem]'
                          : isNativeHero
                            ? 'mt-0.5 text-[0.76rem] leading-tight sm:-mt-0.5 sm:text-[0.95rem]'
                            : '-mt-2 text-lg'
                      )}>
                        {isVacationMode ? 'Feriedage' : currentWeekStreak === 1 ? 'Uge' : 'Uger'} indenfor budget
                      </p>
                    </button>
                  )}
                </div>

                <div className={cn(isSplitCards ? 'mt-1.5 sm:mt-2' : isNativeHero ? 'mt-2.5 sm:mt-3' : 'mt-4')}>
                  <div className="grid grid-cols-5 gap-1">
                    {scoreSegments.map((segment, index) => {
                      const nextMin = scoreSegments[index + 1]?.min ?? Number.POSITIVE_INFINITY;
                      const active = segmentProgressScore >= segment.min;
                      const current = segmentProgressScore >= segment.min && segmentProgressScore < nextMin;
                      return (
                        <div key={segment.label}>
                          <div
                            className={cn(
                              'flex h-7 items-center justify-center rounded-full px-1 text-center transition-all duration-500 sm:h-8',
                              active && !isVacationMode ? 'bg-gradient-to-r from-[#2ED3A7] to-[#5FE7C2]' : 'bg-black/[0.06]',
                              current && !isNativeHero && 'shadow-[0_0_10px_rgba(46,211,167,0.22)]'
                            )}
                            style={active && isVacationMode ? { background: `linear-gradient(to right, ${vacationAccent}, ${vacationAccentMid})` } : undefined}
                          >
                            <span className={cn('text-[9px] font-semibold leading-none sm:text-[10px]', active ? 'text-[#0E3B43]' : 'text-foreground/42')}>
                              {segment.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {isSplitCards && (
                  <div
                    className="mt-3 px-1 pt-1 sm:mt-3.5 sm:pt-1.5"
                    style={streakPanelStyle}
                  >
                    <div
                      className={cn(
                        'flex items-start',
                        monthWeeks.length <= 4 ? 'justify-evenly gap-3' : 'justify-between gap-2'
                      )}
                    >
                      {monthWeeks.map((week, index) => {
                        const label = getStreakPeriodLabel(week);
                        const weekKey = `${week.week_start}-${week.week_end}`;
                        const isFilled = week.kept_budget === true || streakWeekKeys.has(weekKey);
                        const isMissed = week.kept_budget === false;
                        const isCurrent = week.is_current && week.kept_budget !== true;
                        const currentProgress = isCurrent ? getWeekProgressPct(week.week_start, week.week_end, now) : 0;
                        return (
                          <div key={`${label}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                            <span
                              className={cn(
                                'flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold transition-all duration-500 sm:h-11 sm:w-11 sm:text-[13px]',
                                isFilled
                                  ? 'border border-transparent text-[#0E3B43]'
                                  : isCurrent
                                    ? 'p-[2px] text-[#0E3B43]'
                                    : isMissed
                                      ? 'border border-red-100 bg-red-50 text-red-300'
                                      : 'border border-foreground/10 bg-white text-muted-foreground/40'
                              )}
                              style={
                                isFilled
                                  ? { background: tone.accent }
                                  : isCurrent
                                    ? { background: `conic-gradient(${tone.accent} ${currentProgress}%, ${isVacationMode ? withAlpha(vacationAccent, 0.18) : 'rgba(46, 211, 167, 0.16)'} 0)` }
                                    : undefined
                              }
                            >
                              {isCurrent && !isFilled ? (
                                <span
                                  className="flex h-full w-full items-center justify-center rounded-full"
                                  style={{ backgroundColor: isVacationMode ? vacationAccentSoft : '#ecfdf5' }}
                                >
                                  Nu
                                </span>
                              ) : isFilled ? (
                                <Flame className="h-[1.05rem] w-[1.05rem]" fill="currentColor" />
                              ) : (
                                index + 1
                              )}
                            </span>
                            <span className={cn('text-center text-[10px] font-semibold sm:text-[11px]', isFilled || isCurrent ? 'text-foreground/64' : 'text-foreground/32')}>
                              {label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowStreakInfo(true)}
                className="group -mt-3 flex w-full flex-col items-center text-center outline-none transition-transform duration-200 active:scale-[0.99]"
                aria-label="Læs om streak-funktionen"
              >
                <div className="relative flex h-[8.5rem] w-44 items-start justify-center">
                  <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
                    <defs>
                      <linearGradient id="kuvert-flame-gradient" x1="4" y1="4" x2="20" y2="21" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor={flameStart} />
                        <stop offset="58%" stopColor={flameMid} />
                        <stop offset="100%" stopColor={flameEnd} />
                      </linearGradient>
                    </defs>
                  </svg>
                  <Flame
                    className="h-[8.5rem] w-[8.5rem] drop-shadow-sm transition-transform duration-200 group-hover:scale-[1.02]"
                    fill="url(#kuvert-flame-gradient)"
                    stroke="url(#kuvert-flame-gradient)"
                    strokeWidth={1.5}
                  />
                  <span className="absolute inset-0 flex items-center justify-center pt-6 text-5xl font-semibold tabular-nums leading-none tracking-normal text-[#0E3B43] drop-shadow-[0_1px_4px_rgba(255,255,255,0.45)]">
                    {currentWeekStreak}
                  </span>
                </div>

                <p className="-mt-3 text-lg font-semibold tracking-normal text-foreground">
                  {isVacationMode ? 'Feriedage' : currentWeekStreak === 1 ? 'Uge' : 'Uger'} indenfor budget
                </p>
              </button>
            )}

            {!isSplitCards && (
            <div
              className={cn(
                'mt-3 px-1 py-1 sm:mt-3 sm:py-1.5',
                isSplitCards
                  ? 'border-t border-foreground/6 pt-3 sm:pt-3.5'
                  : isNativeHero
                    ? 'bg-transparent'
                    : 'border border-foreground/6 bg-white/55'
              )}
              style={isSplitCards ? undefined : streakPanelStyle}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div />
              </div>

              <div
                className={cn(
                  'flex items-start',
                  monthWeeks.length <= 4 ? 'justify-evenly gap-3' : 'justify-between gap-2'
                )}
              >
                {monthWeeks.map((week, index) => {
                  const label = getStreakPeriodLabel(week);
                  const weekKey = `${week.week_start}-${week.week_end}`;
                  const isFilled = week.kept_budget === true || streakWeekKeys.has(weekKey);
                  const isMissed = week.kept_budget === false;
                  const isCurrent = week.is_current && week.kept_budget !== true;
                  const currentProgress = isCurrent ? getWeekProgressPct(week.week_start, week.week_end, now) : 0;
                  return (
                    <div key={`${label}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                      <span
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold transition-all duration-500 sm:h-11 sm:w-11 sm:text-[13px]',
                          isFilled
                            ? cn('border border-transparent text-[#0E3B43]', !isNativeHero && 'shadow-sm')
                            : isCurrent
                              ? cn('p-[2px] text-[#0E3B43]', !isNativeHero && 'shadow-sm')
                              : isMissed
                                ? 'border border-red-100 bg-red-50 text-red-300'
                                : 'border border-foreground/10 bg-white text-muted-foreground/40'
                        )}
                        style={
                          isFilled
                            ? { background: tone.accent }
                            : isCurrent
                              ? { background: `conic-gradient(${tone.accent} ${currentProgress}%, ${isVacationMode ? withAlpha(vacationAccent, 0.18) : 'rgba(46, 211, 167, 0.16)'} 0)` }
                              : undefined
                        }
                      >
                        {isCurrent && !isFilled ? (
                          <span
                            className="flex h-full w-full items-center justify-center rounded-full"
                            style={{ backgroundColor: isVacationMode ? vacationAccentSoft : '#ecfdf5' }}
                          >
                            Nu
                          </span>
                        ) : isFilled ? (
                          <Flame className="h-[1.05rem] w-[1.05rem]" fill="currentColor" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span className={cn('text-center text-[10px] font-semibold sm:text-[11px]', isFilled || isCurrent ? 'text-foreground/64' : 'text-foreground/32')}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            )}

          </>
        )}

        {showQuickExpense && (
          <div className={cn(isSplitCards ? 'mt-3 space-y-3 sm:space-y-4' : '')}>
            <div
              className={cn(
                isSplitCards
                  ? nativeCardClass
                  : isNativeHero
                    ? 'mt-3 overflow-hidden border-t border-foreground/8 pt-3 sm:mt-4 sm:pt-4'
                    : 'mt-5 overflow-hidden',
                isSplitCards
                  ? 'overflow-hidden px-4 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-3.5'
                  : isNativeHero
                    ? 'bg-transparent'
                    : statusCardStyle.className
              )}
              style={isSplitCards ? splitMediumCardStyle : budgetPanelStyle}
            >
            {isSplitCards && splitMediumTopBarStyle && (
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-[1]"
                style={splitMediumTopBarStyle}
              />
            )}
            <div className={cn(isSplitCards ? 'px-0 pb-0 pt-0' : isNativeHero ? 'px-2 pb-2 pt-1 sm:pb-3 sm:pt-2' : 'px-4 pb-4 pt-4')}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={cn(isSplitCards ? cardHeadingClass : isNativeHero ? cardHeadingClass : 'mb-1 text-xs font-medium leading-snug', !isNativeHero && !isSplitCards && flowStatus.headlineColor)}>
                    {budgetPeriodLabel}
                  </p>
                  <p className={cn('text-[2.65rem] font-semibold leading-none tracking-tight tabular-nums sm:text-4xl', flowStatus.amountColor)}>
                    {formatDKK(Math.abs(remaining))}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2 text-center">
                  <div
                    className={cn(
                      'min-w-[54px] px-2 py-1.5 sm:min-w-[56px] sm:px-3 sm:py-2',
                      isNativeHero ? 'rounded-none border-0 bg-transparent !py-0' : 'rounded-xl border border-black/5 bg-white/60'
                    )}
                  >
                    <p className={cn(isNativeHero ? cardHeadingClass : 'mb-0.5 text-xs font-medium leading-snug text-muted-foreground/70')}>Dage tilbage</p>
                    <p className={cn(isNativeHero ? 'text-[1.05rem] font-semibold tracking-tight text-[#111827]' : 'text-sm font-semibold tracking-tight text-foreground')}>{remainingDays}</p>
                  </div>
                  <div
                    className={cn(
                      'min-w-[54px] px-2 py-1.5 sm:min-w-[56px] sm:px-3 sm:py-2',
                      isNativeHero
                        ? 'rounded-none border-0 bg-transparent !py-0'
                        : cn(
                            'rounded-xl border',
                            overBudget ? 'border-red-100/60 bg-red-50/80' : 'border-emerald-100/60 bg-emerald-50/80'
                          )
                    )}
                  >
                    <p className={cn(isNativeHero ? cardHeadingClass : 'mb-0.5 text-xs font-medium leading-snug text-muted-foreground/70')}>Per dag</p>
                    <p className={cn(isNativeHero ? 'text-[1.05rem] font-semibold tracking-tight tabular-nums text-[#0E3B43]' : 'text-sm font-semibold tracking-tight tabular-nums', !isNativeHero && flowStatus.amountColor)}>{formatDKK(Math.round(dailyAvailable))}</p>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <p className={cn(isNativeHero ? 'text-[10px] font-medium tracking-[0.06em] text-foreground/46' : 'text-xs font-semibold tracking-wide text-muted-foreground')}>{periodScoreLabel}</p>
                  <div className="flex items-center gap-2">
                    <span className={cn(isNativeHero ? 'text-[10px] font-semibold tabular-nums' : 'text-xs font-bold tabular-nums', monthScore >= 60 ? 'text-emerald-700' : monthScore >= 30 ? 'text-amber-700' : 'text-red-600')}>
                      {monthScore}
                    </span>
                  </div>
                </div>
                <div className="relative h-1.5 overflow-visible rounded-full bg-black/[0.06] sm:h-2">
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full shadow-sm transition-all duration-700 ease-out',
                      monthlyOverBudget ? 'bg-red-400' : !progressBarStyle && cn('bg-gradient-to-r', monthScoreBarColor, !isNativeHero && monthScoreGlow)
                    )}
                    style={{
                      width: `${scoreBudget > 0 ? (monthlyOverBudget ? Math.min((scoreSpent / scoreBudget) * 100, 100) : monthScoreBarPct) : 0}%`,
                      ...(progressBarStyle ?? {}),
                      boxShadow: !isNativeHero && progressGlowColor ? `0 0 6px 1px ${progressGlowColor}` : undefined,
                    }}
                  >
                    {!monthlyOverBudget && scoreBudget > 0 && (
                      <div
                        className={cn(
                          'absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full border-2 bg-white sm:h-3.5 sm:w-3.5',
                          !isNativeHero && 'shadow-md'
                        )}
                        style={{ borderColor: progressDotColor }}
                      />
                    )}
                  </div>
                </div>
                <p className={cn(isNativeHero ? 'text-[0.84rem] leading-snug text-foreground/46' : 'text-label leading-snug text-muted-foreground/60')}>
                  {formatDKK(scoreSpent)} brugt af {formatDKK(activeBudget)}
                </p>
              </div>
            </div>
            </div>

            {isSplitCards ? (
              <div
                className={cn('inline-expense-card-shell', nativeCardClass, 'px-4 pb-5 pt-4 sm:px-5 sm:pb-6 sm:pt-4.5')}
                style={splitMediumCardStyle}
              >
                {splitMediumTopBarStyle && (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 z-[1]"
                    style={splitMediumTopBarStyle}
                  />
                )}
                <div className="inline-expense-form-shell">
                  <QuickExpenseInlineForm
                    onComplete={onQuickExpenseSaved}
                    successMode="card"
                    successOverlayClassName="-inset-x-4 -top-4 -bottom-5 sm:-inset-x-5 sm:-top-4.5 sm:-bottom-6"
                    expenseMode={isVacationMode ? 'vacation' : 'normal'}
                    vacationModeId={activeVacation?.id ?? null}
                    accentColor={activeAccent}
                  />
                </div>
              </div>
            ) : isNativeHero ? (
              <div className="inline-expense-card-shell mt-2 border-t border-foreground/8 px-2 pb-0 pt-2.5 sm:mt-3 sm:pt-3">
                <div className="inline-expense-form-shell">
                  <QuickExpenseInlineForm
                    onComplete={onQuickExpenseSaved}
                    expenseMode={isVacationMode ? 'vacation' : 'normal'}
                    vacationModeId={activeVacation?.id ?? null}
                    accentColor={activeAccent}
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={onShowQuickExpense}
                className={cn(
                  'group flex w-full items-center justify-center gap-2 px-4 text-sm font-semibold transition-all duration-200 active:scale-[0.99]',
                  'border-t border-white/15 bg-[#0E3B43] py-3.5 text-white hover:bg-[#092F35]'
                )}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#0E3B43] transition-transform duration-200 group-hover:scale-105"
                  style={{ backgroundColor: activeAccent }}
                >
                  <Plus className="h-4 w-4" />
                </span>
                Tilføj udgift
              </button>
            )}
          </div>
        )}
        </div>
      </section>

      {showStreakInfo && (
        <div
          className="fixed inset-0 z-[80] flex items-end"
          style={{ left: 'var(--sidebar-offset-global, 0px)' }}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowStreakInfo(false)}
          />
          <div
            className="relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl"
            style={{ animation: 'kuvertSlideUp 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
          >
            <div className="mx-auto mb-1 mt-3 h-1 w-10 shrink-0 rounded-full bg-foreground/15" />

            <button
              type="button"
              onClick={() => setShowStreakInfo(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-secondary/80 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Luk"
            >
              <X className="h-4 w-4" />
            </button>

            <div
              className="border-b border-foreground/5 px-5 pb-5 pt-7"
              style={{
                background: isVacationMode
                  ? 'linear-gradient(to bottom right, rgba(255,248,225,0.92), rgba(255,255,255,0.62), #ffffff)'
                  : 'linear-gradient(to bottom right, rgba(236,253,245,0.80), rgba(240,253,250,0.40), #ffffff)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="relative flex h-14 w-14 items-center justify-center">
                  <Flame
                    className="h-12 w-12 drop-shadow-sm"
                    fill="url(#kuvert-flame-gradient)"
                    stroke="url(#kuvert-flame-gradient)"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                    {isVacationMode ? 'Ferie streak' : 'Streak Count'}
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    {isVacationMode ? 'Feriedage indenfor budget' : 'Uger indenfor budget'}
                  </h2>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
	              <div className="rounded-2xl border border-foreground/8 bg-white px-4 py-3">
	                <div className="flex items-center justify-between gap-3">
	                  <div className="flex items-center gap-2">
	                    <Trophy
	                      className="h-4 w-4"
	                      style={isVacationMode ? { color: vacationAccent } : undefined}
	                    />
	                    <p className="text-sm font-semibold text-foreground">Rekord</p>
	                  </div>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {bestWeekStreak} {isVacationMode ? (bestWeekStreak === 1 ? 'dag' : 'dage') : (bestWeekStreak === 1 ? 'uge' : 'uger')}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/[0.07]">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${recordProgress}%`, background: tone.accent }}
                  />
                </div>
              </div>

              <div
                className="rounded-2xl border px-4 py-3"
                style={{
                  backgroundColor: isVacationMode ? vacationAccentSoft : 'rgba(236,253,245,0.80)',
                  borderColor: isVacationMode ? withAlpha(vacationAccent, 0.36) : 'rgba(167,243,208,0.70)',
                }}
              >
                <p className="mb-1 text-sm font-semibold text-[#0E3B43]">Sådan tæller din streak</p>
                <p className="text-sm leading-relaxed text-[#0E3B43]/75">
                  {isVacationMode
                    ? 'En feriedag tæller med, når dagen er nået, og du har holdt dig indenfor dagens feriebudget.'
                    : 'En uge tæller med, når den er afsluttet, og du har holdt dig indenfor ugens budget.'}
                </p>
              </div>

              {!isVacationMode && (
              <div className="rounded-2xl border border-foreground/8 bg-white px-4 py-3">
                <p className="mb-1 text-sm font-semibold text-foreground">Streak-måned</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Fire uger indenfor budget samles til en streak-måned. Derfor kan du se en multiplier som x1, x2 eller x3, når du holder rytmen over flere måneder.
                </p>
              </div>
              )}

              <p className="px-1 text-xs leading-relaxed text-muted-foreground">
                {isVacationMode
                  ? 'Rekorden er det højeste antal feriedage, du ender indenfor budget på samme ferie. En dyr dag kan stadig give mening, hvis du har sparet op på andre dage.'
                  : 'Rekorden er din længste sammenhængende periode med afsluttede uger indenfor budget. Hvis en uge går over budget, starter streaken forfra.'}
              </p>
            </div>

            <div className="shrink-0 border-t border-foreground/5 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3">
              <button
                type="button"
                onClick={() => setShowStreakInfo(false)}
                className="nuvio-action-button w-full rounded-full text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
                style={{ height: '52px' }}
              >
                Forstået
              </button>
            </div>
          </div>
        </div>
      )}

      {showScoreInfo && (
        <div
          className="fixed inset-0 z-[80] flex items-end"
          style={{ left: 'var(--sidebar-offset-global, 0px)' }}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowScoreInfo(false)}
          />
          <div
            className="relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl"
            style={{ animation: 'kuvertSlideUp 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
          >
            <div className="mx-auto mb-1 mt-3 h-1 w-10 shrink-0 rounded-full bg-foreground/15" />

            <button
              type="button"
              onClick={() => setShowScoreInfo(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-secondary/80 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Luk"
            >
              <X className="h-4 w-4" />
            </button>

            <div
              className="border-b border-foreground/5 px-5 pb-5 pt-7"
              style={{
                background: isVacationMode
                  ? 'linear-gradient(to bottom right, rgba(255,248,225,0.92), rgba(255,255,255,0.62), #ffffff)'
                  : 'linear-gradient(to bottom right, rgba(236,253,245,0.80), rgba(240,253,250,0.40), #ffffff)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl ring-2 ring-white/40"
                  style={{
                    background: isVacationMode
                      ? `linear-gradient(to bottom right, ${vacationAccent}, ${vacationAccentMid})`
                      : 'linear-gradient(to bottom right, #5eead4, #34d399)',
                  }}
                >
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                    Kuvert Score
                  </p>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                      {displayScore.toLocaleString('da-DK')}
                    </h2>
                    <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', cumulativeScoreTier.badge)}>
                      {cumulativeScoreTier.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
              <div>
                <p className="mb-1.5 text-sm font-semibold text-foreground">Hvad er Kuvert Score?</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Din Kuvert Score er din samlede brugerscore. Den vokser over tid, når du holder dit budget, og den fortsætter gennem både hverdag og ferie.
                </p>
              </div>

              <div
                className="rounded-2xl border px-4 py-3"
                style={{
                  backgroundColor: isVacationMode ? vacationAccentSoft : 'rgba(240,253,250,0.80)',
                  borderColor: isVacationMode ? withAlpha(vacationAccent, 0.36) : 'rgba(153,246,228,0.70)',
                }}
              >
                <p className="mb-1 text-sm font-semibold text-[#0E3B43]">
                  Scoren lever gennem dine perioder
                </p>
                <p className="text-sm leading-relaxed text-[#0E3B43]/75">
                  Tallet du ser i appen bevæger sig lidt op og ned ud fra din aktuelle budgetrytme. Det gælder både i normale uger og når du er i feriekuvert.
                </p>
              </div>

              <div
                className="rounded-2xl border px-4 py-3"
                style={{
                  backgroundColor: isVacationMode ? 'rgba(255,248,225,0.76)' : 'rgba(236,253,245,0.80)',
                  borderColor: isVacationMode ? 'rgba(246,193,38,0.30)' : 'rgba(167,243,208,0.70)',
                }}
              >
                <p className="mb-1 text-sm font-semibold text-[#0E3B43]">
                  Sådan stiger din score
                </p>
                <p className="text-sm leading-relaxed text-[#0E3B43]/75">
                  Når du holder en god budgetrytme, styrkes din score. Ferien tæller med i samme retning som dine normale perioder i stedet for at starte en separat score.
                </p>
              </div>

	              <div
	                className="rounded-2xl border px-4 py-3"
	                style={isVacationMode
	                  ? {
	                      borderColor: withAlpha(vacationAccent, 0.22),
	                      backgroundColor: withAlpha(vacationAccent, 0.10),
	                    }
	                  : undefined}
	              >
	                <p
	                  className="mb-1 text-sm font-semibold"
	                  style={isVacationMode ? { color: '#0E3B43' } : undefined}
	                >
	                  Hvis en periode glider
	                </p>
	                <p
	                  className="text-sm leading-relaxed"
	                  style={isVacationMode ? { color: 'rgba(14,59,67,0.75)' } : undefined}
	                >
	                  Går du over budget, mister du en del af din Kuvert Score. Derfor er scoren både et pejlemærke og en lille beskytter af dine vaner, også når du er på ferie.
	                </p>
	              </div>

              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-foreground/48">
                    Kuvert niveauer
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {nextCumulativeMilestone
                      ? `${Math.max(0, nextCumulativeMilestone.min - segmentProgressScore)} point til næste niveau`
                      : 'Højeste niveau nået'}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {scoreSegments.map((segment, index) => {
                    const nextMin = scoreSegments[index + 1]?.min ?? Number.POSITIVE_INFINITY;
                    const active = segmentProgressScore >= segment.min;
                    const current = segmentProgressScore >= segment.min && segmentProgressScore < nextMin;
                    return (
                      <div key={segment.label} className="space-y-1">
                        <div
                          className={cn(
                            'h-2 rounded-full transition-all duration-500',
                            active && !isVacationMode ? 'bg-gradient-to-r from-[#2ED3A7] to-[#5FE7C2]' : 'bg-black/[0.06]'
                          )}
                          style={{
                            ...(active && isVacationMode ? { background: `linear-gradient(to right, ${vacationAccent}, ${vacationAccentMid})` } : {}),
                            ...(current ? { boxShadow: `0 0 10px ${isVacationMode ? withAlpha(vacationAccent, 0.24) : 'rgba(46,211,167,0.22)'}` } : {}),
                          }}
                        />
                        <p className={cn('text-[10px] font-semibold', active ? 'text-[#0E3B43]' : 'text-foreground/32')}>
                          {segment.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-foreground/5 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3">
              <button
                type="button"
                onClick={() => setShowScoreInfo(false)}
                className="nuvio-action-button w-full rounded-full text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
                style={{ height: '52px' }}
              >
                Forstået
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes kuvertSlideUp {
          from { opacity: 0; transform: translateY(32px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
