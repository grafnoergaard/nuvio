'use client';

import { useState, type CSSProperties } from 'react';
import { Flame, Plus, Trophy, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuickExpenseWeeklyStreak, WeeklyCarryOverSummary } from '@/lib/quick-expense-service';
import type { FlowStatusConfig } from '@/hooks/use-home-data';

interface KuvertHeroCardProps {
  weeklyStreak: QuickExpenseWeeklyStreak | null;
  flowMonthlyBudget: number;
  flowMonthlySpent: number;
  flowScoreThreshold: number;
  flowStatusConfig: FlowStatusConfig;
  flowWeeklyStatus: WeeklyCarryOverSummary | null;
  showStreak: boolean;
  showQuickExpense: boolean;
  onShowQuickExpense: () => void;
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

export function KuvertHeroCard({
  weeklyStreak,
  flowMonthlyBudget,
  flowMonthlySpent,
  flowScoreThreshold,
  flowStatusConfig,
  flowWeeklyStatus,
  showStreak,
  showQuickExpense,
  onShowQuickExpense,
}: KuvertHeroCardProps) {
  const [showStreakInfo, setShowStreakInfo] = useState(false);

  const currentWeekStreak = weeklyStreak?.current_streak ?? 0;
  const longestWeekStreak = weeklyStreak?.longest_streak ?? 0;
  const tone = getStreakTone(currentWeekStreak);
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
  const remainingDays = daysInMonth - now.getDate() + 1;
  const remaining = flowMonthlyBudget - flowMonthlySpent;
  const overBudget = flowMonthlyBudget > 0 && flowMonthlySpent > flowMonthlyBudget;
  const dailyAvailable = remainingDays > 0 && remaining > 0 ? remaining / remainingDays : 0;
  const usedPct = flowMonthlyBudget > 0 ? Math.min(100, (flowMonthlySpent / flowMonthlyBudget) * 100) : 0;
  const carryOverPenalty = flowWeeklyStatus ? Math.abs(Math.min(0, flowWeeklyStatus.accumulatedCarryOver)) : 0;
  const flowScore = (() => {
    if (flowMonthlyBudget <= 0) return 0;
    if (overBudget) return 0;
    if (remainingDays <= 0) return remaining >= 0 ? 100 : 0;
    const idealDailyRate = flowMonthlyBudget / daysInMonth;
    const affordableDailyRate = remaining / remainingDays;
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
  const flowBarPct = Math.min(100, Math.max(4, flowScore));
  const flowBarColor = flowScore >= 60 ? 'from-emerald-400 to-teal-400' : flowScore >= 30 ? 'from-amber-400 to-orange-300' : 'from-red-400 to-rose-400';
  const flowGlow = flowScore >= 60 ? 'shadow-emerald-300/60' : flowScore >= 30 ? 'shadow-amber-300/60' : 'shadow-red-300/60';
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

  return (
    <>
      <section
        className="relative w-full overflow-hidden bg-transparent"
      >
        <div className="pb-5 pt-6">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center rounded-full border border-foreground/8 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/55">
            Streak count
          </span>
          {showStreak && (
            <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold leading-none', tone.badge)}>
              {tone.label}
            </span>
          )}
        </div>

        {showStreak && (
          <>
            <button
              type="button"
              onClick={() => setShowStreakInfo(true)}
              className="group mt-1 flex w-full flex-col items-center text-center outline-none transition-transform duration-200 active:scale-[0.99]"
              aria-label="Læs om streak-funktionen"
            >
              <div className="relative flex h-40 w-44 items-start justify-center">
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
                  className="h-40 w-40 drop-shadow-sm transition-transform duration-200 group-hover:scale-[1.02]"
                  fill="url(#kuvert-flame-gradient)"
                  stroke="url(#kuvert-flame-gradient)"
                  strokeWidth={1.5}
                />
                <span className="absolute inset-0 flex items-center justify-center pt-9 text-5xl font-semibold tabular-nums leading-none tracking-normal text-[#0E3B43] drop-shadow-[0_1px_4px_rgba(255,255,255,0.45)]">
                  {currentWeekStreak}
                </span>
              </div>

              <p className="-mt-1 text-lg font-semibold tracking-normal text-foreground">
                {currentWeekStreak === 1 ? 'Uge' : 'Uger'} indenfor budget
              </p>
            </button>

            <div className="mt-4 rounded-2xl border border-foreground/6 bg-white/55 px-4 py-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/70">
                  {currentMonthLabel}
                </p>
                {completedStreakMonths > 0 && (
                  <span
                    className="inline-flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-[#0E3B43] shadow-sm"
                    style={{ background: tone.accent }}
                    aria-label={`${completedStreakMonths} ${completedStreakMonths === 1 ? 'måned' : 'måneder'} i træk`}
                    title={`${completedStreakMonths} ${completedStreakMonths === 1 ? 'måned' : 'måneder'} i træk`}
                  >
                    <span className="text-sm font-bold leading-none tabular-nums">X{completedStreakMonths}</span>
                    <span className="text-[9px] font-semibold uppercase leading-none tracking-wide opacity-70">
                      {completedStreakMonths === 1 ? 'måned' : 'mdr.'}
                    </span>
                  </span>
                )}
              </div>

              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(monthWeeks.length, 1)}, minmax(0, 1fr))` }}>
                {monthWeeks.map((week, index) => {
                  const label = `Uge ${week.iso_week_number}`;
                  const weekKey = `${week.week_start}-${week.week_end}`;
                  const isFilled = week.kept_budget === true || streakWeekKeys.has(weekKey);
                  const isMissed = week.kept_budget === false;
                  const isCurrent = week.is_current && week.kept_budget !== true;
                  const currentProgress = isCurrent ? getWeekProgressPct(week.week_start, week.week_end, now) : 0;
                  return (
                    <div key={`${label}-${index}`} className="flex flex-col items-center gap-1.5">
                      <span
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-500',
                          isFilled
                            ? 'border border-transparent text-[#0E3B43] shadow-sm'
                            : isCurrent
                              ? 'p-[2px] text-[#0E3B43] shadow-sm'
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
                          <Flame className="h-3.5 w-3.5" fill="currentColor" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span className={cn('text-[10px] font-semibold', isFilled || isCurrent ? 'text-foreground/70' : 'text-muted-foreground/35')}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </>
        )}

        {showQuickExpense && (
          <div
            className={cn('mt-5 overflow-hidden rounded-[1.75rem]', statusCardStyle.className)}
            style={statusCardStyle.inlineStyle}
          >
            <div className="px-4 pb-4 pt-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className={cn('mb-1 text-xs font-medium leading-snug', flowStatus.headlineColor)}>
                    Budget
                  </p>
                  <p className={cn('text-3xl font-semibold leading-none tracking-tight tabular-nums sm:text-4xl', flowStatus.amountColor)}>
                    {formatDKK(Math.abs(remaining))}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {overBudget ? 'over budget' : `tilbage af ${formatDKK(flowMonthlyBudget)}`}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2 text-center">
                  <div className="min-w-[56px] rounded-xl border border-black/5 bg-white/60 px-3 py-2">
                    <p className="mb-0.5 text-xs font-medium leading-snug text-muted-foreground/70">Dage tilbage</p>
                    <p className="text-sm font-semibold tracking-tight text-foreground">{remainingDays}</p>
                  </div>
                  <div className={cn(
                    'min-w-[56px] rounded-xl border px-3 py-2',
                    overBudget ? 'border-red-100/60 bg-red-50/80' : 'border-emerald-100/60 bg-emerald-50/80'
                  )}>
                    <p className="mb-0.5 text-xs font-medium leading-snug text-muted-foreground/70">Per dag</p>
                    <p className={cn('text-sm font-semibold tracking-tight tabular-nums', flowStatus.amountColor)}>{formatDKK(Math.round(dailyAvailable))}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground">Din Score</p>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-bold tabular-nums', flowStatus.amountColor)}>{flowScore}</span>
                  </div>
                </div>
                <div className="relative h-2 overflow-visible rounded-full bg-black/[0.06]">
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full shadow-sm transition-all duration-700 ease-out',
                      overBudget ? 'bg-red-400' : !progressBarStyle && cn('bg-gradient-to-r', flowBarColor, flowGlow)
                    )}
                    style={{
                      width: `${flowMonthlyBudget > 0 ? (overBudget ? usedPct : flowBarPct) : 0}%`,
                      ...(progressBarStyle ?? {}),
                      boxShadow: progressGlowColor ? `0 0 6px 1px ${progressGlowColor}` : undefined,
                    }}
                  >
                    {!overBudget && flowMonthlyBudget > 0 && (
                      <div
                        className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 rounded-full border-2 bg-white shadow-md"
                        style={{ borderColor: progressDotColor }}
                      />
                    )}
                  </div>
                </div>
                <p className="text-label leading-snug text-muted-foreground/60">
                  {formatDKK(flowMonthlySpent)} brugt · {formatDKK(Math.round(dailyAvailable))} pr. dag
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onShowQuickExpense}
              className="group flex w-full items-center justify-center gap-2 border-t border-white/15 bg-[#0E3B43] px-4 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#092F35] active:scale-[0.99]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2ED3A7] text-[#0E3B43] transition-transform duration-200 group-hover:scale-105">
                <Plus className="h-4 w-4" />
              </span>
              Tilføj udgift
            </button>
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

      <style jsx>{`
        @keyframes kuvertSlideUp {
          from { opacity: 0; transform: translateY(32px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
