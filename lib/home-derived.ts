'use client';

import { useMemo, useEffect } from 'react';
import { SCENARIOS } from '@/lib/investment-engine';
import { useAiContext } from '@/lib/ai-context';
import { computeOnboardingState } from '@/lib/onboarding-engine';
import {
  computeHomeFinancials,
  computeConsumptionStatus,
  computeNuvioScore,
  computeSdsRaadighedBenchmark,
  computeInvestmentProjection,
  computeNextBestAction,
  computePageBgClass,
  type HomeFinancials,
  type NuvioScoreResult,
  type ConsumptionStatus,
  type InvestmentSettings,
} from '@/lib/home-calculations';
import type { SdsData } from '@/lib/standard-data-service';
import type { HomeBudget } from '@/hooks/use-home-data';
import type { HomeAiContext } from '@/components/ai-assistant-button';

export interface HomeDerived {
  financials: HomeFinancials;
  nuvioScore: NuvioScoreResult | null;
  consumptionStatus: ConsumptionStatus | null;
  nextBestActionItem: ReturnType<typeof computeNextBestAction>;
  investmentProjection: ReturnType<typeof computeInvestmentProjection> | null;
  scenarioLabel: string;
  pageBgClass: string;
  hasIncome: boolean;
  hasFixedExpenses: boolean;
  hasVariableBudget: boolean;
  hasOpeningBalance: boolean;
  onboardingDismissed: boolean;
  setupSteps: ReturnType<typeof computeOnboardingState>['steps'];
  setupProgress: number;
  nextStep: ReturnType<typeof computeOnboardingState>['nextStep'];
  isFullySetup: boolean;
  completedSteps: number;
}

interface Params {
  budget: HomeBudget | null;
  income: number;
  expenses: number;
  householdMonthlyIncome: number;
  variableExpenseEstimate: number | null;
  investmentSettings: InvestmentSettings | null;
  sdsData: SdsData | null;
  householdAdultCount: number;
  householdChildBirthYears: (number | null)[];
  recipientCount: number;
}

export function useHomeDerived(p: Params): HomeDerived {
  const { setAiContext } = useAiContext();

  const financials = useMemo(
    () => computeHomeFinancials(
      p.householdMonthlyIncome,
      p.income,
      p.expenses,
      p.variableExpenseEstimate,
      p.investmentSettings?.monthly_amount ?? 0,
    ),
    [p.householdMonthlyIncome, p.income, p.expenses, p.variableExpenseEstimate, p.investmentSettings],
  );

  const { monthlyIncome, monthlyExpenses, monthlyVariable, monthlyInvestment, monthlySavings, monthlyAvailable } = financials;

  const hasIncome = p.income > 0 || p.householdMonthlyIncome > 0;
  const hasFixedExpenses = p.recipientCount > 0;
  const hasVariableBudget = !!p.budget?.has_variable_budget;
  const hasOpeningBalance = !!p.budget?.opening_balance && p.budget.opening_balance !== 0;
  const onboardingDismissed = !!p.budget?.onboarding_dismissed;

  const onboarding = computeOnboardingState({
    hasIncome,
    hasFixedExpenses,
    hasVariableBudget,
    hasStartBalance: hasOpeningBalance,
    onboardingDismissed,
  });
  const { steps: setupSteps, completionScore: setupProgress, nextStep, isComplete: isFullySetup } = onboarding;
  const completedSteps = setupSteps.filter(s => s.done).length;

  const sdsRaadighedBenchmark = useMemo(
    () => computeSdsRaadighedBenchmark(p.sdsData, p.householdAdultCount, p.householdChildBirthYears),
    [p.sdsData, p.householdAdultCount, p.householdChildBirthYears],
  );

  const nuvioScore = useMemo(
    () => computeNuvioScore(financials, sdsRaadighedBenchmark, hasIncome, hasFixedExpenses, hasVariableBudget, !!p.investmentSettings),
    [financials, sdsRaadighedBenchmark, hasIncome, hasFixedExpenses, hasVariableBudget, p.investmentSettings],
  );

  const consumptionStatus = useMemo(() => p.budget
    ? computeConsumptionStatus(monthlyIncome, monthlyExpenses, monthlyVariable, p.budget.id)
    : null,
  [p.budget, monthlyIncome, monthlyExpenses, monthlyVariable]);

  const nextBestActionItem = useMemo(
    () => computeNextBestAction(monthlyIncome, monthlyExpenses, monthlyVariable),
    [monthlyIncome, monthlyExpenses, monthlyVariable],
  );

  const investmentProjection = useMemo(
    () => p.investmentSettings && p.investmentSettings.monthly_amount > 0
      ? computeInvestmentProjection(p.investmentSettings)
      : null,
    [p.investmentSettings],
  );

  const scenarioLabel = useMemo(() => p.investmentSettings
    ? SCENARIOS[p.investmentSettings.scenario]?.label ?? ''
    : '',
  [p.investmentSettings]);

  const pageBgClass = useMemo(
    () => computePageBgClass(nuvioScore?.score ?? null),
    [nuvioScore],
  );

  useEffect(() => {
    if (monthlyIncome <= 0 || !p.budget) {
      setAiContext(undefined);
      return () => setAiContext(undefined);
    }
    const ob = computeOnboardingState({
      hasIncome,
      hasFixedExpenses,
      hasVariableBudget,
      hasStartBalance: hasOpeningBalance,
      onboardingDismissed,
    });
    const ctx: HomeAiContext = {
      page: 'home',
      nuvioScore: 0,
      nuvioScoreLabel: 'Ingen data',
      monthlyIncome,
      monthlyFixedExpenses: monthlyExpenses,
      monthlyVariableExpenses: monthlyVariable,
      monthlySavings,
      monthlyInvestment,
      monthlyAvailable,
      consumptionPct: financials.totalConsumptionPct,
      savingsRate: financials.savingsRate,
      totalSavingsRate: monthlyIncome > 0 ? (monthlySavings + monthlyInvestment) / monthlyIncome : 0,
      activeGoalCount: 0,
      primaryGoalName: undefined,
      primaryGoalMonthsLeft: null,
      hasInvestment: !!p.investmentSettings,
      setupProgress: ob.completionScore,
    };
    setAiContext(ctx);
    return () => setAiContext(undefined);
  }, [financials, p.budget, p.income, p.householdMonthlyIncome, p.recipientCount, p.investmentSettings, setAiContext]);

  return {
    financials,
    nuvioScore,
    consumptionStatus,
    nextBestActionItem,
    investmentProjection,
    scenarioLabel,
    pageBgClass,
    hasIncome,
    hasFixedExpenses,
    hasVariableBudget,
    hasOpeningBalance,
    onboardingDismissed,
    setupSteps,
    setupProgress,
    nextStep,
    isFullySetup,
    completedSteps,
  };
}
