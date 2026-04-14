'use client';

import { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { ArrowRight, ShoppingCart, Car, Coffee, Gamepad2, Package, TrendingUp, TrendingDown, Check } from 'lucide-react';
import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/number-helpers';
import { useAiContext } from '@/lib/ai-context';
import {
  calculate,
  fetchRates,
  fetchPostalRanges,
  DEFAULT_RATES,
  DEFAULT_POSTAL_RANGES,
  type CalculationRates,
  type PostalRange,
} from '@/lib/calculation-engine';

interface VariableCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  baseAmount: number;
  amount: number;
}

interface Props {
  budgetId: string;
  monthlyIncome: number;
  fixedExpenses: number;
  onComplete: () => void;
  onDismiss: () => void;
}

const TOTAL_STEPS = 3;
const STEP_LABELS = ['Intro', 'Estimat', 'Realitets-check'];
const STEP_GRADIENTS = [
  'linear-gradient(160deg, #fffbeb 0%, #fef3c7 30%, #ffffff 100%)',
  'linear-gradient(160deg, #fef3c7 0%, #fffbeb 40%, #ffffff 100%)',
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 40%, #ffffff 100%)',
];

export function VariableExpenseWizard({ budgetId, monthlyIncome, fixedExpenses, onComplete, onDismiss }: Props) {
  const { user } = useAuth();
  const { setWizardActive } = useAiContext();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);
  const { animating, direction, animate } = useWizardAnimation();
  const [rates, setRates] = useState<CalculationRates>(DEFAULT_RATES);
  const [postalRanges, setPostalRanges] = useState<PostalRange[]>(DEFAULT_POSTAL_RANGES);
  const [categories, setCategories] = useState<VariableCategory[]>([]);
  const [nuvioFlowBudget, setNuvioFlowBudget] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setWizardActive(true);
    return () => setWizardActive(false);
  }, [setWizardActive]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const color = 'rgb(255,251,235)';
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
  }, []);

  useEffect(() => {
    if (!user) return;
    async function init() {
      const [r, pr, householdRow, defaultsRow, nuvioFlowRow] = await Promise.all([
        fetchRates(),
        fetchPostalRanges(),
        supabase.from('household').select('*').eq('user_id', user!.id).maybeSingle(),
        supabase.from('wizard_defaults').select('key, value').eq('type', 'variable'),
        supabase.from('quick_expense_budgets').select('monthly_budget').eq('user_id', user!.id).maybeSingle(),
      ]);

      const household = householdRow.data;
      const adults = household?.adult_count ?? 1;
      const children = household?.child_count ?? 0;
      const isStudent = household?.variable_is_student ?? false;
      const postalCode = household?.variable_postal_code ?? '';
      const birthYears: (number | null)[] = household?.variable_children_birth_years ?? Array(children).fill(null);

      const breakdown = calculate(adults, children, isStudent, postalCode, birthYears, r, pr);

      const dbDefaults = (defaultsRow.data ?? []) as { key: string; value: number }[];
      function getAmt(key: string, fallback: number): number {
        const d = dbDefaults.find(x => x.key === key);
        return d ? d.value : fallback;
      }

      // Check if user has Nuvio Flow data
      const nuvioMonthlyBudget = nuvioFlowRow.data?.monthly_budget ?? 0;
      const hasNuvioFlow = nuvioMonthlyBudget > 0;

      if (hasNuvioFlow) {
        setNuvioFlowBudget(nuvioMonthlyBudget);
      }

      const foodBase = hasNuvioFlow ? nuvioMonthlyBudget : getAmt('food_pct', 3000);
      const transportBase = hasNuvioFlow ? 0 : getAmt('transport_pct', 1200);
      const cafeBase = hasNuvioFlow ? 0 : getAmt('cafe_pct', 600);
      const leisureBase = hasNuvioFlow ? 0 : getAmt('leisure_pct', 700);
      const otherBase = hasNuvioFlow ? 0 : getAmt('misc_pct', 800);

      setRates(r);
      setPostalRanges(pr);
      setCategories([
        { id: 'food', label: 'Mad & dagligvarer', icon: <ShoppingCart className="h-4 w-4" />, baseAmount: foodBase, amount: foodBase },
        { id: 'transport', label: 'Transport', icon: <Car className="h-4 w-4" />, baseAmount: transportBase, amount: transportBase },
        { id: 'cafe', label: 'Café & takeaway', icon: <Coffee className="h-4 w-4" />, baseAmount: cafeBase, amount: cafeBase },
        { id: 'leisure', label: 'Fritid & underholdning', icon: <Gamepad2 className="h-4 w-4" />, baseAmount: leisureBase, amount: leisureBase },
        { id: 'misc', label: 'Diverse', icon: <Package className="h-4 w-4" />, baseAmount: otherBase, amount: otherBase },
      ]);
    }
    init();
  }, [user]);

  const currentTotal = categories.reduce((s, c) => s + c.amount, 0);
  const disposable = monthlyIncome - fixedExpenses - currentTotal;

  function updateAmount(id: string, value: number) {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, amount: value } : c));
  }

  function next() { animate('forward', () => setStep(s => s + 1)); }
  function back() { animate('back', () => setStep(s => s - 1)); }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('household')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      if (existing) {
        const { error } = await supabase
          .from('household')
          .update({ variable_expense_estimate: currentTotal, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('household')
          .insert({ user_id: user.id, variable_expense_estimate: currentTotal });
        if (error) throw error;
      }

      if (budgetId) {
        const { error } = await supabase
          .from('budgets')
          .update({ has_variable_budget: true, updated_at: new Date().toISOString() } as any)
          .eq('id', budgetId);
        if (error) throw error;
      }

      onComplete();
    } catch (err: any) {
      toast.error(err?.message ?? 'Kunne ikke gemme');
    } finally {
      setSaving(false);
    }
  }

  return (
    <WizardShell
      gradient={STEP_GRADIENTS[Math.min(step, STEP_GRADIENTS.length - 1)]}
      visible={visible}
      step={step}
      totalSteps={TOTAL_STEPS}
      showBack={step > 0}
      showClose={true}
      onBack={back}
      onClose={onDismiss}
      animating={animating}
      direction={direction}
    >

            {step === 0 && (
              <div className="flex flex-col flex-1 justify-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-8">
                  <ShoppingCart className="h-8 w-8 text-amber-600" />
                </div>
                <p className="text-label font-semibold uppercase tracking-widest text-amber-600/70 mb-4">
                  Variabelt forbrug
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-4">
                  Det her vælter budgetter.
                </h2>
                <p className="text-foreground/60 text-lg leading-relaxed mb-4">
                  Faste udgifter er ét — men det daglige forbrug er det, der oftest sprænger rammen.
                </p>
                <p className="text-foreground/60 text-base leading-relaxed">
                  Vi sætter et realistisk estimat på mad, transport, café og alt det andet — baseret på din husstand.
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col flex-1">
                <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70 mb-4">
                  Hurtigt estimat
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-3">
                  {nuvioFlowBudget ? 'Dit Udgifter-budget.' : 'Juster til dig.'}
                </h2>
                <p className="text-foreground/60 text-base leading-relaxed mb-4">
                  {nuvioFlowBudget
                    ? 'Vi har brugt dit månedlige budget fra Udgifter — juster hvis du vil ændre det.'
                    : 'Vi har forberegnet ud fra din husstand — juster til det passer.'}
                </p>
                {nuvioFlowBudget && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/60 border border-emerald-200/60 mb-6">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <p className="text-sm text-emerald-700">
                      Hentet fra dit Udgifter-budget
                    </p>
                  </div>
                )}

                <div className="space-y-5 flex-1">
                  {categories.map((cat) => (
                    <div key={cat.id}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-white/60 backdrop-blur border border-foreground/8 flex items-center justify-center text-foreground/60 shrink-0">
                            {cat.icon}
                          </div>
                          <span className="text-sm font-medium">{cat.label}</span>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">{formatCurrency(cat.amount, {})}</span>
                      </div>
                      <Slider
                        min={0}
                        max={cat.baseAmount * 3}
                        step={100}
                        value={[cat.amount]}
                        onValueChange={([v]) => updateAmount(cat.id, v)}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-5 border-t border-foreground/8 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Samlet estimat / md.</div>
                    <div className="text-2xl font-bold tabular-nums">{formatCurrency(currentTotal, {})}</div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col flex-1">
                <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70 mb-4">
                  Realitets-check
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-3">
                  Din økonomi samlet.
                </h2>
                <p className="text-foreground/60 text-base leading-relaxed mb-6">
                  Sådan ser det ud med variabelt forbrug medregnet.
                </p>

                <div className="space-y-3 flex-1">
                  <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white/60 backdrop-blur border border-foreground/8">
                    <div className="flex items-center gap-2.5">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-medium">Indkomst</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-emerald-600">
                      +{formatCurrency(monthlyIncome, {})}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white/60 backdrop-blur border border-foreground/8">
                    <div className="flex items-center gap-2.5">
                      <TrendingDown className="h-4 w-4 text-red-400" />
                      <span className="text-sm font-medium">Faste udgifter</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-red-500">
                      -{formatCurrency(fixedExpenses, {})}
                    </span>
                  </div>

                  <div className="rounded-2xl bg-white/60 backdrop-blur border border-foreground/8">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <ShoppingCart className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium">Variabelt forbrug</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-amber-600">
                        -{formatCurrency(currentTotal, {})}
                      </span>
                    </div>
                    {nuvioFlowBudget && (
                      <div className="px-4 pb-2">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                          <Check className="h-3 w-3" />
                          <span>Fra Udgifter</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={`flex items-center justify-between px-4 py-4 rounded-2xl border-2 ${
                    disposable >= 0
                      ? 'border-emerald-200 bg-emerald-50/60'
                      : 'border-red-200 bg-red-50/60'
                  }`}>
                    <span className="text-sm font-bold">Rådighedsbeløb</span>
                    <span className={`text-lg font-bold tabular-nums ${
                      disposable >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {disposable >= 0 ? '+' : ''}{formatCurrency(disposable, {})}
                    </span>
                  </div>

                  {disposable < 0 && (
                    <div className="px-4 py-3 rounded-2xl bg-amber-50/80 border border-amber-200/60">
                      <p className="text-sm text-amber-700">
                        Budgettet er i minus. Overvej at justere dit forbrug — eller gå tilbage og ret tallene.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

          <div className="pt-6">
            {step === 0 && (
              <button
                onClick={next}
                className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                Start estimat
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {step === 1 && (
              <button
                onClick={next}
                className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                Det ser rigtigt ud
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {step === 2 && (
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
                >
                  {saving ? 'Gemmer...' : (
                    <>
                      <Check className="h-4 w-4" />
                      Gå til Kuvert
                    </>
                  )}
                </button>
                <button
                  onClick={back}
                  className="h-14 px-5 rounded-2xl font-semibold text-sm border-2 border-foreground/12 bg-white/50 hover:border-foreground/25 transition-all active:scale-95"
                >
                  Juster
                </button>
              </div>
            )}
          </div>
    </WizardShell>
  );
}
