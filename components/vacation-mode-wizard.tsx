'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, Check, Palmtree, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { cn } from '@/lib/utils';
import { getVacationAccentColor, getVacationAccentMid, getVacationAccentSoft, withAlpha } from '@/lib/vacation-theme';
import { updateVacationMode, type VacationMode } from '@/lib/vacation-mode-service';

interface VacationModeWizardProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  vacationMode?: VacationMode | null;
}

const STEP_COUNT = 4;

function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const date = parseLocalDate(value);
  if (!date) return value;
  return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function VacationModeWizard({ open, onClose, onSaved, vacationMode }: VacationModeWizardProps) {
  const { user } = useAuth();
  const { design } = useSettings();
  const [step, setStep] = useState(0);
  const [budgetInput, setBudgetInput] = useState('');
  const [daysInput, setDaysInput] = useState('');
  const [startDateInput, setStartDateInput] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wizardRef = useRef<HTMLDivElement>(null);

  const budgetAmount = Number(budgetInput.replace(',', '.'));
  const numberOfDays = Number.parseInt(daysInput, 10);
  const startDate = parseLocalDate(startDateInput);
  const startDateToday = todayIso();
  const endDateInput = useMemo(() => {
    if (!startDate || !Number.isFinite(numberOfDays) || numberOfDays < 1) return '';
    return toIsoDate(addDays(startDate, numberOfDays - 1));
  }, [numberOfDays, startDate]);
  const dailyAmount = Number.isFinite(budgetAmount) && numberOfDays > 0 ? budgetAmount / numberOfDays : 0;
  const isFutureVacation = startDateInput > startDateToday;
  const isReadyForActivation = startDateInput === startDateToday;
  const isEditing = Boolean(vacationMode);
  const isEditingActiveVacation = vacationMode?.status === 'active';
  const vacationAccent = getVacationAccentColor(design);
  const vacationAccentSoft = getVacationAccentSoft(vacationAccent);
  const vacationAccentMid = getVacationAccentMid(vacationAccent);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setError(null);

    if (vacationMode) {
      setBudgetInput(String(Number(vacationMode.budget_amount) || ''));
      setDaysInput(String(vacationMode.number_of_days || ''));
      setStartDateInput(vacationMode.start_date || todayIso());
      return;
    }

    setBudgetInput('');
    setDaysInput('');
    setStartDateInput(todayIso());
  }, [open, vacationMode?.id]);

  useEffect(() => {
    if (!open) return;

    const syncKeyboardOffset = () => {
      if (typeof window === 'undefined' || !window.visualViewport) return;
      const viewport = window.visualViewport;
      const keyboardOffset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty('--vacation-wizard-keyboard-offset', `${keyboardOffset}px`);
      document.body.style.setProperty('--vacation-wizard-keyboard-offset', `${keyboardOffset}px`);
    };

    syncKeyboardOffset();

    if (typeof window !== 'undefined' && window.visualViewport) {
      const viewport = window.visualViewport;
      viewport.addEventListener('resize', syncKeyboardOffset);
      viewport.addEventListener('scroll', syncKeyboardOffset);
      window.addEventListener('orientationchange', syncKeyboardOffset);

      return () => {
        viewport.removeEventListener('resize', syncKeyboardOffset);
        viewport.removeEventListener('scroll', syncKeyboardOffset);
        window.removeEventListener('orientationchange', syncKeyboardOffset);
        document.documentElement.style.removeProperty('--vacation-wizard-keyboard-offset');
        document.body.style.removeProperty('--vacation-wizard-keyboard-offset');
      };
    }

    return () => {
      document.documentElement.style.removeProperty('--vacation-wizard-keyboard-offset');
      document.body.style.removeProperty('--vacation-wizard-keyboard-offset');
    };
  }, [open]);

  if (!open) return null;

  function handleFieldFocus() {
    window.setTimeout(() => {
      wizardRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 80);
  }

  function validateCurrentStep(): string | null {
    if (step === 0 && (!Number.isFinite(budgetAmount) || budgetAmount <= 0)) {
      return 'Indtast et feriebudget over 0 kr.';
    }
    if (step === 1 && (!Number.isFinite(numberOfDays) || numberOfDays < 1)) {
      return 'Indtast mindst 1 feriedag.';
    }
    if (step === 2) {
      if (!startDate) return 'Vælg en startdato.';
      if (!isEditingActiveVacation && startDateInput < startDateToday) return 'Startdatoen kan ikke ligge tilbage i tiden.';
      if (isEditingActiveVacation && endDateInput && endDateInput < startDateToday) {
        return 'Slutdatoen kan ikke ligge før i dag for en aktiv feriekuvert.';
      }
    }
    return null;
  }

  function goNext() {
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep(current => Math.min(STEP_COUNT - 1, current + 1));
  }

  async function saveVacationMode() {
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!user) {
      setError('Du skal være logget ind for at gemme en feriekuvert.');
      return;
    }
    if (!endDateInput) {
      setError('Kunne ikke beregne slutdatoen.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (vacationMode) {
        await updateVacationMode(vacationMode.id, user.id, {
          budget_amount: budgetAmount,
          number_of_days: numberOfDays,
          start_date: startDateInput,
          end_date: endDateInput,
        });
      } else {
        const { error: insertError } = await supabase
          .from('vacation_modes')
          .insert({
            user_id: user.id,
            status: 'planned',
            budget_amount: budgetAmount,
            number_of_days: numberOfDays,
            start_date: startDateInput,
            end_date: endDateInput,
          } as any);

        if (insertError) throw insertError;
      }
    } catch (saveError) {
      console.error('[VacationModeWizard] save failed', saveError);
      setSaving(false);
      setError('Kunne ikke gemme feriekuverten. Prøv igen.');
      return;
    }

    setSaving(false);

    toast.success(
      isEditing
        ? 'Feriekuvert opdateret'
        : isReadyForActivation
          ? 'Feriekuvert klar til aktivering'
          : 'Feriekuvert planlagt'
    );
    onSaved?.();
    onClose();
  }

  const stepLabel = ['Feriebudget', 'Feriedage', 'Startdato', 'Bekræft'][step];
  const primaryLabel = step === STEP_COUNT - 1
    ? (saving ? 'Gemmer...' : isEditing ? 'Gem ændringer' : 'Gem feriekuvert')
    : 'Fortsæt';

  return (
    <div
      ref={wizardRef}
      className="fixed inset-0 z-[90] overflow-hidden"
      style={{
        ['--vacation-accent' as string]: vacationAccent,
        backgroundColor: withAlpha(vacationAccentSoft, 0.72),
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${withAlpha(vacationAccent, 0.18)} 0%, ${withAlpha(vacationAccentSoft, 0.72)} 36%, #ffffff 100%)`,
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-[calc(env(safe-area-inset-top)+5.5rem)]"
        style={{ backgroundColor: withAlpha(vacationAccent, 0.18) }}
      />
      <div className="relative flex min-h-[100dvh] flex-col px-6 pt-[max(calc(env(safe-area-inset-top)+1rem),2rem)]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={step === 0 ? onClose : () => setStep(current => Math.max(0, current - 1))}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-[#0E3B43] shadow-sm ring-1 ring-black/5"
            aria-label={step === 0 ? 'Luk feriekuvert' : 'Tilbage'}
          >
            {step === 0 ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: STEP_COUNT }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  index === step ? 'w-8' : 'w-2'
                )}
                style={{ backgroundColor: index === step ? vacationAccent : withAlpha(vacationAccent, 0.25) }}
              />
            ))}
          </div>
          <div className="h-12 w-12" />
        </div>

        <div
          className="flex flex-1 flex-col justify-center overflow-y-auto pb-6"
          style={{
            paddingBottom:
              'calc(var(--vacation-wizard-keyboard-offset, 0px) + env(safe-area-inset-bottom, 0px) + 7.5rem)',
          }}
        >
          <div
            className="mb-10 flex h-16 w-16 items-center justify-center rounded-[22px] text-[#0E3B43] ring-1"
            style={{
              backgroundColor: withAlpha(vacationAccent, 0.18),
              ['--tw-ring-color' as string]: withAlpha(vacationAccent, 0.30),
            }}
          >
            {step === 0 && <Wallet className="h-7 w-7" />}
            {step === 1 && <Palmtree className="h-7 w-7" />}
            {step === 2 && <CalendarDays className="h-7 w-7" />}
            {step === 3 && <Check className="h-7 w-7" />}
          </div>

          <p className="mb-3 text-[0.78rem] font-semibold uppercase tracking-[0.24em] text-[#0E3B43]/70">
            {stepLabel}
          </p>

          {step === 0 && (
            <div>
              <h2 className="mb-7 text-4xl font-semibold leading-tight tracking-tight text-foreground">
                {isEditing ? 'Hvad må ferien koste nu?' : 'Hvad må ferien koste?'}
              </h2>
              <div className="flex items-end gap-3 border-b border-foreground/15 pb-2">
                <input
                  value={budgetInput}
                  onChange={event => setBudgetInput(event.target.value)}
                  onFocus={handleFieldFocus}
                  inputMode="decimal"
                  placeholder="0"
                  className="min-w-0 flex-1 bg-transparent text-7xl font-semibold leading-none tracking-tight text-[#0E3B43] outline-none placeholder:text-slate-300"
                  autoFocus
                />
                <span className="pb-2 text-3xl font-semibold text-foreground/42">kr.</span>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="mb-7 text-4xl font-semibold leading-tight tracking-tight text-foreground">
                Hvor mange feriedage?
              </h2>
              <div className="flex items-end gap-3 border-b border-foreground/15 pb-2">
                <input
                  value={daysInput}
                  onChange={event => setDaysInput(event.target.value)}
                  onFocus={handleFieldFocus}
                  inputMode="numeric"
                  placeholder="0"
                  className="min-w-0 flex-1 bg-transparent text-7xl font-semibold leading-none tracking-tight text-[#0E3B43] outline-none placeholder:text-slate-300"
                  autoFocus
                />
                <span className="pb-2 text-3xl font-semibold text-foreground/42">dage</span>
              </div>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Feriebudgettet bliver fordelt ligeligt på dagene, så du får et enkelt dagsbeløb.
              </p>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="mb-7 text-4xl font-semibold leading-tight tracking-tight text-foreground">
                Hvornår starter ferien?
              </h2>
              <input
                type="date"
                value={startDateInput}
                min={isEditingActiveVacation ? undefined : startDateToday}
                onChange={event => setStartDateInput(event.target.value)}
                onFocus={handleFieldFocus}
                className="h-16 w-full rounded-2xl border border-foreground/12 bg-white px-4 text-xl font-semibold text-[#0E3B43] outline-none focus:border-[var(--vacation-accent)]"
              />
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                {isEditingActiveVacation
                  ? 'Den aktive feriekuvert opdateres med de nye datoer.'
                  : isReadyForActivation
                  ? 'Starter ferien i dag, gemmes den som klar til aktivering.'
                  : 'Ligger startdatoen fremme i tiden, gemmes feriekuverten som planlagt.'}
              </p>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="mb-6 text-4xl font-semibold leading-tight tracking-tight text-foreground">
                Din feriekuvert er klar
              </h2>
              <div className="rounded-[28px] border border-foreground/8 bg-white px-5 py-5 shadow-sm">
                <div className="grid grid-cols-2 gap-4">
                  <SummaryItem label="Feriebudget" value={formatDKK(budgetAmount)} />
                  <SummaryItem label="Feriedage" value={`${numberOfDays || 0}`} />
                  <SummaryItem label="Start" value={formatDate(startDateInput)} />
                  <SummaryItem label="Slut" value={endDateInput ? formatDate(endDateInput) : '-'} />
                </div>
                <div
                  className="mt-5 rounded-2xl px-4 py-3"
                  style={{ backgroundColor: withAlpha(vacationAccent, 0.16) }}
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#0E3B43]/70">Dagligt feriebeløb</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-[#0E3B43]">{formatDKK(dailyAmount)}</p>
                </div>
              </div>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                {isEditing
                  ? 'Ændringerne slår igennem med det samme og bruges i ferievisningen.'
                  : isReadyForActivation
                  ? 'Den påvirker ikke normal Kuvert endnu. Næste fase bliver selve aktiveringen.'
                  : 'Den ligger klar og påvirker ikke din normale Kuvert før ferien aktiveres.'}
              </p>
            </div>
          )}

          {error && (
            <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
        </div>

        <div
          className="relative shrink-0 pt-2"
          style={{
            paddingBottom:
              'calc(var(--vacation-wizard-keyboard-offset, 0px) + env(safe-area-inset-bottom, 0px) + 1rem)',
          }}
        >
          <button
            type="button"
            onClick={step === STEP_COUNT - 1 ? saveVacationMode : goNext}
            disabled={saving}
            className="h-16 w-full rounded-full bg-[#0E3B43] text-lg font-semibold text-white shadow-lg shadow-[#0E3B43]/12 transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/55">{label}</p>
      <p className="mt-1 text-base font-semibold leading-snug text-foreground">{value}</p>
    </div>
  );
}
