'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, Bot, Flame, Minus } from 'lucide-react';
import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';
import { cn } from '@/lib/utils';
import { useAiContext } from '@/lib/ai-context';
import { fetchMonthAiAnalysis, computeMonthlyScoreDelta } from '@/lib/quick-expense-service';
import type { MonthSummary, QuickExpenseStreak, MonthAiAnalysis } from '@/lib/quick-expense-service';

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


interface Props {
  currentYear: number;
  currentMonth: number;
  prevSummary: MonthSummary;
  streak: QuickExpenseStreak | null;
  defaultBudget: number;
  onConfirm: (budgetAmount: number) => Promise<void>;
  onDismiss: () => void;
}

const TOTAL_STEPS = 5;

const STEP_BG_GRADIENTS = [
  'linear-gradient(to bottom, #ecfdf5, #f0fdfa, #ffffff)',
  'linear-gradient(to bottom, #ecfdf5, #ffffff, #f0fdfa)',
  'linear-gradient(to bottom, #fff7ed, #fffbeb, #ffffff)',
  'linear-gradient(to bottom, #ecfdf5, #f0fdfa, #ffffff)',
  'linear-gradient(to bottom, #f0fdfa, #ecfdf5, #ffffff)',
];

const STEP_BG_GRADIENTS_OVER = [
  'linear-gradient(to bottom, #fffbeb, #fef9c3, #ffffff)',
  'linear-gradient(to bottom, #fffbeb, #ffffff, #fef9c3)',
  'linear-gradient(to bottom, #f8fafc, #f1f5f9, #ffffff)',
  'linear-gradient(to bottom, #fffbeb, #fef9c3, #ffffff)',
  'linear-gradient(to bottom, #ecfdf5, #f0fdfa, #ffffff)',
];

export default function MonthTransitionModal({
  currentYear,
  currentMonth,
  prevSummary,
  streak,
  defaultBudget,
  onConfirm,
  onDismiss,
}: Props) {
  const { setWizardActive } = useAiContext();
  const [step, setStep] = useState(0);
  const { animating, direction, animate } = useWizardAnimation();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState(defaultBudget > 0 ? String(defaultBudget) : '');
  const [budgetError, setBudgetError] = useState<string | null>(null);

  const [aiAnalysis, setAiAnalysis] = useState<MonthAiAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const isOver = prevSummary.budgetAmount > 0 && prevSummary.totalSpent > prevSummary.budgetAmount;
  const hasPrevData = prevSummary.budgetAmount > 0 || prevSummary.expenseCount > 0;
  const savedAmount = prevSummary.budgetAmount - prevSummary.totalSpent;
  const pctUsed = prevSummary.budgetAmount > 0
    ? Math.min(100, Math.round((prevSummary.totalSpent / prevSummary.budgetAmount) * 100))
    : 0;
  const pctUnder = prevSummary.budgetAmount > 0 && !isOver
    ? Math.round((savedAmount / prevSummary.budgetAmount) * 100)
    : 0;

  const currentStreak = streak?.current_streak ?? 0;
  const longestStreak = streak?.longest_streak ?? 0;
  const cumulativeScore = streak?.cumulative_score ?? 0;
  const isPersonalRecord = currentStreak > 0 && currentStreak >= longestStreak && currentStreak > 1;
  const streakBroken = currentStreak === 0 && longestStreak > 0 && hasPrevData && !prevSummary.wasOnBudget;
  const prevStreakForDelta = streakBroken ? longestStreak : Math.max(0, currentStreak - 1);
  const prevScoreForDelta = streakBroken
    ? Math.round(cumulativeScore / (1 - 0.20))
    : cumulativeScore;
  const scoreDelta = hasPrevData
    ? computeMonthlyScoreDelta(prevSummary.wasOnBudget, 0, prevStreakForDelta, prevScoreForDelta)
    : 0;

  const prevMonthName = DANISH_MONTHS[prevSummary.month - 1];
  const currentMonthName = DANISH_MONTHS[currentMonth - 1];

  const gradients = isOver ? STEP_BG_GRADIENTS_OVER : STEP_BG_GRADIENTS;

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
    const color = isOver ? 'rgb(255,251,235)' : 'rgb(236,253,245)';
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
  }, [isOver]);

  useEffect(() => {
    if (step >= 3) {
      startAiFetch();
    }
  }, [step]);

  function startAiFetch() {
    if (aiAnalysis || aiLoading) return;
    setAiLoading(true);
    fetchMonthAiAnalysis(prevSummary, currentStreak, longestStreak)
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
    animate('forward', () => setStep(s => Math.min(s + 1, TOTAL_STEPS - 1)));
  }

  function back() {
    animate('back', () => setStep(s => Math.max(s - 1, 0)));
  }

  async function handleConfirm() {
    const parsed = parseFloat(budgetDraft.replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) {
      setBudgetError('Indtast et gyldigt beløb');
      return;
    }
    setBudgetError(null);
    setSaving(true);
    try {
      await onConfirm(parsed);
    } catch {
      setBudgetError('Kunne ikke gemme. Prøv igen.');
      setSaving(false);
    }
  }

  async function handleFinish() {
    setSaving(true);
    try {
      await onConfirm(defaultBudget);
    } catch {
      setSaving(false);
    }
  }

  const showBack = step > 0;
  const gradient = gradients[step] ?? gradients[0];


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
          prevSummary={prevSummary}
          prevMonthName={prevMonthName}
          savedAmount={savedAmount}
          isOver={isOver}
          hasPrevData={hasPrevData}
        />
      )}

      {step === 1 && (
        <Step1Overview
          prevSummary={prevSummary}
          prevMonthName={prevMonthName}
          savedAmount={savedAmount}
          isOver={isOver}
          pctUsed={pctUsed}
          pctUnder={pctUnder}
        />
      )}

      {step === 2 && (
        <Step2Streak
          currentStreak={currentStreak}
          longestStreak={longestStreak}
          isPersonalRecord={isPersonalRecord}
          streakBroken={streakBroken}
          isOver={isOver}
          cumulativeScore={cumulativeScore}
          scoreDelta={scoreDelta}
        />
      )}

      {step === 3 && (
        <Step3Budget
          currentMonthName={currentMonthName}
          prevSummary={prevSummary}
          isOver={isOver}
          defaultBudget={defaultBudget}
          budgetDraft={budgetDraft}
          setBudgetDraft={setBudgetDraft}
          budgetError={budgetError}
          setBudgetError={setBudgetError}
          saving={saving}
          onConfirm={handleConfirm}
          onKeepDefault={async () => {
            if (defaultBudget <= 0) return;
            setSaving(true);
            try {
              await onConfirm(defaultBudget);
            } catch {
              setBudgetError('Kunne ikke gemme. Prøv igen.');
              setSaving(false);
            }
          }}
        />
      )}

      {step === 4 && (
        <Step4Ai
          currentMonthName={currentMonthName}
          aiAnalysis={aiAnalysis}
          aiLoading={aiLoading}
          aiError={aiError}
          currentStreak={currentStreak}
        />
      )}

      {(step === 0 || step === 1 || step === 2) && (
        <div className="pt-6">
          <button
            onClick={next}
            className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            style={{ background: isOver ? 'linear-gradient(to right, #d97706, #f59e0b)' : 'linear-gradient(to right, #0d9488, #10b981)' }}
          >
            {step === 0 ? 'Fortsæt' : step === 1 ? 'Næste' : 'Okay'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="pt-6">
          <button
            onClick={handleFinish}
            disabled={saving}
            className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
          >
            {saving ? 'Gemmer…' : `Start ${currentMonthName}`}
            {!saving && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      )}
    </WizardShell>
  );
}

function Step0Result({
  prevSummary,
  prevMonthName,
  savedAmount,
  isOver,
  hasPrevData,
}: {
  prevSummary: MonthSummary;
  prevMonthName: string;
  savedAmount: number;
  isOver: boolean;
  hasPrevData: boolean;
}) {
  if (!hasPrevData) {
    return (
      <div className="space-y-5 flex-1 flex flex-col justify-center">
        <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
          Ny måned starter
        </p>
        <h1 className="text-5xl sm:text-6xl font-bold leading-none tracking-tight text-foreground">
          Ny start
        </h1>
        <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          Sæt dit første budget og kom i gang.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 flex-1 flex flex-col justify-center">
      <p className={cn(
        'text-label font-semibold uppercase tracking-widest',
        isOver ? 'text-amber-600/70' : 'text-emerald-600/70'
      )}>
        {prevMonthName} — Resultat
      </p>
      <h1
        className={cn(
          'text-6xl sm:text-7xl font-bold leading-none tracking-tight tabular-nums',
          isOver ? 'text-amber-600' : 'text-emerald-600'
        )}
      >
        {isOver ? '−' : '+'}{formatDKK(Math.abs(savedAmount))}
      </h1>
      <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
        {isOver
          ? `Du brugte ${formatDKK(Math.abs(savedAmount))} for meget i ${prevMonthName}.`
          : `Du sparede penge i ${prevMonthName}.`
        }
      </p>
      <p className="text-foreground/60 text-base leading-relaxed">
        {isOver
          ? 'Du brugte mere end planlagt denne måned.'
          : 'Du holdt dig markant under dit budget.'
        }
      </p>
    </div>
  );
}

function Step1Overview({
  prevSummary,
  prevMonthName,
  savedAmount,
  isOver,
  pctUsed,
  pctUnder,
}: {
  prevSummary: MonthSummary;
  prevMonthName: string;
  savedAmount: number;
  isOver: boolean;
  pctUsed: number;
  pctUnder: number;
}) {
  return (
    <div className="space-y-6 flex-1 flex flex-col justify-center">
      <p className={cn(
        'text-label font-semibold uppercase tracking-widest',
        isOver ? 'text-amber-600/70' : 'text-emerald-600/70'
      )}>
        Overblik
      </p>
      <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
        Du brugte {formatDKK(prevSummary.totalSpent)} ud af {formatDKK(prevSummary.budgetAmount)}
      </h2>

      {prevSummary.budgetAmount > 0 && (
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
            <span>{pctUsed}% af budget brugt</span>
            <span>{formatDKK(prevSummary.budgetAmount)}</span>
          </div>
        </div>
      )}

      {!isOver && pctUnder > 0 && (
        <div className="inline-flex items-center gap-2 bg-emerald-100/80 border border-emerald-200/60 rounded-full px-4 py-1.5 self-start">
          <span className="text-sm font-semibold text-emerald-700">{pctUnder}% under budget</span>
        </div>
      )}

      <div className="bg-foreground/[0.04] border border-foreground/8 rounded-2xl px-5 py-4">
        <p className="text-sm font-medium text-foreground leading-relaxed">
          {isOver
            ? `Du brugte ${formatDKK(Math.abs(savedAmount))} mere end planlagt i ${prevMonthName}.`
            : `Du brugte kun en del af dit budget i ${prevMonthName}.`
          }
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {isOver
            ? 'Overvej at justere budgettet lidt op for næste måned.'
            : `Du sparede ${formatDKK(Math.abs(savedAmount))} denne måned.`
          }
        </p>
      </div>
    </div>
  );
}

function Step2Streak({
  currentStreak,
  longestStreak,
  isPersonalRecord,
  streakBroken,
  isOver,
  cumulativeScore,
  scoreDelta,
}: {
  currentStreak: number;
  longestStreak: number;
  isPersonalRecord: boolean;
  streakBroken: boolean;
  isOver: boolean;
  cumulativeScore: number;
  scoreDelta: number;
}) {
  if (streakBroken) {
    return (
      <div className="space-y-5 flex-1 flex flex-col justify-center">
        <p className="text-label font-semibold uppercase tracking-widest text-slate-500/70">
          Streak
        </p>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
            <Minus className="h-7 w-7 text-slate-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-foreground">
            Rekorden stopper her
          </h2>
        </div>
        <p className="text-foreground/60 text-lg leading-relaxed">
          Din bedste serie var {longestStreak} {longestStreak === 1 ? 'måned' : 'måneder'} i træk.
        </p>
        {scoreDelta !== 0 && (
          <div className="bg-red-50/80 border border-red-200/50 rounded-2xl px-5 py-4">
            <p className="text-xs font-semibold text-red-600/70 uppercase tracking-widest mb-1">Nuvio Score</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-red-700 tabular-nums">{cumulativeScore.toLocaleString('da-DK')}</span>
              <span className="text-sm font-semibold text-red-500">{scoreDelta.toLocaleString('da-DK')} point</span>
            </div>
            <p className="text-xs text-red-600/70 mt-1">Jo mere du har opbygget, jo mere gør det ondt.</p>
          </div>
        )}
        <div className="bg-foreground/[0.04] border border-foreground/8 rounded-2xl px-5 py-4">
          <p className="text-sm font-medium text-foreground leading-relaxed">
            Det er ikke et tilbageskridt — det er en ny chance.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Start en ny serie fra denne måned.
          </p>
        </div>
      </div>
    );
  }

  if (currentStreak === 0) {
    return (
      <div className="space-y-5 flex-1 flex flex-col justify-center">
        <p className={cn(
          'text-label font-semibold uppercase tracking-widest',
          isOver ? 'text-amber-600/70' : 'text-emerald-600/70'
        )}>
          Streak
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-foreground">
          Byg en serie
        </h2>
        <p className="text-foreground/60 text-lg leading-relaxed">
          Hold dig indenfor budget denne måned og start din første streak.
        </p>
        <div className="bg-foreground/[0.04] border border-foreground/8 rounded-2xl px-5 py-4">
          <p className="text-sm font-medium text-foreground leading-relaxed">
            Konsistens er det, der skaber resultater.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Én god måned ad gangen.
          </p>
        </div>
      </div>
    );
  }

  const nextStreakMultiplier = 1 + currentStreak * 0.1;

  return (
    <div className="space-y-5 flex-1 flex flex-col justify-center">
      <p className="text-label font-semibold uppercase tracking-widest text-orange-600/70">
        Streak
      </p>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center shrink-0">
          <Flame className="h-8 w-8 text-orange-500" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-foreground">
          {currentStreak} {currentStreak === 1 ? 'måned' : 'måneder'} i træk indenfor budget
        </h2>
      </div>

      {isPersonalRecord && (
        <p className="text-foreground/60 text-lg leading-relaxed">
          Det er din personlige rekord.
        </p>
      )}

      {!isPersonalRecord && longestStreak > currentStreak && (
        <p className="text-foreground/60 text-lg leading-relaxed">
          Din rekord er {longestStreak} måneder. Du er på vej.
        </p>
      )}

      <div className="flex items-center gap-2">
        {Array.from({ length: Math.max(currentStreak + 2, 5) }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all',
              i < currentStreak
                ? 'bg-orange-400 text-white font-bold'
                : 'bg-foreground/8 text-foreground/20'
            )}
          >
            {i < currentStreak ? <Flame className="h-4 w-4" /> : '○'}
          </div>
        ))}
      </div>

      <div className="bg-emerald-50/80 border border-emerald-200/50 rounded-2xl px-5 py-4">
        <p className="text-xs font-semibold text-emerald-700/70 uppercase tracking-widest mb-1">Nuvio Score</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-emerald-800 tabular-nums">{cumulativeScore.toLocaleString('da-DK')}</span>
          {scoreDelta > 0 && (
            <span className="text-sm font-semibold text-emerald-600">+{scoreDelta} point denne måned</span>
          )}
        </div>
        <p className="text-xs text-emerald-700/60 mt-1">
          Næste måneds bonus: {nextStreakMultiplier.toFixed(1)}x multiplier
        </p>
      </div>
    </div>
  );
}

function Step3Budget({
  currentMonthName,
  prevSummary,
  isOver,
  defaultBudget,
  budgetDraft,
  setBudgetDraft,
  budgetError,
  setBudgetError,
  saving,
  onConfirm,
  onKeepDefault,
}: {
  currentMonthName: string;
  prevSummary: MonthSummary;
  isOver: boolean;
  defaultBudget: number;
  budgetDraft: string;
  setBudgetDraft: (v: string) => void;
  budgetError: string | null;
  setBudgetError: (v: string | null) => void;
  saving: boolean;
  onConfirm: () => void;
  onKeepDefault: () => void;
}) {
  const prevMonthName = DANISH_MONTHS[prevSummary.month - 1];

  return (
    <div className="space-y-6 flex-1 flex flex-col justify-center">
      <p className={cn(
        'text-label font-semibold uppercase tracking-widest',
        isOver ? 'text-amber-600/70' : 'text-emerald-600/70'
      )}>
        Næste måned
      </p>

      <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight capitalize">
        {isOver ? 'Justér dit budget for' : 'Sæt dit budget for'} {currentMonthName}
      </h2>

      {prevSummary.budgetAmount > 0 && (
        <p className="text-foreground/60 text-base leading-relaxed">
          {isOver
            ? `Du brugte ${formatDKK(prevSummary.totalSpent - prevSummary.budgetAmount)} mere end planlagt i ${prevMonthName}.`
            : `Sidste måned brugte du ${formatDKK(prevSummary.totalSpent)}.`
          }
        </p>
      )}

      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground block capitalize">
          Budget for {currentMonthName}
        </label>
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            placeholder={defaultBudget > 0 ? String(defaultBudget) : 'eks. 4000'}
            value={budgetDraft}
            onChange={e => { setBudgetDraft(e.target.value); setBudgetError(null); }}
            onKeyDown={e => e.key === 'Enter' && onConfirm()}
            autoFocus
            className={cn(
              'w-full h-14 rounded-xl border bg-white/80 backdrop-blur px-4 pr-14 text-xl font-semibold',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2',
              'transition-all duration-200',
              budgetError ? 'border-red-300' : 'border-border'
            )}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground pointer-events-none">
            kr.
          </span>
        </div>
        {budgetError && <p className="text-xs text-red-600">{budgetError}</p>}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {isOver
            ? 'Overvej at sætte budgettet lidt højere end sidst.'
            : 'Du kan justere det, hvis du vil udfordre dig selv lidt.'
          }
        </p>
      </div>

      <div className="space-y-2 pt-2">
        <button
          onClick={onConfirm}
          disabled={saving}
          className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: isOver ? 'linear-gradient(to right, #d97706, #f59e0b)' : 'linear-gradient(to right, #0d9488, #10b981)' }}
        >
          {saving ? 'Gemmer…' : `Gem og start ${currentMonthName}`}
          {!saving && <ArrowRight className="h-4 w-4" />}
        </button>

        {defaultBudget > 0 && (
          <button
            onClick={onKeepDefault}
            disabled={saving}
            className="w-full h-10 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors capitalize"
          >
            Behold {formatDKK(defaultBudget)}
          </button>
        )}
      </div>
    </div>
  );
}

function Step4Ai({
  currentMonthName,
  aiAnalysis,
  aiLoading,
  aiError,
  currentStreak,
}: {
  currentMonthName: string;
  aiAnalysis: MonthAiAnalysis | null;
  aiLoading: boolean;
  aiError: string | null;
  currentStreak: number;
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
          <p className="text-xs text-muted-foreground/50 pt-2">Analyserer din måned…</p>
        </div>
      )}

      {!aiLoading && aiError && (
        <div className="space-y-3">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-foreground capitalize">
            Ny måned venter
          </h2>
          <p className="text-foreground/60 text-base leading-relaxed capitalize">
            Hold momentum ind i {currentMonthName}.
          </p>
          {currentStreak > 0 && (
            <p className="text-foreground/50 text-sm leading-relaxed">
              Du er på en streak — fortsæt den gode vane.
            </p>
          )}
        </div>
      )}

      {!aiLoading && aiAnalysis && (
        <div className="space-y-5">
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
            {aiAnalysis.message}
          </h2>

          {aiAnalysis.focusNextMonth && (
            <div className="bg-foreground/[0.04] border border-foreground/8 rounded-2xl px-5 py-4">
              <div className="flex items-start gap-3">
                <Bot className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-sm text-foreground/70 leading-relaxed">
                  {aiAnalysis.focusNextMonth}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
