'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, PiggyBank, Coins, Activity, List, Menu, X, TrendingUp, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/lib/settings-context';
import { useAuth } from '@/lib/auth-context';
import { getNavGroupsWithItems, getMobileNavSlots, NAV_ICON_MAP } from '@/lib/nav-config';
import { useUIStrings } from '@/lib/ui-strings-context';
import { VERSION } from '@/lib/version';
import type { NavGroupWithItems, MobileNavSlotWithItem } from '@/lib/database.types';

function NavHighlight({ activeIndex, count }: { activeIndex: number; count: number }) {
  if (count <= 0) return null;
  return (
    <div className="absolute inset-y-1 left-2 right-2 pointer-events-none overflow-hidden">
      <div
        className="h-full transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
        style={{
          opacity: activeIndex >= 0 ? 1 : 0,
          transform: `translate3d(${Math.max(activeIndex, 0) * 100}%, 0, 0)`,
          width: `${100 / count}%`,
        }}
      >
        <div className="mx-1 h-full rounded-full bg-[#0E3B43] shadow-sm" />
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
  const slotCount = Math.min(4, Math.max(2, parseInt(getString('mobile_nav_slot_count', '3'), 10) || 3));
  const [burgerOpen, setBurgerOpen] = useState(false);
  const [dbGroups, setDbGroups] = useState<NavGroupWithItems[]>([]);
  const [mobileSlots, setMobileSlots] = useState<MobileNavSlotWithItem[]>([]);
  const [pendingNav, setPendingNav] = useState<{ mode: 'db' | 'default'; index: number } | null>(null);

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

  const DEFAULT_BURGER_SECTIONS = [
    {
      label: 'Økonomi',
      items: [
        { label: 'Oversigt', href: '/', icon: LayoutDashboard },
        { label: 'Investering', href: '/investering', icon: TrendingUp },
        { label: 'Opsparing', href: '/maal', icon: PiggyBank },
        { label: 'Husstand', href: '/husstand', icon: Users },
      ],
    },
    {
      label: 'Indstillinger',
      items: [
        { label: 'Nuvio Checkup', href: '/checkup', icon: Activity },
        { label: 'Indstillinger', href: '/indstillinger', icon: Settings },
      ],
    },
  ];

  const burgerSections =
    dbGroups.length > 0
      ? dbGroups.map((g) => ({
          label: g.name,
          items: g.items.map((item) => ({
            label: item.name,
            href: item.href,
            icon: NAV_ICON_MAP[item.icon_name] ?? LayoutDashboard,
          })),
        }))
      : DEFAULT_BURGER_SECTIONS;

  const activeSlots = mobileSlots.slice(0, slotCount);

  const DEFAULT_SLOTS: { id: string; icon: React.ComponentType<{ className?: string }>; href: string; label: string; isBurger?: boolean }[] = [
    { id: 'hjem', icon: Coins, href: '/nuvio-flow', label: 'Flow' },
    { id: 'investering', icon: TrendingUp, href: '/investering', label: 'Investering' },
    { id: 'checkup', icon: Activity, href: '/checkup', label: 'Checkup' },
    { id: 'burger', icon: Menu, href: '', label: 'Menu', isBurger: true },
  ].slice(0, slotCount);

  function getActiveSlotIndex(slots: MobileNavSlotWithItem[]): number {
    if (burgerOpen) {
      const burgerIndex = slots.findIndex((slot) => slot.is_burger);
      if (burgerIndex >= 0) return burgerIndex;
    }
    return slots.findIndex((slot) => !slot.is_burger && slot.nav_item && isActive(slot.nav_item.href));
  }

  function getActiveDefaultSlotIndex(): number {
    if (burgerOpen) {
      const burgerIndex = DEFAULT_SLOTS.findIndex((slot) => slot.isBurger);
      if (burgerIndex >= 0) return burgerIndex;
    }
    return DEFAULT_SLOTS.findIndex((slot) => !slot.isBurger && isActive(slot.href));
  }

  const dbActiveSlotIndex = getActiveSlotIndex(activeSlots);
  const defaultActiveSlotIndex = getActiveDefaultSlotIndex();
  const displayedDbActiveSlotIndex = pendingNav?.mode === 'db' ? pendingNav.index : dbActiveSlotIndex;
  const displayedDefaultActiveSlotIndex = pendingNav?.mode === 'default' ? pendingNav.index : defaultActiveSlotIndex;

  return (
    <>
      {burgerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setBurgerOpen(false)}
        />
      )}

      <div
        className="fixed bottom-0 left-0 right-0 z-[60] md:hidden"
        style={{ pointerEvents: 'none', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="px-4 pb-3" style={{ pointerEvents: 'none' }}>

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
                          <span className="text-xs text-muted-foreground/40 tracking-wide select-none">Nuvio {VERSION}</span>
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
            <div className="relative flex items-center justify-around h-full px-2">
              {activeSlots.length > 0 ? (
                <>
                  <NavHighlight activeIndex={displayedDbActiveSlotIndex} count={activeSlots.length} />
                  {activeSlots.map((slot, index) => {
                    if (slot.is_burger) {
                      const active = displayedDbActiveSlotIndex === index;
                      return (
                        <button
                          key={slot.id}
                          onClick={() => setBurgerOpen((v) => !v)}
                          className={cn(
                            'relative z-10 flex flex-col items-center justify-center gap-1 flex-1 mx-1 px-2 py-2 rounded-full transition-colors duration-300',
                            active ? 'text-[#2ED3A7]' : 'text-muted-foreground'
                          )}
                        >
                          <div className="w-12 h-7 rounded-full flex items-center justify-center transition-all duration-300">
                            {burgerOpen
                              ? <X className="h-[18px] w-[18px] text-[#2ED3A7]" />
                              : <Menu className="h-[18px] w-[18px] text-muted-foreground" />
                            }
                          </div>
                          <span className={cn(
                            'text-[10px] font-semibold leading-none tracking-wide',
                            active ? 'text-[#2ED3A7]' : 'text-muted-foreground/70'
                          )}>
                            Menu
                          </span>
                        </button>
                      );
                    }
                    const item = slot.nav_item;
                    if (!item) return <div key={slot.id} className="relative z-10 flex-1" />;
                    const Icon = NAV_ICON_MAP[item.icon_name] ?? LayoutDashboard;
                    const active = displayedDbActiveSlotIndex === index;
                    return (
                      <button
                        key={slot.id}
                        onClick={() => {
                          setPendingNav({ mode: 'db', index });
                          setBurgerOpen(false);
                          router.push(item.href);
                        }}
                        className={cn(
                          'relative z-10 flex flex-col items-center justify-center gap-1 flex-1 mx-1 px-2 py-2 rounded-full transition-colors duration-300',
                          active ? 'text-[#2ED3A7]' : 'text-muted-foreground'
                        )}
                      >
                        <div className="w-12 h-7 rounded-full flex items-center justify-center transition-all duration-300">
                          <Icon className={cn('h-[18px] w-[18px]', active ? 'text-[#2ED3A7]' : 'text-muted-foreground')} />
                        </div>
                        <span className={cn(
                          'text-[10px] font-semibold leading-none tracking-wide',
                          active ? 'text-[#2ED3A7]' : 'text-muted-foreground/70'
                        )}>
                          {item.name}
                        </span>
                      </button>
                    );
                  })}
                </>
              ) : (
                <>
                  <NavHighlight activeIndex={displayedDefaultActiveSlotIndex} count={DEFAULT_SLOTS.length} />
                  {DEFAULT_SLOTS.map((def, index) => {
                    if (def.isBurger) {
                      const active = displayedDefaultActiveSlotIndex === index;
                      return (
                        <button
                          key={def.id}
                          onClick={() => setBurgerOpen((v) => !v)}
                          className={cn(
                            'relative z-10 flex flex-col items-center justify-center gap-1 flex-1 mx-1 px-2 py-2 rounded-full transition-colors duration-300',
                            active ? 'text-[#2ED3A7]' : 'text-muted-foreground'
                          )}
                        >
                          <div className="w-12 h-7 rounded-full flex items-center justify-center transition-all duration-300">
                            {burgerOpen
                              ? <X className="h-[18px] w-[18px] text-[#2ED3A7]" />
                              : <Menu className="h-[18px] w-[18px] text-muted-foreground" />
                            }
                          </div>
                          <span className={cn(
                            'text-[10px] font-semibold leading-none tracking-wide',
                            active ? 'text-[#2ED3A7]' : 'text-muted-foreground/70'
                          )}>
                            Menu
                          </span>
                        </button>
                      );
                    }
                    const Icon = def.icon;
                    const active = displayedDefaultActiveSlotIndex === index;
                    return (
                      <button
                        key={def.id}
                        onClick={() => {
                          setPendingNav({ mode: 'default', index });
                          setBurgerOpen(false);
                          router.push(def.href);
                        }}
                        className={cn(
                          'relative z-10 flex flex-col items-center justify-center gap-1 flex-1 mx-1 px-2 py-2 rounded-full transition-colors duration-300',
                          active ? 'text-[#2ED3A7]' : 'text-muted-foreground'
                        )}
                      >
                        <div className="w-12 h-7 rounded-full flex items-center justify-center transition-all duration-300">
                          <Icon className={cn('h-[18px] w-[18px]', active ? 'text-[#2ED3A7]' : 'text-muted-foreground')} />
                        </div>
                        <span className={cn(
                          'text-[10px] font-semibold leading-none tracking-wide',
                          active ? 'text-[#2ED3A7]' : 'text-muted-foreground/70'
                        )}>
                          {def.label}
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
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
