'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, RotateCcw, Home, Shield, Zap, Wifi, Car, Baby, ShoppingCart, Coffee, Gamepad2, Package } from 'lucide-react';

interface WizardDefault {
  id: string;
  type: 'fixed' | 'variable';
  key: string;
  label: string;
  value: number;
  value_couple: number | null;
  sort_order: number;
}

const HARDCODED_FIXED: WizardDefault[] = [
  { id: '', type: 'fixed', key: 'housing', label: 'Husleje / Boliglån', value: 8500, value_couple: 12000, sort_order: 1 },
  { id: '', type: 'fixed', key: 'insurance', label: 'Forsikringer', value: 1400, value_couple: 2200, sort_order: 2 },
  { id: '', type: 'fixed', key: 'utilities', label: 'El / Vand / Varme', value: 1200, value_couple: 1800, sort_order: 3 },
  { id: '', type: 'fixed', key: 'subscriptions', label: 'Abonnementer', value: 600, value_couple: 900, sort_order: 4 },
  { id: '', type: 'fixed', key: 'transport', label: 'Transport', value: 1600, value_couple: 2400, sort_order: 5 },
  { id: '', type: 'fixed', key: 'children', label: 'Børnerelateret', value: 1800, value_couple: 1800, sort_order: 6 },
];

const HARDCODED_VARIABLE: WizardDefault[] = [
  { id: '', type: 'variable', key: 'food_pct', label: 'Mad & dagligvarer', value: 3000, value_couple: null, sort_order: 1 },
  { id: '', type: 'variable', key: 'transport_pct', label: 'Transport', value: 1200, value_couple: null, sort_order: 2 },
  { id: '', type: 'variable', key: 'cafe_pct', label: 'Café & takeaway', value: 600, value_couple: null, sort_order: 3 },
  { id: '', type: 'variable', key: 'leisure_pct', label: 'Fritid & underholdning', value: 700, value_couple: null, sort_order: 4 },
  { id: '', type: 'variable', key: 'misc_pct', label: 'Diverse', value: 800, value_couple: null, sort_order: 5 },
];

const FIXED_ICONS: Record<string, React.ReactNode> = {
  housing: <Home className="h-4 w-4" />,
  insurance: <Shield className="h-4 w-4" />,
  utilities: <Zap className="h-4 w-4" />,
  subscriptions: <Wifi className="h-4 w-4" />,
  transport: <Car className="h-4 w-4" />,
  children: <Baby className="h-4 w-4" />,
};

const VARIABLE_ICONS: Record<string, React.ReactNode> = {
  food_pct: <ShoppingCart className="h-4 w-4" />,
  transport_pct: <Car className="h-4 w-4" />,
  cafe_pct: <Coffee className="h-4 w-4" />,
  leisure_pct: <Gamepad2 className="h-4 w-4" />,
  misc_pct: <Package className="h-4 w-4" />,
};

export default function AdminCheckupDefaultsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fixed, setFixed] = useState<WizardDefault[]>(HARDCODED_FIXED);
  const [variable, setVariable] = useState<WizardDefault[]>(HARDCODED_VARIABLE);

  useEffect(() => {
    loadDefaults();
  }, []);

  async function loadDefaults() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('wizard_defaults')
        .select('*')
        .order('sort_order');

      if (error) throw error;

      if (data && data.length > 0) {
        const dbFixed = data.filter((d: WizardDefault) => d.type === 'fixed');
        const dbVariable = data.filter((d: WizardDefault) => d.type === 'variable');

        if (dbFixed.length > 0) setFixed(dbFixed);
        if (dbVariable.length > 0) setVariable(dbVariable);
      }
    } catch {
      toast.error('Kunne ikke hente standardværdier');
    } finally {
      setLoading(false);
    }
  }

  function updateFixed(key: string, field: 'value' | 'value_couple', val: number) {
    setFixed(prev => prev.map(d => d.key === key ? { ...d, [field]: val } : d));
  }

  function updateVariable(key: string, val: number) {
    setVariable(prev => prev.map(d => d.key === key ? { ...d, value: val } : d));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const all = [...fixed, ...variable];
      for (const d of all) {
        await supabase
          .from('wizard_defaults')
          .update({
            value: d.value,
            value_couple: d.value_couple,
            updated_at: new Date().toISOString(),
          })
          .eq('key', d.key);
      }
      toast.success('Standardværdier gemt');
    } catch {
      toast.error('Kunne ikke gemme standardværdier');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    try {
      const all = [...HARDCODED_FIXED, ...HARDCODED_VARIABLE];
      for (const d of all) {
        await supabase
          .from('wizard_defaults')
          .update({
            value: d.value,
            value_couple: d.value_couple,
            updated_at: new Date().toISOString(),
          })
          .eq('key', d.key);
      }
      setFixed(HARDCODED_FIXED.map(d => ({ ...d })));
      setVariable(HARDCODED_VARIABLE.map(d => ({ ...d })));
      toast.success('Nulstillet til standardværdier');
    } catch {
      toast.error('Kunne ikke nulstille');
    } finally {
      setSaving(false);
    }
  }

  const variableTotal = variable.reduce((s, d) => s + d.value, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-8 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-8">
      <div className="max-w-3xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Onboarding standardværdier</h1>
            <p className="text-muted-foreground mt-1">
              Forudindstillede estimater vist under onboarding af nye brugere
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={saving} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Nulstil
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Gemmer…' : 'Gem ændringer'}
            </Button>
          </div>
        </div>

        <Card className="rounded-3xl border shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Home className="h-5 w-5" />
              Faste udgifter
            </CardTitle>
            <CardDescription>
              Standardbeløb foreslået i onboarding-wizarden. Separate værdier for enlige og par (2+ voksne).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-0 divide-y divide-border/50">
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 pb-2 px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kategori</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28 text-right">Enlig</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28 text-right">Par</span>
              </div>
              {fixed.map(d => (
                <div key={d.key} className="grid grid-cols-[1fr_auto_auto] gap-4 py-3.5 px-1 items-center">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
                      {FIXED_ICONS[d.key]}
                    </div>
                    <span className="text-sm font-medium truncate">{d.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input
                      type="number"
                      value={d.value}
                      min={0}
                      onChange={e => updateFixed(d.key, 'value', parseInt(e.target.value) || 0)}
                      className="w-28 h-8 text-right font-mono text-sm"
                    />
                    <span className="text-xs text-muted-foreground w-8">kr.</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input
                      type="number"
                      value={d.value_couple ?? 0}
                      min={0}
                      onChange={e => updateFixed(d.key, 'value_couple', parseInt(e.target.value) || 0)}
                      className="w-28 h-8 text-right font-mono text-sm"
                    />
                    <span className="text-xs text-muted-foreground w-8">kr.</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-[1fr_auto_auto] gap-4 px-1">
              <span className="text-sm font-semibold text-muted-foreground">Total (aktiverede)</span>
              <span className="text-sm font-semibold tabular-nums w-28 text-right mr-8">
                {fixed.filter(d => d.key !== 'children').reduce((s, d) => s + d.value, 0).toLocaleString('da-DK')} kr.
              </span>
              <span className="text-sm font-semibold tabular-nums w-28 text-right mr-8">
                {fixed.filter(d => d.key !== 'children').reduce((s, d) => s + (d.value_couple ?? d.value), 0).toLocaleString('da-DK')} kr.
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 px-1">Børnerelateret er deaktiveret som standard og tæller ikke med i totalen.</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Variable udgifter — fordeling
            </CardTitle>
            <CardDescription>
              Standardbeløb pr. måned foreslået i onboarding-wizarden for variable udgiftskategorier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-0 divide-y divide-border/50">
              <div className="grid grid-cols-[1fr_auto] gap-4 pb-2 px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kategori</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-36 text-right">Beløb / md.</span>
              </div>
              {variable.map(d => (
                <div key={d.key} className="grid grid-cols-[1fr_auto] gap-4 py-3.5 px-1 items-center">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
                      {VARIABLE_ICONS[d.key]}
                    </div>
                    <span className="text-sm font-medium truncate">{d.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input
                      type="number"
                      value={d.value}
                      min={0}
                      onChange={e => updateVariable(d.key, parseInt(e.target.value) || 0)}
                      className="w-28 h-8 text-right font-mono text-sm"
                    />
                    <span className="text-xs text-muted-foreground w-8">kr.</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-muted-foreground">Total</span>
              <span className="text-sm font-bold tabular-nums text-foreground">
                {variableTotal.toLocaleString('da-DK')} kr.
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 pb-8">
          <Button variant="outline" onClick={handleReset} disabled={saving} className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Nulstil til fabriksindstillinger
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="h-4 w-4" />
            {saving ? 'Gemmer…' : 'Gem alle ændringer'}
          </Button>
        </div>

      </div>
    </div>
  );
}
