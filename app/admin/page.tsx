'use client';

import { useSettings, DEFAULT_DESIGN, DEFAULT_CARD_SMALL, DEFAULT_CARD_MEDIUM, DEFAULT_CARD_LARGE, DEFAULT_PAGE_DESIGN, type DesignSettings, type CardDesignSettings, type PageDesignSettings } from '@/lib/settings-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { RotateCcw, Palette, Image as ImageIcon, LayoutGrid as Layout, Layers, TrendingUp, Monitor, Columns2 as Columns } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

interface ColorFieldProps {
  label: string;
  description?: string;
  value: string;
  onChange: (val: string) => void;
}

function ColorField({ label, description, value, onChange }: ColorFieldProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="space-y-0.5 flex-1 min-w-0 pr-4">
        <Label className="text-base font-medium">{label}</Label>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div
          className="w-8 h-8 rounded-lg border border-border shadow-sm"
          style={{ backgroundColor: value }}
        />
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-8 p-0.5 cursor-pointer rounded-lg border border-border"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 h-8 font-mono text-sm"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

interface GradientPreviewProps {
  from: string;
  to: string;
  label: string;
}

function GradientPreview({ from, to, label }: GradientPreviewProps) {
  return (
    <div
      className="h-8 rounded-lg flex items-center justify-center text-white text-xs font-medium shadow-sm"
      style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
    >
      {label}
    </div>
  );
}

type ShadowOption = 'none' | 'sm' | 'md' | 'lg' | 'xl';
type TopBarStyle = 'gradient' | 'solid' | 'none';

function CardSizePreview({
  card,
  gradientFrom,
  gradientTo,
  size,
}: {
  card: CardDesignSettings;
  gradientFrom: string;
  gradientTo: string;
  size: 'Small' | 'Medium' | 'Large';
}) {
  const shadows: Record<string, string> = {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0,0,0,0.05)',
    md: '0 4px 6px -1px rgba(0,0,0,0.1)',
    lg: '0 10px 15px -3px rgba(0,0,0,0.1)',
    xl: '0 20px 25px -5px rgba(0,0,0,0.1)',
  };

  const topBarBg = card.topBarStyle === 'gradient'
    ? `linear-gradient(to right, ${gradientFrom}, ${gradientTo})`
    : card.topBarStyle === 'solid'
    ? card.topBarColor
    : 'transparent';

  const contentBySize = {
    Small: (
      <div className="px-4 py-4 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4" style={{ color: gradientTo }} />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Indkomst</span>
        </div>
        <p className="text-xl font-bold tabular-nums tracking-tight" style={{ color: gradientTo }}>42.500 kr.</p>
        <p className="text-xs text-muted-foreground">510.000 kr. pr. år</p>
        <p className="text-xs font-semibold" style={{ color: gradientTo }}>Stabil indkomststruktur</p>
      </div>
    ),
    Medium: (
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1">Opsparing Status</p>
            <p className="text-sm font-bold">🎯 Hus</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
            On track
          </span>
        </div>
        <div className="mb-3">
          <div className="flex items-end justify-between mb-1.5">
            <span className="text-2xl font-bold tabular-nums" style={{ color: gradientTo }}>50%</span>
            <span className="text-xs text-muted-foreground">170.000 af 340.000 kr.</span>
          </div>
          <div className="w-full rounded-full bg-secondary overflow-hidden h-2">
            <div className="rounded-full h-full w-1/2" style={{ background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})` }} />
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">2 år 5 mdr.</span>
          <span className="text-xs text-muted-foreground/60">Se opsparing &rsaquo;</span>
        </div>
      </div>
    ),
    Large: (
      <div className="p-5">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="mb-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Nuvio Score</span>
              <p className="text-label text-muted-foreground/50 mt-0.5">Din finansielle styrke og robusthed</p>
            </div>
            <div className="mt-3 mb-3">
              <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full w-4/5" style={{ background: gradientFrom }} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">Din finansielle profil er stærk. Fortsæt den nuværende kurs.</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-5xl font-bold tabular-nums tracking-tight leading-none" style={{ color: gradientFrom }}>79</div>
            <div className="text-xs text-muted-foreground/60 mt-1 mb-2">/ 100</div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-label font-bold border border-blue-200 bg-blue-50 text-blue-700">Stabil</span>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div
      className="bg-card flex flex-col"
      style={{
        borderRadius: `${card.borderRadius}px`,
        borderWidth: `${card.borderWidth}px`,
        borderStyle: 'solid',
        borderColor: 'hsl(var(--border))',
        boxShadow: shadows[card.shadow] ?? shadows.sm,
        overflow: 'hidden',
      }}
    >
      {card.topBarStyle !== 'none' && card.topBarHeight > 0 && (
        <div style={{ height: `${card.topBarHeight}px`, background: topBarBg, flexShrink: 0 }} />
      )}
      {contentBySize[size]}
    </div>
  );
}

function CardDesignPanel({
  title,
  subtitle,
  size,
  card,
  gradientFrom,
  gradientTo,
  previewSize,
  onChange,
  onReset,
}: {
  title: string;
  subtitle: string;
  size: 'cardSmall' | 'cardMedium' | 'cardLarge';
  card: CardDesignSettings;
  gradientFrom: string;
  gradientTo: string;
  previewSize: 'Small' | 'Medium' | 'Large';
  onChange: (key: keyof CardDesignSettings, value: CardDesignSettings[keyof CardDesignSettings]) => void;
  onReset: () => void;
}) {
  const shadowOptions: { value: ShadowOption; label: string }[] = [
    { value: 'none', label: 'Ingen' },
    { value: 'sm', label: 'Lille (sm)' },
    { value: 'md', label: 'Medium (md)' },
    { value: 'lg', label: 'Stor (lg)' },
    { value: 'xl', label: 'Ekstra stor (xl)' },
  ];

  const topBarStyleOptions: { value: TopBarStyle; label: string }[] = [
    { value: 'none', label: 'Ingen' },
    { value: 'gradient', label: 'Gradient' },
    { value: 'solid', label: 'Ensfarvet' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset} className="text-xs text-muted-foreground gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Nulstil
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Hjørneradius — {card.borderRadius}px</Label>
            <Slider
              value={[card.borderRadius]}
              onValueChange={([v]) => onChange('borderRadius', v)}
              min={0}
              max={32}
              step={2}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0px (skarp)</span>
              <span>32px (rund)</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Kantbredde — {card.borderWidth}px</Label>
            <Slider
              value={[card.borderWidth]}
              onValueChange={([v]) => onChange('borderWidth', v)}
              min={0}
              max={4}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0px (ingen)</span>
              <span>4px (tyk)</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Skygge</Label>
            <Select value={card.shadow} onValueChange={(v) => onChange('shadow', v as ShadowOption)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {shadowOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4 pt-2 border-t border-border/50">
            <Label className="text-sm font-medium block">Top-streg</Label>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Stil</Label>
              <Select value={card.topBarStyle} onValueChange={(v) => onChange('topBarStyle', v as TopBarStyle)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {topBarStyleOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {card.topBarStyle !== 'none' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Højde — {card.topBarHeight}px</Label>
                  <Slider
                    value={[card.topBarHeight]}
                    onValueChange={([v]) => onChange('topBarHeight', v)}
                    min={1}
                    max={12}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1px (tynd)</span>
                    <span>12px (tyk)</span>
                  </div>
                </div>

                {card.topBarStyle === 'solid' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Farve</Label>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md border border-border" style={{ backgroundColor: card.topBarColor }} />
                      <Input
                        type="color"
                        value={card.topBarColor}
                        onChange={(e) => onChange('topBarColor', e.target.value)}
                        className="w-10 h-8 p-0.5 cursor-pointer rounded-lg border border-border"
                      />
                      <Input
                        type="text"
                        value={card.topBarColor}
                        onChange={(e) => onChange('topBarColor', e.target.value)}
                        className="font-mono text-sm h-8"
                        placeholder="#2ED3A7"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium text-muted-foreground">Live preview</Label>
          <div className="bg-secondary/30 rounded-2xl p-4">
            <CardSizePreview card={card} gradientFrom={gradientFrom} gradientTo={gradientTo} size={previewSize} />
          </div>
          <div className="flex gap-1.5 text-xs text-muted-foreground/60 flex-wrap">
            <span className="bg-secondary px-2 py-0.5 rounded-full">r: {card.borderRadius}px</span>
            <span className="bg-secondary px-2 py-0.5 rounded-full">kant: {card.borderWidth}px</span>
            <span className="bg-secondary px-2 py-0.5 rounded-full">skygge: {card.shadow}</span>
            {card.topBarStyle !== 'none' && (
              <span className="bg-secondary px-2 py-0.5 rounded-full">topstreg: {card.topBarHeight}px {card.topBarStyle}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { design, updateDesign, updateCardDesign, updatePageDesign, resetDesign } = useSettings();

  function handleMobileNavIconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      updateDesign('mobileNavIconUrl', dataUrl);
      toast.success('Mobil nav-ikon opdateret');
    };
    reader.readAsDataURL(file);
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      updateDesign('logoUrl', dataUrl);
      toast.success('Logo opdateret');
    };
    reader.readAsDataURL(file);
  }

  function handleReset() {
    resetDesign();
    toast.success('Designindstillinger nulstillet');
  }

  function handleCardReset(size: 'cardSmall' | 'cardMedium' | 'cardLarge') {
    const defaults = size === 'cardSmall' ? DEFAULT_CARD_SMALL : size === 'cardMedium' ? DEFAULT_CARD_MEDIUM : DEFAULT_CARD_LARGE;
    const keys = Object.keys(defaults) as (keyof CardDesignSettings)[];
    keys.forEach(k => updateCardDesign(size, k, (defaults as any)[k]));
    toast.success('Kortstørrelse nulstillet');
  }

  function handlePageReset() {
    const keys = Object.keys(DEFAULT_PAGE_DESIGN) as (keyof PageDesignSettings)[];
    keys.forEach(k => updatePageDesign(k, (DEFAULT_PAGE_DESIGN as any)[k]));
    toast.success('Side design nulstillet');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Backend</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Administrer designindstillinger for appen
          </p>
        </div>

        <div className="space-y-6">

          <Card className="shadow-sm border rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Nuvio Card Design
              </CardTitle>
              <CardDescription>
                Styr det overordnede udseende af kortene i tre størrelser — Small, Medium og Large
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-10">
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="h-5 w-5 rounded-md bg-secondary flex items-center justify-center">
                      <span className="text-xs font-bold text-muted-foreground">S</span>
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Small</span>
                  </div>
                  <CardDesignPanel
                    title="Small kort"
                    subtitle="Bruges til kompakte nøgletal — Indkomst, Faste udgifter, Variable udgifter osv."
                    size="cardSmall"
                    card={design.cardSmall}
                    gradientFrom={design.gradientFrom}
                    gradientTo={design.gradientTo}
                    previewSize="Small"
                    onChange={(k, v) => updateCardDesign('cardSmall', k, v)}
                    onReset={() => handleCardReset('cardSmall')}
                  />
                </div>

                <div className="border-t pt-8">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="h-5 w-5 rounded-md bg-secondary flex items-center justify-center">
                      <span className="text-xs font-bold text-muted-foreground">M</span>
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Medium</span>
                  </div>
                  <CardDesignPanel
                    title="Medium kort"
                    subtitle="Bruges til Opsparing Status, Kapital & Fremdrift og tilsvarende indholdsrige kort."
                    size="cardMedium"
                    card={design.cardMedium}
                    gradientFrom={design.gradientFrom}
                    gradientTo={design.gradientTo}
                    previewSize="Medium"
                    onChange={(k, v) => updateCardDesign('cardMedium', k, v)}
                    onReset={() => handleCardReset('cardMedium')}
                  />
                </div>

                <div className="border-t pt-8">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="h-5 w-5 rounded-md bg-secondary flex items-center justify-center">
                      <span className="text-xs font-bold text-muted-foreground">L</span>
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Large</span>
                  </div>
                  <CardDesignPanel
                    title="Large kort"
                    subtitle="Bruges til Nuvio Score, Forbrugsstatus, Finansielt overblik og brede informationskort."
                    size="cardLarge"
                    card={design.cardLarge}
                    gradientFrom={design.gradientFrom}
                    gradientTo={design.gradientTo}
                    previewSize="Large"
                    onChange={(k, v) => updateCardDesign('cardLarge', k, v)}
                    onReset={() => handleCardReset('cardLarge')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Nuvio Page Design
              </CardTitle>
              <CardDescription>
                Styr layoutet på Hjem Oversigt — marginer, kolonner og afstande
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">

                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold">Side layout</h3>
                      <p className="text-sm text-muted-foreground">Kontroller sidernes overordnede bredde og indrykning</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handlePageReset} className="text-xs text-muted-foreground gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Nulstil
                    </Button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Maks. sidebredde</Label>
                          <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{design.page.maxWidth}px</span>
                        </div>
                        <Slider
                          value={[design.page.maxWidth]}
                          onValueChange={([v]) => updatePageDesign('maxWidth', v)}
                          min={640}
                          max={1600}
                          step={64}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>640px (smal)</span>
                          <span>1600px (bred)</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Vandret margin (venstre/højre)</Label>
                          <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{design.page.paddingX}px</span>
                        </div>
                        <Slider
                          value={[design.page.paddingX]}
                          onValueChange={([v]) => updatePageDesign('paddingX', v)}
                          min={0}
                          max={80}
                          step={4}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>0px (ingen)</span>
                          <span>80px (bred)</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Lodret margin (top/bund)</Label>
                          <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{design.page.paddingY}px</span>
                        </div>
                        <Slider
                          value={[design.page.paddingY]}
                          onValueChange={([v]) => updatePageDesign('paddingY', v)}
                          min={0}
                          max={80}
                          step={4}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>0px (ingen)</span>
                          <span>80px (bred)</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-muted-foreground">Live preview</Label>
                      <div className="bg-secondary/30 rounded-2xl p-3 space-y-1.5">
                        <div className="bg-background/60 rounded-xl border border-border/50 overflow-hidden" style={{ padding: `${Math.round(design.page.paddingY * 0.18)}px ${Math.round(design.page.paddingX * 0.18)}px` }}>
                          <div className="bg-card rounded-lg border border-border h-4 mb-1.5" style={{ maxWidth: `${Math.round(design.page.maxWidth * 0.22)}px` }} />
                          <div className={`grid gap-1`} style={{ gridTemplateColumns: `repeat(${design.page.gridCols}, minmax(0, 1fr))`, gap: `${Math.round(design.page.cardGap * 0.4)}px` }}>
                            {Array.from({ length: design.page.gridCols }).map((_, i) => (
                              <div key={i} className="bg-card rounded border border-border h-6" />
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1.5 text-xs text-muted-foreground/60 flex-wrap pt-1">
                          <span className="bg-secondary px-2 py-0.5 rounded-full">maks: {design.page.maxWidth}px</span>
                          <span className="bg-secondary px-2 py-0.5 rounded-full">x: {design.page.paddingX}px</span>
                          <span className="bg-secondary px-2 py-0.5 rounded-full">y: {design.page.paddingY}px</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6 space-y-5">
                  <div>
                    <h3 className="text-base font-semibold">Kolonner og afstand</h3>
                    <p className="text-sm text-muted-foreground">Styr antal kolonner i kortgitteret og afstanden imellem dem</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Kolonner (desktop)</Label>
                          <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{design.page.gridCols} kol.</span>
                        </div>
                        <Slider
                          value={[design.page.gridCols]}
                          onValueChange={([v]) => updatePageDesign('gridCols', v)}
                          min={1}
                          max={6}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>1 (enkelt)</span>
                          <span>6 (tæt)</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Kolonner (mobil/tablet)</Label>
                          <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{design.page.gridColsSmall} kol.</span>
                        </div>
                        <Slider
                          value={[design.page.gridColsSmall]}
                          onValueChange={([v]) => updatePageDesign('gridColsSmall', Math.min(v, 2))}
                          min={1}
                          max={2}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>1 (enkelt)</span>
                          <span>2 (maks. på mobil)</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Afstand mellem kort</Label>
                          <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{design.page.cardGap}px</span>
                        </div>
                        <Slider
                          value={[design.page.cardGap]}
                          onValueChange={([v]) => updatePageDesign('cardGap', v)}
                          min={4}
                          max={32}
                          step={2}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>4px (tæt)</span>
                          <span>32px (åbent)</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-muted-foreground">Kolonne-preview</Label>
                      <div className="bg-secondary/30 rounded-2xl p-3">
                        <div
                          className="grid"
                          style={{
                            gridTemplateColumns: `repeat(${design.page.gridCols}, minmax(0, 1fr))`,
                            gap: `${design.page.cardGap * 0.5}px`,
                          }}
                        >
                          {Array.from({ length: design.page.gridCols * 2 }).map((_, i) => (
                            <div key={i} className="bg-card rounded-xl border border-border h-10 flex items-center justify-center">
                              <span className="text-xs text-muted-foreground/50 font-mono">{i + 1}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-1.5 text-xs text-muted-foreground/60 flex-wrap pt-2 mt-2 border-t border-border/30">
                          <span className="bg-secondary px-2 py-0.5 rounded-full">{design.page.gridCols} kol.</span>
                          <span className="bg-secondary px-2 py-0.5 rounded-full">gap: {design.page.cardGap}px</span>
                          <span className="bg-secondary px-2 py-0.5 rounded-full">mobil: {Math.min(design.page.gridColsSmall, 2)} kol.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border rounded-3xl overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Farver
              </CardTitle>
              <CardDescription>
                Tilpas appens primære farvepalette
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 divide-y divide-border">
              <ColorField
                label="Primær farve"
                description="Bruges til knapper, aktive menupunkter og accenter"
                value={design.primaryColor}
                onChange={(v) => updateDesign('primaryColor', v)}
              />
              <ColorField
                label="Accent farve"
                description="Fremhævningsfarve og gradienter"
                value={design.accentColor}
                onChange={(v) => updateDesign('accentColor', v)}
              />
              <ColorField
                label="Baggrund"
                description="Sidens baggrundfarve"
                value={design.backgroundColor}
                onChange={(v) => updateDesign('backgroundColor', v)}
              />
              <ColorField
                label="Tekst"
                description="Primær tekstfarve"
                value={design.textColor}
                onChange={(v) => updateDesign('textColor', v)}
              />
              <ColorField
                label="Minus / Udgifter"
                description="Farve på negative beløb og udgifter"
                value={design.minusColor}
                onChange={(v) => updateDesign('minusColor', v)}
              />
            </CardContent>
          </Card>

          <Card className="shadow-sm border rounded-3xl overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5" />
                Gradients
              </CardTitle>
              <CardDescription>
                Tilpas gradienterne i appen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-base font-medium">Hoved-gradient (sidebar tip, m.m.)</Label>
                <GradientPreview from={design.gradientFrom} to={design.gradientTo} label="Preview" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Fra</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={design.gradientFrom}
                        onChange={(e) => updateDesign('gradientFrom', e.target.value)}
                        className="w-10 h-8 p-0.5 cursor-pointer rounded-lg border border-border"
                      />
                      <Input
                        type="text"
                        value={design.gradientFrom}
                        onChange={(e) => updateDesign('gradientFrom', e.target.value)}
                        className="font-mono text-sm h-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Til</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={design.gradientTo}
                        onChange={(e) => updateDesign('gradientTo', e.target.value)}
                        className="w-10 h-8 p-0.5 cursor-pointer rounded-lg border border-border"
                      />
                      <Input
                        type="text"
                        value={design.gradientTo}
                        onChange={(e) => updateDesign('gradientTo', e.target.value)}
                        className="font-mono text-sm h-8"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6 space-y-3">
                <Label className="text-base font-medium">Boks 1 – Udgifter</Label>
                <GradientPreview from={design.card1GradientFrom} to={design.card1GradientTo} label="Udgifter" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Fra</Label>
                    <div className="flex items-center gap-2">
                      <Input type="color" value={design.card1GradientFrom} onChange={(e) => updateDesign('card1GradientFrom', e.target.value)} className="w-10 h-8 p-0.5 cursor-pointer rounded-lg border border-border" />
                      <Input type="text" value={design.card1GradientFrom} onChange={(e) => updateDesign('card1GradientFrom', e.target.value)} className="font-mono text-sm h-8" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Til</Label>
                    <div className="flex items-center gap-2">
                      <Input type="color" value={design.card1GradientTo} onChange={(e) => updateDesign('card1GradientTo', e.target.value)} className="w-10 h-8 p-0.5 cursor-pointer rounded-lg border border-border" />
                      <Input type="text" value={design.card1GradientTo} onChange={(e) => updateDesign('card1GradientTo', e.target.value)} className="font-mono text-sm h-8" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6 space-y-3">
                <Label className="text-base font-medium">Boks 2 – Indtægter</Label>
                <GradientPreview from={design.card2GradientFrom} to={design.card2GradientTo} label="Indtægter" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Fra</Label>
                    <div className="flex items-center gap-2">
                      <Input type="color" value={design.card2GradientFrom} onChange={(e) => updateDesign('card2GradientFrom', e.target.value)} className="w-10 h-8 p-0.5 cursor-pointer rounded-lg border border-border" />
                      <Input type="text" value={design.card2GradientFrom} onChange={(e) => updateDesign('card2GradientFrom', e.target.value)} className="font-mono text-sm h-8" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Til</Label>
                    <div className="flex items-center gap-2">
                      <Input type="color" value={design.card2GradientTo} onChange={(e) => updateDesign('card2GradientTo', e.target.value)} className="w-10 h-8 p-0.5 cursor-pointer rounded-lg border border-border" />
                      <Input type="text" value={design.card2GradientTo} onChange={(e) => updateDesign('card2GradientTo', e.target.value)} className="font-mono text-sm h-8" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6 space-y-3">
                <Label className="text-base font-medium">Boks 3 – Forskel</Label>
                <GradientPreview from={design.card3GradientFrom} to={design.card3GradientTo} label="Forskel" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Fra</Label>
                    <div className="flex items-center gap-2">
                      <Input type="color" value={design.card3GradientFrom} onChange={(e) => updateDesign('card3GradientFrom', e.target.value)} className="w-10 h-8 p-0.5 cursor-pointer rounded-lg border border-border" />
                      <Input type="text" value={design.card3GradientFrom} onChange={(e) => updateDesign('card3GradientFrom', e.target.value)} className="font-mono text-sm h-8" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Til</Label>
                    <div className="flex items-center gap-2">
                      <Input type="color" value={design.card3GradientTo} onChange={(e) => updateDesign('card3GradientTo', e.target.value)} className="w-10 h-8 p-0.5 cursor-pointer rounded-lg border border-border" />
                      <Input type="text" value={design.card3GradientTo} onChange={(e) => updateDesign('card3GradientTo', e.target.value)} className="font-mono text-sm h-8" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border rounded-3xl overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Logo
              </CardTitle>
              <CardDescription>
                Upload et nyt logo til appen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6">
                <div className="shrink-0">
                  <img
                    src={design.logoUrl}
                    alt="Logo preview"
                    className="w-20 h-20 rounded-2xl shadow-md object-contain bg-card border border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logo-upload" className="text-base font-medium">Upload logofil</Label>
                  <p className="text-sm text-muted-foreground">PNG, JPG eller SVG. Anbefalet størrelse: 200x200px.</p>
                  <Input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="cursor-pointer"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border rounded-3xl overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Mobil nav-ikon
              </CardTitle>
              <CardDescription>
                Ikonet der vises i midten af den mobile navigationslinje
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6">
                <div className="shrink-0">
                  <div className="w-20 h-20 rounded-2xl shadow-md overflow-hidden border border-border bg-card">
                    {design.mobileNavIconUrl ? (
                      <img
                        src={design.mobileNavIconUrl}
                        alt="Mobil nav-ikon preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        Ingen
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile-nav-icon-upload" className="text-base font-medium">Upload ikon</Label>
                  <p className="text-sm text-muted-foreground">PNG, JPG eller SVG. Anbefalet størrelse: 200x200px.</p>
                  <Input
                    id="mobile-nav-icon-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleMobileNavIconChange}
                    className="cursor-pointer"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border rounded-3xl overflow-hidden">
            <CardHeader>
              <CardTitle>Nulstil design</CardTitle>
              <CardDescription>
                Nulstil alle designindstillinger til standardværdier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Nulstil designindstillinger
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
