'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Landmark, Repeat, WalletCards } from 'lucide-react';

import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';

interface SingleAccountMethodReminderModalProps {
  onClose: () => void;
  onOpenExpenses: () => void;
  onAddExpense: () => void;
}

export function SingleAccountMethodReminderModal({
  onClose,
  onOpenExpenses,
  onAddExpense,
}: SingleAccountMethodReminderModalProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const { animating, direction, animate } = useWizardAnimation();

  const steps = useMemo(() => [
    {
      eyebrow: 'Kuvert-metoden',
      title: 'Kuvert fungerer bedst fra én konto',
      body: 'Når alle variable udgifter kører fra én bankkonto, bliver det langt lettere at holde Kuvert og virkeligheden i sync. Det gør overblikket enkelt i stedet for skrøbeligt.',
      highlightLabel: 'Grundprincippet',
      highlightValue: 'Én konto til Kuvert',
      icon: <Landmark className="h-5 w-5" />,
    },
    {
      eyebrow: 'Månedens rytme',
      title: 'Overfør beløbet og spejl det i Kuvert',
      body: 'Start måneden med at flytte det beløb, du vil bruge på variable udgifter, til den konto. Lad derefter Kuvert vise det samme beløb, så app og konto følger hinanden fra dag ét.',
      highlightLabel: 'Det der skal matche',
      highlightValue: 'Konto = Kuvert',
      icon: <Repeat className="h-5 w-5" />,
    },
    {
      eyebrow: 'Næste skridt',
      title: 'Hold metoden enkel',
      body: 'Åbn Udgifter for at tjekke dit nuværende rådighedsbeløb, eller registrér en ny udgift nu. Jo mere konsekvent du holder dig til én konto, jo stærkere bliver systemet.',
      highlightLabel: 'Målet',
      highlightValue: 'Enkelt og troværdigt',
      icon: <WalletCards className="h-5 w-5" />,
    },
  ], []);

  const current = steps[step];
  const isLast = step === steps.length - 1;

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(timeout);
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
