'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useSettings, getCardStyle, getTopBarStyle } from '@/lib/settings-context';
import { getBudgetStructure, updateBudget } from '@/lib/db-helpers';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Shuffle, ChartBar as BarChart3, ChevronRight, Repeat, ArrowRight, Zap, DollarSign, TrendingUp, TrendingDown, Wallet, Pencil } from 'lucide-react';
import { formatCurrency } from '@/lib/number-helpers';
import { cn } from '@/lib/utils';
import { EditableText } from '@/components/editable-text';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { useAdminLabel } from '@/components/admin-page-label';

interface BudgetSummary {
  id: string;
  name: string;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  categoryGroups: CategoryGroupSummary[];
  openingBalance: number;
  structure: any;
}

interface CategoryGroupSummary {
  id: string;
  name: string;
  is_income: boolean;
  monthlyTotal: number;
}

interface VariableSummary {
  estimate: number | null;
  postalCode: string | null;
  adultCount: number | null;
  childCount: number | null;
}

interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number | null;
}

interface Advisory {
  sentence: string;
  action: string;
  ctaLabel: string;
  ctaHref: string;
  keyNumber: string;
}

function monthsToGoal(target: number, current: number, monthly: number): number | null {
  const remaining = target - current;
  if (remaining <= 0) return 0;
  if (!monthly || monthly <= 0) return null;
  return Math.ceil(remaining / monthly);
}

function formatMonths(months: number): string {
  if (months === 0) return 'nået';
  if (months < 12) return `${months} mdr.`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} år`;
  return `${years} år ${rem} mdr.`;
}

function computeAdvisory(
  income: number,
  fixed: number,
  variableEst: number,
  simulatedVariable: number,
  sliderValue: number,
  primaryGoal: SavingsGoal | null,
  budget: BudgetSummary | null,
  fc: (v: number) => string,
): Advisory | null {
  if (!budget || income <= 0) return null;

  const totalWithSlider = fixed + simulatedVariable;
  const headroom = income - totalWithSlider;
  const expensePct = Math.round((totalWithSlider / income) * 100);

  if (sliderValue > 0 && headroom > 0) {
    if (primaryGoal && primaryGoal.monthly_contribution && primaryGoal.monthly_contribution > 0) {
      const boostedMonthly = primaryGoal.monthly_contribution + sliderValue;
      const boostedMonths = monthsToGoal(primaryGoal.target_amount, primaryGoal.current_amount, boostedMonthly);
      const baseMonths = monthsToGoal(primaryGoal.target_amount, primaryGoal.current_amount, primaryGoal.monthly_contribution);
      if (boostedMonths !== null && baseMonths !== null && baseMonths > 0 && boostedMonths < baseMonths) {
        const saved = baseMonths - boostedMonths;
        return {
          sentence: `Med en reduktion på ${fc(sliderValue)}/md. kan du nå dit mål ${formatMonths(saved)} tidligere.`,
          action: `Overvej at øremærke de frigjorte ${fc(sliderValue)} direkte til "${primaryGoal.name}".`,
          ctaLabel: 'Justér variable udgifter',
          ctaHref: '/variable-forbrug',
          keyNumber: `−${formatMonths(saved)}`,
        };
      }
    }
    return {
      sentence: `Justeringen frigør ${fc(sliderValue)}/md. og bringer dit rådighedsbeløb op på ${fc(headroom)}.`,
      action: 'Sæt det frigjorte beløb i arbejde – enten som opsparing eller mod et aktivt mål.',
      ctaLabel: 'Se dine mål',
      ctaHref: '/maal',
      keyNumber: fc(headroom),
    };
  }

  if (expensePct >= 90) {
    return {
      sentence: `Dine udgifter udgør ${expensePct}% af din indkomst – det efterlader meget lidt råderum.`,
      action: 'Gennemgå dine faste poster og identificér poster, der kan reduceres eller opsiges.',
      ctaLabel: 'Gennemgå faste udgifter',
      ctaHref: `/budgets/${budget.id}`,
      keyNumber: `${expensePct}%`,
    };
  }

  if (expensePct >= 75) {
    const saveable = income - totalWithSlider;
    return {
      sentence: `${expensePct}% af din indkomst er bundet – kun ${fc(saveable)}/md. er frit rådighedsbeløb.`,
      action: 'En reduktion i variable udgifter er den hurtigste vej til mere handlerum.',
      ctaLabel: 'Justér variable udgifter',
      ctaHref: '/variable-forbrug',
      keyNumber: fc(saveable),
    };
  }

  if (!primaryGoal) {
    const freeCash = income - totalWithSlider;
    return {
      sentence: `Du har ${fc(freeCash)}/md. i fri likviditet. Uden et mål arbejder pengene ikke for dig.`,
      action: 'Definer et konkret opsparing- eller investeringsmål, så kapitalen arbejder med intention.',
      ctaLabel: 'Opret mål',
      ctaHref: '/maal',
      keyNumber: fc(freeCash),
    };
  }

  if (primaryGoal && (!primaryGoal.monthly_contribution || primaryGoal.monthly_contribution <= 0)) {
    const freeCash = income - totalWithSlider;
    return {
      sentence: `"${primaryGoal.name}" har ingen månedlig bidragsrate tilknyttet endnu.`,
      action: `Du har ${fc(freeCash)}/md. tilgængeligt – sæt en fast bidragsrate for at holde kursen.`,
      ctaLabel: 'Opdatér mål',
      ctaHref: '/maal',
      keyNumber: fc(freeCash),
    };
  }

  if (primaryGoal && primaryGoal.monthly_contribution && primaryGoal.monthly_contribution > 0) {
    const months = monthsToGoal(primaryGoal.target_amount, primaryGoal.current_amount, primaryGoal.monthly_contribution);
    const freeCash = income - totalWithSlider;
    const boostAmount = Math.round(freeCash * 0.3 / 500) * 500;
    if (months !== null && months > 0 && boostAmount > 0) {
      const boostedMonths = monthsToGoal(primaryGoal.target_amount, primaryGoal.current_amount, primaryGoal.monthly_contribution + boostAmount);
      if (boostedMonths !== null && boostedMonths < months) {
        const saved = months - boostedMonths;
        return {
          sentence: `"${primaryGoal.name}" nås om ${formatMonths(months)} ved nuværende bidrag.`,
          action: `En stigning på ${fc(boostAmount)}/md. fremrykker målet med ${formatMonths(saved)}.`,
          ctaLabel: 'Justér bidrag',
          ctaHref: '/maal',
          keyNumber: formatMonths(months),
        };
      }
    }
    if (months !== null && months > 0) {
      return {
        sentence: `Ved nuværende bidrag er "${primaryGoal.name}" nået om ${formatMonths(months)}.`,
        action: 'Øg dit månedlige bidrag for at fremrykke målet – selv et lille løft gør en forskel.',
        ctaLabel: 'Justér bidrag',
        ctaHref: '/maal',
        keyNumber: formatMonths(months),
      };
    }
  }

  return null;
}

function computeNuvioScoreDelta(income: number, fixed: number, variableEst: number, simulatedVariable: number): number {
  if (income <= 0) return 0;
  function consumptionScore(totalPct: number): number {
    if (totalPct <= 0.45) return 100;
    if (totalPct >= 0.85) return 0;
    return Math.round(100 * (0.85 - totalPct) / (0.85 - 0.45));
  }
  const basePct = (fixed + variableEst) / income;
  const simPct = (fixed + simulatedVariable) / income;
  return Math.round((consumptionScore(simPct) - consumptionScore(basePct)) * 0.40);
}

const CATEGORY_BENCHMARKS: Record<string, number> = {
  bolig: 0.20,
  transport: 0.12,
  mad: 0.10,
  forsikring: 0.05,
  abonnementer: 0.03,
  underholdning: 0.05,
};

function getCategoryBenchmark(name: string): number | null {
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_BENCHMARKS)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

export default function PlanPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { settings, design } = useSettings();
  const { setDataTypes } = useAdminLabel();

  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [variable, setVariable] = useState<VariableSummary | null>(null);
  const [primaryGoal, setPrimaryGoal] = useState<SavingsGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [sliderValue, setSliderValue] = useState(0);
  const [editingOpeningBalance, setEditingOpeningBalance] = useState(false);
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');

  const fc = (v: number) => formatCurrency(v, { roundToHundreds: settings.roundToHundreds, decimals: 0 });
  const d = settings.hideDecimals ? 0 : 2;
  const fcd = (v: number) => formatCurrency(v, { roundToHundreds: settings.roundToHundreds, decimals: d });

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible' && user) loadAll();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user]);

  async function loadAll() {
    setLoading(true);
    try {
      const [budgetRes, householdRes, goalRes] = await Promise.all([
        supabase
          .from('budgets')
          .select('id, name, year, opening_balance')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('household')
          .select('variable_expense_estimate, variable_postal_code, adult_count, child_count, members')
          .eq('user_id', user!.id)
          .maybeSingle(),
        supabase
          .from('savings_goals')
          .select('id, name, target_amount, current_amount, monthly_contribution')
          .eq('completed', false)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      if (budgetRes.data) {
        const structure = await getBudgetStructure(budgetRes.data.id);
        let totalExpenses = 0;
        const groupTotals: CategoryGroupSummary[] = [];

        if (structure) {
          structure.categoryGroups.forEach((g: any) => {
            if (g.is_income) return;
            let groupMonthly = 0;
            g.categories.forEach((c: any) => {
              c.recipients.forEach((r: any) => {
                for (let m = 1; m <= 12; m++) {
                  const planned = Math.abs(r.monthlyPlans[m] || 0);
                  const actual = Math.abs(r.monthlyActuals[m] || 0);
                  const val = planned !== 0 ? planned : actual;
                  totalExpenses += val;
                  groupMonthly += val;
                }
              });
            });
            if (groupMonthly > 0) {
              groupTotals.push({
                id: g.id,
                name: g.name,
                is_income: false,
                monthlyTotal: groupMonthly / 12,
              });
            }
          });
        }

        const householdMembers: any[] = householdRes.data?.members ?? [];
        const totalIncome = householdMembers
          .filter((m: any) => m.type === 'adult' && m.monthly_net_salary > 0)
          .reduce((sum: number, m: any) => sum + m.monthly_net_salary, 0);

        groupTotals.sort((a, b) => b.monthlyTotal - a.monthlyTotal);

        setBudget({
          id: budgetRes.data.id,
          name: budgetRes.data.name,
          year: budgetRes.data.year,
          totalIncome: totalIncome,
          totalExpenses: totalExpenses / 12,
          openingBalance: (budgetRes.data as any).opening_balance ?? 0,
          categoryGroups: groupTotals,
          structure,
        });

        if (structure?.categoryGroups) {
          setDataTypes(structure.categoryGroups.map((g: any) => ({
            name: g.name,
            kind: g.is_income ? 'income' : 'expense',
          })));
        }
      }

      if (householdRes.data) {
        const hd = householdRes.data;
        setVariable({
          estimate: hd.variable_expense_estimate,
          postalCode: hd.variable_postal_code,
          adultCount: hd.adult_count,
          childCount: hd.child_count,
        });
      }

      if (goalRes.data) {
        setPrimaryGoal(goalRes.data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveOpeningBalance() {
    if (!budget) return;
    const value = parseFloat(openingBalanceInput.replace(',', '.'));
    if (isNaN(value)) { toast.error('Ugyldigt beløb'); return; }
    try {
      await updateBudget(budget.id, { opening_balance: value });
      setBudget(prev => prev ? { ...prev, openingBalance: value } : prev);
      setEditingOpeningBalance(false);
      toast.success('Start saldo gemt');
    } catch {
      toast.error('Kunne ikke gemme start saldo');
    }
  }

  const income = budget?.totalIncome ?? 0;
  const fixed = budget?.totalExpenses ?? 0;
  const variableEst = variable?.estimate ?? 0;
  const openingBalance = budget?.openingBalance ?? 0;
  const annualExpenses = fixed * 12;
  const annualIncome = income * 12;
  const closingBalance = openingBalance + annualIncome - annualExpenses;
  const recipientCount = budget?.structure
    ? budget.structure.categoryGroups.reduce((sum: number, g: any) =>
        sum + g.categories.reduce((cs: number, c: any) => cs + c.recipients.length, 0), 0)
    : 0;

  const fixedPct = income > 0 ? Math.round((fixed / income) * 100) : 0;
  const variablePct = income > 0 ? Math.round((variableEst / income) * 100) : 0;

  const simulatedVariable = Math.max(0, variableEst - sliderValue);
  const simulatedTotalPct = income > 0 ? Math.round(((fixed + simulatedVariable) / income) * 100) : 0;

  const scoreDelta = useMemo(() =>
    computeNuvioScoreDelta(income, fixed, variableEst, simulatedVariable),
    [income, fixed, variableEst, simulatedVariable]
  );

  const advisory = useMemo(() => computeAdvisory(
    income, fixed, variableEst, simulatedVariable, sliderValue, primaryGoal, budget, fc,
  ), [income, fixed, variableEst, simulatedVariable, sliderValue, primaryGoal, budget]);

  const goalImpact = useMemo(() => {
    if (!primaryGoal || !primaryGoal.monthly_contribution || primaryGoal.monthly_contribution <= 0) return null;
    const baseMonths = monthsToGoal(primaryGoal.target_amount, primaryGoal.current_amount, primaryGoal.monthly_contribution);
    if (baseMonths === null || baseMonths <= 0) return null;
    const boostedMonthly = primaryGoal.monthly_contribution + sliderValue;
    const boostedMonths = monthsToGoal(primaryGoal.target_amount, primaryGoal.current_amount, boostedMonthly);
    if (boostedMonths === null) return null;
    return { saved: baseMonths - boostedMonths, goalName: primaryGoal.name };
  }, [primaryGoal, sliderValue]);

  const topCategories = budget?.categoryGroups.slice(0, 6) ?? [];

  const pieData = useMemo(() => {
    if (!budget?.structure) return [];
    const colors = ['#3b82f6', '#14b8a6', '#f59e0b', '#ec4899', '#10b981', '#f97316', '#6366f1', '#8b5cf6'];
    const result: { name: string; value: number; color: string }[] = [];
    budget.structure.categoryGroups.forEach((group: any, index: number) => {
      if (!group.is_income) {
        let total = 0;
        group.categories.forEach((c: any) => {
          c.recipients.forEach((r: any) => {
            for (let m = 1; m <= 12; m++) {
              const planned = Math.abs(r.monthlyPlans[m] || 0);
              const actual = Math.abs(r.monthlyActuals[m] || 0);
              total += planned !== 0 ? planned : actual;
            }
          });
        });
        if (total > 0) result.push({ name: group.name, value: total, color: colors[index % colors.length] });
      }
    });
    return result;
  }, [budget?.structure]);

  const monthlyExpensesData = useMemo(() => {
    const data: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) data[m] = 0;
    if (!budget?.structure) return data;
    budget.structure.categoryGroups.forEach((group: any) => {
      if (!group.is_income) {
        group.categories.forEach((c: any) => {
          c.recipients.forEach((r: any) => {
            for (let m = 1; m <= 12; m++) {
              const planned = Math.abs(r.monthlyPlans[m] || 0);
              const actual = Math.abs(r.monthlyActuals[m] || 0);
              data[m] += planned !== 0 ? planned : actual;
            }
          });
        });
      }
    });
    return data;
  }, [budget?.structure]);

  function getCategoryLabel(monthlyAmt: number, incomeAmt: number): { label: string; cls: string; isHigh: boolean } {
    if (incomeAmt <= 0) return { label: 'Normal', cls: 'text-muted-foreground', isHigh: false };
    const pct = monthlyAmt / incomeAmt;
    if (pct > 0.25) return { label: 'Høj', cls: 'text-rose-600 dark:text-rose-400', isHigh: true };
    if (pct > 0.15) return { label: 'Over gennemsnit', cls: 'text-amber-600 dark:text-amber-500', isHigh: true };
    return { label: 'Normal', cls: 'text-emerald-600 dark:text-emerald-400', isHigh: false };
  }

  const pg = design.page;
  const pageStyle: React.CSSProperties = {
    paddingTop: `${pg.paddingY}px`,
    paddingBottom: `${pg.paddingY}px`,
    paddingLeft: `${pg.paddingX}px`,
    paddingRight: `${pg.paddingX}px`,
  };
  const innerStyle: React.CSSProperties = {
    maxWidth: `${pg.maxWidth}px`,
  };
  const gapPx = `${pg.cardGap}px`;

  const smallStyle = getCardStyle(design.cardSmall);
  const mediumStyle = getCardStyle(design.cardMedium);
  const largeStyle = getCardStyle(design.cardLarge);
  const smallTopBar = getTopBarStyle(design.cardSmall, design.gradientFrom, design.gradientTo);
  const mediumTopBar = getTopBarStyle(design.cardMedium, design.gradientFrom, design.gradientTo);
  const largeTopBar = getTopBarStyle(design.cardLarge, design.gradientFrom, design.gradientTo);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
  const maxMonthlyExpense = Math.max(...Object.values(monthlyExpensesData), 1);
  const monthlyAvg = annualExpenses / 12;
  const monthlyBalance = income - monthlyAvg;
  const isBalanced = monthlyBalance >= 0;
  const hasFixedExpenses = recipientCount > 0;
  const hasIncome = annualIncome > 0;
  const hasOpeningBalance = openingBalance !== 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20" style={pageStyle}>
      <div className="mx-auto" style={{ ...innerStyle, display: 'flex', flexDirection: 'column', gap: gapPx }}>

        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            <EditableText textKey="plan.page.title" fallback="Plan" as="span" />
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            <EditableText textKey="plan.page.subtitle" fallback="Dit økonomiske overblik og avancerede værktøjer" as="span" />
          </p>
        </div>

        {!budget && (
          <div className="bg-card flex flex-col" style={largeStyle}>
            {largeTopBar && <div style={largeTopBar} />}
            <div className="p-6">
              <p className="text-sm text-muted-foreground mb-4">Opret et budget for at se dit strategiske overblik.</p>
              <button
                onClick={() => router.push('/budgets')}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-secondary/30 transition-all group"
              >
                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Opret dit første budget</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              </button>
            </div>
          </div>
        )}

        {budget && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: gapPx }}>

              <div className="bg-card flex flex-col" style={smallStyle}>
                {smallTopBar
                  ? <div style={{ ...smallTopBar, background: `linear-gradient(to right, ${design.card1GradientFrom}, ${design.card1GradientTo})` }} />
                  : null
                }
                <div className="p-5 flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="h-4 w-4" style={{ color: design.card1GradientFrom }} />
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Udgifter</p>
                  </div>
                  {hasFixedExpenses ? (
                    <>
                      <div className="text-3xl font-bold tracking-tight tabular-nums" style={{ color: design.card1GradientFrom }}>
                        {fcd(-annualExpenses)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{recipientCount} modtagere</p>
                    </>
                  ) : (
                    <>
                      <div className="text-lg font-semibold text-muted-foreground/50 mt-1">Ikke oprettet</div>
                      <button
                        onClick={() => router.push(`/budgets/${budget.id}`)}
                        className="text-sm mt-2 font-medium underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Tilføj faste udgifter
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-card flex flex-col group" style={smallStyle}>
                {smallTopBar
                  ? <div style={{ ...smallTopBar, background: 'linear-gradient(to right, #f59e0b, #fbbf24)' }} />
                  : null
                }
                <div className="p-5 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-amber-500" />
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Start saldo</p>
                    </div>
                    {hasOpeningBalance && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => { setOpeningBalanceInput(String(openingBalance)); setEditingOpeningBalance(true); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {hasOpeningBalance ? (
                    <>
                      <div className="text-3xl font-bold tracking-tight tabular-nums text-amber-600">
                        {fcd(openingBalance)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">Saldo ved periodens start</p>
                    </>
                  ) : (
                    <>
                      <div className="text-lg font-semibold text-muted-foreground/50 mt-1">Valgfri</div>
                      <button
                        onClick={() => { setOpeningBalanceInput('0'); setEditingOpeningBalance(true); }}
                        className="text-sm mt-2 font-medium underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Angiv saldo
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: gapPx }}>
              <div className="bg-card flex flex-col" style={mediumStyle}>
                {mediumTopBar && <div style={mediumTopBar} />}
                <div className="p-6 flex-1">
                  <p className="text-base font-semibold mb-0.5">Udgiftsfordeling</p>
                  <p className="text-sm text-muted-foreground mb-4">Fordeling efter kategori</p>
                  {pieData.length > 0 ? (
                    <div className="space-y-4">
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={95}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => fcd(value)}
                            contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="grid grid-cols-2 gap-2.5">
                        {pieData.map((entry, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{entry.name}</div>
                              <div className="text-xs text-muted-foreground">{fcd(entry.value)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                      Ingen udgifter at vise
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-card flex flex-col" style={mediumStyle}>
                {mediumTopBar && <div style={mediumTopBar} />}
                <div className="p-6 flex-1 flex flex-col">
                  <p className="text-base font-semibold mb-4">Månedlige udgifter</p>
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-end justify-between gap-1.5 h-48">
                      {monthNames.map((monthName, index) => {
                        const month = index + 1;
                        const expense = monthlyExpensesData[month];
                        const heightPercent = maxMonthlyExpense > 0 ? (expense / maxMonthlyExpense) * 100 : 0;
                        return (
                          <div key={month} className="flex-1 flex flex-col items-center gap-1.5 h-full">
                            <div className="flex-1 w-full flex items-end justify-center">
                              {expense > 0 && (
                                <div
                                  className="w-full rounded-t-md transition-all duration-300 hover:opacity-75 cursor-pointer relative group"
                                  style={{ height: `${heightPercent}%`, background: `linear-gradient(to top, ${design.gradientFrom}, ${design.gradientTo})` }}
                                >
                                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-xs py-1 px-2 rounded whitespace-nowrap z-10">
                                    {fcd(expense)}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="text-xs font-medium text-muted-foreground/70">{monthName}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="border-t border-border/40 pt-4 mt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Månedlig overførsel til opsparingskonto</p>
                          <div className="text-2xl font-bold tracking-tight tabular-nums" style={{ color: design.card1GradientFrom }}>
                            {fcd(monthlyAvg)}
                          </div>
                          <p className="text-xs text-muted-foreground/70 mt-0.5">Samlede udgifter / 12 måneder</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground mb-1">Månedlig balance</p>
                          <div
                            className="text-2xl font-bold tracking-tight tabular-nums flex items-center justify-end gap-1.5"
                            style={{ color: isBalanced ? design.card3GradientFrom : design.card1GradientFrom }}
                          >
                            {isBalanced
                              ? <TrendingUp className="h-5 w-5" style={{ color: design.card3GradientFrom }} />
                              : <TrendingDown className="h-5 w-5" style={{ color: design.card1GradientFrom }} />}
                            {fcd(Math.abs(monthlyBalance))}
                          </div>
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            {isBalanced ? 'Overskud pr. måned' : 'Underskud pr. måned'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: gapPx }}>
              <div className="bg-card flex flex-col" style={smallStyle}>
                {smallTopBar && <div style={smallTopBar} />}
                <div className="p-5 flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-7 w-7 rounded-xl bg-secondary/70 flex items-center justify-center shrink-0">
                      <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Faste udgifter</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums mb-1">{fc(fixed)}</p>
                  <p className="text-xs text-muted-foreground">pr. måned</p>
                  {income > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/40">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">{fixedPct}% af indkomst</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-foreground/20 transition-all duration-700" style={{ width: `${Math.min(100, fixedPct)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-card flex flex-col" style={smallStyle}>
                {smallTopBar && <div style={smallTopBar} />}
                <div className="p-5 flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-7 w-7 rounded-xl bg-secondary/70 flex items-center justify-center shrink-0">
                      <Shuffle className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Variable udgifter</p>
                  </div>
                  {variableEst > 0 ? (
                    <>
                      <p className="text-2xl font-bold tabular-nums mb-1">{fc(variableEst)}</p>
                      <p className="text-xs text-muted-foreground">pr. måned</p>
                      {income > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/40">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-muted-foreground">{variablePct}% af indkomst</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full bg-foreground/20 transition-all duration-700" style={{ width: `${Math.min(100, variablePct)}%` }} />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => router.push('/variable-forbrug')}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mt-1"
                    >
                      Beregn variabelt forbrug
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {topCategories.length > 0 && income > 0 && (
              <div className="bg-card flex flex-col" style={largeStyle}>
                {largeTopBar && <div style={largeTopBar} />}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Kategori-overblik</p>
                    </div>
                    <button
                      onClick={() => router.push(`/budgets/${budget.id}`)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      Se alle
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    {topCategories.map((group) => {
                      const catPct = income > 0 ? Math.round((group.monthlyTotal / income) * 100) : 0;
                      const { label: catLabel, cls: catCls, isHigh } = getCategoryLabel(group.monthlyTotal, income);
                      const barWidth = Math.min(100, (group.monthlyTotal / income) * 100);
                      const benchmark = getCategoryBenchmark(group.name);
                      const benchmarkPct = benchmark ? Math.round(benchmark * 100) : null;
                      const significantlyHigh = benchmarkPct !== null && catPct > benchmarkPct + 5;
                      return (
                        <div key={group.id} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium truncate">{group.name}</span>
                              <span className={cn('text-xs font-medium shrink-0', catCls)}>{catLabel}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground">{catPct}%</span>
                              <span className="text-sm font-semibold tabular-nums">{fc(group.monthlyTotal)}</span>
                            </div>
                          </div>
                          <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full bg-foreground/15 transition-all duration-700" style={{ width: `${barWidth}%` }} />
                          </div>
                          {isHigh && benchmarkPct !== null && (
                            <p className="text-xs text-muted-foreground/70 leading-relaxed pt-0.5">
                              {group.name} udgør {catPct}% af din indkomst. Benchmark er {benchmarkPct}%.
                              {significantlyHigh && (
                                <span className="block mt-0.5 text-muted-foreground/60">
                                  Overvej om udgiften kan optimeres uden at reducere livskvalitet.
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-card flex flex-col" style={largeStyle}>
              {largeTopBar && <div style={largeTopBar} />}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Variabel justering</p>
                </div>
                <p className="text-xs text-muted-foreground mb-5">Simuler hvad der sker hvis du reducerer dit variable forbrug</p>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-muted-foreground">Reduktion</span>
                    <span className="text-sm font-semibold">{sliderValue === 0 ? 'Ingen ændring' : `−${fc(sliderValue)}/md.`}</span>
                  </div>
                  <Slider
                    value={[sliderValue]}
                    onValueChange={([v]) => setSliderValue(v)}
                    min={0}
                    max={2000}
                    step={100}
                    className="w-full"
                  />
                  <div className="flex justify-between mt-1.5">
                    <span className="text-xs text-muted-foreground">0 kr.</span>
                    <span className="text-xs text-muted-foreground">2.000 kr.</span>
                  </div>
                </div>
                {sliderValue > 0 ? (
                  <div className="rounded-2xl bg-secondary/40 px-4 py-4 space-y-2.5">
                    <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest mb-1">
                      Reducerer du {fc(sliderValue)}/md.
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Forbrug falder til</span>
                        <span className="font-semibold tabular-nums">{simulatedTotalPct}%</span>
                      </div>
                      {scoreDelta > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Nuvio Score stiger</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">+{scoreDelta} point</span>
                        </div>
                      )}
                      {goalImpact && goalImpact.saved > 0 ? (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Mål nås tidligere</span>
                          <span className="font-semibold text-primary tabular-nums">{formatMonths(goalImpact.saved)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Øget fleksibilitet</span>
                          <span className="font-semibold tabular-nums">{fc(sliderValue * 12)} / år</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-secondary/40 px-4 py-3.5">
                    <p className="text-sm text-muted-foreground">Brug slideren til at se effekten af en lavere variabel udgift</p>
                  </div>
                )}
              </div>
            </div>

            {advisory && (
              <div className="bg-card flex flex-col" style={{ ...largeStyle, borderColor: 'hsl(var(--border) / 0.5)' }}>
                {largeTopBar && <div style={largeTopBar} />}
                <div className="px-6 pt-5 pb-1 flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
                      Nuvio anbefaler
                    </p>
                  </div>
                  <div className="flex-1 h-px bg-border/40" />
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground/50 bg-secondary px-2 py-0.5 rounded-full border border-border/40">
                    {advisory.keyNumber}
                  </span>
                </div>
                <div className="px-6 pt-3 pb-5 space-y-3">
                  <p className="text-sm font-medium text-foreground leading-snug">{advisory.sentence}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{advisory.action}</p>
                  <button
                    onClick={() => router.push(advisory.ctaHref)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:opacity-75 transition-opacity mt-1"
                  >
                    {advisory.ctaLabel}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <Dialog open={editingOpeningBalance} onOpenChange={(open) => { if (!open) setEditingOpeningBalance(false); }}>
          <DialogContent>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveOpeningBalance(); }}>
              <DialogHeader>
                <DialogTitle>Rediger start saldo</DialogTitle>
                <DialogDescription>
                  Angiv saldoen på kontoen ved starten af planperioden.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="opening-balance">Start saldo</Label>
                  <Input
                    id="opening-balance"
                    type="number"
                    step="0.01"
                    value={openingBalanceInput}
                    onChange={(e) => setOpeningBalanceInput(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">Brug et negativt tal hvis kontoen starter i minus.</p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingOpeningBalance(false)}>Annuller</Button>
                <Button type="submit">Gem</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
