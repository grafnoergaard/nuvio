'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, Info } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

type PushStatus = 'checking' | 'unsupported' | 'missing-key' | 'default' | 'granted' | 'denied';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function getNotificationStatus(): PushStatus {
  if (typeof window === 'undefined') return 'checking';
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }
  if (!vapidPublicKey) return 'missing-key';

  return Notification.permission as PushStatus;
}

export function PushNotificationSettings() {
  const { session } = useAuth();
  const [status, setStatus] = useState<PushStatus>('checking');
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const nextStatus = getNotificationStatus();
    setStatus(nextStatus);

    if (nextStatus === 'unsupported') return;

    navigator.serviceWorker.ready
      .then(async (registration) => {
        setServiceWorkerReady(true);
        const subscription = await registration.pushManager.getSubscription();
        setSubscribed(Boolean(subscription));
      })
      .catch(() => setServiceWorkerReady(false));
  }, []);

  const statusCopy = useMemo(() => {
    if (status === 'checking') return { label: 'Tjekker', tone: 'bg-secondary text-muted-foreground' };
    if (status === 'missing-key') return { label: 'Mangler nøgle', tone: 'bg-amber-50 text-amber-700 border-amber-100' };
    if (status === 'unsupported') return { label: 'Ikke understøttet', tone: 'bg-red-50 text-red-600 border-red-100' };
    if (status === 'denied') return { label: 'Blokeret', tone: 'bg-red-50 text-red-600 border-red-100' };
    if (status === 'granted' && subscribed) return { label: 'Aktiv', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    if (status === 'granted') return { label: 'Tilladt', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    return { label: 'Ikke slået til', tone: 'bg-amber-50 text-amber-700 border-amber-100' };
  }, [status, subscribed]);

  async function enableNotifications() {
    if (status === 'unsupported' || status === 'missing-key' || !vapidPublicKey) return;

    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      setServiceWorkerReady(true);

      const permission = await Notification.requestPermission();
      setStatus(permission as PushStatus);

      if (permission !== 'granted') {
        toast.error('Notifikationer blev ikke slået til');
        return;
      }

      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription = existingSubscription ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        await subscription.unsubscribe().catch(() => null);
        throw new Error('Subscription blev ikke gemt');
      }

      setSubscribed(true);

      await registration.showNotification('Kuvert er klar', {
        body: 'Næste trin er at koble rigtige push-beskeder på dine kuverter.',
        icon: '/kuvert-icon.png',
        badge: '/kuvert-icon.png',
        data: { url: '/' },
      });

      toast.success('Notifikationer er slået til');
    } catch {
      toast.error('Kunne ikke aktivere notifikationer');
    } finally {
      setBusy(false);
    }
  }

  async function sendTestNotification() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('Kuvert test', {
        body: 'Sådan kommer Kuvert til at minde dig om dit budget.',
        icon: '/kuvert-icon.png',
        badge: '/kuvert-icon.png',
        data: { url: '/' },
      });
      toast.success('Testnotifikation sendt');
    } catch {
      toast.error('Kunne ikke sende testnotifikation');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-foreground/6 shadow-sm overflow-hidden">
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-primary">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Push-notifikationer</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Kuvert kan nu gemme din enhed som push-modtager og sende rigtige påmindelser fra serveren.
              </p>
            </div>
          </div>
          <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold', statusCopy.tone)}>
            {statusCopy.label}
          </span>
        </div>

        <div className="mt-4 rounded-2xl bg-secondary/40 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
          <div className="flex gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              På iPhone virker web-push normalt først, når Kuvert er gemt på hjemmeskærmen. Push kræver også VAPID keys i miljøvariablerne på Vercel.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {status !== 'granted' ? (
            <Button
              type="button"
              onClick={enableNotifications}
              disabled={busy || status === 'unsupported' || status === 'missing-key' || status === 'denied'}
              className="h-11 flex-1"
            >
              <Bell className="mr-2 h-4 w-4" />
              Slå til
            </Button>
          ) : (
            <Button
              type="button"
              onClick={sendTestNotification}
              disabled={busy || !serviceWorkerReady}
              className="h-11 flex-1"
            >
              <Bell className="mr-2 h-4 w-4" />
              Send test
            </Button>
          )}
        </div>

        {status === 'denied' && (
          <p className="mt-3 text-xs leading-relaxed text-red-500">
            Notifikationer er blokeret i browseren. De skal åbnes igen i browserens eller iOS' indstillinger.
          </p>
        )}

        {status === 'missing-key' && (
          <p className="mt-3 text-xs leading-relaxed text-amber-700">
            VAPID public key mangler. Tilføj NEXT_PUBLIC_VAPID_PUBLIC_KEY og VAPID_PRIVATE_KEY før push kan aktiveres.
          </p>
        )}
      </div>
    </div>
  );
}
