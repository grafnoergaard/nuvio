'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminLabel } from '@/components/admin-page-label';
import { Input } from '@/components/ui/input';
import { ArrowRight, Check, Zap, PenLine, TrendingUp, Shield, Chrome as Home, Car, Wifi, Baby, Eye, TrendingDown, PiggyBank, Lightbulb } from 'lucide-react';
import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';
import { supabase } from '@/lib/supabase';
import { createBudget } from '@/lib/db-helpers';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/number-helpers';
import { useAiContext } from '@/lib/ai-context';

type StartMethod = 'import' | 'standard' | 'manual';
type BudgetAccountAnswer = 'yes_active' | 'yes_rarely' | 'considering' | 'no_unknown';
type BufferAnswer = 'yes' | 'no' | 'unsure';

interface ExpenseItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  category: string;
  amount: number;
  enabled: boolean;
}

const EXPENSE_META: Record<string, { label: string; icon: React.ReactNode; category: string; enabledByDefault: boolean }> = {
  housing: { label: 'Husleje / Boliglån', icon: <Home className="h-4 w-4" />, category: 'Bolig', enabledByDefault: true },
  insurance: { label: 'Forsikringer', icon: <Shield className="h-4 w-4" />, category: 'Forsikring', enabledByDefault: true },
  utilities: { label: 'El / Vand / Varme', icon: <Zap className="h-4 w-4" />, category: 'Forbrug', enabledByDefault: true },
  subscriptions: { label: 'Abonnementer', icon: <Wifi className="h-4 w-4" />, category: 'Abonnementer', enabledByDefault: true },
  transport: { label: 'Transport', icon: <Car className="h-4 w-4" />, category: 'Transport', enabledByDefault: true },
  children: { label: 'Børnerelateret', icon: <Baby className="h-4 w-4" />, category: 'Børn', enabledByDefault: false },
};

const FALLBACK_EXPENSES_SINGLE: Record<string, number> = {
  housing: 8500, insurance: 1400, utilities: 1200, subscriptions: 600, transport: 1600, children: 1800,
};
const FALLBACK_EXPENSES_COUPLE: Record<string, number> = {
  housing: 12000, insurance: 2200, utilities: 1800, subscriptions: 900, transport: 2400, children: 1800,
};

function buildExpenses(adults: number, dbDefaults: { key: string; value: number; value_couple: number | null }[]): ExpenseItem[] {
  const isCouple = adults >= 2;
  return Object.entries(EXPENSE_META).map(([key, meta]) => {
    const db = dbDefaults.find(d => d.key === key);
    let amount: number;
    if (db) {
      amount = isCouple ? (db.value_couple ?? db.value) : db.value;
    } else {
      amount = isCouple ? (FALLBACK_EXPENSES_COUPLE[key] ?? 0) : (FALLBACK_EXPENSES_SINGLE[key] ?? 0);
    }
    return { id: key, label: meta.label, icon: meta.icon, category: meta.category, amount, enabled: meta.enabledByDefault };
  });
}

interface WizardState {
  method: StartMethod | null;
  expenses: ExpenseItem[];
  budgetAccount: BudgetAccountAnswer | null;
  buffer: BufferAnswer | null;
}

interface Props {
  adults: number;
  monthlyIncome: number;
  onComplete: () => void;
  onStartVariableWizard?: () => void;
}

const TOTAL_STEPS = 4;

const STEP_GRADIENTS = [
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 40%, #ffffff 100%)',
  'linear-gradient(160deg, #f0fdfa 0%, #ecfdf5 50%, #ffffff 100%)',
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 30%, #ffffff 100%)',
  'linear-gradient(160deg, #f0fdfa 0%, #ecfdf5 40%, #ffffff 100%)',
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 50%, #ffffff 100%)',
];

const BUDGET_STEP_LABELS: Record<number, string> = {
  0: 'Startmetode',
  1: 'Udgifter',
  2: 'Budgetkonto',
  3: 'Buffer',
  4: 'Opsummering',
};

export function BudgetSetupWizard({ adults, monthlyIncome, onComplete, onStartVariableWizard }: Props) {
  const router = useRouter();
  const { setWizard } = useAdminLabel();
  const { setWizardActive } = useAiContext();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);
  const { animating, direction, animate } = useWizardAnimation();

  const [state, setState] = useState<WizardState>({
    method: null,
    expenses: buildExpenses(adults, []),
    budgetAccount: null,
    buffer: null,
  });

  useEffect(() => {
    setWizardActive(true);
    return () => setWizardActive(false);
  }, [setWizardActive]);

  useEffect(() => {
    setWizard({ name: 'Budget Setup', step: step + 1, totalSteps: 5, stepLabel: BUDGET_STEP_LABELS[step] });
    return () => setWizard(null);
  }, [step]);

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

  useEffect(() => {
    supabase
      .from('wizard_defaults')
      .select('key, value, value_couple')
      .eq('type', 'fixed')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setState(s => ({ ...s, expenses: buildExpenses(adults, data) }));
        }
      });
  }, [adults]);

  function next() { animate('forward', () => setStep(s => Math.min(s + 1, TOTAL_STEPS))); }
  function back() { animate('back', () => setStep(s => Math.max(s - 1, 0))); }

  const totalExpenses = state.expenses.filter(e => e.enabled).reduce((sum, e) => sum + e.amount, 0);
  const incomeShare = monthlyIncome > 0 ? Math.round((totalExpenses / monthlyIncome) * 100) : null;

  function updateExpenseAmount(id: string, value: number) {
    setState(s => ({ ...s, expenses: s.expenses.map(e => e.id === id ? { ...e, amount: value } : e) }));
  }

  function toggleExpense(id: string) {
    setState(s => ({ ...s, expenses: s.expenses.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e) }));
  }

  async function handleFinish() {
    setSaving(true);
    try {
      const year = new Date().getFullYear();
      const budget = await createBudget({ name: `Husholdning ${year}`, year, start_month: 1, end_month: 12 });

      if (state.method === 'standard' || state.method === 'manual') {
        const enabledExpenses = state.expenses.filter(e => e.enabled);
        for (const expense of enabledExpenses) {
          const { data: cgData } = await supabase.from('category_groups').select('id').eq('name', expense.category).maybeSingle();
          let groupId: string;
          if (cgData) {
            groupId = cgData.id;
          } else {
            const { data: newGroup, error: cgErr } = await supabase.from('category_groups').insert({ name: expense.category, is_income: false }).select('id').single();
            if (cgErr) throw cgErr;
            groupId = newGroup.id;
          }

          const { data: recipData } = await supabase.from('recipients').select('id').eq('name', expense.label).maybeSingle();
          let recipientId: string;
          if (recipData) {
            recipientId = recipData.id;
          } else {
            const { data: newRecip, error: rErr } = await supabase.from('recipients').insert({ name: expense.label, category_group_id: groupId }).select('id').single();
            if (rErr) throw rErr;
            recipientId = newRecip.id;
          }

          const plans = Array.from({ length: 12 }, (_, i) => ({
            budget_id: budget.id, recipient_id: recipientId, month: i + 1, amount_planned: expense.amount,
          }));
          await supabase.from('budget_plans').upsert(plans as any, { onConflict: 'budget_id,recipient_id,month' });
        }
      }

      if (monthlyIncome > 0) {
        const { data: incomeGroup } = await supabase.from('category_groups').select('id').eq('name', 'Indkomst').maybeSingle();
        let incomeGroupId: string;
        if (incomeGroup) {
          incomeGroupId = incomeGroup.id;
        } else {
          const { data: newGroup, error: igErr } = await supabase.from('category_groups').insert({ name: 'Indkomst', is_income: true }).select('id').single();
          if (igErr) throw igErr;
          incomeGroupId = newGroup.id;
        }

        const { data: incomeRecip } = await supabase.from('recipients').select('id').eq('name', 'Løn').maybeSingle();
        let incomeRecipId: string;
        if (incomeRecip) {
          incomeRecipId = incomeRecip.id;
        } else {
          const { data: newRecip, error: irErr } = await supabase.from('recipients').insert({ name: 'Løn', category_group_id: incomeGroupId }).select('id').single();
          if (irErr) throw irErr;
          incomeRecipId = newRecip.id;
        }

        const incomePlans = Array.from({ length: 12 }, (_, i) => ({
          budget_id: budget.id, recipient_id: incomeRecipId, month: i + 1, amount_planned: monthlyIncome,
        }));
        await supabase.from('budget_plans').upsert(incomePlans as any, { onConflict: 'budget_id,recipient_id,month' });
      }

      await supabase.from('budgets').update({ is_active: true, budget_account_answer: state.budgetAccount } as any).eq('id', budget.id);

      toast.success('Din plan er klar!');
      onComplete();
      if (onStartVariableWizard) {
        onStartVariableWizard();
      } else {
        router.push('/');
      }
    } catch {
      toast.error('Noget gik galt. Prøv igen.');
    } finally {
      setSaving(false);
    }
  }

  const currentGradient = STEP_GRADIENTS[Math.min(step, STEP_GRADIENTS.length - 1)];

  const isDone = step === TOTAL_STEPS;

  return (
    <WizardShell
      gradient={currentGradient}
      visible={visible}
      step={step}
      totalSteps={TOTAL_STEPS}
      isDone={isDone}
      showBack={step > 0 && !isDone}
      showClose={step === 0}
      onBack={back}
      onClose={onComplete}
      animating={animating}
      direction={direction}
    >

            {/* Step 0 — Start method */}
            {step === 0 && (
              <div className="flex-1 flex flex-col space-y-6">
                <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
                  Budget opsætning
                </p>
                <h1 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                  Kom i gang på 2 minutter
                </h1>
                <p className="text-foreground/60 text-lg leading-relaxed">
                  Hvordan vil du oprette din første plan?
                </p>
                <div className="space-y-3 pt-2 flex-1">
                  {([
                    {
                      id: 'standard' as StartMethod,
                      icon: <Zap className="h-5 w-5 text-amber-500" />,
                      title: 'Brug standardsatser',
                      desc: 'Vi forudfylder en plan baseret på din husstand. Du justerer hvad du vil.',
                      badge: 'Anbefalet',
                    },
                    {
                      id: 'manual' as StartMethod,
                      icon: <PenLine className="h-5 w-5 text-blue-500" />,
                      title: 'Indtast selv',
                      desc: 'Jeg kender mine udgifter og vil starte med dem.',
                      badge: null,
                    },
                    {
                      id: 'import' as StartMethod,
                      icon: <TrendingUp className="h-5 w-5 text-emerald-500" />,
                      title: 'Importér fra banken',
                      desc: 'Hent dine rigtige tal fra en CSV-fil direkte fra netbanken.',
                      badge: 'Mest præcist',
                    },
                  ]).map(option => (
                    <button
                      key={option.id}
                      onClick={() => {
                        setState(s => ({ ...s, method: option.id }));
                        if (option.id === 'import') {
                          onComplete();
                          router.push('/');
                        } else {
                          next();
                        }
                      }}
                      className={`group flex items-center gap-4 w-full text-left rounded-2xl border-2 px-5 py-4 transition-all duration-200 active:scale-[0.99] ${
                        state.method === option.id
                          ? 'border-emerald-400 bg-white/80 shadow-sm'
                          : 'border-white/50 bg-white/60 hover:border-emerald-200 hover:bg-white/80'
                      }`}
                    >
                      <div className="shrink-0 h-11 w-11 rounded-xl bg-white/80 border border-white/60 flex items-center justify-center shadow-sm">
                        {option.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">{option.title}</span>
                          {option.badge && (
                            <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                              {option.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{option.desc}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-foreground/20 shrink-0 group-hover:text-emerald-500 transition-colors" />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-center text-foreground/40">Du kan altid ændre det bagefter.</p>
              </div>
            )}

            {/* Step 1 — Expenses */}
            {step === 1 && (
              <div className="flex-1 flex flex-col space-y-5">
                <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
                  Dine udgifter
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                  {state.method === 'standard' ? 'Vi har lavet et forslag' : 'Hvad bruger du penge på?'}
                </h2>
                <p className="text-foreground/60 text-base leading-relaxed">
                  {state.method === 'standard' ? 'Tilpas beløbene eller slå kategorier til/fra.' : 'Tilføj dine faste udgifter og juster beløbene.'}
                </p>
                <div className="space-y-2 flex-1">
                  {state.expenses.map(expense => (
                    <div
                      key={expense.id}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
                        expense.enabled
                          ? 'border-white/50 bg-white/70 backdrop-blur'
                          : 'border-white/30 bg-white/30 opacity-50'
                      }`}
                    >
                      <button
                        onClick={() => toggleExpense(expense.id)}
                        className={`shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          expense.enabled ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-foreground/20'
                        }`}
                      >
                        {expense.enabled && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <div className="shrink-0 text-foreground/50">{expense.icon}</div>
                      <span className="flex-1 text-sm font-medium text-foreground/80">{expense.label}</span>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          value={expense.amount}
                          onChange={e => updateExpenseAmount(expense.id, parseInt(e.target.value) || 0)}
                          disabled={!expense.enabled}
                          className="w-24 h-8 text-right text-sm rounded-xl border-white/40 bg-white/60"
                        />
                        <span className="text-xs text-foreground/40 shrink-0">kr/md</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl bg-white/60 backdrop-blur border border-white/40 px-5 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground/60">Samlet pr. måned</span>
                  <span className="text-lg font-bold text-foreground">{formatCurrency(totalExpenses)} kr.</span>
                </div>
              </div>
            )}

            {/* Step 2 — Budget account */}
            {step === 2 && (
              <div className="flex-1 flex flex-col space-y-5">
                <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
                  Budgetkonto
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                  Fast budgetkonto
                </h2>
                <p className="text-foreground/60 text-base leading-relaxed">
                  Har du en fast budgetkonto, og bruger du den aktivt?
                </p>
                <div className="space-y-3 flex-1">
                  {([
                    { id: 'yes_active' as BudgetAccountAnswer, label: 'Ja, jeg bruger den regelmæssigt', desc: 'Alle faste udgifter trækkes fra én konto.' },
                    { id: 'yes_rarely' as BudgetAccountAnswer, label: 'Ja, men jeg bruger den sjældent', desc: 'Jeg har den, men husker ikke altid at bruge den.' },
                    { id: 'considering' as BudgetAccountAnswer, label: 'Nej, men jeg overvejer det', desc: 'Jeg synes det lyder fornuftigt.' },
                    { id: 'no_unknown' as BudgetAccountAnswer, label: 'Nej, og jeg kender ikke til det', desc: 'Nyt koncept for mig.' },
                  ]).map(option => (
                    <button
                      key={option.id}
                      onClick={() => setState(s => ({ ...s, budgetAccount: option.id }))}
                      className={`flex items-center justify-between w-full text-left rounded-2xl border-2 px-5 py-4 transition-all duration-200 active:scale-[0.99] ${
                        state.budgetAccount === option.id
                          ? 'border-emerald-400 bg-white/80 shadow-sm'
                          : 'border-white/50 bg-white/60 hover:border-emerald-200 hover:bg-white/80'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-sm text-foreground">{option.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{option.desc}</div>
                      </div>
                      {state.budgetAccount === option.id && (
                        <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 ml-3">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </button>
                  ))}

                  <div className="rounded-2xl bg-white/50 backdrop-blur border border-white/40 overflow-hidden mt-2">
                    <div className="px-4 py-3 border-b border-white/30 bg-amber-50/60">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
                        <span className="font-semibold text-sm text-foreground">Hvad er en fast budgetkonto?</span>
                      </div>
                    </div>
                    <div className="px-4 py-3 space-y-3">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        En fast budgetkonto er en separat konto, hvorfra alle dine faste udgifter trækkes automatisk.
                      </p>
                      <div className="space-y-2">
                        {[
                          { icon: <Eye className="h-3.5 w-3.5 text-blue-500" />, title: 'Bedre overblik', desc: 'Du kan altid se præcist, hvad der er tilbage til forbrug.' },
                          { icon: <TrendingDown className="h-3.5 w-3.5 text-rose-500" />, title: 'Undgå overforbrug', desc: 'Pengene til husleje og forsikringer er allerede sat til side.' },
                          { icon: <PiggyBank className="h-3.5 w-3.5 text-emerald-500" />, title: 'Opsparing til store udgifter', desc: 'Læg f.eks. 500 kr./md. til side — og hav 6.000 kr. klar om et år.' },
                        ].map((item, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <div className="shrink-0 mt-0.5">{item.icon}</div>
                            <div>
                              <p className="text-xs font-semibold text-foreground/80">{item.title}</p>
                              <p className="text-xs text-muted-foreground">{item.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 — Buffer */}
            {step === 3 && (
              <div className="flex-1 flex flex-col space-y-5">
                <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
                  Buffer
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                  Har du en buffer?
                </h2>
                <p className="text-foreground/60 text-base leading-relaxed">
                  Til uforudsete udgifter — en ekstraregning, et reparationsbehov.
                </p>
                <div className="space-y-3 flex-1">
                  {([
                    { id: 'yes' as BufferAnswer, label: 'Ja, jeg har en buffer', desc: 'Godt! En buffer giver ro i hverdagen.' },
                    { id: 'no' as BufferAnswer, label: 'Nej, ikke endnu', desc: 'De fleste oplever uventede regninger 3–4 gange om året.' },
                    { id: 'unsure' as BufferAnswer, label: 'Ikke sikker', desc: 'Vi kan hjælpe dig med at sætte en opsparing.' },
                  ]).map(option => (
                    <button
                      key={option.id}
                      onClick={() => setState(s => ({ ...s, buffer: option.id }))}
                      className={`flex items-center justify-between w-full text-left rounded-2xl border-2 px-5 py-4 transition-all duration-200 active:scale-[0.99] ${
                        state.buffer === option.id
                          ? 'border-emerald-400 bg-white/80 shadow-sm'
                          : 'border-white/50 bg-white/60 hover:border-emerald-200 hover:bg-white/80'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-sm text-foreground">{option.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{option.desc}</div>
                      </div>
                      {state.buffer === option.id && (
                        <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 ml-3">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4 — Summary / Done */}
            {isDone && (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                <div className="h-20 w-20 rounded-3xl bg-white/80 backdrop-blur border border-white/60 shadow-lg flex items-center justify-center">
                  <Check className="h-10 w-10 text-emerald-500" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                    Din plan er klar
                  </h2>
                  <p className="text-foreground/60 text-lg leading-relaxed">
                    Her er et hurtigt overblik over dine faste udgifter.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                  <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/50 px-4 py-4 text-left">
                    <p className="text-xs font-medium text-foreground/50 uppercase tracking-wide mb-1">Faste udgifter / md.</p>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(totalExpenses)} kr.</p>
                  </div>
                  <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/50 px-4 py-4 text-left">
                    <p className="text-xs font-medium text-foreground/50 uppercase tracking-wide mb-1">Andel af indkomst</p>
                    <p className="text-xl font-bold text-foreground">{incomeShare !== null ? `${incomeShare}%` : '–'}</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/60 backdrop-blur border border-white/40 px-5 py-4 w-full max-w-sm text-left space-y-1.5">
                  {state.expenses.filter(e => e.enabled).map(expense => (
                    <div key={expense.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-foreground/60">
                        {expense.icon}
                        <span>{expense.label}</span>
                      </div>
                      <span className="font-medium text-foreground/80">{formatCurrency(expense.amount)} kr.</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          {/* CTA */}
          <div className="pt-6">
            {isDone ? (
              <div className="space-y-2">
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="w-full h-14 rounded-2xl font-semibold text-base text-white flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all duration-200 disabled:opacity-60"
                  style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
                >
                  {saving ? 'Opretter plan...' : (onStartVariableWizard ? 'Estimér variabelt forbrug' : 'Se mit samlede overblik')}
                  {!saving && <ArrowRight className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => animate('back', () => setStep(0))}
                  disabled={saving}
                  className="w-full text-sm text-foreground/40 hover:text-foreground/70 transition-colors disabled:opacity-0"
                >
                  Start forfra
                </button>
              </div>
            ) : step === 0 ? null : (
              <button
                onClick={step === TOTAL_STEPS - 1 ? next : next}
                disabled={
                  (step === 2 && !state.budgetAccount) ||
                  (step === 3 && !state.buffer)
                }
                className="w-full h-14 rounded-2xl font-semibold text-base text-white flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                {step === TOTAL_STEPS - 1 ? 'Se sammenfatning' : 'Fortsæt'}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
    </WizardShell>
  );
}
