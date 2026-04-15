'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getBudgetById, getBudgetStructure, getTransactions, createTransaction, deleteTransaction, updateTransaction, getCategoryGroups, updateBudget } from '@/lib/db-helpers';
import { supabase } from '@/lib/supabase';
import type { Budget, CategoryGroup } from '@/lib/database.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Upload, TrendingUp, TrendingDown, DollarSign, Plus, Trash2, Pencil, Wallet, CheckCircle2, Circle, ArrowRight, ChevronRight, Check, X } from 'lucide-react';
import { EditTransactionModal } from '@/components/edit-transaction-modal';
import { FixedExpensesWizard } from '@/components/fixed-expenses-wizard';
import { VariableExpenseWizard } from '@/components/variable-expense-wizard';
import { IncomeWizard } from '@/components/income-wizard';
import { computeOnboardingState } from '@/lib/onboarding-engine';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/number-helpers';
import { useSettings } from '@/lib/settings-context';
import { toast } from 'sonner';
import { Amount } from '@/components/amount';
import { useAdminLabel } from '@/components/admin-page-label';

export default function BudgetPage() {
  const router = useRouter();
  const params = useParams();
  const budgetId = params.id as string;

  const { settings, design } = useSettings();
  const { setDataTypes } = useAdminLabel();
  const [budget, setBudget] = useState<Budget | null>(null);
  const [structure, setStructure] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [categoryTransactions, setCategoryTransactions] = useState<any[]>([]);
  const [createTransactionDialogOpen, setCreateTransactionDialogOpen] = useState(false);
  const [newTransactionDescription, setNewTransactionDescription] = useState('');
  const [newTransactionAmount, setNewTransactionAmount] = useState('');
  const [newTransactionDate, setNewTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [editTransactionDialogOpen, setEditTransactionDialogOpen] = useState(false);
  const [editingOpeningBalance, setEditingOpeningBalance] = useState(false);
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [showFixedExpensesWizard, setShowFixedExpensesWizard] = useState(false);
  const [showVariableWizard, setShowVariableWizard] = useState(false);
  const [showIncomeWizard, setShowIncomeWizard] = useState(false);
  const [householdMonthlyIncome, setHouseholdMonthlyIncome] = useState(0);
  const d = settings.hideDecimals ? 0 : 2;
  const fc = (v: number) => formatCurrency(v, { roundToHundreds: settings.roundToHundreds, decimals: d });

  useEffect(() => {
    loadData();
    getCategoryGroups()
      .then(g => setCategoryGroups(g || []))
      .catch(() => {});
  }, [budgetId]);

  async function loadData() {
    try {
      const [budgetData, structureData, householdResult] = await Promise.all([
        getBudgetById(budgetId),
        getBudgetStructure(budgetId),
        supabase.from('household').select('members').maybeSingle(),
      ]);

      if (!budgetData) {
        router.push('/budgets');
        return;
      }
      setBudget(budgetData);
      setStructure(structureData);

      if (structureData?.categoryGroups) {
        setDataTypes(structureData.categoryGroups.map((g: any) => ({
          name: g.name,
          kind: g.is_income ? 'income' : 'expense',
        })));
      }

      const members: Array<{ type: string; monthly_net_salary: number | null }> =
        (householdResult.data?.members as any[]) ?? [];
      const monthlyIncome = members
        .filter(m => m.type === 'adult')
        .reduce((s, m) => s + (m.monthly_net_salary ?? 0), 0);
      setHouseholdMonthlyIncome(monthlyIncome);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Kunne ikke indlæse budget');
    } finally {
      setLoading(false);
    }
  }

  async function handleCategoryClick(category: any, categoryGroup: any) {
    try {
      setSelectedCategory({ ...category, categoryGroup });
      setCategorySheetOpen(true);

      const allTransactions = await getTransactions(budgetId);
      const filtered = allTransactions.filter((t: any) =>
        t.recipient?.category_group_id === categoryGroup.id
      );
      setCategoryTransactions(filtered);
    } catch (error) {
      console.error('Error loading category transactions:', error);
      toast.error('Kunne ikke indlæse posteringer');
    }
  }

  function handleCreateTransactionClick() {
    setNewTransactionDescription('');
    setNewTransactionAmount('');
    setNewTransactionDate(new Date().toISOString().split('T')[0]);
    setCreateTransactionDialogOpen(true);
  }

  async function handleCreateTransaction() {
    if (!selectedCategory || !newTransactionDescription.trim() || !newTransactionAmount) {
      toast.error('Udfyld alle felter');
      return;
    }

    const amount = parseFloat(newTransactionAmount);
    if (isNaN(amount)) {
      toast.error('Ugyldigt beløb');
      return;
    }

    try {
      await createTransaction({
        budget_id: budgetId,
        date: newTransactionDate,
        description: newTransactionDescription.trim(),
        amount: amount,
        category_group_id: selectedCategory.categoryGroup.id,
      });

      toast.success('Postering oprettet');
      setCreateTransactionDialogOpen(false);

      const allTransactions = await getTransactions(budgetId);
      const filtered = allTransactions.filter((t: any) =>
        t.recipient?.category_group_id === selectedCategory.categoryGroup.id
      );
      setCategoryTransactions(filtered);

      await loadData();
    } catch (error) {
      console.error('Error creating transaction:', error);
      toast.error('Kunne ikke oprette postering');
    }
  }

  async function handleDeleteTransaction(transactionId: string) {
    try {
      await deleteTransaction(transactionId);
      toast.success('Postering slettet');

      const allTransactions = await getTransactions(budgetId);
      const filtered = allTransactions.filter((t: any) =>
        t.recipient?.category_group_id === selectedCategory.categoryGroup.id
      );
      setCategoryTransactions(filtered);

      await loadData();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Kunne ikke slette postering');
    }
  }

  function handleOpenEditTransaction(transaction: any) {
    setEditingTransaction(transaction);
    setEditTransactionDialogOpen(true);
  }

  async function handleSaveEditTransaction(
    id: string,
    updates: { date: string; recipient_name: string | null; amount: number; category_group_id: string | null }
  ) {
    await updateTransaction(id, updates);
    toast.success('Postering opdateret');
    setEditTransactionDialogOpen(false);
    setEditingTransaction(null);

    if (selectedCategory) {
      const allTransactions = await getTransactions(budgetId);
      const filtered = allTransactions.filter((t: any) =>
        t.recipient?.category_group_id === selectedCategory.categoryGroup.id
        || t.category_group_id === selectedCategory.categoryGroup.id
      );
      setCategoryTransactions(filtered);
    }
    await loadData();
  }

  async function handleSaveOpeningBalance() {
    const value = parseFloat(openingBalanceInput.replace(',', '.'));
    if (isNaN(value)) {
      toast.error('Ugyldigt beløb');
      return;
    }
    try {
      const updated = await updateBudget(budgetId, { opening_balance: value });
      setBudget(updated);
      setEditingOpeningBalance(false);
      toast.success('Start saldo gemt');
    } catch {
      toast.error('Kunne ikke gemme start saldo');
    }
  }

  function calculateTotals() {
    if (!structure) return { planned: 0, income: 0, difference: 0, openingBalance: 0 };

    let expenses = 0;

    structure.categoryGroups.forEach((group: any) => {
      if (group.is_income) return;
      group.categories.forEach((category: any) => {
        category.recipients.forEach((recipient: any) => {
          for (let month = 1; month <= 12; month++) {
            const planned = Math.abs(recipient.monthlyPlans[month] || 0);
            const actual = Math.abs(recipient.monthlyActuals[month] || 0);
            expenses += planned !== 0 ? planned : actual;
          }
        });
      });
    });

    const openingBalance = (budget?.opening_balance as number) ?? 0;
    const annualIncome = householdMonthlyIncome * 12;

    return {
      planned: expenses,
      income: annualIncome,
      difference: openingBalance + annualIncome - expenses,
      openingBalance,
    };
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <p className="text-muted-foreground">Indlæser...</p>
        </div>
      </div>
    );
  }

  if (!budget) {
    return null;
  }

  const totals = calculateTotals();
  const recipientCount = structure?.categoryGroups.reduce((sum: number, g: any) =>
    sum + g.categories.reduce((cSum: number, c: any) => cSum + c.recipients.length, 0), 0) || 0;

  const hasFixedExpenses = recipientCount > 0;
  const hasIncome = totals.income > 0;
  const hasOpeningBalance = totals.openingBalance !== 0;
  const hasImportedTransactions = !!(structure?.categoryGroups.some((g: any) =>
    g.categories.some((c: any) =>
      c.recipients.some((r: any) =>
        Object.values(r.monthlyActuals).some((v: any) => v !== 0)
      )
    )
  ));
  const hasVariableBudget = !!(budget as any)?.has_variable_budget;
  const onboardingDismissed = !!(budget as any)?.onboarding_dismissed;

  const onboarding = computeOnboardingState({
    hasIncome,
    hasFixedExpenses,
    hasVariableBudget,
    hasStartBalance: hasOpeningBalance,
    onboardingDismissed,
  });

  const { steps: setupSteps, completionScore: setupProgress, nextStep, isComplete: isFullySetup } = onboarding;
  const completedSteps = setupSteps.filter(s => s.done).length;

  async function handleDismissOnboarding() {
    try {
      await supabase
        .from('budgets')
        .update({ onboarding_dismissed: true, updated_at: new Date().toISOString() } as any)
        .eq('id', budgetId);
      setBudget(prev => prev ? { ...prev, onboarding_dismissed: true } as any : prev);
    } catch {
      toast.error('Kunne ikke gemme');
    }
  }

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">{budget.name}</h1>
          <p className="text-muted-foreground mt-1 text-base">
            {isFullySetup ? 'Dit samlede overblik er klar.' : 'Din plan bygges op trin for trin.'}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <Card className="shadow-xl border-0 rounded-3xl card-hover overflow-hidden">
            <div className="h-2" style={{ background: `linear-gradient(to right, ${design.card1GradientFrom}, ${design.card1GradientTo})` }} />
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" style={{ color: design.card1GradientFrom }} />
                Udgifter
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasFixedExpenses ? (
                <>
                  <div className="text-3xl font-bold tracking-tight" style={{ color: design.card1GradientFrom }}>
                    {fc(-totals.planned)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{recipientCount} modtagere</p>
                </>
              ) : (
                <>
                  <div className="text-lg font-semibold text-muted-foreground/50 mt-1">Ikke oprettet</div>
                  <button
                    onClick={() => setShowFixedExpensesWizard(true)}
                    className="text-sm mt-2 font-medium underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Tilføj faste udgifter
                  </button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-xl border-0 rounded-3xl card-hover overflow-hidden">
            <div className="h-2" style={{ background: `linear-gradient(to right, ${design.card2GradientFrom}, ${design.card2GradientTo})` }} />
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" style={{ color: design.card2GradientFrom }} />
                Indtægter
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasIncome ? (
                <>
                  <div className="text-3xl font-bold tracking-tight" style={{ color: design.card2GradientFrom }}>
                    {fc(totals.income)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Modtagne indtægter</p>
                </>
              ) : (
                <>
                  <div className="text-lg font-semibold text-muted-foreground/50 mt-1">Tilføj din løn</div>
                  <button
                    onClick={() => router.push(`/budgets/${budgetId}/details`)}
                    className="text-sm mt-2 font-medium underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Tilføj indtægt
                  </button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-xl border-0 rounded-3xl card-hover overflow-hidden group">
            <div className="h-2" style={{ background: 'linear-gradient(to right, #f59e0b, #fbbf24)' }} />
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-amber-500" />
                  Start saldo
                </span>
                {hasOpeningBalance && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setOpeningBalanceInput(String(totals.openingBalance));
                      setEditingOpeningBalance(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasOpeningBalance ? (
                <>
                  <div className="text-3xl font-bold tracking-tight text-amber-600">
                    {fc(totals.openingBalance)}
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
            </CardContent>
          </Card>

          <Card className="shadow-xl border-0 rounded-3xl card-hover overflow-hidden">
            <div className="h-2" style={{ background: `linear-gradient(to right, ${design.card3GradientFrom}, ${design.card3GradientTo})` }} />
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                {totals.difference >= 0
                  ? <TrendingUp className="h-4 w-4" style={{ color: design.card3GradientFrom }} />
                  : <TrendingDown className="h-4 w-4" style={{ color: design.card3GradientFrom }} />}
                Slutsaldo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(hasFixedExpenses || hasIncome) ? (
                <>
                  <div className="text-3xl font-bold tracking-tight" style={{ color: design.card3GradientFrom }}>
                    {fc(totals.difference)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {totals.difference >= 0 ? 'Disponibel' : 'Underskud'}
                    {totals.openingBalance !== 0 && (
                      <span className="text-xs ml-1">(inkl. start saldo)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">Dit faktiske rådighedsbeløb</p>
                </>
              ) : (
                <>
                  <div className="text-lg font-semibold text-muted-foreground/50 mt-1">Beregnes automatisk</div>
                  <p className="text-xs text-muted-foreground/50 mt-2">Når udgifter og indtægter er tilføjet</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card className="shadow-xl border-0 rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">Udgiftsfordeling</CardTitle>
              <p className="text-sm text-muted-foreground">Fordeling efter kategori</p>
            </CardHeader>
            <CardContent>
              {(() => {
                const categoryExpenses: Record<string, { name: string; value: number; color: string }> = {};
                const colors = [
                  '#3b82f6',
                  '#8b5cf6',
                  '#14b8a6',
                  '#f59e0b',
                  '#ec4899',
                  '#10b981',
                  '#6366f1',
                  '#f97316',
                ];

                if (structure) {
                  structure.categoryGroups.forEach((group: any, index: number) => {
                    if (!group.is_income) {
                      let groupTotal = 0;
                      group.categories.forEach((category: any) => {
                        category.recipients.forEach((recipient: any) => {
                          for (let month = 1; month <= 12; month++) {
                            const planned = Math.abs(recipient.monthlyPlans[month] || 0);
                            const actual = Math.abs(recipient.monthlyActuals[month] || 0);
                            groupTotal += planned !== 0 ? planned : actual;
                          }
                        });
                      });

                      if (groupTotal > 0) {
                        categoryExpenses[group.id] = {
                          name: group.name,
                          value: groupTotal,
                          color: colors[index % colors.length],
                        };
                      }
                    }
                  });
                }

                const pieData = Object.values(categoryExpenses);

                return pieData.length > 0 ? (
                  <div className="space-y-4">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => fc(value)}
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      {pieData.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{entry.name}</div>
                            <div className="text-xs text-muted-foreground">{fc(entry.value)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    Ingen udgifter at vise
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <Card className="shadow-xl border-0 rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">Månedlige udgifter</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const monthlyExpenses: Record<number, number> = {};
                for (let month = 1; month <= 12; month++) {
                  monthlyExpenses[month] = 0;
                }

                if (structure) {
                  structure.categoryGroups.forEach((group: any) => {
                    if (!group.is_income) {
                      group.categories.forEach((category: any) => {
                        category.recipients.forEach((recipient: any) => {
                          for (let month = 1; month <= 12; month++) {
                            const planned = Math.abs(recipient.monthlyPlans[month] || 0);
                            const actual = Math.abs(recipient.monthlyActuals[month] || 0);
                            monthlyExpenses[month] += planned !== 0 ? planned : actual;
                          }
                        });
                      });
                    }
                  });
                }

                const maxExpense = Math.max(...Object.values(monthlyExpenses), 1);
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

                const monthlyAvg = totals.planned / 12;
                const monthlyIncome = totals.income / 12;
                const monthlyBalance = monthlyIncome - monthlyAvg;
                const isBalanced = monthlyBalance >= 0;

                return (
                  <div className="space-y-6">
                    <div className="flex items-end justify-between gap-2 h-48">
                      {monthNames.map((monthName, index) => {
                        const month = index + 1;
                        const expense = monthlyExpenses[month];
                        const heightPercent = maxExpense > 0 ? (expense / maxExpense) * 100 : 0;

                        return (
                          <div key={month} className="flex-1 flex flex-col items-center gap-2 h-full">
                            <div className="flex-1 w-full flex items-end justify-center">
                              {expense > 0 && (
                                <div
                                  className="w-full rounded-t-lg transition-all duration-300 hover:opacity-80 cursor-pointer relative group"
                                  style={{ height: `${heightPercent}%`, background: `linear-gradient(to top, ${design.gradientFrom}, ${design.gradientTo})` }}
                                >
                                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs py-1 px-2 rounded whitespace-nowrap">
                                    {fc(expense)}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="text-xs font-medium text-muted-foreground">{monthName}</div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t pt-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Månedlig overførsel til opsparingskonto</p>
                          <div className="text-3xl font-bold tracking-tight" style={{ color: design.card1GradientFrom }}>
                            {fc(monthlyAvg)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Samlede udgifter / 12 måneder</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground mb-1">Månedlig balance</p>
                          <div
                            className="text-3xl font-bold tracking-tight flex items-center justify-end gap-2"
                            style={{ color: isBalanced ? design.card3GradientFrom : design.card1GradientFrom }}
                          >
                            {isBalanced
                              ? <TrendingUp className="h-6 w-6" style={{ color: design.card3GradientFrom }} />
                              : <TrendingDown className="h-6 w-6" style={{ color: design.card1GradientFrom }} />}
                            {fc(Math.abs(monthlyBalance))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {isBalanced ? 'Overskud pr. måned' : 'Underskud pr. måned'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-3 mb-8 flex-wrap">
          <Button size="lg" onClick={() => router.push(`/budgets/${budgetId}/details`)}>
            <FileText className="mr-2 h-5 w-5" />
            Faste udgifter
          </Button>
          {hasImportedTransactions && (
            <Button size="lg" variant="outline" onClick={() => router.push(`/budgets/${budgetId}/transactions`)}>
              <FileText className="mr-2 h-5 w-5" />
              Se posteringer
            </Button>
          )}
          <Button size="lg" variant="outline" onClick={() => router.push(`/budgets/${budgetId}/import`)}>
            <Upload className="mr-2 h-5 w-5" />
            Importer posteringer
          </Button>
        </div>

        {hasImportedTransactions && <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-2xl">Oversigt over faste udgifter</CardTitle>
          </CardHeader>
          <CardContent>
            {structure && structure.categoryGroups.length > 0 ? (
              <div className="space-y-6">
                {[...structure.categoryGroups].sort((a: any, b: any) => {
                  const aIncome = a.categories.some((c: any) =>
                    c.recipients.some((r: any) =>
                      Object.values(r.monthlyActuals).some((v: any) => v > 0)));
                  const bIncome = b.categories.some((c: any) =>
                    c.recipients.some((r: any) =>
                      Object.values(r.monthlyActuals).some((v: any) => v > 0)));
                  if (aIncome && !bIncome) return -1;
                  if (!aIncome && bIncome) return 1;
                  return 0;
                }).map((group: any) => {
                  let groupExpenses = 0;
                  let groupIncome = 0;

                  group.categories.forEach((c: any) => {
                    c.recipients.forEach((r: any) => {
                      Object.values(r.monthlyActuals).forEach((v: any) => {
                        if (v > 0) {
                          groupIncome += v;
                        } else if (v < 0) {
                          groupExpenses += Math.abs(v);
                        }
                      });
                    });
                  });

                  const hasIncome = groupIncome > 0;

                  return (
                    <div key={group.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">{group.name}</h3>
                        <div className="text-right">
                          {hasIncome ? (
                            <>
                              <div className="text-sm font-medium text-green-600">
                                {fc(groupIncome)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Modtaget indtægt
                              </div>
                            </>
                          ) : (
                            <div className="text-sm font-medium">
                              {fc(-groupExpenses)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {group.categories.map((category: any) => {
                          let categoryExpenses = 0;
                          let categoryIncome = 0;

                          category.recipients.forEach((r: any) => {
                            Object.values(r.monthlyActuals).forEach((v: any) => {
                              if (v > 0) {
                                categoryIncome += v;
                              } else if (v < 0) {
                                categoryExpenses += Math.abs(v);
                              }
                            });
                          });

                          return (
                            <div
                              key={category.id}
                              className="pl-4 border-l-2 border-secondary cursor-pointer hover:bg-secondary/50 rounded-lg transition-colors p-2"
                              onClick={() => handleCategoryClick(category, group)}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">{category.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {category.recipients.length} modtager{category.recipients.length !== 1 ? 'e' : ''}
                                  </div>
                                </div>
                                <div className="text-right">
                                  {categoryIncome > 0 ? (
                                    <>
                                      <div className="text-sm text-green-600">
                                        {fc(categoryIncome)}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-sm">
                                      {fc(-categoryExpenses)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="inline-flex h-14 w-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 items-center justify-center mb-4">
                  <DollarSign className="h-7 w-7 text-amber-500" />
                </div>
                <p className="font-semibold text-base mb-1">Faste udgifter mangler</p>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                  Tilføj dine faste regninger for at få et realistisk billede af dit rådighedsbeløb.
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button onClick={() => setShowFixedExpensesWizard(true)}>
                    Tilføj faste udgifter
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={() => router.push(`/budgets/${budgetId}/import`)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Importer posteringer
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>}

        <Sheet open={categorySheetOpen} onOpenChange={setCategorySheetOpen}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>
                {selectedCategory ? `${selectedCategory.name} posteringer` : 'Posteringer'}
              </SheetTitle>
              <SheetDescription>
                {selectedCategory && (
                  <>
                    Hovedkategori: {selectedCategory.categoryGroup?.name}
                  </>
                )}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              <Button onClick={handleCreateTransactionClick} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Opret ny postering
              </Button>

              {categoryTransactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Ingen posteringer fundet for denne kategori
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dato</TableHead>
                        <TableHead>Beskrivelse</TableHead>
                        <TableHead className="text-right">Beløb</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryTransactions.map((transaction) => (
                        <TableRow
                          key={transaction.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleOpenEditTransaction(transaction)}
                        >
                          <TableCell>
                            {new Date(transaction.date).toLocaleDateString('da-DK')}
                          </TableCell>
                          <TableCell>
                            {transaction.recipient?.name || transaction.recipient_name || transaction.description}
                          </TableCell>
                          <TableCell className="text-right">
                            <Amount value={parseFloat(transaction.amount)} />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEditTransaction(transaction)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteTransaction(transaction.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <EditTransactionModal
          open={editTransactionDialogOpen}
          onOpenChange={(open) => { setEditTransactionDialogOpen(open); if (!open) setEditingTransaction(null); }}
          transaction={editingTransaction}
          categoryGroups={categoryGroups}
          onSave={handleSaveEditTransaction}
        />

        <Dialog open={editingOpeningBalance} onOpenChange={(open) => { if (!open) setEditingOpeningBalance(false); }}>
          <DialogContent>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveOpeningBalance(); }}>
              <DialogHeader>
                <DialogTitle>Rediger start saldo</DialogTitle>
                <DialogDescription>
                  Angiv saldoen på kontoen ved starten af planperioden.
                  Beløbet lægges til den beregnede slutsaldo.
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
                  <p className="text-xs text-muted-foreground">
                    Brug et negativt tal hvis kontoen starter i minus.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingOpeningBalance(false)}>
                  Annuller
                </Button>
                <Button type="submit">Gem</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={createTransactionDialogOpen} onOpenChange={setCreateTransactionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opret ny postering</DialogTitle>
              <DialogDescription>
                {selectedCategory && (
                  <>
                    Kategori: {selectedCategory.categoryGroup?.name} - {selectedCategory.name}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="transaction-description">Beskrivelse</Label>
                <Input
                  id="transaction-description"
                  value={newTransactionDescription}
                  onChange={(e) => setNewTransactionDescription(e.target.value)}
                  placeholder="F.eks. Køb hos Netto"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="transaction-amount">Beløb</Label>
                <Input
                  id="transaction-amount"
                  type="number"
                  step="0.01"
                  value={newTransactionAmount}
                  onChange={(e) => setNewTransactionAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="transaction-date">Dato</Label>
                <Input
                  id="transaction-date"
                  type="date"
                  value={newTransactionDate}
                  onChange={(e) => setNewTransactionDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateTransactionDialogOpen(false)}>
                Annuller
              </Button>
              <Button onClick={handleCreateTransaction}>Opret</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>

    {showFixedExpensesWizard && (
      <FixedExpensesWizard
        budgetId={budgetId}
        monthlyIncome={totals.income / 12}
        onComplete={() => { setShowFixedExpensesWizard(false); loadData(); }}
        onDismiss={() => setShowFixedExpensesWizard(false)}
      />
    )}

    {showVariableWizard && (
      <VariableExpenseWizard
        budgetId={budgetId}
        monthlyIncome={totals.income / 12}
        fixedExpenses={totals.planned / 12}
        onComplete={() => { setShowVariableWizard(false); loadData(); }}
        onDismiss={() => setShowVariableWizard(false)}
      />
    )}

    {showIncomeWizard && (
      <IncomeWizard
        onComplete={() => { setShowIncomeWizard(false); loadData(); }}
        onDismiss={() => setShowIncomeWizard(false)}
      />
    )}
    </>
  );
}
