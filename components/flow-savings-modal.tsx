'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, Check, RotateCcw } from 'lucide-react';
import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';
import { cn } from '@/lib/utils';
import type { WeekSummaryData } from '@/lib/week-transition-service';

const DANISH_MONTHS = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
];

const STEP_GRADIENTS = [
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 40%, #ffffff 100%)',
  'linear-gradient(160deg, #f0fdfa 0%, #ecfdf5 50%, #ffffff 100%)',
];

function formatDKK(value: number): string {
  return Math.abs(Math.round(value)).toLocaleString('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

interface FlowSavingsModalProps {
  summaryData: WeekSummaryData;
  currentBalance: number;
  lifetimeTotal: number;
  weekCount: number;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
}

export function FlowSavingsModal({
  summaryData,
  currentBalance,
  lifetimeTotal,
  weekCount,
  onConfirm,
  onDismiss,
}: FlowSavingsModalProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const { animating, direction, animate } = useWizardAnimation();

  const isOver = summaryData.totalSpent > summaryData.budgetAmount;
  const diff = summaryData.budgetAmount - summaryData.totalSpent;
  const savedThisWeek = Math.max(0, diff);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  function next() {
    if (!isOver) {
      animate('forward', () => setStep(1));
    }
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      await onConfirm();
    } finally {
      setSaving(false);
    }
  }

  const monthName = DANISH_MONTHS[summaryData.month - 1];

  return (
    <WizardShell
      gradient={STEP_GRADIENTS[step] ?? STEP_GRADIENTS[0]}
      visible={visible}
      step={step}
      totalSteps={isOver ? 1 : 2}
      showBack={step > 0}
      showClose={true}
      onBack={() => animate('back', () => setStep(0))}
      onClose={onDismiss}
      animating={animating}
      direction={direction}
    >
      {step === 0 && (
        <StepResult
          summaryData={summaryData}
          diff={diff}
          isOver={isOver}
          savedThisWeek={savedThisWeek}
          monthName={monthName}
          currentBalance={currentBalance}
          weekCount={weekCount}
        />
      )}

      {step === 1 && !isOver && (
        <StepConfirm
          savedThisWeek={savedThisWeek}
          newBalance={currentBalance + savedThisWeek}
          lifetimeTotal={lifetimeTotal + savedThisWeek}
          weekCount={weekCount + 1}
        />
      )}

      <div className="pt-6">
        {isOver && (
          <button
            onClick={onDismiss}
            className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
          >
            Start forfra
            <ArrowRight className="h-4 w-4" />
          </button>
        )}

        {!isOver && step === 0 && (
          <button
            onClick={next}
            className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
          >
            Se din opsparing
            <ArrowRight className="h-4 w-4" />
          </button>
        )}

        {!isOver && step === 1 && (
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
          >
            {saving ? 'Gemmer…' : 'Gem og start ny uge'}
            {!saving && <Check className="h-4 w-4" />}
          </button>
        )}
      </div>
    </WizardShell>
  );
}

function StepResult({
  summaryData,
  diff,
  isOver,
  savedThisWeek,
  monthName,
  currentBalance,
  weekCount,
}: {
  summaryData: WeekSummaryData;
  diff: number;
  isOver: boolean;
  savedThisWeek: number;
  monthName: string;
  currentBalance: number;
  weekCount: number;
}) {
  return (
    <div className="space-y-5 flex-1 flex flex-col justify-center">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600/70">
        Uge {summaryData.isoWeekNumber} — {monthName} {summaryData.year}
      </p>

      {isOver ? (
        <>
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
            Du havde desværre ikke overskud til opsparing denne uge
          </h2>
          <p className="text-foreground/60 text-base leading-relaxed">
            Du brugte {formatDKK(Math.abs(diff))} mere end planlagt. Det trækkes fra næste uges budget.
          </p>
          <div className="bg-amber-50/80 border border-amber-200/50 rounded-2xl px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600/70 mb-1">Underskud denne uge</p>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-amber-700">
              −{formatDKK(Math.abs(diff))}
            </p>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
            Du sparede {formatDKK(savedThisWeek)} denne uge
          </h2>
          <p className="text-foreground/60 text-base leading-relaxed">
            Det er penge, du ikke brugte af dit budget. De lægges til Sparet.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50/80 border border-emerald-200/50 rounded-2xl px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600/70 mb-1">Sparet i alt</p>
              <p className="text-2xl font-bold tabular-nums tracking-tight text-emerald-700">
                {formatDKK(currentBalance + savedThisWeek)}
              </p>
            </div>
            <div className="bg-white/60 border border-foreground/8 rounded-2xl px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">Uger med opsparing</p>
              <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {weekCount + 1}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StepConfirm({
  savedThisWeek,
  newBalance,
  lifetimeTotal,
  weekCount,
}: {
  savedThisWeek: number;
  newBalance: number;
  lifetimeTotal: number;
  weekCount: number;
}) {
  return (
    <div className="space-y-5 flex-1 flex flex-col justify-center">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600/70">
        Sparet
      </p>

      <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
        {formatDKK(newBalance)} i alt
      </h2>

      <p className="text-foreground/60 text-base leading-relaxed">
        Denne uge tilføjede du {formatDKK(savedThisWeek)} til din opsparing.
      </p>

      <div className="space-y-3">
        <div className="bg-emerald-50/80 border border-emerald-200/50 rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600/70 mb-0.5">Nuværende saldo</p>
              <p className="text-3xl font-bold tabular-nums tracking-tight text-emerald-700">
                {formatDKK(newBalance)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <Check className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 bg-white/60 border border-foreground/8 rounded-2xl px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Uger med opsparing</p>
            <p className="text-xl font-bold tabular-nums text-foreground">{weekCount}</p>
          </div>
          <div className="flex-1 bg-white/60 border border-foreground/8 rounded-2xl px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Livstids-total</p>
            <p className="text-xl font-bold tabular-nums text-foreground">{formatDKK(lifetimeTotal)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
