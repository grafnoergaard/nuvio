'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Coins, Wallet } from 'lucide-react';

import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';

interface MonthCloseReminderModalProps {
  monthlyBudget: number;
  monthlySpent: number;
  scoreThreshold: number;
  carryOverPenalty?: number;
  onClose: () => void;
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

function getMonthSituation(remaining: number, budget: number, daysLeft: number) {
  if (remaining < 0) return 'over';
  if (budget <= 0) return 'close';

  const remainingRatio = remaining / budget;
  const closeThreshold = daysLeft <= 4 ? 0.18 : 0.12;
  if (remainingRatio <= closeThreshold) return 'close';

  return 'ahead';
}

export function MonthCloseReminderModal({
  monthlyBudget,
  monthlySpent,
  scoreThreshold,
  carryOverPenalty = 0,
  onClose,
  onAddExpense,
}: MonthCloseReminderModalProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const { animating, direction, animate } = useWizardAnimation();

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);
  const remaining = Math.round(monthlyBudget - monthlySpent);
  const dailyAvailable = daysLeft > 0 && remaining > 0 ? Math.floor(remaining / daysLeft) : 0;
  const monthLabel = now.toLocaleDateString('da-DK', { month: 'long' });
  const situation = getMonthSituation(remaining, monthlyBudget, daysLeft);

  const monthScore = (() => {
    if (monthlyBudget <= 0) return 0;
    if (remaining < 0) return 0;
    const idealDailyRate = monthlyBudget / daysInMonth;
    const affordableDailyRate = remaining / daysLeft;
    const recoveryRatio = idealDailyRate > 0 ? affordableDailyRate / idealDailyRate : 0;
    const carryOverPenaltyRatio = monthlyBudget > 0 ? carryOverPenalty / monthlyBudget : 0;
    const penaltyFactor = Math.max(0, 1 - carryOverPenaltyRatio * 2);

    const baseScore = (() => {
      if (recoveryRatio >= 1 + scoreThreshold) return 100;
      if (recoveryRatio <= 0) return 0;
      return Math.max(0, Math.min(100, (recoveryRatio / (1 + scoreThreshold)) * 100));
    })();

    return Math.round(baseScore * penaltyFactor);
  })();

  const steps = useMemo(() => {
    const copy = {
      ahead: {
        title: `Du står roligt i ${monthLabel}`,
        body: `Du har stadig ${formatDKK(remaining)} tilbage, så du er ikke i en jagtet position. Det her er et godt tidspunkt at lande måneden bevidst i stedet for bare at lade den glide ud.`,
        guidanceTitle: 'Sådan lander du blødt',
        guidanceBody: `Der er ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dage'} tilbage. Hvis du holder dig omkring ${formatDKK(dailyAvailable)} pr. dag, bevarer du både overblikket og roen resten af måneden.`,
      },
      close: {
        title: `${monthLabel} er ved at stramme til`,
        body: `Du har ${formatDKK(Math.max(remaining, 0))} tilbage. Det er stadig helt håndterbart, men nu hjælper det at være bevidst om de sidste køb i måneden.`,
        guidanceTitle: 'Det vigtigste lige nu',
        guidanceBody: `Der er ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dage'} tilbage. Hold dig omkring ${dailyAvailable > 0 ? formatDKK(dailyAvailable) : 'et lavt niveau'} pr. dag, så lander du måneden pænere.`,
      },
      over: {
        title: `${monthLabel} er kørt lidt over`,
        body: `Du er ${formatDKK(Math.abs(remaining))} over lige nu. Det er ikke en katastrofe, men det er et rigtig godt øjeblik at få overblik og lande resten af måneden mere roligt.`,
        guidanceTitle: 'Tag styringen tilbage',
        guidanceBody: `Der er ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dage'} tilbage. Hvis du holder igen nu og får registreret det sidste ordentligt, starter næste måned stærkere.`,
      },
    }[situation];

    return [
      {
        eyebrow: 'Måneden lukker snart',
        title: copy.title,
        body: copy.body,
        highlightLabel: 'Tilbage denne måned',
        highlightValue: formatDKK(Math.max(remaining, 0)),
        icon: <Wallet className="h-5 w-5" />,
      },
      {
        eyebrow: 'Næste skridt',
        title: copy.guidanceTitle,
        body: copy.guidanceBody,
        highlightLabel: 'Per dag resten af måneden',
        highlightValue: remaining < 0 ? 'Hold lidt igen' : formatDKK(dailyAvailable),
        icon: <Coins className="h-5 w-5" />,
      },
      {
        eyebrow: 'Din måned',
        title: `Din månedsscore er ${monthScore}`,
        body: 'Brug de sidste dage på at lukke måneden bevidst. Et hurtigt tjek af udgifter eller en sidste registrering nu gør næste måned lettere at starte i.',
        highlightLabel: 'Brugt indtil nu',
        highlightValue: `${formatDKK(monthlySpent)} af ${formatDKK(monthlyBudget)}`,
        icon: <CalendarDays className="h-5 w-5" />,
      },
    ];
  }, [dailyAvailable, daysLeft, monthLabel, monthScore, monthlyBudget, monthlySpent, remaining, situation]);

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
                onClick={onClose}
                className="flex h-14 items-center justify-center rounded-full bg-[#0E3B43] px-5 text-base font-semibold text-white transition active:scale-[0.98]"
              >
                Tak for overblikket
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
