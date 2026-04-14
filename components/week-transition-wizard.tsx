'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Bot, Check, X as XIcon } from 'lucide-react';
import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';
import { cn } from '@/lib/utils';
import type { WeekSummaryData, WeekAiAnalysis } from '@/lib/week-transition-service';
import { fetchWeekAiAnalysis } from '@/lib/week-transition-service';
import { addQuickExpense } from '@/lib/quick-expense-service';
import { useAiContext } from '@/lib/ai-context';

const DANISH_MONTHS = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
];

function formatDKK(value: number): string {
  return Math.abs(Math.round(value)).toLocaleString('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}


interface BottomSheetProps {
  summaryData: WeekSummaryData;
  dismissCount: number;
  onOpen: () => void;
  onDismiss: () => void;
}

export function WeekTransitionBottomSheet({
  summaryData,
  dismissCount,
  onOpen,
  onDismiss,
}: BottomSheetProps) {
  const [visible, setVisible] = useState(false);
  const isOver = summaryData.totalSpent > summaryData.budgetAmount;
  const diff = summaryData.budgetAmount - summaryData.totalSpent;
  const pctUsed = summaryData.budgetAmount > 0
    ? Math.min(100, (summaryData.totalSpent / summaryData.budgetAmount) * 100)
    : 0;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onDismiss}
      />
      <div
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        style={{
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
          transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div className={cn(
          'h-1.5 w-full',
          isOver
            ? 'bg-gradient-to-r from-amber-400 to-orange-400'
            : 'bg-gradient-to-r from-emerald-500 to-teal-400'
        )} />

        <div className="px-6 pt-6 pb-6">
          <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70 mb-3">
            Uge {summaryData.isoWeekNumber}, {DANISH_MONTHS[summaryData.month - 1]} {summaryData.year}
          </p>

          <h2 className="text-2xl font-bold tracking-tight leading-tight mb-1">
            {isOver
              ? `Du brugte ${formatDKK(Math.abs(diff))} for meget`
              : `Du sparede ${formatDKK(Math.abs(diff))} denne uge`
            }
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            {isOver
              ? 'Du brugte mere end planlagt'
              : 'Du brugte mindre end planlagt'
            }
          </p>

          {summaryData.budgetAmount > 0 && (
            <div className="mb-6">
              <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden mb-1.5">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    isOver ? 'bg-amber-400' : 'bg-emerald-400'
                  )}
                  style={{ width: `${pctUsed}%` }}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  {formatDKK(summaryData.totalSpent)} brugt
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDKK(summaryData.budgetAmount)} budget
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={onOpen}
              className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
            >
              Se din ugeanalyse
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={onDismiss}
              className="w-full h-10 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {dismissCount >= 1 ? 'Vis ikke igen' : 'Ikke nu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const STEP_BG_GRADIENTS = [
  'linear-gradient(to bottom, #ecfdf5, #f0fdfa, #ffffff)',
  'linear-gradient(to bottom, #ecfdf5, #ffffff, #f0fdfa)',
  'linear-gradient(to bottom, #f0fdfa, #ecfdf5, #ffffff)',
  'linear-gradient(to bottom, #ecfdf5, #f0fdfa, #ffffff)',
  'linear-gradient(to bottom, #f0fdfa, #ecfdf5, #ffffff)',
];

const TOTAL_STEPS = 5;

interface WizardProps {
  summaryData: WeekSummaryData;
  cachedAiSummary: string | null;
  monthlySavings: number;
  onAcknowledge: (aiSummary: string | null) => Promise<void>;
  onDismiss: () => void;
  onExpenseAdded: () => Promise<WeekSummaryData>;
}

export function WeekTransitionWizard({
  summaryData: initialSummaryData,
  cachedAiSummary,
  monthlySavings,
  onAcknowledge,
  onDismiss,
  onExpenseAdded,
}: WizardProps) {
  const { setWizardActive } = useAiContext();
  const [step, setStep] = useState(0);
  const { animating, direction, animate } = useWizardAnimation();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summaryData, setSummaryData] = useState<WeekSummaryData>(initialSummaryData);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [allRegistered, setAllRegistered] = useState<boolean | null>(null);

  const [aiAnalysis, setAiAnalysis] = useState<WeekAiAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const isOver = summaryData.totalSpent > summaryData.budgetAmount;
  const diff = summaryData.budgetAmount - summaryData.totalSpent;
  const pctUsed = summaryData.budgetAmount > 0
    ? Math.min(100, (summaryData.totalSpent / summaryData.budgetAmount) * 100)
    : 0;

  const avgComparison =
    summaryData.avgTransactionsPerWeek !== null
      ? summaryData.transactionCount > summaryData.avgTransactionsPerWeek
        ? 'over'
        : summaryData.transactionCount < summaryData.avgTransactionsPerWeek
        ? 'under'
        : 'same'
      : null;

  useEffect(() => {
    setWizardActive(true);
    return () => setWizardActive(false);
  }, [setWizardActive]);

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

  useEffect(() => {
    if (step >= 2) {
      startAiFetch();
    }
  }, [step]);

  function startAiFetch() {
    if (aiAnalysis || aiLoading) return;

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
      .catch(() => {
        setAiError('AI-analyse er ikke tilgængelig lige nu');
        setAiLoading(false);
      });
  }

  function next() {
    if (step === 2) {
      if (allRegistered === null) return;
    }
    animate('forward', () => setStep(s => Math.min(s + 1, TOTAL_STEPS - 1)));
  }

  function back() {
    animate('back', () => setStep(s => Math.max(s - 1, 0)));
  }

  async function handleExpenseSaved() {
    setShowAddExpenseModal(false);
    setAllRegistered(null);
    try {
      const updated = await onExpenseAdded();
      setSummaryData(updated);
    } catch {
    }
  }

  async function handleFinish() {
    setSaving(true);
    const serialized = aiAnalysis ? JSON.stringify(aiAnalysis) : null;
    await onAcknowledge(serialized);
  }

  const gradient = STEP_BG_GRADIENTS[step] ?? STEP_BG_GRADIENTS[0];
  const showBack = step > 0;


  return (
    <WizardShell
      gradient={gradient}
      visible={visible}
      step={step}
      totalSteps={TOTAL_STEPS}
      showBack={showBack}
      showClose={true}
      onBack={back}
      onClose={onDismiss}
      animating={animating}
      direction={direction}
    >
      {step === 0 && (
        <Step0Result
          summaryData={summaryData}
          diff={diff}
          isOver={isOver}
        />
      )}

      {step === 1 && (
        <Step1Overview
          summaryData={summaryData}
          diff={diff}
          isOver={isOver}
          pctUsed={pctUsed}
        />
      )}

      {step === 2 && (
        <Step2Behavior
          summaryData={summaryData}
          avgComparison={avgComparison}
          allRegistered={allRegistered}
          onAllRegisteredChange={(val) => {
            setAllRegistered(val);
            if (val === false) setShowAddExpenseModal(true);
          }}
        />
      )}

      {step === 3 && (
        <Step3Forward
          summaryData={summaryData}
          diff={diff}
          isOver={isOver}
          monthlySavings={monthlySavings}
        />
      )}

      {step === 4 && (
        <Step4Ai
          aiAnalysis={aiAnalysis}
          aiLoading={aiLoading}
          aiError={aiError}
        />
      )}

      <div className="pt-6">
        {step < 4 && (
          <button
            onClick={next}
            disabled={step === 2 && allRegistered !== true}
            className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: step === 2 && allRegistered !== true ? '#9ca3af' : 'linear-gradient(to right, #0d9488, #10b981)' }}
          >
            {step === 0 ? 'Fortsæt' : step === 1 ? 'Næste' : step === 2 ? 'Okay' : 'Giver mening'}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}

        {step === 4 && (
          <button
            onClick={handleFinish}
            disabled={saving}
            className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
          >
            {saving ? 'Gemmer…' : 'Start ny uge'}
            {!saving && <ArrowRight className="h-4 w-4" />}
          </button>
        )}
      </div>

      {showAddExpenseModal && (
        <AddExpenseModal
          weekEnd={summaryData.weekEnd}
          onSave={handleExpenseSaved}
          onClose={() => {
            setShowAddExpenseModal(false);
            setAllRegistered(null);
          }}
        />
      )}
    </WizardShell>
  );
}

function Step0Result({
  summaryData,
  diff,
  isOver,
}: {
  summaryData: WeekSummaryData;
  diff: number;
  isOver: boolean;
}) {
  return (
    <div className="space-y-5 flex-1 flex flex-col justify-center">
      <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
        Uge {summaryData.isoWeekNumber} — Resultat
      </p>
      <h1
        className={cn(
          'text-6xl sm:text-7xl font-bold leading-none tracking-tight tabular-nums',
          isOver ? 'text-amber-600' : 'text-emerald-600'
        )}
      >
        {isOver ? '−' : '+'}{formatDKK(Math.abs(diff))}
      </h1>
      <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
        {isOver
          ? 'Du brugte lidt for meget denne uge.'
          : 'Du sparede penge denne uge.'
        }
      </p>
      <p className="text-foreground/60 text-base leading-relaxed">
        {isOver
          ? 'Du brugte mere end planlagt denne uge.'
          : 'Du brugte mindre end planlagt denne uge.'
        }
      </p>
    </div>
  );
}

function Step1Overview({
  summaryData,
  diff,
  isOver,
  pctUsed,
}: {
  summaryData: WeekSummaryData;
  diff: number;
  isOver: boolean;
  pctUsed: number;
}) {
  return (
    <div className="space-y-6 flex-1 flex flex-col justify-center">
      <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
        Overblik
      </p>
      <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
        Du brugte {formatDKK(summaryData.totalSpent)} ud af {formatDKK(summaryData.budgetAmount)}
      </h2>

      {summaryData.budgetAmount > 0 && (
        <div className="space-y-2">
          <div className="h-3 rounded-full bg-foreground/8 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-1000',
                isOver ? 'bg-amber-400' : 'bg-emerald-400'
              )}
              style={{ width: `${pctUsed}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(pctUsed)}% af budget brugt</span>
            <span>{formatDKK(summaryData.budgetAmount)}</span>
          </div>
        </div>
      )}

      <div className="bg-foreground/[0.04] border border-foreground/8 rounded-2xl px-5 py-4">
        <p className="text-sm font-medium text-foreground leading-relaxed">
          {isOver
            ? `Du brugte ${formatDKK(Math.abs(diff))} mere end planlagt.`
            : `Du holdt dig godt under dit budget.`
          }
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {isOver
            ? 'Beløbet overføres til næste uge.'
            : `Du sparede ${formatDKK(Math.abs(diff))} denne uge.`
          }
        </p>
      </div>
    </div>
  );
}

function Step2Behavior({
  summaryData,
  avgComparison,
  allRegistered,
  onAllRegisteredChange,
}: {
  summaryData: WeekSummaryData;
  avgComparison: 'over' | 'under' | 'same' | null;
  allRegistered: boolean | null;
  onAllRegisteredChange: (val: boolean) => void;
}) {
  const count = summaryData.transactionCount;
  const avg = summaryData.avgTransactionsPerWeek;

  const diffFromAvg = avg !== null ? Math.abs(Math.round(avg) - count) : null;

  return (
    <div className="space-y-5 flex-1 flex flex-col">
      <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
        Din adfærd
      </p>
      <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
        Du havde {count} {count === 1 ? 'postering' : 'posteringer'}
      </h2>

      {avg !== null && diffFromAvg !== null && avgComparison !== 'same' && (
        <p className="text-foreground/65 text-lg leading-relaxed">
          Det er {diffFromAvg} {diffFromAvg === 1 ? 'postering' : 'posteringer'}{' '}
          {avgComparison === 'under' ? 'under' : 'over'} dit gennemsnit
        </p>
      )}

      {avg !== null && avgComparison === 'same' && (
        <p className="text-foreground/65 text-lg leading-relaxed">
          Det er på niveau med dit gennemsnit
        </p>
      )}

      <div className="h-px bg-foreground/8" />

      <div className="bg-foreground/[0.04] border border-foreground/8 rounded-2xl px-5 py-4">
        <p className="text-sm text-foreground leading-relaxed font-medium">
          Færre posteringer gør det nemmere at holde overblik.
        </p>
        <p className="text-xs text-muted-foreground mt-1.5">
          Bevidst forbrug er et stærkere signal end spar-strategier.
        </p>
      </div>

      <div className="space-y-3 pt-2">
        <p className="text-sm font-semibold text-foreground/80">
          Har du registreret alle dine posteringer for ugen?
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onAllRegisteredChange(true)}
            className={cn(
              'h-12 rounded-2xl border-2 font-semibold text-sm transition-all',
              allRegistered === true
                ? 'border-emerald-400 bg-emerald-50/80 text-emerald-700'
                : 'border-foreground/10 bg-white/50 text-foreground/70 hover:border-foreground/20'
            )}
          >
            Ja, det er alle
          </button>
          <button
            onClick={() => onAllRegisteredChange(false)}
            className={cn(
              'h-12 rounded-2xl border-2 font-semibold text-sm transition-all',
              allRegistered === false
                ? 'border-amber-400 bg-amber-50/80 text-amber-700'
                : 'border-foreground/10 bg-white/50 text-foreground/70 hover:border-foreground/20'
            )}
          >
            Nej, mangler nogle
          </button>
        </div>
      </div>
    </div>
  );
}

function Step3Forward({
  summaryData,
  diff,
  isOver,
  monthlySavings,
}: {
  summaryData: WeekSummaryData;
  diff: number;
  isOver: boolean;
  monthlySavings: number;
}) {
  return (
    <div className="space-y-5 flex-1 flex flex-col justify-center">
      <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
        Fremad
      </p>

      {isOver ? (
        <>
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
            Du brugte {formatDKK(Math.abs(diff))} mere end planlagt
          </h2>
          <div className="bg-amber-50/80 border border-amber-200/50 rounded-2xl px-5 py-4 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600/70">Næste uge</p>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
              {formatDKK(summaryData.nextWeekBudget)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Det trækkes fra næste uges budget
            </p>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
            {monthlySavings > 0
              ? `Du har sparet ${formatDKK(monthlySavings)} denne måned`
              : `Du sparede ${formatDKK(Math.abs(diff))} denne uge`
            }
          </h2>
          <div className="bg-emerald-50/80 border border-emerald-200/50 rounded-2xl px-5 py-4 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600/70">Næste uge</p>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
              {formatDKK(summaryData.nextWeekBudget)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Du starter næste uge med dit normale budget
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Step4Ai({
  aiAnalysis,
  aiLoading,
  aiError,
}: {
  aiAnalysis: WeekAiAnalysis | null;
  aiLoading: boolean;
  aiError: string | null;
}) {
  return (
    <div className="space-y-5 flex-1 flex flex-col justify-center">
      <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
        Nuvio AI
      </p>

      {aiLoading && (
        <div className="space-y-4">
          <div className="h-8 bg-foreground/5 rounded-full animate-pulse w-3/4" />
          <div className="h-5 bg-foreground/5 rounded-full animate-pulse w-full" />
          <div className="h-5 bg-foreground/5 rounded-full animate-pulse w-4/5" />
          <div className="h-5 bg-foreground/5 rounded-full animate-pulse w-3/5" />
          <p className="text-xs text-muted-foreground/50 pt-2">Analyserer din uge…</p>
        </div>
      )}

      {!aiLoading && aiError && (
        <div className="space-y-3">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-foreground">
            Ny uge venter
          </h2>
          <p className="text-foreground/60 text-base leading-relaxed">
            Hold momentum fra denne uge ind i den næste.
          </p>
        </div>
      )}

      {!aiLoading && aiAnalysis && (
        <div className="space-y-5">
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
            {aiAnalysis.message}
          </h2>

          {aiAnalysis.focusNextWeek && (
            <div className="bg-foreground/[0.04] border border-foreground/8 rounded-2xl px-5 py-4">
              <div className="flex items-start gap-3">
                <Bot className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-sm text-foreground/70 leading-relaxed">
                  {aiAnalysis.focusNextWeek}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddExpenseModal({
  weekEnd,
  onSave,
  onClose,
}: {
  weekEnd: Date;
  onSave: () => Promise<void>;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => {
      setVisible(true);
      inputRef.current?.focus();
    }, 30);
    return () => clearTimeout(t);
  }, []);

  const parsedAmount = parseFloat(amount.replace(',', '.'));
  const isValid = !isNaN(parsedAmount) && parsedAmount > 0;

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    try {
      await addQuickExpense(parsedAmount, note.trim() || null);
      await onSave();
    } catch {
      setSaving(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        style={{
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
          transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-400" />
        <div className="px-5 pt-5 pb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-foreground">Tilføj udgift</h3>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="relative rounded-2xl bg-foreground/[0.04] border border-foreground/8 overflow-hidden">
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-transparent text-3xl font-bold px-4 pt-4 pb-3 pr-16 outline-none tabular-nums text-foreground placeholder:text-foreground/25"
              onKeyDown={e => { if (e.key === 'Enter' && isValid) handleSave(); }}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/40 font-medium text-base pointer-events-none">
              kr.
            </span>
          </div>

          <div className="rounded-2xl bg-foreground/[0.04] border border-foreground/8 overflow-hidden">
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Note (valgfri)"
              className="w-full bg-transparent px-4 py-3.5 outline-none text-sm text-foreground placeholder:text-foreground/30"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="w-full rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-50"
            style={{ height: '52px', background: isValid ? 'linear-gradient(to right, #0d9488, #10b981)' : '#9ca3af' }}
          >
            {saving ? 'Gemmer…' : 'Gem udgift'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
