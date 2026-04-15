'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getBudgetById, getBudgetStructure, upsertBudgetPlan, updateRecipient, findOrCreateRecipient, getCategoryGroups } from '@/lib/db-helpers';
import { supabase } from '@/lib/supabase';
import type { Budget, CategoryGroup } from '@/lib/database.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, ChevronDown, ChevronRight, Copy, AlertCircle, Plus, Settings2, LayoutList, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/number-helpers';
import { useSettings } from '@/lib/settings-context';
import { CategoryGroupManagerDialog } from '@/components/category-group-manager-dialog';
import { useAdminLabel } from '@/components/admin-page-label';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

interface RecipientData {
  id: string;
  name: string;
  default_category_id: string | null;
  monthlyPlans: Record<number, number>;
  monthlyActuals: Record<number, number>;
  hasMixedCategories: boolean;
}

interface CategoryData {
  id: string;
  name: string;
  recipients: RecipientData[];
}

interface CategoryGroupData {
  id: string;
  name: string;
  is_income: boolean;
  categories: CategoryData[];
}

interface BudgetStructure {
  categoryGroups: CategoryGroupData[];
}

export default function BudgetDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const budgetId = params.id as string;

  const { settings } = useSettings();
  const { setDataTypes } = useAdminLabel();
  const [budget, setBudget] = useState<Budget | null>(null);
  const [structure, setStructure] = useState<BudgetStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const d = settings.hideDecimals ? 0 : 2;
  const fc = (v: number) => formatCurrency(v, { roundToHundreds: settings.roundToHundreds, decimals: d });
  const fp = (v: number) => formatCurrency(v, { roundToHundreds: settings.roundToHundreds, decimals: d, style: 'plain' });
  const colorClass = (v: number, isExpense?: boolean) => {
    if (!settings.colorizeAmounts || v === 0) return '';
    if (isExpense) return 'text-rose-600 dark:text-rose-400';
    return v > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  };

  const totalColBase = 'sticky right-0 z-20 bg-slate-50 dark:bg-slate-900/95 min-w-[140px]';
  const [editingCell, setEditingCell] = useState<{
    type: 'recipient' | 'group';
    id: string;
    month: number
  } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [tableView, setTableView] = useState<'simple' | 'advanced'>('simple');
  const [createLineDialogOpen, setCreateLineDialogOpen] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [householdMonthlyIncome, setHouseholdMonthlyIncome] = useState(0);
  const [newRecipientName, setNewRecipientName] = useState('');
  const [selectedCategoryGroupId, setSelectedCategoryGroupId] = useState<string>('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));

  useEffect(() => {
    loadData();
    loadFormData();
  }, [budgetId]);

  async function loadData() {
    try {
      const [budgetData, structureData, householdResult] = await Promise.all([
        getBudgetById(budgetId),
        getBudgetStructure(budgetId),
        supabase.from('household').select('members').maybeSingle(),
      ]);

      if (!budgetData) {
        toast.error('Budget ikke fundet');
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

      const allGroups = new Set<string>(structureData?.categoryGroups.map((g: any) => g.id as string) || []);
      setExpandedGroups(allGroups);

      const members: Array<{ type: string; monthly_net_salary: number | null }> =
        (householdResult.data?.members as any[]) ?? [];
      const monthlyIncome = members
        .filter(m => m.type === 'adult')
        .reduce((s, m) => s + (m.monthly_net_salary ?? 0), 0);
      setHouseholdMonthlyIncome(monthlyIncome);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Kunne ikke indlæse data');
    } finally {
      setLoading(false);
    }
  }

  async function loadFormData() {
    try {
      const groupsData = await getCategoryGroups();
      setCategoryGroups(groupsData || []);
    } catch (error) {
      console.error('Error loading form data:', error);
    }
  }

  async function handleSaveCell(recipientId: string, month: number, value: string) {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      toast.error('Ugyldig beløb');
      return;
    }

    try {
      await upsertBudgetPlan({
        budget_id: budgetId,
        recipient_id: recipientId,
        month,
        amount_planned: numValue,
      });

      await loadData();
      toast.success('Planlagt beløb gemt');
    } catch (error) {
      console.error('Error saving budget plan:', error);
      toast.error('Kunne ikke gemme');
    }
  }

  async function handleSaveGroupTotal(groupId: string, month: number, newTotal: number) {
    const group = structure?.categoryGroups.find(g => g.id === groupId);
    if (!group) return;

    const allRecipients = group.categories.flatMap(c => c.recipients).filter(r => !r.id.startsWith('no-recipient-'));
    if (allRecipients.length === 0) {
      toast.error('Ingen gyldige modtagere at fordele budget til');
      return;
    }

    const currentTotal = allRecipients.reduce((sum, r) => sum + (r.monthlyPlans[month] || 0), 0);

    if (currentTotal === 0 && newTotal !== 0) {
      const amountPerRecipient = newTotal / allRecipients.length;
      try {
        for (const recipient of allRecipients) {
          await upsertBudgetPlan({
            budget_id: budgetId,
            recipient_id: recipient.id,
            month,
            amount_planned: amountPerRecipient,
          });
        }
        await loadData();
        toast.success('Gruppe total opdateret');
      } catch (error) {
        console.error('Error updating group total:', error);
        toast.error('Kunne ikke opdatere gruppe total');
      }
    } else if (currentTotal !== 0) {
      const ratio = newTotal / currentTotal;
      try {
        for (const recipient of allRecipients) {
          const currentAmount = recipient.monthlyPlans[month] || 0;
          const newAmount = currentAmount * ratio;
          await upsertBudgetPlan({
            budget_id: budgetId,
            recipient_id: recipient.id,
            month,
            amount_planned: newAmount,
          });
        }
        await loadData();
        toast.success('Gruppe total opdateret');
      } catch (error) {
        console.error('Error updating group total:', error);
        toast.error('Kunne ikke opdatere gruppe total');
      }
    }
  }

  async function handleCopyAcrossMonths(recipientId: string, sourceMonth: number) {
    const recipient = structure?.categoryGroups
      .flatMap(g => g.categories)
      .flatMap(c => c.recipients)
      .find(r => r.id === recipientId);

    if (!recipient) return;

    const sourceValue = recipient.monthlyPlans[sourceMonth] || 0;

    try {
      for (let month = sourceMonth + 1; month <= 12; month++) {
        await upsertBudgetPlan({
          budget_id: budgetId,
          recipient_id: recipientId,
          month,
          amount_planned: sourceValue,
        });
      }

      await loadData();
      toast.success('Beløb kopieret til resten af året');
    } catch (error) {
      console.error('Error copying values:', error);
      toast.error('Kunne ikke kopiere beløb');
    }
  }

  async function handleCreateManualLine() {
    if (!newRecipientName.trim()) {
      toast.error('Angiv et modtagernavn');
      return;
    }

    if (!selectedCategoryGroupId) {
      toast.error('Vælg en kategori');
      return;
    }

    try {
      const recipientId = await findOrCreateRecipient(newRecipientName.trim());

      await updateRecipient(recipientId, {
        category_group_id: selectedCategoryGroupId,
      });

      if (monthlyAmount && !isNaN(parseFloat(monthlyAmount))) {
        const amount = parseFloat(monthlyAmount);
        for (const month of Array.from(selectedMonths)) {
          await upsertBudgetPlan({
            budget_id: budgetId,
            recipient_id: recipientId,
            month,
            amount_planned: amount,
          });
        }
      }

      await loadData();
      toast.success('Linje oprettet');

      setCreateLineDialogOpen(false);
      setNewRecipientName('');
      setSelectedCategoryGroupId('');
      setMonthlyAmount('');
      setSelectedMonths(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
    } catch (error) {
      console.error('Error creating manual line:', error);
      toast.error('Kunne ikke oprette linje');
    }
  }

  function handleCellClick(type: 'recipient' | 'group', id: string, month: number, currentValue: number, isExpense?: boolean) {
    if (type === 'recipient' && id.startsWith('no-recipient-')) {
      toast.error('Tildel først en modtager til disse posteringer');
      return;
    }

    const displayValue = isExpense ? Math.abs(currentValue) : currentValue;
    setEditingCell({ type, id, month });
    setEditValue(displayValue.toString());
  }

  function handleCellBlur() {
    if (editingCell) {
      if (editingCell.type === 'recipient') {
        handleSaveCell(editingCell.id, editingCell.month, editValue);
      } else if (editingCell.type === 'group') {
        handleSaveGroupTotal(editingCell.id, editingCell.month, parseFloat(editValue) || 0);
      }
    }
    setEditingCell(null);
  }

  function toggleGroup(groupId: string) {
    const newSet = new Set(expandedGroups);
    if (newSet.has(groupId)) {
      newSet.delete(groupId);
    } else {
      newSet.add(groupId);
    }
    setExpandedGroups(newSet);
  }

  function calculateCategoryTotals(category: CategoryData) {
    const totals: Record<number, { planned: number; actual: number }> = {};
    for (let month = 1; month <= 12; month++) {
      totals[month] = { planned: 0, actual: 0 };
      category.recipients.forEach(r => {
        const planned = Math.abs(r.monthlyPlans[month] || 0);
        const actual = Math.abs(r.monthlyActuals[month] || 0);
        const displayValue = planned !== 0 ? planned : actual;
        totals[month].planned += displayValue;
        totals[month].actual += actual;
      });
    }
    return totals;
  }

  function calculateGroupTotals(group: CategoryGroupData) {
    const totals: Record<number, { planned: number; actual: number }> = {};
    for (let month = 1; month <= 12; month++) {
      totals[month] = { planned: 0, actual: 0 };
      group.categories.forEach(c => {
        const catTotals = calculateCategoryTotals(c);
        totals[month].planned += catTotals[month].planned;
        totals[month].actual += catTotals[month].actual;
      });
    }
    return totals;
  }

  function calculateGrandTotals() {
    const totals: Record<number, { planned: number; actual: number }> = {};
    for (let month = 1; month <= 12; month++) {
      totals[month] = { planned: 0, actual: 0 };
    }

    structure?.categoryGroups.forEach(g => {
      if (g.is_income) return;
      const groupTotals = calculateGroupTotals(g);
      for (let month = 1; month <= 12; month++) {
        totals[month].planned += groupTotals[month].planned;
        totals[month].actual += groupTotals[month].actual;
      }
    });

    return totals;
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

  if (!budget || !structure) {
    return null;
  }

  const grandTotals = calculateGrandTotals();

  const expenseGroups = structure.categoryGroups.filter(g => !g.is_income);

  const incomeTotals: Record<number, { planned: number; actual: number }> = {};
  for (let month = 1; month <= 12; month++) {
    incomeTotals[month] = { planned: householdMonthlyIncome, actual: householdMonthlyIncome };
  }

  function calculateSectionTotals(groups: CategoryGroupData[]) {
    const totals: Record<number, { planned: number; actual: number }> = {};
    for (let month = 1; month <= 12; month++) {
      totals[month] = { planned: 0, actual: 0 };
    }
    groups.forEach(g => {
      const gt = calculateGroupTotals(g);
      for (let month = 1; month <= 12; month++) {
        totals[month].planned += gt[month].planned;
        totals[month].actual += gt[month].actual;
      }
    });
    return totals;
  }

  const expenseTotals = calculateSectionTotals(expenseGroups);

  function renderGroupRows(groups: CategoryGroupData[]) {
    return groups.map((group, groupIndex) => {
      const groupTotals = calculateGroupTotals(group);
      const isGroupExpanded = expandedGroups.has(group.id);
      const isIncome = group.is_income;
      const isExpense = !isIncome;
      const sign = isExpense ? -1 : 1;
      const groupBg = isIncome ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : 'bg-slate-50/80 dark:bg-slate-900/30';
      const groupYearTotal = Object.values(groupTotals).reduce((sum, t) => sum + t.planned, 0);
      const isLastGroup = groupIndex === groups.length - 1;

      return (
        <React.Fragment key={group.id}>
          <TableRow className={`${groupBg} font-semibold border-t-2 ${isIncome ? 'border-emerald-200 dark:border-emerald-800' : 'border-slate-200 dark:border-slate-700'}`}>
            <TableCell className={`sticky left-0 ${groupBg} z-10 py-3`}>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleGroup(group.id)}
                  className="h-6 w-6 p-0"
                >
                  {isGroupExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
                <span className="text-base">{group.name}</span>
              </div>
            </TableCell>
            {MONTHS.map((_, idx) => {
              const month = idx + 1;

              return (
                <TableCell key={month} className="text-center p-1">
                </TableCell>
              );
            })}
            <TableCell className={`text-center font-semibold ${totalColBase}`} style={{ boxShadow: '-8px 0 24px -4px rgba(0,0,0,0.08)' }}>
            </TableCell>
          </TableRow>

          {isGroupExpanded && group.categories.flatMap(category =>
            category.recipients.map(recipient => {
              let yearTotal = 0;
              for (let month = 1; month <= 12; month++) {
                const planned = Math.abs(recipient.monthlyPlans[month] || 0);
                const actual = Math.abs(recipient.monthlyActuals[month] || 0);
                yearTotal += (planned !== 0 ? planned : actual);
              }

              return (
                <TableRow key={recipient.id} className="hover:bg-secondary/30">
                  <TableCell className="sticky left-0 bg-background z-10">
                    <div className="flex items-center gap-2 pl-10">
                      <span className="text-sm">{recipient.name}</span>
                      {recipient.hasMixedCategories && (
                        <Badge variant="outline" className="text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Blandet
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  {MONTHS.map((_, idx) => {
                    const month = idx + 1;
                    const planned = Math.abs(recipient.monthlyPlans[month] || 0);
                    const actual = Math.abs(recipient.monthlyActuals[month] || 0);
                    const displayValue = planned !== 0 ? planned : actual;
                    const isEditing = editingCell?.type === 'recipient' && editingCell?.id === recipient.id && editingCell?.month === month;
                    const isNoRecipient = recipient.id.startsWith('no-recipient-');

                    return (
                      <TableCell key={month} className={`text-center p-1 ${colorClass(displayValue, isExpense)}`}>
                        <div className="flex items-center justify-center gap-1">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellBlur}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCellBlur();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              className="w-20 h-7 text-center text-sm"
                              autoFocus
                            />
                          ) : (
                            <div
                              className={`${isNoRecipient ? 'opacity-60' : 'cursor-pointer hover:bg-secondary/50'} rounded p-1 flex-1`}
                              onClick={() => !isNoRecipient && handleCellClick('recipient', recipient.id, month, planned, isExpense)}
                            >
                              <div className="text-sm">
                                {displayValue === 0 ? '-' : fp(displayValue * sign)}
                              </div>
                            </div>
                          )}
                          {!isEditing && !isNoRecipient && planned > 0 && month < 12 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleCopyAcrossMonths(recipient.id, month)}
                              title="Kopiér til resten af året"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className={`text-center ${totalColBase} ${colorClass(yearTotal, isExpense)}`} style={{ boxShadow: '-8px 0 24px -4px rgba(0,0,0,0.08)' }}>
                    <div className="text-sm font-medium">
                      {fc(yearTotal * sign)}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}

          {isGroupExpanded && (
            <TableRow className={`${isIncome ? 'bg-emerald-100/60 dark:bg-emerald-900/30' : 'bg-slate-100/80 dark:bg-slate-800/40'} font-semibold border-b-2 ${isIncome ? 'border-emerald-200 dark:border-emerald-800' : 'border-slate-200 dark:border-slate-700'}`}>
              <TableCell className={`sticky left-0 ${isIncome ? 'bg-emerald-100/60 dark:bg-emerald-900/30' : 'bg-slate-100/80 dark:bg-slate-800/40'} z-10 pl-8 py-2`}>
                <span className="text-sm">{group.name} i alt</span>
              </TableCell>
              {MONTHS.map((_, idx) => {
                const month = idx + 1;
                const planned = groupTotals[month].planned;
                const hasValidRecipients = group.categories.flatMap(c => c.recipients).some(r => !r.id.startsWith('no-recipient-'));
                const isEditing = editingCell?.type === 'group' && editingCell?.id === group.id && editingCell?.month === month;

                return (
                  <TableCell key={month} className={`text-center p-1 ${colorClass(planned, isExpense)}`}>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCellBlur();
                          if (e.key === 'Escape') setEditingCell(null);
                        }}
                        className="w-20 h-7 text-center text-sm"
                        autoFocus
                      />
                    ) : (
                      <div
                        className={`${hasValidRecipients ? 'cursor-pointer hover:bg-secondary/50' : 'opacity-60'} rounded p-1 text-sm font-semibold`}
                        onClick={() => {
                          if (hasValidRecipients) {
                            handleCellClick('group', group.id, month, planned, isExpense);
                          } else {
                            toast.error('Opret først modtagere i denne kategori ved at klikke på "Opret linje"');
                          }
                        }}
                      >
                        {planned === 0 ? '-' : fp(planned * sign)}
                      </div>
                    )}
                  </TableCell>
                );
              })}
              <TableCell className={`text-center font-semibold ${totalColBase} ${colorClass(groupYearTotal, isExpense)}`} style={{ boxShadow: '-8px 0 24px -4px rgba(0,0,0,0.08)' }}>
                <div className="text-sm">
                  {fc(groupYearTotal * sign)}
                </div>
              </TableCell>
            </TableRow>
          )}

          {isGroupExpanded && !isLastGroup && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={MONTHS.length + 1} className="h-6 bg-muted/20 border-y border-border/30 p-0" />
              <TableCell className={`h-6 p-0 ${totalColBase}`} style={{ boxShadow: '-8px 0 24px -4px rgba(0,0,0,0.08)' }} />
            </TableRow>
          )}
        </React.Fragment>
      );
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/budgets/${budgetId}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tilbage
            </Button>
          </div>

          <div className="flex items-center gap-4 mb-2 flex-wrap">
            <h1 className="text-4xl font-bold tracking-tight">Faste udgifter</h1>
            <Button onClick={() => setCreateLineDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Opret linje
            </Button>
            <Button variant="outline" onClick={() => setCategoryManagerOpen(true)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Administrer kategorier
            </Button>
          </div>
          <p className="text-muted-foreground text-lg mb-4">{budget.name} - {budget.year}</p>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
              Her kan du se og justere hvad du har planlagt at bruge i faste udgifter hver måned.
            </p>
            <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1 shrink-0">
              <button
                onClick={() => setTableView('simple')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tableView === 'simple' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <LayoutList className="h-3.5 w-3.5" />
                Simpel visning
              </button>
              <button
                onClick={() => setTableView('advanced')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tableView === 'advanced' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Table2 className="h-3.5 w-3.5" />
                Avanceret
              </button>
            </div>
          </div>
        </div>

        <Card className="shadow-xl border-0 rounded-3xl">
          <CardHeader>
            <CardTitle>{tableView === 'simple' ? 'Overblik pr. kategori' : 'Budget organiseret efter modtager'}</CardTitle>
            <CardDescription>
              {tableView === 'simple'
                ? 'Månedlige totaler pr. kategorigruppe. Skift til Avanceret for at se og redigere individuelle poster.'
                : 'Klik på en celle for at redigere beløb (gruppe eller modtager) • Når du ændrer en gruppe-total, fordeles ændringen proportionelt på underliggende poster • Klik på kopiér-ikonet for at kopiere til resten af året'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tableView === 'simple' && (
              <div className="overflow-x-auto relative">
                <Table className="border-separate border-spacing-0">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-bold min-w-[220px] sticky left-0 bg-background z-10">Kategori</TableHead>
                      {MONTHS.map((month, idx) => (
                        <TableHead key={idx} className="text-center min-w-[90px]">{month}</TableHead>
                      ))}
                      <TableHead className={`text-center font-bold ${totalColBase} rounded-tr-2xl border-b border-slate-200 dark:border-slate-700`} style={{ boxShadow: '-8px 0 24px -4px rgba(0,0,0,0.08)' }}>
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseGroups.map(group => {
                      const gt = calculateGroupTotals(group);
                      const yearTotal = Object.values(gt).reduce((s, t) => s + t.planned, 0);
                      return (
                        <TableRow key={group.id} className="hover:bg-rose-50/30 dark:hover:bg-rose-950/20">
                          <TableCell className="sticky left-0 bg-background z-10 font-medium">{group.name}</TableCell>
                          {MONTHS.map((_, idx) => {
                            const month = idx + 1;
                            return (
                              <TableCell key={month} className="text-center text-sm text-rose-600 dark:text-rose-400">
                                {gt[month].planned === 0 ? <span className="text-muted-foreground/40">-</span> : fp(-gt[month].planned)}
                              </TableCell>
                            );
                          })}
                          <TableCell className={`text-center font-semibold text-rose-600 dark:text-rose-400 ${totalColBase}`} style={{ boxShadow: '-8px 0 24px -4px rgba(0,0,0,0.08)' }}>
                            {fc(-yearTotal)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {expenseGroups.length > 0 && (
                      <TableRow className="bg-rose-50 dark:bg-rose-950/30 font-bold">
                        <TableCell className="sticky left-0 bg-rose-50 dark:bg-rose-950/30 z-10 text-rose-700 dark:text-rose-400">Udgifter i alt</TableCell>
                        {MONTHS.map((_, idx) => {
                          const month = idx + 1;
                          return (
                            <TableCell key={month} className="text-center text-sm font-bold text-rose-700 dark:text-rose-400">
                              {fp(-expenseTotals[month].planned)}
                            </TableCell>
                          );
                        })}
                        <TableCell className={`text-center font-bold text-rose-700 dark:text-rose-400 ${totalColBase}`} style={{ boxShadow: '-8px 0 24px -4px rgba(0,0,0,0.08)' }}>
                          {fc(-Object.values(expenseTotals).reduce((s, t) => s + t.planned, 0))}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
            {tableView === 'advanced' && (
            <div className="overflow-x-auto relative">
              <Table className="border-separate border-spacing-0">
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold min-w-[300px] sticky left-0 bg-background z-10">
                      Modtager
                    </TableHead>
                    {MONTHS.map((month, idx) => (
                      <TableHead key={idx} className="text-center min-w-[100px]">
                        {month}
                      </TableHead>
                    ))}
                    <TableHead
                      className={`text-center font-bold ${totalColBase} rounded-tr-2xl border-b border-slate-200 dark:border-slate-700`}
                      style={{ boxShadow: '-8px 0 24px -4px rgba(0,0,0,0.08)' }}
                    >
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderGroupRows(expenseGroups)}

                  {expenseGroups.length > 0 && (
                    <TableRow className="bg-rose-50 dark:bg-rose-950/30 font-bold">
                      <TableCell className="sticky left-0 bg-rose-50 dark:bg-rose-950/30 z-10 text-rose-700 dark:text-rose-400">
                        UDGIFTER I ALT
                      </TableCell>
                      {MONTHS.map((_, idx) => {
                        const month = idx + 1;
                        return (
                          <TableCell key={month} className="text-center text-rose-700 dark:text-rose-400">
                            <div className="text-sm font-bold">
                              {fp(-expenseTotals[month].planned)}
                            </div>
                          </TableCell>
                        );
                      })}
                      <TableCell className={`text-center text-rose-700 dark:text-rose-400 font-bold ${totalColBase}`} style={{ boxShadow: '-8px 0 24px -4px rgba(0,0,0,0.08)' }}>
                        <div className="text-sm">
                          {fc(-Object.values(expenseTotals).reduce((sum, t) => sum + t.planned, 0))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                </TableBody>
              </Table>
            </div>
            )}

            {tableView === 'advanced' && structure.categoryGroups.length === 0 && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium">Ingen modtagere fundet i denne plan.</p>
                  <p className="text-sm mt-2">
                    Importer posteringer med modtagernavne for at oprette planlinjer.
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <CategoryGroupManagerDialog
          open={categoryManagerOpen}
          onOpenChange={setCategoryManagerOpen}
          onChanged={() => { loadData(); loadFormData(); }}
        />

        <Dialog open={createLineDialogOpen} onOpenChange={setCreateLineDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opret ny linje</DialogTitle>
              <DialogDescription>
                Opret en ny modtager og tilføj til planen
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="recipient-name">Modtagernavn</Label>
                <Input
                  id="recipient-name"
                  value={newRecipientName}
                  onChange={(e) => setNewRecipientName(e.target.value)}
                  placeholder="F.eks. Netflix"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="category-group">Kategori</Label>
                <Select
                  value={selectedCategoryGroupId}
                  onValueChange={setSelectedCategoryGroupId}
                >
                  <SelectTrigger id="category-group">
                    <SelectValue placeholder="Vælg kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryGroups.filter(g => !g.is_income).map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="monthly-amount">Månedligt beløb (valgfri)</Label>
                <Input
                  id="monthly-amount"
                  type="number"
                  value={monthlyAmount}
                  onChange={(e) => setMonthlyAmount(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <Label>Vælg måneder</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedMonths(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))}
                    >
                      Alle
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedMonths(new Set())}
                    >
                      Ingen
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {MONTHS.map((monthName, idx) => {
                    const month = idx + 1;
                    const isChecked = selectedMonths.has(month);
                    return (
                      <div key={month} className="flex items-center space-x-2">
                        <Checkbox
                          id={`month-${month}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedMonths);
                            if (checked) {
                              newSet.add(month);
                            } else {
                              newSet.delete(month);
                            }
                            setSelectedMonths(newSet);
                          }}
                        />
                        <Label
                          htmlFor={`month-${month}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {monthName}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateLineDialogOpen(false)}>
                Annuller
              </Button>
              <Button onClick={handleCreateManualLine}>Opret</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
