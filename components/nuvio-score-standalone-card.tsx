'use client';

import { useState } from 'react';
import { X, Flame, Zap, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCardStyle, getTopBarStyle, useSettings } from '@/lib/settings-context';
import type { QuickExpenseStreak } from '@/lib/quick-expense-service';

interface Props {
  streak: QuickExpenseStreak | null;
  displayScore?: number;
  className?: string;
}

const TIERS = [
  { label: 'Begynder', min: 0 },
  { label: 'Aktiv', min: 150 },
  { label: 'Erfaren', min: 400 },
  { label: 'Mester', min: 900 },
  { label: 'Legendarisk', min: 2000 },
];

function getScoreTier(score: number) {
  if (score >= 2000) return { label: 'Legendarisk', color: 'from-amber-400 to-yellow-500', bg: 'bg-gradient-to-br from-amber-50 to-yellow-50/60', border: 'border-amber-200/70', textColor: 'text-amber-900', barColor: '#f59e0b' };
  if (score >= 900) return { label: 'Mester', color: 'from-teal-400 to-emerald-500', bg: 'bg-gradient-to-br from-teal-50 to-emerald-50/60', border: 'border-teal-200/70', textColor: 'text-teal-900', barColor: '#0d9488' };
  if (score >= 400) return { label: 'Erfaren', color: 'from-emerald-400 to-teal-500', bg: 'bg-gradient-to-br from-emerald-50 to-teal-50/60', border: 'border-emerald-200/70', textColor: 'text-emerald-900', barColor: '#10b981' };
  if (score >= 150) return { label: 'Aktiv', color: 'from-teal-300 to-emerald-400', bg: 'bg-gradient-to-br from-teal-50/80 to-emerald-50/40', border: 'border-teal-200/50', textColor: 'text-teal-800', barColor: '#2dd4bf' };
  return { label: 'Begynder', color: 'from-teal-300 to-emerald-300', bg: 'bg-gradient-to-br from-slate-50 to-teal-50/30', border: 'border-slate-200/60', textColor: 'text-slate-700', barColor: '#94a3b8' };
}

function TierProgressBar({ score }: { score: number }) {
  const currentTierIndex = TIERS.reduce((acc, t, i) => score >= t.min ? i : acc, 0);
  const currentTier = TIERS[currentTierIndex];
  const nextTier = TIERS[currentTierIndex + 1];

  const progressWithinTier = nextTier
    ? Math.min(100, ((score - currentTier.min) / (nextTier.min - currentTier.min)) * 100)
    : 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {TIERS.map((tier, i) => {
          const isReached = score >= tier.min;
          const isCurrent = i === currentTierIndex;
          return (
            <div key={tier.label} className="flex flex-col items-center gap-1 flex-1">
              <div className={cn(
                'h-1.5 w-full rounded-full transition-all duration-700',
                i === 0 ? 'rounded-l-full' : '',
                i === TIERS.length - 1 ? 'rounded-r-full' : '',
                isReached ? 'bg-gradient-to-r from-teal-400 to-emerald-400' : 'bg-black/[0.06]'
              )} />
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        {TIERS.map((tier, i) => {
          const isReached = score >= tier.min;
          const isCurrent = i === currentTierIndex;
          return (
            <span
              key={tier.label}
              className={cn(
                'text-[9px] font-semibold leading-none transition-all duration-300',
                isCurrent ? 'text-teal-700' : isReached ? 'text-emerald-600/70' : 'text-muted-foreground/30'
              )}
            >
              {tier.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function NuvioScoreStandaloneCard({ streak, displayScore, className }: Props) {
  const { design } = useSettings();
  const [showInfo, setShowInfo] = useState(false);

  const cumulativeScore = displayScore ?? streak?.cumulative_score ?? 0;
  const tier = getScoreTier(cumulativeScore);
  const nextTierIndex = TIERS.findIndex(t => cumulativeScore < t.min);
  const nextTier = nextTierIndex > 0 ? TIERS[nextTierIndex] : null;
  const pointsToNext = nextTier ? nextTier.min - cumulativeScore : null;
  const cardMedium = design.cardMedium;
  const cardStyleBase = getCardStyle(cardMedium, design.gradientFrom, design.gradientTo);
  const topBarStyleOverride = getTopBarStyle(cardMedium, design.gradientFrom, design.gradientTo);

  return (
    <>
      <button
        onClick={() => setShowInfo(true)}
        className={cn(
          'w-full text-left rounded-2xl border shadow-sm transition-all duration-500 hover:shadow-md active:scale-[0.99]',
          'bg-gradient-to-br from-emerald-50/80 via-teal-50/30 to-white border-emerald-200/50',
          className
        )}
        style={cardStyleBase}
      >
        {topBarStyleOverride && (
          <div style={topBarStyleOverride} />
        )}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-2', `bg-gradient-to-br ${tier.color}`, 'ring-white/40')}>
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 leading-none mb-0.5">
                Kuvert Score
              </p>
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold tracking-wide text-white', `bg-gradient-to-r ${tier.color}`)}>
                {tier.label}
              </span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
        </div>

        <div className="px-5 pb-4">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <p className={cn('text-6xl sm:text-7xl font-semibold tabular-nums tracking-tight leading-none', tier.textColor)}>
                {cumulativeScore.toLocaleString('da-DK')}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1.5 leading-snug">
                {pointsToNext
                  ? `${pointsToNext.toLocaleString('da-DK')} point til ${nextTier!.label}`
                  : 'Maksimalt niveau nået'}
              </p>
            </div>
          </div>

          <TierProgressBar score={cumulativeScore} />
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

            <div className={cn('px-5 pt-4 pb-5 shrink-0', tier.bg, tier.border, 'border-b')}>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40 mb-0.5">
                    Kuvert Score
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-black tabular-nums tracking-tight">
                      {cumulativeScore.toLocaleString('da-DK')}
                    </p>
                    <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full text-white', `bg-gradient-to-r ${tier.color}`)}>
                      {tier.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto overscroll-contain flex-1 px-5 py-4 space-y-4 min-h-0">
              <div>
                <p className="text-sm font-semibold text-foreground mb-1.5">Hvad er Kuvert Score?</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Din Kuvert Score er et akkumulerende pointsystem der vokser for hver måned du holder dit budget. Jo bedre du klarer dig, og jo længere din streak er, jo hurtigere stiger den.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-teal-50/80 border border-teal-100/60 px-4 py-3">
                <Zap className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-teal-800 mb-0.5">Scoren lever i hverdagen</p>
                  <p className="text-xs text-teal-700/80 leading-relaxed">
                    Den viste score bevæger sig lidt gennem måneden ud fra månedsscore og ugens rytme. Bonus og straf bliver stadig låst fast ved månedsskifte.
                  </p>
                </div>
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
                  {TIERS.map(t => (
                    <div
                      key={t.label}
                      className={cn(
                        'rounded-2xl border px-3 py-2.5',
                        cumulativeScore >= t.min
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
