'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  addQuickExpense,
  computeWeeklyCarryOver,
  getMonthlyBudget,
  getQuickExpensesForMonth,
  getUserWeekStartDay,
  updateWeeklyCarryOver,
} from '@/lib/quick-expense-service';

interface QuickExpenseAddModalProps {
  onComplete: () => void;
  onDismiss: () => void;
}

export function QuickExpenseAddModal({ onComplete, onDismiss }: QuickExpenseAddModalProps) {
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [spreadOverMonth, setSpreadOverMonth] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseSaved, setExpenseSaved] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => amountRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, []);

  async function handleAddExpense() {
    const parsed = parseFloat(expenseAmount.replace(',', '.'));
    if (!parsed || parsed <= 0 || parsed > 999999) {
      setExpenseError('Indtast et gyldigt beløb (1 - 999.999 kr.)');
      amountRef.current?.focus();
      return;
    }

    setExpenseSaving(true);
    setExpenseError(null);

    try {
      await addQuickExpense(parsed, expenseNote.trim() || null, spreadOverMonth);
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const [expenses, monthlyBudget, weekStartDay] = await Promise.all([
        getQuickExpensesForMonth(currentYear, currentMonth),
        getMonthlyBudget(currentYear, currentMonth),
        getUserWeekStartDay(),
      ]);

      const budgetAmount = monthlyBudget?.budget_amount ?? 0;
      if (budgetAmount > 0) {
        const weekly = computeWeeklyCarryOver(budgetAmount, currentYear, currentMonth, expenses, now, weekStartDay);
        updateWeeklyCarryOver(currentYear, currentMonth, weekly.accumulatedCarryOver).catch(() => null);
      }

      setExpenseSaved(true);
      window.setTimeout(() => {
        setExpenseSaved(false);
        setExpenseAmount('');
        setExpenseNote('');
        setSpreadOverMonth(false);
        onComplete();
      }, 900);
    } catch {
      setExpenseError('Kunne ikke gemme. Prøv igen.');
    } finally {
      setExpenseSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ animation: 'slideUp 260ms cubic-bezier(0.22,1,0.36,1) forwards' }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="h-9 w-9 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center">
                <Plus className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold">Tilføj udgift</h2>
            </div>
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-full text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary transition-colors"
              aria-label="Luk"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            <div className="relative">
              <input
                ref={amountRef}
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={expenseAmount}
                onChange={e => { setExpenseAmount(e.target.value); setExpenseError(null); }}
                onKeyDown={e => e.key === 'Enter' && handleAddExpense()}
                className={cn(
                  'w-full h-14 rounded-2xl border bg-muted/30 px-5 pr-16 text-2xl font-semibold tracking-tight',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2',
                  'transition-all duration-200',
                  expenseError ? 'border-red-300' : 'border-border/50'
                )}
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground pointer-events-none">
                kr.
              </span>
            </div>

            <input
              type="text"
              placeholder="Note (valgfri)"
              value={expenseNote}
              onChange={e => setExpenseNote(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddExpense()}
              maxLength={120}
              className={cn(
                'w-full h-12 rounded-2xl border border-border/50 bg-muted/30 px-5 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2',
                'transition-all duration-200 placeholder:text-muted-foreground/50'
              )}
            />

            <label className="flex cursor-pointer items-center gap-2.5 rounded-2xl px-1 py-1.5 text-sm text-foreground/75">
              <input
                type="checkbox"
                checked={spreadOverMonth}
                onChange={(e) => setSpreadOverMonth(e.target.checked)}
                className="sr-only"
              />
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200',
                  spreadOverMonth
                    ? 'border-[#2ED3A7] bg-[#2ED3A7] text-[#0E3B43]'
                    : 'border-foreground/18 bg-white text-transparent'
                )}
                aria-hidden="true"
              >
                <Check className="h-3.5 w-3.5 stroke-[3]" />
              </span>
              <span className="font-semibold text-foreground/84">
                Månedlig fordelt udgift
              </span>
            </label>

            {expenseError && (
              <p className="text-xs text-red-600 flex items-center gap-1.5 px-1">
                <X className="h-3.5 w-3.5 shrink-0" />
                {expenseError}
              </p>
            )}

            <button
              onClick={handleAddExpense}
              disabled={expenseSaving || (!expenseAmount && !expenseSaved)}
              className={cn(
                'nuvio-action-button w-full rounded-full text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 mt-1',
                expenseSaved ? 'bg-emerald-500 text-white scale-[0.98]' : 'text-white'
              )}
              style={{ height: '52px' }}
            >
              {expenseSaved ? (
                <>
                  <Check className="h-4 w-4" />
                  Gemt
                </>
              ) : expenseSaving ? (
                <span className="animate-pulse">Gemmer...</span>
              ) : (
                'Gem udgift'
              )}
            </button>
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
