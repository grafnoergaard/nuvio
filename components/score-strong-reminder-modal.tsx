'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Sparkles, Wallet } from 'lucide-react';

import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';

interface ScoreStrongReminderModalProps {
  monthlyBudget: number;
  monthlySpent: number;
  scoreThreshold: number;
  carryOverPenalty?: number;
  onClose: () => void;
  onOpenExpenses: () => void;
  onAddExpense: () => void;
}

type ScoreStrengthTier = 'strong' | 'very_strong' | 'near_perfect';

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
    return { score: 0, remainingDays, remaining, dailyAvailable: 0 };
  }

  if (monthlyOverBudget) {
    return { score: 0, remainingDays, remaining, dailyAvailable: 0 };
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
    remaining,
    dailyAvailable: remainingDays > 0 && remaining > 0 ? Math.floor(remaining / remainingDays) : 0,
  };
}

export function ScoreStrongReminderModal({
  monthlyBudget,
  monthlySpent,
  scoreThreshold,
  carryOverPenalty = 0,
  onClose,
  onOpenExpenses,
  onAddExpense,
}: ScoreStrongReminderModalProps) {
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

  const strengthTier: ScoreStrengthTier = score >= 97 ? 'near_perfect' : score >= 92 ? 'very_strong' : 'strong';

  const steps = useMemo(() => [
    ...(function buildSteps() {
      if (strengthTier === 'near_perfect') {
        return [
          {
            eyebrow: 'Næsten perfekt score',
            title: 'Du har ramt en usædvanligt stærk rytme',
            body: `Din score er næsten perfekt i ${monthLabel}. Det betyder, at dine valg hænger sammen hele vejen fra overblik til handling - og det er faktisk ret sjældent.`,
            highlightLabel: 'Din score lige nu',
            highlightValue: `${score}`,
            icon: <Sparkles className="h-5 w-5" />,
          },
          {
            eyebrow: 'Bevar det enkle',
            title: 'Det handler bare om at holde linjen',
            body: remaining > 0
              ? `Du har ${formatDKK(remaining)} tilbage og ${remainingDays} ${remainingDays === 1 ? 'dag' : 'dage'} endnu. Fortsæt omkring ${formatDKK(dailyAvailable)} pr. dag, så kan du lande måneden virkelig flot.`
              : 'Du er allerede landet stærkt. Et kort tjek nu er nok til at bevare den næsten perfekte rytme helt til målstregen.',
            highlightLabel: 'Tilbage denne måned',
            highlightValue: formatDKK(Math.max(remaining, 0)),
            icon: <Wallet className="h-5 w-5" />,
          },
          {
            eyebrow: 'Luk måneden godt',
            title: `Nu handler det om at beskytte ${monthLabel}`,
            body: 'Åbn Udgifter for at holde det skarpe overblik, eller registrér en ny udgift nu, så scoren bliver ved med at afspejle virkeligheden.',
            highlightLabel: 'Dage tilbage',
            highlightValue: `${remainingDays}`,
            icon: <CalendarDays className="h-5 w-5" />,
          },
        ];
      }

      if (strengthTier === 'very_strong') {
        return [
          {
            eyebrow: 'Meget stærk score',
            title: 'Du har virkelig godt greb om måneden',
            body: `Din score står meget stærkt i ${monthLabel}. Det er et tegn på, at du både har retning og ro i økonomien lige nu.`,
            highlightLabel: 'Din score lige nu',
            highlightValue: `${score}`,
            icon: <Sparkles className="h-5 w-5" />,
          },
          {
            eyebrow: 'Det der virker',
            title: 'Hold fast i den gode rytme',
            body: remaining > 0
              ? `Du har ${formatDKK(remaining)} tilbage og ${remainingDays} ${remainingDays === 1 ? 'dag' : 'dage'} endnu. Hvis du holder dig omkring ${formatDKK(dailyAvailable)} pr. dag, bevarer du det stærke momentum.`
              : 'Du står stærkt, fordi du har taget gode valg tidligere i måneden. Et roligt tjek nu hjælper dig med at lukke den lige så pænt.',
            highlightLabel: 'Tilbage denne måned',
            highlightValue: formatDKK(Math.max(remaining, 0)),
            icon: <Wallet className="h-5 w-5" />,
          },
          {
            eyebrow: 'Resten af måneden',
            title: `Der er stadig plads i ${monthLabel}`,
            body: 'Åbn Udgifter for at bevare overblikket, eller registrér en ny udgift med det samme, så den stærke score holder hele vejen hjem.',
            highlightLabel: 'Dage tilbage',
            highlightValue: `${remainingDays}`,
            icon: <CalendarDays className="h-5 w-5" />,
          },
        ];
      }

      return [
        {
          eyebrow: 'Din score er stærk',
          title: 'Du har godt greb om måneden',
          body: `Din score står stærkt lige nu. Det er et tegn på, at dine valg i ${monthLabel} faktisk virker i praksis - ikke bare i teorien.`,
          highlightLabel: 'Din score lige nu',
          highlightValue: `${score}`,
          icon: <Sparkles className="h-5 w-5" />,
        },
        {
          eyebrow: 'Bliv i det gode spor',
          title: 'Det vigtigste er at holde rytmen',
          body: remaining > 0
            ? `Du har ${formatDKK(remaining)} tilbage og ${remainingDays} ${remainingDays === 1 ? 'dag' : 'dage'} endnu. Hvis du holder dig omkring ${formatDKK(dailyAvailable)} pr. dag, beskytter du det gode momentum.`
            : `Scoren er stærk, fordi du har været skarp tidligere i måneden. Et kort tjek nu hjælper dig med at lande roligt resten af vejen.`,
          highlightLabel: 'Tilbage denne måned',
          highlightValue: formatDKK(Math.max(remaining, 0)),
          icon: <Wallet className="h-5 w-5" />,
        },
        {
          eyebrow: 'Resten af måneden',
          title: `Der er stadig plads i ${monthLabel}`,
          body: 'Åbn Udgifter for at bevare overblikket, eller registrér en ny udgift med det samme, så din score fortsat afspejler virkeligheden.',
          highlightLabel: 'Dage tilbage',
          highlightValue: `${remainingDays}`,
          icon: <CalendarDays className="h-5 w-5" />,
        },
      ];
    })(),
  ], [dailyAvailable, monthLabel, remaining, remainingDays, score, strengthTier]);

  const current = steps[step];
  const isLast = step === steps.length - 1;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
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
        <div className="flex flex-1 flex-col justify-center py-2">
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
