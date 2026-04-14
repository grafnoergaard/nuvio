export type TimeHorizon = 'short' | 'medium' | 'long';
export type MarketReaction = 'sell' | 'wait' | 'invest_more';

export type ScenarioKey = 'conservative' | 'base' | 'growth';

export interface Scenario {
  key: ScenarioKey;
  label: string;
  annualRate: number;
}

export const SCENARIOS: Record<ScenarioKey, Scenario> = {
  conservative: { key: 'conservative', label: 'Konservativ', annualRate: 0.02 },
  base:         { key: 'base',         label: 'Base',        annualRate: 0.05 },
  growth:       { key: 'growth',       label: 'Vækst',       annualRate: 0.07 },
};

export function pickScenario(horizon: TimeHorizon, reaction: MarketReaction | null): ScenarioKey {
  if (horizon === 'short') return 'conservative';
  if (horizon === 'long' && reaction === 'invest_more') return 'growth';
  return 'base';
}

export function projectInvestment(
  monthlyContribution: number,
  startBalance: number,
  annualRate: number,
  months: number,
): number {
  if (months <= 0) return startBalance;
  const r = annualRate / 12;
  if (r === 0) return startBalance + monthlyContribution * months;
  const grown = startBalance * Math.pow(1 + r, months);
  const contributions = monthlyContribution * ((Math.pow(1 + r, months) - 1) / r);
  return grown + contributions;
}

export interface GoalProjection {
  monthsWithoutInvesting: number | null;
  monthsWithInvesting: number | null;
  deltaMonths: number | null;
  projectedValueAtGoal: number;
}

export function computeGoalProjection(
  goalTarget: number,
  goalCurrent: number,
  goalMonthly: number | null,
  investMonthly: number,
  investStart: number,
  scenario: ScenarioKey,
): GoalProjection {
  const rate = SCENARIOS[scenario].annualRate;

  const monthsWithoutInvesting: number | null = (() => {
    const remaining = goalTarget - goalCurrent;
    if (remaining <= 0) return 0;
    if (!goalMonthly || goalMonthly <= 0) return null;
    return Math.ceil(remaining / goalMonthly);
  })();

  if (!investMonthly && !investStart) {
    return {
      monthsWithoutInvesting,
      monthsWithInvesting: monthsWithoutInvesting,
      deltaMonths: null,
      projectedValueAtGoal: 0,
    };
  }

  const MAX_MONTHS = 600;
  let savings = goalCurrent;
  let investments = investStart;
  const monthlySavings = goalMonthly ?? 0;
  const r = rate / 12;

  let monthsWithInvesting: number | null = null;
  for (let m = 1; m <= MAX_MONTHS; m++) {
    savings += monthlySavings;
    investments = r === 0
      ? investments + investMonthly
      : investments * (1 + r) + investMonthly;

    if (savings + investments >= goalTarget) {
      monthsWithInvesting = m;
      break;
    }
  }

  const deltaMonths =
    monthsWithoutInvesting !== null && monthsWithInvesting !== null
      ? monthsWithoutInvesting - monthsWithInvesting
      : null;

  const projectedValueAtGoal = monthsWithInvesting
    ? projectInvestment(investMonthly, investStart, rate, monthsWithInvesting)
    : 0;

  return { monthsWithoutInvesting, monthsWithInvesting, deltaMonths, projectedValueAtGoal };
}
