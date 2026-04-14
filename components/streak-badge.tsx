'use client';

import { useState } from 'react';
import { Flame, Award, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuickExpenseStreak } from '@/lib/quick-expense-service';

interface Props {
  streak: QuickExpenseStreak;
  className?: string;
}

const MILESTONE_LABELS: Record<number, string> = {
  3: 'Tre i træk',
  6: 'Et halvt år',
  12: 'Et helt år',
  24: 'To år',
};

function getMilestoneLabel(n: number): string | null {
  const milestones = [24, 12, 6, 3];
  for (const m of milestones) {
    if (n >= m) return MILESTONE_LABELS[m];
  }
  return null;
}

export default function StreakBadge({ streak, className }: Props) {
  const [showPopup, setShowPopup] = useState(false);

  if (streak.current_streak === 0) return null;

  const milestone = getMilestoneLabel(streak.current_streak);
  const isRecord = streak.current_streak >= streak.longest_streak && streak.current_streak > 1;

  const tierColor =
    streak.current_streak >= 12
      ? 'from-amber-400 to-orange-500'
      : streak.current_streak >= 6
      ? 'from-orange-400 to-red-400'
      : 'from-orange-300 to-amber-400';

  const tierBg =
    streak.current_streak >= 12
      ? 'bg-amber-50 border-amber-200/60'
      : streak.current_streak >= 6
      ? 'bg-orange-50 border-orange-200/60'
      : 'bg-orange-50/70 border-orange-200/40';

  return (
    <>
      <button
        onClick={() => setShowPopup(true)}
        className={cn(
          'flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-left w-full',
          'hover:shadow-sm transition-all duration-200 active:scale-[0.99]',
          tierBg,
          className
        )}
      >
        <div className={cn(
          'w-8 h-8 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0',
          tierColor
        )}>
          {isRecord
            ? <Award className="h-4 w-4 text-white" />
            : <Flame className="h-4 w-4 text-white" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-orange-900">
              {streak.current_streak} {streak.current_streak === 1 ? 'måned' : 'måneder'} i træk
            </p>
            {milestone && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-orange-200/60 text-orange-700 uppercase tracking-wide">
                {milestone}
              </span>
            )}
          </div>
          <p className="text-label text-orange-600/70 mt-0.5">
            {isRecord
              ? 'Personlig rekord!'
              : `Rekord: ${streak.longest_streak} måneder`
            }
          </p>
        </div>
      </button>

      {showPopup && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowPopup(false)}
          />
          <div
            className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
            style={{ animation: 'slideUp 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
          >
            <div className={cn('px-6 pt-8 pb-6 text-center', tierBg)}>
              <div className={cn(
                'w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center mx-auto mb-4',
                tierColor
              )}>
                {isRecord
                  ? <Award className="h-8 w-8 text-white" />
                  : <Flame className="h-8 w-8 text-white" />
                }
              </div>
              <p className="text-2xl font-bold text-orange-900 mb-1">
                {streak.current_streak} {streak.current_streak === 1 ? 'måned' : 'måneder'} i træk
              </p>
              {milestone && (
                <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full bg-orange-200/70 text-orange-700 uppercase tracking-wide mb-2">
                  {milestone}
                </span>
              )}
              <p className="text-sm text-orange-700/70">
                {isRecord ? 'Du slår din personlige rekord!' : `Personlig rekord: ${streak.longest_streak} måneder`}
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
                onClick={() => setShowPopup(false)}
                className="w-full h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-all duration-200"
              >
                Forstået
              </button>
            </div>

            <button
              onClick={() => setShowPopup(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-orange-700/50 hover:text-orange-700 hover:bg-orange-100/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
