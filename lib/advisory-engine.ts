export interface AdvisoryInput {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  expenseRate: number;
  savingsRate: number;
  longestGoalMonths: number;
  topExpenseGroups: Array<{
    name: string;
    monthly: number;
    isIncome: boolean;
  }>;
  slowestGoal: {
    remaining: number;
    currentMonthly: number;
  } | null;
}

export interface AdvisoryBreakdownItem {
  category: string;
  currentAmount: number;
  benchmarkAmount: number;
  deviation: number;
  reduction: number;
}

export interface AdvisoryResult {
  shouldShow: boolean;
  totalReduction: number;
  breakdown: AdvisoryBreakdownItem[];
  incomeAdjustmentFallback: boolean;
  impact: {
    newExpenseRate: number;
    newSavingsRate: number;
    newMonthlySavings: number;
    monthsSaved: number | null;
  };
  triggeredBy: {
    highExpenseRate: boolean;
    zeroSavings: boolean;
    offTrackGoal: boolean;
  };
}

export interface AdvisoryEngineConfig {
  trigger_high_expense_rate: boolean;
  trigger_high_expense_rate_threshold: number;
  trigger_zero_savings: boolean;
  trigger_off_track_goal: boolean;
  trigger_off_track_goal_months: number;
  expense_target_rate: number;
  savings_target_rate: number;
  max_reduction_pct_per_group: number;
  benchmark_housing: number;
  benchmark_food: number;
  benchmark_transport: number;
  benchmark_insurance: number;
  benchmark_telecom: number;
  benchmark_leisure: number;
  benchmark_other: number;
  keywords_housing: string[];
  keywords_food: string[];
  keywords_transport: string[];
  keywords_insurance: string[];
  keywords_telecom: string[];
  keywords_leisure: string[];
}

export const DEFAULT_ADVISORY_CONFIG: AdvisoryEngineConfig = {
  trigger_high_expense_rate: true,
  trigger_high_expense_rate_threshold: 0.60,
  trigger_zero_savings: true,
  trigger_off_track_goal: true,
  trigger_off_track_goal_months: 72,
  expense_target_rate: 0.55,
  savings_target_rate: 0.10,
  max_reduction_pct_per_group: 0.15,
  benchmark_housing: 0.30,
  benchmark_food: 0.15,
  benchmark_transport: 0.10,
  benchmark_insurance: 0.05,
  benchmark_telecom: 0.04,
  benchmark_leisure: 0.08,
  benchmark_other: 0.15,
  keywords_housing: ['bolig', 'husleje', 'leje', 'realkreditlån', 'realkredit', 'ejerbolig', 'andel', 'hus', 'lejlighed'],
  keywords_food: ['mad', 'dagligvarer', 'fødevarer', 'supermarked', 'groceries', 'indkøb', 'husholdning'],
  keywords_transport: ['transport', 'bil', 'benzin', 'tog', 'bus', 'rejse', 'parkering', 'bilvask', 'køretøj'],
  keywords_insurance: ['forsikring', 'forsikringer'],
  keywords_telecom: ['telefon', 'mobil', 'internet', 'tv', 'streaming', 'abonnement', 'tele'],
  keywords_leisure: ['fritid', 'underholdning', 'sport', 'hobby', 'restaurant', 'café', 'ferie', 'oplevelser'],
};

interface BenchmarkRule {
  key: string;
  keywords: string[];
  benchmarkRatio: number;
}

function buildBenchmarks(cfg: AdvisoryEngineConfig): BenchmarkRule[] {
  return [
    { key: 'housing',   keywords: cfg.keywords_housing,   benchmarkRatio: cfg.benchmark_housing },
    { key: 'food',      keywords: cfg.keywords_food,       benchmarkRatio: cfg.benchmark_food },
    { key: 'transport', keywords: cfg.keywords_transport,  benchmarkRatio: cfg.benchmark_transport },
    { key: 'insurance', keywords: cfg.keywords_insurance,  benchmarkRatio: cfg.benchmark_insurance },
    { key: 'telecom',   keywords: cfg.keywords_telecom,    benchmarkRatio: cfg.benchmark_telecom },
    { key: 'leisure',   keywords: cfg.keywords_leisure,    benchmarkRatio: cfg.benchmark_leisure },
    { key: 'other',     keywords: [],                      benchmarkRatio: cfg.benchmark_other },
  ];
}

function matchBenchmark(name: string, benchmarks: BenchmarkRule[]): BenchmarkRule {
  const normalised = name.toLowerCase().trim();
  for (const rule of benchmarks) {
    if (rule.keywords.some(kw => normalised.includes(kw))) {
      return rule;
    }
  }
  return benchmarks[benchmarks.length - 1];
}

function ceilToHundred(v: number): number {
  return Math.ceil(v / 100) * 100;
}

export function runAdvisoryEngine(
  input: AdvisoryInput,
  config: AdvisoryEngineConfig = DEFAULT_ADVISORY_CONFIG,
): AdvisoryResult {
  const { monthlyIncome, monthlyExpenses, monthlySavings, expenseRate, savingsRate, longestGoalMonths, topExpenseGroups, slowestGoal } = input;

  const noOp: AdvisoryResult = {
    shouldShow: false,
    totalReduction: 0,
    breakdown: [],
    incomeAdjustmentFallback: false,
    impact: {
      newExpenseRate: expenseRate,
      newSavingsRate: savingsRate,
      newMonthlySavings: monthlySavings,
      monthsSaved: null,
    },
    triggeredBy: { highExpenseRate: false, zeroSavings: false, offTrackGoal: false },
  };

  if (monthlyIncome <= 0) return noOp;

  const triggeredBy = {
    highExpenseRate: config.trigger_high_expense_rate && expenseRate > config.trigger_high_expense_rate_threshold,
    zeroSavings: config.trigger_zero_savings && savingsRate === 0,
    offTrackGoal: config.trigger_off_track_goal && longestGoalMonths > config.trigger_off_track_goal_months,
  };

  const shouldActivate = triggeredBy.highExpenseRate || triggeredBy.zeroSavings || triggeredBy.offTrackGoal;
  if (!shouldActivate) return noOp;

  const reductionForExpenseTarget = monthlyExpenses - monthlyIncome * config.expense_target_rate;
  const reductionForSavingsTarget = monthlyIncome * config.savings_target_rate - monthlySavings;
  const requiredReduction = Math.max(reductionForExpenseTarget, reductionForSavingsTarget, 0);

  const benchmarks = buildBenchmarks(config);

  const expenseGroups = topExpenseGroups
    .filter(g => !g.isIncome && g.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly);

  const breakdown: AdvisoryBreakdownItem[] = [];
  let accumulated = 0;

  for (const group of expenseGroups) {
    if (accumulated >= requiredReduction && requiredReduction > 0) break;

    const rule = matchBenchmark(group.name, benchmarks);
    const benchmarkAmount = rule.benchmarkRatio * monthlyIncome;
    const deviation = group.monthly - benchmarkAmount;

    if (deviation <= 0) continue;

    const maxReductionByPct = group.monthly * config.max_reduction_pct_per_group;
    const rawReduction = Math.min(maxReductionByPct, deviation);

    const stillNeeded = requiredReduction > 0 ? requiredReduction - accumulated : rawReduction;
    const reduction = ceilToHundred(Math.min(rawReduction, stillNeeded > 0 ? stillNeeded : rawReduction));

    if (reduction <= 0) continue;

    breakdown.push({
      category: group.name,
      currentAmount: group.monthly,
      benchmarkAmount,
      deviation,
      reduction,
    });

    accumulated += reduction;
  }

  const incomeAdjustmentFallback = breakdown.length === 0;
  const totalReduction = breakdown.reduce((s, item) => s + item.reduction, 0);

  const newMonthlyExpenses = monthlyExpenses - totalReduction;
  const newExpenseRate = newMonthlyExpenses / monthlyIncome;
  const newMonthlySavings = monthlySavings + totalReduction;
  const newSavingsRate = newMonthlySavings / monthlyIncome;

  let monthsSaved: number | null = null;
  if (slowestGoal && slowestGoal.remaining > 0 && slowestGoal.currentMonthly > 0 && totalReduction > 0) {
    const boostedMonthly = slowestGoal.currentMonthly + totalReduction;
    const boostedMonths = Math.ceil(slowestGoal.remaining / boostedMonthly);
    monthsSaved = Math.max(longestGoalMonths - boostedMonths, 0);
  }

  return {
    shouldShow: true,
    totalReduction,
    breakdown,
    incomeAdjustmentFallback,
    impact: {
      newExpenseRate,
      newSavingsRate,
      newMonthlySavings,
      monthsSaved,
    },
    triggeredBy,
  };
}
