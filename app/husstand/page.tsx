'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, Baby, UserRound, Pencil, Check, X, Plus, Trash2, Wallet, TrendingUp, Save, Chrome as Home, Wand as Wand2, Building2, KeyRound, CircleHelp as HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/lib/settings-context';
import { formatCurrency } from '@/lib/number-helpers';
import { EditableText } from '@/components/editable-text';
import { HouseholdWizard, type HousingType } from '@/components/household-wizard';
import { IncomeWizard } from '@/components/income-wizard';

interface HouseholdMember {
  id: string;
  name: string;
  type: 'adult' | 'child';
  monthly_net_salary: number | null;
}

interface Household {
  id: string;
  adult_count: number;
  child_count: number;
  members: HouseholdMember[];
  housing_type?: HousingType | null;
  housing_contribution?: number | null;
  household_income?: number | null;
  household_income_is_precise?: boolean;
}

const HOUSING_LABELS: Record<HousingType, { label: string; icon: React.ReactNode; color: string }> = {
  OWNER_HOUSE: { label: 'Ejerbolig', icon: <Home className="h-4 w-4" />, color: 'text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800/40' },
  OWNER_APARTMENT: { label: 'Ejerlejlighed', icon: <Building2 className="h-4 w-4" />, color: 'text-blue-500 bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800/40' },
  COOPERATIVE: { label: 'Andelsbolig', icon: <Building2 className="h-4 w-4" />, color: 'text-teal-600 bg-teal-50 border-teal-100 dark:bg-teal-900/20 dark:border-teal-800/40' },
  RENT: { label: 'Lejebolig', icon: <KeyRound className="h-4 w-4" />, color: 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/40' },
  OTHER: { label: 'Andet', icon: <HelpCircle className="h-4 w-4" />, color: 'text-stone-600 bg-stone-50 border-stone-100 dark:bg-stone-900/20 dark:border-stone-800/40' },
};

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function HusstandPage() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const d = settings.hideDecimals ? 0 : 0;
  const fc = (v: number) => formatCurrency(v, { roundToHundreds: false, decimals: d });

  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSalary, setEditSalary] = useState('');
  const [dirty, setDirty] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showIncomeWizard, setShowIncomeWizard] = useState(false);
  const [editingIncome, setEditingIncome] = useState(false);
  const [tempIncome, setTempIncome] = useState('');

  useEffect(() => {
    if (user) loadHousehold();
  }, [user]);

  async function loadHousehold() {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('household')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        const h = data as Household & { variable_children_birth_years?: (number | null)[]; adult_count: number; child_count: number; housing_type?: HousingType | null; housing_contribution?: number | null };
        const birthYears: number[] = Array.isArray(h.variable_children_birth_years)
          ? (h.variable_children_birth_years as (number | null)[]).filter((y): y is number => typeof y === 'number')
          : [];

        const existingChildren = (h.members ?? []).filter(m => m.type === 'child');
        const existingAdults = (h.members ?? []).filter(m => m.type === 'adult');

        let members = [...existingAdults];

        if (birthYears.length > 0 && existingChildren.length !== birthYears.length) {
          const currentYear = new Date().getFullYear();
          const childMembers: HouseholdMember[] = birthYears.map((year, i) => {
            const age = currentYear - year;
            return existingChildren[i] ?? {
              id: generateId(),
              name: `Barn ${i + 1} (${age} år)`,
              type: 'child' as const,
              monthly_net_salary: null,
            };
          });
          members = [...existingAdults, ...childMembers];
        } else {
          members = h.members ?? existingAdults;
        }

        const adultCount = h.adult_count ?? members.filter(m => m.type === 'adult').length;
        const childCount = birthYears.length > 0 ? birthYears.length : (h.child_count ?? members.filter(m => m.type === 'child').length);

        const synced: Household = {
          ...h,
          adult_count: adultCount,
          child_count: childCount,
          members,
          housing_type: h.housing_type ?? null,
          housing_contribution: h.housing_contribution ?? null,
        };
        setHousehold(synced);

        if (birthYears.length > 0 && existingChildren.length !== birthYears.length) {
          await supabase.from('household').update({
            adult_count: adultCount,
            child_count: childCount,
            members,
            updated_at: new Date().toISOString(),
          }).eq('user_id', user.id);
        }
      } else {
        const defaultHousehold: Household = {
          id: crypto.randomUUID(),
          adult_count: 1,
          child_count: 0,
          members: [
            { id: generateId(), name: 'Voksen 1', type: 'adult', monthly_net_salary: null },
          ],
        };
        setHousehold(defaultHousehold);
        await persistHousehold(defaultHousehold);
      }
    } catch {
      toast.error('Kunne ikke hente husstandsdata');
    } finally {
      setLoading(false);
    }
  }

  async function persistHousehold(h: Household) {
    if (!user) throw new Error('Ikke logget ind');
    const { error } = await supabase
      .from('household')
      .upsert({
        id: h.id,
        user_id: user.id,
        adult_count: h.adult_count,
        child_count: h.child_count,
        members: h.members,
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
  }

  async function handleSave() {
    if (!household) return;
    setSaving(true);
    try {
      await persistHousehold(household);
      setDirty(false);
      toast.success('Husstand gemt');
    } catch {
      toast.error('Kunne ikke gemme');
    } finally {
      setSaving(false);
    }
  }

  function updateHousehold(updater: (h: Household) => Household) {
    setHousehold(prev => {
      if (!prev) return prev;
      const next = updater(prev);
      setDirty(true);
      return next;
    });
  }

  function addAdult() {
    updateHousehold(h => {
      const newMember: HouseholdMember = {
        id: generateId(),
        name: `Voksen ${h.adult_count + 1}`,
        type: 'adult',
        monthly_net_salary: null,
      };
      return {
        ...h,
        adult_count: h.adult_count + 1,
        members: [...h.members, newMember],
      };
    });
  }

  function addChild() {
    updateHousehold(h => {
      const childCount = h.members.filter(m => m.type === 'child').length;
      const newMember: HouseholdMember = {
        id: generateId(),
        name: `Barn ${childCount + 1}`,
        type: 'child',
        monthly_net_salary: null,
      };
      return {
        ...h,
        child_count: h.child_count + 1,
        members: [...h.members, newMember],
      };
    });
  }

  function removeMember(id: string) {
    updateHousehold(h => {
      const member = h.members.find(m => m.id === id);
      if (!member) return h;
      const newMembers = h.members.filter(m => m.id !== id);
      return {
        ...h,
        adult_count: member.type === 'adult' ? h.adult_count - 1 : h.adult_count,
        child_count: member.type === 'child' ? h.child_count - 1 : h.child_count,
        members: newMembers,
      };
    });
    if (editingMemberId === id) setEditingMemberId(null);
  }

  function startEdit(member: HouseholdMember) {
    setEditingMemberId(member.id);
    setEditName(member.name);
    setEditSalary(member.monthly_net_salary != null ? String(member.monthly_net_salary) : '');
  }

  function cancelEdit() {
    setEditingMemberId(null);
  }

  function saveEdit(id: string) {
    const name = editName.trim();
    if (!name) {
      toast.error('Navn må ikke være tomt');
      return;
    }
    const salary = editSalary.trim() === '' ? null : parseFloat(editSalary.replace(',', '.'));
    updateHousehold(h => ({
      ...h,
      members: h.members.map(m =>
        m.id === id ? { ...m, name, monthly_net_salary: salary && !isNaN(salary) ? salary : null } : m
      ),
    }));
    setEditingMemberId(null);
  }

  function startEditIncome() {
    setEditingIncome(true);
    setTempIncome(household?.household_income ? String(household.household_income) : '');
  }

  async function saveIncome() {
    if (!household || !user) return;
    const amount = parseFloat(tempIncome);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Indtast et gyldigt beløb');
      return;
    }

    setSaving(true);
    try {
      await supabase.from('household').update({
        household_income: amount,
        household_income_is_precise: true,
        updated_at: new Date().toISOString(),
      }).eq('id', household.id);

      setHousehold({
        ...household,
        household_income: amount,
        household_income_is_precise: true,
      });
      setEditingIncome(false);
      toast.success('Indkomst opdateret');
    } catch {
      toast.error('Kunne ikke gemme');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  if (!household) return null;

  const adults = household.members.filter(m => m.type === 'adult');
  const children = household.members.filter(m => m.type === 'child');
  const totalNetSalary = adults.reduce((sum, a) => sum + (a.monthly_net_salary ?? 0), 0);
  const totalAnnualSalary = totalNetSalary * 12;
  const adultsWithSalary = adults.filter(a => a.monthly_net_salary != null && a.monthly_net_salary > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-8">
      {showWizard && (
        <HouseholdWizard
          existingHouseholdId={household?.id}
          onComplete={() => { setShowWizard(false); loadHousehold(); }}
          onDismiss={() => setShowWizard(false)}
        />
      )}
      {showIncomeWizard && (
        <IncomeWizard
          onComplete={() => { setShowIncomeWizard(false); loadHousehold(); }}
          onDismiss={() => setShowIncomeWizard(false)}
        />
      )}
      <div className="max-w-3xl mx-auto">

        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
              <Home className="h-9 w-9 text-primary" />
              <EditableText textKey="husstand.page.title" fallback="Husstand" as="span" />
            </h1>
            <p className="text-muted-foreground mt-1 text-base">
              <EditableText textKey="husstand.page.subtitle1" fallback="Din økonomi starter her." as="span" />
            </p>
            <p className="text-muted-foreground text-base">
              <EditableText textKey="husstand.page.subtitle2" fallback="Indtast realistiske tal – resten beregner vi." as="span" />
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowWizard(true)} className="gap-1.5">
              <Wand2 className="h-4 w-4" />
              Opsætningsguide
            </Button>
            {dirty && (
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Gemmer...' : 'Gem ændringer'}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <Card className="shadow-lg border-0 rounded-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
            <CardContent className="pt-5 pb-5 text-center">
              <div className="text-3xl font-bold text-blue-600">{household.adult_count}</div>
              <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">Voksne</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg border-0 rounded-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
            <CardContent className="pt-5 pb-5 text-center">
              <div className="text-3xl font-bold text-amber-600">{household.child_count}</div>
              <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">Børn</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg border-0 rounded-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <CardContent className="pt-5 pb-5 text-center">
              <div className="text-2xl font-bold text-emerald-600 leading-tight">
                {totalNetSalary > 0 ? fc(totalNetSalary) : '—'}
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">Mdl. løn</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg border-0 rounded-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
            <CardContent className="pt-5 pb-5 text-center">
              <div className="text-2xl font-bold text-rose-600 leading-tight">
                {totalAnnualSalary > 0 ? fc(totalAnnualSalary) : '—'}
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">Årl. løn</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">

          {household.housing_type ? (
            (() => {
              const h = HOUSING_LABELS[household.housing_type as HousingType];
              return (
                <Card className={`shadow-lg border rounded-3xl overflow-hidden ${h.color}`}>
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl border flex items-center justify-center ${h.color}`}>
                          {h.icon}
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-0.5">Boligsituation</p>
                          <p className="font-semibold text-sm">{h.label}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowWizard(true)}
                        className="shrink-0 text-xs opacity-60 hover:opacity-100 transition-opacity underline underline-offset-2"
                      >
                        Rediger
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })()
          ) : (
            <button
              onClick={() => setShowWizard(true)}
              className="w-full rounded-3xl border-2 border-dashed border-border hover:border-primary/40 bg-secondary/20 hover:bg-secondary/40 transition-all px-5 py-4 text-left flex items-center gap-3 group"
            >
              <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                <Home className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Angiv boligsituation</p>
                <p className="text-xs text-muted-foreground/60">Ejerbolig, lejebolig, andelsbolig…</p>
              </div>
            </button>
          )}

          {household.household_income && household.household_income > 0 ? (
            <Card className="shadow-lg border rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-10 w-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center shrink-0">
                      <Wallet className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-0.5">Indkomst</p>
                      {editingIncome ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={tempIncome}
                            onChange={(e) => setTempIncome(e.target.value)}
                            className="h-8 text-sm font-semibold max-w-[140px]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveIncome();
                              if (e.key === 'Escape') setEditingIncome(false);
                            }}
                          />
                          <span className="text-xs text-muted-foreground">kr./md.</span>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={saveIncome}>
                            <Check className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingIncome(false)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">
                            {household.household_income_is_precise ? '' : 'ca. '}
                            {fc(household.household_income)} kr./md.
                          </p>
                          {!household.household_income_is_precise && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                              Estimat
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {!editingIncome && (
                    <button
                      onClick={household.household_income_is_precise ? startEditIncome : () => setShowIncomeWizard(true)}
                      className="shrink-0 text-xs text-emerald-700 hover:text-emerald-900 transition-opacity underline underline-offset-2"
                    >
                      {household.household_income_is_precise ? 'Redigér' : 'Indtast præcist'}
                    </button>
                  )}
                </div>
                {!household.household_income_is_precise && !editingIncome && (
                  <div className="mt-3 pt-3 border-t border-emerald-200">
                    <p className="text-xs text-emerald-700">
                      💡 Du bruger et estimat. Indtast et præcist beløb for bedre anbefalinger.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <button
              onClick={() => setShowIncomeWizard(true)}
              className="w-full rounded-3xl border-2 border-dashed border-border hover:border-emerald-400/60 bg-emerald-50/20 hover:bg-emerald-50/40 transition-all px-5 py-4 text-left flex items-center gap-3 group"
            >
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-200 transition-colors">
                <Wallet className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-700 group-hover:text-emerald-800 transition-colors">Angiv husstandsindkomst</p>
                <p className="text-xs text-muted-foreground">Din samlede nettoindkomst efter skat</p>
              </div>
            </button>
          )}

          <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <UserRound className="h-5 w-5 text-blue-500" />
                    Voksne
                    <Badge variant="secondary" className="ml-1">{adults.length}</Badge>
                  </CardTitle>
                  <CardDescription className="mt-1">Navn og månedlig udbetalt løn pr. voksen</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addAdult} className="shrink-0">
                  <Plus className="h-4 w-4 mr-1" />
                  Tilføj voksen
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {adults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Ingen voksne tilføjet endnu</p>
              ) : (
                <div className="space-y-2">
                  {adults.map((member, idx) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      index={idx}
                      isEditing={editingMemberId === member.id}
                      editName={editName}
                      editSalary={editSalary}
                      onStartEdit={() => startEdit(member)}
                      onSaveEdit={() => saveEdit(member.id)}
                      onCancelEdit={cancelEdit}
                      onRemove={() => removeMember(member.id)}
                      onNameChange={setEditName}
                      onSalaryChange={setEditSalary}
                      showSalary
                      fc={fc}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Baby className="h-5 w-5 text-amber-500" />
                    Hjemmeboende børn
                    <Badge variant="secondary" className="ml-1">{children.length}</Badge>
                  </CardTitle>
                  <CardDescription className="mt-1">Børn der bor hjemme</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addChild} className="shrink-0">
                  <Plus className="h-4 w-4 mr-1" />
                  Tilføj barn
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {children.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Ingen børn tilføjet endnu</p>
              ) : (
                <div className="space-y-2">
                  {children.map((member, idx) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      index={idx}
                      isEditing={editingMemberId === member.id}
                      editName={editName}
                      editSalary={editSalary}
                      onStartEdit={() => startEdit(member)}
                      onSaveEdit={() => saveEdit(member.id)}
                      onCancelEdit={cancelEdit}
                      onRemove={() => removeMember(member.id)}
                      onNameChange={setEditName}
                      onSalaryChange={setEditSalary}
                      showSalary={false}
                      fc={fc}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {adultsWithSalary.length > 0 && (
            <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  Lønsammendrag
                </CardTitle>
                <CardDescription>Oversigt over hustandens samlede lønindtægter</CardDescription>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                  Brug netto – det giver det mest præcise billede.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {adultsWithSalary.map((adult) => (
                    <div key={adult.id} className="flex items-center justify-between py-2 px-4 rounded-xl bg-secondary/30">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                          <Wallet className="h-4 w-4 text-emerald-600" />
                        </div>
                        <span className="font-medium text-sm">{adult.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-emerald-600">{fc(adult.monthly_net_salary!)}</p>
                        <p className="text-xs text-muted-foreground">pr. måned</p>
                      </div>
                    </div>
                  ))}

                  <Separator className="my-2" />

                  <div className="flex items-center justify-between py-2 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20">
                    <span className="font-semibold text-sm">Samlet månedlig løn</span>
                    <div className="text-right">
                      <p className="font-bold text-lg text-emerald-600">{fc(totalNetSalary)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2 px-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/10">
                    <span className="font-semibold text-sm">Samlet årlig løn</span>
                    <div className="text-right">
                      <p className="font-bold text-lg text-emerald-700">{fc(totalAnnualSalary)}</p>
                    </div>
                  </div>

                  <div className="mt-2 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-700/50 px-4 py-3">
                    <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-1">Nuvio bemærker</p>
                    {adults.length > 1 ? (
                      <p className="text-xs text-stone-600 dark:text-stone-300 leading-snug">
                        {adults.length === 2
                          ? 'Med to indkomster er din plan mere robust overfor uforudsete ændringer.'
                          : 'Flere indkomster giver en stærkere buffer mod uforudsete ændringer.'}
                        {' '}Overvej at opbygge en buffer på 2–3 måneders faste udgifter som sikkerhedsnet.
                      </p>
                    ) : (
                      <p className="text-xs text-stone-600 dark:text-stone-300 leading-snug">
                        Med én indkomst er planen følsom overfor indkomstudsving. Vi anbefaler en buffer på minimum 3 måneders faste udgifter som sikkerhedsnet.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {dirty && (
          <div className="mt-8 flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="lg" className="shadow-lg">
              <Save className="mr-2 h-5 w-5" />
              {saving ? 'Gemmer...' : 'Gem ændringer'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface MemberRowProps {
  member: HouseholdMember;
  index: number;
  isEditing: boolean;
  editName: string;
  editSalary: string;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRemove: () => void;
  onNameChange: (v: string) => void;
  onSalaryChange: (v: string) => void;
  showSalary: boolean;
  fc: (v: number) => string;
}

function MemberRow({
  member,
  isEditing,
  editName,
  editSalary,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRemove,
  onNameChange,
  onSalaryChange,
  showSalary,
  fc,
}: MemberRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-secondary/20 hover:bg-secondary/40 transition-colors group">
      <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
        {member.type === 'adult'
          ? <UserRound className="h-4 w-4 text-blue-500" />
          : <Baby className="h-4 w-4 text-amber-500" />}
      </div>

      {isEditing ? (
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          <Input
            value={editName}
            onChange={e => onNameChange(e.target.value)}
            placeholder="Navn"
            className="h-8 flex-1 min-w-[120px] text-sm"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') onSaveEdit();
              if (e.key === 'Escape') onCancelEdit();
            }}
          />
          {showSalary && (
            <div className="flex items-center gap-1.5 min-w-[160px]">
              <Input
                value={editSalary}
                onChange={e => onSalaryChange(e.target.value)}
                placeholder="Udbetalt løn / md."
                type="number"
                className="h-8 text-sm"
                onKeyDown={e => {
                  if (e.key === 'Enter') onSaveEdit();
                  if (e.key === 'Escape') onCancelEdit();
                }}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">kr.</span>
            </div>
          )}
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={onSaveEdit}>
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onCancelEdit}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{member.name}</p>
            {showSalary && (
              <p className="text-xs text-muted-foreground">
                {member.monthly_net_salary != null && member.monthly_net_salary > 0
                  ? <span className="text-emerald-600 font-medium">{fc(member.monthly_net_salary)} / md.</span>
                  : <span>Ingen løn registreret</span>}
              </p>
            )}
          </div>
          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onStartEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950" onClick={onRemove}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
