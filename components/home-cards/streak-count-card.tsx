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

function getIsoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getStreakTone(currentStreak: number) {
  if (currentStreak >= 12) {
    return {
      label: 'Legendarisk',
      flame: 'from-orange-400 via-amber-300 to-yellow-200',
      accent: '#f59e0b',
      text: 'text-amber-900',
      badge: 'bg-amber-100 text-amber-900 border-amber-200',
    };
  }
  if (currentStreak >= 6) {
    return {
      label: 'Stærk rytme',
      flame: 'from-orange-500 via-amber-400 to-yellow-300',
      accent: '#f97316',
      text: 'text-orange-900',
      badge: 'bg-orange-100 text-orange-900 border-orange-200',
    };
  }
  if (currentStreak >= 1) {
    return {
      label: 'Aktiv',
      flame: 'from-[#2ED3A7] via-emerald-400 to-teal-300',
      accent: '#2ED3A7',
      text: 'text-[#0E3B43]',
      badge: 'bg-emerald-100 text-emerald-900 border-emerald-200',
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
  const currentStreakMonthIndex = currentStreak > 0 ? Math.floor((currentStreak - 1) / WEEKS_PER_STREAK_MONTH) : 0;
  const streakMonthWeeks = streak?.streak_weeks?.slice(
    currentStreakMonthIndex * WEEKS_PER_STREAK_MONTH,
    currentStreakMonthIndex * WEEKS_PER_STREAK_MONTH + WEEKS_PER_STREAK_MONTH
  ) ?? [];
  const weeksIntoStreakMonth = currentStreak > 0
    ? currentStreak % WEEKS_PER_STREAK_MONTH || WEEKS_PER_STREAK_MONTH
    : 0;
  const filledWeeks = Math.min(weeksIntoStreakMonth, WEEKS_PER_STREAK_MONTH);
  const bestStreak = Math.max(longestStreak, currentStreak);
  const recordProgress = bestStreak > 0 ? Math.min(100, Math.max(12, (currentStreak / bestStreak) * 100)) : 0;
  const displayWeeks: number[] = [];
  let nextIsoDate: Date | null = null;
  for (let index = 0; index < WEEKS_PER_STREAK_MONTH; index += 1) {
    const week = streakMonthWeeks[index];
    if (week) {
      displayWeeks.push(week.iso_week_number);
      nextIsoDate = addDays(new Date(week.week_end), 1);
      continue;
    }

    const fallbackDate = nextIsoDate ?? addDays(new Date(), index * 7);
    displayWeeks.push(getIsoWeekNumber(fallbackDate));
    nextIsoDate = addDays(fallbackDate, 7);
  }

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

        <div className="mt-4 flex flex-col items-center text-center">
          <div className="relative flex h-44 w-44 items-center justify-center">
            <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="streak-flame-gradient" x1="4" y1="4" x2="20" y2="21" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#F97316" />
                  <stop offset="55%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#FDE047" />
                </linearGradient>
              </defs>
            </svg>
            <Flame
              className="h-40 w-40 drop-shadow-sm"
              fill="url(#streak-flame-gradient)"
              stroke="url(#streak-flame-gradient)"
              strokeWidth={1.5}
            />
            <span className="absolute inset-0 flex items-center justify-center pt-9 text-5xl font-semibold tabular-nums leading-none tracking-normal text-white drop-shadow-[0_2px_5px_rgba(124,45,18,0.45)]">
              {currentStreak}
            </span>
          </div>

          <p className="-mt-1 text-lg font-semibold tracking-tight text-foreground">
            {currentStreak === 1 ? 'Uge' : 'Uger'} indenfor budget
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-foreground/6 bg-white/55 px-4 py-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/45">
              Streak-måned
            </p>
            {completedStreakMonths > 0 && (
              <span
                className="rounded-full px-2.5 py-1 text-xs font-bold tabular-nums text-white shadow-sm"
                style={{ background: tone.accent }}
              >
                x{completedStreakMonths}
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {displayWeeks.map((isoWeekNumber, index) => {
              const label = `Uge ${isoWeekNumber}`;
              const isFilled = index < filledWeeks;
              return (
                <div key={`${label}-${index}`} className="flex flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-bold transition-all duration-500',
                      isFilled
                        ? 'border-transparent text-white shadow-sm'
                        : 'border-foreground/10 bg-white text-muted-foreground/40'
                    )}
                    style={isFilled ? { background: tone.accent } : undefined}
                  >
                    {isFilled ? <Flame className="h-3.5 w-3.5" fill="currentColor" /> : index + 1}
                  </span>
                  <span className={cn('text-[10px] font-semibold', isFilled ? 'text-foreground/70' : 'text-muted-foreground/35')}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-foreground/6 bg-white/70 px-4 py-3">
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
