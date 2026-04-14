'use client';

import { useState, useEffect } from 'react';
import { useAdminLabel } from '@/components/admin-page-label';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { fetchRates, fetchPostalRanges, calculate, type CalculationRates, type CalculationBreakdown, type PostalRange, DEFAULT_RATES, DEFAULT_POSTAL_RANGES } from '@/lib/calculation-engine';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, X, Users, MapPin, Baby, Check, GraduationCap, Minus, Plus, SlidersHorizontal, CircleCheck as CheckCircle2, ShoppingCart } from 'lucide-react';
import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAiContext } from '@/lib/ai-context';

interface WizardState {
  numberOfAdults: number;
  numberOfChildren: number;
  isStudent: boolean;
  postalCode: string;
  childrenBirthYears: (number | null)[];
}

const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEAR_OPTIONS = Array.from({ length: 20 }, (_, i) => CURRENT_YEAR - i);

function getAge(birthYear: number): number {
  return CURRENT_YEAR - birthYear;
}

interface Props {
  onComplete: () => void;
  onDismiss: () => void;
}

const VAR_STEP_LABELS: Record<number, string> = {
  0: 'Intro',
  1: 'Husstand',
  2: 'Postnummer',
  3: 'Børn',
  4: 'Resultat',
};

const STEP_GRADIENTS = [
  'linear-gradient(160deg, #fffbeb 0%, #fef3c7 30%, #ffffff 100%)',
  'linear-gradient(160deg, #fef3c7 0%, #fffbeb 50%, #ffffff 100%)',
  'linear-gradient(160deg, #fffbeb 0%, #fef3c7 30%, #ffffff 100%)',
  'linear-gradient(160deg, #fef3c7 0%, #fffbeb 40%, #ffffff 100%)',
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 40%, #ffffff 100%)',
];

export function VariableForbrugWizardModal({ onComplete, onDismiss }: Props) {
  const { user } = useAuth();
  const { setWizard } = useAdminLabel();
  const { setWizardActive } = useAiContext();
  const [rates, setRates] = useState<CalculationRates>(DEFAULT_RATES);
  const [postalRanges, setPostalRanges] = useState<PostalRange[]>(DEFAULT_POSTAL_RANGES);
  const [showIntro, setShowIntro] = useState(true);
  const [step, setStep] = useState(1);
  const [visible, setVisible] = useState(false);
  const { animating, direction, animate } = useWizardAnimation();
  const [nuvioFlowBudgetAmount, setNuvioFlowBudgetAmount] = useState<number | null>(null);

  const [state, setState] = useState<WizardState>({
    numberOfAdults: 1,
    numberOfChildren: 0,
    isStudent: false,
    postalCode: '',
    childrenBirthYears: [],
  });

  useEffect(() => {
    setWizardActive(true);
    return () => setWizardActive(false);
  }, [setWizardActive]);

  useEffect(() => {
    const label = showIntro ? 'Intro' : VAR_STEP_LABELS[step];
    const stepNum = showIntro ? 0 : step;
    setWizard({ name: 'Variable Forbrug', step: stepNum, totalSteps: 4, stepLabel: label });
    return () => setWizard(null);
  }, [step, showIntro]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const color = showIntro || step < 4 ? 'rgb(255,251,235)' : 'rgb(236,253,245)';
    document.body.style.backgroundColor = color;
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
    return () => {
      document.body.style.backgroundColor = '';
      if (meta) meta.content = '#ffffff';
    };
  }, [step, showIntro]);

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  async function loadAll() {
    try {
      const now = new Date();
      const curYear = now.getFullYear();
      const curMonth = now.getMonth() + 1;

      const [householdResult, loadedRates, loadedRanges, nuvioFlowBudget] = await Promise.all([
        user
          ? supabase.from('household').select('adult_count, child_count, variable_postal_code, variable_is_student, variable_children_birth_years, variable_expense_estimate').eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        fetchRates(),
        fetchPostalRanges(),
        supabase
          .from('quick_expense_monthly_budgets')
          .select('budget_amount')
          .eq('user_id', user!.id)
          .eq('year', curYear)
          .eq('month', curMonth)
          .maybeSingle(),
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
      }

      // Check if we have a Nuvio Flow budget but no Variable Udgifter estimate
      const hasEstimate = householdResult.data?.variable_expense_estimate != null;
      const hasNuvioFlowBudget = nuvioFlowBudget.data?.budget_amount != null && nuvioFlowBudget.data.budget_amount > 0;

      if (hasNuvioFlowBudget && nuvioFlowBudget.data) {
        setNuvioFlowBudgetAmount(nuvioFlowBudget.data.budget_amount);
      }

      if (!hasEstimate && hasNuvioFlowBudget) {
        toast.info('Vi foreslår dit rådighedsbeløb fra Udgifter som udgangspunkt');
      }
    } catch {
      toast.error('Kunne ikke indlæse husstandsdata');
    }
  }

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState(prev => ({ ...prev, [key]: value }));
  }

  function setAdults(n: number) {
    update('numberOfAdults', Math.max(1, Math.min(6, n)));
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

  const hasChildren = state.numberOfChildren > 0;
  const stepsWithChildren = [1, 2, 3, 4];
  const stepsWithoutChildren = [1, 2, 4];
  const stepIds = hasChildren ? stepsWithChildren : stepsWithoutChildren;
  const currentIndex = stepIds.indexOf(step);
  const totalSteps = stepIds.length;
  const displayStep = currentIndex + 1;

  function goNext() {
    const nextId = stepIds[currentIndex + 1];
    if (nextId) animate('forward', () => setStep(nextId));
  }

  function goBack() {
    if (currentIndex === 0) {
      setShowIntro(true);
      return;
    }
    const prevId = stepIds[currentIndex - 1];
    if (prevId) animate('back', () => setStep(prevId));
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
    const { data: existing } = await supabase.from('household').select('id').eq('user_id', user.id).maybeSingle();
    let error;
    if (existing) {
      ({ error } = await supabase.from('household').update(payload).eq('user_id', user.id));
    } else {
      ({ error } = await supabase.from('household').insert({ ...payload, user_id: user.id }));
    }
    if (error) { toast.error('Kunne ikke gemme estimat'); return; }
    const { data: activeBudget } = await supabase.from('budgets').select('id').eq('is_active', true).maybeSingle();
    if (activeBudget) {
      await supabase.from('budgets').update({ has_variable_budget: true } as any).eq('id', activeBudget.id);
    }
    onComplete();
  }

  const canContinueStep1 = state.numberOfAdults >= 1;
  const canContinueStep2 = state.postalCode.length === 4 && /^\d{4}$/.test(state.postalCode);
  const canContinueStep3 = state.childrenBirthYears.every(y => y !== null);

  const currentGradient = showIntro ? STEP_GRADIENTS[0] : STEP_GRADIENTS[Math.min(step - 1, STEP_GRADIENTS.length - 1)];

  if (showIntro) {
    return (
      <div
        className="fixed inset-0 z-[80]"
        style={{
          background: STEP_GRADIENTS[0],
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.4s ease',
          left: 'var(--sidebar-offset-global, 0px)',
        }}
      >
        <div
          className="max-w-lg mx-auto px-5 flex flex-col justify-center"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)', paddingBottom: 'calc(var(--mobile-nav-height, 58px) + env(safe-area-inset-bottom, 0px) + 1rem)', minHeight: '100dvh' }}
        >
          <div className="flex items-center justify-between pb-8">
            <div className="w-10" />
            <div className="w-10 flex justify-end">
              <button
                onClick={onDismiss}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/60 border border-white/40 text-foreground/50 hover:text-foreground hover:bg-white/80 transition-all active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="h-16 w-16 rounded-2xl bg-white/80 border border-white/60 shadow-sm flex items-center justify-center">
              <ShoppingCart className="h-8 w-8 text-amber-500" />
            </div>
            <div className="space-y-3">
              <p className="text-label font-semibold uppercase tracking-widest text-amber-600/70">
                Variable udgifter
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                Det her vælter budgetter
              </h2>
            </div>
            <p className="text-foreground/60 text-lg leading-relaxed">
              Faste udgifter er ét — men det daglige forbrug er det, der oftest sprænger rammen.
            </p>
            <p className="text-foreground/60 text-base leading-relaxed">
              Vi sætter et realistisk estimat på mad, transport, café og alt det andet — baseret på din husstand.
            </p>
          </div>

          <div className="pt-8 space-y-2">
            <button
              onClick={() => setShowIntro(false)}
              className="w-full h-14 rounded-2xl font-semibold text-base text-white flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all duration-200"
              style={{ background: 'linear-gradient(to right, #d97706, #f59e0b)' }}
            >
              Start estimat
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={onDismiss}
              className="w-full text-sm text-foreground/40 hover:text-foreground/70 py-2 transition-colors"
            >
              Spring over for nu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <WizardShell
      gradient={currentGradient}
      visible={visible}
      step={currentIndex}
      totalSteps={totalSteps}
      isDone={step === 4}
      showBack={true}
      showClose={true}
      onBack={goBack}
      onClose={onDismiss}
      animating={animating}
      direction={direction}
    >

            {/* Step 1 — Household */}
            {step === 1 && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="space-y-2">
                  <p className="text-label font-semibold uppercase tracking-widest text-amber-600/70">
                    Din husstand
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                    Fortæl os hvem I er hjemme
                  </h2>
                </div>
                <div className="space-y-3 flex-1">
                  <CounterField label="Voksne" description="Antal voksne i husstanden" value={state.numberOfAdults} min={1} max={6} onChange={setAdults} />
                  <CounterField label="Hjemmeboende børn" description="Børn der bor hjemme" value={state.numberOfChildren} min={0} max={8} onChange={setChildren} />
                  <button
                    type="button"
                    onClick={() => update('isStudent', !state.isStudent)}
                    className={cn(
                      'w-full flex items-center gap-4 rounded-2xl px-5 py-4 border-2 transition-all duration-200',
                      state.isStudent ? 'border-amber-400 bg-white/80 shadow-sm' : 'border-white/50 bg-white/60 hover:border-amber-200 hover:bg-white/80'
                    )}
                  >
                    <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors', state.isStudent ? 'bg-amber-500 text-white' : 'bg-white/80 border border-white/60 text-foreground/40')}>
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-sm text-foreground">Jeg er studerende</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Vi justerer estimatet for studieøkonomi</p>
                    </div>
                    {state.isStudent && (
                      <div className="h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 — Postal code */}
            {step === 2 && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="space-y-2">
                  <p className="text-label font-semibold uppercase tracking-widest text-amber-600/70">
                    Postnummer
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                    Leveomkostninger varierer
                  </h2>
                  <p className="text-foreground/60 text-base leading-relaxed">
                    Leveomkostninger varierer på tværs af Danmark
                  </p>
                </div>
                <div className="flex-1 space-y-3">
                  <Label htmlFor="postalCode" className="text-sm font-semibold text-foreground/70">
                    Dit postnummer
                  </Label>
                  <Input
                    id="postalCode"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="f.eks. 2100"
                    value={state.postalCode}
                    onChange={e => update('postalCode', e.target.value.replace(/\D/g, '').slice(0, 4))}
                    onKeyDown={e => { if (e.key === 'Enter' && canContinueStep2) goNext(); }}
                    className="text-2xl font-bold tracking-widest h-16 text-center rounded-2xl border-2 border-white/50 bg-white/70 focus:border-amber-400"
                    autoFocus
                  />
                  <div className="rounded-2xl bg-white/60 backdrop-blur border border-white/40 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">Vi bruger kun dit postnummer til at forbedre dit estimat. Ingen persondata gemmes.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 — Children ages */}
            {step === 3 && state.numberOfChildren > 0 && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="space-y-2">
                  <p className="text-label font-semibold uppercase tracking-widest text-amber-600/70">
                    Børnenes alder
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                    Forbrug afhænger af barnets alder
                  </h2>
                </div>
                <div className="space-y-2.5 flex-1">
                  {state.childrenBirthYears.map((year, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-2xl bg-white/60 backdrop-blur border border-white/40 px-4 py-3">
                      <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                        <Baby className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Barn {i + 1}</p>
                        {year !== null && <p className="text-xs text-muted-foreground">{getAge(year)} år</p>}
                      </div>
                      <Select value={year != null ? String(year) : ''} onValueChange={v => setChildBirthYear(i, Number(v))}>
                        <SelectTrigger className="w-32 rounded-xl bg-white/70 border-white/40">
                          <SelectValue placeholder="Fødselsår" />
                        </SelectTrigger>
                        <SelectContent>
                          {BIRTH_YEAR_OPTIONS.map(y => (
                            <SelectItem key={y} value={String(y)}>{y} ({getAge(y)} år)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4 — Result */}
            {step === 4 && (
              <ResultScreen
                state={state}
                rates={rates}
                postalRanges={postalRanges}
                nuvioFlowBudget={nuvioFlowBudgetAmount}
                onBack={goBack}
                onSave={(amount) => saveEstimate(amount, state)}
              />
            )}

          {/* CTA */}
          {step < 4 && (
            <div className="pt-6 shrink-0">
              <button
                onClick={goNext}
                disabled={
                  (step === 1 && !canContinueStep1) ||
                  (step === 2 && !canContinueStep2) ||
                  (step === 3 && !canContinueStep3)
                }
                className="w-full h-14 rounded-2xl font-semibold text-base text-white flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(to right, #d97706, #f59e0b)' }}
              >
                {step === 3 ? 'Beregn' : 'Fortsæt'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
    </WizardShell>
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
    <div className="flex items-center gap-4 rounded-2xl bg-white/60 backdrop-blur border border-white/40 px-4 py-3.5">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} className="h-9 w-9 rounded-xl border border-white/50 bg-white/80 flex items-center justify-center hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-6 text-center font-bold text-lg tabular-nums">{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} className="h-9 w-9 rounded-xl border border-white/50 bg-white/80 flex items-center justify-center hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

interface ResultScreenProps {
  state: WizardState;
  rates: CalculationRates;
  postalRanges: PostalRange[];
  nuvioFlowBudget: number | null;
  onBack: () => void;
  onSave: (amount: number) => Promise<void>;
}

function ResultScreen({ state, rates, postalRanges, nuvioFlowBudget, onBack, onSave }: ResultScreenProps) {
  const [adjusting, setAdjusting] = useState(false);
  const [adjustPct, setAdjustPct] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showNuvioFlowSync, setShowNuvioFlowSync] = useState(false);

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

  const pctLabel = adjustPct === 0 ? 'Ingen justering' : adjustPct > 0 ? `+${adjustPct}%` : `${adjustPct}%`;

  const childrenByAgeGroup: { label: string; count: number; rate: number; subtotal: number }[] = [];
  if (state.childrenBirthYears.length > 0) {
    const groups: Record<string, { label: string; rate: number; count: number }> = {};
    for (const year of state.childrenBirthYears) {
      if (!year) continue;
      const age = CURRENT_YEAR - year;
      let key: string; let label: string; let rate: number;
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
    <div className="flex-1 flex flex-col space-y-5">
      <div className="space-y-2">
        <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
          Dit estimat
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
          Månedligt variabelt forbrug
        </h2>
      </div>

      <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/50 px-5 py-6 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-2">
          {adjusting && adjustPct !== 0 ? 'Justeret estimat' : 'Anbefalet estimat'}
        </p>
        <p className="text-6xl font-bold text-emerald-600 tabular-nums transition-all duration-200">
          {adjustedTotal.toLocaleString('da-DK')}
        </p>
        <p className="text-muted-foreground text-sm mt-1">kr. / måned</p>
        {adjusting && adjustPct !== 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-white/60 rounded-full px-3 py-1">
            <span>Baseline: {total.toLocaleString('da-DK')} kr.</span>
            <span>·</span>
            <span className={adjustmentDelta > 0 ? 'text-rose-500' : 'text-emerald-600'}>
              {adjustmentDelta > 0 ? `+${adjustmentDelta.toLocaleString('da-DK')}` : adjustmentDelta.toLocaleString('da-DK')} kr.
            </span>
          </div>
        )}
      </div>

      {/* Nuvio Flow status hvis det findes */}
      {nuvioFlowBudget !== null && nuvioFlowBudget > 0 && (
        <div className="rounded-2xl bg-blue-50/80 border border-blue-200/60 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-xs font-semibold text-blue-800 mb-1">Dit aktuelle rådighedsbeløb i Udgifter</p>
              <p className="text-sm text-blue-700/80">
                {nuvioFlowBudget.toLocaleString('da-DK')} kr./måned
              </p>
              {Math.abs(adjustedTotal - nuvioFlowBudget) > 500 && (
                <p className="text-xs text-blue-600/70 mt-2 leading-relaxed">
                  Dit rådighedsbeløb i Udgifter er anderledes end dette estimat.
                </p>
              )}
            </div>
            {Math.abs(adjustedTotal - nuvioFlowBudget) > 500 && (
              <button
                onClick={() => setAdjustPct(Math.round(((nuvioFlowBudget - total) / total) * 100))}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 underline underline-offset-2 shrink-0"
              >
                Brug {nuvioFlowBudget.toLocaleString('da-DK')} kr.
              </button>
            )}
          </div>
        </div>
      )}

      {/* Beregningsgrundlag - kun hvis IKKE Nuvio Flow */}
      {!(nuvioFlowBudget !== null && nuvioFlowBudget > 0 && Math.abs(adjustedTotal - nuvioFlowBudget) < 500) && (
        <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/50 overflow-hidden">
        <div className="px-4 py-3 bg-white/40 border-b border-white/40">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Beregningsgrundlag</p>
        </div>
        <div className="divide-y divide-white/40">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{`Voksne${state.isStudent ? ' (studerende)' : ''}`}</p>
              <p className="text-xs text-muted-foreground">{state.numberOfAdults} × {adultRateUsed.toLocaleString('da-DK')} kr.</p>
            </div>
            <p className="font-semibold text-sm tabular-nums text-foreground">{adultSubtotal.toLocaleString('da-DK')} kr.</p>
          </div>
          {childrenByAgeGroup.map((g, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">Børn {g.label}</p>
                <p className="text-xs text-muted-foreground">{g.count} × {g.rate.toLocaleString('da-DK')} kr.</p>
              </div>
              <p className="font-semibold text-sm tabular-nums">{g.subtotal.toLocaleString('da-DK')} kr.</p>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3 bg-white/30">
            <p className="text-sm font-semibold text-muted-foreground">Subtotal (basis)</p>
            <p className="text-sm font-bold tabular-nums">{baseTotal.toLocaleString('da-DK')} kr.</p>
          </div>
          {regionalAdjustment !== 0 && (
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm text-muted-foreground">Regionalt tillæg</p>
                <p className="text-xs text-muted-foreground/60">Postnr. {state.postalCode} · {regionalPct}</p>
              </div>
              <p className="font-semibold text-sm tabular-nums">
                {regionalAdjustment > 0 ? `+\u00a0${regionalAdjustment.toLocaleString('da-DK')}` : `−\u00a0${Math.abs(regionalAdjustment).toLocaleString('da-DK')}`} kr.
              </p>
            </div>
          )}
          {regionalAdjustment === 0 && (
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm text-muted-foreground">Regionalt tillæg</p>
                <p className="text-xs text-muted-foreground/60">Postnr. {state.postalCode} · ingen justering</p>
              </div>
              <p className="text-sm text-muted-foreground tabular-nums">—</p>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3 bg-emerald-50/50">
            <p className="font-bold text-sm">Total</p>
            <p className="font-bold text-sm text-emerald-600 tabular-nums">{total.toLocaleString('da-DK')} kr.</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white/60 backdrop-blur border border-white/40 px-4 py-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Dækker mad, tøj, fritid, gaver, ferie og småindkøb. Baseret på Finans Danmarks kreditvurderingsstandard.
          </p>
        </div>
      </div>
      )}

      {adjusting && (
        <div className="rounded-2xl bg-white/60 backdrop-blur border border-white/40 px-5 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Manuel justering</span>
            </div>
            <span className="text-sm font-semibold tabular-nums">{pctLabel}</span>
          </div>
          <Slider min={-20} max={20} step={1} value={[adjustPct]} onValueChange={([v]) => setAdjustPct(v)} className="w-full" />
          <div className="flex justify-between text-xs text-muted-foreground px-1">
            <span>−20%</span>
            <span className="text-foreground font-medium">{adjustedTotal.toLocaleString('da-DK')} kr.</span>
            <span>+20%</span>
          </div>
          {adjustPct !== 0 && (
            <button onClick={() => setAdjustPct(0)} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors">
              Tilbage til anbefalet beløb
            </button>
          )}
        </div>
      )}

      <div className="space-y-2 pt-2">
        <button
          onClick={() => handleSave(adjustedTotal)}
          disabled={saving}
          className="w-full h-14 rounded-2xl font-semibold text-base text-white flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all duration-200 disabled:opacity-60"
          style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
        >
          <CheckCircle2 className="h-4 w-4" />
          {saving ? 'Gemmer…' : `Brug ${adjustedTotal.toLocaleString('da-DK')} kr.`}
        </button>
        {!adjusting && (
          <button
            onClick={() => setAdjusting(true)}
            disabled={saving}
            className="w-full h-11 rounded-2xl text-sm font-semibold text-foreground/70 border-2 border-white/50 bg-white/60 hover:bg-white/80 transition-all flex items-center justify-center gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Tilpas beløbet
          </button>
        )}
        <button
          onClick={onBack}
          className="w-full text-sm text-foreground/40 hover:text-foreground/70 py-1 transition-colors"
        >
          Tilpas oplysninger
        </button>
      </div>
    </div>
  );
}
