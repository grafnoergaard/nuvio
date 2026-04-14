'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTypography } from '@/lib/typography-context';
import { useTypographyInspector } from '@/lib/typography-inspector-context';
import { DEFAULT_TYPOGRAPHY_TOKENS } from '@/lib/typography-tokens';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Type, Save, RotateCcw, Weight, ScanText } from 'lucide-react';
import { toast } from 'sonner';

const FONT_SIZE_TOKENS = [
  { key: 'font-size-caption',    label: 'Caption',     description: 'Badges, metadata, versionsnumre',          min: 8,  max: 16, step: 1  },
  { key: 'font-size-label',      label: 'Label',        description: 'Nav labels, wizard step labels, uppercase', min: 8,  max: 16, step: 1  },
  { key: 'font-size-body-sm',    label: 'Body SM',      description: 'Brødtekst, form labels, tabelceller',      min: 10, max: 20, step: 1  },
  { key: 'font-size-body',       label: 'Body',         description: 'Kortindhold, standard læsetekst',          min: 12, max: 22, step: 1  },
  { key: 'font-size-body-lg',    label: 'Body LG',      description: 'Wizard forklaringer, lead-afsnit',         min: 14, max: 28, step: 1  },
  { key: 'font-size-heading-sm', label: 'Heading SM',   description: 'Sektionsoverskrifter, korttitler',         min: 16, max: 40, step: 2  },
  { key: 'font-size-heading',    label: 'Heading',      description: 'Sideoverskrifter, wizard overskrifter',    min: 20, max: 52, step: 2  },
  { key: 'font-size-heading-lg', label: 'Heading LG',   description: 'Store wizard overskrifter, featured',      min: 24, max: 60, step: 2  },
  { key: 'font-size-display',    label: 'Display',      description: 'Store finansielle tal, hero-statistik',    min: 32, max: 80, step: 4  },
] as const;

const FONT_WEIGHT_TOKENS = [
  { key: 'font-weight-regular',  label: 'Regular',   description: 'Normal brødtekst',                    options: [300, 400] },
  { key: 'font-weight-medium',   label: 'Medium',    description: 'Let fremhævet tekst',                 options: [400, 500, 600] },
  { key: 'font-weight-semibold', label: 'Semibold',  description: 'Labels, korttitler, nav',             options: [500, 600, 700] },
  { key: 'font-weight-bold',     label: 'Bold',      description: 'Stærk fremhævning, tal, overskrifter', options: [600, 700, 800, 900] },
] as const;

const WEIGHT_LABELS: Record<number, string> = {
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semibold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
};

function parsePx(val: string): number {
  return parseInt(val.replace('px', ''), 10) || 0;
}

interface TokenSliderRowProps {
  label: string;
  description: string;
  tokenKey: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  onChange: (key: string, value: string) => void;
}

function TokenSliderRow({ label, description, tokenKey, value, min, max, step, defaultValue, onChange }: TokenSliderRowProps) {
  const isModified = value !== defaultValue;

  return (
    <div className="py-4 border-b border-border/40 last:border-0">
      <div className="flex items-start justify-between gap-4 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{label}</span>
            {isModified && (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                ændret
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="font-mono text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full min-w-[44px] text-center"
          >
            {value}px
          </span>
          <div
            className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5 text-nowrap"
            style={{ fontSize: `${Math.min(value, 18)}px`, fontWeight: 600, lineHeight: 1.2 }}
          >
            Aa
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground/50 w-8 shrink-0">{min}px</span>
        <Slider
          value={[value]}
          onValueChange={([v]) => onChange(tokenKey, `${v}px`)}
          min={min}
          max={max}
          step={step}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground/50 w-8 shrink-0 text-right">{max}px</span>
      </div>
    </div>
  );
}

interface WeightSelectorRowProps {
  label: string;
  description: string;
  tokenKey: string;
  value: number;
  options: readonly number[];
  defaultValue: number;
  onChange: (key: string, value: string) => void;
}

function WeightSelectorRow({ label, description, tokenKey, value, options, defaultValue, onChange }: WeightSelectorRowProps) {
  const isModified = value !== defaultValue;

  return (
    <div className="py-4 border-b border-border/40 last:border-0">
      <div className="flex items-start justify-between gap-4 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{label}</span>
            {isModified && (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                ændret
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <span
          className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5 shrink-0"
          style={{ fontWeight: value }}
        >
          {WEIGHT_LABELS[value] ?? value}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(tokenKey, String(opt))}
            className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${
              value === opt
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold'
                : 'bg-white border-border text-muted-foreground hover:border-foreground/20'
            }`}
            style={{ fontWeight: opt }}
          >
            {opt} — {WEIGHT_LABELS[opt] ?? opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TypographyAdminPage() {
  const { tokens, loaded, previewToken, saveTokens, previewReset, saveReset } = useTypography();
  const { active: inspectorActive, toggle: toggleInspector } = useTypographyInspector();

  const [localTokens, setLocalTokens] = useState<Record<string, string>>(DEFAULT_TYPOGRAPHY_TOKENS);
  const [savedTokens, setSavedTokens] = useState<Record<string, string>>(DEFAULT_TYPOGRAPHY_TOKENS);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (loaded) {
      setLocalTokens({ ...tokens });
      setSavedTokens({ ...tokens });
    }
  }, [loaded]);

  const dirty = Object.keys(localTokens).some(k => localTokens[k] !== savedTokens[k]);

  const changedCount = Object.keys(localTokens).filter(k => localTokens[k] !== DEFAULT_TYPOGRAPHY_TOKENS[k]).length;

  const handleChange = useCallback((key: string, value: string) => {
    setLocalTokens(prev => ({ ...prev, [key]: value }));
    previewToken(key, value);
  }, [previewToken]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveTokens(localTokens);
      setSavedTokens({ ...localTokens });
      toast.success('Typografi-tokens gemt');
    } catch {
      toast.error('Kunne ikke gemme tokens');
    } finally {
      setSaving(false);
    }
  }

  function handleRevert() {
    setLocalTokens({ ...savedTokens });
    Object.entries(savedTokens).forEach(([key, value]) => previewToken(key, value));
  }

  async function handleResetToDefaults() {
    setResetting(true);
    try {
      await saveReset();
      setLocalTokens({ ...DEFAULT_TYPOGRAPHY_TOKENS });
      setSavedTokens({ ...DEFAULT_TYPOGRAPHY_TOKENS });
      toast.success('Tokens nulstillet til standarder');
    } catch {
      toast.error('Kunne ikke nulstille tokens');
    } finally {
      setResetting(false);
    }
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white py-8 px-6 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Indlæser typografi-tokens...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white py-8 px-6">
      <div className="max-w-2xl mx-auto">

        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Typografi-tokens</h1>
              <p className="text-muted-foreground mt-1.5 leading-relaxed">
                Justér skriftstørrelser og -vægte på tværs af hele systemet. Ændringer er live.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-1">
              {dirty && (
                <Button variant="ghost" size="sm" onClick={handleRevert} disabled={saving} className="gap-1.5 text-muted-foreground">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Fortryd
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={!dirty || saving}
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Gemmer...' : 'Gem ændringer'}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <span className="text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
              {FONT_SIZE_TOKENS.length + FONT_WEIGHT_TOKENS.length} tokens i alt
            </span>
            {changedCount > 0 && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                {changedCount} afviger fra standard
              </span>
            )}
            {dirty && (
              <span className="text-xs text-sky-600 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-full font-medium">
                Ugemte ændringer
              </span>
            )}
          </div>
        </div>

        <div className="space-y-5">

          <Card className="shadow-sm border rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Type className="h-4 w-4" />
                Skriftstørrelser
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                Fra mindste caption til store display-tal. Brug sliders til live preview.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {FONT_SIZE_TOKENS.map((token) => {
                const rawValue = localTokens[token.key] ?? DEFAULT_TYPOGRAPHY_TOKENS[token.key];
                const numValue = parsePx(rawValue);
                const defaultNum = parsePx(DEFAULT_TYPOGRAPHY_TOKENS[token.key]);
                return (
                  <TokenSliderRow
                    key={token.key}
                    label={token.label}
                    description={token.description}
                    tokenKey={token.key}
                    value={numValue}
                    min={token.min}
                    max={token.max}
                    step={token.step}
                    defaultValue={defaultNum}
                    onChange={handleChange}
                  />
                );
              })}
            </CardContent>
          </Card>

          <Card className="shadow-sm border rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Weight className="h-4 w-4" />
                Skriftvægte
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                Styr tykkelsen på de fire vægt-niveauer i systemet.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {FONT_WEIGHT_TOKENS.map((token) => {
                const rawValue = localTokens[token.key] ?? DEFAULT_TYPOGRAPHY_TOKENS[token.key];
                const numValue = parseInt(rawValue, 10) || 400;
                const defaultNum = parseInt(DEFAULT_TYPOGRAPHY_TOKENS[token.key], 10) || 400;
                return (
                  <WeightSelectorRow
                    key={token.key}
                    label={token.label}
                    description={token.description}
                    tokenKey={token.key}
                    value={numValue}
                    options={token.options}
                    defaultValue={defaultNum}
                    onChange={handleChange}
                  />
                );
              })}
            </CardContent>
          </Card>

          <Card className="shadow-sm border rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Nulstil til standarder</CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                Gendan alle tokens til de originale standardværdier. Dette skriver til databasen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={handleResetToDefaults}
                disabled={resetting || changedCount === 0}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {resetting ? 'Nulstiller...' : 'Nulstil alle tokens'}
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-sm border rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ScanText className="h-4 w-4" />
                Typografi Inspector
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                Hold musen over ethvert element og se dets typografi-rolle, størrelse og vægt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <button
                onClick={toggleInspector}
                className={`relative inline-flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-sm font-medium ${
                  inspectorActive
                    ? 'border-emerald-400 bg-emerald-50/60 text-emerald-700'
                    : 'border-foreground/10 bg-white/50 text-foreground hover:border-foreground/20'
                }`}
              >
                <span className={`w-2 h-2 rounded-full transition-colors ${inspectorActive ? 'bg-emerald-500 animate-pulse' : 'bg-foreground/20'}`} />
                {inspectorActive ? 'Inspector aktiv — klik for at slå fra' : 'Slå inspector til'}
              </button>
            </CardContent>
          </Card>

          <div className="p-4 rounded-2xl bg-secondary/40 border border-border/50">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground/70">Adoption:</strong> Tokens er tilgængelige som CSS-klasser{' '}
              <code className="font-mono bg-secondary px-1 rounded text-label">.text-token-body</code>,{' '}
              <code className="font-mono bg-secondary px-1 rounded text-label">.weight-token-bold</code> osv.
              Eksisterende Tailwind-klasser bevarer deres hardcodede værdier indtil de migreres til tokens.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
