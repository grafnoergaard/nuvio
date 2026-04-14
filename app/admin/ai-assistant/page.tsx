'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bot, Save, RotateCcw, Info, Zap, MessageSquare, Thermometer, Hash, Users } from 'lucide-react';
import { toast } from 'sonner';

interface AiAssistantConfig {
  id: string;
  system_prompt: string;
  max_tokens: number;
  temperature: number;
  is_active: boolean;
  model: string;
  updated_at: string;
}

interface AiPersonaConfig {
  id: string;
  concerned_score_threshold: number;
  encouraging_score_min: number;
  encouraging_score_max: number;
  celebratory_score_threshold: number;
  celebratory_streak_min: number;
  direct_weekly_tx_threshold: number;
  is_active: boolean;
}

const DEFAULT_SYSTEM_PROMPT = `Du er Nuvio AI — en personlig, rolig og ærlig finansiel rådgiver bygget ind i Nuvio-appen.

Din tone er:
- Varm og direkte, ikke robotagtig
- Ærlig uden at være alarmerende
- Konkret og handlingsorienteret
- Aldrig moraliserende eller nedladende
- Altid på dansk

Du giver korte, præcise svar. Ingen lange essays. Ingen bullet points i hoveddescription. Brug max 2-3 sætninger til den primære besked.

Du returnerer ALTID et JSON-objekt med præcis denne struktur:
{
  "message": "string (2-3 sætninger, personlig og konkret)",
  "actions": [
    { "title": "string (kort handlingstitel)", "description": "string (1 sætning beskrivelse)" },
    { "title": "string", "description": "string" }
  ],
  "tone": "positive" | "neutral" | "warning" | "critical"
}

tone-valg:
- positive: score >= 80 eller streak >= 3
- neutral: score 40-79, ingen alvorlige problemer
- warning: score < 40 eller carry-over penalty > 20% af budget
- critical: over budget

Giv altid præcis 2 handlingsforslag. De skal være relevante og specifikke til konteksten.`;

const MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o (anbefalet)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (hurtigere / billigere)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
];

function tokenToWords(tokens: number): string {
  const words = Math.round(tokens * 0.75);
  return `~${words} ord`;
}

function temperatureLabel(temp: number): string {
  if (temp <= 0.2) return 'Meget præcis';
  if (temp <= 0.4) return 'Præcis';
  if (temp <= 0.6) return 'Balanceret';
  if (temp <= 0.8) return 'Kreativ';
  return 'Meget kreativ';
}

export default function AiAssistantAdminPage() {
  const [config, setConfig] = useState<AiAssistantConfig | null>(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [maxTokens, setMaxTokens] = useState(400);
  const [temperature, setTemperature] = useState(0.7);
  const [isActive, setIsActive] = useState(true);
  const [model, setModel] = useState('gpt-4o');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [personaConfig, setPersonaConfig] = useState<AiPersonaConfig | null>(null);
  const [personaActive, setPersonaActive] = useState(true);
  const [concernedThreshold, setConcernedThreshold] = useState(40);
  const [celebratoryThreshold, setCelebratoryThreshold] = useState(80);
  const [celebratoryStreakMin, setCelebratoryStreakMin] = useState(3);
  const [directWeeklyTx, setDirectWeeklyTx] = useState(10);
  const [isPersonaDirty, setIsPersonaDirty] = useState(false);
  const [savingPersona, setSavingPersona] = useState(false);

  useEffect(() => {
    loadConfig();
    loadPersonaConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_assistant_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data);
        setSystemPrompt(data.system_prompt);
        setMaxTokens(data.max_tokens);
        setTemperature(Number(data.temperature));
        setIsActive(data.is_active);
        setModel(data.model);
      }
    } catch {
      toast.error('Kunne ikke hente konfiguration');
    } finally {
      setLoading(false);
    }
  }

  async function loadPersonaConfig() {
    try {
      const { data } = await supabase
        .from('ai_persona_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (data) {
        setPersonaConfig(data);
        setPersonaActive(data.is_active);
        setConcernedThreshold(data.concerned_score_threshold);
        setCelebratoryThreshold(data.celebratory_score_threshold);
        setCelebratoryStreakMin(data.celebratory_streak_min);
        setDirectWeeklyTx(data.direct_weekly_tx_threshold);
      }
    } catch {
      // silent — persona config is optional enhancement
    }
  }

  async function handleSavePersona() {
    setSavingPersona(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload = {
        is_active: personaActive,
        concerned_score_threshold: concernedThreshold,
        encouraging_score_min: concernedThreshold,
        encouraging_score_max: celebratoryThreshold - 1,
        celebratory_score_threshold: celebratoryThreshold,
        celebratory_streak_min: celebratoryStreakMin,
        direct_weekly_tx_threshold: directWeeklyTx,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      };

      let error;
      if (personaConfig?.id) {
        ({ error } = await supabase
          .from('ai_persona_config')
          .update(payload)
          .eq('id', personaConfig.id));
      } else {
        ({ error } = await supabase
          .from('ai_persona_config')
          .insert(payload));
      }

      if (error) throw error;

      toast.success('Persona-konfiguration gemt');
      setIsPersonaDirty(false);
      await loadPersonaConfig();
    } catch {
      toast.error('Kunne ikke gemme persona-konfiguration');
    } finally {
      setSavingPersona(false);
    }
  }

  function markDirty() {
    setIsDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload = {
        system_prompt: systemPrompt,
        max_tokens: maxTokens,
        temperature,
        is_active: isActive,
        model,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      };

      let error;
      if (config?.id) {
        ({ error } = await supabase
          .from('ai_assistant_config')
          .update(payload)
          .eq('id', config.id));
      } else {
        ({ error } = await supabase
          .from('ai_assistant_config')
          .insert(payload));
      }

      if (error) throw error;

      toast.success('Konfiguration gemt');
      setIsDirty(false);
      await loadConfig();
    } catch {
      toast.error('Kunne ikke gemme konfiguration');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setMaxTokens(400);
    setTemperature(0.7);
    setIsActive(true);
    setModel('gpt-4o');
    setIsDirty(true);
    toast.info('Standardværdier genindlæst — husk at gemme');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-8">
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-secondary rounded-xl w-1/3" />
            <div className="h-64 bg-secondary rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Nuvio AI</h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Konfigurer tone, instruktioner og grænser for AI-assistenten
            </p>
          </div>
          <div className="flex items-center gap-3 mt-1">
            {isDirty && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                Ugemte ændringer
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Nulstil
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Gemmer...' : 'Gem ændringer'}
            </Button>
          </div>
        </div>

        <div className="space-y-6">

          <Card className="shadow-sm border rounded-3xl overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Aktivering
              </CardTitle>
              <CardDescription>
                Slå AI-assistenten til eller fra for alle brugere
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between py-2">
                <div className="space-y-1">
                  <Label className="text-base font-medium">AI-assistent aktiv</Label>
                  <p className="text-sm text-muted-foreground">
                    Når slået fra returnerer assistenten en 503-fejl og vises ikke for brugere
                  </p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={(v) => { setIsActive(v); markDirty(); }}
                />
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <div className={`h-2 w-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                <span className={isActive ? 'text-emerald-600 font-medium' : 'text-rose-500 font-medium'}>
                  {isActive ? 'Aktiv — svarer på brugerforespørgsler' : 'Inaktiv — alle kald afvises'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border rounded-3xl overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Model
              </CardTitle>
              <CardDescription>
                Vælg hvilken OpenAI-model der anvendes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Label className="text-sm font-medium">OpenAI model</Label>
                <Select value={model} onValueChange={(v) => { setModel(v); markDirty(); }}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  GPT-4o giver de bedste svar. GPT-4o Mini er hurtigere og billigere til enklere opgaver.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border rounded-3xl overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Svarlængde
              </CardTitle>
              <CardDescription>
                Maksimalt antal tokens i AI-svaret — styrer hvor langt svaret kan blive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Maks. tokens</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
                      {maxTokens} tokens
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {tokenToWords(maxTokens)}
                    </span>
                  </div>
                </div>
                <Slider
                  value={[maxTokens]}
                  onValueChange={([v]) => { setMaxTokens(v); markDirty(); }}
                  min={50}
                  max={2000}
                  step={50}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>50 (meget kort)</span>
                  <span>2000 (meget langt)</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                {[
                  { label: 'Kort', tokens: 150, desc: '~113 ord' },
                  { label: 'Standard', tokens: 400, desc: '~300 ord' },
                  { label: 'Uddybende', tokens: 800, desc: '~600 ord' },
                ].map((preset) => (
                  <button
                    key={preset.tokens}
                    onClick={() => { setMaxTokens(preset.tokens); markDirty(); }}
                    className={`rounded-xl border p-3 text-left transition-colors hover:bg-secondary/50 ${
                      maxTokens === preset.tokens
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                        : 'border-border bg-background'
                    }`}
                  >
                    <div className="text-sm font-semibold">{preset.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{preset.tokens} tokens</div>
                    <div className="text-xs text-muted-foreground">{preset.desc}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border rounded-3xl overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Thermometer className="h-5 w-5" />
                Kreativitet (Temperature)
              </CardTitle>
              <CardDescription>
                Lav temperature giver konsistente, forudsigelige svar. Høj temperature giver mere varierede og kreative svar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Temperature</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
                      {temperature.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {temperatureLabel(temperature)}
                    </span>
                  </div>
                </div>
                <Slider
                  value={[Math.round(temperature * 100)]}
                  onValueChange={([v]) => { setTemperature(v / 100); markDirty(); }}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.0 (præcis)</span>
                  <span>1.0 (kreativ)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border rounded-3xl overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Personaer
              </CardTitle>
              <CardDescription>
                Fire tonale personaer vælges automatisk server-side baseret på brugerens data — brugeren ser aldrig personanavnene
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between py-2">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Persona-system aktivt</Label>
                  <p className="text-sm text-muted-foreground">
                    Slår dynamisk persona-valg til eller fra
                  </p>
                </div>
                <Switch
                  checked={personaActive}
                  onCheckedChange={(v) => { setPersonaActive(v); setIsPersonaDirty(true); }}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 pt-2">
                {[
                  {
                    name: 'Bekymret',
                    trigger: `Score < ${concernedThreshold} eller over budget`,
                    color: 'border-red-100 bg-red-50',
                    labelColor: 'text-red-700',
                    desc: 'Rolig, empatisk og handlingsorienteret',
                  },
                  {
                    name: 'Opmuntrende',
                    trigger: `Score ${concernedThreshold}–${celebratoryThreshold - 1}`,
                    color: 'border-emerald-100 bg-emerald-50',
                    labelColor: 'text-emerald-700',
                    desc: 'Anerkendende og motiverende',
                  },
                  {
                    name: 'Fejrende',
                    trigger: `Score ≥ ${celebratoryThreshold} og streak ≥ ${celebratoryStreakMin} mdr.`,
                    color: 'border-amber-100 bg-amber-50',
                    labelColor: 'text-amber-700',
                    desc: 'Glad, bekræftende og kortfattet',
                  },
                  {
                    name: 'Direkte',
                    trigger: `> ${directWeeklyTx} posteringer denne uge`,
                    color: 'border-slate-100 bg-slate-50',
                    labelColor: 'text-slate-700',
                    desc: 'Ingen indledning — ren handling',
                  },
                ].map((p) => (
                  <div key={p.name} className={`rounded-xl border p-3.5 ${p.color}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-sm font-semibold ${p.labelColor}`}>{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 mt-0.5 text-right">{p.trigger}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-5 pt-2 border-t border-border">
                <div className="space-y-3 pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Bekymret-grænse (score)</Label>
                    <span className="text-xs font-mono bg-secondary px-2.5 py-1 rounded-full text-muted-foreground">
                      &lt; {concernedThreshold}
                    </span>
                  </div>
                  <Slider
                    value={[concernedThreshold]}
                    onValueChange={([v]) => { setConcernedThreshold(v); setIsPersonaDirty(true); }}
                    min={0} max={60} step={5}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0</span><span>60</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Fejrende-grænse (score)</Label>
                    <span className="text-xs font-mono bg-secondary px-2.5 py-1 rounded-full text-muted-foreground">
                      ≥ {celebratoryThreshold}
                    </span>
                  </div>
                  <Slider
                    value={[celebratoryThreshold]}
                    onValueChange={([v]) => { setCelebratoryThreshold(v); setIsPersonaDirty(true); }}
                    min={60} max={100} step={5}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>60</span><span>100</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Fejrende — minimum streak</Label>
                    <span className="text-xs font-mono bg-secondary px-2.5 py-1 rounded-full text-muted-foreground">
                      ≥ {celebratoryStreakMin} mdr.
                    </span>
                  </div>
                  <Slider
                    value={[celebratoryStreakMin]}
                    onValueChange={([v]) => { setCelebratoryStreakMin(v); setIsPersonaDirty(true); }}
                    min={1} max={12} step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 måned</span><span>12 måneder</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Direkte — ugentlig grænse</Label>
                    <span className="text-xs font-mono bg-secondary px-2.5 py-1 rounded-full text-muted-foreground">
                      &gt; {directWeeklyTx} posteringer
                    </span>
                  </div>
                  <Slider
                    value={[directWeeklyTx]}
                    onValueChange={([v]) => { setDirectWeeklyTx(v); setIsPersonaDirty(true); }}
                    min={3} max={30} step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>3</span><span>30</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  onClick={handleSavePersona}
                  disabled={savingPersona || !isPersonaDirty}
                  className="gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingPersona ? 'Gemmer...' : 'Gem persona-indstillinger'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border rounded-3xl overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                System Prompt
              </CardTitle>
              <CardDescription>
                Instruktioner til AI&apos;en — definerer tone, format og adfærd. Ændringer træder i kraft ved næste brugerkald.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Prompt-tekst</Label>
                  <span className="text-xs text-muted-foreground">
                    {systemPrompt.length} tegn
                  </span>
                </div>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => { setSystemPrompt(e.target.value); markDirty(); }}
                  className="min-h-[420px] font-mono text-sm leading-relaxed rounded-xl resize-y"
                  placeholder="Skriv system prompt her..."
                  spellCheck={false}
                />
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-700 space-y-1">
                  <p className="font-medium">Vigtigt om JSON-format</p>
                  <p>AI&apos;en skal altid returnere et gyldigt JSON-objekt med felterne <code className="bg-amber-100 px-1 rounded">message</code>, <code className="bg-amber-100 px-1 rounded">actions</code> og <code className="bg-amber-100 px-1 rounded">tone</code>. Fjern ikke JSON-strukturen fra prompten.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {config?.updated_at && (
            <p className="text-xs text-muted-foreground text-center pb-4">
              Sidst opdateret: {new Date(config.updated_at).toLocaleString('da-DK', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          )}

        </div>
      </div>
    </div>
  );
}
