'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Receipt,
  ChartBar as BarChart3,
  Wallet,
  Zap,
  Target,
  TrendingUp,
  ClipboardCheck,
  Chrome as Home,
  TriangleAlert as AlertTriangle,
  CircleCheck as CheckCircle2,
  Loader as Loader2,
  RotateCcw,
  Eye,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

interface SectionCounts {
  transactions: number;
  budget_plans: number;
  budgets: number;
  quick_expenses: number;
  quick_expense_monthly_budgets: number;
  savings_goals: number;
  investment_settings: number;
  mini_checkup_user_state: number;
}

interface ResetSections {
  transactions: boolean;
  budgets: boolean;
  nuvioFlow: boolean;
  savingsGoals: boolean;
  investmentSettings: boolean;
  checkupHistory: boolean;
  household: boolean;
}

const SECTION_CONFIG = [
  {
    key: 'transactions' as keyof ResetSections,
    icon: Receipt,
    label: 'Posteringer',
    description: 'Alle importerede og manuelle transaktioner samt budgetplaner',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    countKeys: ['transactions', 'budget_plans'] as (keyof SectionCounts)[],
  },
  {
    key: 'budgets' as keyof ResetSections,
    icon: Wallet,
    label: 'Budgetter og kategorier',
    description: 'Alle budgetter, kategorier, modtagere og regler',
    color: 'text-red-600',
    bg: 'bg-red-50',
    countKeys: ['budgets'] as (keyof SectionCounts)[],
  },
  {
    key: 'nuvioFlow' as keyof ResetSections,
    icon: Zap,
    label: 'Nuvio Flow',
    description: 'Hurtige udgifter, månedlige budgetter og streaks',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    countKeys: ['quick_expenses', 'quick_expense_monthly_budgets'] as (keyof SectionCounts)[],
  },
  {
    key: 'savingsGoals' as keyof ResetSections,
    icon: Target,
    label: 'Opsparingsmål',
    description: 'Alle opsparingsmål og fremskridt',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    countKeys: ['savings_goals'] as (keyof SectionCounts)[],
  },
  {
    key: 'investmentSettings' as keyof ResetSections,
    icon: TrendingUp,
    label: 'Investeringsindstillinger',
    description: 'Investerings-wizard svar og porteføljeindstillinger',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    countKeys: ['investment_settings'] as (keyof SectionCounts)[],
  },
  {
    key: 'checkupHistory' as keyof ResetSections,
    icon: ClipboardCheck,
    label: 'Checkup-historik',
    description: 'Mini-checkup tilstand og visningshistorik',
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    countKeys: ['mini_checkup_user_state'] as (keyof SectionCounts)[],
  },
  {
    key: 'household' as keyof ResetSections,
    icon: Home,
    label: 'Husstandsdata',
    description: 'Husstandsoplysninger, antal voksne/børn og boligtype',
    color: 'text-stone-600',
    bg: 'bg-stone-50',
    countKeys: [] as (keyof SectionCounts)[],
  },
];

const EMPTY_SECTIONS: ResetSections = {
  transactions: false,
  budgets: false,
  nuvioFlow: false,
  savingsGoals: false,
  investmentSettings: false,
  checkupHistory: false,
  household: false,
};

function sumCounts(counts: SectionCounts | null, keys: (keyof SectionCounts)[]): number {
  if (!counts) return 0;
  return keys.reduce((sum, k) => sum + (counts[k] ?? 0), 0);
}

function CountBadge({ n }: { n: number }) {
  if (n === 0) return <span className="text-xs text-muted-foreground">0 poster</span>;
  return (
    <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
      {n.toLocaleString('da-DK')} poster
    </span>
  );
}

export default function UserDataResetWizard() {
  const { user } = useAuth();
  const [step, setStep] = useState<'collapsed' | 'select' | 'preview' | 'done'>('collapsed');
  const [sections, setSections] = useState<ResetSections>(EMPTY_SECTIONS);
  const [counts, setCounts] = useState<SectionCounts | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const anySectionSelected = Object.values(sections).some(Boolean);
  const totalRecords = counts
    ? SECTION_CONFIG.filter((s) => sections[s.key]).reduce((sum, s) => sum + sumCounts(counts, s.countKeys), 0)
    : 0;

  useEffect(() => {
    setCounts(null);
    if (step === 'preview') setStep('select');
  }, [sections]);

  async function getBudgetIds(userId: string): Promise<string[]> {
    const { data } = await supabase
      .from('budgets')
      .select('id')
      .eq('user_id', userId);
    return (data ?? []).map((r: { id: string }) => r.id);
  }

  async function handlePreview() {
    if (!user || !anySectionSelected) return;
    setPreviewing(true);
    try {
      const result: SectionCounts = {
        transactions: 0,
        budget_plans: 0,
        budgets: 0,
        quick_expenses: 0,
        quick_expense_monthly_budgets: 0,
        savings_goals: 0,
        investment_settings: 0,
        mini_checkup_user_state: 0,
      };

      if (sections.transactions || sections.budgets) {
        const budgetIds = await getBudgetIds(user.id);

        if (sections.transactions && budgetIds.length > 0) {
          const [t, bp] = await Promise.all([
            supabase.from('transactions').select('id', { count: 'exact', head: true }).in('budget_id', budgetIds),
            supabase.from('budget_plans').select('id', { count: 'exact', head: true }).in('budget_id', budgetIds),
          ]);
          result.transactions = t.count ?? 0;
          result.budget_plans = bp.count ?? 0;
        }

        if (sections.budgets) {
          const b = await supabase.from('budgets').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
          result.budgets = b.count ?? 0;
        }
      }

      if (sections.nuvioFlow) {
        const [qe, qemb] = await Promise.all([
          supabase.from('quick_expenses').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('quick_expense_monthly_budgets').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        ]);
        result.quick_expenses = qe.count ?? 0;
        result.quick_expense_monthly_budgets = qemb.count ?? 0;
      }

      if (sections.savingsGoals) {
        const sg = await supabase.from('savings_goals').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
        result.savings_goals = sg.count ?? 0;
      }

      if (sections.investmentSettings) {
        const inv = await supabase.from('investment_settings').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
        result.investment_settings = inv.count ?? 0;
      }

      if (sections.checkupHistory) {
        const mc = await supabase.from('mini_checkup_user_state').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
        result.mini_checkup_user_state = mc.count ?? 0;
      }

      setCounts(result);
      setStep('preview');
    } catch {
      toast.error('Kunne ikke hente forhåndsvisning');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleReset() {
    if (!user) return;
    setConfirmOpen(false);
    setResetting(true);
    try {
      if (sections.transactions || sections.budgets) {
        const budgetIds = await getBudgetIds(user.id);

        if (sections.transactions && budgetIds.length > 0) {
          await supabase.from('budget_plans').delete().in('budget_id', budgetIds);
          await supabase.from('transactions').delete().in('budget_id', budgetIds);
        }

        if (sections.budgets && budgetIds.length > 0) {
          await supabase.from('budget_plans').delete().in('budget_id', budgetIds);
          await supabase.from('transactions').delete().in('budget_id', budgetIds);
          await supabase.from('merchant_rules').delete().in('budget_id', budgetIds);
          await supabase.from('recipient_rules').delete().in('budget_id', budgetIds);
          await supabase.from('recipients').delete().in('budget_id', budgetIds);
          await supabase.from('category_groups').delete().in('budget_id', budgetIds);
          await supabase.from('budgets').delete().eq('user_id', user.id);
        }
      }

      if (sections.nuvioFlow) {
        await supabase.from('quick_expense_streaks').delete().eq('user_id', user.id);
        await supabase.from('quick_expense_month_transitions').delete().eq('user_id', user.id);
        await supabase.from('quick_expense_monthly_budgets').delete().eq('user_id', user.id);
        await supabase.from('quick_expenses').delete().eq('user_id', user.id);
      }

      if (sections.savingsGoals) {
        await supabase.from('savings_goals').delete().eq('user_id', user.id);
      }

      if (sections.investmentSettings) {
        await supabase.from('investment_settings').delete().eq('user_id', user.id);
      }

      if (sections.checkupHistory) {
        await supabase.from('mini_checkup_user_state').delete().eq('user_id', user.id);
      }

      if (sections.household) {
        await supabase.from('household').update({
          adult_count: 1,
          child_count: 0,
          members: [],
          variable_expense_estimate: null,
          variable_postal_code: null,
          variable_is_student: false,
          variable_children_birth_years: [],
        } as any).eq('user_id', user.id);
      }

      setSections(EMPTY_SECTIONS);
      setCounts(null);
      setStep('done');
      toast.success('Data nulstillet');
    } catch {
      toast.error('Noget gik galt. Prøv igen.');
    } finally {
      setResetting(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/40 px-4 py-4 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        <p className="text-sm font-medium text-emerald-800 flex-1">
          Dine valgte data er nu slettet permanent.
        </p>
        <button
          onClick={() => setStep('collapsed')}
          className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-900 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Nulstil mere
        </button>
      </div>
    );
  }

  if (step === 'collapsed') {
    return (
      <div className="rounded-2xl border border-red-200/60 bg-red-50/30 overflow-hidden">
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-red-100 border border-red-200/60 flex items-center justify-center shrink-0">
            <Trash2 className="h-4 w-4 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">Slet data</p>
            <p className="text-xs text-red-600/70 mt-0.5 leading-relaxed">
              Permanent sletning af udvalgte data. Kan ikke fortrydes.
            </p>
          </div>
          <button
            onClick={() => setStep('select')}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-900 transition-colors px-3 py-1.5 rounded-xl border border-red-200/80 hover:border-red-300 bg-white/70 hover:bg-red-50 shrink-0"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Åbn
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-red-200/60 bg-red-50/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-red-100/60 flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Slet data</p>
            <p className="text-xs text-red-600/60 leading-relaxed">
              Alle handlinger er permanente og kan ikke fortrydes.
            </p>
          </div>
          <button
            onClick={() => { setStep('collapsed'); setSections(EMPTY_SECTIONS); setCounts(null); }}
            className="text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-100/60"
          >
            Luk
          </button>
        </div>

        <div className="divide-y divide-red-100/40">
          {SECTION_CONFIG.map((section) => {
            const Icon = section.icon;
            const count = sumCounts(counts, section.countKeys);
            return (
              <div
                key={section.key}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  sections[section.key] ? 'bg-red-50/60' : 'bg-white/40'
                }`}
              >
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${section.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${section.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{section.label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{section.description}</p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  {counts && section.countKeys.length > 0 && <CountBadge n={count} />}
                  <Switch
                    checked={sections[section.key]}
                    onCheckedChange={(val) =>
                      setSections((prev) => ({ ...prev, [section.key]: val }))
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {anySectionSelected && (
        <div className="rounded-2xl border border-red-200/60 bg-white/80 px-4 py-3.5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1">
              {counts ? (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <p className="text-sm">
                    Forhåndsvisning klar —{' '}
                    <span className="font-semibold text-red-600">
                      {totalRecords.toLocaleString('da-DK')} poster
                    </span>{' '}
                    slettes permanent
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Se hvad der berøres inden du sletter.
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handlePreview}
                disabled={previewing}
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold border border-foreground/10 bg-white hover:bg-secondary/40 text-foreground transition-colors disabled:opacity-50"
              >
                {previewing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                Forhåndsvis
              </button>
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={resetting || !counts}
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-40"
              >
                {resetting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Slet valgte data
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Er du sikker?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Du er ved at slette{' '}
                <strong>{totalRecords.toLocaleString('da-DK')} poster</strong> permanent.
              </span>
              <span className="block text-red-600 font-medium">
                Denne handling kan ikke fortrydes.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Annuller</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
              onClick={handleReset}
            >
              Ja, slet permanent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
