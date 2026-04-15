'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { getBudgetById, getTransactions, getCategoryGroups, updateTransaction, deleteTransaction, deleteMultipleTransactions, findOrCreateCategoryGroup, findOrCreateRecipient, upsertBudgetPlan } from '@/lib/db-helpers';
import type { Budget, CategoryGroup, TransactionWithDetails } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Trash2, ChevronLeft, Filter, Search, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/number-helpers';
import { useSettings } from '@/lib/settings-context';
import { cn } from '@/lib/utils';
import { EditTransactionModal } from '@/components/edit-transaction-modal';

export default function TransactionsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const budgetId = params.id as string;
  const { settings } = useSettings();
  const d = settings.hideDecimals ? 0 : 2;
  const fc = (v: number) => formatCurrency(v, { roundToHundreds: settings.roundToHundreds, decimals: d });

  const [budget, setBudget] = useState<Budget | null>(null);
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithDetails | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [showUncategorized, setShowUncategorized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryGroupId, setSelectedCategoryGroupId] = useState<string | undefined>(undefined);
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [activeTab, setActiveTab] = useState<'unsent' | 'sent'>('sent');
  const [sendingToBudget, setSendingToBudget] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendTotal, setSendTotal] = useState(0);
  const [filterGroupId, setFilterGroupId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [budgetId]);

  async function loadData() {
    try {
      const [budgetData, transactionsData, groupsData] = await Promise.all([
        getBudgetById(budgetId),
        getTransactions(budgetId),
        getCategoryGroups(),
      ]);

      if (!budgetData) {
        toast.error('Budget ikke fundet');
        router.push('/budgets');
        return;
      }

      setBudget(budgetData);
      setTransactions(transactionsData || []);
      setCategoryGroups(groupsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Kunne ikke indlæse data');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveTransaction(
    id: string,
    updates: { date: string; recipient_name: string | null; amount: number; category_group_id: string | null }
  ) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    let recipientId: string | null = tx.recipient_id || null;

    if (updates.recipient_name && updates.recipient_name.trim()) {
      const recipientName = updates.recipient_name.trim();

      const { data: existingRecipient } = await supabase
        .from('recipients')
        .select('id, category_group_id')
        .ilike('name', recipientName)
        .maybeSingle();

      if (existingRecipient) {
        recipientId = existingRecipient.id;
        if (updates.category_group_id && updates.category_group_id !== existingRecipient.category_group_id) {
          await supabase
            .from('recipients')
            .update({ category_group_id: updates.category_group_id })
            .eq('id', recipientId);
        }
      } else {
        const newRecipient: any = { name: recipientName };
        if (updates.category_group_id) {
          newRecipient.category_group_id = updates.category_group_id;
        }
        const { data: createdRecipient, error: createError } = await supabase
          .from('recipients')
          .insert(newRecipient)
          .select('id')
          .single();
        if (createError) throw createError;
        recipientId = createdRecipient.id;
      }
    }

    await updateTransaction(id, {
      date: updates.date,
      amount: updates.amount,
      recipient_name: updates.recipient_name,
      recipient_id: recipientId,
      category_group_id: updates.category_group_id,
    });

    const { data: updatedTransaction } = await supabase
      .from('transactions')
      .select(`*, category_group:category_groups(*), recipient:recipients(*, category_group:category_groups(*))`)
      .eq('id', id)
      .maybeSingle();

    if (updatedTransaction) {
      setTransactions(prev => prev.map(t => t.id === id ? updatedTransaction : t));
    }

    toast.success('Postering opdateret');
    setModalOpen(false);
    setEditingTransaction(null);
  }

  async function handleCreateCategoryGroup() {
    if (!newGroupName.trim()) {
      toast.error('Angiv et navn');
      return;
    }

    try {
      const newGroupId = await findOrCreateCategoryGroup(newGroupName.trim());
      await loadData();
      setSelectedCategoryGroupId(newGroupId);
      setNewGroupName('');
      setCreateGroupDialogOpen(false);
      toast.success('Kategori oprettet');
    } catch (error) {
      console.error('Error creating category group:', error);
      toast.error('Kunne ikke oprette kategori');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Er du sikker på, at du vil slette denne postering?')) {
      return;
    }

    try {
      await deleteTransaction(id);
      toast.success('Postering slettet');
      await loadData();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Kunne ikke slette postering');
    }
  }

  async function handleDeleteSelected() {
    if (selectedTransactions.size === 0) {
      return;
    }

    if (!confirm(`Er du sikker på, at du vil slette ${selectedTransactions.size} posteringer?`)) {
      return;
    }

    try {
      await deleteMultipleTransactions(Array.from(selectedTransactions));
      toast.success(`${selectedTransactions.size} posteringer slettet`);
      setSelectedTransactions(new Set());
      await loadData();
    } catch (error) {
      console.error('Error deleting transactions:', error);
      toast.error('Kunne ikke slette posteringer');
    }
  }

  async function handleSendToBudget() {
    if (!budget) return;

    try {
      setSendingToBudget(true);
      setSendProgress(0);

      const transactionsToSend = selectedTransactions.size > 0
        ? Array.from(selectedTransactions)
        : transactions.filter(t => !t.sent_to_budget).map(t => t.id);

      if (transactionsToSend.length === 0) {
        toast.error('Ingen posteringer at sende');
        setSendingToBudget(false);
        return;
      }

      setSendTotal(transactionsToSend.length);
      const selectedTxs = transactions.filter(t => transactionsToSend.includes(t.id));

      for (const transaction of selectedTxs) {
        if (!transaction.recipient_id && transaction.recipient_name) {
          const recipientName = transaction.recipient_name.trim();
          let recipientId: string;

          const { data: existingRecipient } = await supabase
            .from('recipients')
            .select('id')
            .ilike('name', recipientName)
            .maybeSingle();

          if (existingRecipient) {
            recipientId = existingRecipient.id;
          } else {
            const newRecipient: any = {
              name: recipientName,
            };

            if (transaction.category_group_id) {
              newRecipient.category_group_id = transaction.category_group_id;
            }

            const { data: createdRecipient, error } = await supabase
              .from('recipients')
              .insert(newRecipient)
              .select('id')
              .single();

            if (error || !createdRecipient) {
              console.error('Error creating recipient:', error);
              continue;
            }

            recipientId = createdRecipient.id;
          }

          await supabase
            .from('transactions')
            .update({ recipient_id: recipientId })
            .eq('id', transaction.id);

          transaction.recipient_id = recipientId;
        }
      }

      const recipientMonthTotals: Record<string, number> = {};
      selectedTxs.forEach(transaction => {
        if (transaction.recipient_id && transaction.date) {
          const date = new Date(transaction.date);
          const month = date.getMonth() + 1;
          const key = `${transaction.recipient_id}_${month}`;
          const amount = parseFloat(transaction.amount.toString());
          recipientMonthTotals[key] = (recipientMonthTotals[key] || 0) + Math.abs(amount);
        }
      });

      for (const [key, totalAmount] of Object.entries(recipientMonthTotals)) {
        const [recipientId, monthStr] = key.split('_');
        const month = parseInt(monthStr);

        await upsertBudgetPlan({
          budget_id: budgetId,
          recipient_id: recipientId,
          month: month,
          amount_planned: totalAmount,
        });
      }

      const BATCH_SIZE = 50;
      const sentAt = new Date().toISOString();

      for (let i = 0; i < transactionsToSend.length; i += BATCH_SIZE) {
        const batch = transactionsToSend.slice(i, i + BATCH_SIZE);

        const updates = batch.map(txId => {
          const transaction = transactions.find(t => t.id === txId);
          if (transaction && transaction.date) {
            const txDate = new Date(transaction.date);
            const adjustedDate = new Date(budget.year, txDate.getMonth(), txDate.getDate());
            return {
              id: txId,
              sent_to_budget: true,
              sent_at: sentAt,
              date: adjustedDate.toISOString().split('T')[0]
            };
          }
          return {
            id: txId,
            sent_to_budget: true,
            sent_at: sentAt
          };
        });

        await Promise.all(
          updates.map(update =>
            supabase
              .from('transactions')
              .update({
                sent_to_budget: update.sent_to_budget,
                sent_at: update.sent_at,
                ...(update.date && { date: update.date })
              })
              .eq('id', update.id)
          )
        );

        setSendProgress(Math.min(i + BATCH_SIZE, transactionsToSend.length));
      }

      toast.success(`${transactionsToSend.length} posteringer tilføjet til planen`);
      setSelectedTransactions(new Set());
      setSendingToBudget(false);
      setSendProgress(0);
      setSendTotal(0);
      await loadData();
      router.push(`/budgets/${budgetId}`);
    } catch (error) {
      console.error('Error syncing to budget:', error);
      toast.error('Kunne ikke opdatere budget');
      setSendingToBudget(false);
      setSendProgress(0);
      setSendTotal(0);
    }
  }

  function handleOpenTransaction(transaction: TransactionWithDetails) {
    setEditingTransaction(transaction);
    setModalOpen(true);
  }

  function handleCloseModal() {
    setModalOpen(false);
    setEditingTransaction(null);
  }

  function handlePreviousTransaction() {
    if (!editingTransaction) return;
    const idx = filteredTransactions.findIndex(t => t.id === editingTransaction.id);
    if (idx > 0) handleOpenTransaction(filteredTransactions[idx - 1]);
  }

  function handleNextTransaction() {
    if (!editingTransaction) return;
    const idx = filteredTransactions.findIndex(t => t.id === editingTransaction.id);
    if (idx < filteredTransactions.length - 1) handleOpenTransaction(filteredTransactions[idx + 1]);
  }

  function toggleTransactionSelection(id: string) {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTransactions(newSelected);
  }

  function toggleSelectAll() {
    if (selectedTransactions.size === filteredTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(filteredTransactions.map(t => t.id)));
    }
  }

  const filteredTransactions = transactions.filter(transaction => {
    if (activeTab === 'unsent' && transaction.sent_to_budget) {
      return false;
    }

    if (activeTab === 'sent' && !transaction.sent_to_budget) {
      return false;
    }

    if (showUncategorized && transaction.category_group_id !== null) {
      return false;
    }

    if (filterGroupId) {
      if (transaction.category_group_id !== filterGroupId) {
        return false;
      }
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesAmount = transaction.amount.toString().includes(query);
      const matchesDate = transaction.date.includes(query);
      const matchesDescription = transaction.description?.toLowerCase().includes(query);
      const matchesGroup = transaction.category_group?.name?.toLowerCase().includes(query);
      const matchesRecipient = transaction.recipient?.name?.toLowerCase().includes(query);

      if (!matchesAmount && !matchesDate && !matchesDescription && !matchesGroup && !matchesRecipient) {
        return false;
      }
    }

    return true;
  });

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

  const expenseTransactions = filteredTransactions.filter(t => parseFloat(t.amount) < 0);
  const incomeTransactions = filteredTransactions.filter(t => parseFloat(t.amount) >= 0);

  const expenseTotal = expenseTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const incomeTotal = incomeTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const total = expenseTotal + incomeTotal;

  const currentIndex = editingTransaction
    ? filteredTransactions.findIndex(t => t.id === editingTransaction.id)
    : -1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push(`/budgets/${budgetId}`)}
            className="mb-4 -ml-2"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Tilbage til plan
          </Button>
          <h1 className="text-4xl font-bold tracking-tight">Posteringer</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            {budget.name}
          </p>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-5 top-4 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Søg efter dato, tekst, beløb, kategori..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-14 h-12"
              />
            </div>
            <Button
              size="lg"
              variant={showUncategorized ? 'default' : 'outline'}
              onClick={() => setShowUncategorized(!showUncategorized)}
            >
              <Filter className="mr-2 h-5 w-5" />
              Kun ukategoriserede
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button size="lg" variant={filterGroupId ? 'default' : 'outline'} className="min-w-[180px] justify-between">
                  <span className="truncate">
                    {filterGroupId
                      ? (categoryGroups.find(g => g.id === filterGroupId)?.name ?? 'Kategori')
                      : 'Filtrer kategori'}
                  </span>
                  {filterGroupId
                    ? <X className="ml-2 h-4 w-4 shrink-0" onClick={(e) => { e.stopPropagation(); setFilterGroupId(null); }} />
                    : <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-1">
                <div className="max-h-72 overflow-y-auto">
                  {categoryGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => setFilterGroupId(filterGroupId === group.id ? null : group.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                        filterGroupId === group.id
                          ? 'bg-primary text-primary-foreground font-medium'
                          : 'hover:bg-muted'
                      )}
                    >
                      {group.name}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-2">
            {activeTab === 'unsent' && (
              <Button size="lg" variant="default" onClick={handleSendToBudget} className="w-fit" disabled={sendingToBudget}>
                {sendingToBudget
                  ? 'Opdaterer plan...'
                  : selectedTransactions.size > 0
                  ? `Tilføj ${selectedTransactions.size} til plan`
                  : `Tilføj alle ${transactions.filter(t => !t.sent_to_budget).length} til plan`}
              </Button>
            )}
            {selectedTransactions.size > 0 && (
              <Button size="lg" variant="destructive" onClick={handleDeleteSelected} className="w-fit" disabled={sendingToBudget}>
                <Trash2 className="mr-2 h-5 w-5" />
                Slet valgte ({selectedTransactions.size})
              </Button>
            )}
          </div>

          {sendingToBudget && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Opdaterer plan med posteringer</span>
                <span className="font-medium">{sendProgress} / {sendTotal}</span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(sendProgress / sendTotal) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'unsent' | 'sent')} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="unsent">
              Ikke sendt ({transactions.filter(t => !t.sent_to_budget).length})
            </TabsTrigger>
            <TabsTrigger value="sent">
              Tilføjet til plan ({transactions.filter(t => t.sent_to_budget).length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {filteredTransactions.length === 0 ? (
              <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    {activeTab === 'unsent'
                      ? 'Ingen posteringer at sende'
                      : 'Ingen posteringer tilføjet til planen endnu'}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-2xl text-foreground">
                      Udgifter ({expenseTransactions.length})
                    </CardTitle>
                    <CardDescription className="text-base">
                      Total: {fc(expenseTotal)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {expenseTransactions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Ingen udgifter
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">
                              <Checkbox
                                checked={expenseTransactions.every(t => selectedTransactions.has(t.id))}
                                onCheckedChange={(checked) => {
                                  const newSelected = new Set(selectedTransactions);
                                  expenseTransactions.forEach(t => {
                                    if (checked) {
                                      newSelected.add(t.id);
                                    } else {
                                      newSelected.delete(t.id);
                                    }
                                  });
                                  setSelectedTransactions(newSelected);
                                }}
                              />
                            </TableHead>
                            <TableHead>Dato</TableHead>
                            <TableHead>Modtager</TableHead>
                            <TableHead>Beløb</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead className="w-24">Handlinger</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {expenseTransactions.map((transaction) => (
                            <TableRow
                              key={transaction.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleOpenTransaction(transaction)}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedTransactions.has(transaction.id)}
                                  onCheckedChange={() => toggleTransactionSelection(transaction.id)}
                                />
                              </TableCell>
                              <TableCell>
                                {new Date(transaction.date).toLocaleDateString('da-DK')}
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {transaction.recipient?.name || transaction.recipient_name || transaction.description}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {fc(parseFloat(transaction.amount))}
                              </TableCell>
                              <TableCell>
                                {transaction.category_group?.name || '-'}
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(transaction.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-2xl text-green-600">
                      Indtægter ({incomeTransactions.length})
                    </CardTitle>
                    <CardDescription className="text-base">
                      Total: {fc(incomeTotal)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {incomeTransactions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Ingen indtægter
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">
                              <Checkbox
                                checked={incomeTransactions.every(t => selectedTransactions.has(t.id))}
                                onCheckedChange={(checked) => {
                                  const newSelected = new Set(selectedTransactions);
                                  incomeTransactions.forEach(t => {
                                    if (checked) {
                                      newSelected.add(t.id);
                                    } else {
                                      newSelected.delete(t.id);
                                    }
                                  });
                                  setSelectedTransactions(newSelected);
                                }}
                              />
                            </TableHead>
                            <TableHead>Dato</TableHead>
                            <TableHead>Modtager</TableHead>
                            <TableHead>Beløb</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead className="w-24">Handlinger</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {incomeTransactions.map((transaction) => (
                            <TableRow
                              key={transaction.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleOpenTransaction(transaction)}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedTransactions.has(transaction.id)}
                                  onCheckedChange={() => toggleTransactionSelection(transaction.id)}
                                />
                              </TableCell>
                              <TableCell>
                                {new Date(transaction.date).toLocaleDateString('da-DK')}
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {transaction.recipient?.name || transaction.recipient_name || transaction.description}
                              </TableCell>
                              <TableCell className="text-green-600">
                                {fc(parseFloat(transaction.amount))}
                              </TableCell>
                              <TableCell>
                                {transaction.category_group?.name || '-'}
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(transaction.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>

      <EditTransactionModal
        open={modalOpen}
        onOpenChange={(open) => { if (!open) handleCloseModal(); }}
        transaction={editingTransaction}
        categoryGroups={categoryGroups}
        onSave={handleSaveTransaction}
        onCreateCategory={() => setCreateGroupDialogOpen(true)}
        totalCount={filteredTransactions.length}
        currentIndex={currentIndex >= 0 ? currentIndex : undefined}
        onPrevious={handlePreviousTransaction}
        onNext={handleNextTransaction}
      />

      <Dialog open={createGroupDialogOpen} onOpenChange={setCreateGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opret ny kategori</DialogTitle>
            <DialogDescription>
              Angiv navnet på den nye kategori
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="group-name">Navn</Label>
              <Input
                id="group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="F.eks. Bolig"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateCategoryGroup();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateGroupDialogOpen(false)}>
              Annuller
            </Button>
            <Button onClick={handleCreateCategoryGroup}>Opret</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
