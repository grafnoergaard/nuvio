'use client';

import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Tag, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/number-helpers';
import { useSettings } from '@/lib/settings-context';
import { getCategoryGroups, findOrCreateCategoryGroup } from '@/lib/db-helpers';
import type { CategoryGroup } from '@/lib/database.types';

interface TransactionRow {
  date: string;
  amount: string;
  recipientName?: string;
  recipientId?: string;
  index: number;
  transactionId?: string;
}

interface MerchantAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  textValue: string;
  transactions: TransactionRow[];
  onUpdateRecipientNames: (updates: Map<number, { name: string; id?: string; categoryGroupId?: string }>) => void;
  onSaveAsRule?: (textMatch: string, amountMatch: number | null, recipientId: string) => void;
  isImportMode?: boolean;
  transactionType?: 'expense' | 'income';
}

export function MerchantAdminDialog({
  open,
  onOpenChange,
  textValue,
  transactions,
  onUpdateRecipientNames,
  onSaveAsRule,
  isImportMode = true,
  transactionType,
}: MerchantAdminDialogProps) {
  const { settings } = useSettings();
  const d = settings.hideDecimals ? 0 : 2;
  const fc = (v: number) => formatCurrency(v, { roundToHundreds: settings.roundToHundreds, decimals: d });
  const [localRecipientNames, setLocalRecipientNames] = useState<Map<number, { name: string; id?: string; categoryGroupId?: string }>>(new Map());
  const [bulkRecipientName, setBulkRecipientName] = useState('');
  const [bulkCategoryGroupId, setBulkCategoryGroupId] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [groupByAmount, setGroupByAmount] = useState(false);
  const [saveAsRule, setSaveAsRule] = useState(false);
  const [selectedAmountGroup, setSelectedAmountGroup] = useState<string | null>(null);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [newCategoryGroupDialogOpen, setNewCategoryGroupDialogOpen] = useState(false);
  const [newCategoryGroupName, setNewCategoryGroupName] = useState('');
  const [targetForNewCategory, setTargetForNewCategory] = useState<'bulk' | 'amount-group' | 'individual' | null>(null);
  const [targetAmount, setTargetAmount] = useState<string | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);

  useEffect(() => {
    loadCategoryData();
  }, []);

  async function loadCategoryData() {
    try {
      const groupsData = await getCategoryGroups();
      setCategoryGroups(groupsData || []);
    } catch (error) {
      console.error('loadCategoryData: failed to load category groups', error);
      toast.error('Kunne ikke hente kategorier');
    }
  }

  const filteredTransactions = useMemo(() => {
    if (!searchFilter) return transactions;

    const query = searchFilter.toLowerCase();
    return transactions.filter(t =>
      t.date.includes(query) ||
      t.amount.toString().includes(query)
    );
  }, [transactions, searchFilter]);

  const amountGroups = useMemo(() => {
    const groups = new Map<string, TransactionRow[]>();
    filteredTransactions.forEach(t => {
      const amount = parseFloat(t.amount).toFixed(2);
      if (!groups.has(amount)) {
        groups.set(amount, []);
      }
      groups.get(amount)!.push(t);
    });
    return groups;
  }, [filteredTransactions]);

  const handleBulkSet = () => {
    if (!bulkRecipientName.trim()) {
      toast.error('Indtast et modtagernavn');
      return;
    }

    const newMap = new Map(localRecipientNames);
    filteredTransactions.forEach(t => {
      newMap.set(t.index, {
        name: bulkRecipientName.trim(),
        id: t.recipientId,
        categoryGroupId: bulkCategoryGroupId || undefined
      });
    });
    setLocalRecipientNames(newMap);
    toast.success(`Modtagernavn sat for ${filteredTransactions.length} posteringer`);
  };

  const [amountGroupCategories, setAmountGroupCategories] = useState<Map<string, string>>(new Map());

  const handleSetForAmountGroup = (amount: string, recipientName: string) => {
    if (!recipientName.trim()) {
      toast.error('Indtast et modtagernavn');
      return;
    }

    const categoryGroupId = amountGroupCategories.get(amount);
    const newMap = new Map(localRecipientNames);
    const group = amountGroups.get(amount);
    if (group) {
      group.forEach(t => {
        newMap.set(t.index, {
          name: recipientName.trim(),
          id: t.recipientId,
          categoryGroupId: categoryGroupId || undefined
        });
      });
      setLocalRecipientNames(newMap);
      toast.success(`Modtagernavn sat for ${group.length} posteringer`);
    }
  };

  const [individualCategories, setIndividualCategories] = useState<Map<number, string>>(new Map());

  const handleUpdateSingle = (index: number, value: string, recipientId?: string) => {
    const categoryGroupId = individualCategories.get(index);
    const newMap = new Map(localRecipientNames);
    if (value.trim()) {
      newMap.set(index, {
        name: value.trim(),
        id: recipientId,
        categoryGroupId: categoryGroupId || undefined
      });
    } else {
      newMap.delete(index);
    }
    setLocalRecipientNames(newMap);
  };

  async function handleCreateCategoryGroup() {
    if (!newCategoryGroupName.trim()) {
      toast.error('Indtast et navn på hovedkategorien');
      return;
    }

    try {
      const newId = await findOrCreateCategoryGroup(newCategoryGroupName.trim());
      await loadCategoryData();

      if (targetForNewCategory === 'bulk') {
        setBulkCategoryGroupId(newId);
      } else if (targetForNewCategory === 'amount-group' && targetAmount) {
        const newMap = new Map(amountGroupCategories);
        newMap.set(targetAmount, newId);
        setAmountGroupCategories(newMap);
      } else if (targetForNewCategory === 'individual' && targetIndex !== null) {
        const newMap = new Map(individualCategories);
        newMap.set(targetIndex, newId);
        setIndividualCategories(newMap);
      }

      setNewCategoryGroupDialogOpen(false);
      setNewCategoryGroupName('');
      setTargetForNewCategory(null);
      setTargetAmount(null);
      setTargetIndex(null);
      toast.success('Hovedkategori oprettet');
    } catch (error) {
      console.error('Error creating category group:', error);
      toast.error('Kunne ikke oprette hovedkategori');
    }
  }


  const handleSave = async () => {
    onUpdateRecipientNames(localRecipientNames);

    onOpenChange(false);
    setLocalRecipientNames(new Map());
    setBulkRecipientName('');
    setBulkCategoryGroupId('');
    setSearchFilter('');
    setGroupByAmount(false);
    setSaveAsRule(false);
    setSelectedAmountGroup(null);
    setAmountGroupCategories(new Map());
    setIndividualCategories(new Map());
  };

  const handleCancel = () => {
    onOpenChange(false);
    setLocalRecipientNames(new Map());
    setBulkRecipientName('');
    setBulkCategoryGroupId('');
    setSearchFilter('');
    setGroupByAmount(false);
    setSaveAsRule(false);
    setSelectedAmountGroup(null);
    setAmountGroupCategories(new Map());
    setIndividualCategories(new Map());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Administrér modtagernavne</DialogTitle>
          <DialogDescription>
            Tekst: <span className="font-medium">{textValue}</span> ({transactions.length} {transactionType === 'expense' ? 'udgifts' : transactionType === 'income' ? 'indtægts' : ''}posteringer)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrer efter dato eller beløb..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant={groupByAmount ? 'default' : 'outline'}
                onClick={() => setGroupByAmount(!groupByAmount)}
              >
                <Tag className="mr-2 h-4 w-4" />
                Grupper efter beløb
              </Button>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Massehandlinger</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Modtagernavn..."
                      value={bulkRecipientName}
                      onChange={(e) => setBulkRecipientName(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bulk-category-group" className="text-xs">Hovedkategori</Label>
                    <Select
                      value={bulkCategoryGroupId}
                      onValueChange={(value) => {
                        if (value === '__new__') {
                          setTargetForNewCategory('bulk');
                          setNewCategoryGroupDialogOpen(true);
                        } else {
                          setBulkCategoryGroupId(value);
                        }
                      }}
                    >
                      <SelectTrigger id="bulk-category-group" className="h-9">
                        <SelectValue placeholder="Vælg hovedkategori" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__" className="text-primary font-medium">
                          <div className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Tilføj ny hovedkategori
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleBulkSet} variant="secondary" className="w-full">
                    Sæt alle til
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {groupByAmount ? (
            <div className="space-y-4">
              <h3 className="font-medium">Grupper efter beløb</h3>
              {Array.from(amountGroups.entries())
                .sort((a, b) => b[1].length - a[1].length)
                .map(([amount, group]) => (
                  <Card key={amount}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">
                        {fc(parseFloat(amount))} ({group.length} posteringer)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <Input
                          placeholder="Modtagernavn for denne gruppe..."
                          defaultValue={localRecipientNames.get(group[0].index)?.name || ''}
                          id={`group-name-${amount}`}
                        />
                        <div className="space-y-2">
                          <Label htmlFor={`group-category-group-${amount}`} className="text-xs">Hovedkategori</Label>
                          <Select
                            value={amountGroupCategories.get(amount) || ''}
                            onValueChange={(value) => {
                              if (value === '__new__') {
                                setTargetForNewCategory('amount-group');
                                setTargetAmount(amount);
                                setNewCategoryGroupDialogOpen(true);
                              } else {
                                const newMap = new Map(amountGroupCategories);
                                newMap.set(amount, value);
                                setAmountGroupCategories(newMap);
                              }
                            }}
                          >
                            <SelectTrigger id={`group-category-group-${amount}`} className="h-9">
                              <SelectValue placeholder="Vælg hovedkategori" />
                            </SelectTrigger>
                            <SelectContent>
                              {categoryGroups.map((group) => (
                                <SelectItem key={group.id} value={group.id}>
                                  {group.name}
                                </SelectItem>
                              ))}
                              <SelectItem value="__new__" className="text-primary font-medium">
                                <div className="flex items-center gap-2">
                                  <Plus className="h-4 w-4" />
                                  Tilføj ny hovedkategori
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            const input = document.getElementById(`group-name-${amount}`) as HTMLInputElement;
                            handleSetForAmountGroup(amount, input.value);
                          }}
                        >
                          Anvend
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1 mt-3 pt-3 border-t">
                        {group.slice(0, 3).map(t => (
                          <div key={t.index}>
                            {new Date(t.date).toLocaleDateString('da-DK')}
                          </div>
                        ))}
                        {group.length > 3 && <div>+ {group.length - 3} flere</div>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <div>
              <h3 className="font-medium mb-3">Alle posteringer ({filteredTransactions.length})</h3>
              <div className="border rounded-lg max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Dato</TableHead>
                      <TableHead className="w-28">Beløb</TableHead>
                      <TableHead>Modtagernavn</TableHead>
                      <TableHead className="w-56">Hovedkategori</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction) => (
                      <TableRow key={transaction.index}>
                        <TableCell>
                          {new Date(transaction.date).toLocaleDateString('da-DK')}
                        </TableCell>
                        <TableCell>
                          {fc(parseFloat(transaction.amount))}
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Indtast modtagernavn..."
                            defaultValue={localRecipientNames.get(transaction.index)?.name || transaction.recipientName || ''}
                            onBlur={(e) => handleUpdateSingle(transaction.index, e.target.value, transaction.recipientId)}
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={individualCategories.get(transaction.index) || ''}
                            onValueChange={(value) => {
                              if (value === '__new__') {
                                setTargetForNewCategory('individual');
                                setTargetIndex(transaction.index);
                                setNewCategoryGroupDialogOpen(true);
                              } else {
                                const newMap = new Map(individualCategories);
                                newMap.set(transaction.index, value);
                                setIndividualCategories(newMap);
                              }
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Vælg" />
                            </SelectTrigger>
                            <SelectContent>
                              {categoryGroups.map((group) => (
                                <SelectItem key={group.id} value={group.id}>
                                  {group.name}
                                </SelectItem>
                              ))}
                              <SelectItem value="__new__" className="text-primary font-medium">
                                <div className="flex items-center gap-2">
                                  <Plus className="h-4 w-4" />
                                  Tilføj ny hovedkategori
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Annuller
          </Button>
          <Button onClick={handleSave}>
            Gem ændringer
          </Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={newCategoryGroupDialogOpen} onOpenChange={setNewCategoryGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opret ny hovedkategori</DialogTitle>
            <DialogDescription>
              Indtast navnet på den nye hovedkategori
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-category-group-name">Navn</Label>
              <Input
                id="new-category-group-name"
                placeholder="F.eks. Transport, Mad & Drikke..."
                value={newCategoryGroupName}
                onChange={(e) => setNewCategoryGroupName(e.target.value)}
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
            <Button variant="outline" onClick={() => {
              setNewCategoryGroupDialogOpen(false);
              setNewCategoryGroupName('');
              setTargetForNewCategory(null);
              setTargetAmount(null);
              setTargetIndex(null);
            }}>
              Annuller
            </Button>
            <Button onClick={handleCreateCategoryGroup}>
              Opret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Dialog>
  );
}
