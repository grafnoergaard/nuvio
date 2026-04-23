'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useNotificationCenter } from '@/lib/notification-center-context';

export function NotificationCenterUrlSync() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { markRead } = useNotificationCenter();

  useEffect(() => {
    const notificationId = searchParams.get('notificationId');
    if (!notificationId) return;

    let cancelled = false;

    (async () => {
      await markRead(notificationId).catch(() => null);
      if (cancelled) return;

      const next = new URLSearchParams(searchParams.toString());
      next.delete('notificationId');
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    })();

    return () => {
      cancelled = true;
    };
  }, [markRead, pathname, router, searchParams]);

  return null;
}
