'use client';

import { useMemo, useState } from 'react';
import { Check, Palmtree, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { recordVacationFlowSavings } from '@/lib/flow-savings-service';
import { upsertMonthlyBudget, type QuickExpense } from '@/lib/quick-expense-service';
import { completeVacationMode, type VacationMode } from '@/lib/vacation-mode-service';
import { notifyVacationModeChanged } from '@/lib/vacation-mode-events';

interface VacationModeCompletionFlowProps {
  vacationMode: VacationMode | null;
  expenses: QuickExpense[];
  open: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

type Step = 'analysis' | 'remaining-budget';

function formatDKK(value: number): string {
  return value.toLocaleString('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function parseAmount(value: string): number {
  const normalized = value.replace(/\./g, '').replace(',', '.').trim();
  return Number(normalized);
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getElapsedVacationDays(vacationMode: VacationMode, now: Date): Date[] {
  const start = parseDateOnly(vacationMode.start_date);
  const plannedEnd = parseDateOnly(vacationMode.end_date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = today < plannedEnd ? today : plannedEnd;

  if (end < start) return [];

  const days: Date[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    days.push(new Date(cursor));
  }
  return days;
}

function getVacationStats(vacationMode: VacationMode, expenses: QuickExpense[]) {
  const budget = Number(vacationMode.budget_amount) || 0;
  const spent = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const dailyBudget = vacationMode.number_of_days > 0 ? budget / vacationMode.number_of_days : 0;
  const elapsedDays = getElapsedVacationDays(vacationMode, new Date());

  const spentByDay = new Map<string, number>();
  for (const expense of expenses) {
    const key = expense.expense_date.slice(0, 10);
    spentByDay.set(key, (spentByDay.get(key) ?? 0) + Number(expense.amount || 0));
  }

  let cumulativeSpent = 0;
  const dayResults = elapsedDays.map((day, index) => {
    cumulativeSpent += spentByDay.get(dateKey(day)) ?? 0;
    return cumulativeSpent <= dailyBudget * (index + 1);
  });

  let streak = 0;
  for (let index = dayResults.length - 1; index >= 0; index -= 1) {
    if (!dayResults[index]) break;
    streak += 1;
  }

  const daysWithinBudget = dayResults.filter(Boolean).length;
  const balance = budget - spent;

  return {
    budget,
    spent,
    surplus: Math.max(0, balance),
    overspend: Math.max(0, -balance),
    daysWithinBudget,
    streak,
  };
}

export function VacationModeCompletionFlow({
  vacationMode,
  expenses,
  open,
  onClose,
  onCompleted,
}: VacationModeCompletionFlowProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('analysis');
  const [remainingBudget, setRemainingBudget] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => {
    if (!vacationMode) return null;
    return getVacationStats(vacationMode, expenses);
  }, [vacationMode, expenses]);

  if (!open || !vacationMode || !stats) return null;

  const wentOver = stats.overspend > 0;
  const resultTitle = wentOver
    ? `Ferien gik ${formatDKK(stats.overspend)} over budget`
    : stats.surplus > 0
      ? `Du sparede ${formatDKK(stats.surplus)} på ferien`
      : 'Feriekuverten gik præcist op';

  async function handleComplete() {
    if (!user || !vacationMode || !stats) return;

    const amount = parseAmount(remainingBudget);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Indtast et gyldigt beløb til resten af måneden.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (stats.surplus > 0) {
        await recordVacationFlowSavings(
          vacationMode.id,
          stats.surplus,
          stats.budget,
          stats.spent
        );
      }

      const now = new Date();
      await upsertMonthlyBudget(now.getFullYear(), now.getMonth() + 1, amount);
      await completeVacationMode(vacationMode.id, user.id);
      notifyVacationModeChanged();

      toast.success('Feriekuvert afsluttet');
      onCompleted?.();
    } catch (completeError) {
      console.error('Could not complete vacation mode', completeError);
      setError('Kunne ikke afslutte feriekuverten. Prøv igen.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[88] flex items-end justify-center bg-black/38 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-[6px] sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-[34px] border border-[#D6E4E4] bg-white shadow-2xl shadow-[#0E3B43]/14">
        <div className="h-2 bg-[linear-gradient(90deg,#F6C126_0%,#FFE6A0_48%,#F6C126_100%)]" />
        <div className="px-6 pb-6 pt-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[#F6C126]/18 text-[#0E3B43] ring-1 ring-[#F6C126]/35">
              <Palmtree className="h-7 w-7" />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F7FAF8] text-foreground/70 ring-1 ring-black/5"
              aria-label="Luk"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {step === 'analysis' ? (
            <>
              <p className="mb-3 text-[0.74rem] font-semibold uppercase tracking-[0.24em] text-[#B88A00]">
                Ferie afslutning
              </p>
              <h2 className="text-4xl font-semibold leading-tight tracking-tight text-foreground">
                {resultTitle}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Her er den korte landing, før Kuvert vender tilbage til din normale måned.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <SummaryTile label="Feriebudget" value={formatDKK(stats.budget)} />
                <SummaryTile label="Brugt" value={formatDKK(stats.spent)} />
                <SummaryTile
                  label={wentOver ? 'Overforbrug' : 'Sparet'}
                  value={formatDKK(wentOver ? stats.overspend : stats.surplus)}
                  highlight
                />
                <SummaryTile label="Dags-streak" value={`${stats.streak}`} />
                <SummaryTile
                  label="Dage indenfor budget"
                  value={`${stats.daysWithinBudget} af ${vacationMode.number_of_days}`}
                />
              </div>

              <div className="mt-6 grid gap-3">
                <button
                  type="button"
                  onClick={() => setStep('remaining-budget')}
                  className="flex h-16 items-center justify-center gap-3 rounded-full bg-[#0E3B43] text-lg font-semibold text-white transition-transform active:scale-[0.99]"
                >
                  Fortsæt
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-12 rounded-full text-base font-semibold text-muted-foreground"
                >
                  Ikke nu
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mb-3 text-[0.74rem] font-semibold uppercase tracking-[0.24em] text-[#B88A00]">
                Tilbage til Kuvert
              </p>
              <h2 className="text-4xl font-semibold leading-tight tracking-tight text-foreground">
                Hvad har du til rådighed resten af måneden?
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Beløbet bliver dit nye normale rådighedsbeløb for den aktuelle måned.
              </p>

              <label className="mt-6 block">
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/65">
                  Rådighedsbeløb
                </span>
                <div className="mt-2 flex items-center gap-3 rounded-[22px] border border-[#D6E4E4] bg-[#F8FBFA] px-4 py-3">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={remainingBudget}
                    onChange={(event) => setRemainingBudget(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-3xl font-semibold text-[#0E3B43] outline-none placeholder:text-muted-foreground/45"
                    placeholder="0"
                  />
                  <span className="text-xl font-semibold text-muted-foreground">kr.</span>
                </div>
              </label>

              {error && (
                <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}

              <div className="mt-6 grid gap-3">
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={saving}
                  className="flex h-16 items-center justify-center gap-3 rounded-full bg-[#0E3B43] text-lg font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-60"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F6C126] text-[#0E3B43]">
                    <Check className="h-5 w-5" />
                  </span>
                  {saving ? 'Afslutter...' : 'Afslut feriekuvert'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('analysis')}
                  className="h-12 rounded-full text-base font-semibold text-muted-foreground"
                >
                  Tilbage
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-[20px] border border-[#DCE8E8] bg-[#F8FBFA] px-4 py-3">
      <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
        {label}
      </p>
      <p className={`mt-1 text-base font-semibold leading-snug ${highlight ? 'text-[#B88A00]' : 'text-[#0E3B43]'}`}>
        {value}
      </p>
    </div>
  );
}
