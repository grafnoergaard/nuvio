'use client';

import { useState, type CSSProperties } from 'react';
import { Flame, Plus, Trophy, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuickExpenseStreak, QuickExpenseWeeklyStreak, WeeklyCarryOverSummary } from '@/lib/quick-expense-service';
import type { FlowStatusConfig } from '@/hooks/use-home-data';
import type { KuvertHomeVariant } from '@/lib/kuvert-home-variant';
import { QuickExpenseInlineForm } from '@/components/quick-expense-inline-form';
import { computeKuvertLiveScore } from '@/lib/kuvert-live-score';

interface KuvertHeroCardProps {
  quickStreak: QuickExpenseStreak | null;
  weeklyStreak: QuickExpenseWeeklyStreak | null;
  flowMonthlyBudget: number;
  flowMonthlySpent: number;
  flowScoreThreshold: number;
  flowStatusConfig: FlowStatusConfig;
  flowWeeklyStatus: WeeklyCarryOverSummary | null;
  showStreak: boolean;
  showQuickExpense: boolean;
  onShowQuickExpense: () => void;
  onQuickExpenseSaved: () => void;
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

export function KuvertHeroCard({
  quickStreak,
  weeklyStreak,
  flowMonthlyBudget,
  flowMonthlySpent,
  flowScoreThreshold,
  flowStatusConfig,
  flowWeeklyStatus,
  showStreak,
  showQuickExpense,
  onShowQuickExpense,
  onQuickExpenseSaved,
  variant,
}: KuvertHeroCardProps) {
  const [showStreakInfo, setShowStreakInfo] = useState(false);
  const [showScoreInfo, setShowScoreInfo] = useState(false);

  const currentWeekStreak = weeklyStreak?.current_streak ?? 0;
  const longestWeekStreak = weeklyStreak?.longest_streak ?? 0;
  const tone = getStreakTone(currentWeekStreak);
  const hasWeekStreak = currentWeekStreak > 0;
  const completedStreakMonths = Math.floor(currentWeekStreak / WEEKS_PER_STREAK_MONTH);
  const bestWeekStreak = Math.max(longestWeekStreak, currentWeekStreak);
  const recordProgress = bestWeekStreak > 0 ? Math.min(100, Math.max(12, (currentWeekStreak / bestWeekStreak) * 100)) : 0;
  const now = new Date();
  const currentMonthIndex = (weeklyStreak?.current_month ?? (now.getMonth() + 1)) - 1;
  const currentMonthLabel = DANISH_MONTHS[currentMonthIndex] ?? 'Denne måned';
  const streakWeekKeys = new Set((weeklyStreak?.streak_weeks ?? []).map(week => `${week.week_start}-${week.week_end}`));
  const monthWeeks = weeklyStreak?.current_month_weeks?.length
    ? weeklyStreak.current_month_weeks
    : (weeklyStreak?.streak_weeks ?? []).slice(-WEEKS_PER_STREAK_MONTH).map(week => ({
        ...week,
        kept_budget: true,
        is_completed: true,
        is_current: false,
      }));
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const cumulativeScoreSegments = [
    { label: 'Begynder', min: 0 },
    { label: 'Aktiv', min: 150 },
    { label: 'Erfaren', min: 400 },
    { label: 'Mester', min: 900 },
    { label: 'Legendarisk', min: 2000 },
  ];
  const currentWeekStatus = flowWeeklyStatus?.weeks.find(week => week.isCurrentWeek) ?? null;
  const budgetPeriodLabel = currentWeekStatus ? 'Ugebudget' : 'Budget';
  const activeBudget = currentWeekStatus?.effectiveBudget ?? flowMonthlyBudget;
  const activeSpent = currentWeekStatus?.spent ?? flowMonthlySpent;
  const activePeriodDays = currentWeekStatus?.daysInMonth ?? daysInMonth;
  const monthlyRemaining = flowMonthlyBudget - flowMonthlySpent;
  const monthlyRemainingDays = daysInMonth - now.getDate() + 1;
  const monthlyDailyAvailable = monthlyRemainingDays > 0 && monthlyRemaining > 0 ? monthlyRemaining / monthlyRemainingDays : 0;
  const monthlyOverBudget = flowMonthlyBudget > 0 && flowMonthlySpent > flowMonthlyBudget;
  const carryOverPenalty = flowWeeklyStatus ? Math.abs(Math.min(0, flowWeeklyStatus.accumulatedCarryOver)) : 0;
  const remainingDays = currentWeekStatus
    ? getDaysLeftInRange(currentWeekStatus.weekEnd, now)
    : daysInMonth - now.getDate() + 1;
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
    if (flowMonthlyBudget <= 0) return 0;
    if (monthlyOverBudget) return 0;
    if (monthlyRemainingDays <= 0) return monthlyRemaining >= 0 ? 100 : 0;
    const idealDailyRate = flowMonthlyBudget / daysInMonth;
    const affordableDailyRate = monthlyRemaining / monthlyRemainingDays;
    const recoveryRatio = idealDailyRate > 0 ? affordableDailyRate / idealDailyRate : 0;
    const carryOverPenaltyRatio = flowMonthlyBudget > 0 ? carryOverPenalty / flowMonthlyBudget : 0;
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
    currentWeekBudget: currentWeekStatus?.effectiveBudget,
    currentWeekSpent: currentWeekStatus?.spent,
    currentWeekDaysInPeriod: currentWeekStatus?.daysInMonth,
    currentWeekDaysRemaining: currentWeekStatus ? remainingDays : null,
    flowScoreThreshold,
  }).displayScore;
  const nextCumulativeMilestone = cumulativeScoreSegments.find((segment) => segment.min > cumulativeScore) ?? null;
  const cumulativeScoreTier = getCumulativeScoreTier(cumulativeScore);
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
  const progressBarStyle = badgeHex ? { background: `linear-gradient(to right, ${badgeHex}cc, ${badgeHex})` } as CSSProperties : undefined;
  const progressDotColor = badgeHex ?? (overBudget ? '#ef4444' : flowScore >= 60 ? '#34d399' : '#fbbf24');
  const progressGlowColor = badgeHex ? `${badgeHex}55` : undefined;
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
  const nativeCardClass = 'rounded-[28px] border border-foreground/8 bg-white/78 shadow-[0_10px_30px_rgba(14,59,67,0.06)] backdrop-blur';
  const cardHeadingClass = 'mb-0.5 text-[0.95rem] font-medium leading-snug text-foreground/82';

  return (
    <>
      <section
        className="relative w-full overflow-hidden bg-transparent"
      >
        <div className="pb-3 pt-0 sm:pb-4 sm:pt-1">

        {showStreak && (
          <>
            {showScoreInHero ? (
              <div
                className={cn(
                  isNativeHero ? 'mt-0.5 sm:mt-4' : 'mt-1',
                  isSplitCards && nativeCardClass,
                  isSplitCards && 'px-4 pb-3 pt-2.5 sm:px-5 sm:pb-4 sm:pt-3'
                )}
              >
                <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
                  <defs>
                    <linearGradient id="kuvert-flame-gradient" x1="4" y1="4" x2="20" y2="21" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#2ED3A7" />
                      <stop offset="58%" stopColor="#8FF1D7" />
                      <stop offset="100%" stopColor="#BFF8EA" />
                    </linearGradient>
                  </defs>
                </svg>

                <div className={cn(
                  'grid gap-x-3 gap-y-2',
                  isSplitCards
                    ? hasWeekStreak
                      ? 'grid-cols-[minmax(0,1fr)_5.75rem] items-start sm:grid-cols-[minmax(0,1fr)_11rem] sm:gap-x-5'
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
                    className={cn('min-w-0 text-left outline-none transition-transform duration-200 active:scale-[0.99]', isNativeHero ? 'pt-0' : 'pt-4')}
                    aria-label="Læs om Kuvert Score"
                  >
                    <div className={cn(isNativeHero ? 'mt-0' : 'mt-1')}>
                      <p className={cn(
                        isSplitCards
                          ? 'mb-0.5 text-[0.95rem] font-medium leading-snug text-foreground/82'
                          : isNativeHero
                            ? 'mb-[-0.28rem] text-[0.82rem] font-medium leading-none text-foreground/66 sm:text-[0.9rem]'
                            : 'mb-3 text-base font-medium text-muted-foreground/75'
                      )}>
                        Din score
                      </p>
                      <p className={cn(
                        'font-semibold leading-[0.82] tracking-tight tabular-nums text-[#0E3B43]',
                        isSplitCards
                          ? 'text-left text-[3.2rem] sm:text-[4.4rem]'
                          : isNativeHero
                            ? 'text-left text-[3.65rem] sm:text-[5rem]'
                            : 'text-7xl sm:text-8xl'
                      )}>
                        {cumulativeScore}
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
                          ? 'w-[5.75rem] justify-self-end items-center text-center sm:w-auto sm:items-end sm:text-right'
                          : isNativeHero
                            ? 'w-[6.5rem] justify-self-end items-center text-center sm:w-auto sm:items-end sm:text-right'
                            : 'items-center text-center'
                      )}
                      aria-label="Læs om streak-funktionen"
                    >
                      <div className={cn(
                        'flex w-full items-start',
                        isSplitCards
                          ? 'h-[5.2rem] justify-center sm:h-[7.1rem] sm:justify-end'
                          : isNativeHero
                            ? 'h-[6rem] justify-center sm:h-[8.5rem] sm:justify-end'
                            : 'justify-center h-[10rem]'
                      )}>
                        <div className={cn(
                          'relative',
                          isSplitCards
                            ? 'h-[5.2rem] w-[5.2rem] sm:h-[7.1rem] sm:w-[7.1rem]'
                            : isNativeHero
                              ? 'h-[6rem] w-[6rem] sm:h-[8.5rem] sm:w-[8.5rem]'
                              : 'h-[10rem] w-[10rem]'
                        )}>
                          <Flame
                            className={cn(
                              'transition-transform duration-200 group-hover:scale-[1.02]',
                              isSplitCards
                                ? 'h-[5.2rem] w-[5.2rem] sm:h-[7.1rem] sm:w-[7.1rem]'
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
                              ? 'translate-x-[0.02rem] translate-y-[0.18rem] text-[1.95rem] sm:translate-x-[0.08rem] sm:translate-y-[0.16rem] sm:text-[2.7rem]'
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
                          ? 'mt-0.5 text-[0.72rem] leading-tight sm:text-[0.92rem]'
                          : isNativeHero
                            ? 'mt-0.5 text-[0.76rem] leading-tight sm:-mt-0.5 sm:text-[0.95rem]'
                            : '-mt-2 text-lg'
                      )}>
                        {currentWeekStreak === 1 ? 'Uge' : 'Uger'} indenfor budget
                      </p>
                    </button>
                  )}
                </div>

                <div className={cn(isSplitCards ? 'mt-2 sm:mt-2.5' : isNativeHero ? 'mt-2.5 sm:mt-3' : 'mt-4')}>
                  <div className="flex items-end justify-between">
                    <p className={cn(isNativeHero ? 'text-[10px] font-medium tracking-[0.06em] text-foreground/44' : 'text-xs font-semibold tracking-wide text-muted-foreground')}>
                      Kuvert niveauer
                    </p>
                  </div>
                  <div className="mt-1.5 grid grid-cols-5 gap-1">
                    {cumulativeScoreSegments.map((segment, index) => {
                      const nextMin = cumulativeScoreSegments[index + 1]?.min ?? Number.POSITIVE_INFINITY;
                      const active = cumulativeScore >= segment.min;
                      const current = cumulativeScore >= segment.min && cumulativeScore < nextMin;
                      return (
                        <div key={segment.label}>
                          <div
                            className={cn(
                              'flex h-7 items-center justify-center rounded-full px-1 text-center transition-all duration-500 sm:h-8',
                              active ? 'bg-gradient-to-r from-[#2ED3A7] to-[#5FE7C2]' : 'bg-black/[0.06]',
                              current && !isNativeHero && 'shadow-[0_0_10px_rgba(46,211,167,0.22)]'
                            )}
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
                        const label = `Uge ${week.iso_week_number}`;
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
                                    ? { background: `conic-gradient(${tone.accent} ${currentProgress}%, rgba(46, 211, 167, 0.16) 0)` }
                                    : undefined
                              }
                            >
                              {isCurrent && !isFilled ? (
                                <span className="flex h-full w-full items-center justify-center rounded-full bg-[#ecfdf5]">
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
                        <stop offset="0%" stopColor="#2ED3A7" />
                        <stop offset="58%" stopColor="#8FF1D7" />
                        <stop offset="100%" stopColor="#BFF8EA" />
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
                  {currentWeekStreak === 1 ? 'Uge' : 'Uger'} indenfor budget
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
                  const label = `Uge ${week.iso_week_number}`;
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
                              ? { background: `conic-gradient(${tone.accent} ${currentProgress}%, rgba(46, 211, 167, 0.16) 0)` }
                              : undefined
                        }
                      >
                        {isCurrent && !isFilled ? (
                          <span className="flex h-full w-full items-center justify-center rounded-full bg-[#ecfdf5]">
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
              style={isSplitCards ? undefined : budgetPanelStyle}
            >
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
                  <p className={cn(isNativeHero ? 'text-[10px] font-medium tracking-[0.06em] text-foreground/46' : 'text-xs font-semibold tracking-wide text-muted-foreground')}>Månedsscore</p>
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
                      width: `${flowMonthlyBudget > 0 ? (monthlyOverBudget ? Math.min((flowMonthlySpent / flowMonthlyBudget) * 100, 100) : monthScoreBarPct) : 0}%`,
                      ...(progressBarStyle ?? {}),
                      boxShadow: !isNativeHero && progressGlowColor ? `0 0 6px 1px ${progressGlowColor}` : undefined,
                    }}
                  >
                    {!monthlyOverBudget && flowMonthlyBudget > 0 && (
                      <div
                        className={cn(
                          'absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full border-2 bg-white sm:h-3.5 sm:w-3.5',
                          !isNativeHero && 'shadow-md'
                        )}
                        style={{ borderColor: badgeHex ?? (monthScore >= 60 ? '#34d399' : monthScore >= 30 ? '#fbbf24' : '#ef4444') }}
                      />
                    )}
                  </div>
                </div>
                <p className={cn(isNativeHero ? 'text-[0.84rem] leading-snug text-foreground/46' : 'text-label leading-snug text-muted-foreground/60')}>
                  {formatDKK(flowMonthlySpent)} brugt af {formatDKK(activeBudget)}
                </p>
              </div>
            </div>
            </div>

            {isSplitCards ? (
              <div className={cn(nativeCardClass, 'px-4 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-3.5')}>
                <div className="inline-expense-form-shell">
                  <QuickExpenseInlineForm onComplete={onQuickExpenseSaved} />
                </div>
              </div>
            ) : isNativeHero ? (
              <div className="mt-2 border-t border-foreground/8 px-2 pb-0 pt-2.5 sm:mt-3 sm:pt-3">
                <div className="inline-expense-form-shell">
                  <QuickExpenseInlineForm onComplete={onQuickExpenseSaved} />
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
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2ED3A7] text-[#0E3B43] transition-transform duration-200 group-hover:scale-105">
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

            <div className="border-b border-foreground/5 bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white px-5 pb-5 pt-7">
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
                    Streak Count
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Uger indenfor budget
                  </h2>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
              <div className="rounded-2xl border border-foreground/8 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <p className="text-sm font-semibold text-foreground">Rekord</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {bestWeekStreak} {bestWeekStreak === 1 ? 'uge' : 'uger'}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/[0.07]">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${recordProgress}%`, background: tone.accent }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100/70 bg-emerald-50/80 px-4 py-3">
                <p className="mb-1 text-sm font-semibold text-emerald-950">Sådan tæller din streak</p>
                <p className="text-sm leading-relaxed text-emerald-900/75">
                  En uge tæller med, når den er afsluttet, og du har holdt dig indenfor ugens budget.
                </p>
              </div>

              <div className="rounded-2xl border border-foreground/8 bg-white px-4 py-3">
                <p className="mb-1 text-sm font-semibold text-foreground">Streak-måned</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Fire uger indenfor budget samles til en streak-måned. Derfor kan du se en multiplier som x1, x2 eller x3, når du holder rytmen over flere måneder.
                </p>
              </div>

              <p className="px-1 text-xs leading-relaxed text-muted-foreground">
                Rekorden er din længste sammenhængende periode med afsluttede uger indenfor budget. Hvis en uge går over budget, starter streaken forfra.
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

            <div className="border-b border-foreground/5 bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white px-5 pb-5 pt-7">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-300 to-emerald-400 ring-2 ring-white/40">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                    Kuvert Score
                  </p>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                      {cumulativeScore.toLocaleString('da-DK')}
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
                  Din Kuvert Score er et akkumulerende pointsystem der vokser over tid, når du holder dit budget. Jo bedre du klarer dig, og jo længere din gode rytme varer, jo stærkere bliver din score.
                </p>
              </div>

              <div className="rounded-2xl border border-teal-100/70 bg-teal-50/80 px-4 py-3">
                <p className="mb-1 text-sm font-semibold text-teal-950">Scoren lever gennem måneden</p>
                <p className="text-sm leading-relaxed text-teal-900/75">
                  Tallet du ser i appen bevæger sig lidt op og ned ud fra månedsscore og ugens rytme. Ved månedsskifte bliver de rigtige bonuspoint og straffe låst fast i din langsigtede score.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100/70 bg-emerald-50/80 px-4 py-3">
                <p className="mb-1 text-sm font-semibold text-emerald-950">Sådan stiger din score</p>
                <p className="text-sm leading-relaxed text-emerald-900/75">
                  Hver måned du holder dig indenfor budget, lægger nye point ovenpå. Måneder med bedre økonomisk rytme giver også en stærkere belønning.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-100/70 bg-amber-50/80 px-4 py-3">
                <p className="mb-1 text-sm font-semibold text-amber-900">Hvis en måned glider</p>
                <p className="text-sm leading-relaxed text-amber-900/75">
                  Går du over budget, mister du en del af din Kuvert Score. Derfor er scoren både et pejlemærke og en lille beskytter af dine vaner.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-foreground/48">Kuvert niveauer</p>
                  <span className="text-xs text-muted-foreground">
                    {nextCumulativeMilestone
                      ? `${Math.max(0, nextCumulativeMilestone.min - cumulativeScore)} point til næste niveau`
                      : 'Højeste niveau nået'}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {cumulativeScoreSegments.map((segment, index) => {
                    const nextMin = cumulativeScoreSegments[index + 1]?.min ?? Number.POSITIVE_INFINITY;
                    const active = cumulativeScore >= segment.min;
                    const current = cumulativeScore >= segment.min && cumulativeScore < nextMin;
                    return (
                      <div key={segment.label} className="space-y-1">
                        <div
                          className={cn(
                            'h-2 rounded-full transition-all duration-500',
                            active ? 'bg-gradient-to-r from-[#2ED3A7] to-[#5FE7C2]' : 'bg-black/[0.06]'
                          )}
                          style={current ? { boxShadow: '0 0 10px rgba(46,211,167,0.22)' } : undefined}
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
