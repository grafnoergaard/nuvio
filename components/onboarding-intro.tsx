'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { ArrowRight, Chrome as Home, Building2, Key, CircleHelp as HelpCircle, Check, Pencil } from 'lucide-react';
import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';
import { formatCurrency } from '@/lib/number-helpers';
import { toast } from 'sonner';
import type { HousingType } from '@/components/household-wizard';
import { fetchActiveSdsData, computeHouseholdExpense, SDS_FALLBACK } from '@/lib/standard-data-service';
import type { SdsData } from '@/lib/standard-data-service';

type Goal = 'ro' | 'overblik' | 'opsparing' | 'raad';
type Adults = 1 | 2 | 3;
type IncomeRange = '0-20' | '20-35' | '35-50' | '50-70' | '70-100' | '100+' | 'precise';

interface AnswersState {
  goal: Goal | null;
  adults: Adults | null;
  housingType: HousingType | null;
  income: IncomeRange | null;
}

const INCOME_RANGES: { value: IncomeRange; label: string; monthly: number }[] = [
  { value: '0-20', label: 'Under 20.000 kr.', monthly: 15000 },
  { value: '20-35', label: '20.000 – 35.000 kr.', monthly: 27500 },
  { value: '35-50', label: '35.000 – 50.000 kr.', monthly: 42500 },
  { value: '50-70', label: '50.000 – 70.000 kr.', monthly: 60000 },
  { value: '70-100', label: '70.000 – 100.000 kr.', monthly: 85000 },
  { value: '100+', label: 'Over 100.000 kr.', monthly: 115000 },
];

const GOAL_OPTIONS: { value: Goal; label: string; sublabel: string }[] = [
  { value: 'ro', label: 'Mere ro i maven', sublabel: 'Stoppe med at bekymre mig om penge' },
  { value: 'overblik', label: 'Overblik over forbruget', sublabel: 'Se præcis hvad pengene går til' },
  { value: 'opsparing', label: 'Spare mere op', sublabel: 'Nå et mål hurtigere end forventet' },
  { value: 'raad', label: 'Se om jeg har råd til mere', sublabel: 'Forstå hvad jeg egentlig kan tillade mig' },
];

interface HousingOption {
  value: HousingType;
  label: string;
  sublabel: string;
  icon: React.ElementType;
}

const HOUSING_OPTIONS: HousingOption[] = [
  { value: 'OWNER_HOUSE', label: 'Ejerbolig', sublabel: 'Parcelhus eller villa du ejer', icon: Home },
  { value: 'OWNER_APARTMENT', label: 'Ejerlejlighed', sublabel: 'Ejerlejlighed med ejerforening', icon: Building2 },
  { value: 'COOPERATIVE', label: 'Andelsbolig', sublabel: 'Andelslejlighed', icon: Building2 },
  { value: 'RENT', label: 'Lejebolig', sublabel: 'Lejlighed eller hus til leje', icon: Key },
  { value: 'OTHER', label: 'Andet', sublabel: 'Kollegium, midlertidig bolig m.m.', icon: HelpCircle },
];

function getEstimate(adults: Adults, housingType: HousingType, income: IncomeRange, sds: SdsData, preciseIncome?: number) {
  const monthly = income === 'precise' && preciseIncome
    ? preciseIncome
    : INCOME_RANGES.find(r => r.value === income)!.monthly;
  const incomeData = { monthly };
  const housingLines = housingType === 'OWNER_HOUSE'
    ? sds.housingTypeExpenses.ejerbolig
    : housingType === 'OWNER_APARTMENT'
    ? sds.housingTypeExpenses.ejerlejlighed
    : housingType === 'COOPERATIVE'
    ? sds.housingTypeExpenses.andelsbolig
    : sds.housingTypeExpenses.lejebolig;
  const housingCost = housingLines.reduce((sum, l) => sum + l.amount, 0);
  const fx = sds.fixedExpenses;
  const otherFixed = computeHouseholdExpense(fx.insurance, adults, 0)
    + computeHouseholdExpense(fx.subscriptions, adults, 0)
    + computeHouseholdExpense(fx.transport, adults, 0);
  const fixed = housingCost + otherFixed;
  const variable = sds.raadighed.base_single_monthly
    + sds.raadighed.extra_adult_monthly * Math.max(0, adults - 1);
  const potential = monthly - fixed - variable;
  return { fixed, variable, potential, monthly };
}

const TOTAL_STEPS = 4;

const STEP_GRADIENTS = [
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 40%, #ffffff 100%)',
  'linear-gradient(160deg, #f0fdfa 0%, #ecfdf5 50%, #ffffff 100%)',
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 30%, #ffffff 100%)',
  'linear-gradient(160deg, #f0fdfa 0%, #ecfdf5 40%, #ffffff 100%)',
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 50%, #ffffff 100%)',
];

export function OnboardingIntro({ onComplete, onDismiss }: { onComplete: () => void; onDismiss?: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const { animating, direction, animate } = useWizardAnimation();
  const [answers, setAnswers] = useState<AnswersState>({ goal: null, adults: null, housingType: null, income: null });
  const [preciseIncome, setPreciseIncome] = useState('');
  const [saving, setSaving] = useState(false);
  const [sds, setSds] = useState<SdsData>(SDS_FALLBACK);

  useEffect(() => {
    fetchActiveSdsData().then(setSds).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

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

  function next() { animate('forward', () => setStep(Math.min(step + 1, TOTAL_STEPS))); }
  function back() { animate('back', () => setStep(Math.max(step - 1, 0))); }

  async function handleFinish() {
    setSaving(true);
    try {
      if (answers.adults && user) {
        const incomeMonthly = answers.income === 'precise' && preciseIncomeNum
        ? preciseIncomeNum
        : answers.income
        ? INCOME_RANGES.find(r => r.value === answers.income)?.monthly ?? null
        : null;
      const householdData = {
          adult_count: answers.adults,
          child_count: 0,
          housing_type: answers.housingType ?? null,
          members: Array.from({ length: answers.adults }, (_, i) => ({
            id: `member-${i + 1}`,
            name: i === 0 ? 'Dig' : `Voksen ${i + 1}`,
            type: 'adult',
            monthly_net_salary: incomeMonthly
              ? Math.round((incomeMonthly / answers.adults!) / 100) * 100
              : null,
          })),
        };
        const { data: existing } = await supabase.from('household').select('id').eq('user_id', user.id).maybeSingle();
        let error;
        if (existing) {
          ({ error } = await supabase.from('household').update(householdData).eq('user_id', user.id));
        } else {
          ({ error } = await supabase.from('household').insert({ ...householdData, user_id: user.id }));
        }
        if (error) toast.error('Kunne ikke gemme husstandsdata');
      }
    } catch {
      toast.error('Noget gik galt. Prøv igen.');
    } finally {
      setSaving(false);
      onComplete();
    }
  }

  const preciseIncomeNum = preciseIncome ? parseInt(preciseIncome, 10) : undefined;

  const estimate = answers.adults && answers.housingType && answers.income
    ? getEstimate(answers.adults, answers.housingType, answers.income, sds, preciseIncomeNum)
    : null;

  const fc = (v: number) => formatCurrency(v, { roundToHundreds: false, decimals: 0 });

  const currentGradient = STEP_GRADIENTS[Math.min(step, STEP_GRADIENTS.length - 1)];

  const canContinue =
    (step === 1 && answers.goal !== null) ||
    (step === 2 && true) ||
    (step === 3 && answers.adults !== null && answers.housingType !== null && answers.income !== null && (answers.income !== 'precise' || !!preciseIncome));

  const isResultStep = step === TOTAL_STEPS;

  return (
    <WizardShell
      gradient={currentGradient}
      visible={visible}
      step={step}
      totalSteps={TOTAL_STEPS}
      isDone={isResultStep}
      showBack={step > 0 && !isResultStep}
      showClose={true}
      onBack={back}
      onClose={onDismiss ?? onComplete}
      animating={animating}
      direction={direction}
    >

            {/* Step 0 — Hook */}
            {step === 0 && (
              <div className="flex-1 flex flex-col justify-center space-y-6">
                <div className="space-y-3">
                  <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
                    Du er ikke alene
                  </p>
                  <h1 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                    De fleste har ikke styr på deres budget.
                  </h1>
                </div>
                <p className="text-foreground/60 text-lg leading-relaxed">
                  Ikke fordi de er dårlige med penge.<br />
                  Men fordi det <span className="font-semibold text-foreground">føles uoverskueligt</span>.
                </p>
                <p className="text-foreground/60 text-base leading-relaxed">
                  Kuvert hjælper dig med at komme i gang — uden at taste 100 ting fra start.
                </p>
              </div>
            )}

            {/* Step 1 — Goal */}
            {step === 1 && (
              <div className="flex flex-col space-y-5">
                <div className="space-y-2">
                  <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
                    Dit udgangspunkt
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                    Hvad ville gøre din økonomi bedre?
                  </h2>
                </div>
                <div className="space-y-2.5">
                  {GOAL_OPTIONS.map(opt => {
                    const active = answers.goal === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setAnswers(a => ({ ...a, goal: opt.value }));
                          setTimeout(() => animate('forward', () => setStep(2)), 180);
                        }}
                        className={`w-full text-left rounded-2xl border-2 px-5 py-4 transition-all duration-150 active:scale-[0.99] ${
                          active
                            ? 'border-emerald-400 bg-white/80 shadow-sm'
                            : 'border-white/50 bg-white/60 hover:border-emerald-200 hover:bg-white/80'
                        }`}
                      >
                        <p className="font-semibold text-sm text-foreground">{opt.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{opt.sublabel}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2 — Stats / context */}
            {step === 2 && (
              <div className="flex-1 flex flex-col justify-center space-y-6">
                <div className="space-y-3">
                  <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
                    Vidste du det?
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                    En typisk husstand bruger 8.000–13.000 kr. på faste udgifter — før det sjove starter.
                  </h2>
                </div>
                <div className="rounded-2xl bg-white/60 backdrop-blur border border-white/40 px-5 py-4 space-y-2">
                  <p className="text-sm font-semibold text-foreground">63% undervurderer deres variable forbrug</p>
                  <p className="text-sm text-foreground/60 leading-relaxed">
                    Café, dagligvarer, impulskøb — det lille beløb, der bare forsvinder.
                    Det er her de fleste budgetter bryder sammen.
                  </p>
                </div>
                <p className="text-foreground/60 text-base leading-relaxed">
                  Vi giver dig en hurtig temperaturmåling, så du kan se præcis hvor du ligger.
                </p>
              </div>
            )}

            {/* Step 3 — Household details */}
            {step === 3 && (
              <div className="flex flex-col space-y-5">
                <div className="space-y-2">
                  <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
                    3 hurtige spørgsmål
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                    Fortæl os lidt om din husstand
                  </h2>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2.5">
                    <p className="text-sm font-semibold text-foreground">Hvor mange voksne er I?</p>
                    <div className="grid grid-cols-3 gap-2">
                      {([1, 2, 3] as const).map(n => (
                        <button
                          key={n}
                          onClick={() => setAnswers(a => ({ ...a, adults: n }))}
                          className={`rounded-2xl border-2 py-3.5 text-sm font-semibold transition-all ${
                            answers.adults === n
                              ? 'border-emerald-400 bg-white/80 text-foreground shadow-sm'
                              : 'border-white/50 bg-white/60 text-foreground/70 hover:border-emerald-200 hover:bg-white/80'
                          }`}
                        >
                          {n === 3 ? '3+' : n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <p className="text-sm font-semibold text-foreground">Hvilken boligsituation passer på dig?</p>
                    <div className="space-y-2">
                      {HOUSING_OPTIONS.map(opt => {
                        const Icon = opt.icon;
                        const isSelected = answers.housingType === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => setAnswers(a => ({ ...a, housingType: opt.value }))}
                            className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all ${
                              isSelected
                                ? 'border-emerald-400 bg-white/80 shadow-sm'
                                : 'border-white/50 bg-white/60 hover:border-emerald-200 hover:bg-white/80'
                            }`}
                          >
                            <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-emerald-500 text-white' : 'bg-white/80 border border-white/60 text-foreground/40'}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{opt.sublabel}</p>
                            </div>
                            {isSelected && (
                              <div className="ml-auto h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <p className="text-sm font-semibold text-foreground">Hvad er jeres samlede indkomst ca.?</p>
                    <p className="text-xs text-muted-foreground">Månedlig nettolønindkomst samlet</p>
                    <div className={`flex items-center gap-2 rounded-2xl border-2 px-4 py-3 transition-all ${
                      answers.income === 'precise'
                        ? 'border-emerald-400 bg-white/80 shadow-sm'
                        : 'border-white/50 bg-white/60'
                    }`}>
                      <Pencil className="h-4 w-4 text-emerald-600 shrink-0" />
                      <input
                        type="number"
                        inputMode="numeric"
                        value={preciseIncome}
                        onChange={(e) => {
                          setPreciseIncome(e.target.value);
                          if (e.target.value) {
                            setAnswers(a => ({ ...a, income: 'precise' }));
                          } else {
                            setAnswers(a => ({ ...a, income: null }));
                          }
                        }}
                        placeholder="Skriv præcist beløb..."
                        className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/60 text-foreground"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">kr./md.</span>
                      {answers.income === 'precise' && (
                        <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {INCOME_RANGES.map(r => (
                        <button
                          key={r.value}
                          onClick={() => {
                            setAnswers(a => ({ ...a, income: r.value }));
                            setPreciseIncome('');
                          }}
                          className={`w-full text-left rounded-2xl border-2 px-4 py-3 text-sm font-medium transition-all flex items-center justify-between ${
                            answers.income === r.value
                              ? 'border-emerald-400 bg-white/80 shadow-sm text-foreground'
                              : 'border-white/50 bg-white/60 text-foreground/70 hover:border-emerald-200 hover:bg-white/80'
                          }`}
                        >
                          {r.label}
                          {answers.income === r.value && (
                            <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4 — Result */}
            {isResultStep && estimate && (
              <div className="flex flex-col space-y-5">
                <div className="space-y-2">
                  <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
                    Et kvalificeret gæt
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                    Baseret på din husstand ser det typisk sådan ud
                  </h2>
                </div>

                <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/50 overflow-hidden">
                  <div className="divide-y divide-white/40">
                    <div className="flex items-center justify-between px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold">Husstandsindkomst</p>
                        <p className="text-xs text-muted-foreground">Månedlig netto</p>
                      </div>
                      <p className="text-base font-bold text-emerald-600">{fc(estimate.monthly)}</p>
                    </div>
                    <div className="flex items-center justify-between px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold">Faste udgifter</p>
                        <p className="text-xs text-muted-foreground">Husleje, forsikring, abonnementer m.m.</p>
                      </div>
                      <p className="text-base font-bold text-foreground/60">−{fc(estimate.fixed)}</p>
                    </div>
                    <div className="flex items-center justify-between px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold">Variabelt forbrug</p>
                        <p className="text-xs text-muted-foreground">Mad, transport, café, impuls</p>
                      </div>
                      <p className="text-base font-bold text-foreground/60">−{fc(estimate.variable)}</p>
                    </div>
                    <div className={`flex items-center justify-between px-5 py-4 ${estimate.potential > 0 ? 'bg-emerald-50/50' : 'bg-rose-50/50'}`}>
                      <div>
                        <p className="text-sm font-bold">Potentiel opsparing</p>
                        <p className="text-xs text-muted-foreground">Hvis planen holder</p>
                      </div>
                      <p className={`text-lg font-bold ${estimate.potential > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {estimate.potential > 0 ? fc(estimate.potential) : `−${fc(Math.abs(estimate.potential))}`}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-foreground/50 leading-relaxed">
                  Dette er baseret på gennemsnit for en husstand som din.
                  Med dine <span className="font-semibold text-foreground/70">rigtige tal</span> kan Kuvert give dig et præcist billede.
                </p>
              </div>
            )}

            {isResultStep && !estimate && (
              <div className="flex-1 flex flex-col justify-center items-center space-y-4 text-center">
                <h2 className="text-2xl font-bold">Noget gik galt</h2>
                <p className="text-foreground/60">Gå tilbage og udfyld alle felter.</p>
              </div>
            )}

          {/* CTA */}
          <div className="pt-6 shrink-0">
            {isResultStep ? (
              <div className="space-y-2">
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="w-full h-14 rounded-2xl font-semibold text-base text-white flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all duration-200 disabled:opacity-60"
                  style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
                >
                  {saving ? 'Gemmer...' : 'Ja, lad os gøre det præcist'}
                  {!saving && <ArrowRight className="h-4 w-4" />}
                </button>
                <button
                  onClick={onComplete}
                  className="w-full text-sm text-foreground/40 hover:text-foreground/70 py-2 transition-colors"
                >
                  Spring over og start direkte
                </button>
              </div>
            ) : step === 1 ? null : (
              <button
                onClick={step === TOTAL_STEPS - 1 ? next : next}
                disabled={step === 3 && !canContinue}
                className="w-full h-14 rounded-2xl font-semibold text-base text-white flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                {step === 0 ? 'Det kender jeg godt' : step === 2 ? 'Hvor ligger jeg?' : 'Se mit estimat'}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
    </WizardShell>
  );
}
