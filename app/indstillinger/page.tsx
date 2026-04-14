'use client';

import { useState, useEffect, useRef } from 'react';
import { useSettings } from '@/lib/settings-context';
import { useAuth } from '@/lib/auth-context';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw, CalendarDays, LayoutDashboard, LogOut, Settings, TriangleAlert, ChevronUp, ChevronDown, Eye, EyeOff, Save, Info, X } from 'lucide-react';
import { toast } from 'sonner';
import { EditableText } from '@/components/editable-text';
import UserDataResetWizard from '@/components/user-data-reset-wizard';
import {
  fetchUserHomeCardConfig,
  upsertUserHomeCardConfig,
  buildUserCardDefaults,
  USER_CARD_LABELS,
  USER_CARD_DESCRIPTIONS,
  type UserHomeCardConfig,
} from '@/lib/home-card-config';
import { getUserWeekStartDay, setUserWeekStartDay } from '@/lib/quick-expense-service';
import { DEFAULT_MOBILE_NAV_OPTIONS, getMobileNavSlots } from '@/lib/nav-config';
import { DEFAULT_START_SCREEN_HREF, getStartScreenHref, setStartScreenHref as saveStartScreenHref } from '@/lib/start-screen';
import { VERSION } from '@/lib/version';

type StartScreenOption = {
  position: number;
  href: string;
  label: string;
};

export default function IndstillingerPage() {
  const { settings, updateSetting, resetSettings } = useSettings();
  const { user, signOut } = useAuth();
  const [weekStartDay, setWeekStartDayState] = useState<number>(1);
  const [savingWeekStartDay, setSavingWeekStartDay] = useState(false);
  const [cardConfigs, setCardConfigs] = useState<UserHomeCardConfig[]>([]);
  const [cardConfigsDirty, setCardConfigsDirty] = useState(false);
  const [savingCards, setSavingCards] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [startScreenHref, setStartScreenHrefState] = useState(DEFAULT_START_SCREEN_HREF);
  const [startScreenOptions, setStartScreenOptions] = useState<StartScreenOption[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const DANISH_MONTHS_FULL = [
    'januar', 'februar', 'marts', 'april', 'maj', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'december',
  ];

  useEffect(() => {
    Promise.all([
      fetchUserHomeCardConfig().then(data => {
        if (data.length === 0) {
          setCardConfigs(buildUserCardDefaults());
        } else {
          const defaults = buildUserCardDefaults();
          const merged = defaults.map(def => {
            const saved = data.find(d => d.card_key === def.card_key);
            return saved ?? def;
          });
          merged.sort((a, b) => a.sort_order - b.sort_order);
          setCardConfigs(merged);
        }
      }),
      getUserWeekStartDay().then(day => {
        setWeekStartDayState(day);
      }),
      getMobileNavSlots().then(slots => {
        const options = slots
          .filter(slot => !slot.is_burger && slot.nav_item?.href)
          .slice(0, 4)
          .map(slot => ({
            position: slot.position,
            href: slot.nav_item!.href,
            label: slot.nav_item!.name,
          }));
        const fallbackOptions = DEFAULT_MOBILE_NAV_OPTIONS
          .filter(option => !option.isBurger && option.href)
          .slice(0, 4)
          .map((option, index) => ({
            position: index + 1,
            href: option.href,
            label: option.label,
          }));
        const resolvedOptions = options.length > 0 ? options : fallbackOptions;
        const savedHref = getStartScreenHref();
        setStartScreenOptions(resolvedOptions);
        const resolvedHref = resolvedOptions.some(option => option.href === savedHref)
          ? savedHref
          : (resolvedOptions[0]?.href ?? DEFAULT_START_SCREEN_HREF);
        setStartScreenHrefState(resolvedHref);
        if (resolvedHref !== savedHref) saveStartScreenHref(resolvedHref);
      }),
    ]).catch(() => null);
  }, []);


  function moveCard(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= cardConfigs.length) return;
    const updated = [...cardConfigs];
    [updated[index], updated[next]] = [updated[next], updated[index]];
    updated.forEach((c, i) => { c.sort_order = (i + 1) * 10; });
    setCardConfigs(updated);
    setCardConfigsDirty(true);
  }

  function toggleCardVisibility(index: number) {
    const updated = [...cardConfigs];
    updated[index] = { ...updated[index], is_visible: !updated[index].is_visible };
    setCardConfigs(updated);
    setCardConfigsDirty(true);
  }

  async function handleSaveCards() {
    setSavingCards(true);
    try {
      await upsertUserHomeCardConfig(
        cardConfigs.map(c => ({ card_key: c.card_key, is_visible: c.is_visible, sort_order: c.sort_order }))
      );
      toast.success('Oversigt-layout gemt');
      setCardConfigsDirty(false);
    } catch {
      toast.error('Kunne ikke gemme layout');
    } finally {
      setSavingCards(false);
    }
  }

  async function handleWeekStartDayChange(value: string) {
    const day = parseInt(value);
    setSavingWeekStartDay(true);
    try {
      await setUserWeekStartDay(day);
      setWeekStartDayState(day);
      toast.success('Ugestart gemt');
    } catch {
      toast.error('Kunne ikke gemme indstillingen');
    } finally {
      setSavingWeekStartDay(false);
    }
  }

  function handleReset() {
    resetSettings();
    toast.success('Indstillinger nulstillet');
  }

  function handleStartScreenChange(href: string) {
    saveStartScreenHref(href);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('nuvio_initial_redirect_done');
      window.sessionStorage.removeItem('nuvio_visited_root');
    }
    setStartScreenHrefState(href);
    const option = startScreenOptions.find(item => item.href === href);
    toast.success(`${option?.label ?? 'Startskærm'} valgt som startskærm`);
  }

  return (
    <div
      ref={scrollRef}
      className="min-h-screen bg-gradient-to-b from-[#f5f4f1] via-[#f8f7f4] to-white"
    >
      <div
        className="max-w-lg mx-auto px-4 pb-32 sm:pb-16 space-y-6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}
      >
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1">
              {DANISH_MONTHS_FULL[now.getMonth()]} {now.getFullYear()}
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              <EditableText textKey="indstillinger.page.title" fallback="Indstillinger" as="span" />
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-semibold text-foreground/30 tracking-wide tabular-nums">
              {VERSION}
            </span>
            <button
              onClick={() => setShowInfoModal(true)}
              className="h-10 w-10 rounded-full border-2 border-foreground/20 bg-white/70 flex items-center justify-center text-foreground/50 hover:border-foreground/30 hover:bg-secondary/40 transition-all duration-200 shadow-sm"
              aria-label="Om Indstillinger"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
        </div>

        {user && (
          <div className="rounded-2xl bg-white border border-foreground/6 shadow-sm px-4 py-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-foreground/8 border border-border/30 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-foreground/60 uppercase select-none">
                {user.email?.[0] ?? '?'}
              </span>
            </div>
            <p className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">{user.email}</p>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-xl border border-foreground/10 hover:border-foreground/20 bg-white hover:bg-secondary/40"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log ud
            </button>
          </div>
        )}

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40 px-1 mb-2 flex items-center gap-1.5">
            <Settings className="h-3 w-3" />
            Visning
          </p>
          <div className="rounded-2xl bg-white border border-foreground/6 shadow-sm divide-y divide-foreground/5">
            <SettingRow
              label="Afrund beløb"
              description="Runder op til nærmeste 100 kr."
            >
              <Switch
                id="round-toggle"
                checked={settings.roundToHundreds}
                onCheckedChange={(checked) => updateSetting('roundToHundreds', checked)}
              />
            </SettingRow>
            <SettingRow
              label="Skjul decimaler"
              description="Viser kun hele kroner uden ører"
            >
              <Switch
                id="decimals-toggle"
                checked={settings.hideDecimals}
                onCheckedChange={(checked) => updateSetting('hideDecimals', checked)}
              />
            </SettingRow>
            <SettingRow
              label="Farvekod beløb"
              description="Udgifter røde, indtægter grønne"
            >
              <Switch
                id="color-toggle"
                checked={settings.colorizeAmounts}
                onCheckedChange={(checked) => updateSetting('colorizeAmounts', checked)}
              />
            </SettingRow>
            <div className="px-4 py-3.5">
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Nulstil visningsindstillinger
              </button>
            </div>

            <div className="border-t border-foreground/5 px-4 py-3.5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Startskærm</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Vælg hvilket bundmenupunkt der åbner først på mobil.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                  Plads 1
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {startScreenOptions.map(option => {
                  const selected = option.href === startScreenHref;
                  return (
                    <button
                      key={`${option.position}-${option.href}`}
                      type="button"
                      onClick={() => handleStartScreenChange(option.href)}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition-all ${
                        selected
                          ? 'border-[#0E3B43] bg-[#0E3B43] text-[#2ED3A7] shadow-sm'
                          : 'border-foreground/10 bg-white text-muted-foreground hover:border-foreground/20 hover:text-foreground'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40 px-1 mb-2 flex items-center gap-1.5">
            <CalendarDays className="h-3 w-3" />
            Nuvio Flow
          </p>
          <div className="rounded-2xl bg-white border border-foreground/6 shadow-sm">
            <div className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Ugen starter</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Den dag du normalt handler ind til den kommende uge
                  </p>
                </div>
                <div className="shrink-0 w-36">
                  <Select
                    value={String(weekStartDay)}
                    onValueChange={handleWeekStartDayChange}
                    disabled={savingWeekStartDay}
                  >
                    <SelectTrigger className="h-9 rounded-xl text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Søndag</SelectItem>
                      <SelectItem value="1">Mandag</SelectItem>
                      <SelectItem value="2">Tirsdag</SelectItem>
                      <SelectItem value="3">Onsdag</SelectItem>
                      <SelectItem value="4">Torsdag</SelectItem>
                      <SelectItem value="5">Fredag</SelectItem>
                      <SelectItem value="6">Lørdag</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40 flex items-center gap-1.5">
              <LayoutDashboard className="h-3 w-3" />
              Tilpas overblik
            </p>
            {cardConfigsDirty && (
              <button
                onClick={handleSaveCards}
                disabled={savingCards}
                className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                <Save className="h-3 w-3" />
                {savingCards ? 'Gemmer...' : 'Gem ændringer'}
              </button>
            )}
          </div>
          <div className="rounded-2xl bg-white border border-foreground/6 shadow-sm overflow-hidden divide-y divide-foreground/5">
            {cardConfigs.map((cfg, index) => (
              <div
                key={cfg.card_key}
                className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
                  !cfg.is_visible ? 'opacity-50 bg-secondary/20' : 'bg-white'
                }`}
              >
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => moveCard(index, -1)}
                    disabled={index === 0}
                    className="p-0.5 rounded hover:bg-secondary disabled:opacity-20 transition-colors text-muted-foreground"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moveCard(index, 1)}
                    disabled={index === cardConfigs.length - 1}
                    className="p-0.5 rounded hover:bg-secondary disabled:opacity-20 transition-colors text-muted-foreground"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${!cfg.is_visible ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {USER_CARD_LABELS[cfg.card_key]}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {USER_CARD_DESCRIPTIONS[cfg.card_key]}
                  </p>
                </div>

                <button
                  onClick={() => toggleCardVisibility(index)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all shrink-0 ${
                    cfg.is_visible
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  {cfg.is_visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {cfg.is_visible ? 'Synlig' : 'Skjult'}
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/60 px-1 mt-2 leading-relaxed">
            Brug pilene til at ændre rækkefølgen på din forside.
          </p>
        </section>

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400/70 px-1 mb-2 flex items-center gap-1.5">
            <TriangleAlert className="h-3 w-3" />
            Farezone
          </p>
          <UserDataResetWizard />
        </section>

      </div>

      {showInfoModal && (
        <IndstillingerInfoModal onClose={() => setShowInfoModal(false)} />
      )}
    </div>
  );
}

function IndstillingerInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        style={{ animation: 'slideUp 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
      >
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl bg-gradient-to-r from-slate-300 to-slate-400" />
        <div className="px-6 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-start justify-between mb-4">
            <div className="h-10 w-10 rounded-2xl bg-secondary/60 border border-border/40 flex items-center justify-center shrink-0">
              <Settings className="h-5 w-5 text-foreground/60" />
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-1">Indstillinger</h2>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-4">Tilpas din oplevelse</p>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              Her kan du tilpasse din Nuvio-oplevelse — ændre visningsformat for tal, vælge hvilke kort der vises på forsiden, og styre hvornår ugen starter.
            </p>
            <p>
              <span className="font-semibold text-foreground">Hjemmeskærm-kort</span> lader dig vælge hvilke informationer der er synlige på din Overblik-side, og i hvilken rækkefølge de vises.
            </p>
            <p>
              Ændringer gemmes automatisk og slår igennem med det samme.
            </p>
          </div>
          <button
            onClick={onClose}
            className="mt-6 w-full h-12 rounded-2xl font-semibold text-sm bg-foreground text-background transition-all duration-200 active:scale-[0.98] hover:bg-foreground/90"
          >
            Forstået
          </button>
        </div>
      </div>
      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3.5 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
