'use client';

import { ArrowRight, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CardVisibilityToggle } from './card-visibility-toggle';

interface OnboardingStep {
  id: string;
  label: string;
  done: boolean;
}

interface OnboardingCardProps {
  setupSteps: OnboardingStep[];
  setupProgress: number;
  completedSteps: number;
  nextStep: OnboardingStep | null;
  openingBalance: number;
  wizardEnabled: (key: string) => boolean;
  onDismiss: () => void;
  onShowIncomeWizard: () => void;
  onShowFixedExpensesWizard: () => void;
  onShowVariableWizard: () => void;
  onShowStartBalance: () => void;
}

const HEADINGS: Record<number, string> = {
  0: 'Kom i gang med din plan',
  1: 'Godt begyndt - fortsæt nu',
  2: 'Du er halvvejs der',
  3: 'Næsten klar',
};

export function OnboardingCard({
  setupSteps,
  setupProgress,
  completedSteps,
  nextStep,
  wizardEnabled,
  onDismiss,
  onShowIncomeWizard,
  onShowFixedExpensesWizard,
  onShowVariableWizard,
  onShowStartBalance,
}: OnboardingCardProps) {
  return (
    <div className="relative rounded-[8px] nuvio-card overflow-hidden">
      <CardVisibilityToggle cardKey="onboarding" />
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-t-[8px]" />
      <div className="p-5 pt-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600/70 mb-1">Opsætning</p>
            <h2 className="text-lg font-bold tracking-tight leading-snug">
              {HEADINGS[completedSteps] ?? HEADINGS[0]}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <div className="relative h-14 w-14">
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="10" className="text-emerald-100" />
                <circle
                  cx="50" cy="50" r="40" fill="none" strokeWidth="10" stroke="url(#setupGrad)" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - setupProgress / 100)}`}
                  className="transition-all duration-700"
                />
                <defs>
                  <linearGradient id="setupGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0d9488" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold tabular-nums leading-none">{setupProgress}%</span>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="p-1.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors rounded-lg hover:bg-black/5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {setupSteps.map(step => (
            <div key={step.id} className="flex items-center gap-3">
              <div className={cn('shrink-0 h-5 w-5 rounded-[8px] flex items-center justify-center', step.done ? 'bg-emerald-500' : 'border-2 border-muted-foreground/20')}>
                {step.done && <Check className="h-3 w-3 text-white" />}
              </div>
              <span className={cn('text-sm flex-1', step.done ? 'text-muted-foreground line-through decoration-emerald-400/60' : 'text-foreground font-medium')}>
                {step.label}
              </span>
              {!step.done && step.id === nextStep?.id && (
                <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-[8px] shrink-0">Næste</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {nextStep?.id === 'income' && wizardEnabled('wizard_enabled_income') && (
            <button
              onClick={onShowIncomeWizard}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-[8px] font-semibold text-sm text-white shadow-sm active:scale-[0.98] transition-transform"
              style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
            >
              Tilføj indkomst <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
          {nextStep?.id === 'fixed_expenses' && wizardEnabled('wizard_enabled_fixed_expenses') && (
            <button
              onClick={onShowFixedExpensesWizard}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-[8px] font-semibold text-sm text-white shadow-sm active:scale-[0.98] transition-transform"
              style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
            >
              Tilføj faste udgifter <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
          {nextStep?.id === 'variable_budget' && wizardEnabled('wizard_enabled_variable_forbrug') && (
            <button
              onClick={onShowVariableWizard}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-[8px] font-semibold text-sm text-white shadow-sm active:scale-[0.98] transition-transform"
              style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
            >
              Estimér variabelt forbrug <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
          {nextStep?.id === 'start_balance' && (
            <button
              onClick={onShowStartBalance}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-[8px] font-semibold text-sm text-white shadow-sm active:scale-[0.98] transition-transform"
              style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
            >
              Angiv start saldo <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
