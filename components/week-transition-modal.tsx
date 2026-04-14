'use client';

import { useState, useEffect } from 'react';
import { X, TrendingDown, TrendingUp, Bot, ChevronRight, ChartBar as BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAiContext } from '@/lib/ai-context';
import type { WeekSummaryData, WeekAiAnalysis } from '@/lib/week-transition-service';
import { fetchWeekAiAnalysis } from '@/lib/week-transition-service';

const DANISH_MONTHS = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
];

function formatDKK(value: number): string {
  return Math.abs(value).toLocaleString('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function WeekLabel({ weekNumber, month, year }: { weekNumber: number; month: number; year: number }) {
  return (
    <span className="capitalize">
      Uge {weekNumber}, {DANISH_MONTHS[month - 1]} {year}
    </span>
  );
}

interface Props {
  summaryData: WeekSummaryData;
  cachedAiSummary: string | null;
  accessToken?: string;
  onAcknowledge: (aiSummary: string | null) => void;
  onDismiss: () => void;
}

export default function WeekTransitionModal({
  summaryData,
  cachedAiSummary,
  onAcknowledge,
  onDismiss,
}: Props) {
  const { setWizardActive } = useAiContext();
  const [aiAnalysis, setAiAnalysis] = useState<WeekAiAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWizardActive(true);
    return () => setWizardActive(false);
  }, [setWizardActive]);

  const isOver = summaryData.totalSpent > summaryData.budgetAmount;
  const diff = summaryData.budgetAmount - summaryData.totalSpent;
  const pctUsed = summaryData.budgetAmount > 0
    ? Math.min(100, (summaryData.totalSpent / summaryData.budgetAmount) * 100)
    : 0;

  const hasPrevWeekData = summaryData.budgetAmount > 0 || summaryData.transactionCount > 0;
  const nextMonth = summaryData.weekNumber >= 4 && summaryData.month < 12
    ? summaryData.month + 1
    : summaryData.month;

  const avgComparison =
    summaryData.avgTransactionsPerWeek !== null
      ? summaryData.transactionCount > summaryData.avgTransactionsPerWeek
        ? 'over'
        : summaryData.transactionCount < summaryData.avgTransactionsPerWeek
        ? 'under'
        : 'same'
      : null;

  useEffect(() => {
    if (cachedAiSummary) {
      try {
        const parsed = JSON.parse(cachedAiSummary);
        setAiAnalysis(parsed);
      } catch {
        setAiAnalysis({ message: cachedAiSummary, focusNextWeek: '', tone: 'neutral' });
      }
      return;
    }

    setAiLoading(true);
    fetchWeekAiAnalysis(summaryData)
      .then(result => {
        setAiAnalysis(result);
        setAiLoading(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Ukendt fejl';
        setAiError(msg);
        setAiLoading(false);
      });
  }, []);

  async function handleAcknowledge() {
    setSaving(true);
    const serialized = aiAnalysis ? JSON.stringify(aiAnalysis) : null;
    await onAcknowledge(serialized);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ left: 'var(--sidebar-offset-global, 0px)' }}>
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onDismiss}
      />

      <div
        className="relative w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{ animation: 'slideUp 300ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
      >
        <div className={cn(
          'h-1.5 w-full shrink-0',
          isOver
            ? 'bg-gradient-to-r from-amber-400 to-orange-400'
            : 'bg-gradient-to-r from-emerald-400 to-teal-400'
        )} />

        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1">
                Ny uge starter
              </p>
              <h2 className="text-xl font-semibold tracking-tight">
                Ugeskifte
              </h2>
            </div>
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-secondary transition-colors -mt-0.5 -mr-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {hasPrevWeekData && (
            <div className={cn(
              'rounded-2xl p-4 border',
              isOver
                ? 'bg-amber-50/80 border-amber-200/50'
                : 'bg-emerald-50/80 border-emerald-200/50'
            )}>
              <div className="flex items-center gap-2 mb-3">
                <div className={cn(
                  'w-7 h-7 rounded-xl flex items-center justify-center shrink-0',
                  isOver ? 'bg-amber-100' : 'bg-emerald-100'
                )}>
                  {isOver
                    ? <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
                    : <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />
                  }
                </div>
                <p className="text-sm font-semibold">
                  <WeekLabel
                    weekNumber={summaryData.isoWeekNumber}
                    month={summaryData.month}
                    year={summaryData.year}
                  />
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center">
                  <p className="text-xs font-medium text-muted-foreground/70 mb-0.5">Budget</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {summaryData.budgetAmount > 0 ? formatDKK(summaryData.budgetAmount) : '—'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-muted-foreground/70 mb-0.5">Brugt</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatDKK(summaryData.totalSpent)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-muted-foreground/70 mb-0.5">
                    {isOver ? 'Over' : 'Sparet'}
                  </p>
                  <p className={cn(
                    'text-sm font-semibold tabular-nums',
                    isOver ? 'text-amber-600' : 'text-emerald-600'
                  )}>
                    {summaryData.budgetAmount > 0 ? formatDKK(Math.abs(diff)) : '—'}
                  </p>
                </div>
              </div>

              {summaryData.budgetAmount > 0 && (
                <div className="space-y-1.5">
                  <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        isOver ? 'bg-amber-400' : 'bg-emerald-400'
                      )}
                      style={{ width: `${pctUsed}%` }}
                    />
                  </div>
                  <p className="text-label text-muted-foreground/60">
                    {isOver
                      ? `Du brugte ${formatDKK(Math.abs(diff))} mere end planlagt — trækkes fra næste uges budget.`
                      : `Du brugte ${formatDKK(Math.abs(diff))} mindre end planlagt.`
                    }
                  </p>
                </div>
              )}

              {summaryData.transactionCount > 0 && (
                <div className="mt-3 pt-3 border-t border-black/5 flex items-center gap-2">
                  <BarChart2 className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  <p className="text-label text-muted-foreground/70">
                    {summaryData.transactionCount} {summaryData.transactionCount === 1 ? 'postering' : 'posteringer'}
                    {avgComparison && summaryData.avgTransactionsPerWeek !== null && (
                      <>
                        {' '}
                        <span className={cn(
                          avgComparison === 'over' ? 'text-amber-600' : avgComparison === 'under' ? 'text-emerald-600' : ''
                        )}>
                          ({avgComparison === 'over'
                            ? `${summaryData.transactionCount - Math.round(summaryData.avgTransactionsPerWeek)} over gennemsnit`
                            : avgComparison === 'under'
                            ? `${Math.round(summaryData.avgTransactionsPerWeek) - summaryData.transactionCount} under gennemsnit`
                            : 'på niveau med gennemsnit'
                          })
                        </span>
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl bg-muted/30 border border-border/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">
              Næste uge
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold tabular-nums tracking-tight">
                {formatDKK(summaryData.nextWeekBudget)}
              </p>
            </div>
            {hasPrevWeekData && isOver && Math.abs(diff) > 1 && (
              <p className="text-label text-muted-foreground/60 mt-1">
                Grundbudget fratrukket {formatDKK(Math.abs(diff))} fra denne uge
              </p>
            )}
          </div>

          <div className={cn(
            'rounded-2xl border p-4',
            aiLoading
              ? 'bg-muted/20 border-border/30'
              : aiError
              ? 'bg-muted/20 border-border/30'
              : aiAnalysis?.tone === 'positive'
              ? 'bg-emerald-50/60 border-emerald-200/40'
              : aiAnalysis?.tone === 'warning' || aiAnalysis?.tone === 'critical'
              ? 'bg-amber-50/60 border-amber-200/40'
              : 'bg-blue-50/40 border-blue-200/30'
          )}>
            <div className="flex items-center gap-2 mb-3">
              <div className={cn(
                'w-7 h-7 rounded-xl flex items-center justify-center shrink-0',
                aiLoading
                  ? 'bg-muted/40'
                  : aiAnalysis?.tone === 'positive'
                  ? 'bg-emerald-100'
                  : aiAnalysis?.tone === 'warning' || aiAnalysis?.tone === 'critical'
                  ? 'bg-amber-100'
                  : 'bg-blue-100'
              )}>
                <Bot className={cn(
                  'h-3.5 w-3.5',
                  aiLoading
                    ? 'text-muted-foreground/40 animate-pulse'
                    : aiAnalysis?.tone === 'positive'
                    ? 'text-emerald-600'
                    : aiAnalysis?.tone === 'warning' || aiAnalysis?.tone === 'critical'
                    ? 'text-amber-600'
                    : 'text-blue-600'
                )} />
              </div>
              <p className="text-sm font-semibold text-foreground/80">Nuvio AI — Ugeanalyse</p>
            </div>

            {aiLoading && (
              <div className="space-y-2">
                <div className="h-3 bg-muted/40 rounded-full animate-pulse w-full" />
                <div className="h-3 bg-muted/40 rounded-full animate-pulse w-4/5" />
                <div className="h-3 bg-muted/40 rounded-full animate-pulse w-3/5 mt-1" />
              </div>
            )}

            {!aiLoading && aiError && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground/60">
                  AI-analyse er ikke tilgængelig lige nu. Prøv igen senere.
                </p>
                <p className="text-xs text-red-500/70 font-mono break-all">
                  {aiError}
                </p>
              </div>
            )}

            {!aiLoading && aiAnalysis && (
              <div className="space-y-3">
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {aiAnalysis.message}
                </p>
                {aiAnalysis.focusNextWeek && (
                  <div className="flex items-start gap-2 pt-2 border-t border-black/5">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground/80 leading-relaxed">
                      <span className="font-semibold text-foreground/70">Fokus næste uge: </span>
                      {aiAnalysis.focusNextWeek}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            <button
              onClick={handleAcknowledge}
              disabled={saving}
              className={cn(
                'w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold',
                'transition-all duration-200 hover:shadow-md',
                saving && 'opacity-60 cursor-not-allowed'
              )}
            >
              {saving ? 'Gemmer…' : 'Forstået — start ny uge'}
            </button>
            <button
              onClick={onDismiss}
              className="w-full h-9 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              Luk for nu
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(32px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
