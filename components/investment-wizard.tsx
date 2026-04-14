'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TrendingUp, Shield, Clock, ChartBar as BarChart2, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Circle as XCircle, ArrowRight, Info, Check } from 'lucide-react';
import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  pickScenario,
  computeGoalProjection,
  SCENARIOS,
  type ScenarioKey,
  type TimeHorizon,
  type MarketReaction,
} from '@/lib/investment-engine';

type InvestingStatus = 'yes_monthly' | 'yes_occasionally' | 'considering' | 'no';

interface WizardState {
  investingStatus: InvestingStatus | null;
  hasBuffer: boolean;
  noHighDebt: boolean;
  canAfford: boolean;
  monthlyAmount: string;
  currentAmount: string;
  timeHorizon: TimeHorizon | null;
  marketReaction: MarketReaction | null;
}

type StatusLevel = 'ready' | 'ready_with_caution' | 'wait';

interface StatusResult {
  level: StatusLevel;
  label: string;
  explanation: string;
}

function computeStatus(state: WizardState): StatusResult {
  const foundationScore = [state.hasBuffer, state.noHighDebt, state.canAfford].filter(Boolean).length;
  const isInvesting = state.investingStatus === 'yes_monthly' || state.investingStatus === 'yes_occasionally';
  const isConsidering = state.investingStatus === 'considering';
  const hasLongHorizon = state.timeHorizon === 'long';
  const hasShortHorizon = state.timeHorizon === 'short';
  const isRational = state.marketReaction === 'wait' || state.marketReaction === 'invest_more';

  if (foundationScore < 2) {
    return {
      level: 'wait',
      label: 'Vent',
      explanation: 'Fundamentet er ikke helt på plads endnu. Fokuser på at opbygge en buffer og få styr på eventuel dyr gæld, inden du begynder at investere.',
    };
  }
  if (hasShortHorizon) {
    return {
      level: 'wait',
      label: 'Vent',
      explanation: 'En kort tidshorisont på under 3 år gør investering i aktier risikabelt. Pengene kan have lav værdi præcis når du har brug for dem.',
    };
  }
  if (foundationScore === 3 && isRational && hasLongHorizon && (isInvesting || isConsidering)) {
    return {
      level: 'ready',
      label: 'Klar',
      explanation: isInvesting
        ? 'Du har et stærkt fundament, en god tidshorisont og en sund tilgang til markedsudsving. Fortsæt den gode kurs.'
        : 'Forudsætningerne er på plads. Du er godt positioneret til at begynde at investere regelmæssigt.',
    };
  }
  return {
    level: 'ready_with_caution',
    label: 'Klar med forbehold',
    explanation: 'Du er på rette vej, men der er et par ting at være opmærksom på. Gennemgå dine svar og overvej, hvad der kan styrkes, inden du øger din investering.',
  };
}

function formatMonths(months: number): string {
  if (months === 0) return 'Nået!';
  if (months < 12) return `${months} mdr.`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} år`;
  return `${years} år ${rem} mdr.`;
}

function formatKr(v: number): string {
  return v.toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr.';
}

interface PrimaryGoal {
  target_amount: number;
  current_amount: number;
  monthly_contribution: number | null;
  name: string;
}

const STEP_CONFIGS = [
  { label: 'Din status', gradient: 'from-emerald-50/80 via-teal-50/30 to-white' },
  { label: 'Fundament', gradient: 'from-teal-50/60 via-emerald-50/20 to-white' },
  { label: 'Beløb', gradient: 'from-emerald-50/70 via-white to-teal-50/30' },
  { label: 'Tidshorisont', gradient: 'from-teal-50/50 via-emerald-50/30 to-white' },
  { label: 'Risikoprofil', gradient: 'from-emerald-50/60 via-teal-50/20 to-white' },
  { label: 'Din investeringsprofil', gradient: 'from-teal-50/40 via-emerald-50/20 to-white' },
];

const TOTAL_STEPS = 6;

function OptionCard({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border-2 px-5 py-4 text-sm transition-all duration-200 active:scale-[0.99] ${
        selected
          ? 'border-emerald-500 bg-emerald-50/60'
          : 'border-foreground/12 bg-white/50 hover:border-foreground/25 hover:bg-white/70'
      }`}
    >
      {children}
    </button>
  );
}

function CheckboxRow({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-full text-left rounded-2xl border-2 px-5 py-4 transition-all duration-200 flex items-start gap-3 active:scale-[0.99] ${
        checked
          ? 'border-emerald-500 bg-emerald-50/60'
          : 'border-foreground/12 bg-white/50 hover:border-foreground/25 hover:bg-white/70'
      }`}
    >
      <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
        checked ? 'border-emerald-500 bg-emerald-500' : 'border-foreground/25'
      }`}>
        {checked && <Check className="h-3 w-3 text-white stroke-[3]" />}
      </div>
      <div>
        <p className="text-sm font-medium leading-tight text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
    </button>
  );
}

export function InvestmentWizard({ onComplete }: { onComplete?: () => void } = {}) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal | null>(null);
  const { animating, direction, animate } = useWizardAnimation();
  const [visible, setVisible] = useState(false);

  const [state, setState] = useState<WizardState>({
    investingStatus: null,
    hasBuffer: false,
    noHighDebt: false,
    canAfford: false,
    monthlyAmount: '',
    currentAmount: '',
    timeHorizon: null,
    marketReaction: null,
  });

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    loadExistingSettings();
    loadPrimaryGoal();
  }, [user]);

  async function loadExistingSettings() {
    if (!user) return;
    const { data } = await supabase
      .from('investment_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!data) return;
    setState({
      investingStatus: data.investing_status as InvestingStatus,
      hasBuffer: data.has_buffer,
      noHighDebt: data.no_high_debt,
      canAfford: data.can_afford,
      monthlyAmount: data.monthly_amount ? String(data.monthly_amount) : '',
      currentAmount: data.current_amount ? String(data.current_amount) : '',
      timeHorizon: data.time_horizon as TimeHorizon,
      marketReaction: data.market_reaction as MarketReaction,
    });
    setSaved(true);
  }

  async function loadPrimaryGoal() {
    const { data } = await supabase
      .from('savings_goals')
      .select('name, target_amount, current_amount, monthly_contribution')
      .eq('completed', false)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) setPrimaryGoal(data);
  }

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  const scenarioKey: ScenarioKey | null = useMemo(() => {
    if (!state.timeHorizon) return null;
    return pickScenario(state.timeHorizon, state.marketReaction);
  }, [state.timeHorizon, state.marketReaction]);

  const scenario = scenarioKey ? SCENARIOS[scenarioKey] : null;
  const monthlyInvest = parseFloat(state.monthlyAmount) || 0;
  const startInvest = parseFloat(state.currentAmount) || 0;

  const projection = useMemo(() => {
    if (!primaryGoal || !scenarioKey || (!monthlyInvest && !startInvest)) return null;
    return computeGoalProjection(
      primaryGoal.target_amount,
      primaryGoal.current_amount,
      primaryGoal.monthly_contribution,
      monthlyInvest,
      startInvest,
      scenarioKey,
    );
  }, [primaryGoal, scenarioKey, monthlyInvest, startInvest]);

  const status = step === TOTAL_STEPS - 1 ? computeStatus(state) : null;

  function canAdvance(): boolean {
    switch (step) {
      case 0: return state.investingStatus !== null;
      case 1: return true;
      case 2: return true;
      case 3: return state.timeHorizon !== null;
      case 4: return state.marketReaction !== null;
      default: return true;
    }
  }

  function next() {
    if (step < TOTAL_STEPS - 1) animate('forward', () => setStep(step + 1));
  }

  function back() {
    if (step > 0) animate('back', () => setStep(step - 1));
  }

  async function handleSave() {
    if (!user || !scenarioKey) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('investment_settings')
        .upsert({
          user_id: user.id,
          investing_status: state.investingStatus,
          has_buffer: state.hasBuffer,
          no_high_debt: state.noHighDebt,
          can_afford: state.canAfford,
          monthly_amount: monthlyInvest,
          current_amount: startInvest,
          time_horizon: state.timeHorizon,
          market_reaction: state.marketReaction,
          scenario: scenarioKey,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (error) throw error;
      setSaved(true);
      toast.success('Investeringsindstillinger gemt');
      onComplete?.();
    } catch {
      toast.error('Kunne ikke gemme indstillinger');
    } finally {
      setSaving(false);
    }
  }

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

  const cfg = STEP_CONFIGS[Math.min(step, STEP_CONFIGS.length - 1)];

  const statusIcons = {
    ready: <CheckCircle2 className="h-8 w-8 text-emerald-600" />,
    ready_with_caution: <AlertCircle className="h-8 w-8 text-amber-500" />,
    wait: <XCircle className="h-8 w-8 text-rose-400" />,
  };

  const statusBadge = {
    ready: 'bg-emerald-50/80 text-emerald-700 border-emerald-200',
    ready_with_caution: 'bg-amber-50/80 text-amber-700 border-amber-200',
    wait: 'bg-rose-50/80 text-rose-600 border-rose-200',
  };

  return (
    <WizardShell
      gradient={'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 40%, #ffffff 100%)'}
      visible={visible}
      step={step}
      totalSteps={TOTAL_STEPS}
      showBack={step > 0}
      showClose={false}
      onBack={back}
      onClose={() => {}}
      animating={animating}
      direction={direction}
    >

            <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70 mb-4">
              {cfg.label}
            </p>

            {/* Step 0 — Status */}
            {step === 0 && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                  Investerer du allerede?
                </h2>
                <p className="text-foreground/65 text-lg leading-relaxed">
                  Fortæl os, hvor du er i dag.
                </p>
                <div className="space-y-3 pt-2">
                  <OptionCard selected={state.investingStatus === 'yes_monthly'} onClick={() => update('investingStatus', 'yes_monthly')}>
                    <span className="font-semibold text-foreground">Ja, fast hver måned</span>
                    <p className="text-xs text-muted-foreground mt-0.5 font-normal">Jeg investerer regelmæssigt via månedsopsparing</p>
                  </OptionCard>
                  <OptionCard selected={state.investingStatus === 'yes_occasionally'} onClick={() => update('investingStatus', 'yes_occasionally')}>
                    <span className="font-semibold text-foreground">Ja, af og til</span>
                    <p className="text-xs text-muted-foreground mt-0.5 font-normal">Jeg investerer når jeg har mulighed for det</p>
                  </OptionCard>
                  <OptionCard selected={state.investingStatus === 'considering'} onClick={() => update('investingStatus', 'considering')}>
                    <span className="font-semibold text-foreground">Nej, men jeg overvejer det</span>
                    <p className="text-xs text-muted-foreground mt-0.5 font-normal">Jeg er interesseret men ikke kommet i gang endnu</p>
                  </OptionCard>
                  <OptionCard selected={state.investingStatus === 'no'} onClick={() => update('investingStatus', 'no')}>
                    <span className="font-semibold text-foreground">Nej, ikke nu</span>
                    <p className="text-xs text-muted-foreground mt-0.5 font-normal">Det er ikke relevant for mig på nuværende tidspunkt</p>
                  </OptionCard>
                </div>
              </div>
            )}

            {/* Step 1 — Foundation */}
            {step === 1 && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="h-5 w-5 text-emerald-600" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                  Er fundamentet på plads?
                </h2>
                <p className="text-foreground/65 text-lg leading-relaxed">
                  Markér det der passer — vælg alle der gælder.
                </p>
                <div className="space-y-3 pt-2">
                  <CheckboxRow
                    label="Jeg har en buffer"
                    description="Mindst 3 måneders faste udgifter sat til side"
                    checked={state.hasBuffer}
                    onChange={v => update('hasBuffer', v)}
                  />
                  <CheckboxRow
                    label="Jeg har ingen dyr gæld"
                    description="Ingen forbrugslån, kreditkortgæld eller afbetalinger med høj rente"
                    checked={state.noHighDebt}
                    onChange={v => update('noHighDebt', v)}
                  />
                  <CheckboxRow
                    label="Jeg kan investere uden at det påvirker min økonomi"
                    description="Investeringen påvirker ikke min daglige økonomi negativt"
                    checked={state.canAfford}
                    onChange={v => update('canAfford', v)}
                  />
                </div>
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-emerald-200 pl-4">
                    Du kan fortsætte uden at markere noget — vi tager det med i vurderingen.
                  </p>
                </div>
              </div>
            )}

            {/* Step 2 — Amounts */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <BarChart2 className="h-5 w-5 text-emerald-600" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                  Hvor meget investerer du?
                </h2>
                <p className="text-foreground/65 text-lg leading-relaxed">
                  Angiv hvad du ønsker — det er helt valgfrit.
                </p>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-medium mb-2 block text-foreground/80">Månedligt beløb</label>
                    <div className="relative">
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="f.eks. 500"
                        value={state.monthlyAmount}
                        onChange={e => update('monthlyAmount', e.target.value)}
                        className="pr-12 rounded-xl h-14 bg-white/60 border-white/40 text-base"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kr.</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block text-foreground/80">
                      Allerede investeret
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">(valgfrit)</span>
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="f.eks. 25.000"
                        value={state.currentAmount}
                        onChange={e => update('currentAmount', e.target.value)}
                        className="pr-12 rounded-xl h-14 bg-white/60 border-white/40 text-base"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kr.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 — Time horizon */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="h-5 w-5 text-emerald-600" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                  Hvad er din tidshorisont?
                </h2>
                <p className="text-foreground/65 text-lg leading-relaxed">
                  Hvornår forventer du at bruge pengene?
                </p>
                <div className="space-y-3 pt-2">
                  <OptionCard selected={state.timeHorizon === 'short'} onClick={() => update('timeHorizon', 'short')}>
                    <span className="font-semibold text-foreground">Under 3 år</span>
                    <p className="text-xs text-muted-foreground mt-0.5 font-normal">Pengene skal bruges relativt snart</p>
                  </OptionCard>
                  <OptionCard selected={state.timeHorizon === 'medium'} onClick={() => update('timeHorizon', 'medium')}>
                    <span className="font-semibold text-foreground">3–7 år</span>
                    <p className="text-xs text-muted-foreground mt-0.5 font-normal">Mellemlang horisont — f.eks. boligkøb eller større projekt</p>
                  </OptionCard>
                  <OptionCard selected={state.timeHorizon === 'long'} onClick={() => update('timeHorizon', 'long')}>
                    <span className="font-semibold text-foreground">7+ år</span>
                    <p className="text-xs text-muted-foreground mt-0.5 font-normal">Langsigtet opsparing — f.eks. pension eller frihed</p>
                  </OptionCard>
                </div>
              </div>
            )}

            {/* Step 4 — Market reaction */}
            {step === 4 && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                  Hvad gør du hvis markedet falder 20%?
                </h2>
                <p className="text-foreground/65 text-lg leading-relaxed">
                  Vær ærlig — der er intet forkert svar.
                </p>
                <div className="space-y-3 pt-2">
                  <OptionCard selected={state.marketReaction === 'sell'} onClick={() => update('marketReaction', 'sell')}>
                    <span className="font-semibold text-foreground">Jeg sælger for at undgå større tab</span>
                    <p className="text-xs text-muted-foreground mt-0.5 font-normal">Jeg foretrækker at komme ud og vente til det bedrer sig</p>
                  </OptionCard>
                  <OptionCard selected={state.marketReaction === 'wait'} onClick={() => update('marketReaction', 'wait')}>
                    <span className="font-semibold text-foreground">Jeg venter og gør ingenting</span>
                    <p className="text-xs text-muted-foreground mt-0.5 font-normal">Markedet nok kommer sig — jeg holder fast i min plan</p>
                  </OptionCard>
                  <OptionCard selected={state.marketReaction === 'invest_more'} onClick={() => update('marketReaction', 'invest_more')}>
                    <span className="font-semibold text-foreground">Jeg investerer mere</span>
                    <p className="text-xs text-muted-foreground mt-0.5 font-normal">Et fald er en mulighed — jeg køber mere til lavere kurs</p>
                  </OptionCard>
                </div>
              </div>
            )}

            {/* Step 5 — Results */}
            {step === TOTAL_STEPS - 1 && status && (
              <div className="space-y-5">
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                  Din investeringsprofil.
                </h2>

                <div className="bg-white/70 backdrop-blur border border-white/40 rounded-2xl px-5 py-5 shadow-sm space-y-3">
                  <div className="flex items-start gap-4">
                    {statusIcons[status.level]}
                    <div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusBadge[status.level]}`}>
                        {status.label}
                      </span>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-2">{status.explanation}</p>
                    </div>
                  </div>
                </div>

                {projection && primaryGoal && (monthlyInvest > 0 || startInvest > 0) && (
                  <div className="bg-white/60 backdrop-blur border border-white/40 rounded-2xl px-5 py-4 space-y-3">
                    <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
                      Indvirkning på din opsparing
                    </p>
                    <p className="text-xs text-muted-foreground font-medium">{primaryGoal.name}</p>

                    {projection.deltaMonths !== null && projection.deltaMonths > 0 ? (
                      <p className="text-base font-bold text-emerald-700">
                        Du når din opsparing {formatMonths(projection.deltaMonths)} tidligere
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground leading-snug">
                        Investering ændrer ikke din tidshorisont i dette scenarie — justér beløb eller opsparing.
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {projection.monthsWithoutInvesting !== null && (
                        <div className="rounded-xl bg-foreground/5 p-3">
                          <p className="text-xs text-muted-foreground mb-0.5">Uden investering</p>
                          <p className="text-sm font-bold">{formatMonths(projection.monthsWithoutInvesting)}</p>
                        </div>
                      )}
                      {projection.monthsWithInvesting !== null && (
                        <div className="rounded-xl bg-emerald-50/80 p-3">
                          <p className="text-xs text-muted-foreground mb-0.5">Med investering</p>
                          <p className="text-sm font-bold text-emerald-700">{formatMonths(projection.monthsWithInvesting)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-white/40 backdrop-blur border border-white/30 rounded-2xl px-5 py-4 space-y-3">
                  <p className="text-label font-semibold uppercase tracking-widest text-foreground/40">Dine indstillinger</p>
                  {state.investingStatus && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <span className="font-medium text-foreground">{{
                        yes_monthly: 'Ja, fast hver måned',
                        yes_occasionally: 'Ja, af og til',
                        considering: 'Overvejer det',
                        no: 'Nej, ikke nu',
                      }[state.investingStatus]}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Fundament</span>
                    <span className="font-medium text-foreground">{[state.hasBuffer, state.noHighDebt, state.canAfford].filter(Boolean).length} af 3 på plads</span>
                  </div>
                  {monthlyInvest > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Investering</span>
                      <span className="font-medium text-foreground">{formatKr(monthlyInvest)}/md.</span>
                    </div>
                  )}
                  {startInvest > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Startbeløb</span>
                      <span className="font-medium text-foreground">{formatKr(startInvest)}</span>
                    </div>
                  )}
                  {state.timeHorizon && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tidshorisont</span>
                      <span className="font-medium text-foreground">{{ short: 'Under 3 år', medium: '3–7 år', long: '7+ år' }[state.timeHorizon]}</span>
                    </div>
                  )}
                  {state.marketReaction && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Ved markedsfald</span>
                      <span className="font-medium text-foreground">{{ sell: 'Sælger', wait: 'Venter', invest_more: 'Investerer mere' }[state.marketReaction]}</span>
                    </div>
                  )}
                  {scenario && (
                    <div className="flex items-center justify-between text-sm pt-1 border-t border-foreground/8">
                      <span className="text-muted-foreground">Scenarie</span>
                      <span className="font-medium text-foreground">{scenario.label} ({(scenario.annualRate * 100).toFixed(0)}% årligt)</span>
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-2.5 bg-white/40 border border-white/30 rounded-xl px-4 py-3">
                  <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-snug">
                    Estimat. Afkast kan variere, og investering kan både stige og falde. Dette er ikke finansiel rådgivning.
                  </p>
                </div>
              </div>
            )}

          {/* Bottom CTA */}
          <div className="pt-6">
            {step < TOTAL_STEPS - 1 && (
              <Button
                size="lg"
                className="w-full h-14 rounded-2xl font-semibold text-base shadow-sm active:scale-[0.98] transition-transform"
                disabled={!canAdvance()}
                onClick={next}
              >
                {step === TOTAL_STEPS - 2 ? 'Se resultat' : 'Fortsæt'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}

            {step === TOTAL_STEPS - 1 && (
              <Button
                size="lg"
                className="w-full h-14 rounded-2xl font-semibold text-base bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-200 active:scale-[0.98] transition-transform"
                onClick={handleSave}
                disabled={saving || saved}
              >
                {saving ? 'Gemmer...' : saved ? 'Gemt i din plan' : 'Tilføj til min plan'}
                {!saving && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            )}
          </div>
    </WizardShell>
  );
}
