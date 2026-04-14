'use client';

import { useState } from 'react';
import { X, Flame, Zap, Award, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuickExpenseStreak } from '@/lib/quick-expense-service';

interface Props {
  streak: QuickExpenseStreak | null;
  className?: string;
  title?: string;
  onInfoClick?: () => void;
}

function getScoreTier(score: number): {
  label: string;
  color: string;
  bg: string;
  border: string;
  textColor: string;
} {
  if (score >= 2000) return {
    label: 'Legendarisk',
    color: 'from-amber-400 to-yellow-500',
    bg: 'bg-gradient-to-br from-amber-50 to-yellow-50/60',
    border: 'border-amber-200/70',
    textColor: 'text-amber-900',
  };
  if (score >= 900) return {
    label: 'Mester',
    color: 'from-teal-400 to-emerald-500',
    bg: 'bg-gradient-to-br from-teal-50 to-emerald-50/60',
    border: 'border-teal-200/70',
    textColor: 'text-teal-900',
  };
  if (score >= 400) return {
    label: 'Erfaren',
    color: 'from-emerald-400 to-teal-500',
    bg: 'bg-gradient-to-br from-emerald-50 to-teal-50/60',
    border: 'border-emerald-200/70',
    textColor: 'text-emerald-900',
  };
  if (score >= 150) return {
    label: 'Aktiv',
    color: 'from-teal-300 to-emerald-400',
    bg: 'bg-gradient-to-br from-teal-50/80 to-emerald-50/40',
    border: 'border-teal-200/50',
    textColor: 'text-teal-800',
  };
  return {
    label: 'Begynder',
    color: 'from-teal-300 to-emerald-300',
    bg: 'bg-gradient-to-br from-slate-50 to-teal-50/30',
    border: 'border-slate-200/60',
    textColor: 'text-slate-700',
  };
}

function getStreakTierColor(n: number) {
  if (n >= 12) return 'from-amber-400 to-orange-500';
  if (n >= 6) return 'from-orange-400 to-red-400';
  return 'from-orange-300 to-amber-400';
}

export default function NuvioScoreCard({ streak, className, title, onInfoClick }: Props) {
  const [showInfo, setShowInfo] = useState(false);

  const score = streak?.cumulative_score ?? 0;
  const currentStreak = streak?.current_streak ?? 0;
  const longestStreak = streak?.longest_streak ?? 0;
  const tier = getScoreTier(score);
  const isRecord = currentStreak > 0 && currentStreak >= longestStreak && currentStreak > 1;
  const hasStreak = currentStreak > 0;

  return (
    <>
      <div
        className={cn(
          'w-full rounded-3xl border text-left transition-all duration-200',
          tier.bg,
          tier.border,
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-4 pt-3 pb-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {onInfoClick && (
              <button
                onClick={onInfoClick}
                className="h-9 w-9 rounded-full border-2 border-emerald-400/60 bg-white/70 flex items-center justify-center text-emerald-600 hover:border-emerald-500 hover:bg-emerald-50 transition-all duration-200 shadow-sm"
                aria-label="Om Nuvio Flow"
              >
                <Info className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        <button
          onClick={() => setShowInfo(true)}
          className="w-full px-4 py-3 text-left hover:opacity-80 active:scale-[0.99] transition-all duration-200"
        >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40 leading-none mb-1">
              Nuvio Score
            </p>
            <div className="flex items-baseline gap-2">
              <span className={cn('text-2xl font-black tabular-nums tracking-tight leading-none', tier.textColor)}>
                {score.toLocaleString('da-DK')}
              </span>
              <span className={cn(
                'text-[11px] font-bold px-2 py-0.5 rounded-full text-white',
                `bg-gradient-to-r ${tier.color}`
              )}>
                {tier.label}
              </span>
            </div>
          </div>

          {hasStreak && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-px h-8 bg-foreground/10" />
              <div className="flex items-center gap-2 pl-1">
                <div className={cn(
                  'w-7 h-7 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0',
                  getStreakTierColor(currentStreak)
                )}>
                  {isRecord
                    ? <Award className="h-3.5 w-3.5 text-white" />
                    : <Flame className="h-3.5 w-3.5 text-white" />
                  }
                </div>
                <div>
                  <p className="text-xs font-bold text-orange-800 tabular-nums leading-none">
                    {currentStreak} mdr.
                  </p>
                  <p className="text-[10px] text-orange-600/70 leading-none mt-0.5">
                    {isRecord ? 'Rekord!' : `Rekord: ${longestStreak}`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        </button>
      </div>

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

            <div className={cn('px-5 pt-4 pb-5 shrink-0', tier.bg, tier.border, 'border-b')}>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40 mb-0.5">
                    Nuvio Score
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-black tabular-nums tracking-tight">
                      {score.toLocaleString('da-DK')}
                    </p>
                    <span className={cn(
                      'text-xs font-bold px-2.5 py-1 rounded-full text-white',
                      `bg-gradient-to-r ${tier.color}`
                    )}>
                      {tier.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto overscroll-contain flex-1 px-5 py-4 space-y-4 min-h-0">
              <div>
                <p className="text-sm font-semibold text-foreground mb-1.5">Hvad er Nuvio Score?</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Din Nuvio Score er et akkumulerende pointsystem der vokser for hver måned du holder dit budget. Jo bedre du klarer dig, og jo længere din streak er, jo hurtigere stiger den.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start gap-3 rounded-2xl bg-emerald-50/80 border border-emerald-100/60 px-4 py-3">
                  <Zap className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-800 mb-0.5">Pointsystem ved god måned</p>
                    <p className="text-xs text-emerald-700/80 leading-relaxed">
                      Du får 100 grundpoint + op til 50 kvalitetspoint afhængigt af, hvor disciplineret du brugte dit budget. Streakbonus giver 15% ekstra per måned i din aktive streak.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-orange-50/80 border border-orange-100/60 px-4 py-3">
                  <Flame className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-orange-800 mb-0.5">Straf ved overskridelse</p>
                    <p className="text-xs text-orange-700/80 leading-relaxed">
                      Overskrider du budgettet, mister du 25% af din score — minimum 50 point. Din streak nulstilles. Jo mere du har bygget op, jo mere gør det ondt.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground/50 uppercase tracking-widest mb-2">Niveauer</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Begynder', min: 0 },
                    { label: 'Aktiv', min: 150 },
                    { label: 'Erfaren', min: 400 },
                    { label: 'Mester', min: 900 },
                    { label: 'Legendarisk', min: 2000 },
                  ].map(t => (
                    <div
                      key={t.label}
                      className={cn(
                        'rounded-2xl border px-3 py-2.5',
                        score >= t.min
                          ? 'bg-emerald-50/80 border-emerald-200/60'
                          : 'bg-slate-50/60 border-slate-200/40 opacity-40'
                      )}
                    >
                      <p className="text-xs font-bold text-foreground/80">{t.label}</p>
                      <p className="text-[11px] text-muted-foreground">{t.min}+ point</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shrink-0 border-t border-foreground/5">
              <button
                onClick={() => setShowInfo(false)}
                className="w-full rounded-2xl text-white text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)', height: '52px' }}
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
