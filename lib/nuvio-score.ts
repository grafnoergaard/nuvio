export interface ScoreFinancials {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyVariable: number;
  monthlySavings: number;
  monthlyInvestment: number;
  totalConsumptionPct: number;
}

export interface NuvioScoreResult {
  score: number;
  label: string;
  color: {
    bar: string;
    text: string;
    badge: string;
  };
  primaryDriver: {
    text: string;
    cta: string;
    path: string;
  };
}

export const SCORE_WEIGHTS = {
  consumption: 0.35,
  savings: 0.25,
  goal: 0.20,
  investment: 0.10,
  stability: 0.10,
} as const;

function computeConsumptionScore(
  monthlyIncome: number,
  monthlyExpenses: number,
  monthlyVariable: number,
  sdsMinimumRaadighed: number,
): number {
  const totalSpend = monthlyExpenses + monthlyVariable;
  const remainingAfterSpend = monthlyIncome - totalSpend;
  const raadighedRatio = remainingAfterSpend / sdsMinimumRaadighed;
  if (raadighedRatio >= 2.0) return 100;
  if (raadighedRatio >= 1.5) return 90;
  if (raadighedRatio >= 1.0) return 75;
  if (raadighedRatio >= 0.5) return 50;
  if (raadighedRatio >= 0) return 25;
  return 0;
}

function computeSavingsScore(monthlyIncome: number, monthlySavings: number, monthlyInvestment: number): number {
  const totalSavingsRate = monthlyIncome > 0 ? (monthlySavings + monthlyInvestment) / monthlyIncome : 0;
  if (totalSavingsRate >= 0.20) return 100;
  if (totalSavingsRate >= 0.15) return 90;
  if (totalSavingsRate >= 0.10) return 75;
  if (totalSavingsRate >= 0.05) return 50;
  if (totalSavingsRate > 0) return 25;
  return 0;
}

function computeInvestmentScore(monthlyIncome: number, monthlyInvestment: number): number {
  if (monthlyInvestment <= 0) return 0;
  const investRate = monthlyInvestment / monthlyIncome;
  if (investRate >= 0.10) return 100;
  if (investRate >= 0.05) return 75;
  if (investRate >= 0.02) return 50;
  return 25;
}

function computeStabilityScore(
  hasIncome: boolean,
  hasFixedExpenses: boolean,
  hasVariableBudget: boolean,
  monthlyInvestment: number,
): number {
  let s = 0;
  if (hasIncome) s += 40;
  if (hasFixedExpenses) s += 25;
  if (hasVariableBudget) s += 25;
  if (monthlyInvestment > 0) s += 10;
  return s;
}

export function computeScoreLabel(score: number): string {
  if (score >= 85) return 'Robust';
  if (score >= 70) return 'Stabil';
  if (score >= 50) return 'Kan styrkes';
  return 'Sårbar';
}

export function computeScoreColor(score: number): NuvioScoreResult['color'] {
  if (score >= 85) return { bar: '#10b981', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  if (score >= 70) return { bar: '#3b82f6', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700 border-blue-200' };
  if (score >= 50) return { bar: '#f59e0b', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700 border-amber-200' };
  return { bar: '#f97316', text: 'text-orange-600', badge: 'bg-orange-100 text-orange-700 border-orange-200' };
}

export function computePrimaryDriver(
  totalConsumptionPct: number,
  hasInvestmentSettings: boolean,
): NuvioScoreResult['primaryDriver'] {
  if (totalConsumptionPct > 0.60) {
    return {
      text: `Din score påvirkes primært af høj forbrugsbinding (${Math.round(totalConsumptionPct * 100)}%). Der er potentiale i at reducere faste eller variable udgifter.`,
      cta: 'Gennemgå udgifter',
      path: '/budgets',
    };
  }
  if (!hasInvestmentSettings) {
    return {
      text: `Sæt din kapital i arbejde via en investeringsprofil og styrk din Kuvert Score.`,
      cta: 'Se investeringsprofil',
      path: '/investering',
    };
  }
  return {
    text: `Din finansielle profil er stærk. Fortsæt den nuværende kurs for at fastholde og styrke din Kuvert Score.`,
    cta: 'Se din plan',
    path: '/plan',
  };
}

export function computeNuvioScore(
  financials: ScoreFinancials,
  sdsRaadighedBenchmark: number | null,
  hasIncome: boolean,
  hasFixedExpenses: boolean,
  hasVariableBudget: boolean,
  hasInvestmentSettings: boolean,
): NuvioScoreResult | null {
  const { monthlyIncome, monthlyExpenses, monthlyVariable, monthlySavings, monthlyInvestment, totalConsumptionPct } = financials;

  if (monthlyIncome <= 0) return null;

  const sdsRaadighed = sdsRaadighedBenchmark ?? (monthlyIncome * 0.20);

  const consumptionScore = computeConsumptionScore(monthlyIncome, monthlyExpenses, monthlyVariable, sdsRaadighed);
  const savingsScore = computeSavingsScore(monthlyIncome, monthlySavings, monthlyInvestment);
  const investmentScore = computeInvestmentScore(monthlyIncome, monthlyInvestment);
  const goalScore = 50;
  const stabilityScore = computeStabilityScore(hasIncome, hasFixedExpenses, hasVariableBudget, monthlyInvestment);

  const weighted = Math.round(
    consumptionScore * SCORE_WEIGHTS.consumption +
    savingsScore * SCORE_WEIGHTS.savings +
    goalScore * SCORE_WEIGHTS.goal +
    investmentScore * SCORE_WEIGHTS.investment +
    stabilityScore * SCORE_WEIGHTS.stability,
  );

  const score = Math.min(100, Math.max(0, weighted));
  const label = computeScoreLabel(score);
  const color = computeScoreColor(score);
  const primaryDriver = computePrimaryDriver(totalConsumptionPct, hasInvestmentSettings);

  return { score, label, color, primaryDriver };
}
