'use client';

import { useState, useRef, useEffect } from 'react';
import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { useUIStrings } from '@/lib/ui-strings-context';
import { useAuth } from '@/lib/auth-context';

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [pinned, setPinned] = useState(true);
  const [hovered, setHovered] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { getString } = useUIStrings();
  const { isAdmin } = useAuth();
  const navHeight = parseInt(getString('mobile_nav_height', '58'), 10) || 58;
  const mobileNavEnabled = getString('mobile_nav_enabled', 'true') !== 'false';
  const showMobileNav = isAdmin || mobileNavEnabled;

  const visible = pinned || hovered;

  useEffect(() => {
    document.documentElement.style.setProperty('--mobile-nav-height', `${navHeight}px`);
  }, [navHeight]);

  useEffect(() => {
    function updateSidebarOffset() {
      const isMobile = window.innerWidth < 1024;
      const offset = isMobile ? '0px' : (pinned ? '280px' : '0px');
      document.documentElement.style.setProperty('--sidebar-offset-global', offset);
    }
    updateSidebarOffset();
    window.addEventListener('resize', updateSidebarOffset);
    return () => window.removeEventListener('resize', updateSidebarOffset);
  }, [pinned]);

  function handleMouseEnter() {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHovered(true);
  }

  function handleMouseLeave() {
    hoverTimerRef.current = setTimeout(() => setHovered(false), 250);
  }

  return (
    <div className="flex min-h-screen relative" style={{ '--sidebar-offset': pinned ? '280px' : '0px' } as React.CSSProperties}>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative z-[60] shrink-0 transition-all duration-300 hidden lg:block"
        style={{ width: pinned ? 280 : 0 }}
      >
        <Sidebar pinned={pinned} onTogglePin={() => setPinned((p) => !p)} visible={visible} />
      </div>

      {!pinned && (
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="fixed left-0 top-0 h-screen w-4 z-40 hidden lg:block"
        >
          <div
            className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-16 rounded-r-full transition-all duration-300 ${
              hovered ? 'opacity-0' : 'opacity-40 hover:opacity-70'
            }`}
            style={{ background: 'var(--foreground)' }}
          />
        </div>
      )}

      <main
        className="flex-1 min-w-0"
        style={showMobileNav ? {
          paddingBottom: `calc(var(--mobile-nav-height, 58px) + env(safe-area-inset-bottom, 0px))`,
        } : undefined}
        data-mobile-pb={showMobileNav ? 'true' : undefined}
      >
        {children}
      </main>

      {showMobileNav && <MobileNav />}
    </div>
  );
}
