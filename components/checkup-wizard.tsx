'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { ArrowRight, Check, TrendingUp, TrendingDown, Activity, PiggyBank, ChartLine as LineChart } from 'lucide-react';
import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/number-helpers';
import { useAdminLabel } from '@/components/admin-page-label';

interface Props {
  budgetId: string;
  onComplete: () => void;
  onDismiss: () => void;
  lastCheckupAt?: string | null;
  checkupCount?: number;
}

interface VariableCategory {
  id: string;
  label: string;
  amount: number;
  originalAmount: number;
}

const TOTAL_STEPS = 6;

const STEP_GRADIENTS = [
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 40%, #ffffff 100%)',
  'linear-gradient(160deg, #f0fdfa 0%, #ecfdf5 50%, #ffffff 100%)',
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 30%, #ffffff 100%)',
  'linear-gradient(160deg, #f0fdf4 0%, #ecfdf5 40%, #ffffff 100%)',
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 50%, #ffffff 100%)',
  'linear-gradient(160deg, #f0fdfa 0%, #ecfdf5 30%, #ffffff 100%)',
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 40%, #ffffff 100%)',
];

const CHECKUP_STEP_LABELS: Record<number, string> = {
  0: 'Intro',
  1: 'Indkomst',
  2: 'Faste udgifter',
  3: 'Variable udgifter',
  4: 'Opsparing',
  5: 'Investering',
  6: 'Resultat',
};

function fc(v: number) {
  return formatCurrency(v, { roundToHundreds: false, decimals: 0 });
}

export function CheckupWizard({ budgetId, onComplete, onDismiss, lastCheckupAt, checkupCount = 0 }: Props) {
  const { user } = useAuth();
  const { setWizard } = useAdminLabel();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);
  const { animating, direction, animate } = useWizardAnimation();

  const [currentIncome, setCurrentIncome] = useState(0);
  const [currentFixed, setCurrentFixed] = useState(0);
  const [incomeChanged, setIncomeChanged] = useState<'no' | 'up' | 'down' | null>(null);
  const [newIncome, setNewIncome] = useState('');

  const [fixedChanged, setFixedChanged] = useState<'no' | 'yes' | null>(null);
  const [newFixedName, setNewFixedName] = useState('');
  const [newFixedAmount, setNewFixedAmount] = useState('');

  const [variableFeels, setVariableFeels] = useState<'yes' | 'adjust' | null>(null);
  const [variableCategories, setVariableCategories] = useState<VariableCategory[]>([]);
  const [varEstimate, setVarEstimate] = useState(0);

  const [currentSavings, setCurrentSavings] = useState(0);
  const [savingsAnswer, setSavingsAnswer] = useState<'no' | 'adjust' | null>(null);
  const [newSavingsAmount, setNewSavingsAmount] = useState('');

  const [currentInvestment, setCurrentInvestment] = useState(0);
  const [investmentAnswer, setInvestmentAnswer] = useState<'no' | 'adjust' | null>(null);
  const [newInvestmentAmount, setNewInvestmentAmount] = useState('');

  const [summaryData, setSummaryData] = useState<{
    income: number; fixed: number; variable: number; savings: number; investment: number;
  } | null>(null);

  useEffect(() => {
    setWizard({ name: 'Nuvio Checkup', step: step + 1, totalSteps: 7, stepLabel: CHECKUP_STEP_LABELS[step] });
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
    loadCurrentData();
  }, [budgetId]);

  async function loadCurrentData() {
    try {
      const [{ data: household }, { data: plans }, { data: goals }, { data: inv }] = await Promise.all([
        supabase.from('household').select('variable_expense_estimate, members').maybeSingle(),
        supabase
          .from('budget_plans')
          .select('amount_planned, recipients(category_group_id, category_groups(id, name, is_income))')
          .eq('budget_id', budgetId)
          .eq('month', new Date().getMonth() + 1),
        supabase.from('savings_goals').select('monthly_contribution').eq('completed', false),
        supabase.from('investment_settings').select('monthly_amount').eq('user_id', user?.id ?? '').maybeSingle(),
      ]);

      const members = (household?.members as any[]) ?? [];
      const totalSalary = members
        .filter((m: any) => m.type === 'adult' && m.monthly_net_salary)
        .reduce((sum: number, m: any) => sum + (m.monthly_net_salary ?? 0), 0);

      const allPlans = plans ?? [];
      const incomePlans = allPlans.filter((p: any) => p.recipients?.category_groups?.is_income === true);
      const expensePlans = allPlans.filter((p: any) => p.recipients?.category_groups?.is_income === false);

      if (totalSalary > 0) {
        setCurrentIncome(totalSalary);
      } else {
        const incomeTotal = incomePlans.reduce((sum: number, p: any) => sum + parseFloat(p.amount_planned ?? '0'), 0);
        if (incomeTotal > 0) setCurrentIncome(incomeTotal);
      }

      const fixedTotal = expensePlans.reduce((sum: number, p: any) => sum + parseFloat(p.amount_planned ?? '0'), 0);
      setCurrentFixed(fixedTotal);

      const groupTotals: Record<string, { name: string; total: number }> = {};
      for (const p of expensePlans) {
        const grp = (p as any).recipients?.category_groups;
        if (!grp) continue;
        const gid = grp.id as string;
        if (!groupTotals[gid]) groupTotals[gid] = { name: grp.name as string, total: 0 };
        groupTotals[gid].total += parseFloat(p.amount_planned ?? '0');
      }

      const cats: VariableCategory[] = Object.entries(groupTotals)
        .filter(([, v]) => v.total > 0)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([id, v]) => ({ id, label: v.name, amount: Math.round(v.total), originalAmount: Math.round(v.total) }));

      const varEst = (household?.variable_expense_estimate as number) ?? 0;
      setVarEstimate(varEst);

      if (cats.length > 0) {
        setVariableCategories(cats);
      } else if (varEst > 0) {
        setVariableCategories([{ id: 'variable', label: 'Variabelt forbrug', amount: varEst, originalAmount: varEst }]);
      }

      const totalSavings = (goals ?? []).reduce((s: number, g: any) => s + (g.monthly_contribution ?? 0), 0);
      setCurrentSavings(totalSavings);
      setCurrentInvestment((inv as any)?.monthly_amount ?? 0);
    } catch {
      toast.error('Kunne ikke hente aktuelle data');
    }
  }

  function days(): number | null {
    if (!lastCheckupAt) return null;
    const ms = Date.now() - new Date(lastCheckupAt).getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  const effectiveIncome = useMemo(() => {
    if (incomeChanged !== 'no' && incomeChanged !== null && newIncome) {
      const v = parseFloat(newIncome.replace(',', '.'));
      if (!isNaN(v) && v > 0) return v;
    }
    return currentIncome;
  }, [incomeChanged, newIncome, currentIncome]);

  const effectiveFixed = useMemo(() => {
    if (fixedChanged === 'yes' && newFixedAmount) {
      const v = parseFloat(newFixedAmount.replace(',', '.'));
      if (!isNaN(v) && v > 0) return currentFixed + v;
    }
    return currentFixed;
  }, [fixedChanged, newFixedAmount, currentFixed]);

  const effectiveVariable = useMemo(() => {
    if (variableFeels === 'adjust') {
      return variableCategories.reduce((s, c) => s + c.amount, 0);
    }
    return varEstimate;
  }, [variableFeels, variableCategories, varEstimate]);

  const effectiveSavings = useMemo(() => {
    if (savingsAnswer === 'adjust' && newSavingsAmount) {
      const v = parseFloat(newSavingsAmount.replace(',', '.'));
      if (!isNaN(v) && v >= 0) return v;
    }
    return currentSavings;
  }, [savingsAnswer, newSavingsAmount, currentSavings]);

  const effectiveInvestment = useMemo(() => {
    if (investmentAnswer === 'adjust' && newInvestmentAmount) {
      const v = parseFloat(newInvestmentAmount.replace(',', '.'));
      if (!isNaN(v) && v >= 0) return v;
    }
    return currentInvestment;
  }, [investmentAnswer, newInvestmentAmount, currentInvestment]);

  function next() { animate('forward', () => setStep(s => Math.min(s + 1, TOTAL_STEPS))); }
  function back() { animate('back', () => setStep(s => Math.max(s - 1, 0))); }

  async function handleFinish() {
    setSaving(true);
    try {
      if (incomeChanged !== 'no' && incomeChanged !== null && newIncome) {
        const monthly = parseFloat(newIncome.replace(',', '.'));
        if (!isNaN(monthly) && monthly > 0) await saveIncomeUpdate(monthly);
      }

      if (fixedChanged === 'yes' && newFixedName.trim() && newFixedAmount) {
        const amount = parseFloat(newFixedAmount.replace(',', '.'));
        if (!isNaN(amount) && amount > 0) await saveNewFixedExpense(newFixedName.trim(), amount);
      }

      const newVarTotal = variableCategories.reduce((s, c) => s + c.amount, 0);
      if (variableFeels === 'adjust' && newVarTotal !== varEstimate && user) {
        await supabase.from('household').update({ variable_expense_estimate: newVarTotal }).eq('user_id', user.id);
      }

      if (savingsAnswer === 'adjust' && newSavingsAmount && user) {
        const v = parseFloat(newSavingsAmount.replace(',', '.'));
        if (!isNaN(v) && v >= 0) {
          const { data: goals } = await supabase.from('savings_goals').select('id, monthly_contribution').eq('completed', false);
          if (goals && goals.length > 0) {
            const perGoal = Math.round(v / goals.length);
            for (const g of goals) {
              await supabase.from('savings_goals').update({ monthly_contribution: perGoal, updated_at: new Date().toISOString() }).eq('id', g.id);
            }
          } else {
            await supabase.from('savings_goals').insert({ name: 'Opsparing', target_amount: v * 12, current_amount: 0, monthly_contribution: v, completed: false });
          }
        }
      }

      if (investmentAnswer === 'adjust' && newInvestmentAmount && user) {
        const v = parseFloat(newInvestmentAmount.replace(',', '.'));
        if (!isNaN(v) && v >= 0) {
          await supabase.from('investment_settings').upsert({ user_id: user.id, monthly_amount: v, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        }
      }

      await supabase.from('budgets').update({ last_checkup_at: new Date().toISOString(), checkup_count: checkupCount + 1, updated_at: new Date().toISOString() }).eq('id', budgetId);

      setSummaryData({ income: effectiveIncome, fixed: effectiveFixed, variable: effectiveVariable, savings: effectiveSavings, investment: effectiveInvestment });
      animate('forward', () => setStep(TOTAL_STEPS));
    } catch {
      toast.error('Noget gik galt. Prøv igen.');
    } finally {
      setSaving(false);
    }
  }

  async function saveIncomeUpdate(monthly: number) {
    const { data: incomeGroup } = await supabase.from('category_groups').select('id').eq('name', 'Indkomst').maybeSingle();
    if (!incomeGroup) return;
    const { data: recipients } = await supabase.from('recipients').select('id').eq('category_group_id', incomeGroup.id);
    if (!recipients || recipients.length === 0) return;
    const plans = recipients.flatMap(r =>
      Array.from({ length: 12 }, (_, i) => ({ budget_id: budgetId, recipient_id: r.id, month: i + 1, amount_planned: monthly }))
    );
    await supabase.from('budget_plans').upsert(plans, { onConflict: 'budget_id,recipient_id,month' });
    const { data: household } = await supabase.from('household').select('members').maybeSingle();
    if (household?.members) {
      const members = household.members as any[];
      const adults = members.filter((m: any) => m.type === 'adult');
      if (adults.length === 1 && user) {
        const updatedMembers = members.map((m: any) => m.type === 'adult' ? { ...m, monthly_net_salary: monthly } : m);
        await supabase.from('household').update({ members: updatedMembers }).eq('user_id', user.id);
      }
    }
  }

  async function saveNewFixedExpense(name: string, amount: number) {
    const { data: existing } = await supabase.from('recipients').select('id').eq('name', name).maybeSingle();
    if (existing) {
      const plans = Array.from({ length: 12 }, (_, i) => ({ budget_id: budgetId, recipient_id: existing.id, month: i + 1, amount_planned: amount }));
      await supabase.from('budget_plans').upsert(plans, { onConflict: 'budget_id,recipient_id,month' });
      return;
    }
    let groupId: string | null = null;
    const { data: existingGroup } = await supabase.from('category_groups').select('id').eq('is_income', false).limit(1).maybeSingle();
    if (existingGroup) {
      groupId = existingGroup.id;
    } else {
      const { data: newGroup, error: gErr } = await supabase.from('category_groups').insert({ name: 'Faste udgifter', is_income: false }).select('id').single();
      if (gErr) throw gErr;
      groupId = newGroup.id;
    }
    const { data: newRecipient, error: rErr } = await supabase.from('recipients').insert({ name, category_group_id: groupId }).select('id').single();
    if (rErr) throw rErr;
    const plans = Array.from({ length: 12 }, (_, i) => ({ budget_id: budgetId, recipient_id: newRecipient.id, month: i + 1, amount_planned: amount }));
    await supabase.from('budget_plans').upsert(plans, { onConflict: 'budget_id,recipient_id,month' });
  }

  const isResultStep = step === TOTAL_STEPS;
  const currentGradient = STEP_GRADIENTS[Math.min(step, STEP_GRADIENTS.length - 1)];

  const ctaDisabled =
    (step === 1 && incomeChanged === null) ||
    (step === 2 && fixedChanged === null) ||
    (step === 3 && variableFeels === null) ||
    (step === 4 && savingsAnswer === null) ||
    (step === 5 && (investmentAnswer === null || saving));

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
      onClose={onDismiss}
      animating={animating}
      direction={direction}
    >

            {/* Step 0 — Intro */}
            {step === 0 && (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 flex flex-col justify-center space-y-5">
                  <div className="h-16 w-16 rounded-2xl bg-white/80 border border-white/60 shadow-sm flex items-center justify-center">
                    <Activity className="h-8 w-8 text-emerald-500" />
                  </div>
                  <div className="space-y-3">
                    <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
                      Nuvio Checkup
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                      Lad os tage et hurtigt økonomisk tjek
                    </h2>
                  </div>

                  <div className="rounded-2xl bg-white/60 backdrop-blur border border-white/40 px-5 py-4 space-y-2">
                    {days() !== null ? (
                      <p className="text-sm text-foreground/60">
                        Sidst opdateret: <span className="font-semibold text-foreground">{days()} dage siden</span>
                      </p>
                    ) : (
                      <p className="text-sm text-foreground/60">Du har ikke tjekket din plan før.</p>
                    )}
                    {checkupCount > 0 && (
                      <p className="text-sm text-foreground/60">
                        Gennemførte tjek: <span className="font-semibold text-foreground">{checkupCount}</span>
                      </p>
                    )}
                    <p className="text-sm text-foreground/60">
                      Det tager ca. <span className="font-semibold text-foreground">2 minutter</span>
                    </p>
                  </div>

                  {checkupCount >= 3 && (
                    <div className="rounded-2xl bg-emerald-50/60 border border-emerald-200/60 px-5 py-4">
                      <p className="text-sm text-emerald-700 font-medium">
                        Du holder din økonomi opdateret — god disciplin.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 1 — Income */}
            {step === 1 && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="space-y-2">
                  <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
                    Indkomst
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                    Er din indkomst ændret?
                  </h2>
                  {currentIncome > 0 && (
                    <p className="text-foreground/60 text-base leading-relaxed">
                      Nuværende: <span className="font-semibold text-foreground">{fc(currentIncome)}/md.</span>
                    </p>
                  )}
                </div>
                <div className="space-y-2.5 flex-1">
                  {([
                    { value: 'no' as const, label: 'Nej, den er den samme', Icon: Check },
                    { value: 'up' as const, label: 'Ja, den er steget', Icon: TrendingUp },
                    { value: 'down' as const, label: 'Ja, den er faldet', Icon: TrendingDown },
                  ]).map(opt => {
                    const active = incomeChanged === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setIncomeChanged(opt.value)}
                        className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                          active ? 'border-emerald-400 bg-white/80 shadow-sm' : 'border-white/50 bg-white/60 hover:border-emerald-200 hover:bg-white/80'
                        }`}
                      >
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-emerald-500 text-white' : 'bg-white/80 border border-white/60 text-foreground/50'}`}>
                          <opt.Icon className="h-4 w-4" />
                        </div>
                        <span className={`text-sm font-semibold ${active ? 'text-foreground' : 'text-foreground/70'}`}>
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {incomeChanged && incomeChanged !== 'no' && (
                  <div className="rounded-2xl bg-white/60 backdrop-blur border border-white/40 px-5 py-4 space-y-2">
                    <label className="text-xs font-semibold text-emerald-600/70 uppercase tracking-wide">
                      Ny månedlig nettoindkomst (kr.)
                    </label>
                    <Input
                      type="number"
                      placeholder={currentIncome ? String(Math.round(currentIncome)) : '35000'}
                      value={newIncome}
                      onChange={e => setNewIncome(e.target.value)}
                      className="rounded-xl text-base h-12 bg-white/70 border-white/40"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 2 — Fixed */}
            {step === 2 && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="space-y-2">
                  <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
                    Faste udgifter
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                    Er der kommet nye faste udgifter?
                  </h2>
                  <p className="text-foreground/60 text-base leading-relaxed">
                    Abonnementer, husleje, forsikringer eller lign.
                  </p>
                </div>
                <div className="space-y-2.5 flex-1">
                  {([
                    { value: 'no' as const, label: 'Nej, ingen nye faste udgifter' },
                    { value: 'yes' as const, label: 'Ja, jeg vil tilføje en' },
                  ]).map(opt => {
                    const active = fixedChanged === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setFixedChanged(opt.value)}
                        className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl border-2 text-sm font-semibold transition-all duration-200 ${
                          active ? 'border-emerald-400 bg-white/80 shadow-sm text-foreground' : 'border-white/50 bg-white/60 hover:border-emerald-200 hover:bg-white/80 text-foreground/70'
                        }`}
                      >
                        {opt.label}
                        {active && <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0"><Check className="h-3 w-3 text-white" /></div>}
                      </button>
                    );
                  })}
                </div>
                {fixedChanged === 'yes' && (
                  <div className="rounded-2xl bg-white/60 backdrop-blur border border-white/40 px-5 py-4 space-y-3">
                    <p className="text-xs font-semibold text-emerald-600/70 uppercase tracking-wide">Ny fast udgift</p>
                    <Input placeholder="Navn (fx Netflix, Forsikring)" value={newFixedName} onChange={e => setNewFixedName(e.target.value)} className="rounded-xl h-12 bg-white/70 border-white/40" />
                    <Input type="number" placeholder="Beløb pr. måned (kr.)" value={newFixedAmount} onChange={e => setNewFixedAmount(e.target.value)} className="rounded-xl h-12 bg-white/70 border-white/40" />
                  </div>
                )}
              </div>
            )}

            {/* Step 3 — Variable */}
            {step === 3 && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="space-y-2">
                  <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
                    Variable udgifter
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                    Ser dine udgifter realistiske ud?
                  </h2>
                  <p className="text-foreground/60 text-base leading-relaxed">
                    Er de planlagte udgifter stadig relevante for næste periode?
                  </p>
                </div>
                <div className="rounded-2xl bg-white/60 backdrop-blur border border-white/40 overflow-hidden">
                  {variableCategories.map((cat, i) => (
                    <div key={cat.id} className={`flex items-center justify-between px-4 py-3 ${i < variableCategories.length - 1 ? 'border-b border-white/40' : ''}`}>
                      <span className="text-sm text-foreground/70">{cat.label}</span>
                      <span className="text-sm font-bold tabular-nums text-foreground">{fc(cat.amount)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3 bg-emerald-50/50 border-t border-emerald-100/60">
                    <span className="text-sm font-semibold text-foreground/60">Total</span>
                    <span className="text-sm font-bold text-foreground">{fc(variableCategories.reduce((s, c) => s + c.amount, 0))}/md.</span>
                  </div>
                </div>
                <div className="space-y-2.5 flex-1">
                  {([
                    { value: 'yes' as const, label: 'Ja, det ser rigtigt ud' },
                    { value: 'adjust' as const, label: 'Nej, jeg vil justere' },
                  ]).map(opt => {
                    const active = variableFeels === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setVariableFeels(opt.value)}
                        className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl border-2 text-sm font-semibold transition-all duration-200 ${
                          active ? 'border-emerald-400 bg-white/80 shadow-sm text-foreground' : 'border-white/50 bg-white/60 hover:border-emerald-200 hover:bg-white/80 text-foreground/70'
                        }`}
                      >
                        {opt.label}
                        {active && <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0"><Check className="h-3 w-3 text-white" /></div>}
                      </button>
                    );
                  })}
                </div>
                {variableFeels === 'adjust' && (
                  <div className="rounded-2xl bg-white/60 backdrop-blur border border-white/40 px-5 py-4 space-y-3">
                    <p className="text-xs font-semibold text-emerald-600/70 uppercase tracking-wide">Justér beløb</p>
                    {variableCategories.map(cat => (
                      <div key={cat.id} className="flex items-center gap-3">
                        <span className="text-sm text-foreground/70 flex-1 min-w-0 truncate">{cat.label}</span>
                        <Input
                          type="number"
                          value={cat.amount || ''}
                          onChange={e => setVariableCategories(prev =>
                            prev.map(c => c.id === cat.id ? { ...c, amount: parseInt(e.target.value) || 0 } : c)
                          )}
                          className="w-24 rounded-xl h-9 text-sm text-right bg-white/70 border-white/40"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 4 — Savings */}
            {step === 4 && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="space-y-2">
                  <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
                    Opsparing
                  </p>
                  <div className="flex items-center gap-3">
                    <PiggyBank className="h-7 w-7 text-emerald-500 shrink-0" />
                    <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                      Opsparing
                    </h2>
                  </div>
                  {currentSavings > 0 ? (
                    <p className="text-foreground/60 text-base leading-relaxed">
                      Nuværende opsparingsmål: <span className="font-semibold text-foreground">{fc(currentSavings)}/md.</span>
                    </p>
                  ) : (
                    <p className="text-foreground/60 text-base leading-relaxed">Du har ikke sat opsparingsmål endnu.</p>
                  )}
                </div>
                <div className="space-y-2.5 flex-1">
                  {([
                    { value: 'no' as const, label: currentSavings > 0 ? 'Beløbet passer stadig' : 'Ingen ændring' },
                    { value: 'adjust' as const, label: currentSavings > 0 ? 'Jeg vil justere beløbet' : 'Jeg vil spare mere op' },
                  ]).map(opt => {
                    const active = savingsAnswer === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setSavingsAnswer(opt.value)}
                        className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl border-2 text-sm font-semibold transition-all duration-200 ${
                          active ? 'border-emerald-400 bg-white/80 shadow-sm text-foreground' : 'border-white/50 bg-white/60 hover:border-emerald-200 hover:bg-white/80 text-foreground/70'
                        }`}
                      >
                        {opt.label}
                        {active && <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0"><Check className="h-3 w-3 text-white" /></div>}
                      </button>
                    );
                  })}
                </div>
                {savingsAnswer === 'adjust' && (
                  <div className="rounded-2xl bg-white/60 backdrop-blur border border-white/40 px-5 py-4 space-y-2">
                    <label className="text-xs font-semibold text-emerald-600/70 uppercase tracking-wide">
                      Samlet månedlig opsparing (kr.)
                    </label>
                    <Input
                      type="number"
                      placeholder={currentSavings ? String(Math.round(currentSavings)) : '1000'}
                      value={newSavingsAmount}
                      onChange={e => setNewSavingsAmount(e.target.value)}
                      className="rounded-xl text-base h-12 bg-white/70 border-white/40"
                    />
                    {currentSavings > 0 && (
                      <p className="text-xs text-foreground/40">Fordeles ligeligt på dine aktive opsparingsmål</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 5 — Investment */}
            {step === 5 && (
              <div className="flex-1 flex flex-col space-y-5">
                <div className="space-y-2">
                  <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
                    Investering
                  </p>
                  <div className="flex items-center gap-3">
                    <LineChart className="h-7 w-7 text-blue-400 shrink-0" />
                    <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                      Investering
                    </h2>
                  </div>
                  {currentInvestment > 0 ? (
                    <p className="text-foreground/60 text-base leading-relaxed">
                      Nuværende investering: <span className="font-semibold text-foreground">{fc(currentInvestment)}/md.</span>
                    </p>
                  ) : (
                    <p className="text-foreground/60 text-base leading-relaxed">Du investerer ikke automatisk endnu.</p>
                  )}
                </div>
                <div className="space-y-2.5 flex-1">
                  {([
                    { value: 'no' as const, label: currentInvestment > 0 ? 'Beløbet passer stadig' : 'Ingen ændring' },
                    { value: 'adjust' as const, label: currentInvestment > 0 ? 'Jeg vil justere beløbet' : 'Jeg vil begynde at investere' },
                  ]).map(opt => {
                    const active = investmentAnswer === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setInvestmentAnswer(opt.value)}
                        className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl border-2 text-sm font-semibold transition-all duration-200 ${
                          active ? 'border-blue-300 bg-blue-50/60 shadow-sm text-foreground' : 'border-white/50 bg-white/60 hover:border-blue-200 hover:bg-white/80 text-foreground/70'
                        }`}
                      >
                        {opt.label}
                        {active && <div className="h-5 w-5 rounded-full bg-blue-400 flex items-center justify-center shrink-0"><Check className="h-3 w-3 text-white" /></div>}
                      </button>
                    );
                  })}
                </div>
                {investmentAnswer === 'adjust' && (
                  <div className="rounded-2xl bg-white/60 backdrop-blur border border-white/40 px-5 py-4 space-y-2">
                    <label className="text-xs font-semibold text-blue-500/80 uppercase tracking-wide">
                      Månedlig investering (kr.)
                    </label>
                    <Input
                      type="number"
                      placeholder={currentInvestment ? String(Math.round(currentInvestment)) : '500'}
                      value={newInvestmentAmount}
                      onChange={e => setNewInvestmentAmount(e.target.value)}
                      className="rounded-xl text-base h-12 bg-white/70 border-white/40"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 6 — Result */}
            {isResultStep && summaryData && (
              <div className="flex-1 flex flex-col space-y-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="h-20 w-20 rounded-3xl bg-white/80 border border-white/60 shadow-lg flex items-center justify-center">
                    <Check className="h-10 w-10 text-emerald-500" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                      {incomeChanged === 'no' && fixedChanged === 'no' && variableFeels === 'yes' && savingsAnswer === 'no' && investmentAnswer === 'no'
                        ? 'Perfekt — din plan er stadig realistisk.'
                        : 'Din plan er opdateret.'
                      }
                    </h2>
                    <p className="text-foreground/60 text-base">Næste anbefalede tjek: om ca. 30 dage.</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/50 overflow-hidden">
                  <div className="px-5 py-3 bg-white/40 border-b border-white/40">
                    <p className="text-xs font-semibold uppercase tracking-widest text-foreground/40">Opdateret overblik</p>
                  </div>
                  <div className="divide-y divide-white/40">
                    <div className="px-5 py-3 flex items-center justify-between">
                      <span className="text-sm text-foreground/60">Indkomst</span>
                      <span className="text-sm font-bold tabular-nums text-emerald-600">{fc(summaryData.income)}/md.</span>
                    </div>
                    <div className="px-5 py-3 flex items-center justify-between">
                      <span className="text-sm text-foreground/60">Faste udgifter</span>
                      <span className="text-sm font-bold tabular-nums text-foreground/70">−{fc(summaryData.fixed)}/md.</span>
                    </div>
                    <div className="px-5 py-3 flex items-center justify-between">
                      <span className="text-sm text-foreground/60">Variabelt forbrug</span>
                      <span className="text-sm font-bold tabular-nums text-amber-600">−{fc(summaryData.variable)}/md.</span>
                    </div>
                    {summaryData.savings > 0 && (
                      <div className="px-5 py-3 flex items-center justify-between">
                        <span className="text-sm text-foreground/60">Opsparing</span>
                        <span className="text-sm font-bold tabular-nums text-emerald-600">−{fc(summaryData.savings)}/md.</span>
                      </div>
                    )}
                    {summaryData.investment > 0 && (
                      <div className="px-5 py-3 flex items-center justify-between">
                        <span className="text-sm text-foreground/60">Investering</span>
                        <span className="text-sm font-bold tabular-nums text-blue-500">−{fc(summaryData.investment)}/md.</span>
                      </div>
                    )}
                    {(() => {
                      const available = summaryData.income - summaryData.fixed - summaryData.variable - summaryData.savings - summaryData.investment;
                      return (
                        <div className={`px-5 py-4 flex items-center justify-between ${available >= 0 ? 'bg-emerald-50/50' : 'bg-rose-50/50'}`}>
                          <span className="text-sm font-bold">Rådighedsbeløb</span>
                          <span className={`text-base font-bold tabular-nums ${available >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {available >= 0 ? fc(available) : `−${fc(Math.abs(available))}`}/md.
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          {/* CTA */}
          <div className="pt-6 shrink-0">
            {isResultStep ? (
              <button
                onClick={onComplete}
                className="w-full h-14 rounded-2xl font-semibold text-base text-white flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all duration-200"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                Luk <ArrowRight className="h-4 w-4" />
              </button>
            ) : step === 5 ? (
              <button
                onClick={handleFinish}
                disabled={ctaDisabled}
                className="w-full h-14 rounded-2xl font-semibold text-base text-white flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                {saving ? 'Gemmer...' : 'Afslut tjek'}
                {!saving && <ArrowRight className="h-4 w-4" />}
              </button>
            ) : (
              <button
                onClick={next}
                disabled={ctaDisabled}
                className="w-full h-14 rounded-2xl font-semibold text-base text-white flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                {step === 0 ? 'Start gennemgang' : 'Videre'}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
    </WizardShell>
  );
}
