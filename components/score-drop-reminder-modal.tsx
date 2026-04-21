'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BarChart3, CalendarDays, Wallet } from 'lucide-react';

import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';

interface ScoreDropReminderModalProps {
  monthlyBudget: number;
  monthlySpent: number;
  scoreThreshold: number;
  carryOverPenalty?: number;
  onClose: () => void;
  onOpenExpenses: () => void;
  onAddExpense: () => void;
}

function formatDKK(value: number): string {
  return value.toLocaleString('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function computeMonthScore(
  monthlyBudget: number,
  monthlySpent: number,
  scoreThreshold: number,
  carryOverPenalty: number,
  now: Date
) {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(1, daysInMonth - now.getDate() + 1);
  const remaining = monthlyBudget - monthlySpent;
  const monthlyOverBudget = monthlyBudget > 0 && monthlySpent > monthlyBudget;

  if (monthlyBudget <= 0) {
    return { score: 0, remainingDays, daysInMonth, remaining, dailyAvailable: 0 };
  }

  if (monthlyOverBudget) {
    return { score: 0, remainingDays, daysInMonth, remaining, dailyAvailable: 0 };
  }

  if (remainingDays <= 0) {
    return {
      score: remaining >= 0 ? 100 : 0,
      remainingDays,
      daysInMonth,
      remaining,
      dailyAvailable: 0,
    };
  }

  const idealDailyRate = monthlyBudget / daysInMonth;
  const affordableDailyRate = remaining / remainingDays;
  const recoveryRatio = idealDailyRate > 0 ? affordableDailyRate / idealDailyRate : 0;
  const carryOverPenaltyRatio = monthlyBudget > 0 ? carryOverPenalty / monthlyBudget : 0;
  const penaltyFactor = Math.max(0, 1 - carryOverPenaltyRatio * 2);
  const baseScore = (() => {
    if (recoveryRatio >= 1 + scoreThreshold) return 100;
    if (recoveryRatio <= 0) return 0;
    return Math.max(0, Math.min(100, (recoveryRatio / (1 + scoreThreshold)) * 100));
  })();

  return {
    score: Math.round(baseScore * penaltyFactor),
    remainingDays,
    daysInMonth,
    remaining,
    dailyAvailable: remainingDays > 0 && remaining > 0 ? Math.floor(remaining / remainingDays) : 0,
  };
}

type ScoreSituation = 'caution' | 'risk';

function getScoreSituation(score: number): ScoreSituation {
  return score < 50 ? 'risk' : 'caution';
}

export function ScoreDropReminderModal({
  monthlyBudget,
  monthlySpent,
  scoreThreshold,
  carryOverPenalty = 0,
  onClose,
  onOpenExpenses,
  onAddExpense,
}: ScoreDropReminderModalProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const { animating, direction, animate } = useWizardAnimation();

  const now = new Date();
  const monthLabel = now.toLocaleDateString('da-DK', { month: 'long' });
  const { score, remainingDays, remaining, dailyAvailable } = computeMonthScore(
    monthlyBudget,
    monthlySpent,
    scoreThreshold,
    carryOverPenalty,
    now
  );
  const situation = getScoreSituation(score);

  const steps = useMemo(() => {
    const copy = {
      caution: {
        title: 'Din score er begyndt at glide',
        body: `Du er ikke i frit fald, men ${monthLabel} er kommet et sted hen, hvor et lille tjek nu gør en reel forskel. Det er her, du kan vende udviklingen, mens der stadig er plads.`,
        guidanceTitle: 'Det vigtigste lige nu',
        guidanceBody: remaining > 0
          ? `Du har ${formatDKK(remaining)} tilbage og ${remainingDays} ${remainingDays === 1 ? 'dag' : 'dage'} endnu. Hold dig omkring ${formatDKK(dailyAvailable)} pr. dag, så løfter du scoren igen.`
          : `Du er presset i ${monthLabel}. Et hurtigt overblik nu hjælper dig med at undgå, at scoren glider længere ned.`,
      },
      risk: {
        title: 'Din score er under pres lige nu',
        body: `Nu er det værd at reagere. ${monthLabel} er kommet et sted hen, hvor et roligt tjek kan gøre forskellen mellem at lande hårdt og få styr på det i tide.`,
        guidanceTitle: 'Tag styringen tilbage',
        guidanceBody: remaining > 0
          ? `Du har stadig ${formatDKK(remaining)} tilbage. Hvis du holder igen de sidste ${remainingDays} ${remainingDays === 1 ? 'dag' : 'dage'}, kan du stadig løfte måneden pænt.`
          : `Du er ${formatDKK(Math.abs(remaining))} over lige nu. Det vigtigste er ikke perfektion, men at få øje på, hvad der trak scoren ned, mens måneden stadig er åben.`,
      },
    }[situation];

    return [
      {
        eyebrow: 'Score falder',
        title: copy.title,
        body: copy.body,
        highlightLabel: 'Din score lige nu',
        highlightValue: `${score}`,
        icon: <BarChart3 className="h-5 w-5" />,
      },
      {
        eyebrow: 'Næste skridt',
        title: copy.guidanceTitle,
        body: copy.guidanceBody,
        highlightLabel: 'Tilbage denne måned',
        highlightValue: formatDKK(Math.max(remaining, 0)),
        icon: <Wallet className="h-5 w-5" />,
      },
      {
        eyebrow: 'Måneden er stadig åben',
        title: `Der er stadig tid i ${monthLabel}`,
        body: 'Åbn Udgifter for at se, hvad der trækker, eller registrér en udgift nu, mens du stadig har mulighed for at vende retningen.',
        highlightLabel: 'Dage tilbage',
        highlightValue: `${remainingDays}`,
        icon: <CalendarDays className="h-5 w-5" />,
      },
    ];
  }, [dailyAvailable, monthLabel, remaining, remainingDays, score, situation]);

  const current = steps[step];
  const isLast = step === steps.length - 1;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const color = 'rgb(236,253,245)';
    document.body.style.backgroundColor = color;
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
    return () => {
      document.body.style.backgroundColor = '';
      if (meta) meta.content = '#ffffff';
    };
  }, []);

  return (
    <WizardShell
      gradient="linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 42%, #ffffff 100%)"
      visible={visible}
      step={step}
      totalSteps={steps.length}
      showBack={step > 0}
      showClose={true}
      onBack={() => animate('back', () => setStep((value) => Math.max(0, value - 1)))}
      onClose={onClose}
      animating={animating}
      direction={direction}
    >
      <div className="flex min-h-full flex-col">
        <div className="flex-1 flex flex-col justify-center py-2">
          <div className="p-5">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-white/88 text-[#0E3B43]">
              {current.icon}
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2E9E84]">
              {current.eyebrow}
            </p>
            <h2 className="mt-3 text-[2.15rem] font-bold leading-[1.08] tracking-tight text-foreground sm:text-[2.5rem]">
              {current.title}
            </h2>
            <p className="mt-4 text-lg leading-8 text-foreground/65">
              {current.body}
            </p>

            <div className="mt-6 rounded-[24px] border border-emerald-100/70 bg-white/55 px-4 py-4">
              <p className="text-sm font-medium text-muted-foreground">{current.highlightLabel}</p>
              <p className="mt-2 text-[2rem] font-semibold tracking-tight text-[#0E3B43] sm:text-[2.2rem]">
                {current.highlightValue}
              </p>
            </div>

            <div className="mt-5 flex items-center gap-2">
              {steps.map((_, index) => (
                <span
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === step ? 'w-8 bg-[#2E9E84]' : 'w-2 bg-foreground/10'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 pb-4">
          {isLast ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={onOpenExpenses}
                className="flex h-14 items-center justify-center rounded-full bg-[#0E3B43] px-5 text-base font-semibold text-white transition active:scale-[0.98]"
              >
                Se udgifter
              </button>
              <button
                onClick={onAddExpense}
                className="flex h-14 items-center justify-center rounded-full bg-[#56C7A7] px-5 text-base font-semibold text-white transition active:scale-[0.98]"
              >
                Tilføj udgift
              </button>
            </div>
          ) : (
            <button
              onClick={() => animate('forward', () => setStep((value) => Math.min(steps.length - 1, value + 1)))}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#4AA58A] to-[#63C488] px-5 text-base font-semibold text-white shadow-[0_14px_30px_rgba(86,199,167,0.22)] transition active:scale-[0.98]"
            >
              Fortsæt
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </WizardShell>
  );
}
