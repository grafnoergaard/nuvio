'use client';

import { useMemo, useState } from 'react';
import { Check, Palmtree, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/settings-context';
import { getVacationAccentColor, getVacationAccentMid, withAlpha } from '@/lib/vacation-theme';
import { activateVacationMode, type VacationMode } from '@/lib/vacation-mode-service';
import { notifyVacationModeChanged } from '@/lib/vacation-mode-events';

interface VacationModeActivationFlowProps {
  vacationMode: VacationMode | null;
  open: boolean;
  onClose: () => void;
  onActivated?: () => void;
  onNeedsBudget?: () => void;
}

function formatDKK(value: number): string {
  return value.toLocaleString('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'long' });
}

export function VacationModeActivationFlow({
  vacationMode,
  open,
  onClose,
  onActivated,
  onNeedsBudget,
}: VacationModeActivationFlowProps) {
  const { user } = useAuth();
  const { design } = useSettings();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vacationAccent = getVacationAccentColor(design);
  const vacationAccentMid = getVacationAccentMid(vacationAccent);

  const dailyAmount = useMemo(() => {
    if (!vacationMode || vacationMode.number_of_days <= 0) return 0;
    return Number(vacationMode.budget_amount) / vacationMode.number_of_days;
  }, [vacationMode]);
  const needsBudget = Number(vacationMode?.budget_amount ?? 0) <= 0;

  if (!open || !vacationMode) return null;

  async function handleActivate() {
    if (!user || !vacationMode) return;
    setSaving(true);
    setError(null);

    try {
      await activateVacationMode(vacationMode.id, user.id);
      notifyVacationModeChanged();
      toast.success('Feriekuvert aktiveret');
      onActivated?.();
    } catch (activateError) {
      setError('Kunne ikke aktivere feriekuverten. Prøv igen.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[88] flex items-end justify-center bg-black/38 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-[6px] sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-[34px] border border-[#D6E4E4] bg-white shadow-2xl shadow-[#0E3B43]/14">
        <div
          className="h-2"
          style={{ background: `linear-gradient(90deg, ${vacationAccent} 0%, ${vacationAccentMid} 48%, ${vacationAccent} 100%)` }}
        />
        <div className="px-6 pb-6 pt-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-[22px] text-[#0E3B43] ring-1"
              style={{
                backgroundColor: withAlpha(vacationAccent, 0.18),
                ['--tw-ring-color' as string]: withAlpha(vacationAccent, 0.35),
              }}
            >
              <Palmtree className="h-7 w-7" />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F7FAF8] text-foreground/70 ring-1 ring-black/5"
              aria-label="Ikke nu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="mb-3 text-[0.74rem] font-semibold uppercase tracking-[0.24em] text-[#0E3B43]/70">
            Ferie mode
          </p>
          <h2 className="text-4xl font-semibold leading-tight tracking-tight text-foreground">
            {needsBudget ? 'Din ferie starter i dag' : 'Din feriekuvert er klar'}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {needsBudget
              ? 'Før du kan aktivere feriekuverten, skal du lige sætte dit feriebudget.'
              : 'Ferien starter kun, hvis du selv aktiverer den. Indtil da kører normal Kuvert videre.'}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <SummaryTile label="Feriebudget" value={formatDKK(Number(vacationMode.budget_amount))} />
            <SummaryTile label="Feriedage" value={`${vacationMode.number_of_days}`} />
            <SummaryTile label="Per feriedag" value={formatDKK(dailyAmount)} />
            <SummaryTile
              label="Periode"
              value={`${formatDate(vacationMode.start_date)} - ${formatDate(vacationMode.end_date)}`}
            />
          </div>

          {error && (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={needsBudget ? onNeedsBudget : handleActivate}
              disabled={saving}
              className="flex h-16 items-center justify-center gap-3 rounded-full bg-[#0E3B43] text-lg font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-60"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#0E3B43]"
                style={{ backgroundColor: vacationAccent }}
              >
                <Check className="h-5 w-5" />
              </span>
              {saving ? 'Aktiverer...' : needsBudget ? 'Sæt feriebudget' : 'Aktivér feriekuvert'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-12 rounded-full text-base font-semibold text-muted-foreground"
            >
              Ikke nu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#DCE8E8] bg-[#F8FBFA] px-4 py-3">
      <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold leading-snug text-[#0E3B43]">
        {value}
      </p>
    </div>
  );
}
