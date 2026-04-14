'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBudgetsWithTransactionCounts, createBudget, deleteBudget, setActiveBudget, duplicateBudget } from '@/lib/db-helpers';
import type { Budget } from '@/lib/database.types';
import { getMonthName, getMonthOptions } from '@/lib/date-helpers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, TrendingUp, Copy, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { BudgetSetupWizard } from '@/components/budget-setup-wizard';
import { VariableForbrugWizardModal } from '@/components/variable-forbrug-wizard-modal';
import { supabase } from '@/lib/supabase';
import { EditableText } from '@/components/editable-text';

interface BudgetWithCount extends Budget {
  transaction_count: number;
}

export default function BudgetsPage() {
  const router = useRouter();
  const [budgets, setBudgets] = useState<BudgetWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [showVariableWizard, setShowVariableWizard] = useState(false);
  const [householdAdults, setHouseholdAdults] = useState(1);
  const [householdIncome, setHouseholdIncome] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicatingBudget, setDuplicatingBudget] = useState<BudgetWithCount | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    year: new Date().getFullYear(),
    start_month: 1,
    end_month: 12,
  });
  const [dupFormData, setDupFormData] = useState({
    name: '',
    year: new Date().getFullYear() + 1,
  });
  const [errors, setErrors] = useState({
    year: '',
    months: '',
  });

  const monthOptions = getMonthOptions();

  useEffect(() => {
    loadBudgets();
    loadHousehold();
  }, []);

  async function loadHousehold() {
    const { data } = await supabase
      .from('household')
      .select('adult_count, members')
      .maybeSingle();

    if (data) {
      setHouseholdAdults(data.adult_count ?? 1);
      const members: any[] = data.members ?? [];
      const totalIncome = members.reduce((sum: number, m: any) => sum + (m.monthly_net_salary ?? 0), 0);
      setHouseholdIncome(totalIncome);
    }
  }

  async function loadBudgets() {
    try {
      const data = await getBudgetsWithTransactionCounts();
      const list = (data || []) as BudgetWithCount[];
      setBudgets(list);
      if (list.length === 0) {
        setShowWizard(true);
      }
    } catch {
      toast.error('Kunne ikke indlæse budgetter');
    } finally {
      setLoading(false);
    }
  }

  function validateForm() {
    const newErrors = { year: '', months: '' };
    let isValid = true;

    if (formData.year < 1000 || formData.year > 9999) {
      newErrors.year = 'År skal være 4 cifre';
      isValid = false;
    }

    if (formData.start_month > formData.end_month) {
      newErrors.months = 'Start måned skal være før slut måned';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  }

  async function handleCreateBudget(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const budget = await createBudget(formData);
      setDialogOpen(false);
      setFormData({
        name: '',
        year: new Date().getFullYear(),
        start_month: 1,
        end_month: 12,
      });
      setErrors({ year: '', months: '' });
      toast.success('Budget oprettet');
      router.push(`/budgets/${budget.id}`);
    } catch {
      toast.error('Kunne ikke oprette budget');
    }
  }

  async function handleDeleteBudget(id: string, name: string) {
    if (!confirm(`Er du sikker? Dette sletter også alle posteringer og budgetlinjer for "${name}".`)) {
      return;
    }
    try {
      await deleteBudget(id);
      setBudgets(budgets.filter(b => b.id !== id));
      toast.success('Budget slettet');
    } catch {
      toast.error('Kunne ikke slette budget');
    }
  }

  async function handleSetActive(budget: BudgetWithCount) {
    if (budget.is_active) return;
    try {
      await setActiveBudget(budget.id);
      setBudgets(prev => prev.map(b => ({ ...b, is_active: b.id === budget.id })));
      toast.success(`"${budget.name}" er nu aktivt dashboard-budget`);
    } catch {
      toast.error('Kunne ikke sætte aktivt budget');
    }
  }

  function openDuplicateDialog(budget: BudgetWithCount, e: React.MouseEvent) {
    e.stopPropagation();
    setDuplicatingBudget(budget);
    setDupFormData({
      name: `${budget.name} (kopi)`,
      year: budget.year + 1,
    });
    setDuplicateDialogOpen(true);
  }

  async function handleDuplicate(e: React.FormEvent) {
    e.preventDefault();
    if (!duplicatingBudget) return;
    if (!dupFormData.name.trim()) return;

    setDuplicating(true);
    try {
      const newBudget = await duplicateBudget(duplicatingBudget.id, dupFormData.name.trim(), dupFormData.year);
      setDuplicateDialogOpen(false);
      setDuplicatingBudget(null);
      toast.success('Budget duplikeret');
      router.push(`/budgets/${newBudget.id}`);
    } catch {
      toast.error('Kunne ikke duplikere budget');
    } finally {
      setDuplicating(false);
    }
  }

  if (showWizard) {
    return (
      <BudgetSetupWizard
        adults={householdAdults}
        monthlyIncome={householdIncome}
        onComplete={() => {
          setShowWizard(false);
          loadBudgets();
        }}
        onStartVariableWizard={() => {
          setShowWizard(false);
          setShowVariableWizard(true);
          loadBudgets();
        }}
      />
    );
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              <EditableText textKey="budgets.page.title" fallback="Faste udgifter" as="span" />
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              <EditableText textKey="budgets.page.subtitle" fallback="Administrer og følg dine faste udgifter" as="span" />
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="mr-2 h-5 w-5" />
                Opret plan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateBudget}>
                <DialogHeader>
                  <DialogTitle>Opret ny plan</DialogTitle>
                  <DialogDescription>
                    Opret en ny plan for at begynde at spore dine indtægter og udgifter
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Navn</Label>
                    <Input
                      id="name"
                      placeholder="Husholdningsplan 2026"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="year">År</Label>
                    <Input
                      id="year"
                      type="number"
                      min="1000"
                      max="9999"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                      required
                    />
                    {errors.year && (
                      <p className="text-sm text-red-600">{errors.year}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="start_month">Start måned</Label>
                      <Select
                        value={formData.start_month.toString()}
                        onValueChange={(value) => setFormData({ ...formData, start_month: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {monthOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value.toString()}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="end_month">Slut måned</Label>
                      <Select
                        value={formData.end_month.toString()}
                        onValueChange={(value) => setFormData({ ...formData, end_month: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {monthOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value.toString()}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {errors.months && (
                    <p className="text-sm text-red-600">{errors.months}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit">Opret plan</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {budgets.length === 0 ? (
          <Card className="shadow-2xl border-0 rounded-3xl overflow-hidden">
            <div className="h-1.5 gradient-card" />
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-3xl gradient-card flex items-center justify-center mb-6">
                <TrendingUp className="h-10 w-10 text-white" />
              </div>
              <p className="text-2xl font-bold mb-2">Ingen planer endnu</p>
              <p className="text-muted-foreground mb-2 max-w-md">
                Lad os hjælpe dig i gang. Det tager under 2 minutter.
              </p>
              <p className="text-sm text-muted-foreground mb-8 max-w-sm">
                Vi guider dig trin for trin, forudfylder hvad vi kan, og du justerer det der ikke passer.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" className="rounded-2xl" onClick={() => setShowWizard(true)}>
                  Kom i gang med en guide
                  <TrendingUp className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="rounded-2xl" onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Opret selv
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Alle planer</h2>
              <p className="text-muted-foreground">{budgets.length} plan{budgets.length !== 1 ? 'er' : ''}</p>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Klik på fluebenet for at vælge hvilken plan der vises i dashboards.
            </p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {budgets.map((budget) => (
                <Card
                  key={budget.id}
                  className={`shadow-xl border-0 rounded-3xl card-hover cursor-pointer group overflow-hidden transition-all ${budget.is_active ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => router.push(`/budgets/${budget.id}`)}
                >
                  <div className="h-2 gradient-card" />
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-xl group-hover:text-primary transition-colors truncate">
                            {budget.name}
                          </CardTitle>
                          {budget.is_active && (
                            <span className="shrink-0 text-xs font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                              Aktiv
                            </span>
                          )}
                        </div>
                        <CardDescription className="mt-1 text-base">
                          {budget.year}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Duplikér plan"
                          onClick={(e) => openDuplicateDialog(budget, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title={budget.is_active ? 'Aktiv dashboard-plan' : 'Sæt som aktiv dashboard-plan'}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetActive(budget);
                          }}
                          className={`h-8 w-8 transition-opacity ${budget.is_active ? 'text-primary' : 'opacity-0 group-hover:opacity-100'}`}
                        >
                          {budget.is_active ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Circle className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Slet plan"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBudget(budget.id, budget.name);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                        <span className="text-sm font-medium text-muted-foreground">Periode</span>
                        <span className="text-sm font-semibold">
                          {getMonthName(budget.start_month)} - {getMonthName(budget.end_month)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                        <span className="text-sm font-medium text-muted-foreground">Posteringer</span>
                        <span className="text-sm font-semibold">{budget.transaction_count}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <form onSubmit={handleDuplicate}>
            <DialogHeader>
              <DialogTitle>Duplikér plan</DialogTitle>
              <DialogDescription>
                Opretter en ny plan med samme linjer som &quot;{duplicatingBudget?.name}&quot;. Posteringer kopieres ikke.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="dup-name">Nyt navn</Label>
                <Input
                  id="dup-name"
                  value={dupFormData.name}
                  onChange={(e) => setDupFormData({ ...dupFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dup-year">År</Label>
                <Input
                  id="dup-year"
                  type="number"
                  min="1000"
                  max="9999"
                  value={dupFormData.year}
                  onChange={(e) => setDupFormData({ ...dupFormData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
                Annuller
              </Button>
              <Button type="submit" disabled={duplicating}>
                {duplicating ? 'Duplikerer...' : 'Duplikér'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {showVariableWizard && (
        <VariableForbrugWizardModal
          onComplete={() => {
            setShowVariableWizard(false);
            router.push('/');
          }}
          onDismiss={() => {
            setShowVariableWizard(false);
            router.push('/');
          }}
        />
      )}
    </div>
  );
}
