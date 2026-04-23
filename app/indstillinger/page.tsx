'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, LogOut, Settings, TriangleAlert, Info, X } from 'lucide-react';
import { toast } from 'sonner';
import { EditableText } from '@/components/editable-text';
import UserDataResetWizard from '@/components/user-data-reset-wizard';
import { getUserWeekStartDay, setUserWeekStartDay } from '@/lib/quick-expense-service';
import { VERSION } from '@/lib/version';
import { PushNotificationSettings } from '@/components/push-notification-settings';

export default function IndstillingerPage() {
  const { user, signOut } = useAuth();
  const [weekStartDay, setWeekStartDayState] = useState<number>(1);
  const [savingWeekStartDay, setSavingWeekStartDay] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
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
