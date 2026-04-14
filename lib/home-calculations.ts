import { computeSdsRaadighedMonthly, type SdsData } from '@/lib/standard-data-service';
import { SCENARIOS, projectInvestment, type ScenarioKey } from '@/lib/investment-engine';
import { formatCurrency } from '@/lib/number-helpers';
export type { NuvioScoreResult } from '@/lib/nuvio-score';
export { computeNuvioScore, computeScoreLabel, computeScoreColor, computePrimaryDriver, SCORE_WEIGHTS } from '@/lib/nuvio-score';

export type ConsumptionLevel = 'robust' | 'stabil' | 'kan_styrkes' | 'presset';

export interface ConsumptionStatus {
  level: ConsumptionLevel;
  label: string;
  advice: string;
  microText: string;
  ctaLabel: string;
  ctaHref: string;
  pct: number;
}

export interface HomeFinancials {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyVariable: number;
  monthlyInvestment: number;
  monthlySavings: number;
  monthlyAvailable: number;
  fixedPct: number;
  variablePct: number;
  totalConsumptionPct: number;
  savingsRate: number;
  availableRate: number;
}

export interface InvestmentProjection {
  totalIn10: number;
  proj10: number;
  gains10: number;
  monthlyAmount: number;
  scenarioLabel: string;
}

export interface InvestmentSettings {
  monthly_amount: number;
  current_amount: number;
  scenario: ScenarioKey;
  time_horizon: string;
  market_reaction: string;
}

export function computeHomeFinancials(
  householdMonthlyIncome: number,
  annualIncome: number,
  annualExpenses: number,
  variableExpenseEstimate: number | null,
  investmentMonthlyAmount: number,
): HomeFinancials {
  const monthlyIncome = householdMonthlyIncome > 0 ? householdMonthlyIncome : annualIncome / 12;
  const monthlyExpenses = annualExpenses / 12;
  const monthlyVariable = variableExpenseEstimate ?? 0;
  const monthlyInvestment = investmentMonthlyAmount;
  const monthlySavings = 0;
  const monthlyAvailable = monthlyIncome - monthlyExpenses - monthlyVariable - monthlySavings - monthlyInvestment;

  const fixedPct = monthlyIncome > 0 ? monthlyExpenses / monthlyIncome : 0;
  const variablePct = monthlyIncome > 0 ? monthlyVariable / monthlyIncome : 0;
  const totalConsumptionPct = fixedPct + variablePct;
  const savingsRate = monthlyIncome > 0 ? monthlySavings / monthlyIncome : 0;
  const availableRate = monthlyIncome > 0 ? monthlyAvailable / monthlyIncome : 0;

  return {
    monthlyIncome,
    monthlyExpenses,
    monthlyVariable,
    monthlyInvestment,
    monthlySavings,
    monthlyAvailable,
    fixedPct,
    variablePct,
    totalConsumptionPct,
    savingsRate,
    availableRate,
  };
}

export function computeConsumptionStatus(
  totalIncome: number,
  fixedExpenses: number,
  variableEstimate: number,
  budgetId: string,
): ConsumptionStatus {
  if (totalIncome <= 0) {
    return {
      level: 'kan_styrkes',
      label: 'Mangler data',
      advice: 'Tilføj din indkomst for at se din forbrugsstatus.',
      microText: '',
      ctaLabel: 'Gå til budget',
      ctaHref: `/budgets/${budgetId}`,
      pct: 0,
    };
  }
  const total = fixedExpenses + variableEstimate;
  const pct = Math.round((total / totalIncome) * 100);

  if (pct < 50) {
    return {
      level: 'robust',
      label: 'Robust',
      advice: 'Dine udgifter udgør under 50% af indkomsten. Du har god plads til opsparing og fremtidige mål.',
      microText: `${pct}% af din indkomst er disponeret. Du har solid handlefrihed.`,
      ctaLabel: 'Se Sparet',
      ctaHref: '/opsparing',
      pct,
    };
  }
  if (pct < 60) {
    return {
      level: 'stabil',
      label: 'Stabil',
      advice: 'Solid økonomi. Overvej at øge din månedlige opsparing for at nå mål hurtigere.',
      microText: `${pct}% af din indkomst er disponeret. En sund forbrugsprofil med plads til forbedring.`,
      ctaLabel: 'Se Sparet',
      ctaHref: '/opsparing',
      pct,
    };
  }
  if (pct < 70) {
    return {
      level: 'kan_styrkes',
      label: 'Kan styrkes',
      advice: 'Der er potentiale i at reducere forbrugsbindingen. Små justeringer kan løfte fleksibiliteten markant.',
      microText: `${pct}% af din indkomst er disponeret. Over 60% reducerer fleksibilitet og opsparingskapacitet.`,
      ctaLabel: 'Se muligheder',
      ctaHref: '/variable-forbrug',
      pct,
    };
  }
  return {
    level: 'presset',
    label: 'Presset',
    advice: 'En høj forbrugsbinding begrænser din finansielle handlefrihed. Gennemgå dine faste og variable poster.',
    microText: `${pct}% af din indkomst er disponeret. Over 70% efterlader begrænset råderum til uforudsete udgifter.`,
    ctaLabel: 'Gennemgå udgifter',
    ctaHref: `/budgets/${budgetId}`,
    pct,
  };
}

export function computeSdsRaadighedBenchmark(
  sdsData: SdsData | null,
  householdAdultCount: number,
  householdChildBirthYears: (number | null)[],
): number | null {
  if (!sdsData) return null;
  return computeSdsRaadighedMonthly(householdAdultCount, householdChildBirthYears, sdsData.raadighed);
}

export function computeInvestmentProjection(settings: InvestmentSettings): InvestmentProjection {
  const rate = SCENARIOS[settings.scenario]?.annualRate ?? 0.05;
  const proj10 = projectInvestment(settings.monthly_amount, settings.current_amount, rate, 120);
  const totalIn10 = settings.current_amount + settings.monthly_amount * 120;
  const gains10 = proj10 - totalIn10;
  const scenarioLabel = SCENARIOS[settings.scenario]?.label ?? '';
  return { totalIn10, proj10, gains10, monthlyAmount: settings.monthly_amount, scenarioLabel };
}

export function computeNextBestAction(
  monthlyIncome: number,
  monthlyExpenses: number,
  monthlyVariable: number,
): { text: string; cta: string; path: string } | null {
  if (monthlyIncome <= 0) return null;
  const totalConsumption = monthlyExpenses + monthlyVariable;
  const consumptionPct = totalConsumption / monthlyIncome;
  if (consumptionPct > 0.60) {
    const reduction = Math.round((consumptionPct - 0.55) * monthlyIncome / 500) * 500 || 500;
    return {
      text: `Reducer variable udgifter med ${formatCurrency(reduction, { roundToHundreds: false, decimals: 0 })}/md. og frigør ${formatCurrency(reduction * 12, { roundToHundreds: false, decimals: 0 })} i løbet af et år.`,
      cta: 'Justér variable udgifter',
      path: '/variable-forbrug',
    };
  }
  return null;
}

export function computePageBgClass(score: number | null): string {
  if (score === null) return 'from-slate-50/60 via-white to-white';
  if (score >= 85) return 'from-emerald-50/60 via-white to-white';
  if (score >= 70) return 'from-sky-50/60 via-white to-white';
  if (score >= 50) return 'from-amber-50/50 via-white to-white';
  return 'from-orange-50/50 via-white to-white';
}
