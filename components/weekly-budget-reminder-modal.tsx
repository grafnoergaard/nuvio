'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Coins, Wallet } from 'lucide-react';

import type { QuickExpenseWeeklyStreak, WeeklyBudgetStatus } from '@/lib/quick-expense-service';
import { cn } from '@/lib/utils';
import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';
import { getDaysLeftInRange, getWeeklyBudgetSituation, toSafeDate } from '@/lib/weekly-budget-helpers';

interface WeeklyBudgetReminderModalProps {
  week: WeeklyBudgetStatus;
  weeklyStreak: QuickExpenseWeeklyStreak | null;
  mode?: 'weekly-budget-reminder' | 'weekly-budget-low' | 'streak-risk';
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

function formatShortDate(date: Date | string): string {
  return toSafeDate(date).toLocaleDateString('da-DK', {
    day: 'numeric',
    month: 'short',
  });
}

function getDaysLeftInWeek(weekEnd: Date | string): number {
  return getDaysLeftInRange(weekEnd);
}

export function WeeklyBudgetReminderModal({
  week,
  weeklyStreak,
  mode = 'weekly-budget-reminder',
  onClose,
  onAddExpense,
}: WeeklyBudgetReminderModalProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const { animating, direction, animate } = useWizardAnimation();
  const daysLeft = getDaysLeftInWeek(week.weekEnd);
  const remaining = Math.round(week.remaining);
  const spent = Math.round(week.spent);
  const effectiveBudget = Math.round(week.effectiveBudget);
  const dailyAmount = daysLeft > 0 && remaining > 0 ? Math.floor(remaining / daysLeft) : 0;
  const currentStreak = weeklyStreak?.current_streak ?? 0;
  const nextStreak = currentStreak + (week.remaining >= 0 ? 1 : 0);
  const situation = getWeeklyBudgetSituation(week, daysLeft);

  const steps = useMemo(() => {
    if (mode === 'weekly-budget-low') {
      const lowBudgetCopy = {
        close: {
          title: 'Der er ikke meget luft tilbage i denne uge',
          body: `Du har ${formatDKK(Math.max(remaining, 0))} tilbage. Det er stadig til at styre, men de næste køb betyder mere end normalt.`,
          actionTitle: 'Gør de næste køb lidt langsommere',
          actionBody: daysLeft > 0
            ? `Der er ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dage'} tilbage. Prøv at holde dig tæt på ${dailyAmount > 0 ? formatDKK(dailyAmount) : 'det nødvendige'} pr. dag, så ugen kan lande roligt.`
            : 'Ugen er næsten lukket. Brug et øjeblik på at se, hvad der helst skal vente til næste uge.',
        },
        over: {
          title: `Ugebudgettet er brugt op`,
          body: `Du er ${formatDKK(Math.abs(remaining))} over. Det vigtigste nu er ikke dårlig samvittighed, men at stoppe lækket mens ugen stadig er i gang.`,
          actionTitle: 'Tag et roligt tjek nu',
          actionBody: daysLeft > 0
            ? `Der er stadig ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dage'} tilbage. Hvis du holder igen resten af ugen, bliver næste start meget lettere.`
            : 'Ugen lukker snart. Se hvad der trak dig over, og tag læringen med ind i næste uge.',
        },
        ahead: {
          title: 'Ugebudgettet ser stadig roligt ud',
          body: `Du har ${formatDKK(remaining)} tilbage. Den her besked er mest et lille tjek, så du ikke mister overblikket.`,
          actionTitle: 'Hold den gode retning',
          actionBody: daysLeft > 0
            ? `Med cirka ${formatDKK(dailyAmount)} pr. dag tilbage har du stadig en fin ramme. Hold øje med de variable køb.`
            : 'Ugen er næsten lukket, og du står stadig godt.',
        },
      }[situation];

      return [
        {
          eyebrow: 'Lavt ugebudget',
          title: lowBudgetCopy.title,
          body: lowBudgetCopy.body,
          highlightLabel: 'Tilbage i denne uge',
          highlightValue: formatDKK(Math.max(remaining, 0)),
          icon: <Wallet className="h-5 w-5" />,
        },
        {
          eyebrow: 'Næste valg',
          title: lowBudgetCopy.actionTitle,
          body: lowBudgetCopy.actionBody,
          highlightLabel: 'Per dag resten af ugen',
          highlightValue:
            situation === 'over'
              ? 'Hold igen'
              : dailyAmount > 0
                ? formatDKK(dailyAmount)
                : 'Pas godt på resten',
          icon: <Coins className="h-5 w-5" />,
        },
        {
          eyebrow: 'Kuvert-princippet',
          title: 'Når kuverten er lav, skal valgene være tydelige',
          body: 'Det er hele pointen: du skal kunne se, om der er plads, uden at regne i hovedet. Nu har du signalet, før ugen løber fra dig.',
          highlightLabel: 'Ugens ramme',
          highlightValue: `${formatDKK(spent)} af ${formatDKK(effectiveBudget)}`,
          icon: <CalendarDays className="h-5 w-5" />,
        },
      ];
    }

    if (mode === 'streak-risk') {
      const streakValue = currentStreak > 0
        ? `${currentStreak} ${currentStreak === 1 ? 'uge i træk' : 'uger i træk'}`
        : 'Ny rytme starter med én uge';

      const streakRiskCopy = {
        close: {
          title: 'Din streak er værd at beskytte i denne uge',
          body: `Du er tæt på grænsen, men du er ikke væltet ud over endnu. Et lille skift nu kan være nok til at holde rytmen i live.`,
          actionTitle: 'Det vigtigste lige nu',
          actionBody: daysLeft > 0
            ? `Der er ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dage'} tilbage. Hold dig så tæt som muligt på ${dailyAmount > 0 ? formatDKK(dailyAmount) : 'et lavt niveau'} pr. dag, så giver du streaken de bedste chancer.`
            : 'Ugen lukker snart, så det vigtigste nu er et hurtigt overblik over de sidste køb.',
        },
        over: {
          title: 'Din streak er i fare i denne uge',
          body: `Du er ${formatDKK(Math.abs(remaining))} over, men det betyder ikke, at rytmen er tabt. Et roligt kig nu gør det lettere at lande ugen bedre og tage læringen med videre.`,
          actionTitle: 'Tag styringen tilbage nu',
          actionBody: daysLeft > 0
            ? `Der er stadig ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dage'} tilbage. Hvis du holder igen resten af ugen, beskytter du både overblikket og din rytme.`
            : 'Ugen er ved at lukke. Brug et øjeblik på at se, hvad der trak dig over, så næste uge starter mere roligt.',
        },
        ahead: {
          title: 'Din streak ser stærk ud i denne uge',
          body: `Du står faktisk godt. Det her flow hjælper bare med at beskytte den rytme, du allerede er i gang med at bygge.`,
          actionTitle: 'Sådan holder du streaken levende',
          actionBody: daysLeft > 0
            ? `Du har cirka ${formatDKK(dailyAmount)} pr. dag tilbage uden at miste grebet. Hold kursen, så lander du endnu en god uge.`
            : 'Ugen er næsten lukket, og du står stadig godt. Det er et stærkt udgangspunkt for næste uge.',
        },
      }[situation];

      return [
        {
          eyebrow: 'Streak i fare',
          title: streakRiskCopy.title,
          body: streakRiskCopy.body,
          highlightLabel: 'Din nuværende rytme',
          highlightValue: streakValue,
          icon: <Wallet className="h-5 w-5" />,
        },
        {
          eyebrow: 'Bevar rytmen',
          title: streakRiskCopy.actionTitle,
          body: streakRiskCopy.actionBody,
          highlightLabel: 'Ugens ramme',
          highlightValue: `${formatDKK(spent)} af ${formatDKK(effectiveBudget)}`,
          icon: <Coins className="h-5 w-5" />,
        },
        {
          eyebrow: 'Næste skridt',
          title: currentStreak > 0
            ? `Holder du den her uge, lander du på ${nextStreak}`
            : 'En god uge er starten på din rytme',
          body: currentStreak > 0
            ? `Det bedste næste skridt er ikke perfekt kontrol, men et hurtigt overblik. Åbn Ugebudget eller registrér en udgift nu, mens ugen stadig er i dine hænder.`
            : 'Åbn Ugebudget eller registrér en udgift nu, så du tager styringen tilbage med det samme.',
          highlightLabel: 'Ugens periode',
          highlightValue: `${formatShortDate(week.weekStart)} - ${formatShortDate(week.weekEnd)}`,
          icon: <CalendarDays className="h-5 w-5" />,
        },
      ];
    }

    const statusCopy = {
      ahead: {
        title: 'Du er foran budget i denne uge',
        body: `Du har ${formatDKK(remaining)} tilbage, så du står et roligt sted lige nu. Et hurtigt tjek nu hjælper dig med at holde den gode rytme resten af ugen.`,
        guidanceTitle: 'Sådan bevarer du overskuddet',
        guidanceBody: daysLeft > 0
          ? `Der er ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dage'} tilbage, og du har cirka ${formatDKK(dailyAmount)} pr. dag at gøre godt med uden at miste grebet.`
          : 'Ugen er ved at lukke, og du står stadig godt. Det er et fint tidspunkt at tage læringen med videre til næste uge.',
      },
      close: {
        title: 'Du er tæt på grænsen i denne uge',
        body: `Du har ${formatDKK(Math.max(remaining, 0))} tilbage, så den her uge er stadig helt redbar. Nu handler det mest om at være bevidst i de næste køb.`,
        guidanceTitle: 'Det bedste træk lige nu',
        guidanceBody: daysLeft > 0
          ? `Der er ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dage'} tilbage. Hvis du holder dig omkring ${dailyAmount > 0 ? formatDKK(dailyAmount) : 'et lavt niveau'} pr. dag, er du stadig godt på vej til at holde ugebudgettet.`
          : 'Du er tæt på slutningen af ugen. Brug et øjeblik på at se, om der er noget, du kan udskyde til næste uge.',
      },
      over: {
        title: `Du er ${formatDKK(Math.abs(remaining))} over i denne uge`,
        body: 'Det er ikke farligt, men det er et godt tidspunkt at tage et hurtigt kig på ugens udgifter og lande blødt i stedet for at lade det løbe videre.',
        guidanceTitle: 'Dit bedste næste skridt',
        guidanceBody: daysLeft > 0
          ? `Der er ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dage'} tilbage. Hvis du holder igen nu og får overblik over de næste køb, kan du stadig afslutte ugen langt bedre.`
          : 'Ugen er ved at lukke. Brug et øjeblik på at se, hvad der trak dig over, så næste uge starter mere roligt.',
      },
    }[situation];

    const streakTitle = 'Det betyder for din rytme';
    const streakBody = situation === 'over'
      ? currentStreak > 0
        ? `Din nuværende rytme er ${currentStreak} ${currentStreak === 1 ? 'uge' : 'uger'}. Hvis du vil beskytte den, er Ugebudget det rigtige sted at starte.`
        : 'Det her er et godt tidspunkt at tage styringen tilbage. En god uge er nok til at starte en ny rytme.'
      : situation === 'close'
        ? currentStreak > 0
          ? `Du er stadig med i rytmen på ${currentStreak} ${currentStreak === 1 ? 'uge' : 'uger'}. Den her uge er stadig din at lande godt.`
          : 'Du er stadig tæt nok på til at gøre den her uge til starten på en god rytme.'
        : currentStreak > 0
          ? `Du er på ${currentStreak} ${currentStreak === 1 ? 'uge' : 'uger'} i træk. Holder du den her uge, lander du på ${nextStreak}.`
          : 'Holder du den her uge, starter du din første uge i træk indenfor budget.';

    return [
      {
        eyebrow: 'Ugebudget-påmindelse',
        title: statusCopy.title,
        body: statusCopy.body,
        highlightLabel: 'Ugens ramme',
        highlightValue: `${formatDKK(spent)} af ${formatDKK(effectiveBudget)}`,
        icon: <Wallet className="h-5 w-5" />,
      },
      {
        eyebrow: 'Næste skridt',
        title: statusCopy.guidanceTitle,
        body: statusCopy.guidanceBody,
        highlightLabel: 'Per dag resten af ugen',
        highlightValue:
          situation === 'over'
            ? 'Hold lidt igen'
            : situation === 'close'
              ? dailyAmount > 0 ? formatDKK(dailyAmount) : 'Pas godt på resten'
              : formatDKK(dailyAmount),
        icon: <Coins className="h-5 w-5" />,
      },
      {
        eyebrow: 'Din rytme',
        title: streakTitle,
        body: streakBody,
        highlightLabel: 'Ugens periode',
        highlightValue: `${formatShortDate(week.weekStart)} - ${formatShortDate(week.weekEnd)}`,
        icon: <CalendarDays className="h-5 w-5" />,
      },
    ];
  }, [currentStreak, dailyAmount, daysLeft, effectiveBudget, mode, nextStreak, remaining, situation, spent, week]);

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const closeCtaLabel =
    mode === 'streak-risk'
      ? 'Jeg passer på rytmen'
      : mode === 'weekly-budget-low'
        ? 'Det er godt at vide'
        : 'Det giver mening';

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
                  className={cn(
                    'h-2 rounded-full transition-all duration-200',
                    index === step ? 'w-10 bg-[#0E3B43]' : 'w-2 bg-emerald-100'
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 pt-4">
          {!isLast ? (
            <button
              type="button"
              onClick={() => animate('forward', () => setStep((value) => Math.min(steps.length - 1, value + 1)))}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0E3B43] to-[#2ED3A7] px-6 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-200/60 transition-transform active:scale-[0.98]"
            >
              Videre
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border/60 bg-white/80 px-5 py-4 text-base font-semibold text-foreground transition-colors hover:bg-secondary/20"
              >
                {closeCtaLabel}
              </button>
              <button
                type="button"
                onClick={onAddExpense}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0E3B43] to-[#2ED3A7] px-6 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-200/60 transition-transform active:scale-[0.98]"
              >
                Registrér udgift
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </WizardShell>
  );
}
