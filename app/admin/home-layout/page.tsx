'use client';

import { useState, useEffect } from 'react';
import {
  fetchHomeCardConfig,
  bulkUpdateHomeCardConfig,
  type HomeCardConfig,
  type HomeCardWidth,
} from '@/lib/home-card-config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LayoutDashboard, ChevronUp, ChevronDown, Eye, EyeOff, Save, RotateCcw, Columns2 as Columns, Square } from 'lucide-react';
import { toast } from 'sonner';

const CARD_DESCRIPTIONS: Record<string, string> = {
  onboarding: 'Opsætnings-guide til nye brugere',
  nuvio_score: 'Finansiel styrke-score med progress-bar',
  finance_grid: 'Mini-grid med Indkomst, Faste, Variable, Investering, Frirum',
  savings_investment: 'Kapital & Fremdrift — investeringsoverblik',
  overview_checkup: 'Finansielt overblik + Nuvio Checkup',
  savings_goals: '(Ikke i brug)',
  next_step: 'Næste anbefalede handling',
  consumption_status: 'Forbrugsstatus med procentindikator',
  budget_status: 'Nuvio Flow budgetstatus — rådighedsbeløb, flow-score og ugebudget',
  streak_count: 'Aktiv Nuvio Flow-streak med månedspulser',
};

const WIDTH_LABELS: Record<HomeCardWidth, string> = {
  full: 'Fuld bredde',
  half: 'Halvt (2 per række)',
};

const FIXED_FULL_CARDS = new Set(['finance_grid', 'savings_investment', 'overview_checkup']);

export default function HomeLayoutAdminPage() {
  const [configs, setConfigs] = useState<HomeCardConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetchHomeCardConfig()
      .then(data => setConfigs(data))
      .catch(() => toast.error('Kunne ikke hente konfiguration'))
      .finally(() => setLoading(false));
  }, []);

  function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= configs.length) return;
    const updated = [...configs];
    [updated[index], updated[next]] = [updated[next], updated[index]];
    updated.forEach((c, i) => { c.sort_order = (i + 1) * 10; });
    setConfigs(updated);
    setDirty(true);
  }

  function toggleVisibility(index: number) {
    const updated = [...configs];
    updated[index] = { ...updated[index], is_visible: !updated[index].is_visible };
    setConfigs(updated);
    setDirty(true);
  }

  function toggleWidth(index: number) {
    const card = configs[index];
    if (FIXED_FULL_CARDS.has(card.card_key)) return;
    const updated = [...configs];
    updated[index] = { ...updated[index], width: card.width === 'full' ? 'half' : 'full' };
    setConfigs(updated);
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await bulkUpdateHomeCardConfig(
        configs.map(c => ({ id: c.id, sort_order: c.sort_order, is_visible: c.is_visible, width: c.width }))
      );
      toast.success('Layoutkonfiguration gemt');
      setDirty(false);
    } catch {
      toast.error('Kunne ikke gemme konfiguration');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setLoading(true);
    try {
      const data = await fetchHomeCardConfig();
      setConfigs(data);
      setDirty(false);
    } catch {
      toast.error('Kunne ikke genindlæse konfiguration');
    } finally {
      setLoading(false);
    }
  }

  const visibleCount = configs.filter(c => c.is_visible).length;
  const halfCount = configs.filter(c => c.width === 'half').length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white py-8 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Oversigt-layout</h1>
              <p className="text-muted-foreground mt-1.5 leading-relaxed">
                Styr hvilke sektioner der vises på forsiden, i hvilken rækkefølge og med hvilken bredde.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-1">
              {dirty && (
                <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving} className="gap-1.5 text-muted-foreground">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Fortryd
                </Button>
              )}
              <Button onClick={handleSave} disabled={!dirty || saving} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Gemmer...' : 'Gem ændringer'}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <span className="text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
              {visibleCount} af {configs.length} synlige
            </span>
            {halfCount > 0 && (
              <span className="text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
                {halfCount} halvbredt
              </span>
            )}
            {dirty && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                Ugemte ændringer
              </span>
            )}
          </div>
        </div>

        <Card className="shadow-sm border rounded-3xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutDashboard className="h-4 w-4" />
              Sektioner
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Brug pilene til at ændre rækkefølge. Halvt-bredde-sektioner sættes automatisk side om side, to pr. række.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {loading ? (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">Indlæser...</div>
            ) : (
              <div className="divide-y divide-border/60">
                {configs.map((cfg, index) => {
                  const isFixedFull = FIXED_FULL_CARDS.has(cfg.card_key);
                  return (
                    <div
                      key={cfg.id}
                      className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
                        !cfg.is_visible ? 'opacity-50 bg-secondary/20' : 'bg-card hover:bg-secondary/10'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          className="p-0.5 rounded hover:bg-secondary disabled:opacity-20 transition-colors text-muted-foreground"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => move(index, 1)}
                          disabled={index === configs.length - 1}
                          className="p-0.5 rounded hover:bg-secondary disabled:opacity-20 transition-colors text-muted-foreground"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${!cfg.is_visible ? 'line-through text-muted-foreground' : ''}`}>
                            {cfg.label}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground/50 bg-secondary px-1.5 py-0.5 rounded">
                            #{index + 1}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed truncate">
                          {CARD_DESCRIPTIONS[cfg.card_key] ?? ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleWidth(index)}
                          disabled={isFixedFull}
                          title={isFixedFull ? 'Denne sektion er altid fuld bredde' : WIDTH_LABELS[cfg.width]}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            isFixedFull
                              ? 'opacity-40 cursor-not-allowed bg-secondary text-muted-foreground border-border'
                              : cfg.width === 'half'
                              ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                              : 'bg-secondary text-muted-foreground border-border hover:bg-secondary/80'
                          }`}
                        >
                          {cfg.width === 'half' ? (
                            <Columns className="h-3 w-3" />
                          ) : (
                            <Square className="h-3 w-3" />
                          )}
                          {cfg.width === 'half' ? '½' : 'Fuld'}
                        </button>

                        <button
                          onClick={() => toggleVisibility(index)}
                          title={cfg.is_visible ? 'Skjul for brugere' : 'Vis for brugere'}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            cfg.is_visible
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {cfg.is_visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          {cfg.is_visible ? 'Synlig' : 'Skjult'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-4 p-4 rounded-2xl bg-secondary/40 border border-border/50">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground/70">Halvt-bredde:</strong> To sektioner med halvt-bredde sættes automatisk side om side.
            Sektioner med internt grid-layout (Finanskort, Opsparing & Investering, Finansielt overblik) er låst til fuld bredde.
          </p>
        </div>
      </div>
    </div>
  );
}
