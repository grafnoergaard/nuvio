'use client';

import { useState, useEffect } from 'react';
import { useAdminLabel } from '@/components/admin-page-label';
import { Input } from '@/components/ui/input';
import { ArrowRight, Check, UserRound, Baby, Plus, Trash2, Chrome as Home, MapPin, Users, Building2, KeyRound, CircleHelp as HelpCircle } from 'lucide-react';
import { WizardShell, useWizardAnimation } from '@/components/wizard-shell';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/number-helpers';
import { useAiContext } from '@/lib/ai-context';

export type HousingType = 'OWNER_HOUSE' | 'OWNER_APARTMENT' | 'COOPERATIVE' | 'RENT' | 'OTHER';

interface HousingOption {
  value: HousingType;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}

const HOUSING_OPTIONS: HousingOption[] = [
  { value: 'OWNER_HOUSE',     label: 'Ejerbolig',     sublabel: 'Parcelhus eller villa du ejer',        icon: <Home className="h-5 w-5" /> },
  { value: 'OWNER_APARTMENT', label: 'Ejerlejlighed', sublabel: 'Ejerlejlighed med ejerforening',       icon: <Building2 className="h-5 w-5" /> },
  { value: 'COOPERATIVE',     label: 'Andelsbolig',   sublabel: 'Andelslejlighed med boligafgift',      icon: <Building2 className="h-5 w-5" /> },
  { value: 'RENT',            label: 'Lejebolig',     sublabel: 'Lejlighed eller hus til leje',         icon: <KeyRound className="h-5 w-5" /> },
  { value: 'OTHER',           label: 'Andet',         sublabel: 'Kollegium, midlertidig bolig m.m.',    icon: <HelpCircle className="h-5 w-5" /> },
];

interface HouseholdMember {
  id: string;
  name: string;
  type: 'adult' | 'child';
  monthly_net_salary: number | null;
  birth_year?: number | null;
}

interface WizardData {
  adults: HouseholdMember[];
  children: HouseholdMember[];
  postalCode: string;
  housingType: HousingType | null;
}

interface Props {
  existingHouseholdId?: string;
  onComplete: () => void;
  onDismiss: () => void;
}

const TOTAL_STEPS = 5;
const STEP_LABELS = ['Voksne', 'Bolig', 'Børn', 'Postnummer', 'Opsummering'];
const STEP_GRADIENTS = [
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 40%, #ffffff 100%)',
  'linear-gradient(160deg, #eff6ff 0%, #ecfdf5 40%, #ffffff 100%)',
  'linear-gradient(160deg, #fffbeb 0%, #fef3c7 30%, #ffffff 100%)',
  'linear-gradient(160deg, #ecfdf5 0%, #f0fdfa 40%, #ffffff 100%)',
  'linear-gradient(160deg, #f0fdfa 0%, #ecfdf5 40%, #ffffff 100%)',
];

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function HouseholdWizard({ existingHouseholdId, onComplete, onDismiss }: Props) {
  const { setWizard } = useAdminLabel();
  const { setWizardActive } = useAiContext();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);
  const { animating, direction, animate } = useWizardAnimation();

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setWizardActive(true);
    return () => setWizardActive(false);
  }, [setWizardActive]);

  useEffect(() => {
    setWizard({ name: 'Husstand', step: step + 1, totalSteps: TOTAL_STEPS, stepLabel: STEP_LABELS[step] });
    return () => setWizard(null);
  }, [step]);

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

  const [data, setData] = useState<WizardData>({
    adults: [{ id: genId(), name: 'Voksen 1', type: 'adult', monthly_net_salary: null }],
    children: [],
    postalCode: '',
    housingType: null,
  });

  function next() { animate('forward', () => setStep(s => s + 1)); }
  function back() { animate('back', () => setStep(s => s - 1)); }

  function updateAdult(id: string, field: 'name' | 'monthly_net_salary', value: string | number | null) {
    setData(d => ({
      ...d,
      adults: d.adults.map(a => a.id === id ? { ...a, [field]: value } : a),
    }));
  }

  function addAdult() {
    setData(d => ({
      ...d,
      adults: [...d.adults, { id: genId(), name: `Voksen ${d.adults.length + 1}`, type: 'adult', monthly_net_salary: null }],
    }));
  }

  function removeAdult(id: string) {
    setData(d => ({ ...d, adults: d.adults.filter(a => a.id !== id) }));
  }

  function addChild() {
    setData(d => ({
      ...d,
      children: [...d.children, { id: genId(), name: `Barn ${d.children.length + 1}`, type: 'child', monthly_net_salary: null, birth_year: null }],
    }));
  }

  function updateChildName(id: string, name: string) {
    setData(d => ({ ...d, children: d.children.map(c => c.id === id ? { ...c, name } : c) }));
  }

  function updateChildBirthYear(id: string, year: number | null) {
    setData(d => ({ ...d, children: d.children.map(c => c.id === id ? { ...c, birth_year: year } : c) }));
  }

  function removeChild(id: string) {
    setData(d => ({ ...d, children: d.children.filter(c => c.id !== id) }));
  }

  const totalIncome = data.adults.reduce((s, a) => s + (a.monthly_net_salary ?? 0), 0);
  const selectedHousingOption = HOUSING_OPTIONS.find(o => o.value === data.housingType);
  const isStep3Valid = data.postalCode.trim() === '' || /^\d{4}$/.test(data.postalCode.trim());

  async function handleSave() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Ikke logget ind');

      const allMembers: HouseholdMember[] = [...data.adults, ...data.children];
      const hid = existingHouseholdId ?? crypto.randomUUID();
      const birthYears = data.children.map(c => c.birth_year ?? null);

      const { error } = await supabase
        .from('household')
        .upsert({
          id: hid,
          user_id: user.id,
          adult_count: data.adults.length,
          child_count: data.children.length,
          members: allMembers,
          variable_postal_code: data.postalCode.trim() || null,
          variable_children_birth_years: birthYears.length > 0 ? birthYears : null,
          housing_type: data.housingType,
          housing_contribution: null,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success('Husstand gemt');
      onComplete();
    } catch {
      toast.error('Kunne ikke gemme. Prøv igen.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <WizardShell
      gradient={STEP_GRADIENTS[Math.min(step, STEP_GRADIENTS.length - 1)]}
      visible={visible}
      step={step}
      totalSteps={TOTAL_STEPS}
      showBack={step > 0}
      showClose={true}
      onBack={back}
      onClose={onDismiss}
      animating={animating}
      direction={direction}
    >

            {step === 0 && (
              <div className="flex flex-col flex-1">
                <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70 mb-4">
                  Husstand
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-3">
                  Hvem bor i husstanden?
                </h2>
                <p className="text-foreground/60 text-base leading-relaxed mb-6">
                  Tilføj de voksne og angiv deres månedlige nettoløn efter skat.
                </p>

                <div className="space-y-2">
                  {data.adults.map((adult) => (
                    <div key={adult.id} className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-white/60 px-4 py-3">
                      <div className="shrink-0 h-9 w-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Input
                          value={adult.name}
                          onChange={e => updateAdult(adult.id, 'name', e.target.value)}
                          className="h-7 text-sm font-medium border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder="Navn"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Input
                          type="number"
                          value={adult.monthly_net_salary ?? ''}
                          onChange={e => {
                            const v = e.target.value === '' ? null : parseInt(e.target.value) || 0;
                            updateAdult(adult.id, 'monthly_net_salary', v);
                          }}
                          className="w-28 h-8 text-right text-sm rounded-xl bg-white/80"
                          placeholder="0"
                        />
                        <span className="text-xs text-muted-foreground">kr/md</span>
                        {data.adults.length > 1 && (
                          <button
                            onClick={() => removeAdult(adult.id)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addAdult}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2.5 rounded-2xl border-2 border-dashed border-foreground/10 hover:border-emerald-400/60 mt-2"
                >
                  <Plus className="h-4 w-4" />
                  Tilføj voksen
                </button>

                {totalIncome > 0 && (
                  <div className="rounded-2xl bg-white/50 border border-foreground/8 px-5 py-3 flex items-center justify-between mt-4">
                    <span className="text-sm font-medium text-muted-foreground">Samlet månedlig løn</span>
                    <span className="text-lg font-bold text-emerald-600">{formatCurrency(totalIncome, { decimals: 0 })}</span>
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col flex-1">
                <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70 mb-4">
                  Boligsituation
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-3">
                  Hvad er din boligsituation?
                </h2>
                <p className="text-foreground/60 text-base leading-relaxed mb-6">
                  Boligtype bestemmer om vi medregner husleje, vedligehold og ejendomsskat.
                </p>

                <div className="space-y-2 flex-1">
                  {HOUSING_OPTIONS.map(option => {
                    const isSelected = data.housingType === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setData(d => ({ ...d, housingType: option.value }))}
                        className={`w-full flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/50'
                            : 'border-foreground/12 bg-white/50 hover:border-foreground/25'
                        }`}
                      >
                        <div className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-emerald-100 text-emerald-600' : 'bg-white/60 text-muted-foreground'
                        }`}>
                          {option.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{option.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{option.sublabel}</p>
                        </div>
                        {isSelected && (
                          <div className="shrink-0 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col flex-1">
                <p className="text-label font-semibold uppercase tracking-widest text-amber-600/70 mb-4">
                  Børn
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-3">
                  Har du hjemmeboende børn?
                </h2>
                <p className="text-foreground/60 text-base leading-relaxed mb-6">
                  Det bruges til at beregne variable udgifter.
                </p>

                {data.children.length > 0 ? (
                  <div className="space-y-2">
                    {data.children.map((child) => {
                      const currentYear = new Date().getFullYear();
                      const age = child.birth_year ? currentYear - child.birth_year : null;
                      return (
                        <div key={child.id} className="rounded-2xl border border-foreground/10 bg-white/60 px-4 py-3 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="shrink-0 h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                              <Baby className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Input
                                value={child.name}
                                onChange={e => updateChildName(child.id, e.target.value)}
                                className="h-7 text-sm font-medium border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                placeholder="Navn"
                              />
                            </div>
                            <button
                              onClick={() => removeChild(child.id)}
                              className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 pl-12">
                            <Input
                              type="number"
                              value={child.birth_year ?? ''}
                              onChange={e => {
                                const v = e.target.value === '' ? null : parseInt(e.target.value) || null;
                                updateChildBirthYear(child.id, v);
                              }}
                              className="w-28 h-8 text-sm font-mono rounded-xl bg-white/80"
                              placeholder="Fødselsår"
                              min={new Date().getFullYear() - 25}
                              max={new Date().getFullYear()}
                            />
                            {age !== null && age >= 0 && age <= 25 && (
                              <span className="text-xs text-muted-foreground">{age} år</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-dashed border-foreground/10 bg-white/30 px-5 py-8 text-center">
                    <Baby className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Ingen børn tilføjet endnu</p>
                  </div>
                )}

                <button
                  onClick={addChild}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2.5 rounded-2xl border-2 border-dashed border-foreground/10 hover:border-amber-400/60 mt-2"
                >
                  <Plus className="h-4 w-4" />
                  Tilføj barn
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col flex-1">
                <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70 mb-4">
                  Postnummer
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-3">
                  Hvor bor du?
                </h2>
                <p className="text-foreground/60 text-base leading-relaxed mb-6">
                  Dit postnummer bruges til at justere estimater for variable udgifter baseret på dit lokalområde.
                </p>

                <div className="space-y-2">
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                    <Input
                      value={data.postalCode}
                      onChange={e => setData(d => ({ ...d, postalCode: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      className="h-14 pl-11 text-2xl font-mono rounded-2xl tracking-widest bg-white/60 border-foreground/10"
                      placeholder="2100"
                      maxLength={4}
                      inputMode="numeric"
                    />
                  </div>
                  {data.postalCode.trim().length > 0 && !/^\d{4}$/.test(data.postalCode.trim()) && (
                    <p className="text-sm text-rose-500 pl-1">Angiv et gyldigt 4-cifret postnummer</p>
                  )}
                  {data.postalCode.trim() === '' && (
                    <p className="text-xs text-muted-foreground pl-1">Du kan springe dette over – det kan udfyldes senere.</p>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="flex flex-col flex-1">
                <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70 mb-4">
                  Opsummering
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-3">
                  Ser det rigtigt ud?
                </h2>
                <p className="text-foreground/60 text-base leading-relaxed mb-6">
                  Her er din husstand — gem når det ser korrekt ud.
                </p>

                <div className="rounded-2xl border border-foreground/10 bg-white/60 overflow-hidden flex-1">
                  <div className="px-5 py-4 border-b border-foreground/8">
                    <div className="flex items-center gap-2 mb-3">
                      <UserRound className="h-4 w-4 text-sky-500" />
                      <span className="text-sm font-semibold">Voksne ({data.adults.length})</span>
                    </div>
                    <div className="space-y-2">
                      {data.adults.map(adult => (
                        <div key={adult.id} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{adult.name}</span>
                          <span className={adult.monthly_net_salary ? 'font-medium text-emerald-600' : 'text-muted-foreground/50'}>
                            {adult.monthly_net_salary
                              ? `${formatCurrency(adult.monthly_net_salary, { decimals: 0 })} / md.`
                              : 'Ingen løn'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="px-5 py-4 border-b border-foreground/8">
                    <div className="flex items-center gap-2 mb-2">
                      <Home className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">Boligsituation</span>
                    </div>
                    {selectedHousingOption ? (
                      <p className="text-sm text-muted-foreground">{selectedHousingOption.label} — {selectedHousingOption.sublabel}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground/50">Ikke angivet</p>
                    )}
                  </div>

                  {data.children.length > 0 && (
                    <div className="px-5 py-4 border-b border-foreground/8">
                      <div className="flex items-center gap-2 mb-3">
                        <Baby className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-semibold">Børn ({data.children.length})</span>
                      </div>
                      <div className="space-y-1.5">
                        {data.children.map(child => {
                          const age = child.birth_year ? new Date().getFullYear() - child.birth_year : null;
                          return (
                            <div key={child.id} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{child.name}</span>
                              <span className="text-muted-foreground/70 text-xs">
                                {child.birth_year
                                  ? `f. ${child.birth_year}${age !== null ? ` (${age} år)` : ''}`
                                  : 'Fødselsår ikke angivet'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Postnummer</span>
                      </div>
                      <span className={data.postalCode ? 'font-medium' : 'text-muted-foreground/50'}>
                        {data.postalCode || 'Ikke angivet'}
                      </span>
                    </div>
                  </div>
                </div>

                {totalIncome > 0 && (
                  <div className="rounded-2xl bg-emerald-50/60 border border-emerald-100 px-5 py-4 flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-700">Samlet månedlig løn</span>
                    </div>
                    <span className="text-lg font-bold text-emerald-600">{formatCurrency(totalIncome, { decimals: 0 })}</span>
                  </div>
                )}
              </div>
            )}
          <div className="pt-6">
            {step === 0 && (
              <button
                onClick={next}
                disabled={data.adults.length === 0}
                className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                Fortsæt
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {step === 1 && (
              <>
                <button
                  onClick={next}
                  disabled={data.housingType === null}
                  className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
                >
                  Fortsæt
                  <ArrowRight className="h-4 w-4" />
                </button>
                {data.housingType === null && (
                  <button
                    onClick={next}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 mt-2"
                  >
                    Spring over – udfyld senere
                  </button>
                )}
              </>
            )}
            {step === 2 && (
              <button
                onClick={next}
                className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                {data.children.length === 0 ? 'Ingen børn – fortsæt' : 'Fortsæt'}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {step === 3 && (
              <button
                onClick={next}
                disabled={!isStep3Valid}
                className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                {data.postalCode.trim() === '' ? 'Spring over' : 'Fortsæt'}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {step === 4 && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-14 rounded-2xl font-semibold text-base text-white shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
              >
                {saving ? 'Gemmer…' : (
                  <>
                    <Check className="h-4 w-4" />
                    Gem husstand
                  </>
                )}
              </button>
            )}
          </div>
    </WizardShell>
  );
}
