'use client';

import { useState } from 'react';
import { Flame, Trophy, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCardStyle, getTopBarStyle, useSettings } from '@/lib/settings-context';
import type { QuickExpenseWeeklyStreak } from '@/lib/quick-expense-service';

interface StreakCountCardProps {
  streak: QuickExpenseWeeklyStreak | null;
  dimmed?: boolean;
}

const WEEKS_PER_STREAK_MONTH = 4;

const DANISH_MONTHS = [
  'Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'December',
];

function getStreakTone(currentStreak: number) {
  if (currentStreak >= 12) {
    return {
      label: 'Legendarisk',
      flame: 'from-[#2ED3A7] via-[#8FF1D7] to-[#BFF8EA]',
      accent: '#5FE7C2',
      text: 'text-[#0E3B43]',
      badge: 'bg-[#2ED3A7]/16 text-[#0E3B43] border-[#2ED3A7]/35',
    };
  }
  if (currentStreak >= 6) {
    return {
      label: 'Stærk rytme',
      flame: 'from-[#2ED3A7] via-[#8FF1D7] to-[#BFF8EA]',
      accent: '#5FE7C2',
      text: 'text-[#0E3B43]',
      badge: 'bg-[#2ED3A7]/16 text-[#0E3B43] border-[#2ED3A7]/35',
    };
  }
  if (currentStreak >= 1) {
    return {
      label: 'Aktiv',
      flame: 'from-[#2ED3A7] via-[#8FF1D7] to-[#BFF8EA]',
      accent: '#5FE7C2',
      text: 'text-[#0E3B43]',
      badge: 'bg-[#2ED3A7]/16 text-[#0E3B43] border-[#2ED3A7]/35',
    };
  }
  return {
    label: 'Klar',
    flame: 'from-slate-300 via-slate-200 to-white',
    accent: '#94a3b8',
    text: 'text-slate-700',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
  };
}

function getWeekProgressPct(weekStart: string, weekEnd: string, now: Date): number {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(`${weekEnd}T23:59:59.999`);
  const total = end.getTime() - start.getTime();
  if (!Number.isFinite(total) || total <= 0) return 0;
  const elapsed = now.getTime() - start.getTime();
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

export default function StreakCountCard({ streak, dimmed }: StreakCountCardProps) {
  const { design } = useSettings();
  const [showInfo, setShowInfo] = useState(false);
  const cardMedium = design.cardMedium;
  const cardStyleBase = getCardStyle(cardMedium, design.gradientFrom, design.gradientTo);
  const topBarStyleOverride = getTopBarStyle(cardMedium, design.gradientFrom, design.gradientTo);

  const currentStreak = streak?.current_streak ?? 0;
  const longestStreak = streak?.longest_streak ?? 0;
  const tone = getStreakTone(currentStreak);
  const completedStreakMonths = Math.floor(currentStreak / WEEKS_PER_STREAK_MONTH);
  const bestStreak = Math.max(longestStreak, currentStreak);
  const recordProgress = bestStreak > 0 ? Math.min(100, Math.max(12, (currentStreak / bestStreak) * 100)) : 0;
  const now = new Date();
  const currentMonthIndex = (streak?.current_month ?? (now.getMonth() + 1)) - 1;
  const currentMonthLabel = DANISH_MONTHS[currentMonthIndex] ?? 'Denne måned';
  const streakWeekKeys = new Set((streak?.streak_weeks ?? []).map(week => `${week.week_start}-${week.week_end}`));
  const monthWeeks = streak?.current_month_weeks?.length
    ? streak.current_month_weeks
    : (streak?.streak_weeks ?? []).slice(-WEEKS_PER_STREAK_MONTH).map(week => ({
        ...week,
        kept_budget: true,
        is_completed: true,
        is_current: false,
      }));

  return (
    <>
      <button
        type="button"
        onClick={() => setShowInfo(true)}
        className={cn(
          'relative w-full rounded-2xl border shadow-sm text-left transition-all duration-500 hover:shadow-md active:scale-[0.99]',
          'bg-gradient-to-br from-emerald-50/80 via-teal-50/30 to-white border-emerald-200/50',
          dimmed && 'opacity-50'
        )}
        style={cardStyleBase}
      >
        {topBarStyleOverride && <div style={topBarStyleOverride} />}

        <div className="px-5 pt-6 pb-5">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center rounded-full border border-foreground/8 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/55">
            Streak Count
          </span>
          <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold leading-none', tone.badge)}>
            {tone.label}
          </span>
        </div>

        <div className="mt-0 flex flex-col items-center text-center">
          <div className="relative flex h-40 w-44 items-start justify-center">
            <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="streak-flame-gradient" x1="4" y1="4" x2="20" y2="21" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#2ED3A7" />
                  <stop offset="58%" stopColor="#8FF1D7" />
                  <stop offset="100%" stopColor="#BFF8EA" />
                </linearGradient>
              </defs>
            </svg>
            <Flame
              className="h-40 w-40 drop-shadow-sm"
              fill="url(#streak-flame-gradient)"
              stroke="url(#streak-flame-gradient)"
              strokeWidth={1.5}
            />
            <span className="absolute inset-0 flex items-center justify-center pt-9 text-5xl font-semibold tabular-nums leading-none tracking-normal text-[#0E3B43] drop-shadow-[0_1px_4px_rgba(255,255,255,0.45)]">
              {currentStreak}
            </span>
          </div>

          <p className="-mt-1 text-lg font-semibold tracking-normal text-foreground">
            {currentStreak === 1 ? 'Uge' : 'Uger'} indenfor budget
          </p>
        </div>

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

        <div className="mt-4 px-1 py-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-semibold text-foreground/70">
                Rekord
              </span>
            </div>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {bestStreak} {bestStreak === 1 ? 'uge' : 'uger'}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/[0.07]">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${recordProgress}%`, background: tone.accent }}
            />
          </div>
        </div>
        </div>
      </button>

      {showInfo && (
        <div
          className="fixed inset-0 z-[70] flex items-end"
          style={{ left: 'var(--sidebar-offset-global, 0px)' }}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowInfo(false)}
          />
          <div
            className="relative w-full bg-white rounded-t-3xl shadow-2xl flex flex-col"
            style={{
              animation: 'slideUp 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
              maxHeight: '92dvh',
            }}
          >
            <div className="w-10 h-1 rounded-full bg-foreground/15 mx-auto mt-3 mb-1 shrink-0" />

            <button
              onClick={() => setShowInfo(false)}
              className="absolute right-4 top-4 h-8 w-8 rounded-full bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Luk"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="px-5 pt-7 pb-5 border-b border-foreground/5 bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white">
              <div className="flex items-center gap-3">
                <div className="relative flex h-14 w-14 items-center justify-center">
                  <Flame
                    className="h-12 w-12 drop-shadow-sm"
                    fill="url(#streak-flame-gradient)"
                    stroke="url(#streak-flame-gradient)"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1">
                    Streak Count
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Uger indenfor budget
                  </h2>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto overscroll-contain flex-1 px-5 py-4 space-y-3 min-h-0">
              <div className="rounded-2xl bg-emerald-50/80 border border-emerald-100/70 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-950 mb-1">Sådan tæller din streak</p>
                <p className="text-sm text-emerald-900/75 leading-relaxed">
                  En uge tæller med, når den er afsluttet, og du har holdt dig indenfor ugens budget.
                </p>
              </div>

              <div className="rounded-2xl bg-white border border-foreground/8 px-4 py-3">
                <p className="text-sm font-semibold text-foreground mb-1">Streak-måned</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Fire uger indenfor budget samles til en streak-måned. Derfor kan du se en multiplier som x1, x2 eller x3, når du holder rytmen over flere måneder.
                </p>
              </div>

              <div className="rounded-2xl bg-white border border-foreground/8 px-4 py-3">
                <p className="text-sm font-semibold text-foreground mb-1">Rekord</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Rekorden er din længste sammenhængende periode med afsluttede uger indenfor budget. Hvis en uge går over budget, starter streaken forfra.
                </p>
              </div>
            </div>

            <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shrink-0 border-t border-foreground/5">
              <button
                onClick={() => setShowInfo(false)}
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
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(32px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
