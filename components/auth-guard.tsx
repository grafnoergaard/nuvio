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
    if (user && pathname === '/') {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        const hasVisitedRoot = sessionStorage.getItem('nuvio_visited_root');
        if (!hasVisitedRoot) {
          sessionStorage.setItem('nuvio_visited_root', '1');
          router.replace('/nuvio-flow');
        }
      }
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-2xl bg-muted animate-pulse" />
          <div className="h-2 w-24 bg-muted rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user && pathname !== '/login') return null;

  return <>{children}</>;
}
