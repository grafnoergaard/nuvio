'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { upsertMonthlyBudget } from '@/lib/quick-expense-service';
import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';

interface WeekBudgetSetupModalProps {
  currentBudget: number;
  onClose: () => void;
  onSaved: () => void;
}

function formatInputValue(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '';
  return String(Math.round(value));
}

function parseAmount(value: string) {
  const normalized = value
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

export function WeekBudgetSetupModal({
  currentBudget,
  onClose,
  onSaved,
}: WeekBudgetSetupModalProps) {
  const [visible, setVisible] = useState(false);
  const [amount, setAmount] = useState(formatInputValue(currentBudget));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { animating, direction } = useWizardAnimation();

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const parsedAmount = useMemo(() => parseAmount(amount), [amount]);

  async function saveBudget() {
    if (parsedAmount <= 0) {
      setError('Indtast et rådighedsbeløb først.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const today = new Date();
      await upsertMonthlyBudget(today.getFullYear(), today.getMonth() + 1, Math.round(parsedAmount));
      toast.success('Rådighedsbeløb gemt');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke gemme rådighedsbeløbet.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <WizardShell
      gradient="linear-gradient(180deg, #effcf7 0%, #fbfbf7 62%, #ffffff 100%)"
      visible={visible}
      step={0}
      totalSteps={1}
      showBack={false}
      showClose
      onBack={() => {}}
      onClose={onClose}
      animating={animating}
      direction={direction}
    >
      <div className="min-h-[calc(100vh-11rem)] flex flex-col justify-center">
        <div className="mb-9 flex h-16 w-16 items-center justify-center rounded-[22px] border border-emerald-200 bg-white/80 text-[#0E3B43] shadow-sm">
          <Wallet className="h-7 w-7" />
        </div>

        <p className="mb-4 text-xs font-bold uppercase tracking-[0.26em] text-emerald-500">
          Ugeskift
        </p>

        <h2 className="text-[2.6rem] font-black leading-[0.98] tracking-[-0.04em] text-[#171717]">
          Sæt ugens rådighedsbeløb
        </h2>

        <p className="mt-6 max-w-[24rem] text-xl leading-relaxed text-[#596469]">
          Når beløbet matcher kontoen, bliver Kuvert retvisende fra start.
        </p>

        <div className="mt-10 rounded-[28px] border border-[#D9E4E4] bg-white/78 p-5 shadow-[0_18px_50px_rgba(14,59,67,0.07)]">
          <label className="text-xs font-bold uppercase tracking-[0.22em] text-[#9DA7AB]">
            Rådighedsbeløb
          </label>
          <div className="mt-4 flex items-end gap-3 border-b border-[#D9E4E4] pb-3">
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              className="min-w-0 flex-1 bg-transparent text-[3.6rem] font-black leading-none tracking-[-0.05em] text-[#0E3B43] outline-none placeholder:text-[#A4ACB8]"
              placeholder="0"
              aria-label="Rådighedsbeløb"
            />
            <span className="pb-1 text-2xl font-black text-[#9DA7AB]">kr.</span>
          </div>

          {error ? (
            <p className="mt-3 text-sm font-semibold text-red-500">{error}</p>
          ) : (
            <p className="mt-3 text-sm text-[#7C878B]">
              Du kan altid ændre beløbet igen senere.
            </p>
          )}
        </div>

        <div className="mt-8 grid gap-3">
          <button
            type="button"
            onClick={saveBudget}
            disabled={saving || parsedAmount <= 0}
            className="flex h-16 items-center justify-center gap-3 rounded-full bg-[#0E3B43] text-lg font-black text-white shadow-[0_18px_38px_rgba(14,59,67,0.18)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2ED3A7] text-[#0E3B43]">
              <Check className="h-5 w-5" />
            </span>
            {saving ? 'Gemmer...' : 'Gem rådighedsbeløb'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-12 text-base font-bold text-[#596469]"
          >
            Ikke nu
          </button>
        </div>
      </div>
    </WizardShell>
  );
}
