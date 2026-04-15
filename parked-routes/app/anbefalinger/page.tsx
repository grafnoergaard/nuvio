'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, TriangleAlert as AlertTriangle, Circle as XCircle, TrendingUp, TrendingDown, Target, Wallet, ChevronRight, ArrowLeft, PiggyBank, ChartBar as BarChart3, CircleCheck as CheckCircle2, CircleAlert as AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/number-helpers';
import { getBudgetStructure } from '@/lib/db-helpers';
import { useSettings } from '@/lib/settings-context';
import { toast } from 'sonner';
import { EditableText } from '@/components/editable-text';
import { runAdvisoryEngine, DEFAULT_ADVISORY_CONFIG } from '@/lib/advisory-engine';
import type { AdvisoryInput, AdvisoryEngineConfig } from '@/lib/advisory-engine';
import { AdvisoryCard } from '@/components/advisory-card';

interface AnalysisData {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  monthlyAvailable: number;
  savingsRate: number;
  availableRate: number;
  expenseRate: number;
  householdMonthlyIncome: number;
  variableExpenseEstimate: number | null;
  topExpenseGroups: Array<{ name: string; monthly: number; isIncome: boolean }>;
  budgetAccountAnswer: string | null;
}

type HealthLevel = 'healthy' | 'optimize' | 'challenged';

interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'savings' | 'expenses' | 'goals' | 'income' | 'buffer';
  title: string;
  description: string;
  action: string | null;
  actionPath: string | null;
  metric: string | null;
}

function computeHealthLevel(data: AnalysisData): HealthLevel {
  if (data.availableRate < 0) return 'challenged';
  if (data.savingsRate >= 0.10 && data.availableRate >= 0.05) return 'healthy';
  return 'optimize';
}

function buildRecommendations(data: AnalysisData, budgetId: string | null): Recommendation[] {
  const recs: Recommendation[] = [];
  const fc = (v: number) => formatCurrency(v, { roundToHundreds: false, decimals: 0 });

  if (data.availableRate < 0) {
    const deficit = Math.abs(data.monthlyAvailable);
    const reduceTarget = Math.ceil(deficit / 500) * 500;
    recs.push({
      id: 'negative-available',
      priority: 'high',
      category: 'expenses',
      title: 'Budgettet er i underskud',
      description: `Dit månedlige budget er ${fc(deficit)} i underskud. Reducer de faste udgifter med ${fc(reduceTarget)} for at opnå balance – det er det første skridt.`,
      action: budgetId ? 'Gennemgå budget' : null,
      actionPath: budgetId ? `/budgets/${budgetId}` : null,
      metric: `−${fc(deficit)} / md.`,
    });
  }

  if (data.householdMonthlyIncome > 0 && data.monthlyIncome > 0) {
    const householdAfter = data.householdMonthlyIncome - data.monthlyExpenses - (data.variableExpenseEstimate ?? 0) - data.monthlySavings;
    if (householdAfter < 0) {
      recs.push({
        id: 'household-negative',
        priority: 'high',
        category: 'income',
        title: 'Husstandens samlede økonomi er i underskud',
        description: `Inkluderer du husstandens variable udgifter, er der et underskud på ${fc(Math.abs(householdAfter))}/md. En gennemgang af de variable poster vil have direkte effekt.`,
        action: 'Se husstand',
        actionPath: '/husstand',
        metric: `−${fc(Math.abs(householdAfter))} / md.`,
      });
    }
  }

  if (data.savingsRate < 0.05 && data.monthlyIncome > 0 && data.availableRate >= 0) {
    const targetSavings = data.monthlyIncome * 0.10;
    const gap = Math.ceil((targetSavings - data.monthlySavings) / 500) * 500;
    recs.push({
      id: 'savings-low',
      priority: 'high',
      category: 'savings',
      title: 'Opsparingsraten kan øges',
      description: `Du sparer ${Math.round(data.savingsRate * 100)}% af indkomsten. En stigning på ${fc(gap)}/md. bringer dig op på 10% – det anbefalede minimum for en robust plan.`,
      action: null,
      actionPath: null,
      metric: `${Math.round(data.savingsRate * 100)}% — mål: 10%`,
    });
  }

  if (data.availableRate >= 0 && data.availableRate < 0.05 && data.availableRate >= 0) {
    const targetBuffer = data.monthlyIncome * 0.05;
    const bufferGap = Math.ceil((targetBuffer - data.monthlyAvailable) / 500) * 500;
    recs.push({
      id: 'tight-buffer',
      priority: 'medium',
      category: 'buffer',
      title: 'Rådighedsbeløbet er stramt',
      description: `Dit rådighedsbeløb er ${fc(data.monthlyAvailable)}/md. – det er ${Math.round(data.availableRate * 100)}% af indkomsten. Vi anbefaler minimum 5% (${fc(targetBuffer)}) for at have plads til det uforudsete. En reduktion på ${fc(bufferGap)} i faste udgifter vil gøre det.`,
      action: budgetId ? 'Se udgiftsdetaljer' : null,
      actionPath: budgetId ? `/budgets/${budgetId}/details` : null,
      metric: `${fc(data.monthlyAvailable)} / md.`,
    });
  }

  if (data.expenseRate > 0.80 && data.monthlyIncome > 0) {
    const overBy = Math.round((data.expenseRate - 0.75) * data.monthlyIncome);
    recs.push({
      id: 'high-expense-rate',
      priority: 'medium',
      category: 'expenses',
      title: 'Faste udgifter udgør en stor andel',
      description: `Dine faste udgifter er ${Math.round(data.expenseRate * 100)}% af indkomsten – ${fc(overBy)}/md. over det anbefalede niveau på 75%. En gennemgang af de større poster kan frigive luft i budgettet.`,
      action: budgetId ? 'Gennemgå budget' : null,
      actionPath: budgetId ? `/budgets/${budgetId}` : null,
      metric: `${Math.round(data.expenseRate * 100)}% af indkomst`,
    });
  }

  if (data.budgetAccountAnswer === 'no_unknown' || data.budgetAccountAnswer === 'considering' || data.budgetAccountAnswer === 'yes_rarely') {
    const descMap: Record<string, string> = {
      no_unknown: `Du har ikke en fast budgetkonto endnu. Det er én af de mest effektive måder at sikre, at dine faste udgifter altid er dækket — uden at du skal tænke over det. Overfør ${fc(data.monthlyExpenses)} til en separat konto den 1. i måneden, og brug resten frit.`,
      considering: `Du overvejer at oprette en fast budgetkonto — det er en god idé. Mange oplever at deres overblik forbedres markant, når faste udgifter trækkes fra én dedikeret konto. Det er nemt at sætte op i din netbank.`,
      yes_rarely: `Du har en fast budgetkonto, men bruger den sjældent. For at få det fulde udbytte bør alle faste betalinger trækkes fra denne konto. Gennemgå dine betalingsaftaler og flyt dem, der endnu ikke er tilknyttet.`,
    };
    recs.push({
      id: 'budget-account',
      priority: 'medium',
      category: 'buffer',
      title: data.budgetAccountAnswer === 'yes_rarely' ? 'Aktiver din budgetkonto fuldt ud' : 'Overvej en fast budgetkonto',
      description: descMap[data.budgetAccountAnswer],
      action: null,
      actionPath: null,
      metric: data.budgetAccountAnswer === 'yes_rarely' ? 'Brugt sjældent' : 'Ikke oprettet',
    });
  }

  if (data.variableExpenseEstimate !== null && data.variableExpenseEstimate > 0 && data.monthlyIncome > 0) {
    const variableRate = data.variableExpenseEstimate / data.monthlyIncome;
    if (variableRate > 0.25) {
      const overBenchmarkPct = Math.round((variableRate - 0.20) * 100);
      const overBenchmarkAmount = Math.round((variableRate - 0.20) * data.monthlyIncome);
      recs.push({
        id: 'high-variable',
        priority: 'low',
        category: 'expenses',
        title: 'Variabelt forbrug over benchmark',
        description: `Dit variable forbrug er ${Math.round(variableRate * 100)}% af indkomsten – ${overBenchmarkPct}%-point over benchmark for en husstand som din. En reduktion på ${fc(overBenchmarkAmount)}/md. vil have direkte effekt på din plan.`,
        action: 'Se variable udgifter',
        actionPath: '/variable-forbrug',
        metric: `${fc(data.variableExpenseEstimate)} / md.`,
      });
    }
  }

  if (recs.length === 0) {
    recs.push({
      id: 'all-good',
      priority: 'low',
      category: 'savings',
      title: 'Din plan er i god form',
      description: `Du sparer ${Math.round(data.savingsRate * 100)}% af indkomsten og har ${fc(data.monthlyAvailable)}/md. disponibel. Din økonomi er i god balance.`,
      action: null,
      actionPath: null,
      metric: null,
    });
  }

  return recs.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
}

const categoryIcons: Record<string, React.ReactNode> = {
  savings: <PiggyBank className="h-4 w-4" />,
  expenses: <TrendingDown className="h-4 w-4" />,
  goals: <Target className="h-4 w-4" />,
  income: <TrendingUp className="h-4 w-4" />,
  buffer: <Wallet className="h-4 w-4" />,
};

const priorityConfig = {
  high: {
    dot: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
    label: 'Vigtig',
    border: 'border-rose-200 dark:border-rose-900/40',
    iconBg: 'bg-rose-100 dark:bg-rose-900/40',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
  medium: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    label: 'Anbefalet',
    border: 'border-amber-200 dark:border-amber-900/40',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  low: {
    dot: 'bg-sky-500',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
    label: 'Tip',
    border: 'border-sky-200 dark:border-sky-900/40',
    iconBg: 'bg-sky-100 dark:bg-sky-900/40',
    iconColor: 'text-sky-600 dark:text-sky-400',
  },
};

export default function AnbefalingerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [advisoryCfg, setAdvisoryCfg] = useState<AdvisoryEngineConfig>(DEFAULT_ADVISORY_CONFIG);

  const statusParam = searchParams.get('status') as HealthLevel | null;

  const fc = (v: number) => formatCurrency(v, { roundToHundreds: false, decimals: 0 });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: advisoryRow } = await supabase
        .from('advisory_engine_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (advisoryRow) {
        setAdvisoryCfg({
          ...advisoryRow,
          keywords_housing:   Array.isArray(advisoryRow.keywords_housing)   ? advisoryRow.keywords_housing   : DEFAULT_ADVISORY_CONFIG.keywords_housing,
          keywords_food:      Array.isArray(advisoryRow.keywords_food)      ? advisoryRow.keywords_food      : DEFAULT_ADVISORY_CONFIG.keywords_food,
          keywords_transport: Array.isArray(advisoryRow.keywords_transport) ? advisoryRow.keywords_transport : DEFAULT_ADVISORY_CONFIG.keywords_transport,
          keywords_insurance: Array.isArray(advisoryRow.keywords_insurance) ? advisoryRow.keywords_insurance : DEFAULT_ADVISORY_CONFIG.keywords_insurance,
          keywords_telecom:   Array.isArray(advisoryRow.keywords_telecom)   ? advisoryRow.keywords_telecom   : DEFAULT_ADVISORY_CONFIG.keywords_telecom,
          keywords_leisure:   Array.isArray(advisoryRow.keywords_leisure)   ? advisoryRow.keywords_leisure   : DEFAULT_ADVISORY_CONFIG.keywords_leisure,
        });
      }

      const { data: budgetRow } = await supabase
        .from('budgets')
        .select('id, name, year, budget_account_answer')
        .eq('is_active', true)
        .maybeSingle();

      const activeBudget = budgetRow ?? await (async () => {
        const { data } = await supabase
          .from('budgets')
          .select('id, name, year, budget_account_answer')
          .order('year', { ascending: false })
          .limit(1)
          .maybeSingle();
        return data;
      })();

      if (!activeBudget) {
        setLoading(false);
        return;
      }
      setBudgetId(activeBudget.id);

      const [structure, householdResult] = await Promise.all([
        getBudgetStructure(activeBudget.id),
        supabase
          .from('household')
          .select('members, variable_expense_estimate')
          .maybeSingle(),
      ]);

      let totalExpenses = 0;
      const topGroups: Array<{ name: string; monthly: number; isIncome: boolean }> = [];

      if (structure) {
        for (const group of structure.categoryGroups) {
          if (group.is_income) continue;
          let groupTotal = 0;
          for (const cat of group.categories ?? []) {
            for (const rec of cat.recipients ?? []) {
              const annualPlanned = Object.values(rec.monthlyPlans as Record<number, number>).reduce((s, v) => s + v, 0);
              groupTotal += annualPlanned;
            }
          }
          const monthlyGroup = groupTotal / 12;
          totalExpenses += groupTotal;
          if (monthlyGroup > 0) {
            topGroups.push({ name: group.name, monthly: monthlyGroup, isIncome: false });
          }
        }
      }

      const monthlySavings = 0;

      const householdMembers: Array<{ type: string; monthly_net_salary: number | null }> =
        householdResult.data?.members ?? [];
      const householdMonthlyIncome = householdMembers
        .filter(m => m.type === 'adult')
        .reduce((s, m) => s + (m.monthly_net_salary ?? 0), 0);

      const monthlyIncome = householdMonthlyIncome;
      const monthlyExpenses = totalExpenses / 12;
      const monthlyAvailable = monthlyIncome - monthlyExpenses - monthlySavings;
      const savingsRate = monthlyIncome > 0 ? monthlySavings / monthlyIncome : 0;
      const availableRate = monthlyIncome > 0 ? monthlyAvailable / monthlyIncome : 0;
      const expenseRate = monthlyIncome > 0 ? monthlyExpenses / monthlyIncome : 0;

      const variableExpenseEstimate = householdResult.data?.variable_expense_estimate ?? null;

      topGroups.sort((a, b) => b.monthly - a.monthly);

      setAnalysis({
        monthlyIncome,
        monthlyExpenses,
        monthlySavings,
        monthlyAvailable,
        savingsRate,
        availableRate,
        expenseRate,
        householdMonthlyIncome,
        variableExpenseEstimate,
        topExpenseGroups: topGroups.slice(0, 5),
        budgetAccountAnswer: (activeBudget as any).budget_account_answer ?? null,
      });
    } catch (e) {
      console.error(e);
      toast.error('Kunne ikke indlæse anbefalinger');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">Analyserer din økonomi...</div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Ingen budgetdata fundet.</p>
          <button onClick={() => router.back()} className="text-sm underline">Gå tilbage</button>
        </div>
      </div>
    );
  }

  const healthLevel: HealthLevel = (statusParam === 'healthy' || statusParam === 'optimize' || statusParam === 'challenged')
    ? statusParam
    : computeHealthLevel(analysis);
  const recommendations = buildRecommendations(analysis, budgetId);
  const healthConfig = {
    healthy: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
      border: 'border-emerald-100 dark:border-emerald-900/40',
      icon: <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
      labelKey: 'anbefalinger.health.healthy.label',
      labelFallback: 'Sund plan',
      labelColor: 'text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
      descriptionKey: 'anbefalinger.health.healthy.description',
      descriptionFallback: 'Din økonomi er i god form. Din plan hænger sammen og du bevæger dig mod dine mål.',
    },
    optimize: {
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-100 dark:border-amber-900/40',
      icon: <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />,
      iconBg: 'bg-amber-100 dark:bg-amber-900/40',
      labelKey: 'anbefalinger.health.optimize.label',
      labelFallback: 'Kan optimeres',
      labelColor: 'text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-500',
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
      descriptionKey: 'anbefalinger.health.optimize.description',
      descriptionFallback: 'Din plan fungerer, men der er muligheder for at styrke din økonomi og fremdrift.',
    },
    challenged: {
      bg: 'bg-rose-50 dark:bg-rose-950/20',
      border: 'border-rose-100 dark:border-rose-900/40',
      icon: <XCircle className="h-6 w-6 text-rose-600 dark:text-rose-400" />,
      iconBg: 'bg-rose-100 dark:bg-rose-900/40',
      labelKey: 'anbefalinger.health.challenged.label',
      labelFallback: 'Udfordret plan',
      labelColor: 'text-rose-700 dark:text-rose-300',
      dot: 'bg-rose-500',
      badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
      descriptionKey: 'anbefalinger.health.challenged.description',
      descriptionFallback: 'Din plan kræver justeringer. Nedenfor finder du konkrete skridt til at komme på rette spor.',
    },
  };

  const hc = healthConfig[healthLevel];

  const advisoryInput: AdvisoryInput = {
    monthlyIncome: analysis.monthlyIncome,
    monthlyExpenses: analysis.monthlyExpenses,
    monthlySavings: analysis.monthlySavings,
    expenseRate: analysis.expenseRate,
    savingsRate: analysis.savingsRate,
    longestGoalMonths: 0,
    topExpenseGroups: analysis.topExpenseGroups,
    slowestGoal: null,
  };

  const advisoryResult = runAdvisoryEngine(advisoryInput, advisoryCfg);

  const metrics = [
    {
      label: 'Opsparingsrate',
      value: `${Math.round(analysis.savingsRate * 100)}%`,
      target: '10%',
      ok: analysis.savingsRate >= 0.10,
      icon: <PiggyBank className="h-4 w-4" />,
    },
    {
      label: 'Rådighedsbeløb',
      value: fc(analysis.monthlyAvailable),
      target: '> 5% af indkomst',
      ok: analysis.availableRate >= 0.05,
      icon: <Wallet className="h-4 w-4" />,
    },
    {
      label: 'Udgiftsandel',
      value: `${Math.round(analysis.expenseRate * 100)}%`,
      target: '< 80%',
      ok: analysis.expenseRate < 0.80,
      icon: <BarChart3 className="h-4 w-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-8">
      <div className="max-w-4xl mx-auto">

        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage
          </button>
          <div className="flex items-start gap-4">
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${hc.iconBg}`}>
              {hc.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <EditableText
                  textKey="anbefalinger.section.label"
                  fallback="Økonomisk analyse"
                  as="span"
                  className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                />
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full ${hc.badgeColor}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${hc.dot}`} />
                  <EditableText textKey={hc.labelKey} fallback={hc.labelFallback} as="span" />
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                <EditableText textKey="anbefalinger.page.title" fallback="Dine anbefalinger" as="span" />
              </h1>
              <p className="text-muted-foreground mt-1">
                <EditableText textKey={hc.descriptionKey} fallback={hc.descriptionFallback} as="span" multiline />
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {metrics.map((m) => (
            <div key={m.label} className={`rounded-2xl border p-4 ${m.ok ? 'bg-card border-border' : 'bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/40'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`${m.ok ? 'text-muted-foreground' : 'text-rose-500 dark:text-rose-400'}`}>{m.icon}</span>
                {m.ok
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  : <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                }
              </div>
              <div className={`text-xl font-bold ${m.ok ? 'text-foreground' : 'text-rose-700 dark:text-rose-300'}`}>{m.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{m.label}</div>
              <div className="text-xs text-muted-foreground/60 mt-0.5">Mål: {m.target}</div>
            </div>
          ))}
        </div>

        {advisoryResult.shouldShow && (
          <div className="mb-8">
            <AdvisoryCard result={advisoryResult} monthlyIncome={analysis.monthlyIncome} />
          </div>
        )}

        {analysis.topExpenseGroups.length > 0 && (
          <div className="mb-8">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <EditableText textKey="anbefalinger.section.udgiftsfordeling" fallback="Udgiftsfordeling" as="span" />
            </h2>
            <div className="rounded-2xl border bg-card overflow-hidden">
              {analysis.topExpenseGroups.map((g, i) => {
                const pct = analysis.monthlyIncome > 0 ? (g.monthly / analysis.monthlyIncome) * 100 : 0;
                return (
                  <div key={g.name} className={`flex items-center gap-4 px-5 py-3 ${i < analysis.topExpenseGroups.length - 1 ? 'border-b border-border' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium truncate">{g.name}</span>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
                          <span className="text-sm font-semibold tabular-nums">{fc(g.monthly)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${g.isIncome ? 'bg-emerald-500' : pct > 25 ? 'bg-rose-400' : 'bg-sky-400'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {recommendations.length > 0 && (() => {
          const [primary, ...rest] = recommendations;
          const pc = priorityConfig[primary.priority];
          return (
            <>
              <div className={`mb-6 rounded-2xl border overflow-hidden ${pc.border}`} style={{ background: 'var(--card)' }}>
                <div className="px-6 pt-6 pb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${pc.iconBg}`}>
                      <span className={pc.iconColor}>{categoryIcons[primary.category]}</span>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${pc.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${pc.dot}`} />
                      {pc.label}
                    </span>
                    {primary.metric && (
                      <span className="text-xs font-mono text-muted-foreground ml-auto">{primary.metric}</span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold mb-1.5 leading-tight">{primary.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{primary.description}</p>
                  {primary.action && primary.actionPath && (
                    <button
                      onClick={() => router.push(primary.actionPath!)}
                      className={`mt-4 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors ${
                        primary.priority === 'high'
                          ? 'text-rose-700 hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-100'
                          : primary.priority === 'medium'
                          ? 'text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100'
                          : 'text-sky-700 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100'
                      }`}
                    >
                      {primary.action}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {rest.length > 0 && (
                <>
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
                    <EditableText textKey="anbefalinger.section.ovrige" fallback="Øvrige observationer" as="span" />
                  </h2>
                  <div className="space-y-2 mb-10">
                    {rest.map((rec) => {
                      const rpc = priorityConfig[rec.priority];
                      return (
                        <div key={rec.id} className="rounded-xl border border-border bg-card overflow-hidden">
                          <div className="flex items-start gap-3 px-4 py-3.5">
                            <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${rpc.iconBg}`}>
                              <span className={`scale-90 ${rpc.iconColor}`}>{categoryIcons[rec.category]}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-0.5">
                                <span className="font-semibold text-sm">{rec.title}</span>
                                {rec.metric && (
                                  <span className="text-xs font-mono text-muted-foreground shrink-0">{rec.metric}</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">{rec.description}</p>
                              {rec.action && rec.actionPath && (
                                <button
                                  onClick={() => router.push(rec.actionPath!)}
                                  className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold transition-colors ${
                                    rec.priority === 'high'
                                      ? 'text-rose-700 hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-100'
                                      : rec.priority === 'medium'
                                      ? 'text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100'
                                      : 'text-sky-700 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100'
                                  }`}
                                >
                                  {rec.action}
                                  <ChevronRight className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          );
        })()}

      </div>
    </div>
  );
}
