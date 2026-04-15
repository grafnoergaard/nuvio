'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { fetchRates, fetchPostalRanges, calculate, getChildRate, getRegionalMultiplierFromRanges, type CalculationRates, type CalculationBreakdown, type PostalRange, DEFAULT_RATES, DEFAULT_POSTAL_RANGES } from '@/lib/calculation-engine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, ArrowLeft, Users, MapPin, Baby, ChartBar as BarChart3, Check, GraduationCap, Minus, Plus, SlidersHorizontal, CircleCheck as CheckCircle2, RefreshCw, TrendingDown, ChevronRight, Trash2, ShoppingCart, Car, Coffee, Gamepad2, Package, Zap, Target, TrendingUp, PiggyBank } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useSettings } from '@/lib/settings-context';
import { toast } from 'sonner';
import { EditableText } from '@/components/editable-text';

interface WizardState {
  numberOfAdults: number;
  numberOfChildren: number;
  isStudent: boolean;
  postalCode: string;
  childrenBirthYears: (number | null)[];
}

const CURRENT_YEAR = new Date().getFullYear();

const VARIABLE_DEFS = [
  { id: 'food', label: 'Mad & dagligvarer', Icon: ShoppingCart, split: 0.45 },
  { id: 'transport', label: 'Transport', Icon: Car, split: 0.20 },
  { id: 'cafe', label: 'Café & takeaway', Icon: Coffee, split: 0.10 },
  { id: 'leisure', label: 'Fritid & underholdning', Icon: Gamepad2, split: 0.12 },
  { id: 'misc', label: 'Diverse', Icon: Package, split: 0.13 },
];
const BIRTH_YEAR_OPTIONS = Array.from({ length: 20 }, (_, i) => CURRENT_YEAR - i);

function getAge(birthYear: number): number {
  return CURRENT_YEAR - birthYear;
}

const STEPS = [
  { id: 1, label: 'Husstand', icon: Users },
  { id: 2, label: 'Postnummer', icon: MapPin },
  { id: 3, label: 'Børn', icon: Baby },
  { id: 4, label: 'Resultat', icon: BarChart3 },
];

interface SavedData {
  estimate: number;
  postalCode: string;
  isStudent: boolean;
  childrenBirthYears: number[];
  adultCount: number;
  childCount: number;
}

export default function VariableForbrugPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [mode, setMode] = useState<'loading' | 'dashboard' | 'wizard'>('loading');
  const [savedData, setSavedData] = useState<SavedData | null>(null);
  const [rates, setRates] = useState<CalculationRates>(DEFAULT_RATES);
  const [postalRanges, setPostalRanges] = useState<PostalRange[]>(DEFAULT_POSTAL_RANGES);
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>({
    numberOfAdults: 1,
    numberOfChildren: 0,
    isStudent: false,
    postalCode: '',
    childrenBirthYears: [],
  });

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  async function loadAll() {
    try {
      const [householdResult, loadedRates, loadedRanges] = await Promise.all([
        user
          ? supabase.from('household').select('adult_count, child_count, variable_expense_estimate, variable_postal_code, variable_is_student, variable_children_birth_years').eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        fetchRates(),
        fetchPostalRanges(),
      ]);

      setRates(loadedRates);
      setPostalRanges(loadedRanges);

      if (householdResult.data) {
        const d = householdResult.data;
        const savedBirthYears = (d.variable_children_birth_years as number[]) ?? [];
        const childCount = d.child_count ?? 0;
        const birthYears: (number | null)[] = Array.from({ length: childCount }, (_, i) => savedBirthYears[i] ?? null);
        setState(prev => ({
          ...prev,
          numberOfAdults: d.adult_count ?? 1,
          numberOfChildren: childCount,
          isStudent: d.variable_is_student ?? false,
          postalCode: d.variable_postal_code ?? '',
          childrenBirthYears: birthYears,
        }));

        if (d.variable_expense_estimate != null) {
          setSavedData({
            estimate: Number(d.variable_expense_estimate),
            postalCode: d.variable_postal_code ?? '',
            isStudent: d.variable_is_student ?? false,
            childrenBirthYears: (d.variable_children_birth_years as number[]) ?? [],
            adultCount: d.adult_count ?? 1,
            childCount: d.child_count ?? 0,
          });
          setMode('dashboard');
          return;
        }
      }

      setMode('wizard');
    } catch {
      toast.error('Kunne ikke indlæse data');
      setMode('wizard');
    }
  }

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState(prev => ({ ...prev, [key]: value }));
  }

  function setAdults(n: number) {
    const clamped = Math.max(1, Math.min(6, n));
    update('numberOfAdults', clamped);
  }

  function setChildren(n: number) {
    const clamped = Math.max(0, Math.min(8, n));
    setState(prev => {
      const years = [...prev.childrenBirthYears];
      while (years.length < clamped) years.push(null);
      return { ...prev, numberOfChildren: clamped, childrenBirthYears: years.slice(0, clamped) };
    });
  }

  function setChildBirthYear(index: number, year: number) {
    setState(prev => {
      const years = [...prev.childrenBirthYears];
      years[index] = year;
      return { ...prev, childrenBirthYears: years };
    });
  }

  const effectiveSteps = state.numberOfChildren > 0 ? STEPS : STEPS.filter(s => s.id !== 3);
  const stepIds = effectiveSteps.map(s => s.id);
  const currentIndex = stepIds.indexOf(step);
  const totalSteps = effectiveSteps.length;
  const displayStep = currentIndex + 1;

  function goNext() {
    const nextId = stepIds[currentIndex + 1];
    if (nextId) setStep(nextId);
  }

  function goBack() {
    const prevId = stepIds[currentIndex - 1];
    if (prevId) setStep(prevId);
  }

  async function saveEstimate(amount: number, wizardState: WizardState) {
    if (!user) return;

    const payload = {
      variable_expense_estimate: amount,
      variable_postal_code: wizardState.postalCode,
      variable_is_student: wizardState.isStudent,
      variable_children_birth_years: wizardState.childrenBirthYears.filter(y => y !== null),
      adult_count: wizardState.numberOfAdults,
      child_count: wizardState.numberOfChildren,
    };

    const { data: existing } = await supabase
      .from('household')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from('household')
        .update(payload)
        .eq('user_id', user.id));
    } else {
      ({ error } = await supabase
        .from('household')
        .insert({ ...payload, user_id: user.id }));
    }

    if (error) {
      toast.error('Kunne ikke gemme estimat');
      return;
    }

    setSavedData({
      estimate: amount,
      postalCode: wizardState.postalCode,
      isStudent: wizardState.isStudent,
      childrenBirthYears: (wizardState.childrenBirthYears.filter(y => y !== null) as number[]),
      adultCount: wizardState.numberOfAdults,
      childCount: wizardState.numberOfChildren,
    });
    setMode('dashboard');
  }

  const canContinueStep1 = state.numberOfAdults >= 1;
  const canContinueStep2 = state.postalCode.length === 4 && /^\d{4}$/.test(state.postalCode);
  const canContinueStep3 = state.childrenBirthYears.every(y => y !== null);

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  if (mode === 'dashboard' && savedData) {
    return (
      <Dashboard
        saved={savedData}
        rates={rates}
        postalRanges={postalRanges}
        onRecalculate={() => {
          setState(prev => ({
            ...prev,
            numberOfAdults: savedData.adultCount,
            numberOfChildren: savedData.childCount,
            isStudent: savedData.isStudent,
            postalCode: savedData.postalCode,
            childrenBirthYears: savedData.childrenBirthYears,
          }));
          setStep(1);
          setMode('wizard');
        }}
        onReset={async () => {
          if (user) {
            await supabase
              .from('household')
              .update({
                variable_expense_estimate: null,
                variable_postal_code: null,
                variable_is_student: false,
                variable_children_birth_years: null,
              })
              .eq('user_id', user.id);
          }
          setSavedData(null);
          setState({
            numberOfAdults: savedData.adultCount,
            numberOfChildren: 0,
            isStudent: false,
            postalCode: '',
            childrenBirthYears: [],
          });
          setStep(1);
          setMode('wizard');
        }}
        onSaveAdjusted={async (amount) => {
          if (user) {
            await supabase
              .from('household')
              .update({ variable_expense_estimate: amount })
              .eq('user_id', user.id);
          }
          setSavedData(prev => prev ? { ...prev, estimate: amount } : prev);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-10 px-6">
      <div className="max-w-xl mx-auto">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            <EditableText textKey="variable-forbrug.page.title" fallback="Variable udgifter" as="span" />
          </h1>
          <p className="text-muted-foreground mt-2">
            <EditableText textKey="variable-forbrug.page.subtitle1" fallback="Dit forbrug estimeret ud fra din husstand." as="span" />
          </p>
          <p className="text-muted-foreground">
            <EditableText textKey="variable-forbrug.page.subtitle2" fallback="Justér hvis din hverdag ser anderledes ud." as="span" />
          </p>
        </div>

        <StepIndicator steps={effectiveSteps} currentStep={step} displayStep={displayStep} totalSteps={totalSteps} />

        <div className="mt-8">
          {step === 1 && (
            <StepCard
              title="Din husstand"
              subtitle="Fortæl os hvem I er hjemme"
              icon={<Users className="h-5 w-5 text-primary" />}
            >
              <div className="space-y-6">
                <CounterField
                  label="Voksne"
                  description="Antal voksne i husstanden"
                  value={state.numberOfAdults}
                  min={1}
                  max={6}
                  onChange={setAdults}
                />
                <CounterField
                  label="Hjemmeboende børn"
                  description="Børn der bor hjemme"
                  value={state.numberOfChildren}
                  min={0}
                  max={8}
                  onChange={setChildren}
                />
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => update('isStudent', !state.isStudent)}
                    className={cn(
                      'w-full flex items-center gap-4 rounded-2xl px-5 py-4 border-2 transition-all duration-200',
                      state.isStudent
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40 hover:bg-secondary/30'
                    )}
                  >
                    <div className={cn(
                      'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                      state.isStudent ? 'bg-primary/10' : 'bg-secondary'
                    )}>
                      <GraduationCap className={cn('h-5 w-5', state.isStudent ? 'text-primary' : 'text-muted-foreground')} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-sm">Jeg er studerende</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Vi justerer estimatet for studieøkonomi</p>
                    </div>
                    <div className={cn(
                      'h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0',
                      state.isStudent ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                    )}>
                      {state.isStudent && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                  </button>
                </div>
              </div>
              <WizardFooter onNext={goNext} canNext={canContinueStep1} isFirst />
            </StepCard>
          )}

          {step === 2 && (
            <StepCard
              title="Postnummer"
              subtitle="Leveomkostninger varierer på tværs af Danmark"
              icon={<MapPin className="h-5 w-5 text-primary" />}
            >
              <div className="space-y-4">
                <div>
                  <Label htmlFor="postalCode" className="text-sm font-medium mb-2 block">
                    Dit postnummer
                  </Label>
                  <Input
                    id="postalCode"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="f.eks. 2100"
                    value={state.postalCode}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                      update('postalCode', v);
                    }}
                    onKeyDown={e => { if (e.key === 'Enter' && canContinueStep2) goNext(); }}
                    className="text-2xl font-bold tracking-widest h-14 text-center rounded-xl"
                    autoFocus
                  />
                </div>
                <div className="flex items-start gap-3 bg-secondary/40 rounded-2xl px-4 py-3">
                  <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center mt-0.5 shrink-0">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Vi bruger kun dit postnummer til at forbedre dit estimat. Ingen persondata gemmes.
                  </p>
                </div>
              </div>
              <WizardFooter onNext={goNext} onBack={goBack} canNext={canContinueStep2} />
            </StepCard>
          )}

          {step === 3 && state.numberOfChildren > 0 && (
            <StepCard
              title="Børnenes alder"
              subtitle="Forbrug afhænger af barnets alder"
              icon={<Baby className="h-5 w-5 text-primary" />}
            >
              <div className="space-y-3">
                {state.childrenBirthYears.map((year, i) => (
                  <div key={i} className="flex items-center gap-4 rounded-2xl bg-secondary/30 px-4 py-3">
                    <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <Baby className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Barn {i + 1}</p>
                      {year !== null && (
                        <p className="text-xs text-muted-foreground">{getAge(year)} år</p>
                      )}
                    </div>
                    <Select
                      value={year != null ? String(year) : ''}
                      onValueChange={v => setChildBirthYear(i, Number(v))}
                    >
                      <SelectTrigger className="w-32 rounded-xl">
                        <SelectValue placeholder="Fødselsår" />
                      </SelectTrigger>
                      <SelectContent>
                        {BIRTH_YEAR_OPTIONS.map(y => (
                          <SelectItem key={y} value={String(y)}>
                            {y} ({getAge(y)} år)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <WizardFooter onNext={goNext} onBack={goBack} canNext={canContinueStep3} nextLabel="Beregn" />
            </StepCard>
          )}

          {step === 4 && (
            <ResultScreen
              state={state}
              rates={rates}
              postalRanges={postalRanges}
              onBack={goBack}
              onSave={(amount) => saveEstimate(amount, state)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface DashboardProps {
  saved: SavedData;
  rates: CalculationRates;
  postalRanges: PostalRange[];
  onRecalculate: () => void;
  onReset: () => Promise<void>;
  onSaveAdjusted: (amount: number) => Promise<void>;
}

interface VariableCat {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  amount: number;
}

function initCategories(estimate: number): VariableCat[] {
  return VARIABLE_DEFS.map(d => ({
    id: d.id,
    label: d.label,
    Icon: d.Icon,
    amount: Math.round(estimate * d.split),
  }));
}

function Dashboard({ saved, rates, postalRanges, onRecalculate, onReset, onSaveAdjusted }: DashboardProps) {
  const { design, settings } = useSettings();
  const [adjusting, setAdjusting] = useState(false);
  const [categories, setCategories] = useState<VariableCat[]>(() => initCategories(saved.estimate));
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [benchmarkOpen, setBenchmarkOpen] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);

  const breakdown = calculate(
    saved.adultCount,
    saved.childCount,
    saved.isStudent,
    saved.postalCode,
    saved.childrenBirthYears,
    rates,
    postalRanges
  );

  const { adultSubtotal, baseTotal, regionalAdjustment, total, regionalMultiplier, adultRateUsed } = breakdown;

  const categoryTotal = categories.reduce((s, c) => s + c.amount, 0);
  const adjustedTotal = adjusting ? categoryTotal : saved.estimate;

  const regionalPct = regionalMultiplier !== 0
    ? `${regionalMultiplier > 0 ? '+' : ''}${Math.round(regionalMultiplier * 100)}%`
    : 'ingen justering';

  const childrenByAgeGroup: { label: string; count: number; rate: number; subtotal: number }[] = [];
  if (saved.childrenBirthYears.length > 0) {
    const groups: Record<string, { label: string; rate: number; count: number }> = {};
    for (const year of saved.childrenBirthYears) {
      const age = CURRENT_YEAR - year;
      let key: string;
      let label: string;
      let rate: number;
      if (age <= 2) { key = '0-2'; label = '0–2 år'; rate = rates.child_0_2; }
      else if (age <= 12) { key = '3-12'; label = '3–12 år'; rate = rates.child_3_12; }
      else { key = '13-17'; label = '13–17 år'; rate = rates.child_13_17; }
      if (!groups[key]) groups[key] = { label, rate, count: 0 };
      groups[key].count++;
    }
    for (const g of Object.values(groups)) {
      childrenByAgeGroup.push({ label: g.label, count: g.count, rate: g.rate, subtotal: g.count * g.rate });
    }
  }

  function handleStartAdjusting() {
    setCategories(initCategories(saved.estimate));
    setAdjusting(true);
  }

  function handleCancelAdjusting() {
    setCategories(initCategories(saved.estimate));
    setAdjusting(false);
  }

  async function handleSaveAdjusted() {
    setSaving(true);
    await onSaveAdjusted(categoryTotal);
    setSaving(false);
    setAdjusting(false);
  }

  async function handleReset() {
    setResetting(true);
    await onReset();
    setResetting(false);
    setConfirmReset(false);
  }

  const delta = adjustedTotal - total;
  const deltaPct = total > 0 ? Math.round((Math.abs(delta) / total) * 100) : 0;

  const simulatedTotal = Math.max(0, adjustedTotal - sliderValue);
  const simulatedPct = total > 0 ? Math.round((simulatedTotal / total) * 100) : 0;
  const yearSaving = sliderValue * 12;

  const fc = (v: number) => v.toLocaleString('da-DK') + ' kr.';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-4 md:px-8">
      <div className="max-w-3xl mx-auto space-y-6">

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              <EditableText textKey="variable-forbrug.page.title" fallback="Variable udgifter" as="span" />
            </h1>
            <p className="text-muted-foreground mt-1 text-base">
              <EditableText textKey="variable-forbrug.page.subtitle1" fallback="Dit forbrug estimeret ud fra din husstand." as="span" />
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={onRecalculate} className="rounded-xl gap-2">
              <RefreshCw className="h-4 w-4" />
              Genberegn
            </Button>
            {!confirmReset ? (
              <Button variant="outline" onClick={() => setConfirmReset(true)} className="rounded-xl gap-2 text-rose-500 border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-rose-800 dark:hover:bg-rose-950/30">
                <Trash2 className="h-4 w-4" />
                Nulstil
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-3 py-2">
                <span className="text-xs text-rose-600 font-medium">Er du sikker?</span>
                <Button size="sm" variant="destructive" onClick={handleReset} disabled={resetting} className="h-7 rounded-lg text-xs px-3">
                  {resetting ? 'Sletter…' : 'Ja, slet'}
                </Button>
                <button onClick={() => setConfirmReset(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Annuller
                </button>
              </div>
            )}
          </div>
        </div>

        <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <CardContent className="pt-6 pb-6 px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <TrendingDown className="h-7 w-7 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">Aktivt forbrug</p>
                  <p className="text-4xl font-bold text-foreground tabular-nums leading-none">
                    {adjustedTotal.toLocaleString('da-DK')} kr.
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">pr. måned</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      Benchmark: {total.toLocaleString('da-DK')} kr./md.
                    </span>
                    <span className="text-muted-foreground/40 text-xs">·</span>
                    {delta === 0 ? (
                      <span className="text-xs text-muted-foreground">på niveau</span>
                    ) : delta > 0 ? (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">+{delta.toLocaleString('da-DK')} kr. ({deltaPct}% over)</span>
                    ) : (
                      <span className="text-xs text-emerald-600 font-medium">{delta.toLocaleString('da-DK')} kr. ({deltaPct}% under)</span>
                    )}
                  </div>
                </div>
              </div>
              {!adjusting ? (
                <Button variant="outline" onClick={handleStartAdjusting} className="rounded-xl gap-2 shrink-0">
                  <SlidersHorizontal className="h-4 w-4" />
                  Tilpas
                </Button>
              ) : (
                <button onClick={handleCancelAdjusting} className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  Annuller
                </button>
              )}
            </div>

            {adjusting && (
              <div className="mt-6 pt-5 border-t border-border/50 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Justér kategorierne</p>
                <div className="space-y-0.5">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center gap-3 py-2">
                      <div className="h-8 w-8 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                        <cat.Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="text-sm flex-1 min-w-0 truncate text-foreground">{cat.label}</span>
                      <Input
                        type="number"
                        value={cat.amount || ''}
                        onChange={e => setCategories(prev =>
                          prev.map(c => c.id === cat.id ? { ...c, amount: parseInt(e.target.value) || 0 } : c)
                        )}
                        className="w-28 rounded-xl h-9 text-sm text-right"
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/50">
                    <span className="text-sm font-semibold text-muted-foreground">Total</span>
                    <span className="text-sm font-bold tabular-nums text-foreground">{categoryTotal.toLocaleString('da-DK')} kr./md.</span>
                  </div>
                </div>
                <Button
                  onClick={handleSaveAdjusted}
                  disabled={saving}
                  className="w-full rounded-xl gap-2 h-11 text-sm font-semibold"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {saving ? 'Gemmer…' : `Gem ${categoryTotal.toLocaleString('da-DK')} kr.`}
                </Button>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-border/40">
              <button
                onClick={() => setBenchmarkOpen(o => !o)}
                className="flex items-center justify-between w-full text-left group"
              >
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Sådan beregner vi benchmark
                </span>
                <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-200', benchmarkOpen && 'rotate-90')} />
              </button>
              {benchmarkOpen && (
                <div className="mt-3 rounded-2xl border border-border/40 overflow-hidden">
                  <div className="divide-y divide-border/30">
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm text-muted-foreground">Voksne{saved.isStudent ? ' (studerende)' : ''}</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">{saved.adultCount} × {adultRateUsed.toLocaleString('da-DK')} kr.</p>
                      </div>
                      <p className="text-sm tabular-nums text-muted-foreground">{adultSubtotal.toLocaleString('da-DK')} kr.</p>
                    </div>
                    {childrenByAgeGroup.map((g, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2.5">
                        <div>
                          <p className="text-sm text-muted-foreground">Børn {g.label}</p>
                          <p className="text-xs text-muted-foreground/60 mt-0.5">{g.count} × {g.rate.toLocaleString('da-DK')} kr.</p>
                        </div>
                        <p className="text-sm tabular-nums text-muted-foreground">{g.subtotal.toLocaleString('da-DK')} kr.</p>
                      </div>
                    ))}
                    {regionalAdjustment !== 0 && (
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <div>
                          <p className="text-sm text-muted-foreground">Regionalt tillæg</p>
                          <p className="text-xs text-muted-foreground/60 mt-0.5">Postnr. {saved.postalCode} · {regionalPct}</p>
                        </div>
                        <p className="text-sm tabular-nums text-muted-foreground">
                          {regionalAdjustment > 0
                            ? `+\u00a0${regionalAdjustment.toLocaleString('da-DK')} kr.`
                            : `−\u00a0${Math.abs(regionalAdjustment).toLocaleString('da-DK')} kr.`
                          }
                        </p>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/20">
                      <p className="text-sm font-semibold text-muted-foreground">Benchmark</p>
                      <p className="text-sm font-bold tabular-nums text-muted-foreground">{total.toLocaleString('da-DK')} kr.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
          <div className="h-1.5" style={{ background: `linear-gradient(to right, ${design.gradientFrom}, ${design.gradientTo})` }} />
          <CardContent className="pt-6 pb-6 px-6">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Variabel justering</p>
            </div>
            <p className="text-xs text-muted-foreground mb-5">Simuler hvad der sker hvis du reducerer dit variable forbrug</p>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">Reduktion</span>
                <span className="text-sm font-semibold">{sliderValue === 0 ? 'Ingen ændring' : `−${sliderValue.toLocaleString('da-DK')} kr./md.`}</span>
              </div>
              <Slider
                value={[sliderValue]}
                onValueChange={([v]) => setSliderValue(v)}
                min={0}
                max={Math.max(2000, adjustedTotal)}
                step={100}
                className="w-full"
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-muted-foreground">0 kr.</span>
                <span className="text-xs text-muted-foreground">{Math.max(2000, adjustedTotal).toLocaleString('da-DK')} kr.</span>
              </div>
            </div>

            {sliderValue > 0 ? (
              <div className="rounded-2xl bg-secondary/40 px-4 py-4 space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest mb-1">
                  Reducerer du {sliderValue.toLocaleString('da-DK')} kr./md.
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Nyt forbrug</span>
                    <span className="font-semibold tabular-nums">{simulatedTotal.toLocaleString('da-DK')} kr./md.</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Besparelse på et år</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">+{yearSaving.toLocaleString('da-DK')} kr.</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Andel af benchmark</span>
                    <span className={cn('font-semibold tabular-nums', simulatedPct <= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                      {simulatedPct}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-secondary/40 px-4 py-3.5">
                <p className="text-sm text-muted-foreground">Brug slideren til at se effekten af en lavere variabel udgift</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {VARIABLE_DEFS.map(def => {
            const cat = categories.find(c => c.id === def.id);
            const amount = cat?.amount ?? Math.round(saved.estimate * def.split);
            const pct = saved.estimate > 0 ? Math.round((amount / saved.estimate) * 100) : 0;
            const Icon = def.Icon;
            return (
              <div key={def.id} className="bg-card rounded-2xl border border-border/50 px-4 py-4 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground leading-tight">{def.label}</span>
                </div>
                <p className="text-lg font-bold tabular-nums">{amount.toLocaleString('da-DK')} kr.</p>
                <p className="text-xs text-muted-foreground">{pct}% af forbrug</p>
                <div className="w-full h-1 rounded-full bg-secondary overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: `linear-gradient(to right, ${design.gradientFrom}, ${design.gradientTo})` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
          <CardHeader className="pb-2 pt-6 px-6">
            <CardTitle className="text-lg font-bold">Husstandsprofil</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-secondary/40 px-4 py-3">
                <p className="text-xs text-muted-foreground font-medium">Voksne</p>
                <p className="text-xl font-bold mt-0.5">{saved.adultCount}</p>
              </div>
              <div className="rounded-2xl bg-secondary/40 px-4 py-3">
                <p className="text-xs text-muted-foreground font-medium">Børn</p>
                <p className="text-xl font-bold mt-0.5">{saved.childCount}</p>
              </div>
              <div className="rounded-2xl bg-secondary/40 px-4 py-3">
                <p className="text-xs text-muted-foreground font-medium">Postnummer</p>
                <p className="text-xl font-bold mt-0.5">{saved.postalCode || '—'}</p>
              </div>
              <div className="rounded-2xl bg-secondary/40 px-4 py-3">
                <p className="text-xs text-muted-foreground font-medium">Studerende</p>
                <p className="text-xl font-bold mt-0.5">{saved.isStudent ? 'Ja' : 'Nej'}</p>
              </div>
            </div>

            {saved.childrenBirthYears.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground font-medium px-1">Børns alder</p>
                {saved.childrenBirthYears.map((year, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Baby className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-sm font-medium">Barn {i + 1}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {year} · {getAge(year)} år · {getChildRate(year, rates).toLocaleString('da-DK')} kr./md.
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface StepIndicatorProps {
  steps: typeof STEPS;
  currentStep: number;
  displayStep: number;
  totalSteps: number;
}

function StepIndicator({ steps, currentStep, displayStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-medium">
          Trin {displayStep} af {totalSteps}
        </p>
        <p className="text-sm text-muted-foreground">
          {Math.round((displayStep / totalSteps) * 100)}%
        </p>
      </div>
      <div className="flex gap-1.5">
        {steps.map((s, i) => {
          const idx = steps.findIndex(x => x.id === currentStep);
          const done = i < idx;
          const active = s.id === currentStep;
          return (
            <div
              key={s.id}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-all duration-500',
                done ? 'bg-primary' : active ? 'bg-primary/60' : 'bg-secondary'
              )}
            />
          );
        })}
      </div>
      <div className="flex justify-between">
        {steps.map((s) => {
          const Icon = s.icon;
          const idx = steps.findIndex(x => x.id === currentStep);
          const sIdx = steps.findIndex(x => x.id === s.id);
          const done = sIdx < idx;
          const active = s.id === currentStep;
          return (
            <div key={s.id} className="flex flex-col items-center gap-1">
              <div className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center transition-all duration-300',
                done ? 'bg-primary' : active ? 'bg-primary/10 ring-2 ring-primary/40' : 'bg-secondary'
              )}>
                {done
                  ? <Check className="h-3.5 w-3.5 text-primary-foreground" />
                  : <Icon className={cn('h-3.5 w-3.5', active ? 'text-primary' : 'text-muted-foreground/50')} />
                }
              </div>
              <span className={cn(
                'text-xs font-medium transition-colors',
                active ? 'text-primary' : done ? 'text-primary/60' : 'text-muted-foreground/50'
              )}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface StepCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function StepCard({ title, subtitle, icon, children }: StepCardProps) {
  const { design } = useSettings();
  return (
    <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
      <div className="h-1.5" style={{ background: `linear-gradient(to right, ${design.gradientFrom}, ${design.gradientTo})` }} />
      <CardContent className="pt-7 pb-7 px-7">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

interface CounterFieldProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

function CounterField({ label, description, value, min, max, onChange }: CounterFieldProps) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-secondary/30 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          className="h-8 w-8 rounded-xl border border-border bg-background flex items-center justify-center hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-6 text-center font-bold text-lg tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          className="h-8 w-8 rounded-xl border border-border bg-background flex items-center justify-center hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

interface WizardFooterProps {
  onNext: () => void;
  onBack?: () => void;
  canNext: boolean;
  isFirst?: boolean;
  nextLabel?: string;
}

function WizardFooter({ onNext, onBack, canNext, isFirst, nextLabel = 'Fortsæt' }: WizardFooterProps) {
  return (
    <div className={cn('flex gap-3 mt-8', isFirst ? 'justify-end' : 'justify-between')}>
      {!isFirst && onBack && (
        <Button variant="outline" onClick={onBack} className="rounded-xl gap-2">
          <ArrowLeft className="h-4 w-4" />
          Tilbage
        </Button>
      )}
      <Button onClick={onNext} disabled={!canNext} className="rounded-xl gap-2 px-6">
        {nextLabel}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface ResultScreenProps {
  state: WizardState;
  rates: CalculationRates;
  postalRanges: PostalRange[];
  onBack: () => void;
  onSave: (amount: number) => Promise<void>;
}

function ResultScreen({ state, rates, postalRanges, onBack, onSave }: ResultScreenProps) {
  const [adjusting, setAdjusting] = useState(false);
  const [adjustPct, setAdjustPct] = useState(0);
  const [saving, setSaving] = useState(false);

  async function handleSave(amount: number) {
    setSaving(true);
    await onSave(amount);
    setSaving(false);
  }

  const breakdown: CalculationBreakdown = calculate(
    state.numberOfAdults,
    state.numberOfChildren,
    state.isStudent,
    state.postalCode,
    state.childrenBirthYears,
    rates,
    postalRanges
  );

  const { adultSubtotal, baseTotal, regionalAdjustment, total, regionalMultiplier, adultRateUsed } = breakdown;

  const adjustedTotal = Math.round(total * (1 + adjustPct / 100));
  const adjustmentDelta = adjustedTotal - total;

  const regionalPct = regionalMultiplier !== 0
    ? `${regionalMultiplier > 0 ? '+' : ''}${Math.round(regionalMultiplier * 100)}%`
    : null;

  const pctLabel = adjustPct === 0
    ? 'Ingen justering'
    : adjustPct > 0
    ? `+${adjustPct}%`
    : `${adjustPct}%`;

  const childrenByAgeGroup: { label: string; count: number; rate: number; subtotal: number }[] = [];
  if (state.childrenBirthYears.length > 0) {
    const groups: Record<string, { label: string; rate: number; count: number }> = {};
    for (const year of state.childrenBirthYears) {
      if (!year) continue;
      const age = CURRENT_YEAR - year;
      let key: string;
      let label: string;
      let rate: number;
      if (age <= 2) { key = '0-2'; label = '0–2 år'; rate = rates.child_0_2; }
      else if (age <= 12) { key = '3-12'; label = '3–12 år'; rate = rates.child_3_12; }
      else { key = '13-17'; label = '13–17 år'; rate = rates.child_13_17; }
      if (!groups[key]) groups[key] = { label, rate, count: 0 };
      groups[key].count++;
    }
    for (const g of Object.values(groups)) {
      childrenByAgeGroup.push({ label: g.label, count: g.count, rate: g.rate, subtotal: g.count * g.rate });
    }
  }

  return (
    <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
      <CardContent className="pt-7 pb-7 px-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <BarChart3 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">Dit estimat</h2>
            <p className="text-sm text-muted-foreground">Månedligt variabelt forbrug</p>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-border/50 bg-secondary/20 px-5 py-5 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-2">
            {adjusting && adjustPct !== 0 ? 'Justeret estimat' : 'Anbefalet estimat'}
          </p>
          <p className="text-5xl font-bold text-emerald-600 tabular-nums transition-all duration-200">
            {adjustedTotal.toLocaleString('da-DK')}
          </p>
          <p className="text-muted-foreground text-sm mt-1">kr. / måned</p>

          {adjusting && adjustPct !== 0 && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary rounded-full px-3 py-1">
              <span>Baseline:</span>
              <span className="font-semibold text-foreground">{total.toLocaleString('da-DK')} kr.</span>
              <span>·</span>
              <span className={adjustmentDelta > 0 ? 'text-rose-500' : 'text-emerald-600'}>
                {adjustmentDelta > 0 ? `+${adjustmentDelta.toLocaleString('da-DK')}` : adjustmentDelta.toLocaleString('da-DK')} kr.
              </span>
            </div>
          )}
        </div>

        <div className="mb-5 rounded-2xl border border-border/40 overflow-hidden">
          <div className="px-4 py-2.5 bg-secondary/30 border-b border-border/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Beregningsgrundlag</p>
          </div>

          <div className="divide-y divide-border/30">
            <BreakdownRow
              label={`Voksne${state.isStudent ? ' (studerende)' : ''}`}
              sublabel={`${state.numberOfAdults} × ${adultRateUsed.toLocaleString('da-DK')} kr.`}
              value={adultSubtotal}
            />

            {childrenByAgeGroup.map((g, i) => (
              <BreakdownRow
                key={i}
                label={`Børn ${g.label}`}
                sublabel={`${g.count} × ${g.rate.toLocaleString('da-DK')} kr.`}
                value={g.subtotal}
              />
            ))}

            <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/10">
              <p className="text-sm font-semibold text-muted-foreground">Subtotal (basis)</p>
              <p className="text-sm font-bold tabular-nums">{baseTotal.toLocaleString('da-DK')} kr.</p>
            </div>

            {regionalAdjustment !== 0 && (
              <BreakdownRow
                label={`Regionalt tillæg`}
                sublabel={`Postnr. ${state.postalCode} · ${regionalPct}`}
                value={regionalAdjustment}
                dimLabel
              />
            )}

            {regionalAdjustment === 0 && (
              <div className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm text-muted-foreground">Regionalt tillæg</p>
                  <p className="text-xs text-muted-foreground/60">Postnr. {state.postalCode} · ingen justering</p>
                </div>
                <p className="text-sm text-muted-foreground tabular-nums">—</p>
              </div>
            )}

            <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 dark:bg-emerald-950/20">
              <p className="font-bold text-sm">Total</p>
              <p className="font-bold text-sm text-emerald-600 tabular-nums">{total.toLocaleString('da-DK')} kr.</p>
            </div>

            <div className="px-4 py-3 bg-emerald-50/50 dark:bg-emerald-950/10 border-t border-emerald-100 dark:border-emerald-900/30">
              <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                Dette er et sundt niveau for en familie som din.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-5 rounded-2xl bg-secondary/20 border border-border/40 px-4 py-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Dækker mad, tøj, fritid, gaver, ferie og småindkøb. Baseret på Finans Danmarks kreditvurderingsstandard.
          </p>
        </div>

        {!adjusting ? (
          <div className="flex flex-col gap-2 mb-6">
            <Button
              onClick={() => handleSave(adjustedTotal)}
              disabled={saving}
              className="w-full rounded-xl gap-2 h-11 text-sm font-semibold"
            >
              <CheckCircle2 className="h-4 w-4" />
              {saving ? 'Gemmer…' : 'Brug dette beløb'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setAdjusting(true)}
              disabled={saving}
              className="w-full rounded-xl gap-2 h-10 text-sm"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Tilpas beløbet
            </Button>
          </div>
        ) : (
          <div className="mb-6 rounded-2xl border border-border/50 bg-secondary/10 px-5 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Manuel justering</span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">{pctLabel}</span>
            </div>
            <Slider
              min={-20}
              max={20}
              step={1}
              value={[adjustPct]}
              onValueChange={([v]) => setAdjustPct(v)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>−20%</span>
              <span className="text-foreground font-medium">{adjustedTotal.toLocaleString('da-DK')} kr.</span>
              <span>+20%</span>
            </div>
            {adjustPct !== 0 && (
              <button
                onClick={() => setAdjustPct(0)}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Tilbage til anbefalet beløb
              </button>
            )}
            <Button
              onClick={() => handleSave(adjustedTotal)}
              disabled={saving}
              className="w-full rounded-xl gap-2 h-11 text-sm font-semibold mt-1"
            >
              <CheckCircle2 className="h-4 w-4" />
              {saving ? 'Gemmer…' : `Brug ${adjustedTotal.toLocaleString('da-DK')} kr.`}
            </Button>
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack} className="rounded-xl gap-2">
            <ArrowLeft className="h-4 w-4" />
            Tilpas oplysninger
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface BreakdownRowProps {
  label: string;
  sublabel?: string | null;
  value: number;
  dimLabel?: boolean;
}

function BreakdownRow({ label, sublabel, value, dimLabel }: BreakdownRowProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div>
        <p className={cn('text-sm font-medium', dimLabel && 'text-muted-foreground')}>{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
      <p className="font-semibold text-sm tabular-nums text-foreground">
        {value === 0 ? '—'
          : value > 0
            ? `+\u00a0${value.toLocaleString('da-DK')} kr.`
            : `−\u00a0${Math.abs(value).toLocaleString('da-DK')} kr.`
        }
      </p>
    </div>
  );
}
