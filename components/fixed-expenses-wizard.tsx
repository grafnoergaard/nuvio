'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { ArrowRight, Check, Chrome as Home, Zap, Wifi, Car, Shield, Baby, CreditCard, Plus, TrendingDown, TrendingUp, Building2, Key } from 'lucide-react';
import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/number-helpers';
import { fetchActiveSdsData, SDS_FALLBACK, SdsHousingLineItem, computeHouseholdExpense } from '@/lib/standard-data-service';
import { useAiContext } from '@/lib/ai-context';

type PaymentRhythm = 'monthly' | 'mixed';
type HousingType = 'ejerbolig' | 'ejerlejlighed' | 'andelsbolig' | 'lejebolig';

interface ExpenseEntry {
  id: string;
  label: string;
  icon: React.ReactNode;
  category: string;
  amount: number;
  enabled: boolean;
}

interface Props {
  budgetId: string;
  monthlyIncome: number;
  adults?: number;
  childCount?: number;
  onComplete: () => void;
  onDismiss: () => void;
}

const TOTAL_STEPS = 5;
const STEP_GRADIENTS = [
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 40%, #ffffff 100%)',
  'linear-gradient(160deg, #f0fdfa 0%, #ecfdf5 40%, #ffffff 100%)',
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 50%, #ffffff 100%)',
  'linear-gradient(160deg, #f0fdfa 0%, #ecfdf5 40%, #ffffff 100%)',
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 40%, #ffffff 100%)',
];

const HOUSING_TYPE_OPTIONS: { id: HousingType; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'ejerbolig',     label: 'Ejerbolig',     desc: 'Parcelhus eller villa du ejer',     icon: <Home className="h-5 w-5" /> },
  { id: 'ejerlejlighed', label: 'Ejerlejlighed', desc: 'Ejerlejlighed med ejerforening',    icon: <Building2 className="h-5 w-5" /> },
  { id: 'andelsbolig',   label: 'Andelsbolig',   desc: 'Andelsbolig med boligafgift',       icon: <Building2 className="h-5 w-5" /> },
  { id: 'lejebolig',     label: 'Lejebolig',     desc: 'Lejebolig med månedlig husleje',    icon: <Key className="h-5 w-5" /> },
];

const OTHER_EXPENSE_CARDS = [
  { id: 'insurance',     label: 'Forsikringer',      icon: <Shield className="h-5 w-5" />,     category: 'Forsikring',   fallbackKey: 'insurance_monthly'     as const },
  { id: 'utilities',     label: 'El / Vand / Varme', icon: <Zap className="h-5 w-5" />,        category: 'Forbrug',      fallbackKey: 'utilities_monthly'     as const },
  { id: 'subscriptions', label: 'Abonnementer',      icon: <Wifi className="h-5 w-5" />,       category: 'Abonnementer', fallbackKey: 'subscriptions_monthly' as const },
  { id: 'transport',     label: 'Transport',         icon: <Car className="h-5 w-5" />,        category: 'Transport',    fallbackKey: 'transport_monthly'     as const },
  { id: 'children',      label: 'Børnerelateret',    icon: <Baby className="h-5 w-5" />,       category: 'Børn',         fallbackKey: 'children_monthly'      as const },
  { id: 'loans',         label: 'Lån',               icon: <CreditCard className="h-5 w-5" />, category: 'Lån',          fallbackKey: null },
  { id: 'other',         label: 'Andet',             icon: <Plus className="h-5 w-5" />,       category: 'Andet',        fallbackKey: null },
];

export function FixedExpensesWizard({ budgetId, monthlyIncome, adults = 1, childCount = 0, onComplete, onDismiss }: Props) {
  const { setWizardActive } = useAiContext();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);
  const { animating, direction, animate } = useWizardAnimation();
  const [housingType, setHousingType] = useState<HousingType | null>(null);
  const [housingExpenses, setHousingExpenses] = useState<ExpenseEntry[]>([]);
  const [otherSelected, setOtherSelected] = useState<Set<string>>(new Set());
  const [otherExpenses, setOtherExpenses] = useState<ExpenseEntry[]>([]);
  const [rhythm, setRhythm] = useState<PaymentRhythm | null>(null);
  const [realisticAnswer, setRealisticAnswer] = useState<'yes' | 'adjust' | null>(null);
  const [otherDefaults, setOtherDefaults] = useState<Record<string, number>>({
    insurance:     computeHouseholdExpense(SDS_FALLBACK.fixedExpenses.insurance,     adults, childCount),
    utilities:     computeHouseholdExpense(SDS_FALLBACK.fixedExpenses.utilities,     adults, childCount),
    subscriptions: computeHouseholdExpense(SDS_FALLBACK.fixedExpenses.subscriptions, adults, childCount),
    transport:     computeHouseholdExpense(SDS_FALLBACK.fixedExpenses.transport,     adults, childCount),
    children:      SDS_FALLBACK.fixedExpenses.children_monthly,
    loans:         3000,
    other:         500,
  });
  const [housingLineItems, setHousingLineItems] = useState(SDS_FALLBACK.housingTypeExpenses);

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

  useEffect(() => {
    fetchActiveSdsData().then(sds => {
      setOtherDefaults({
        insurance:     computeHouseholdExpense(sds.fixedExpenses.insurance,     adults, childCount),
        utilities:     computeHouseholdExpense(sds.fixedExpenses.utilities,     adults, childCount),
        subscriptions: computeHouseholdExpense(sds.fixedExpenses.subscriptions, adults, childCount),
        transport:     computeHouseholdExpense(sds.fixedExpenses.transport,     adults, childCount),
        children:      sds.fixedExpenses.children_monthly,
        loans:         3000,
        other:         500,
      });
      setHousingLineItems(sds.housingTypeExpenses);
    });
  }, [adults, childCount]);

  function buildHousingExpenses(type: HousingType, items: SdsHousingLineItem[]): ExpenseEntry[] {
    return items.map(item => ({
      id: item.key,
      label: item.label,
      icon: <Home className="h-5 w-5" />,
      category: 'Boligudgifter',
      amount: item.amount,
      enabled: true,
    }));
  }

  function selectHousingType(type: HousingType) {
    setHousingType(type);
    setHousingExpenses(buildHousingExpenses(type, housingLineItems[type]));
  }

  function next() { animate('forward', () => setStep(s => s + 1)); }
  function back() { animate('back', () => setStep(s => s - 1)); }

  function goToOtherAmounts() {
    if (otherSelected.size === 0) { animate('forward', () => setStep(3)); return; }
    const entries: ExpenseEntry[] = OTHER_EXPENSE_CARDS
      .filter(c => otherSelected.has(c.id))
      .map(c => ({
        id: c.id,
        label: c.label,
        icon: c.icon,
        category: c.category,
        amount: otherDefaults[c.id] ?? 1000,
        enabled: true,
      }));
    setOtherExpenses(entries);
    animate('forward', () => setStep(3));
  }

  function updateHousingAmount(id: string, value: number) {
    setHousingExpenses(prev => prev.map(e => e.id === id ? { ...e, amount: value } : e));
  }

  function toggleHousingEntry(id: string) {
    setHousingExpenses(prev => prev.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e));
  }

  function updateOtherAmount(id: string, value: number) {
    setOtherExpenses(prev => prev.map(e => e.id === id ? { ...e, amount: value } : e));
  }

  function toggleOtherCard(id: string) {
    setOtherSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const activeHousingExpenses = housingExpenses.filter(e => e.enabled);
  const allExpenses = [...activeHousingExpenses, ...otherExpenses];
  const totalExpenses = allExpenses.reduce((sum, e) => sum + e.amount, 0);
  const disposable = monthlyIncome - totalExpenses;

  async function handleSave() {
    setSaving(true);
    try {
      for (const expense of allExpenses) {
        const { data: cgData } = await supabase
          .from('category_groups')
          .select('id')
          .eq('name', expense.category)
          .maybeSingle();

        let groupId: string;
        if (cgData) {
          groupId = cgData.id;
        } else {
          const { data: newGroup, error: cgErr } = await supabase
            .from('category_groups')
            .insert({ name: expense.category, is_income: false })
            .select('id')
            .single();
          if (cgErr) throw cgErr;
          groupId = newGroup.id;
        }

        const { data: recipData } = await supabase
          .from('recipients')
          .select('id')
          .eq('name', expense.label)
          .maybeSingle();

        let recipientId: string;
        if (recipData) {
          recipientId = recipData.id;
        } else {
          const { data: newRecip, error: rErr } = await supabase
            .from('recipients')
            .insert({ name: expense.label, category_group_id: groupId })
            .select('id')
            .single();
          if (rErr) throw rErr;
          recipientId = newRecip.id;
        }

        const plans = Array.from({ length: 12 }, (_, i) => ({
          budget_id: budgetId,
          recipient_id: recipientId,
          month: i + 1,
          amount_planned: expense.amount,
        }));

        await supabase.from('budget_plans').upsert(plans as any, { onConflict: 'budget_id,recipient_id,month' });
      }

      toast.success('Faste udgifter er gemt!');
      onComplete();
    } catch {
      toast.error('Noget gik galt. Prøv igen.');
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
              <div className="flex flex-col flex-1">
                <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70 mb-4">
                  Faste udgifter
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-3">
                  Hvad slags bolig bor du i?
                </h2>
                <p className="text-foreground/60 text-lg leading-relaxed mb-6">
                  Boligtypen afgør hvilke udgifter vi foreslår.
                </p>

                <div className="space-y-2 flex-1">
                  {HOUSING_TYPE_OPTIONS.map(opt => {
                    const isSelected = housingType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => selectHousingType(opt.id)}
                        className={`relative flex items-center gap-4 text-left rounded-2xl border-2 px-5 py-4 w-full transition-all ${
                          isSelected ? 'border-emerald-500 bg-emerald-50/50' : 'border-foreground/12 bg-white/50 hover:border-foreground/25'
                        }`}
                      >
                        <div className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-emerald-100 text-emerald-600' : 'bg-white/60 text-muted-foreground'
                        }`}>
                          {opt.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-base">{opt.label}</div>
                          <div className="text-sm text-muted-foreground mt-0.5">{opt.desc}</div>
                        </div>
                        {isSelected && (
                          <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                            <Check className="h-3.5 w-3.5 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 1 && housingType && (
              <div className="flex flex-col flex-1">
                <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70 mb-4">
                  Boligudgifter
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-3">
                  Justér boligudgifterne.
                </h2>
                <p className="text-foreground/60 text-base leading-relaxed mb-6">
                  Her er de typiske udgifter for en {HOUSING_TYPE_OPTIONS.find(o => o.id === housingType)?.label.toLowerCase()}. Justér beløbene.
                </p>

                <div className="space-y-2 flex-1">
                  {housingExpenses.map(expense => (
                    <div
                      key={expense.id}
                      className={`flex items-center gap-3 rounded-2xl border border-foreground/10 px-4 py-3 transition-opacity ${expense.enabled ? 'bg-white/60' : 'bg-foreground/5 opacity-50'}`}
                    >
                      <button
                        onClick={() => toggleHousingEntry(expense.id)}
                        className={`shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          expense.enabled ? 'border-emerald-500 bg-emerald-500' : 'border-foreground/20 bg-transparent'
                        }`}
                      >
                        {expense.enabled && <Check className="h-3 w-3 text-white" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{expense.label}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Input
                          type="number"
                          value={expense.amount}
                          onChange={e => updateHousingAmount(expense.id, parseInt(e.target.value) || 0)}
                          disabled={!expense.enabled}
                          className="w-28 h-8 text-right text-sm rounded-xl bg-white/80"
                        />
                        <span className="text-xs text-muted-foreground">kr/md</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-foreground/8 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Boligudgifter pr. måned</span>
                  <span className="text-lg font-bold">{formatCurrency(activeHousingExpenses.reduce((s, e) => s + e.amount, 0))} kr.</span>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col flex-1">
                <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70 mb-4">
                  Øvrige udgifter
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-3">
                  Hvad ellers?
                </h2>
                <p className="text-foreground/60 text-base leading-relaxed mb-6">
                  Vælg de kategorier der passer til dig.
                </p>

                <div className="grid grid-cols-2 gap-3 flex-1">
                  {OTHER_EXPENSE_CARDS.map(card => {
                    const isSelected = otherSelected.has(card.id);
                    return (
                      <button
                        key={card.id}
                        onClick={() => toggleOtherCard(card.id)}
                        className={`relative flex items-center gap-3 text-left rounded-2xl border-2 px-4 py-3.5 transition-all ${
                          isSelected ? 'border-emerald-500 bg-emerald-50/50' : 'border-foreground/12 bg-white/50 hover:border-foreground/25'
                        }`}
                      >
                        <div className={`shrink-0 h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-emerald-100 text-emerald-600' : 'bg-white/60 text-muted-foreground'
                        }`}>
                          {card.icon}
                        </div>
                        <span className={`text-sm font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {card.label}
                        </span>
                        {isSelected && (
                          <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col flex-1">
                <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70 mb-4">
                  Kontrollér beløb
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-3">
                  Justér estimaterne.
                </h2>
                <p className="text-foreground/60 text-base leading-relaxed mb-6">
                  Tilpas beløbene så de passer til dig.
                </p>

                <div className="space-y-2 mb-4">
                  {otherExpenses.map(expense => (
                    <div key={expense.id} className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-white/60 px-4 py-3">
                      <div className="shrink-0 h-9 w-9 rounded-xl bg-white/60 border border-foreground/8 text-muted-foreground flex items-center justify-center">
                        {expense.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{expense.label}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Input
                          type="number"
                          value={expense.amount}
                          onChange={e => updateOtherAmount(expense.id, parseInt(e.target.value) || 0)}
                          className="w-28 h-8 text-right text-sm rounded-xl bg-white/80"
                        />
                        <span className="text-xs text-muted-foreground">kr/md</span>
                      </div>
                    </div>
                  ))}
                  {otherExpenses.length === 0 && (
                    <div className="rounded-2xl border border-foreground/8 bg-white/40 px-5 py-6 text-center">
                      <p className="text-sm text-muted-foreground">Ingen øvrige udgifter valgt</p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-foreground/10 bg-white/60 overflow-hidden">
                  <div className="px-5 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        Indkomst
                      </div>
                      <span className="font-semibold text-emerald-600">
                        {monthlyIncome > 0 ? `${formatCurrency(monthlyIncome)} kr.` : 'Ikke angivet'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <TrendingDown className="h-4 w-4 text-rose-500" />
                        Faste udgifter
                      </div>
                      <span className="font-semibold text-rose-600">−{formatCurrency(totalExpenses)} kr.</span>
                    </div>
                    <div className="border-t border-foreground/8 pt-3 flex items-center justify-between">
                      <div className="text-sm font-medium">Rådighedsbeløb</div>
                      <span className={`text-lg font-bold ${disposable >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCurrency(Math.abs(disposable))} kr.
                        {disposable < 0 && ' underskud'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="flex flex-col flex-1">
                <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70 mb-4">
                  Bekræft
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-3">
                  Føles det realistisk?
                </h2>
                <p className="text-foreground/60 text-base leading-relaxed mb-6">
                  Godkend eller gå tilbage og justér.
                </p>

                <div className="rounded-2xl bg-white/50 border border-foreground/8 px-5 py-3 space-y-1.5 mb-5">
                  {allExpenses.map(e => (
                    <div key={e.id + e.label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{e.label}</span>
                      <span className="font-medium">{formatCurrency(e.amount)} kr.</span>
                    </div>
                  ))}
                  <div className="border-t border-foreground/8 pt-2 mt-1 flex items-center justify-between text-sm font-semibold">
                    <span>Samlet</span>
                    <span>{formatCurrency(totalExpenses)} kr.</span>
                  </div>
                </div>

                <div className="space-y-3 mb-5">
                  {([
                    { id: 'monthly' as PaymentRhythm, label: 'Ja, primært månedligt', desc: 'Samme beløb fordeles ud på alle 12 måneder.' },
                    { id: 'mixed' as PaymentRhythm, label: 'Blandet', desc: 'Nogle betales kvartalsvis eller årligt — vi fordeler dem automatisk.' },
                  ] as { id: PaymentRhythm; label: string; desc: string }[]).map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setRhythm(opt.id)}
                      className={`flex items-center justify-between w-full text-left rounded-2xl border-2 px-5 py-4 transition-all ${
                        rhythm === opt.id ? 'border-emerald-500 bg-emerald-50/50' : 'border-foreground/12 bg-white/50 hover:border-foreground/25'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-base">{opt.label}</div>
                        <div className="text-sm text-muted-foreground mt-0.5">{opt.desc}</div>
                      </div>
                      {rhythm === opt.id && (
                        <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 ml-4">
                          <Check className="h-3.5 w-3.5 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="space-y-3 flex-1">
                  <button
                    onClick={() => setRealisticAnswer('yes')}
                    className={`flex items-center justify-between w-full text-left rounded-2xl border-2 px-5 py-4 transition-all ${
                      realisticAnswer === 'yes' ? 'border-emerald-500 bg-emerald-50/50' : 'border-foreground/12 bg-white/50 hover:border-foreground/25'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">Ja, det ser rigtigt ud</div>
                      <div className="text-sm text-muted-foreground mt-0.5">Gem og gå til oversigten.</div>
                    </div>
                    {realisticAnswer === 'yes' && (
                      <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => { setRealisticAnswer('adjust'); animate('back', () => setStep(1)); }}
                    className="flex items-center justify-between w-full text-left rounded-2xl border-2 border-foreground/12 bg-white/50 px-5 py-4 transition-all hover:border-foreground/25"
                  >
                    <div>
                      <div className="font-semibold">Nej, jeg vil justere</div>
                      <div className="text-sm text-muted-foreground mt-0.5">Gå tilbage og ret beløbene.</div>
                    </div>
                  </button>
                </div>
              </div>
            )}

          <div className="pt-6">
            {step === 0 && (
              <button
                onClick={next}
                disabled={!housingType}
                className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                Fortsæt
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {step === 1 && (
              <button
                onClick={next}
                className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                Øvrige faste udgifter
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {step === 2 && (
              <button
                onClick={goToOtherAmounts}
                className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                {otherSelected.size > 0 ? `Fortsæt med ${otherSelected.size} kategorier` : 'Spring over'}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {step === 3 && (
              <button
                onClick={next}
                className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                Se realitets-tjek
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {step === 4 && (
              <button
                onClick={handleSave}
                disabled={!realisticAnswer || realisticAnswer === 'adjust' || !rhythm || saving}
                className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                {saving ? 'Gemmer…' : 'Gem faste udgifter'}
                {!saving && <ArrowRight className="h-4 w-4" />}
              </button>
            )}
          </div>
    </WizardShell>
  );
}
