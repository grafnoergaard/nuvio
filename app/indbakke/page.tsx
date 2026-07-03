'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, ChevronRight, Info, Mail, Trash2, X } from 'lucide-react';
import { useNotificationCenter } from '@/lib/notification-center-context';
import { getCardStyle, getTopBarStyle, useSettings } from '@/lib/settings-context';
import { cn } from '@/lib/utils';
import { getVacationAccentColor, getVacationCardSurfaceStyle, getVacationTopBarCard, withAlpha } from '@/lib/vacation-theme';
import { useVacationMode } from '@/lib/vacation-mode-context';

function formatNotificationTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString('da-DK', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function IndbakkePage() {
  const router = useRouter();
  const { design } = useSettings();
  const {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    deleteNotification,
    deleteAllNotifications,
  } = useNotificationCenter();
  const autoMarkedRef = useRef(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const { isVacationMode: hasActiveVacationMode, isResolved: vacationModeResolved } = useVacationMode();
  const vacationAccent = getVacationAccentColor(design);
  const cardMedium = hasActiveVacationMode
    ? getVacationTopBarCard(design.cardMedium, vacationAccent)
    : design.cardMedium;
  const cardStyleBase = getCardStyle(cardMedium, design.gradientFrom, hasActiveVacationMode ? vacationAccent : design.gradientTo);
  const topBarStyleOverride = getTopBarStyle(cardMedium, design.gradientFrom, hasActiveVacationMode ? vacationAccent : design.gradientTo);
  const pageBackground = hasActiveVacationMode
    ? `linear-gradient(to bottom, ${withAlpha(vacationAccent, 0.16)}, #ffffff 42%, #ffffff)`
    : 'linear-gradient(to bottom, rgba(236,253,245,0.60), #ffffff, #ffffff)';
  const pageThemeColor = hasActiveVacationMode ? withAlpha(vacationAccent, 0.16) : 'rgb(236,253,245)';
  const accentSoft = hasActiveVacationMode ? withAlpha(vacationAccent, 0.12) : 'rgba(46,211,167,0.12)';
  const accentSofter = hasActiveVacationMode ? withAlpha(vacationAccent, 0.10) : 'rgba(46,211,167,0.10)';
  const accentUnread = hasActiveVacationMode ? withAlpha(vacationAccent, 0.14) : 'rgba(46,211,167,0.14)';
  const accentBorder = hasActiveVacationMode ? withAlpha(vacationAccent, 0.25) : 'rgba(46,211,167,0.25)';
  const vacationCardSurfaceStyle = hasActiveVacationMode ? getVacationCardSurfaceStyle(vacationAccent) : undefined;
  const now = new Date();
  const DANISH_MONTHS_FULL = [
    'januar', 'februar', 'marts', 'april', 'maj', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'december',
  ];

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const previousHtmlBackground = document.documentElement.style.backgroundColor;
    const previousBodyBackground = document.body.style.backgroundColor;
    document.documentElement.style.backgroundColor = pageThemeColor;
    document.body.style.backgroundColor = pageThemeColor;
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = pageThemeColor;
    return () => {
      document.documentElement.style.backgroundColor = previousHtmlBackground;
      document.body.style.backgroundColor = previousBodyBackground;
      if (meta) meta.content = '#f8f9f2';
    };
  }, [pageThemeColor]);

  useEffect(() => {
    if (loading || unreadCount === 0 || autoMarkedRef.current) return;
    autoMarkedRef.current = true;
    markAllRead().catch(() => {
      autoMarkedRef.current = false;
    });
  }, [loading, unreadCount, markAllRead]);

  async function openNotification(notificationId: string, href: string) {
    await markRead(notificationId).catch(() => null);
    router.push(href);
  }

  async function removeNotification(notificationId: string) {
    await deleteNotification(notificationId).catch(() => null);
  }

  if (!vacationModeResolved) {
    return (
      <main className="min-h-screen bg-white">
        <div
          className="mx-auto flex w-full max-w-lg flex-col px-4 pb-32 sm:pb-16"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}
        >
          <div className="mb-6">
            <div className="h-3 w-24 rounded-full bg-black/6 animate-pulse" />
            <div className="mt-3 h-10 w-56 rounded-2xl bg-black/6 animate-pulse" />
          </div>
          <div className="rounded-2xl border border-black/6 bg-white shadow-sm overflow-hidden">
            <div className="h-1 bg-black/5" />
            <div className="space-y-1 p-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-20 rounded-2xl bg-black/5 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen"
      style={{ background: pageBackground, backgroundColor: pageThemeColor }}
    >
      <div
        className="mx-auto flex w-full max-w-lg flex-col px-4 pb-32 sm:pb-16"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}
      >
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              {DANISH_MONTHS_FULL[now.getMonth()]} {now.getFullYear()}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Dine beskeder
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-foreground/20 bg-white/70 text-foreground/50 shadow-sm transition-all duration-200 hover:border-foreground/30 hover:bg-secondary/40"
              aria-label="Om Indbakke"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
        </div>

        <p className="mb-4 max-w-md text-sm leading-relaxed text-foreground/58">
          Her samler vi de påmindelser og små nudges, som hjælper dig med at holde Kuvert i sync med virkeligheden.
        </p>

        {!loading && notifications.length > 0 && (
          <div className="mb-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => markAllRead()}
              className="inline-flex items-center gap-2 rounded-full border border-foreground/8 bg-white/70 px-3 py-2 text-sm font-medium text-foreground/64 transition-colors hover:text-foreground"
            >
              <CheckCheck className="h-4 w-4" />
              Markér alle som læst
            </button>
            <button
              type="button"
              onClick={() => deleteAllNotifications()}
              className="inline-flex items-center gap-2 rounded-full border border-foreground/8 bg-white/70 px-3 py-2 text-sm font-medium text-foreground/64 transition-colors hover:text-foreground"
            >
              <Trash2 className="h-4 w-4" />
              Slet alle
            </button>
          </div>
        )}

        {loading ? (
          <div
            className="rounded-2xl border shadow-sm transition-all duration-500"
            style={{ ...cardStyleBase, ...vacationCardSurfaceStyle }}
          >
            {topBarStyleOverride && <div style={topBarStyleOverride} />}
            <div className="px-5 py-8 text-sm text-muted-foreground/60">
              Indlæser beskeder...
            </div>
          </div>
        ) : notifications.length === 0 ? (
          <div
            className="rounded-2xl border shadow-sm transition-all duration-500"
            style={{ ...cardStyleBase, ...vacationCardSurfaceStyle }}
          >
            {topBarStyleOverride && <div style={topBarStyleOverride} />}
            <div className="px-6 py-10 text-center">
              <div
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-[#0E3B43]"
                style={{ backgroundColor: accentSoft }}
              >
                <Bell className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-xl font-semibold text-[#0E3B43]">Indbakken er stille lige nu</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-foreground/58">
                Når Kuvert sender en påmindelse eller en lille nudge, lander den også her, så du altid kan finde den igen.
              </p>
            </div>
          </div>
        ) : (
          <div
            className="rounded-2xl border shadow-sm transition-all duration-500"
            style={{ ...cardStyleBase, ...vacationCardSurfaceStyle }}
          >
            {topBarStyleOverride && <div style={topBarStyleOverride} />}
            <div className="divide-y divide-foreground/6">
              {notifications.map((notification) => {
                const isUnread = !notification.readAt;
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'flex w-full items-start gap-4 px-4 py-4 text-left transition-colors duration-200 active:scale-[0.995]',
                      isUnread ? 'bg-white/70' : 'bg-white/40 hover:bg-white/60'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openNotification(notification.id, notification.url)}
                      className="flex min-w-0 flex-1 items-start gap-4 text-left"
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                          isUnread ? 'text-[#0E3B43]' : 'bg-foreground/[0.04] text-foreground/50'
                        )}
                        style={isUnread ? { backgroundColor: accentUnread } : undefined}
                      >
                        <Mail className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-base font-semibold leading-tight text-[#0E3B43]">{notification.title}</p>
                            <p className="mt-1 text-sm leading-relaxed text-foreground/64">{notification.body}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            {isUnread && <span className="mb-1 ml-auto block h-2.5 w-2.5 rounded-full bg-[#E5484D]" />}
                            <p className="text-[11px] font-medium text-foreground/42">{formatNotificationTime(notification.createdAt)}</p>
                          </div>
                        </div>
                      </div>

                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-foreground/32" />
                    </button>

                    <button
                      type="button"
                      onClick={() => removeNotification(notification.id)}
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/36 transition-colors hover:bg-white/70 hover:text-foreground/70"
                      aria-label={`Slet besked: ${notification.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showInfoModal && (
        <IndbakkeInfoModal
          accentColor={hasActiveVacationMode ? vacationAccent : '#2ED3A7'}
          accentSoft={accentSofter}
          accentBorder={accentBorder}
          onClose={() => setShowInfoModal(false)}
        />
      )}
    </main>
  );
}

function IndbakkeInfoModal({
  accentColor,
  accentSoft,
  accentBorder,
  onClose,
}: {
  accentColor: string;
  accentSoft: string;
  accentBorder: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full overflow-hidden rounded-t-3xl bg-card shadow-2xl sm:max-w-md sm:rounded-3xl"
        style={{ animation: 'slideUp 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
      >
        <div
          className="absolute left-0 right-0 top-0 h-1 rounded-t-3xl"
          style={{ background: `linear-gradient(to right, #0E3B43, ${accentColor})` }}
        />
        <div className="px-6 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="mb-4 flex items-start justify-between">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
              style={{ border: `1px solid ${accentBorder}`, backgroundColor: accentSoft }}
            >
              <Mail className="h-5 w-5 text-[#0E3B43]" />
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-secondary hover:text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <h2 className="mb-1 text-xl font-bold tracking-tight">Indbakke</h2>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Dine påmindelser samlet ét sted
          </p>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Her gemmer Kuvert de notifikationer og små nudges, du har fået, så du altid kan finde dem igen.
            </p>
            <p>
              Når du åbner en besked herfra, markeres den som læst, og din badge bliver opdateret både i appen og på app-ikonet.
            </p>
          </div>
          <button
            onClick={onClose}
            className="mt-6 h-12 w-full rounded-2xl bg-[#0E3B43] text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98]"
          >
            Forstået
          </button>
        </div>
        <style jsx>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(24px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}
