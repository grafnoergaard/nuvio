'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/settings-context';
import { InvestmentWizard } from '@/components/investment-wizard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, CheckCircle2, AlertCircle, XCircle,
  Pencil, Clock, BarChart2, Trash2,
} from 'lucide-react';
import {
  projectInvestment, SCENARIOS,
  type ScenarioKey,
} from '@/lib/investment-engine';
import { EditableText } from '@/components/editable-text';

interface InvestmentSettings {
  investing_status: string;
  has_buffer: boolean;
  no_high_debt: boolean;
  can_afford: boolean;
  monthly_amount: number;
  current_amount: number;
  time_horizon: string;
  market_reaction: string;
  scenario: ScenarioKey;
}

const INVESTMENT_SETTINGS_CACHE_TTL = 60_000;
const investmentSettingsCache = new Map<string, { at: number; data: InvestmentSettings | null }>();

function getInvestmentSettingsCache(userId: string | undefined): InvestmentSettings | null | undefined {
  if (!userId) return undefined;
  const cached = investmentSettingsCache.get(userId);
  if (!cached) return undefined;
  if (Date.now() - cached.at > INVESTMENT_SETTINGS_CACHE_TTL) {
    investmentSettingsCache.delete(userId);
    return undefined;
  }
  return cached.data;
}

type StatusLevel = 'ready' | 'ready_with_caution' | 'wait';

const STATUS_CONFIG: Record<StatusLevel, { icon: React.ReactNode; label: string; badgeClass: string }> = {
  ready: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    label: 'Klar',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  },
  ready_with_caution: {
    icon: <AlertCircle className="h-5 w-5" />,
    label: 'Klar med forbehold',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  },
  wait: {
    icon: <XCircle className="h-5 w-5" />,
    label: 'Vent',
    badgeClass: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  },
};

const INVESTING_STATUS_LABELS: Record<string, string> = {
  yes_monthly: 'Ja, fast hver måned',
  yes_occasionally: 'Ja, af og til',
  considering: 'Nej, men overvejer det',
  no: 'Nej, ikke nu',
};

const TIME_HORIZON_LABELS: Record<string, string> = {
  short: 'Kort (under 3 år)',
  medium: 'Mellem (3–10 år)',
  long: 'Lang (over 10 år)',
};

const MARKET_REACTION_LABELS: Record<string, string> = {
  sell: 'Sælge og komme ud',
  wait: 'Vente og beholde',
  invest_more: 'Investere mere',
};

function deriveStatusLevel(s: InvestmentSettings): StatusLevel {
  const foundationScore = [s.has_buffer, s.no_high_debt, s.can_afford].filter(Boolean).length;
  const isInvesting = s.investing_status === 'yes_monthly' || s.investing_status === 'yes_occasionally';
  const isConsidering = s.investing_status === 'considering';
  const hasLongHorizon = s.time_horizon === 'long';
  const hasShortHorizon = s.time_horizon === 'short';
  const isRational = s.market_reaction === 'wait' || s.market_reaction === 'invest_more';
  if (foundationScore < 2 || hasShortHorizon) return 'wait';
  if (foundationScore === 3 && isRational && hasLongHorizon && (isInvesting || isConsidering)) return 'ready';
  return 'ready_with_caution';
}

function formatKr(v: number): string {
  return v.toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr.';
}

function FoundationDot({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`h-2 w-2 rounded-full shrink-0 transition-colors ${checked ? 'bg-emerald-500' : 'bg-border'}`} />
      <span className={checked ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  );
}

export default function InvesteringPage() {
  const { user } = useAuth();
  const { design } = useSettings();
  const [settings, setSettings] = useState<InvestmentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadSettings = useCallback(async ({ showLoader = true }: { showLoader?: boolean } = {}) => {
    if (!user) return;
    if (showLoader) setLoading(true);
    const { data } = await supabase
      .from('investment_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    investmentSettingsCache.set(user.id, { at: Date.now(), data: data ?? null });
    setSettings(data ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const cached = getInvestmentSettingsCache(user.id);
    if (cached !== undefined) {
      setSettings(cached);
      setLoading(false);
    }
    loadSettings({ showLoader: cached === undefined });
  }, [user, loadSettings]);

  async function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setDeleting(true);
    try {
      await supabase.from('investment_settings').delete().eq('user_id', user!.id);
      investmentSettingsCache.set(user!.id, { at: Date.now(), data: null });
      setSettings(null);
      setDeleteConfirm(false);
    } catch {
    } finally {
      setDeleting(false);
    }
  }

  const projections = useMemo(() => {
    if (!settings) return null;
    const scenario = SCENARIOS[settings.scenario];
    if (!scenario) return null;
    return {
      y5: projectInvestment(settings.monthly_amount, settings.current_amount, scenario.annualRate, 60),
      y10: projectInvestment(settings.monthly_amount, settings.current_amount, scenario.annualRate, 120),
      y20: projectInvestment(settings.monthly_amount, settings.current_amount, scenario.annualRate, 240),
    };
  }, [settings]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  if (!settings || showWizard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
        <InvestmentWizard onComplete={() => { setShowWizard(false); loadSettings(); }} />
      </div>
    );
  }

  const statusLevel = deriveStatusLevel(settings);
  const statusCfg = STATUS_CONFIG[statusLevel];
  const scenario = SCENARIOS[settings.scenario];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-8">
      <div className="max-w-4xl mx-auto">

        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
              <TrendingUp className="h-9 w-9 text-primary" />
              <EditableText textKey="investering.page.title" fallback="Investering" as="span" />
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              <EditableText textKey="investering.page.subtitle" fallback="Din investeringsprofil og fremtidsprojektioner" as="span" />
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowWizard(true)} className="shrink-0 rounded-xl gap-2">
            <Pencil className="h-4 w-4" />
            Rediger profil
          </Button>
        </div>

        <div className="grid gap-6">

          <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
            <div className="h-2" style={{ background: `linear-gradient(to right, ${design.gradientFrom}, ${design.gradientTo})` }} />
            <CardContent className="pt-6 pb-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 mb-3">Investeringsstatus</p>
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${statusCfg.badgeClass}`}>
                    {statusCfg.icon}
                    {statusCfg.label}
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    {INVESTING_STATUS_LABELS[settings.investing_status] ?? settings.investing_status}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1">Scenario</p>
                  <p className="text-lg font-bold">{scenario?.label ?? settings.scenario}</p>
                  <p className="text-sm text-muted-foreground">{scenario ? `${(scenario.annualRate * 100).toFixed(0)}% p.a.` : ''}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid sm:grid-cols-2 gap-6">

            <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
              <CardContent className="pt-6 pb-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 mb-4">Beløb</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Månedlig investering</p>
                    <p className="text-3xl font-bold" style={{ color: design.gradientFrom }}>
                      {formatKr(settings.monthly_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">pr. måned</p>
                  </div>
                  {settings.current_amount > 0 && (
                    <div className="pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">Eksisterende portefølje</p>
                      <p className="text-xl font-semibold">{formatKr(settings.current_amount)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
              <CardContent className="pt-6 pb-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 mb-3">Fundament</p>
                <p className="text-sm font-medium text-foreground leading-snug mb-4">
                  {[settings.has_buffer, settings.no_high_debt, settings.can_afford].filter(Boolean).length === 3
                    ? 'Dit fundament for investering er solidt.'
                    : [settings.has_buffer, settings.no_high_debt, settings.can_afford].filter(Boolean).length === 2
                    ? 'Din økonomiske base understøtter investering med enkelte forbehold.'
                    : 'Styrk dit fundament inden du øger investeringsomfanget.'}
                </p>
                <div className="space-y-3">
                  <FoundationDot checked={settings.has_buffer} label="Buffer opsparet" />
                  <FoundationDot checked={settings.no_high_debt} label="Ingen dyr gæld" />
                  <FoundationDot checked={settings.can_afford} label="Råd til investering" />
                  <div className="pt-3 border-t border-border/50 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{TIME_HORIZON_LABELS[settings.time_horizon] ?? settings.time_horizon}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <BarChart2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{MARKET_REACTION_LABELS[settings.market_reaction] ?? settings.market_reaction}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {projections && (settings.monthly_amount > 0 || settings.current_amount > 0) && (
            <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
              <CardContent className="pt-6 pb-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 mb-5">
                  Projektion – {scenario?.label} scenario ({scenario ? `${(scenario.annualRate * 100).toFixed(0)}% p.a.` : ''})
                </p>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Om 5 år', value: projections.y5 },
                    { label: 'Om 10 år', value: projections.y10 },
                    { label: 'Om 20 år', value: projections.y20 },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <p className="text-xl font-bold" style={{ color: design.gradientFrom }}>
                        {formatKr(Math.round(value / 1000) * 1000)}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground/60 mt-4 text-center">
                  Estimeret afkast baseret på historiske data. Faktisk afkast kan variere.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-2">
            {deleteConfirm && (
              <Button variant="outline" onClick={() => setDeleteConfirm(false)} disabled={deleting}>
                Annuller
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={deleting}
              className={deleteConfirm ? 'border-rose-300 text-rose-600 hover:bg-rose-50 hover:text-rose-700' : 'text-muted-foreground'}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleting ? 'Sletter...' : deleteConfirm ? 'Ja, slet investering' : 'Slet investering'}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
