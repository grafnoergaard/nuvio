'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, PiggyBank, Activity, Menu, X, TrendingUp, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/lib/settings-context';
import { useAuth } from '@/lib/auth-context';
import { DEFAULT_MOBILE_NAV_OPTIONS, getNavGroupsWithItems, getMobileNavSlots, NAV_ICON_MAP } from '@/lib/nav-config';
import { useUIStrings } from '@/lib/ui-strings-context';
import { VERSION } from '@/lib/version';
import type { NavGroupWithItems, MobileNavSlotWithItem } from '@/lib/database.types';

const DEFAULT_BURGER_SECTIONS = [
  {
    label: 'Økonomi',
    items: [
      { label: 'Kuvert', href: '/', icon: NAV_ICON_MAP['Kuvert'] },
      { label: 'Investering', href: '/investering', icon: TrendingUp },
      { label: 'Sparet', href: '/maal', icon: PiggyBank },
      { label: 'Husstand', href: '/husstand', icon: Users },
    ],
  },
  {
    label: 'Indstillinger',
    items: [
      { label: 'Kuvert Checkup', href: '/checkup', icon: Activity },
      { label: 'Indstillinger', href: '/indstillinger', icon: Settings },
    ],
  },
];

type DisplaySlot = {
  key: string;
  isBurger: boolean;
  isEmpty: boolean;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

function NavHighlight({ activeIndex, count }: { activeIndex: number; count: number }) {
  if (count <= 0) return null;
  return (
    <div className="absolute inset-1 pointer-events-none overflow-hidden">
      <div
        className="h-full transition-[transform,opacity] duration-200 will-change-transform"
        style={{
          opacity: activeIndex >= 0 ? 1 : 0,
          transform: `translate3d(${Math.max(activeIndex, 0) * 100}%, 0, 0)`,
          transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)',
          width: `${100 / count}%`,
        }}
      >
        <div className="h-full rounded-full bg-[#0E3B43] shadow-sm" />
      </div>
    </div>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { design } = useSettings();
  const { user, signOut } = useAuth();
  const { getString } = useUIStrings();
  const navHeight = parseInt(getString('mobile_nav_height', '68'), 10) || 68;
  const slotCount = Math.min(4, Math.max(2, parseInt(getString('mobile_nav_slot_count', '4'), 10) || 4));
  const [burgerOpen, setBurgerOpen] = useState(false);
  const [dbGroups, setDbGroups] = useState<NavGroupWithItems[]>([]);
  const [mobileSlots, setMobileSlots] = useState<MobileNavSlotWithItem[]>([]);
  const [pendingNav, setPendingNav] = useState<{ mode: 'db' | 'default'; index: number } | null>(null);
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    getNavGroupsWithItems().then((data) => {
      if (data.length > 0) setDbGroups(data);
    }).catch(() => {});
    getMobileNavSlots().then((data) => {
      if (data.length > 0) setMobileSlots(data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    document.body.style.overflow = burgerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [burgerOpen]);

  useEffect(() => {
    setPendingNav(null);
  }, [pathname, burgerOpen]);

  function navigate(href: string) {
    setBurgerOpen(false);
    router.push(href);
  }

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href);
  }

  const burgerSections = useMemo(
    () => dbGroups.length > 0
      ? dbGroups.map((g) => ({
          label: g.name,
          items: g.items.map((item) => ({
            label: item.name,
            href: item.href,
            icon: NAV_ICON_MAP[item.icon_name] ?? LayoutDashboard,
          })),
        }))
      : DEFAULT_BURGER_SECTIONS,
    [dbGroups],
  );

  const DEFAULT_SLOTS = useMemo(() => DEFAULT_MOBILE_NAV_OPTIONS.slice(0, slotCount), [slotCount]);

  const displaySlots = useMemo<DisplaySlot[]>(() => {
    const slotsByPosition = new Map(mobileSlots.map((slot) => [slot.position, slot]));

    return Array.from({ length: slotCount }, (_, index) => {
      const position = index + 1;
      const slot = slotsByPosition.get(position);

      if (!slot) {
        const def = DEFAULT_MOBILE_NAV_OPTIONS[index] ?? DEFAULT_MOBILE_NAV_OPTIONS[DEFAULT_MOBILE_NAV_OPTIONS.length - 1];
        return {
          key: `default-${def.id}-${position}`,
          isBurger: Boolean(def.isBurger),
          isEmpty: false,
          href: def.href,
          label: def.label,
          icon: def.icon,
        };
      }

      if (slot.is_burger) {
        return {
          key: slot.id,
          isBurger: true,
          isEmpty: false,
          href: '',
          label: 'Menu',
          icon: Menu,
        };
      }

      if (!slot.nav_item) {
        return {
          key: slot.id,
          isBurger: false,
          isEmpty: true,
          href: '',
          label: '',
          icon: LayoutDashboard,
        };
      }

      return {
        key: slot.id,
        isBurger: false,
        isEmpty: false,
        href: slot.nav_item.href,
        label: slot.nav_item.name,
        icon: NAV_ICON_MAP[slot.nav_item.icon_name] ?? LayoutDashboard,
      };
    });
  }, [mobileSlots, slotCount]);

  const prefetchNavHref = useCallback((href: string) => {
    if (!href || prefetchedRoutesRef.current.has(href)) return;
    prefetchedRoutesRef.current.add(href);
    router.prefetch(href);
  }, [router]);

  useEffect(() => {
    const hrefs = new Set<string>();
    displaySlots.forEach((slot) => {
      if (!slot.isBurger && slot.href) hrefs.add(slot.href);
    });
    DEFAULT_SLOTS.forEach((slot) => {
      if (!slot.isBurger && slot.href) hrefs.add(slot.href);
    });
    burgerSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.href) hrefs.add(item.href);
      });
    });
    hrefs.forEach(prefetchNavHref);
  }, [displaySlots, DEFAULT_SLOTS, burgerSections, prefetchNavHref]);

  function getActiveSlotIndex(slots: DisplaySlot[]): number {
    if (burgerOpen) {
      const burgerIndex = slots.findIndex((slot) => slot.isBurger);
      if (burgerIndex >= 0) return burgerIndex;
    }
    return slots.findIndex((slot) => !slot.isBurger && !slot.isEmpty && isActive(slot.href));
  }

  const activeSlotIndex = getActiveSlotIndex(displaySlots);
  const displayedActiveSlotIndex = pendingNav ? pendingNav.index : activeSlotIndex;

  return (
    <>
      {burgerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setBurgerOpen(false)}
        />
      )}

      <div
        className="fixed bottom-0 left-0 right-0 z-[60] lg:hidden"
        style={{ pointerEvents: 'none' }}
      >
        <div className="px-4 pb-5" style={{ pointerEvents: 'none' }}>

          {burgerOpen && (
            <div
              className="mb-2 rounded-2xl bg-card/95 backdrop-blur-xl border border-border/40 shadow-xl overflow-hidden max-h-[70vh] overflow-y-auto"
              style={{ animation: 'sheetSlideUp 220ms cubic-bezier(0.22, 1, 0.36, 1) forwards', pointerEvents: 'auto' }}
            >
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Menu</p>
                  <button
                    onClick={() => setBurgerOpen(false)}
                    className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {burgerSections.map((section) => (
                    <div key={section.label}>
                      <div className="space-y-1">
                        {section.items.map((item) => {
                          const ItemIcon = item.icon;
                          const active = isActive(item.href);
                          return (
                            <button
                              key={item.href + item.label}
                              onClick={() => navigate(item.href)}
                              className={cn(
                                'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                                active
                                  ? 'bg-primary text-primary-foreground shadow-sm'
                                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                              )}
                            >
                              <ItemIcon className="h-4 w-4 shrink-0" />
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {user && (
                    <div className="pt-3 border-t border-border/40">
                      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-muted/40">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-label font-bold text-primary uppercase">
                            {user.email?.[0] ?? '?'}
                          </span>
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                          <span className="text-xs text-muted-foreground/40 tracking-wide select-none">Kuvert {VERSION}</span>
                        </div>
                        <button
                          onClick={() => signOut()}
                          className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                        >
                          Log ud
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div
            className="rounded-full bg-card/95 backdrop-blur-xl border border-border/30 shadow-2xl"
            style={{ pointerEvents: 'auto', height: navHeight }}
          >
            <div className="relative flex items-center justify-around h-full p-1">
              <NavHighlight activeIndex={displayedActiveSlotIndex} count={displaySlots.length} />
              {displaySlots.map((slot, index) => {
                if (slot.isEmpty) return <div key={slot.key} className="relative z-10 flex-1" />;

                if (slot.isBurger) {
                  const active = displayedActiveSlotIndex === index;
                  return (
                    <button
                      key={slot.key}
                      onClick={() => setBurgerOpen((v) => !v)}
                      className={cn(
                        'relative z-10 flex flex-col items-center justify-center gap-1 flex-1 self-stretch px-2 py-2 rounded-full transition-colors duration-300',
                        active ? 'text-[#2ED3A7]' : 'text-muted-foreground'
                      )}
                    >
                      <div className="w-12 h-7 rounded-full flex items-center justify-center transition-all duration-300">
                        {burgerOpen
                          ? <X className="h-5 w-5 text-[#2ED3A7]" />
                          : <Menu className="h-5 w-5 text-muted-foreground" />
                        }
                      </div>
                      <span className={cn(
                        'text-[10px] font-semibold leading-none tracking-wide',
                        active ? 'text-[#2ED3A7]' : 'text-muted-foreground'
                      )}>
                        Menu
                      </span>
                    </button>
                  );
                }

                const Icon = slot.icon;
                const active = displayedActiveSlotIndex === index;
                return (
                  <button
                    key={slot.key}
                    onClick={() => {
                      setPendingNav({ mode: 'db', index });
                      setBurgerOpen(false);
                      router.push(slot.href);
                    }}
                    className={cn(
                      'relative z-10 flex flex-col items-center justify-center gap-1 flex-1 self-stretch px-2 py-2 rounded-full transition-colors duration-300',
                      active ? 'text-[#2ED3A7]' : 'text-muted-foreground'
                    )}
                  >
                    <div className="w-12 h-7 rounded-full flex items-center justify-center transition-all duration-300">
                      <Icon className={cn('h-5 w-5', active ? 'text-[#2ED3A7]' : 'text-muted-foreground')} />
                    </div>
                    <span className={cn(
                      'text-[10px] font-semibold leading-none tracking-wide',
                      active ? 'text-[#2ED3A7]' : 'text-muted-foreground'
                    )}>
                      {slot.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes sheetSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
