'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, ChevronLeft, ShieldCheck, Calculator, LogOut, ClipboardCheck, Zap, Navigation, Database, LayoutDashboard, Bot, Wand as Wand2, Activity, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { useAuth } from '@/lib/auth-context';
import { VERSION } from '@/lib/version';
import { getNavGroupsWithItems, NAV_ICON_MAP } from '@/lib/nav-config';
import type { NavGroupWithItems, NavItem } from '@/lib/database.types';

interface FlatNavItem {
  name: string;
  href: string;
  icon: any;
  requires_budget?: boolean;
  requires_transactions?: boolean;
  isHidden?: boolean;
}

interface FlatNavGroup {
  label: string;
  items: FlatNavItem[];
}

interface SidebarProps {
  pinned: boolean;
  onTogglePin: () => void;
  visible: boolean;
}

const BACKEND_ITEMS: FlatNavItem[] = [
  { name: 'Design & farver', href: '/admin', icon: ShieldCheck },
  { name: 'Brugere', href: '/admin/brugere', icon: ShieldCheck },
  { name: 'Kuvert Checkup', href: '/admin/mini-checkup', icon: ClipboardCheck },
  { name: 'Onboarding standardværdier', href: '/admin/checkup', icon: Calculator },
  { name: 'Kuvert AI', href: '/admin/ai-assistant', icon: Bot },
  { name: 'Advisory Engine', href: '/admin/advisory-engine', icon: Zap },
  { name: 'Navigation', href: '/admin/navigation', icon: Navigation },
  { name: 'Why Wizard', href: '/admin/why', icon: ShieldCheck },
  { name: 'StandardDataService', href: '/admin/standard-data', icon: Database },
  { name: 'Udgifter', href: '/admin/nuvio-flow', icon: Activity },
  { name: 'Kuvert-layout', href: '/admin/home-layout', icon: LayoutDashboard },
  { name: 'Typografi', href: '/admin/design', icon: Type },
  { name: 'Wizards', href: '/admin/wizards', icon: Wand2 },
];

function resolveHref(item: NavItem, budgetId: string | null): string {
  const template = (item as any).href_template as string | null;
  if (template) {
    if (!budgetId) return '/budgets';
    return template.replace('{budgetId}', budgetId);
  }
  return item.href;
}

function dbGroupsToFlatGroups(
  dbGroups: NavGroupWithItems[],
  currentBudgetId: string | null,
  hasTransactions: boolean,
  isAdmin: boolean
): FlatNavGroup[] {
  return dbGroups.map((g) => ({
    label: g.name,
    items: g.items
      .filter((item) => {
        const requiresBudget = (item as any).requires_budget as boolean | null;
        const requiresTx = (item as any).requires_transactions as boolean | null;
        const isVisibleToUsers = (item as any).is_visible_to_users as boolean | null;
        if (requiresBudget && !currentBudgetId) return false;
        if (requiresTx && !hasTransactions) return false;
        if (!isAdmin && isVisibleToUsers === false) return false;
        return true;
      })
      .map((item) => {
        const isVisibleToUsers = (item as any).is_visible_to_users as boolean | null;
        return {
          name: item.name,
          href: resolveHref(item, currentBudgetId),
          icon: NAV_ICON_MAP[item.icon_name] ?? NAV_ICON_MAP['Home'],
          requires_budget: (item as any).requires_budget ?? false,
          requires_transactions: (item as any).requires_transactions ?? false,
          isHidden: isAdmin && isVisibleToUsers === false,
        };
      }),
  }));
}

export function Sidebar({ pinned, onTogglePin, visible }: SidebarProps) {
  const pathname = usePathname();
  const { design } = useSettings();
  const { user, signOut, isAdmin } = useAuth();
  const [currentBudgetId, setCurrentBudgetId] = useState<string | null>(null);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [dbGroups, setDbGroups] = useState<NavGroupWithItems[]>([]);

  useEffect(() => {
    loadCurrentBudget();
    loadNavConfig();
  }, [pathname]);

  async function loadNavConfig() {
    try {
      const data = await getNavGroupsWithItems(isAdmin);
      if (data.length > 0) setDbGroups(data);
    } catch {}
  }

  async function loadCurrentBudget() {
    const budgetIdMatch = pathname.match(/\/budgets\/([^/]+)/);
    let budgetId = budgetIdMatch ? budgetIdMatch[1] : null;

    if (!budgetId || budgetId === 'new') {
      const { data: budgets } = await supabase
        .from('budgets')
        .select('id')
        .order('year', { ascending: false })
        .order('start_month', { ascending: false })
        .limit(1);

      if (budgets && budgets.length > 0) {
        budgetId = budgets[0].id;
      }
    }

    setCurrentBudgetId(budgetId);

    if (budgetId) {
      const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('budget_id', budgetId)
        .limit(1);
      setHasTransactions((count ?? 0) > 0);
    } else {
      setHasTransactions(false);
    }
  }

  const dynamicGroups: FlatNavGroup[] =
    dbGroups.length > 0
      ? dbGroupsToFlatGroups(dbGroups, currentBudgetId, hasTransactions, isAdmin)
      : [
          {
            label: 'Økonomi',
            items: [
              { name: 'Kuvert', href: '/', icon: NAV_ICON_MAP['Home'] },
              { name: 'Plan', href: '/plan', icon: NAV_ICON_MAP['LayoutDashboard'] },
              { name: 'Investering', href: '/investering', icon: NAV_ICON_MAP['TrendingUp'] },
              { name: 'Sparet', href: '/maal', icon: NAV_ICON_MAP['Target'] },
              { name: 'Husstand', href: '/husstand', icon: NAV_ICON_MAP['Users'] },
            ],
          },
          {
            label: 'Indstillinger',
            items: [
              { name: 'Kuvert Checkup', href: '/checkup', icon: NAV_ICON_MAP['Activity'] },
              { name: 'Indstillinger', href: '/indstillinger', icon: NAV_ICON_MAP['Settings'] },
            ],
          },
        ];

  const allGroups: FlatNavGroup[] = [
    ...dynamicGroups,
    { label: 'Backend', items: BACKEND_ITEMS },
  ];

  return (
    <div
      className={cn(
        'fixed left-0 top-0 h-screen w-[280px] border-r border-border bg-card/50 backdrop-blur-xl z-50 transition-transform duration-300 ease-in-out',
        visible ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex h-full flex-col">
        <div
          className="relative flex items-center justify-center"
          style={{ padding: '30px', paddingBottom: '30px' }}
        >
          <button
            onClick={onTogglePin}
            title={pinned ? 'Skjul menu' : 'Fastgør menu'}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary transition-all duration-200"
          >
            {pinned ? (
              <ChevronLeft className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          <div className="flex flex-col gap-4 w-full items-center">
            <img
              src={design.logoUrl}
              alt="Kuvert Logo"
              className="w-28 h-28 rounded-3xl shadow-lg object-contain"
            />
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold text-center text-foreground">Kuvert</h1>
              <p className="text-xs text-muted-foreground text-center">
                Økonomisk rådgivning – uden bank.
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 overflow-y-auto space-y-4">
          {allGroups.map((group, groupIndex) => (
            <div key={group.label}>
              <p className="px-2 mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 select-none">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive =
                    item.href === '/' || item.href === '/admin'
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(item.href + '/');
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name + item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
              {groupIndex < allGroups.length - 1 && (
                <div className="mt-4 border-t border-border/50" />
              )}
            </div>
          ))}
        </nav>

        <div className="px-4 pb-4 pt-2 space-y-1">
          {user && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/40">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-label font-bold text-primary uppercase">
                  {user.email?.[0] ?? '?'}
                </span>
              </div>
              <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                {user.email}
              </span>
              <button
                onClick={() => signOut()}
                title="Log ud"
                className="shrink-0 p-1 rounded-lg text-muted-foreground/60 hover:text-muted-foreground hover:bg-secondary transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex justify-center pt-1">
            <span className="text-label text-muted-foreground/40 tracking-wide select-none">
              Kuvert {VERSION}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
