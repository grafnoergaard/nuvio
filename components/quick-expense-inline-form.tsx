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

interface QuickExpenseInlineFormProps {
  onComplete: () => void;
}

export function QuickExpenseInlineForm({ onComplete }: QuickExpenseInlineFormProps) {
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseSaved, setExpenseSaved] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      document.documentElement.removeAttribute('data-inline-expense-focus');
      document.body.removeAttribute('data-inline-expense-focus');
      document.documentElement.style.removeProperty('--inline-expense-keyboard-offset');
      document.body.style.removeProperty('--inline-expense-keyboard-offset');
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const viewport = window.visualViewport;

    function syncKeyboardOffset() {
      const active = document.body.getAttribute('data-inline-expense-focus') === 'true';
      if (!active) {
        document.documentElement.style.setProperty('--inline-expense-keyboard-offset', '0px');
        document.body.style.setProperty('--inline-expense-keyboard-offset', '0px');
        return;
      }

      const keyboardOffset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty('--inline-expense-keyboard-offset', `${keyboardOffset}px`);
      document.body.style.setProperty('--inline-expense-keyboard-offset', `${keyboardOffset}px`);
    }

    viewport.addEventListener('resize', syncKeyboardOffset);
    viewport.addEventListener('scroll', syncKeyboardOffset);
    window.addEventListener('orientationchange', syncKeyboardOffset);
    syncKeyboardOffset();

    return () => {
      viewport.removeEventListener('resize', syncKeyboardOffset);
      viewport.removeEventListener('scroll', syncKeyboardOffset);
      window.removeEventListener('orientationchange', syncKeyboardOffset);
    };
  }, []);

  function setInlineExpenseFocusState(active: boolean) {
    if (active) {
      document.documentElement.setAttribute('data-inline-expense-focus', 'true');
      document.body.setAttribute('data-inline-expense-focus', 'true');
      if (typeof window !== 'undefined' && window.visualViewport) {
        const viewport = window.visualViewport;
        const keyboardOffset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
        document.documentElement.style.setProperty('--inline-expense-keyboard-offset', `${keyboardOffset}px`);
        document.body.style.setProperty('--inline-expense-keyboard-offset', `${keyboardOffset}px`);
      }
      window.setTimeout(() => {
        formRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 60);
    } else {
      document.documentElement.removeAttribute('data-inline-expense-focus');
      document.body.removeAttribute('data-inline-expense-focus');
      document.documentElement.style.setProperty('--inline-expense-keyboard-offset', '0px');
      document.body.style.setProperty('--inline-expense-keyboard-offset', '0px');
    }
  }

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
      await addQuickExpense(parsed, expenseNote.trim() || null);
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
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.blur();
        setInlineExpenseFocusState(false);
        setExpenseSaved(false);
        setExpenseAmount('');
        setExpenseNote('');
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
      ref={formRef}
      className="space-y-2"
      onFocusCapture={() => setInlineExpenseFocusState(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && formRef.current?.contains(nextTarget)) return;
        window.setTimeout(() => {
          const active = document.activeElement;
          if (active instanceof Node && formRef.current?.contains(active)) return;
          setInlineExpenseFocusState(false);
        }, 0);
      }}
    >
      <div className="space-y-1.5">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/58">
            Tilføj udgift
          </span>
          <div className="flex items-end gap-2.5 border-b border-foreground/10 pb-1.5">
            <input
              ref={amountRef}
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={expenseAmount}
              onChange={(e) => {
                setExpenseAmount(e.target.value);
                setExpenseError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddExpense()}
              className={cn(
                'min-w-0 flex-1 bg-transparent text-[2.2rem] font-semibold leading-none tracking-tight text-[#0E3B43] placeholder:text-muted-foreground/35 focus:outline-none sm:text-[2.5rem]',
                expenseError && 'text-red-600'
              )}
            />
            <span className="pb-0.5 text-[1.35rem] font-semibold text-muted-foreground/60 sm:text-[1.5rem]">kr.</span>
          </div>
        </label>

        <label className="block">
          <div className="flex items-end gap-3 border-b border-foreground/8 pb-1.5">
            <input
              type="text"
              placeholder="Note (valgfri)"
              value={expenseNote}
              onChange={(e) => setExpenseNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddExpense()}
              maxLength={120}
              className="min-w-0 flex-1 bg-transparent text-[0.95rem] font-medium text-foreground/82 placeholder:text-muted-foreground/42 focus:outline-none"
            />
          </div>
        </label>
      </div>

      {expenseError && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <X className="h-3.5 w-3.5 shrink-0" />
          {expenseError}
        </p>
      )}

      <button
        type="button"
        onClick={handleAddExpense}
        disabled={expenseSaving || (!expenseAmount && !expenseSaved)}
        className={cn(
          'group flex w-full items-center justify-center gap-2 rounded-full bg-[#0E3B43] px-4 py-2.5 text-[0.95rem] font-semibold text-white transition-all duration-200 active:scale-[0.99]',
          expenseSaved && 'bg-emerald-500',
          (!expenseAmount && !expenseSaved) || expenseSaving ? 'opacity-80' : 'hover:bg-[#092F35]'
        )}
      >
        {expenseSaved ? (
          <>
            <Check className="h-4 w-4" />
            Gemt
          </>
        ) : expenseSaving ? (
          <span className="animate-pulse">Gemmer...</span>
        ) : (
          <>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2ED3A7] text-[#0E3B43] transition-transform duration-200 group-hover:scale-105">
              <Plus className="h-3.5 w-3.5" />
            </span>
            Gem udgift
          </>
        )}
      </button>
    </div>
  );
}
