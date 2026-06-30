'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, Loader2, LogOut, Palmtree, Pencil, Settings, Trash2, TriangleAlert, Info, X } from 'lucide-react';
import { toast } from 'sonner';
import { EditableText } from '@/components/editable-text';
import UserDataResetWizard from '@/components/user-data-reset-wizard';
import { getUserWeekStartDay, setUserWeekStartDay } from '@/lib/quick-expense-service';
import { VERSION } from '@/lib/version';
import { PushNotificationSettings } from '@/components/push-notification-settings';
import { VacationModeWizard } from '@/components/vacation-mode-wizard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  cancelVacationMode,
  getActiveVacationMode,
  getPlannedVacationMode,
  type VacationMode,
} from '@/lib/vacation-mode-service';

export default function IndstillingerPage() {
  const { user, signOut } = useAuth();
  const [weekStartDay, setWeekStartDayState] = useState<number>(1);
  const [savingWeekStartDay, setSavingWeekStartDay] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showVacationWizard, setShowVacationWizard] = useState(false);
  const [vacationModeToEdit, setVacationModeToEdit] = useState<VacationMode | null>(null);
  const [plannedVacationMode, setPlannedVacationMode] = useState<VacationMode | null>(null);
  const [activeVacationMode, setActiveVacationMode] = useState<VacationMode | null>(null);
  const [loadingVacationModes, setLoadingVacationModes] = useState(false);
  const [cancellingVacationMode, setCancellingVacationMode] = useState(false);
  const [showCancelVacationConfirm, setShowCancelVacationConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const DANISH_MONTHS_FULL = [
    'januar', 'februar', 'marts', 'april', 'maj', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'december',
  ];

  useEffect(() => {
    getUserWeekStartDay()
      .then(day => setWeekStartDayState(day))
      .catch(() => null);
  }, []);

  useEffect(() => {
    loadVacationModes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function loadVacationModes() {
    if (!user) {
      setActiveVacationMode(null);
      setPlannedVacationMode(null);
      return;
    }

    setLoadingVacationModes(true);
    try {
      const [active, planned] = await Promise.all([
        getActiveVacationMode(user.id),
        getPlannedVacationMode(user.id),
      ]);
      setActiveVacationMode(active);
      setPlannedVacationMode(planned);
    } catch (error) {
      console.error('[Indstillinger] vacation modes load failed', error);
      toast.error('Kunne ikke hente feriekuverter');
    } finally {
      setLoadingVacationModes(false);
    }
  }

  function openVacationWizard(mode: VacationMode | null = null) {
    setVacationModeToEdit(mode);
    setShowVacationWizard(true);
  }

  function closeVacationWizard() {
    setShowVacationWizard(false);
    setVacationModeToEdit(null);
  }

  async function handleCancelVacationMode() {
    if (!user || !plannedVacationMode || cancellingVacationMode) return;

    setCancellingVacationMode(true);
    try {
      await cancelVacationMode(plannedVacationMode.id, user.id);
      toast.success('Feriekuvert annulleret');
      setShowCancelVacationConfirm(false);
      await loadVacationModes();
    } catch (error) {
      console.error('[Indstillinger] vacation mode cancel failed', error);
      toast.error('Kunne ikke annullere feriekuverten');
    } finally {
      setCancellingVacationMode(false);
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
            <CalendarDays className="h-3 w-3" />
            Udgifter
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
          <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40 px-1 mb-2 flex items-center gap-1.5">
            <Palmtree className="h-3 w-3" />
            Ferie mode
          </p>
          <div className="rounded-2xl bg-white border border-foreground/6 shadow-sm px-4 py-4">
            {loadingVacationModes ? (
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Henter feriekuverter...
              </div>
            ) : activeVacationMode ? (
              <VacationModeSummary
                title="Aktiv feriekuvert"
                mode={activeVacationMode}
                tone="active"
                primaryLabel="Rediger"
                onPrimary={() => openVacationWizard(activeVacationMode)}
              />
            ) : plannedVacationMode ? (
              <VacationModeSummary
                title="Planlagt feriekuvert"
                mode={plannedVacationMode}
                tone="planned"
                primaryLabel="Rediger"
                onPrimary={() => openVacationWizard(plannedVacationMode)}
                secondaryLabel={cancellingVacationMode ? 'Annullerer...' : 'Annuller'}
                onSecondary={() => setShowCancelVacationConfirm(true)}
                secondaryDisabled={cancellingVacationMode}
              />
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">Feriekuvert</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Planlæg et særskilt feriebudget uden at ændre din normale Kuvert endnu.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => openVacationWizard()}
                    className="rounded-full bg-[#0E3B43] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-transform active:scale-[0.98]"
                  >
                    Start feriekuvert
                  </button>
                  <button
                    type="button"
                    onClick={() => openVacationWizard()}
                    className="rounded-full border border-[#F6C126]/40 bg-[#F6C126]/10 px-4 py-2 text-xs font-semibold text-[#0E3B43] transition-transform active:scale-[0.98]"
                  >
                    Planlæg ferie
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40 px-1 mb-2 flex items-center gap-1.5">
            <Info className="h-3 w-3" />
            Notifikationer
          </p>
          <PushNotificationSettings />
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
      <VacationModeWizard
        open={showVacationWizard}
        onClose={closeVacationWizard}
        vacationMode={vacationModeToEdit}
        onSaved={loadVacationModes}
      />
      <AlertDialog open={showCancelVacationConfirm} onOpenChange={setShowCancelVacationConfirm}>
        <AlertDialogContent className="rounded-[28px] border border-foreground/10 bg-white px-6 py-6 shadow-2xl sm:max-w-md">
          <AlertDialogHeader className="space-y-3 text-left">
            <div className="h-12 w-12 rounded-2xl bg-[#F6C126]/12 border border-[#F6C126]/30 flex items-center justify-center">
              <Palmtree className="h-6 w-6 text-[#8C6900]" />
            </div>
            <AlertDialogTitle className="text-2xl font-semibold tracking-tight text-foreground">
              Annuller feriekuvert?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Den planlagte feriekuvert bliver slettet, og din normale Kuvert fortsætter som nu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AlertDialogCancel
              disabled={cancellingVacationMode}
              className="h-12 rounded-full border border-foreground/10 px-5 text-sm font-semibold"
            >
              Behold
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleCancelVacationMode();
              }}
              disabled={cancellingVacationMode}
              className="h-12 rounded-full bg-[#0E3B43] px-5 text-sm font-semibold text-white hover:bg-[#0b3238]"
            >
              {cancellingVacationMode ? 'Annullerer...' : 'Ja, annuller'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function formatVacationDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('da-DK', {
    day: 'numeric',
    month: 'short',
  });
}

function formatVacationAmount(value: number): string {
  return `${Math.round(value).toLocaleString('da-DK')} kr.`;
}

function VacationModeSummary({
  title,
  mode,
  tone,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  secondaryDisabled,
}: {
  title: string;
  mode: VacationMode;
  tone: 'active' | 'planned';
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryDisabled?: boolean;
}) {
  const dailyAmount = Number(mode.budget_amount) / Math.max(1, mode.number_of_days);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                tone === 'active'
                  ? 'bg-[#F6C126]/20 text-[#8C6900]'
                  : 'bg-[#0E3B43]/8 text-[#0E3B43]'
              }`}
            >
              {tone === 'active' ? 'Aktiv' : 'Planlagt'}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {formatVacationDate(mode.start_date)} - {formatVacationDate(mode.end_date)}
            {' · '}
            {mode.number_of_days} dage
            {' · '}
            {formatVacationAmount(dailyAmount)} pr. dag
          </p>
        </div>
        <button
          type="button"
          onClick={onPrimary}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#0E3B43] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-transform active:scale-[0.98]"
        >
          <Pencil className="h-3.5 w-3.5" />
          {primaryLabel}
        </button>
      </div>

      <div className="rounded-2xl border border-[#F6C126]/24 bg-[#F6C126]/8 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8C6900]/70">Feriebudget</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <p className="text-2xl font-semibold tracking-tight text-[#0E3B43]">
            {formatVacationAmount(Number(mode.budget_amount))}
          </p>
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              disabled={secondaryDisabled}
              className="flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
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
              Her kan du tilpasse din Kuvert-oplevelse — ændre visningsformat for tal og styre hvornår ugen starter.
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
