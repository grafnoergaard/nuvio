export type OnboardingStepId = 'income' | 'fixed_expenses' | 'variable_budget' | 'start_balance';

export interface OnboardingStep {
  id: OnboardingStepId;
  label: string;
  description: string;
  weight: number;
  done: boolean;
}

export interface OnboardingState {
  steps: OnboardingStep[];
  completionScore: number;
  nextStep: OnboardingStep | null;
  isComplete: boolean;
  isDismissed: boolean;
}

export interface OnboardingInput {
  hasIncome: boolean;
  hasFixedExpenses: boolean;
  hasVariableBudget: boolean;
  hasStartBalance: boolean;
  onboardingDismissed: boolean;
}

export function computeOnboardingState(input: OnboardingInput): OnboardingState {
  const steps: OnboardingStep[] = [
    {
      id: 'income',
      label: 'Indkomst',
      description: 'Tilføj din månedlige indkomst for at beregne rådighedsbeløb.',
      weight: 35,
      done: input.hasIncome,
    },
    {
      id: 'fixed_expenses',
      label: 'Faste udgifter',
      description: 'Tilføj dine faste regninger — husleje, abonnementer, lån.',
      weight: 35,
      done: input.hasFixedExpenses,
    },
    {
      id: 'variable_budget',
      label: 'Forbrug',
      description: 'Sæt et realistisk estimat på dit daglige forbrug.',
      weight: 25,
      done: input.hasVariableBudget,
    },
    {
      id: 'start_balance',
      label: 'Start saldo',
      description: 'Hvad er din kontosaldo i dag?',
      weight: 5,
      done: input.hasStartBalance,
    },
  ];

  const completionScore = steps.reduce((sum, s) => sum + (s.done ? s.weight : 0), 0);

  const nextStep = steps.find((s) => !s.done) ?? null;

  const isComplete = steps.every((s) => s.done);

  return {
    steps,
    completionScore,
    nextStep,
    isComplete,
    isDismissed: input.onboardingDismissed,
  };
}
