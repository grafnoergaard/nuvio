'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Database, RefreshCw, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, ChevronDown, ChevronRight, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/number-helpers';
import type { SdsVersion, SdsEntry } from '@/lib/standard-data-service';
import { isFlowColorKey, isFlowBadgeColorKey, isFlowCardColorKey, FlowColorSwatch, BadgeColorEditor, CardColorEditor } from '@/components/flow-color-editor';

const SECTION_LABELS: Record<string, string> = {
  RAADIGHED: 'Rådighedsbeløb (Gældsstyrelsen)',
  BIL: 'Bilbudget (FDM)',
  FASTE_UDGIFTER: 'Faste udgifter',
  BEREGNING: 'Beregningssatser (variabelt forbrug)',
  nuvio_flow: 'Nuvio Flow — statustærskler og tekster',
  OEVRIGE_FASTE_UDGIFTER: 'Øvrige faste udgifter (multiplikatorer)',
  VARIABELT_FORBRUG: 'Variabelt forbrug — kategoridefaults',
};

const FLOW_TIER_LABELS: { prefix: string; min: number; max: number; color: string }[] = [
  { prefix: '1. Over budget',  min: 100, max: 199, color: 'text-red-600 bg-red-50 border-red-200' },
  { prefix: '2. Stram op',     min: 200, max: 299, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { prefix: '3. Hold kursen',  min: 300, max: 399, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { prefix: '4. Godt tempo',   min: 400, max: 499, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { prefix: '5. Nuvio Flow',   min: 500, max: 599, color: 'text-yellow-700 bg-yellow-50 border-yellow-300' },
];

function getFlowTierLabel(sortOrder: number) {
  return FLOW_TIER_LABELS.find(t => sortOrder >= t.min && sortOrder <= t.max) ?? null;
}

const SECTION_ORDER = ['RAADIGHED', 'BIL', 'FASTE_UDGIFTER', 'BEREGNING', 'nuvio_flow', 'OEVRIGE_FASTE_UDGIFTER', 'VARIABELT_FORBRUG'];

export default function StandardDataAdminPage() {
  const [versions, setVersions] = useState<SdsVersion[]>([]);
  const [entries, setEntries] = useState<SdsEntry[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['nuvio_flow']));
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadVersions();
  }, []);

  useEffect(() => {
    if (selectedVersionId) loadEntries(selectedVersionId);
  }, [selectedVersionId]);

  async function loadVersions() {
    setLoading(true);
    const { data } = await supabase
      .from('standard_data_versions')
      .select('*')
      .order('valid_from', { ascending: false });
    if (data) {
      setVersions(data as SdsVersion[]);
      const active = (data as SdsVersion[]).find(v => v.is_active);
      if (active) setSelectedVersionId(active.id);
      else if (data.length > 0) setSelectedVersionId(data[0].id);
    }
    setLoading(false);
  }

  async function loadEntries(versionId: string) {
    const { data } = await supabase
      .from('standard_data_entries')
      .select('*')
      .eq('version_id', versionId)
      .order('section')
      .order('sort_order')
      .order('key');
    if (data) setEntries(data as SdsEntry[]);
  }

  function startEdit(entry: SdsEntry) {
    setEditingEntryId(entry.id);
    setEditValue(entry.value_numeric !== null ? String(entry.value_numeric) : (entry.value_text ?? ''));
  }

  async function saveColorEdit(entry: SdsEntry, newValue: string) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('standard_data_entries')
        .update({ value_text: newValue })
        .eq('id', entry.id);
      if (error) throw error;
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, value_text: newValue } : e));
      setEditingEntryId(null);
      toast.success('Farve gemt');
    } catch {
      toast.error('Kunne ikke gemme farve');
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditingEntryId(null);
    setEditValue('');
  }

  async function saveEdit(entry: SdsEntry) {
    setSaving(true);
    try {
      const isNumeric = entry.value_numeric !== null;
      const update = isNumeric
        ? { value_numeric: parseFloat(editValue) || 0 }
        : { value_text: editValue };

      const { error } = await supabase
        .from('standard_data_entries')
        .update(update)
        .eq('id', entry.id);

      if (error) throw error;

      setEntries(prev => prev.map(e =>
        e.id === entry.id ? { ...e, ...update } : e
      ));
      setEditingEntryId(null);
      toast.success('Værdi gemt');
    } catch {
      toast.error('Kunne ikke gemme');
    } finally {
      setSaving(false);
    }
  }

  async function setActiveVersion(versionId: string) {
    setSaving(true);
    try {
      await supabase.from('standard_data_versions').update({ is_active: false }).neq('id', versionId);
      const { error } = await supabase.from('standard_data_versions').update({ is_active: true }).eq('id', versionId);
      if (error) throw error;
      setVersions(prev => prev.map(v => ({ ...v, is_active: v.id === versionId })));
      toast.success('Aktiv version opdateret');
    } catch {
      toast.error('Kunne ikke opdatere version');
    } finally {
      setSaving(false);
    }
  }

  function toggleSection(section: string) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  const selectedVersion = versions.find(v => v.id === selectedVersionId);
  const sections = SECTION_ORDER.filter(s => entries.some(e => e.section === s));
  const otherSections = Array.from(new Set(entries.map(e => e.section))).filter(s => !SECTION_ORDER.includes(s));
  const allSections = [...sections, ...otherSections];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-sm">Indlæser...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            StandardDataService
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Benchmark-data til Nuvio Score — baseret på Gældsstyrelsen, FDM og Energistyrelsen
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadVersions} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Opdater
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {versions.map(v => (
          <button
            key={v.id}
            onClick={() => setSelectedVersionId(v.id)}
            className={`rounded-2xl border-2 px-4 py-3 text-left transition-all ${
              v.id === selectedVersionId
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40 bg-card'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm font-mono">{v.version}</span>
              {v.is_active ? (
                <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Aktiv
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">Inaktiv</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{v.valid_from} – {v.valid_to}</p>
            {!v.is_active && v.id === selectedVersionId && (
              <button
                onClick={e => { e.stopPropagation(); setActiveVersion(v.id); }}
                className="mt-2 text-xs text-primary underline underline-offset-2 hover:opacity-80"
              >
                Sæt som aktiv
              </button>
            )}
          </button>
        ))}
      </div>

      {selectedVersion && (
        <Card className="border-0 shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Version {selectedVersion.version}</CardTitle>
                <CardDescription className="mt-0.5">
                  Gyldig: {selectedVersion.valid_from} → {selectedVersion.valid_to} · {selectedVersion.currency} · {selectedVersion.locale}
                </CardDescription>
              </div>
              {selectedVersion.is_active && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Aktiv version
                </Badge>
              )}
            </div>
            {selectedVersion.notes && (
              <p className="text-xs text-muted-foreground mt-2 bg-secondary/40 rounded-lg px-3 py-2">
                {selectedVersion.notes}
              </p>
            )}
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {allSections.map(section => {
                const sectionEntries = entries.filter(e => e.section === section);
                const isExpanded = expandedSections.has(section);
                return (
                  <div key={section} className="rounded-2xl border border-border overflow-hidden">
                    <button
                      onClick={() => toggleSection(section)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <span className="font-semibold text-sm">
                          {SECTION_LABELS[section] ?? section}
                        </span>
                        <span className="text-xs text-muted-foreground">({sectionEntries.length} værdier)</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="divide-y divide-border">
                        {sectionEntries.map((entry, idx) => {
                          const isEditing = editingEntryId === entry.id;
                          const sortOrder = entry.sort_order ?? 0;
                          const tierLabel = section === 'nuvio_flow' ? getFlowTierLabel(sortOrder) : null;
                          const prevEntry = sectionEntries[idx - 1];
                          const prevTierLabel = section === 'nuvio_flow' && prevEntry
                            ? getFlowTierLabel(prevEntry.sort_order ?? 0)
                            : null;
                          const showTierHeader = tierLabel && (!prevTierLabel || prevTierLabel.prefix !== tierLabel.prefix);
                          const isJsonField = entry.value_text !== null && entry.value_text.startsWith('[');
                          const displayValue = entry.value_numeric !== null
                            ? (entry.unit?.includes('DKK') ? formatCurrency(entry.value_numeric, { decimals: 0 }) : String(entry.value_numeric))
                            : isJsonField
                              ? `JSON (${(() => { try { return JSON.parse(entry.value_text!).length; } catch { return '?'; } })()} regler)`
                              : (entry.value_text ?? '—');

                          const isColorKey = isFlowColorKey(entry.key);

                          return (
                            <div key={entry.id}>
                            {showTierHeader && (
                              <div className={`px-4 py-2 flex items-center gap-2 border-b ${tierLabel.color} border-t first:border-t-0`}>
                                <span className="text-xs font-semibold uppercase tracking-wide">{tierLabel.prefix}</span>
                              </div>
                            )}
                            <div className={cn(
                              'px-4 py-3 group hover:bg-secondary/10',
                              isColorKey && isEditing ? 'flex flex-col gap-3' : 'flex items-start gap-3'
                            )}>
                              <div className="flex items-start justify-between gap-3 w-full">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-mono text-muted-foreground/70 bg-secondary/60 rounded px-1.5 py-0.5">
                                      {entry.key}
                                    </span>
                                    {entry.requires_admin_value && (
                                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        Kræver admin
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm font-medium mt-1">{entry.label}</p>
                                  {entry.notes && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{entry.notes}</p>
                                  )}
                                </div>

                                <div className="shrink-0 flex items-center gap-2">
                                  {isColorKey ? (
                                    !isEditing ? (
                                      <>
                                        <FlowColorSwatch entryKey={entry.key} value={entry.value_text ?? ''} />
                                        <Button
                                          size="sm" variant="ghost"
                                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                          onClick={() => startEdit(entry)}
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                      </>
                                    ) : null
                                  ) : isEditing ? (
                                    <>
                                      <Input
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        className="w-32 h-8 text-right text-sm rounded-xl"
                                        autoFocus
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') saveEdit(entry);
                                          if (e.key === 'Escape') cancelEdit();
                                        }}
                                      />
                                      {entry.unit && <span className="text-xs text-muted-foreground">{entry.unit.split('/')[0]}</span>}
                                      <Button
                                        size="sm" variant="ghost"
                                        className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                        onClick={() => saveEdit(entry)}
                                        disabled={saving}
                                      >
                                        <Save className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="sm" variant="ghost"
                                        className="h-8 w-8 p-0"
                                        onClick={cancelEdit}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <div className="text-right">
                                        <span className="font-semibold text-sm tabular-nums">{displayValue}</span>
                                        {entry.unit && (
                                          <p className="text-xs text-muted-foreground">{entry.unit}</p>
                                        )}
                                      </div>
                                      <Button
                                        size="sm" variant="ghost"
                                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => startEdit(entry)}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {isColorKey && isEditing && (
                                isFlowBadgeColorKey(entry.key) ? (
                                  <BadgeColorEditor
                                    value={entry.value_text ?? ''}
                                    onSave={v => saveColorEdit(entry, v)}
                                    onCancel={cancelEdit}
                                    saving={saving}
                                  />
                                ) : isFlowCardColorKey(entry.key) ? (
                                  <CardColorEditor
                                    value={entry.value_text ?? ''}
                                    onSave={v => saveColorEdit(entry, v)}
                                    onCancel={cancelEdit}
                                    saving={saving}
                                  />
                                ) : null
                              )}
                            </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border border-amber-200/60 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-800/30 rounded-2xl shadow-none">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">MISSING_KEY_POLICY: HARD_FAIL</p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/70 leading-relaxed">
                Nuvio bruger altid den nyeste ACTIVE version der dækker dagens dato.
                Hvis en nøgle mangler falder systemet tilbage til hardcodede standardværdier.
                Fremtidige versioner kan oprettes ved at indsætte nye rækker og markere dem aktive.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
