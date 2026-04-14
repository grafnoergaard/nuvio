'use client';

import { useState, useEffect } from 'react';
import { useAdminLabel } from '@/components/admin-page-label';
import { useAuth } from '@/lib/auth-context';
import { Input } from '@/components/ui/input';
import {
  ArrowRight, Check,
  User, Users, Plus, Trash2, Sparkles,
} from 'lucide-react';
import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/number-helpers';
import { useAiContext } from '@/lib/ai-context';

interface IncomeEntry {
  id: string;
  name: string;
  amount: number;
  isFromHousehold: boolean;
}

interface Props {
  onComplete: () => void;
  onDismiss: () => void;
}

const TOTAL_STEPS = 2;

const STEP_LABELS = ['Indkomst', 'Bekræft'];
const STEP_GRADIENTS = [
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 40%, #ffffff 100%)',
  'linear-gradient(160deg, #f0fdfa 0%, #ecfdf5 40%, #ffffff 100%)',
];

const INCOME_INTERVALS = [
  { label: '30.000-40.000 kr./md.', min: 30000, max: 40000, midpoint: 35000 },
  { label: '40.000-50.000 kr./md.', min: 40000, max: 50000, midpoint: 45000 },
  { label: '50.000-60.000 kr./md.', min: 50000, max: 60000, midpoint: 55000 },
  { label: '60.000-70.000 kr./md.', min: 60000, max: 70000, midpoint: 65000 },
  { label: '70.000-80.000 kr./md.', min: 70000, max: 80000, midpoint: 75000 },
  { label: 'Over 80.000 kr./md.', min: 80000, max: 100000, midpoint: 90000 },
];

export function IncomeWizard({ onComplete, onDismiss }: Props) {
  const { user } = useAuth();
  const { setWizard } = useAdminLabel();
  const { setWizardActive } = useAiContext();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);
  const { animating, direction, animate } = useWizardAnimation();

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setWizardActive(true);
    return () => setWizardActive(false);
  }, [setWizardActive]);

  useEffect(() => {
    setWizard({ name: 'Indkomst', step: step + 1, totalSteps: TOTAL_STEPS, stepLabel: STEP_LABELS[step] ?? '' });
    return () => setWizard(null);
  }, [step]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const color = 'rgb(236,253,245)';
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

  const [householdLoaded, setHouseholdLoaded] = useState(false);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [realisticAnswer, setRealisticAnswer] = useState<'yes' | 'adjust' | null>(null);
  const [preciseAmount, setPreciseAmount] = useState<string>('');
  const [selectedInterval, setSelectedInterval] = useState<number | null>(null);

  useEffect(() => {
    loadHousehold();
  }, []);

  async function loadHousehold() {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const query = supabase.from('household').select('*');
      if (currentUser) query.eq('user_id', currentUser.id);
      const { data: household } = await query.maybeSingle();

      if (household?.household_income && household.household_income > 0) {
        if (household.household_income_is_precise) {
          setPreciseAmount(String(household.household_income));
        } else {
          const interval = INCOME_INTERVALS.findIndex(i => i.midpoint === household.household_income);
          if (interval !== -1) setSelectedInterval(interval);
        }
      }
    } catch {
    } finally {
      setHouseholdLoaded(true);
    }
  }

  const finalIncome = preciseAmount ? parseFloat(preciseAmount) || 0 : (selectedInterval !== null ? INCOME_INTERVALS[selectedInterval].midpoint : 0);
  const isPrecise = !!preciseAmount && parseFloat(preciseAmount) > 0;

  function handlePreciseChange(value: string) {
    setPreciseAmount(value);
    if (value) setSelectedInterval(null);
  }

  function handleIntervalSelect(idx: number) {
    setSelectedInterval(idx);
    setPreciseAmount('');
  }

  function next() { animate('forward', () => setStep(s => s + 1)); }
  function back() { animate('back', () => setStep(s => s - 1)); }

  async function handleSave() {
    setSaving(true);
    try {
      if (!user) throw new Error('Not authenticated');
      const { data: existing } = await supabase.from('household').select('id').eq('user_id', user.id).maybeSingle();

      const payload = {
        household_income: finalIncome,
        household_income_is_precise: isPrecise,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from('household').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('household').insert({
          user_id: user.id,
          adult_count: 1,
          child_count: 0,
          members: [],
          ...payload,
        });
      }

      toast.success('Indkomst er gemt!');
      onComplete();
    } catch {
      toast.error('Noget gik galt. Prøv igen.');
    } finally {
      setSaving(false);
    }
  }

  const canAdvanceStep0 = householdLoaded && (finalIncome > 0);

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
              <div className="flex flex-col flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600/70 mb-4">
                  <Sparkles className="inline h-3 w-3 mr-1" />
                  Indkomst
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-3">
                  Hvad er jeres samlede indkomst?
                </h2>
                <p className="text-foreground/60 text-base leading-relaxed mb-6">
                  Månedlig nettoindkomst efter skat
                </p>

                <div className="space-y-3 flex-1">
                  <label className="block text-sm font-medium text-foreground/80 mb-2">
                    Indtast præcist beløb
                  </label>
                  <div className="flex items-center gap-2 mb-6">
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={preciseAmount}
                      onChange={(e) => handlePreciseChange(e.target.value)}
                      className="h-14 rounded-xl text-right text-xl font-semibold border-2 border-emerald-400 bg-white"
                      placeholder="45000"
                      autoFocus
                    />
                    <span className="text-base text-muted-foreground whitespace-nowrap font-medium">kr./md.</span>
                  </div>

                  <div className="text-center text-sm text-muted-foreground py-3 flex items-center gap-2 justify-center">
                    <div className="flex-1 h-px bg-foreground/10"></div>
                    <span>eller vælg ca. interval</span>
                    <div className="flex-1 h-px bg-foreground/10"></div>
                  </div>

                  <div className="space-y-2">
                    {INCOME_INTERVALS.map((interval, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleIntervalSelect(idx)}
                        className={`w-full text-left rounded-2xl border-2 px-5 py-3 transition-all ${
                          selectedInterval === idx
                            ? 'border-emerald-400 bg-emerald-50/60'
                            : 'border-foreground/10 bg-white/50 hover:border-foreground/20'
                        }`}
                      >
                        <div className="font-semibold text-sm">{interval.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Vi bruger midtpunkt: {formatCurrency(interval.midpoint)} kr.
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="rounded-2xl bg-white/40 backdrop-blur border border-foreground/8 px-5 py-3 mt-4">
                    <p className="text-xs text-muted-foreground mb-1">💡 Jo mere præcist, jo bedre</p>
                    <p className="text-xs text-foreground/60">
                      Med et præcist beløb kan vi give dig bedre anbefalinger.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600/70 mb-4">
                  Bekræft
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-3">
                  Ser det rigtigt ud?
                </h2>
                <p className="text-foreground/60 text-base leading-relaxed mb-6">
                  Her er din samlede månedlige indkomst.
                </p>

                <div className="rounded-2xl border border-foreground/10 bg-white/60 backdrop-blur overflow-hidden mb-4">
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">
                          {isPrecise ? 'Præcist beløb' : 'Estimeret beløb (interval)'}
                        </div>
                        <div className="text-2xl font-bold text-emerald-600">
                          {formatCurrency(finalIncome)} kr./md.
                        </div>
                      </div>
                      {isPrecise && (
                        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <Check className="h-5 w-5 text-emerald-600" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {!isPrecise && (
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 mb-4">
                    <p className="text-sm text-amber-800 font-medium mb-1">💡 Tip</p>
                    <p className="text-sm text-amber-700">
                      Du har valgt et interval. Med et præcist beløb kan vi give dig mere nøjagtige anbefalinger.
                    </p>
                  </div>
                )}

                <div className="space-y-3 flex-1">
                  <button
                    onClick={() => setRealisticAnswer('yes')}
                    className={`flex items-center justify-between w-full text-left rounded-2xl border-2 px-5 py-4 transition-all ${
                      realisticAnswer === 'yes'
                        ? 'border-emerald-500 bg-emerald-50/60'
                        : 'border-foreground/12 bg-white/50 hover:border-foreground/25'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">Ja, det ser rigtigt ud</div>
                      <div className="text-sm text-muted-foreground mt-0.5">Gem og fortsæt.</div>
                    </div>
                    {realisticAnswer === 'yes' && (
                      <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 ml-4">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => { setRealisticAnswer('adjust'); back(); }}
                    className="flex items-center justify-between w-full text-left rounded-2xl border-2 border-foreground/12 bg-white/50 px-5 py-4 transition-all hover:border-foreground/25"
                  >
                    <div>
                      <div className="font-semibold">Nej, jeg vil justere</div>
                      <div className="text-sm text-muted-foreground mt-0.5">Gå tilbage og ret beløbet.</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          <div className="pt-6">
            {step === 0 && (
              <button
                onClick={next}
                disabled={!canAdvanceStep0}
                className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: canAdvanceStep0 ? 'linear-gradient(to right, #0d9488, #10b981)' : '#9ca3af' }}
              >
                Bekræft beløb
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {step === 1 && (
              <button
                onClick={handleSave}
                disabled={!realisticAnswer || realisticAnswer === 'adjust' || saving}
                className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                {saving ? 'Gemmer…' : 'Gem indkomst'}
                {!saving && <ArrowRight className="h-4 w-4" />}
              </button>
            )}
          </div>
    </WizardShell>
  );
}
