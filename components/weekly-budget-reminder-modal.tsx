'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Coins, Wallet, X } from 'lucide-react';

import type { QuickExpenseWeeklyStreak, WeeklyBudgetStatus } from '@/lib/quick-expense-service';
import { cn } from '@/lib/utils';

interface WeeklyBudgetReminderModalProps {
  week: WeeklyBudgetStatus;
  weeklyStreak: QuickExpenseWeeklyStreak | null;
  onClose: () => void;
  onOpenExpenses: () => void;
  onAddExpense: () => void;
}

function toSafeDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
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
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const safeWeekEnd = toSafeDate(weekEnd);
  const end = new Date(safeWeekEnd.getFullYear(), safeWeekEnd.getMonth(), safeWeekEnd.getDate());
  return Math.max(0, Math.floor((end.getTime() - startOfToday.getTime()) / 86400000) + 1);
}

function getBudgetSituation(week: WeeklyBudgetStatus, daysLeft: number): 'ahead' | 'close' | 'over' {
  if (week.isOver || week.remaining < 0) return 'over';

  const budget = Math.max(week.effectiveBudget, 0);
  if (budget <= 0) return 'close';

  const remainingRatio = week.remaining / budget;
  const closeThreshold = daysLeft <= 2 ? 0.2 : 0.15;

  if (remainingRatio <= closeThreshold || week.remaining <= budget / Math.max(daysLeft, 1)) {
    return 'close';
  }

  return 'ahead';
}

export function WeeklyBudgetReminderModal({
  week,
  weeklyStreak,
  onClose,
  onOpenExpenses,
  onAddExpense,
}: WeeklyBudgetReminderModalProps) {
  const [step, setStep] = useState(0);
  const daysLeft = getDaysLeftInWeek(week.weekEnd);
  const remaining = Math.round(week.remaining);
  const spent = Math.round(week.spent);
  const effectiveBudget = Math.round(week.effectiveBudget);
  const dailyAmount = daysLeft > 0 && remaining > 0 ? Math.floor(remaining / daysLeft) : 0;
  const currentStreak = weeklyStreak?.current_streak ?? 0;
  const nextStreak = currentStreak + (week.remaining >= 0 ? 1 : 0);
  const situation = getBudgetSituation(week, daysLeft);

  const steps = useMemo(() => {
    const statusCopy = {
      ahead: {
        title: `Du er foran budget i uge ${week.isoWeekNumber}`,
        body: `Du har ${formatDKK(remaining)} tilbage, så du står et roligt sted lige nu. Et hurtigt tjek nu hjælper dig med at holde den gode rytme resten af ugen.`,
        guidanceTitle: 'Sådan bevarer du overskuddet',
        guidanceBody: daysLeft > 0
          ? `Der er ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dage'} tilbage, og du har cirka ${formatDKK(dailyAmount)} pr. dag at gøre godt med uden at miste grebet.`
          : 'Ugen er ved at lukke, og du står stadig godt. Det er et fint tidspunkt at tage læringen med videre til næste uge.',
      },
      close: {
        title: `Du er tæt på grænsen i uge ${week.isoWeekNumber}`,
        body: `Du har ${formatDKK(Math.max(remaining, 0))} tilbage, så den her uge er stadig helt redbar. Nu handler det mest om at være bevidst i de næste køb.`,
        guidanceTitle: 'Det bedste træk lige nu',
        guidanceBody: daysLeft > 0
          ? `Der er ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dage'} tilbage. Hvis du holder dig omkring ${dailyAmount > 0 ? formatDKK(dailyAmount) : 'et lavt niveau'} pr. dag, er du stadig godt på vej til at holde ugebudgettet.`
          : 'Du er tæt på slutningen af ugen. Brug et øjeblik på at se, om der er noget, du kan udskyde til næste uge.',
      },
      over: {
        title: `Du er ${formatDKK(Math.abs(remaining))} over i uge ${week.isoWeekNumber}`,
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
  }, [currentStreak, dailyAmount, daysLeft, effectiveBudget, nextStreak, remaining, situation, spent, week]);

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-[82] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      style={{ backdropFilter: 'blur(8px)' }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-emerald-100/70 bg-white shadow-2xl">
        <div className="px-5 pb-6 pt-5">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
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
            <button
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary/30 text-foreground/70 transition-colors hover:bg-secondary/50"
              aria-label="Luk ugebudget-påmindelse"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="rounded-[24px] border border-emerald-100/70 bg-emerald-50/40 p-4">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#0E3B43] shadow-sm">
              {current.icon}
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2E9E84]">
              {current.eyebrow}
            </p>
            <h2 className="mt-3 text-[2rem] font-semibold leading-tight tracking-tight text-foreground">
              {current.title}
            </h2>
            <p className="mt-3 text-base leading-8 text-muted-foreground">
              {current.body}
            </p>

            <div className="mt-5 rounded-[22px] border border-emerald-100/80 bg-white/90 px-4 py-3">
              <p className="text-sm text-muted-foreground">{current.highlightLabel}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-[#0E3B43]">
                {current.highlightValue}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              disabled={step === 0}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-colors',
                step === 0
                  ? 'cursor-not-allowed text-muted-foreground/40'
                  : 'text-foreground/70 hover:bg-secondary/30'
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbage
            </button>

            {!isLast ? (
              <button
                type="button"
                onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0E3B43] to-[#2ED3A7] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200/60 transition-transform active:scale-[0.98]"
              >
                Videre
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onAddExpense}
                  className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/20"
                >
                  Registrér udgift
                </button>
                <button
                  type="button"
                  onClick={onOpenExpenses}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0E3B43] to-[#2ED3A7] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200/60 transition-transform active:scale-[0.98]"
                >
                  Åbn Ugebudget
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
