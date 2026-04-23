'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, ChevronRight, Info, Mail, X } from 'lucide-react';
import { useNotificationCenter } from '@/lib/notification-center-context';
import { getCardStyle, getTopBarStyle, useSettings } from '@/lib/settings-context';
import { cn } from '@/lib/utils';

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
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotificationCenter();
  const autoMarkedRef = useRef(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const cardMedium = design.cardMedium;
  const cardStyleBase = getCardStyle(cardMedium, design.gradientFrom, design.gradientTo);
  const topBarStyleOverride = getTopBarStyle(cardMedium, design.gradientFrom, design.gradientTo);
  const now = new Date();
  const DANISH_MONTHS_FULL = [
    'januar', 'februar', 'marts', 'april', 'maj', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'december',
  ];

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

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f5f4f1] via-[#f8f7f4] to-white">
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
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => markAllRead()}
              className="inline-flex items-center gap-2 rounded-full border border-foreground/8 bg-white/70 px-3 py-2 text-sm font-medium text-foreground/64 transition-colors hover:text-foreground"
            >
              <CheckCheck className="h-4 w-4" />
              Markér alle som læst
            </button>
          </div>
        )}

        {loading ? (
          <div
            className="bg-gradient-to-br from-emerald-50/80 via-teal-50/30 to-white transition-all duration-500"
            style={cardStyleBase}
          >
            {topBarStyleOverride && <div style={topBarStyleOverride} />}
            <div className="px-5 py-8 text-sm text-muted-foreground/60">
              Indlæser beskeder...
            </div>
          </div>
        ) : notifications.length === 0 ? (
          <div
            className="bg-gradient-to-br from-emerald-50/80 via-teal-50/30 to-white transition-all duration-500"
            style={cardStyleBase}
          >
            {topBarStyleOverride && <div style={topBarStyleOverride} />}
            <div className="px-6 py-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#2ED3A7]/12 text-[#0E3B43]">
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
            className="bg-gradient-to-br from-emerald-50/80 via-teal-50/30 to-white transition-all duration-500"
            style={cardStyleBase}
          >
            {topBarStyleOverride && <div style={topBarStyleOverride} />}
            <div className="divide-y divide-foreground/6">
              {notifications.map((notification) => {
                const isUnread = !notification.readAt;
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => openNotification(notification.id, notification.url)}
                    className={cn(
                      'flex w-full items-start gap-4 px-4 py-4 text-left transition-colors duration-200 active:scale-[0.995]',
                      isUnread ? 'bg-white/70' : 'bg-white/40 hover:bg-white/60'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                        isUnread ? 'bg-[#2ED3A7]/14 text-[#0E3B43]' : 'bg-foreground/[0.04] text-foreground/50'
                      )}
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
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showInfoModal && <IndbakkeInfoModal onClose={() => setShowInfoModal(false)} />}
    </main>
  );
}

function IndbakkeInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full overflow-hidden rounded-t-3xl bg-card shadow-2xl sm:max-w-md sm:rounded-3xl"
        style={{ animation: 'slideUp 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
      >
        <div className="absolute left-0 right-0 top-0 h-1 rounded-t-3xl bg-gradient-to-r from-[#2ED3A7] to-[#0E3B43]" />
        <div className="px-6 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#2ED3A7]/25 bg-[#2ED3A7]/10">
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
