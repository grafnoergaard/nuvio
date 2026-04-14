'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/number-helpers';
import { useSettings } from '@/lib/settings-context';
import type { CategoryGroup } from '@/lib/database.types';

export interface EditableTransaction {
  id: string;
  date: string;
  description?: string | null;
  recipient_name?: string | null;
  amount: string | number;
  category_group_id?: string | null;
  category_group?: { id: string; name: string } | null;
  recipient?: { name?: string | null; category_group_id?: string | null } | null;
}

interface EditTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: EditableTransaction | null;
  categoryGroups: CategoryGroup[];
  onSave: (id: string, updates: {
    date: string;
    recipient_name: string | null;
    amount: number;
    category_group_id: string | null;
  }) => Promise<void>;
  onCreateCategory?: () => void;
  totalCount?: number;
  currentIndex?: number;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function EditTransactionModal({
  open,
  onOpenChange,
  transaction,
  categoryGroups,
  onSave,
  onCreateCategory,
  totalCount,
  currentIndex,
  onPrevious,
  onNext,
}: EditTransactionModalProps) {
  const { settings } = useSettings();
  const d = settings.hideDecimals ? 0 : 2;
  const fc = (v: number) => formatCurrency(v, { roundToHundreds: settings.roundToHundreds, decimals: d });

  const [date, setDate] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryGroupId, setCategoryGroupId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (transaction) {
      setDate(transaction.date);
      setRecipientName(
        transaction.recipient?.name || transaction.recipient_name || ''
      );
      setAmount(Math.abs(parseFloat(transaction.amount as string)).toString());
      setCategoryGroupId(
        transaction.category_group_id ||
        transaction.category_group?.id ||
        transaction.recipient?.category_group_id ||
        ''
      );
    }
  }, [transaction]);

  async function handleSave() {
    if (!transaction) return;
    setSaving(true);
    try {
      const isExpense = parseFloat(transaction.amount as string) < 0;
      const num = parseFloat(amount);
      const finalAmount = isNaN(num)
        ? parseFloat(transaction.amount as string)
        : isExpense ? -Math.abs(num) : Math.abs(num);

      await onSave(transaction.id, {
        date,
        recipient_name: recipientName.trim() || null,
        amount: finalAmount,
        category_group_id: categoryGroupId || null,
      });
    } catch (error) {
      console.error('handleSave: failed to save transaction', error);
      toast.error('Kunne ikke gemme postering');
    } finally {
      setSaving(false);
    }
  }

  const amountValue = parseFloat(transaction?.amount as string ?? '0');
  const isExpense = amountValue < 0;

  const showNav = totalCount !== undefined && currentIndex !== undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rediger postering</DialogTitle>
          {transaction?.description && (
            <DialogDescription>{transaction.description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Dato</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date
                    ? format(new Date(date), 'd. MMMM yyyy', { locale: da })
                    : 'Vælg dato'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date ? new Date(date) : undefined}
                  defaultMonth={date ? new Date(date) : undefined}
                  onSelect={(d) => {
                    if (d) setDate(format(d, 'yyyy-MM-dd'));
                  }}
                  locale={da}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-2">
            <Label>Modtagernavn</Label>
            <Input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Angiv modtagernavn..."
            />
            <p className="text-xs text-muted-foreground">
              Vises i stedet for den originale tekst
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Beløb</Label>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${isExpense ? 'text-rose-600' : 'text-emerald-600'}`}>
                {isExpense ? '-' : '+'}
              </span>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Kategori</Label>
              {onCreateCategory && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={onCreateCategory}
                  className="h-auto p-0 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Opret kategori
                </Button>
              )}
            </div>
            <Select value={categoryGroupId || undefined} onValueChange={setCategoryGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg kategori" />
              </SelectTrigger>
              <SelectContent>
                {categoryGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Annuller
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? 'Gemmer...' : 'Gem'}
            </Button>
          </div>

          {showNav && (
            <div className="flex items-center justify-between w-full pt-1 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrevious}
                disabled={currentIndex! <= 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Forrige
              </Button>
              <span className="text-xs text-muted-foreground">
                {currentIndex! + 1} af {totalCount}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onNext}
                disabled={currentIndex! >= totalCount! - 1}
              >
                Næste
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
