'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_TRIGGER_SETTINGS, type CheckupTriggerSettings } from '@/lib/checkup-trigger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Save, Bell, Users, RotateCcw, Clock, Shield, ChevronRight, Layers, FlaskConical, Megaphone, LayoutList, Play, Trash2 } from 'lucide-react';

interface NumberFieldProps {
  label: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  onChange: (v: number) => void;
}

function NumberField({ label, description, value, min = 0, max = 9999, unit, onChange }: NumberFieldProps) {
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
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 h-8 text-center font-mono text-sm"
        />
        {unit && <span className="text-xs text-muted-foreground w-12">{unit}</span>}
      </div>
    </div>
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

function LevelBadge({ level, label, description }: { level: 'soft' | 'strong' | 'reactivate'; label: string; description: string }) {
  const colors = {
    soft: 'bg-blue-50 border-blue-200 text-blue-700',
    strong: 'bg-amber-50 border-amber-200 text-amber-700',
    reactivate: 'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${colors[level]}`}>
      <div className="text-xs font-semibold uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-xs opacity-80">{description}</div>
    </div>
  );
}

export default function MiniCheckupAdminPage() {
  const [settings, setSettings] = useState<CheckupTriggerSettings>(DEFAULT_TRIGGER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('mini_checkup_settings')
          .select('*')
          .limit(1)
          .maybeSingle();
        if (data) setSettings(data);
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function update<K extends keyof CheckupTriggerSettings>(key: K, value: CheckupTriggerSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { id, updated_by, updated_at, ...rest } = settings;
      if (id) {
        const { error } = await supabase
          .from('mini_checkup_settings')
          .update({ ...rest, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('mini_checkup_settings')
          .insert({ ...rest });
        if (error) throw error;
      }
      toast.success('Indstillinger gemt');
    } catch {
      toast.error('Kunne ikke gemme indstillinger');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSettings(prev => ({ ...DEFAULT_TRIGGER_SETTINGS, id: prev.id }));
    toast.success('Nulstillet til standardværdier (ikke gemt endnu)');
  }

  function fireTest(variant: 'modal' | 'banner' | 'wizard') {
    window.dispatchEvent(new CustomEvent('nuvio:force-checkup', { detail: { variant } }));
    toast.success(`Test "${variant}" afsendt`);
  }

  async function handleResetUserState() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Ikke logget ind'); return; }
      await supabase
        .from('mini_checkup_user_state')
        .delete()
        .eq('user_id', user.id);
      toast.success('Brugerens checkup-tilstand nulstillet');
    } catch {
      toast.error('Kunne ikke nulstille tilstand');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-8 flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Indlæser...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-4 md:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Nuvio Checkup</h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Konfigurer hvornår og hvordan brugere opfordres til et Nuvio Checkup
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

        <div className="flex gap-3 mb-8 overflow-x-auto pb-1">
          <LevelBadge level="soft" label="Soft (30 dg)" description="Banner + badge" />
          <LevelBadge level="strong" label="Strong (60 dg)" description="Modal + banner" />
          <LevelBadge level="reactivate" label="Re-aktiv (90 dg)" description="Modal + persistent badge" />
        </div>

        <Card className="shadow-xl border-0 rounded-3xl overflow-hidden mb-6 bg-secondary/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="h-4 w-4" />
              Test Nuvio Checkup
            </CardTitle>
            <CardDescription>
              Vis de forskellige UI-tilstande med det samme — uanset trigger-regler og cooldowns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => fireTest('banner')}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-3 py-4 text-sm font-medium hover:bg-secondary/60 transition-colors"
              >
                <Megaphone className="h-5 w-5 text-blue-500" />
                Banner
              </button>
              <button
                onClick={() => fireTest('modal')}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-3 py-4 text-sm font-medium hover:bg-secondary/60 transition-colors"
              >
                <LayoutList className="h-5 w-5 text-amber-500" />
                Modal
              </button>
              <button
                onClick={() => fireTest('wizard')}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-3 py-4 text-sm font-medium hover:bg-secondary/60 transition-colors"
              >
                <Play className="h-5 w-5 text-emerald-500" />
                Wizard
              </button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Nulstil din checkup-tilstand</p>
                <p className="text-xs text-muted-foreground mt-0.5">Sletter cooldowns og snooze så trigger-reglerne kører frisk</p>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={handleResetUserState}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Nulstil
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="trigger">
          <TabsList className="rounded-2xl mb-6 h-10">
            <TabsTrigger value="trigger" className="rounded-xl gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              Trigger regler
            </TabsTrigger>
            <TabsTrigger value="behaviour" className="rounded-xl gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Adfærdsregler
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trigger" className="space-y-5">
            <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4" />
                  Tærskelværdier (dage siden sidst opdateret)
                </CardTitle>
                <CardDescription>
                  Antal dage der skal gå, før hvert niveau aktiveres
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                <NumberField
                  label="Soft tærskel"
                  description="Vis diskret banner + nav badge"
                  value={settings.soft_days}
                  min={1}
                  unit="dage"
                  onChange={(v) => update('soft_days', v)}
                />
                <NumberField
                  label="Strong tærskel"
                  description="Vis modal ved login + tydeligt banner"
                  value={settings.strong_days}
                  min={1}
                  unit="dage"
                  onChange={(v) => update('strong_days', v)}
                />
                <NumberField
                  label="Re-aktivering tærskel"
                  description="Vis modal + persistent badge + evt. email"
                  value={settings.reactivate_days}
                  min={1}
                  unit="dage"
                  onChange={(v) => update('reactivate_days', v)}
                />
              </CardContent>
            </Card>

            <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="h-4 w-4" />
                  Minimumsscore pr. niveau
                </CardTitle>
                <CardDescription>
                  Minimum completion score (0–100) for at et niveau aktiveres
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                <NumberField
                  label="Soft min. score"
                  value={settings.soft_min_completion}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) => update('soft_min_completion', v)}
                />
                <NumberField
                  label="Strong min. score"
                  value={settings.strong_min_completion}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) => update('strong_min_completion', v)}
                />
                <NumberField
                  label="Re-aktivering min. score"
                  value={settings.reactivate_min_completion}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) => update('reactivate_min_completion', v)}
                />
              </CardContent>
            </Card>

            <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4" />
                  Anti-spam cooldown
                </CardTitle>
                <CardDescription>
                  Minimumstid mellem visninger pr. bruger
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                <NumberField
                  label="Banner cooldown (soft)"
                  description="Min. dage mellem soft-bannere pr. bruger"
                  value={settings.banner_cooldown_soft_days}
                  min={1}
                  unit="dage"
                  onChange={(v) => update('banner_cooldown_soft_days', v)}
                />
                <NumberField
                  label="Banner cooldown (strong)"
                  description="Min. dage mellem strong-bannere pr. bruger"
                  value={settings.banner_cooldown_strong_days}
                  min={1}
                  unit="dage"
                  onChange={(v) => update('banner_cooldown_strong_days', v)}
                />
                <NumberField
                  label="Modal cooldown"
                  description="Min. timer mellem modaler pr. bruger"
                  value={settings.modal_cooldown_hours}
                  min={1}
                  unit="timer"
                  onChange={(v) => update('modal_cooldown_hours', v)}
                />
              </CardContent>
            </Card>

            <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="h-4 w-4" />
                  UI-kontroller
                </CardTitle>
                <CardDescription>
                  Slå modal, badge og snooze til/fra globalt
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                <ToggleField
                  label="Modal aktiveret"
                  description="Vis modal-popup ved strong og re-aktivering"
                  value={settings.modal_enabled}
                  onChange={(v) => update('modal_enabled', v)}
                />
                <ToggleField
                  label="Badge aktiveret"
                  description="Vis dot-badge på nav-ikonet"
                  value={settings.badge_enabled}
                  onChange={(v) => update('badge_enabled', v)}
                />
                <ToggleField
                  label="Snooze tilladt"
                  description="Lad brugere udskyde påmindelser"
                  value={settings.allow_snooze}
                  onChange={(v) => update('allow_snooze', v)}
                />
                <NumberField
                  label="Snooze (kort)"
                  description="Dage brugeren snoozertil"
                  value={settings.snooze_days}
                  min={1}
                  unit="dage"
                  onChange={(v) => update('snooze_days', v)}
                />
                <NumberField
                  label="Snooze (lang)"
                  description="'Skjul i X dage' – hård snooze"
                  value={settings.hard_snooze_days}
                  min={1}
                  unit="dage"
                  onChange={(v) => update('hard_snooze_days', v)}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="behaviour" className="space-y-5">
            <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  Brugeraktivitet gates
                </CardTitle>
                <CardDescription>
                  Undgå at trigge inaktive eller ufærdige brugere
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                <NumberField
                  label="Maks. dage siden sidst login"
                  description="Trigger ikke hvis brugeren har været inaktiv i mere end X dage"
                  value={settings.min_activity_days}
                  min={1}
                  unit="dage"
                  onChange={(v) => update('min_activity_days', v)}
                />
                <NumberField
                  label="Min. sessioner (soft)"
                  description="Minimum antal sessioner de seneste 30 dage for soft trigger"
                  value={settings.min_sessions_soft}
                  min={0}
                  unit="sessioner"
                  onChange={(v) => update('min_sessions_soft', v)}
                />
                <ToggleField
                  label="Spring over ved ufærdig onboarding"
                  description="Trigger ikke hvis onboarding ikke er gennemført"
                  value={settings.skip_if_onboarding_incomplete}
                  onChange={(v) => update('skip_if_onboarding_incomplete', v)}
                />
              </CardContent>
            </Card>

            <Card className="shadow-xl border-0 rounded-3xl overflow-hidden bg-secondary/30">
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Logik-oversigt</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                  <span><strong className="text-foreground">Soft ({settings.soft_days} dg):</strong> Banner + badge hvis score ≥ {settings.soft_min_completion}% og ≥ {settings.min_sessions_soft} sessioner/30 dg</span>
                </div>
                <Separator />
                <div className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                  <span><strong className="text-foreground">Strong ({settings.strong_days} dg):</strong> Modal + banner hvis score ≥ {settings.strong_min_completion}%</span>
                </div>
                <Separator />
                <div className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                  <span><strong className="text-foreground">Re-aktivering ({settings.reactivate_days} dg):</strong> Modal + persistent badge hvis score ≥ {settings.reactivate_min_completion}%</span>
                </div>
                <Separator />
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <span>Ingen trigger hvis: onboarding ufærdig, bruger inaktiv {settings.min_activity_days}+ dg, eller aktivt snooze</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
