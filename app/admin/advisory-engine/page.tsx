'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_ADVISORY_CONFIG, type AdvisoryEngineConfig } from '@/lib/advisory-engine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Save, RotateCcw, Zap, BarChart3, Tag, ChevronRight, Info,
  TrendingDown, Target, Shield,
} from 'lucide-react';

interface NumberFieldProps {
  label: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  step?: number;
  onChange: (v: number) => void;
}

function NumberField({ label, description, value, min = 0, max = 9999, unit, step = 1, onChange }: NumberFieldProps) {
  return (
    <div className="flex items-center justify-between py-3.5 gap-4">
      <div className="flex-1 min-w-0">
        <Label className="text-sm font-medium">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 h-8 text-center font-mono text-sm"
        />
        {unit && <span className="text-xs text-muted-foreground w-8">{unit}</span>}
      </div>
    </div>
  );
}

function PctField({ label, description, value, onChange }: { label: string; description?: string; value: number; onChange: (v: number) => void }) {
  return (
    <NumberField
      label={label}
      description={description}
      value={Math.round(value * 100)}
      min={0}
      max={100}
      unit="%"
      step={1}
      onChange={(v) => onChange(v / 100)}
    />
  );
}

interface ToggleFieldProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function ToggleField({ label, description, value, onChange }: ToggleFieldProps) {
  return (
    <div className="flex items-center justify-between py-3.5 gap-4">
      <div className="flex-1 min-w-0">
        <Label className="text-sm font-medium">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function KeywordsField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [raw, setRaw] = useState(value.join(', '));

  function handleBlur() {
    const parsed = raw
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    onChange(parsed);
    setRaw(parsed.join(', '));
  }

  return (
    <div className="py-3.5 space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <Input
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={handleBlur}
        className="font-mono text-xs h-8"
        placeholder="ord1, ord2, ord3"
      />
      <p className="text-xs text-muted-foreground/60">{value.length} nøgleord</p>
    </div>
  );
}

function BenchmarkBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-sky-400 rounded-full" style={{ width: `${Math.min(pct / 30 * 100, 100)}%` }} />
      </div>
      <span className="text-xs font-mono font-medium w-8 text-right">{pct}%</span>
    </div>
  );
}

type DbRow = AdvisoryEngineConfig & { id?: string };

export default function AdvisoryEngineAdminPage() {
  const [cfg, setCfg] = useState<DbRow>({ ...DEFAULT_ADVISORY_CONFIG });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('advisory_engine_settings')
          .select('*')
          .limit(1)
          .maybeSingle();
        if (data) {
          setCfg({
            ...data,
            keywords_housing:   Array.isArray(data.keywords_housing)   ? data.keywords_housing   : DEFAULT_ADVISORY_CONFIG.keywords_housing,
            keywords_food:      Array.isArray(data.keywords_food)      ? data.keywords_food      : DEFAULT_ADVISORY_CONFIG.keywords_food,
            keywords_transport: Array.isArray(data.keywords_transport) ? data.keywords_transport : DEFAULT_ADVISORY_CONFIG.keywords_transport,
            keywords_insurance: Array.isArray(data.keywords_insurance) ? data.keywords_insurance : DEFAULT_ADVISORY_CONFIG.keywords_insurance,
            keywords_telecom:   Array.isArray(data.keywords_telecom)   ? data.keywords_telecom   : DEFAULT_ADVISORY_CONFIG.keywords_telecom,
            keywords_leisure:   Array.isArray(data.keywords_leisure)   ? data.keywords_leisure   : DEFAULT_ADVISORY_CONFIG.keywords_leisure,
          });
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function update<K extends keyof DbRow>(key: K, value: DbRow[K]) {
    setCfg(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { id, ...rest } = cfg;
      const payload = { ...rest, updated_at: new Date().toISOString() };
      if (id) {
        const { error } = await supabase
          .from('advisory_engine_settings')
          .update(payload)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('advisory_engine_settings')
          .insert(payload);
        if (error) throw error;
      }
      toast.success('Advisory Engine indstillinger gemt');
    } catch {
      toast.error('Kunne ikke gemme indstillinger');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setCfg(prev => ({ ...DEFAULT_ADVISORY_CONFIG, id: prev.id }));
    toast.success('Nulstillet til standardværdier (ikke gemt endnu)');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-8 flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Indlæser...</div>
      </div>
    );
  }

  const benchmarkTotal = Math.round(
    (cfg.benchmark_housing + cfg.benchmark_food + cfg.benchmark_transport +
      cfg.benchmark_insurance + cfg.benchmark_telecom + cfg.benchmark_leisure + cfg.benchmark_other) * 100
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-4 md:px-8">
      <div className="max-w-3xl mx-auto">

        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Advisory Engine</h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Konfigurer trigger-logik, reduktionsmål og kategoribenchmarks
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleReset} className="rounded-xl">
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Nulstil
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="rounded-xl">
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {saving ? 'Gemmer...' : 'Gem ændringer'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="triggers">
          <TabsList className="rounded-2xl mb-6 h-10">
            <TabsTrigger value="triggers" className="rounded-xl gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Trigger logik
            </TabsTrigger>
            <TabsTrigger value="benchmarks" className="rounded-xl gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Benchmarks
            </TabsTrigger>
            <TabsTrigger value="keywords" className="rounded-xl gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Nøgleord
            </TabsTrigger>
          </TabsList>

          <TabsContent value="triggers" className="space-y-5">

            <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4" />
                  Betingelser for aktivering
                </CardTitle>
                <CardDescription>
                  Advisory Engine vises kun når mindst én betingelse er sand
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                <ToggleField
                  label="Høj udgiftsrate"
                  description="Aktivér når faste udgifter overstiger en tærskel"
                  value={cfg.trigger_high_expense_rate}
                  onChange={(v) => update('trigger_high_expense_rate', v)}
                />
                {cfg.trigger_high_expense_rate && (
                  <div className="pl-4 border-l-2 border-sky-200 ml-1">
                    <PctField
                      label="Tærskel – udgiftsrate"
                      description="Udgifter / indkomst skal overskride dette for at trigger aktiveres"
                      value={cfg.trigger_high_expense_rate_threshold}
                      onChange={(v) => update('trigger_high_expense_rate_threshold', v)}
                    />
                  </div>
                )}
                <ToggleField
                  label="Nul opsparing"
                  description="Aktivér hvis opsparingsraten er 0%"
                  value={cfg.trigger_zero_savings}
                  onChange={(v) => update('trigger_zero_savings', v)}
                />
                <ToggleField
                  label="Mål ikke på sporet"
                  description="Aktivér hvis det længste aktive mål overskrider en tidshorisont"
                  value={cfg.trigger_off_track_goal}
                  onChange={(v) => update('trigger_off_track_goal', v)}
                />
                {cfg.trigger_off_track_goal && (
                  <div className="pl-4 border-l-2 border-sky-200 ml-1">
                    <NumberField
                      label="Tærskel – måneder til mål"
                      description="Antal måneder det må tage at nå det længste mål"
                      value={cfg.trigger_off_track_goal_months}
                      min={1}
                      unit="mdr."
                      onChange={(v) => update('trigger_off_track_goal_months', v)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4" />
                  Reduktionsmål
                </CardTitle>
                <CardDescription>
                  Hvad motoren beregner reduktioner imod
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                <PctField
                  label="Udgiftsmål"
                  description="Motoren forsøger at bringe udgifter ned til denne andel af indkomsten"
                  value={cfg.expense_target_rate}
                  onChange={(v) => update('expense_target_rate', v)}
                />
                <PctField
                  label="Opsparingsmål"
                  description="Motoren forslår reduktioner der frigiver nok til denne opsparingsrate"
                  value={cfg.savings_target_rate}
                  onChange={(v) => update('savings_target_rate', v)}
                />
              </CardContent>
            </Card>

            <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4" />
                  Reduktionsloft per gruppe
                </CardTitle>
                <CardDescription>
                  Max % af en gruppes månedlige beløb der kan foreslås reduceret
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PctField
                  label="Maks. reduktion pr. gruppe"
                  description="Sikrer at forslagene er realistiske. Standard: 15%"
                  value={cfg.max_reduction_pct_per_group}
                  onChange={(v) => update('max_reduction_pct_per_group', v)}
                />
              </CardContent>
            </Card>

            <Card className="shadow-xl border-0 rounded-3xl overflow-hidden bg-secondary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Info className="h-3.5 w-3.5" />
                  Logik-oversigt
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                {cfg.trigger_high_expense_rate && (
                  <>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-rose-500" />
                      <span><strong className="text-foreground">Høj udgiftsrate:</strong> Aktiveres hvis udgifter &gt; {Math.round(cfg.trigger_high_expense_rate_threshold * 100)}% af indkomst</span>
                    </div>
                    <Separator />
                  </>
                )}
                {cfg.trigger_zero_savings && (
                  <>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                      <span><strong className="text-foreground">Nul opsparing:</strong> Aktiveres hvis opsparingsrate = 0%</span>
                    </div>
                    <Separator />
                  </>
                )}
                {cfg.trigger_off_track_goal && (
                  <>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-sky-500" />
                      <span><strong className="text-foreground">Mål ikke på sporet:</strong> Aktiveres hvis et mål tager mere end {cfg.trigger_off_track_goal_months} mdr.</span>
                    </div>
                    <Separator />
                  </>
                )}
                <div className="flex items-start gap-2">
                  <TrendingDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <span>Reduktioner beregnes for at nå udgiftsmål på {Math.round(cfg.expense_target_rate * 100)}% eller opsparingsmål på {Math.round(cfg.savings_target_rate * 100)}% — maks. {Math.round(cfg.max_reduction_pct_per_group * 100)}% pr. gruppe</span>
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="benchmarks" className="space-y-5">

            <Card className="shadow-xl border-0 rounded-3xl overflow-hidden bg-secondary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Benchmark oversigt
                </CardTitle>
                <CardDescription>
                  Samlet benchmark-andel: {benchmarkTotal}% af indkomst {benchmarkTotal !== 100 && <span className="text-amber-600">(bør være ~100%)</span>}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <BenchmarkBar label="Bolig" value={cfg.benchmark_housing} />
                <BenchmarkBar label="Mad" value={cfg.benchmark_food} />
                <BenchmarkBar label="Transport" value={cfg.benchmark_transport} />
                <BenchmarkBar label="Forsikring" value={cfg.benchmark_insurance} />
                <BenchmarkBar label="Telecom" value={cfg.benchmark_telecom} />
                <BenchmarkBar label="Fritid" value={cfg.benchmark_leisure} />
                <BenchmarkBar label="Andre" value={cfg.benchmark_other} />
              </CardContent>
            </Card>

            <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4" />
                  Kategoribenchmarks
                </CardTitle>
                <CardDescription>
                  Andel af indkomst der anses for normal pr. kategori. Udgifter over dette beregnes som afvigelse.
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                <PctField label="Bolig" description="Husleje, lån, andel m.m." value={cfg.benchmark_housing} onChange={(v) => update('benchmark_housing', v)} />
                <PctField label="Mad & dagligvarer" description="Supermarked, dagligvarer" value={cfg.benchmark_food} onChange={(v) => update('benchmark_food', v)} />
                <PctField label="Transport" description="Bil, benzin, tog, bus" value={cfg.benchmark_transport} onChange={(v) => update('benchmark_transport', v)} />
                <PctField label="Forsikring" description="Alle forsikringer" value={cfg.benchmark_insurance} onChange={(v) => update('benchmark_insurance', v)} />
                <PctField label="Telecom & streaming" description="Telefon, internet, TV, abonnementer" value={cfg.benchmark_telecom} onChange={(v) => update('benchmark_telecom', v)} />
                <PctField label="Fritid & oplevelser" description="Sport, restaurant, ferie, hobby" value={cfg.benchmark_leisure} onChange={(v) => update('benchmark_leisure', v)} />
                <PctField label="Andre udgifter" description="Kategorier der ikke matcher ovenstående" value={cfg.benchmark_other} onChange={(v) => update('benchmark_other', v)} />
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="keywords" className="space-y-5">

            <Card className="shadow-xl border-0 rounded-3xl overflow-hidden bg-secondary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Info className="h-3.5 w-3.5" />
                  Sådan bruges nøgleord
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1.5">
                <p>Motoren sammenligner kategorigruppernes navne med nøgleordene (lowercase). Det første match afgør hvilken benchmark-ratio der bruges.</p>
                <p>Rækkefølgen er: Bolig → Mad → Transport → Forsikring → Telecom → Fritid → Andre (fallback).</p>
                <p>Separer nøgleord med komma. Ændringer gemmes kun ved klik på &quot;Gem ændringer&quot;.</p>
              </CardContent>
            </Card>

            <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Tag className="h-4 w-4" />
                  Nøgleord pr. kategori
                </CardTitle>
                <CardDescription>
                  Kommaseparerede nøgleord der matcher gruppenavne i brugerens budget
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                <KeywordsField
                  label="Bolig"
                  description="Matcher gruppenavne med disse ord (f.eks. 'bolig', 'husleje')"
                  value={cfg.keywords_housing}
                  onChange={(v) => update('keywords_housing', v)}
                />
                <KeywordsField
                  label="Mad & dagligvarer"
                  value={cfg.keywords_food}
                  onChange={(v) => update('keywords_food', v)}
                />
                <KeywordsField
                  label="Transport"
                  value={cfg.keywords_transport}
                  onChange={(v) => update('keywords_transport', v)}
                />
                <KeywordsField
                  label="Forsikring"
                  value={cfg.keywords_insurance}
                  onChange={(v) => update('keywords_insurance', v)}
                />
                <KeywordsField
                  label="Telecom & streaming"
                  value={cfg.keywords_telecom}
                  onChange={(v) => update('keywords_telecom', v)}
                />
                <KeywordsField
                  label="Fritid & oplevelser"
                  value={cfg.keywords_leisure}
                  onChange={(v) => update('keywords_leisure', v)}
                />
              </CardContent>
            </Card>

          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
