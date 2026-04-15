'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== '/login') {
      router.replace('/login');
      return;
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-emerald-50/60 via-white to-white">
        <div className="flex flex-col items-center gap-5">
          <img src="/kuvert-icon.png" alt="Kuvert" className="h-28 w-28 object-contain" />
          <p className="text-base font-semibold text-foreground">Åbner Kuvert…</p>
        </div>
      </div>
    );
  }

  if (!user && pathname !== '/login') return null;

  return <>{children}</>;
}
