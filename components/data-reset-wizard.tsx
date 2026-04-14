'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import { Receipt, ChartBar as BarChart3, Wallet, Zap, Target, TrendingUp, ClipboardCheck, Chrome as Home, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Loader as Loader2, RotateCcw, Eye } from 'lucide-react';
import { toast } from 'sonner';

const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-data-reset`;

interface ResetSections {
  transactions: boolean;
  budgetPlans: boolean;
  budgets: boolean;
  nuvioFlow: boolean;
  savingsGoals: boolean;
  investmentSettings: boolean;
  checkupHistory: boolean;
  household: boolean;
}

interface ResetCounts {
  transactions: number;
  budget_plans: number;
  budget_lines: number;
  budgets: number;
  category_groups: number;
  recipients: number;
  recipient_rules: number;
  quick_expenses: number;
  quick_expense_monthly_budgets: number;
  quick_expense_month_transitions: number;
  quick_expense_streaks: number;
  savings_goals: number;
  investment_settings: number;
  mini_checkup_user_state: number;
  household: number;
  user_precision_commitment: number;
}

interface AdminUser {
  id: string;
  email: string;
}

interface Props {
  users: AdminUser[];
}

const SECTION_CONFIG = [
  {
    key: 'transactions' as keyof ResetSections,
    icon: Receipt,
    label: 'Posteringer',
    description: 'Alle importerede og manuelle transaktioner',
    countKeys: ['transactions'] as (keyof ResetCounts)[],
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  {
    key: 'budgetPlans' as keyof ResetSections,
    icon: BarChart3,
    label: 'Budget-planer',
    description: 'Budgetlinjer og månedlige planer (modtagere og kategorier beholdes)',
    countKeys: ['budget_plans', 'budget_lines'] as (keyof ResetCounts)[],
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    key: 'budgets' as keyof ResetSections,
    icon: Wallet,
    label: 'Budgetter, kategorier og modtagere',
    description: 'Alle budgetter inkl. kategorier, modtagere og regler. Inkluderer også posteringer og planer.',
    countKeys: ['budgets', 'category_groups', 'recipients', 'recipient_rules'] as (keyof ResetCounts)[],
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  {
    key: 'nuvioFlow' as keyof ResetSections,
    icon: Zap,
    label: 'Nuvio Flow',
    description: 'Hurtige udgifter, månedlige budgetter, streaks og månedsovergange',
    countKeys: ['quick_expenses', 'quick_expense_monthly_budgets', 'quick_expense_month_transitions', 'quick_expense_streaks'] as (keyof ResetCounts)[],
    color: 'text-teal-600',
    bg: 'bg-teal-50',
  },
  {
    key: 'savingsGoals' as keyof ResetSections,
    icon: Target,
    label: 'Opsparingsmål',
    description: 'Alle opsparingsmål og fremskridt',
    countKeys: ['savings_goals'] as (keyof ResetCounts)[],
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    key: 'investmentSettings' as keyof ResetSections,
    icon: TrendingUp,
    label: 'Investeringsindstillinger',
    description: 'Investerings-wizard svar og porteføljeindstillinger',
    countKeys: ['investment_settings'] as (keyof ResetCounts)[],
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    key: 'checkupHistory' as keyof ResetSections,
    icon: ClipboardCheck,
    label: 'Checkup-historik',
    description: 'Mini-checkup tilstand og visningshistorik',
    countKeys: ['mini_checkup_user_state'] as (keyof ResetCounts)[],
    color: 'text-slate-600',
    bg: 'bg-slate-50',
  },
  {
    key: 'household' as keyof ResetSections,
    icon: Home,
    label: 'Husstand',
    description: 'Husstandsdata og brugerens precisionsforpligtelse',
    countKeys: ['household', 'user_precision_commitment'] as (keyof ResetCounts)[],
    color: 'text-stone-600',
    bg: 'bg-stone-50',
  },
];

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

function sumCounts(counts: ResetCounts | null, keys: (keyof ResetCounts)[]): number {
  if (!counts) return 0;
  return keys.reduce((sum, k) => sum + (counts[k] ?? 0), 0);
}

function CountBadge({ n }: { n: number }) {
  if (n === 0) return <span className="text-xs text-muted-foreground">0 records</span>;
  return (
    <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
      {n.toLocaleString('da-DK')} records
    </span>
  );
}

export default function DataResetWizard({ users }: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [sections, setSections] = useState<ResetSections>({
    transactions: false,
    budgetPlans: false,
    budgets: false,
    nuvioFlow: false,
    savingsGoals: false,
    investmentSettings: false,
    checkupHistory: false,
    household: false,
  });
  const [previewCounts, setPreviewCounts] = useState<ResetCounts | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState(false);

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const anySectionSelected = Object.values(sections).some(Boolean);
  const totalRecords = previewCounts
    ? SECTION_CONFIG.filter((s) => sections[s.key]).reduce((sum, s) => sum + sumCounts(previewCounts, s.countKeys), 0)
    : 0;

  useEffect(() => {
    setPreviewCounts(null);
    setDone(false);
  }, [selectedUserId, sections]);

  async function handlePreview() {
    if (!selectedUserId || !anySectionSelected) return;
    setPreviewing(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ targetUserId: selectedUserId, sections, dryRun: true }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setPreviewCounts(json.counts);
    } catch (err: any) {
      toast.error(err.message ?? 'Kunne ikke hente forhåndsvisning');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleReset() {
    setConfirmOpen(false);
    setResetting(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ targetUserId: selectedUserId, sections, dryRun: false }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setDone(true);
      setPreviewCounts(null);
      setSections({
        transactions: false,
        budgetPlans: false,
        budgets: false,
        nuvioFlow: false,
        savingsGoals: false,
        investmentSettings: false,
        checkupHistory: false,
        household: false,
      });
      toast.success('Data nulstillet');
    } catch (err: any) {
      toast.error(err.message ?? 'Nulstilling fejlede');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Vælg bruger
          </CardTitle>
          <CardDescription>
            Vælg den bruger, hvis data skal nulstilles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUserId(user.id === selectedUserId ? '' : user.id)}
                className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                  selectedUserId === user.id
                    ? 'bg-emerald-50 border-emerald-200 shadow-sm'
                    : 'bg-secondary/30 border-border/40 hover:bg-secondary/60'
                }`}
              >
                <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold uppercase ${
                  selectedUserId === user.id ? 'bg-emerald-600 text-white' : 'bg-primary/10 text-primary'
                }`}>
                  {user.email?.[0] ?? '?'}
                </div>
                <span className="text-sm font-medium truncate">{user.email}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedUserId && (
        <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Vælg hvad der skal nulstilles
            </CardTitle>
            <CardDescription>
              Data for <strong>{selectedUser?.email}</strong>. Handlingen kan ikke fortrydes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {SECTION_CONFIG.map((section) => {
              const Icon = section.icon;
              const count = sumCounts(previewCounts, section.countKeys);
              return (
                <div
                  key={section.key}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                    sections[section.key]
                      ? 'bg-red-50/60 border-red-100'
                      : 'bg-secondary/30 border-border/40'
                  }`}
                >
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${section.bg}`}>
                    <Icon className={`h-4 w-4 ${section.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{section.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{section.description}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {previewCounts && <CountBadge n={count} />}
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
          </CardContent>
        </Card>
      )}

      {selectedUserId && anySectionSelected && (
        <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                {previewCounts ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <p className="text-sm">
                      Forhåndsvisning klar —{' '}
                      <span className="font-semibold text-red-600">
                        {totalRecords.toLocaleString('da-DK')} records
                      </span>{' '}
                      vil blive slettet
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Klik &quot;Forhåndsvis&quot; for at se præcis hvor mange records der berøres, inden du nulstiller.
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={handlePreview}
                  disabled={previewing}
                >
                  {previewing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4 mr-2" />
                  )}
                  Forhåndsvis
                </Button>
                <Button
                  variant="destructive"
                  className="rounded-xl"
                  onClick={() => setConfirmOpen(true)}
                  disabled={resetting || !previewCounts}
                >
                  {resetting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  Nulstil data
                </Button>
              </div>
            </div>

            {previewCounts && (
              <div className="mt-4 pt-4 border-t border-border/40">
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Detaljeret oversigt
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {SECTION_CONFIG.filter((s) => sections[s.key]).map((section) =>
                    section.countKeys.map((key) => {
                      const n = previewCounts[key] ?? 0;
                      return (
                        <div key={key} className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/40 border border-border/40">
                          <span className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className={`text-xs font-bold ${n > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {n}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {done && (
        <Card className="shadow-xl border-0 rounded-3xl overflow-hidden border-emerald-100 bg-emerald-50/40">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-medium text-emerald-800">
                Data for {selectedUser?.email} er nulstillet.
              </p>
            </div>
          </CardContent>
        </Card>
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
                <strong>{totalRecords.toLocaleString('da-DK')} records</strong> for{' '}
                <strong>{selectedUser?.email}</strong>.
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
              Ja, nulstil data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
