import { Chrome as Home, LayoutDashboard, TrendingUp, Target, Users, Activity, Settings, Navigation, ShieldCheck, Calculator, ClipboardCheck, Zap, FileText, Upload, Shuffle, List, PiggyBank, Coins } from 'lucide-react';
import type { ComponentType } from 'react';
import { supabase } from './supabase';
import type { NavGroupWithItems, MobileNavSlotWithItem } from './database.types';
import { KuvertIcon } from '@/components/icons/kuvert-icon';

export const NAV_ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  Home: KuvertIcon,
  Kuvert: KuvertIcon,
  EnvelopeCoin: KuvertIcon,
  House: Home,
  LayoutDashboard,
  TrendingUp,
  Target,
  Users,
  Activity,
  Settings,
  Navigation,
  ShieldCheck,
  Calculator,
  ClipboardCheck,
  Zap,
  FileText,
  Upload,
  Shuffle,
  List,
  PiggyBank,
  Coins,
};

export const DEFAULT_MOBILE_NAV_OPTIONS: { id: string; icon: ComponentType<{ className?: string }>; href: string; label: string; isBurger?: boolean }[] = [
  { id: 'kuvert', icon: KuvertIcon, href: '/', label: 'Kuvert' },
  { id: 'udgifter', icon: Coins, href: '/udgifter', label: 'Udgifter' },
  { id: 'sparet', icon: PiggyBank, href: '/opsparing', label: 'Sparet' },
  { id: 'indstillinger', icon: Settings, href: '/indstillinger', label: 'Indstillinger' },
];

export const RELEASE_NAV_HREFS = new Set(
  DEFAULT_MOBILE_NAV_OPTIONS
    .filter((item) => !item.isBurger)
    .map((item) => item.href)
);

export function getDisplayNavName(name: string, href?: string | null): string {
  if (href === '/') return 'Kuvert';
  if (href === '/udgifter') return 'Udgifter';
  if (href === '/maal' || href === '/opsparing') return 'Sparet';
  if (name === 'Oversigt' || name === 'Overblik') return 'Kuvert';
  if (name === 'Nuvio Flow' || name === 'Flow' || name === 'Kuvert') return 'Udgifter';
  if (name === 'Opsparing' || name === 'Flow Opsparing' || name === 'Flow-opsparing') return 'Sparet';
  return name;
}

export function getDisplayNavIconName(iconName: string, href?: string | null): string {
  if (href === '/') return 'Kuvert';
  return iconName;
}

export interface PlanSubItem {
  id: string;
  name: string;
  href_template: string;
  icon_name: string;
  sort_order: number;
  sub_group_id: string | null;
  requires_budget: boolean;
  requires_transactions: boolean;
  is_system: boolean;
}

export interface PlanSubGroup {
  id: string;
  name: string;
  sort_order: number;
  items: PlanSubItem[];
}

export async function getPlanSubGroups(): Promise<PlanSubGroup[]> {
  const [{ data: groups }, { data: items }] = await Promise.all([
    supabase.from('nav_plan_sub_groups').select('*').order('sort_order'),
    supabase.from('nav_plan_sub_items').select('*').order('sort_order'),
  ]);

  if (!groups) return [];
  const allItems: PlanSubItem[] = items ?? [];

  const ungrouped = allItems.filter((i) => i.sub_group_id === null);
  const grouped = (groups as PlanSubGroup[]).map((g) => ({
    ...g,
    items: allItems.filter((i) => i.sub_group_id === g.id),
  }));

  if (ungrouped.length > 0) {
    return [{ id: '__ungrouped__', name: '', sort_order: -1, items: ungrouped }, ...grouped];
  }
  return grouped;
}

export async function createPlanSubGroup(name: string, sort_order: number) {
  const { data, error } = await supabase
    .from('nav_plan_sub_groups')
    .insert({ name, sort_order })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renamePlanSubGroup(id: string, name: string) {
  const { error } = await supabase
    .from('nav_plan_sub_groups')
    .update({ name })
    .eq('id', id);
  if (error) throw error;
}

export async function deletePlanSubGroup(id: string) {
  const { error } = await supabase
    .from('nav_plan_sub_groups')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function reorderPlanSubGroups(orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from('nav_plan_sub_groups').update({ sort_order: index }).eq('id', id)
    )
  );
}

export async function movePlanSubItem(itemId: string, subGroupId: string | null, sortOrder: number) {
  const { error } = await supabase
    .from('nav_plan_sub_items')
    .update({ sub_group_id: subGroupId, sort_order: sortOrder })
    .eq('id', itemId);
  if (error) throw error;
}

export async function reorderPlanSubItemsInGroup(subGroupId: string | null, orderedItemIds: string[]) {
  await Promise.all(
    orderedItemIds.map((id, index) =>
      supabase.from('nav_plan_sub_items').update({ sort_order: index }).eq('id', id)
    )
  );
}

export async function getNavGroupsWithItems(includeHidden = false): Promise<NavGroupWithItems[]> {
  const itemsQuery = supabase.from('nav_items').select('*').eq('is_system', false).order('sort_order');
  const [{ data: groups }, { data: items }] = await Promise.all([
    supabase.from('nav_groups').select('*').order('sort_order'),
    includeHidden ? itemsQuery : itemsQuery.eq('is_visible_to_users', true),
  ]);

  if (!groups || groups.length === 0) return [];

  return groups.map((g) => ({
    ...g,
    items: (items ?? [])
      .filter((item) => item.group_id === g.id)
      .map((item) => ({
        ...item,
        name: getDisplayNavName(item.name, item.href),
        icon_name: getDisplayNavIconName(item.icon_name, item.href),
      })),
  }));
}

export async function createNavGroup(name: string, sort_order: number) {
  const { data, error } = await supabase
    .from('nav_groups')
    .insert({ name, sort_order })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameNavGroup(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('nav_groups')
    .update({ name })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteNavGroup(id: string): Promise<void> {
  const { error } = await supabase
    .from('nav_groups')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function reorderNavGroups(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from('nav_groups').update({ sort_order: index }).eq('id', id)
    )
  );
}

export async function moveNavItem(
  itemId: string,
  newGroupId: string,
  newSortOrder: number
): Promise<void> {
  const { error } = await supabase
    .from('nav_items')
    .update({ group_id: newGroupId, sort_order: newSortOrder })
    .eq('id', itemId);
  if (error) throw error;
}

export async function setNavItemVisibility(
  itemId: string,
  isVisibleToUsers: boolean
): Promise<void> {
  const { error } = await supabase
    .from('nav_items')
    .update({ is_visible_to_users: isVisibleToUsers } as any)
    .eq('id', itemId);
  if (error) throw error;
}

export async function reorderNavItemsInGroup(
  groupId: string,
  orderedItemIds: string[]
): Promise<void> {
  await Promise.all(
    orderedItemIds.map((id, index) =>
      supabase
        .from('nav_items')
        .update({ sort_order: index })
        .eq('id', id)
        .eq('group_id', groupId)
    )
  );
}

export async function getMobileNavSlots(): Promise<MobileNavSlotWithItem[]> {
  const { data: slots, error: slotsError } = await supabase
    .from('mobile_nav_slots')
    .select('*')
    .order('position');
  if (slotsError) throw slotsError;
  if (!slots || slots.length === 0) return [];

  const navItemIds = slots.map((s) => s.nav_item_id).filter(Boolean) as string[];
  let navItemsMap: Record<string, import('./database.types').NavItem> = {};

  if (navItemIds.length > 0) {
    const { data: navItems, error: navError } = await supabase
      .from('nav_items')
      .select('*')
      .in('id', navItemIds);
    if (navError) throw navError;
    (navItems ?? []).forEach((item) => {
      navItemsMap[item.id] = {
        ...item,
        name: getDisplayNavName(item.name, item.href),
        icon_name: getDisplayNavIconName(item.icon_name, item.href),
      };
    });
  }

  return slots.map((slot) => ({
    ...slot,
    nav_item: slot.nav_item_id ? (navItemsMap[slot.nav_item_id] ?? null) : null,
  }));
}

export async function setMobileNavSlot(position: number, navItemId: string | null, isBurger = false): Promise<void> {
  const { error } = await supabase
    .from('mobile_nav_slots')
    .update({ nav_item_id: isBurger ? null : navItemId, is_burger: isBurger, updated_at: new Date().toISOString() })
    .eq('position', position);
  if (error) throw error;
}
