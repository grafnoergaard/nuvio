'use client';

import { useState, useEffect } from 'react';
import {
  getNavGroupsWithItems,
  createNavGroup,
  renameNavGroup,
  deleteNavGroup,
  reorderNavGroups,
  moveNavItem,
  reorderNavItemsInGroup,
  setNavItemVisibility,
  getMobileNavSlots,
  setMobileNavSlot,
  NAV_ICON_MAP,
} from '@/lib/nav-config';
import type { NavGroupWithItems, NavItem, MobileNavSlotWithItem } from '@/lib/database.types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Navigation,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Save,
  ShieldCheck,
  Smartphone,
  Eye,
  EyeOff,
  GripVertical,
  Menu,
} from 'lucide-react';
import { toast } from 'sonner';
import { useUIStrings } from '@/lib/ui-strings-context';

export default function NavigationAdminPage() {
  const [groups, setGroups] = useState<NavGroupWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [renameEdits, setRenameEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const { getString, updateString, loaded: stringsLoaded } = useUIStrings();
  const [navHeightValue, setNavHeightValue] = useState(70);
  const [savingHeight, setSavingHeight] = useState(false);
  const [mobileNavEnabled, setMobileNavEnabled] = useState(true);
  const [savingEnabled, setSavingEnabled] = useState(false);
  const [slots, setSlots] = useState<MobileNavSlotWithItem[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotCount, setSlotCount] = useState(4);
  const [savingSlotCount, setSavingSlotCount] = useState(false);

  useEffect(() => {
    if (stringsLoaded) {
      const stored = parseInt(getString('mobile_nav_height', '70'), 10);
      if (!isNaN(stored)) setNavHeightValue(stored);
      const enabled = getString('mobile_nav_enabled', 'true');
      setMobileNavEnabled(enabled !== 'false');
      const count = parseInt(getString('mobile_nav_slot_count', '4'), 10);
      if (!isNaN(count)) setSlotCount(Math.min(4, Math.max(2, count)));
    }
  }, [stringsLoaded, getString]);

  async function handleSaveNavHeight() {
    setSavingHeight(true);
    try {
      await updateString('mobile_nav_height', String(navHeightValue));
      toast.success('Mobilmenu-højde gemt');
    } catch {
      toast.error('Kunne ikke gemme højde');
    } finally {
      setSavingHeight(false);
    }
  }

  async function handleSaveSlotCount(count: number) {
    const clamped = Math.min(4, Math.max(2, count));
    setSavingSlotCount(true);
    try {
      await updateString('mobile_nav_slot_count', String(clamped));
      setSlotCount(clamped);
      toast.success(`Bundmenu viser nu ${clamped} slots`);
    } catch {
      toast.error('Kunne ikke gemme antal slots');
    } finally {
      setSavingSlotCount(false);
    }
  }

  async function handleToggleMobileNav(enabled: boolean) {
    setSavingEnabled(true);
    try {
      await updateString('mobile_nav_enabled', enabled ? 'true' : 'false');
      setMobileNavEnabled(enabled);
      toast.success(enabled ? 'Bundmenu aktiveret' : 'Bundmenu deaktiveret');
    } catch {
      toast.error('Kunne ikke gemme indstilling');
    } finally {
      setSavingEnabled(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const data = await getNavGroupsWithItems(true);
      setGroups(data);
      const edits: Record<string, string> = {};
      data.forEach((g) => { edits[g.id] = g.name; });
      setRenameEdits(edits);
    } finally {
      setLoading(false);
    }
  }

  async function loadSlots() {
    setSlotsLoading(true);
    try {
      const data = await getMobileNavSlots();
      setSlots(data);
    } catch {
      toast.error('Kunne ikke hente bundmenu-slots');
    } finally {
      setSlotsLoading(false);
    }
  }

  useEffect(() => { load(); loadSlots(); }, []);

  async function handleSlotChange(position: number, navItemId: string) {
    const isBurger = navItemId === '__burger__';
    const resolvedId = navItemId === '__empty__' || isBurger ? null : navItemId;
    try {
      await setMobileNavSlot(position, resolvedId, isBurger);
      await loadSlots();
      toast.success(`Slot ${position} opdateret`);
    } catch {
      toast.error('Kunne ikke opdatere slot');
    }
  }

  const allNavItems = groups.flatMap((g) => g.items);

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    setSaving('new');
    try {
      await createNavGroup(newGroupName.trim(), groups.length);
      setNewGroupName('');
      await load();
      toast.success('Gruppe oprettet');
    } catch {
      toast.error('Kunne ikke oprette gruppe');
    } finally {
      setSaving(null);
    }
  }

  async function handleRenameGroup(groupId: string) {
    const name = renameEdits[groupId]?.trim();
    if (!name) return;
    setSaving(groupId);
    try {
      await renameNavGroup(groupId, name);
      await load();
      toast.success('Gruppe omdøbt');
    } catch {
      toast.error('Kunne ikke omdøbe gruppe');
    } finally {
      setSaving(null);
    }
  }

  async function handleDeleteGroup(groupId: string) {
    setSaving(groupId + '-delete');
    try {
      await deleteNavGroup(groupId);
      await load();
      toast.success('Gruppe slettet');
    } catch {
      toast.error('Kunne ikke slette gruppe');
    } finally {
      setSaving(null);
    }
  }

  async function handleMoveGroupUp(index: number) {
    if (index === 0) return;
    const newOrder = [...groups];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setGroups(newOrder);
    await reorderNavGroups(newOrder.map((g) => g.id));
  }

  async function handleMoveGroupDown(index: number) {
    if (index === groups.length - 1) return;
    const newOrder = [...groups];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setGroups(newOrder);
    await reorderNavGroups(newOrder.map((g) => g.id));
  }

  async function handleMoveItemUp(groupId: string, itemIndex: number) {
    if (itemIndex === 0) return;
    const group = groups.find((g) => g.id === groupId)!;
    const newItems = [...group.items];
    [newItems[itemIndex - 1], newItems[itemIndex]] = [newItems[itemIndex], newItems[itemIndex - 1]];
    await reorderNavItemsInGroup(groupId, newItems.map((i) => i.id));
    await load();
  }

  async function handleMoveItemDown(groupId: string, itemIndex: number, total: number) {
    if (itemIndex === total - 1) return;
    const group = groups.find((g) => g.id === groupId)!;
    const newItems = [...group.items];
    [newItems[itemIndex], newItems[itemIndex + 1]] = [newItems[itemIndex + 1], newItems[itemIndex]];
    await reorderNavItemsInGroup(groupId, newItems.map((i) => i.id));
    await load();
  }

  async function handleToggleVisibility(item: NavItem) {
    const current = (item as any).is_visible_to_users as boolean | null;
    const next = current === false ? true : false;
    setSaving(item.id + '-vis');
    try {
      await setNavItemVisibility(item.id, next);
      await load();
      toast.success(next ? `${item.name} synlig for brugere` : `${item.name} skjult for brugere`);
    } catch {
      toast.error('Kunne ikke ændre synlighed');
    } finally {
      setSaving(null);
    }
  }

  async function handleMoveItemToGroup(item: NavItem, targetGroupId: string) {
    if (targetGroupId === item.group_id) return;
    const targetGroup = groups.find((g) => g.id === targetGroupId)!;
    const newSortOrder = targetGroup.items.length;
    setSaving(item.id);
    try {
      await moveNavItem(item.id, targetGroupId, newSortOrder);
      await load();
      toast.success(`${item.name} flyttet til ${targetGroup.name}`);
    } catch {
      toast.error('Kunne ikke flytte element');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-4 md:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Navigation</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Administrer menugrupper og menupunkter
          </p>
        </div>

        <Card className="shadow-xl border-0 rounded-3xl overflow-hidden bg-secondary/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              Backend-menu (altid fast)
            </CardTitle>
            <CardDescription>
              Disse punkter er fastlåste i Backend-menuen og kan ikke flyttes:
              Design, Beregning, Brugere, Nuvio Checkup, Advisory Engine, Navigation.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Bundmenu
            </CardTitle>
            <CardDescription>
              Slå bundmenuen til eller fra for alle brugere. Kun admins ser bundmenuen uanset denne indstilling.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Switch
                id="mobile-nav-toggle"
                checked={mobileNavEnabled}
                onCheckedChange={handleToggleMobileNav}
                disabled={savingEnabled}
              />
              <Label htmlFor="mobile-nav-toggle" className="text-sm font-medium cursor-pointer">
                {mobileNavEnabled ? 'Bundmenu er synlig for brugere' : 'Bundmenu er skjult for brugere'}
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Mobil menu-højde
            </CardTitle>
            <CardDescription>
              Juster højden på den nederste mobilmenu (i pixels).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Slider
                    min={48}
                    max={100}
                    step={1}
                    value={[navHeightValue]}
                    onValueChange={([v]) => setNavHeightValue(v)}
                    className="w-full"
                  />
                  <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                    <span>48px</span>
                    <span>100px</span>
                  </div>
                </div>
                <div className="shrink-0 w-20">
                  <Input
                    type="number"
                    min={48}
                    max={100}
                    value={navHeightValue}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 48 && v <= 100) setNavHeightValue(v);
                    }}
                    className="rounded-xl text-center font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-xl bg-card border border-border/60 text-xs text-muted-foreground font-mono shrink-0"
                  style={{ width: 120, height: navHeightValue }}
                >
                  {navHeightValue}px
                </div>
                <p className="text-xs text-muted-foreground">
                  Forhåndsvisning af menuens højde
                </p>
              </div>
              <Button
                onClick={handleSaveNavHeight}
                disabled={savingHeight}
                className="rounded-xl"
              >
                <Save className="h-4 w-4 mr-1.5" />
                Gem højde
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Antal menupunkter
            </CardTitle>
            <CardDescription>
              Vælg hvor mange punkter der vises i bundmenuen. Minimum 2, maksimum 4 slots.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Slider
                    min={2}
                    max={4}
                    step={1}
                    value={[slotCount]}
                    onValueChange={([v]) => setSlotCount(v)}
                    className="w-full"
                  />
                  <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                    <span>2 (min)</span>
                    <span>4 (max)</span>
                  </div>
                </div>
                <div className="shrink-0 text-center w-20">
                  <p className="text-2xl font-bold tabular-nums">{slotCount}</p>
                  <p className="text-xs text-muted-foreground">slots i alt</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/30 border border-border/40">
                {Array.from({ length: slotCount }).map((_, i) => (
                  <div key={i} className="flex-1 h-8 rounded-xl bg-foreground/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => handleSaveSlotCount(slotCount)}
                disabled={savingSlotCount}
                className="rounded-xl"
              >
                <Save className="h-4 w-4 mr-1.5" />
                Gem antal
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <GripVertical className="h-5 w-5" />
              Bundmenu — slots
            </CardTitle>
            <CardDescription>
              Vælg hvilke menupunkter der vises direkte i mobilens bundmenu. Alle slots er frie — vælg fx &quot;Menu (burger)&quot; til at placere burger-menuen hvor du vil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {slotsLoading ? (
              <div className="text-center text-muted-foreground py-6 text-sm">Indlæser slots...</div>
            ) : (
              <div className="space-y-3">
                {slots.map((slot) => {
                  const currentItem = (slot as any).nav_item as import('@/lib/database.types').NavItem | null | undefined;
                  const isBurger = (slot as any).is_burger as boolean;
                  const CurrentIcon = currentItem ? NAV_ICON_MAP[currentItem.icon_name] : null;
                  const isHidden = slot.position > slotCount;
                  const selectValue = isBurger ? '__burger__' : (slot.nav_item_id ?? '__empty__');
                  return (
                    <div
                      key={slot.id}
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-opacity ${
                        isHidden
                          ? 'bg-muted/20 border-border/20 opacity-40'
                          : 'bg-secondary/40 border-border/40'
                      }`}
                    >
                      <div className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center ${isHidden ? 'bg-muted' : 'bg-primary/10'}`}>
                        <span className={`text-xs font-bold ${isHidden ? 'text-muted-foreground' : 'text-primary'}`}>{slot.position}</span>
                      </div>
                      {isBurger ? (
                        <Menu className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : CurrentIcon ? (
                        <CurrentIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-border/60 shrink-0" />
                      )}
                      <span className="flex-1 text-sm font-medium text-foreground">
                        {isBurger
                          ? 'Menu (burger)'
                          : currentItem
                            ? currentItem.name
                            : <span className="text-muted-foreground italic">Tom</span>
                        }
                        {isHidden && <span className="ml-2 text-xs text-muted-foreground">(skjult)</span>}
                      </span>
                      <Select
                        value={selectValue}
                        onValueChange={(val) => handleSlotChange(slot.position, val)}
                      >
                        <SelectTrigger className="w-44 h-8 text-xs rounded-xl">
                          <SelectValue placeholder="Vælg menupunkt..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__empty__">— Tom slot —</SelectItem>
                          <SelectItem value="__burger__">Menu (burger)</SelectItem>
                          {allNavItems.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Opret ny menugruppe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Gruppenavn, fx. Planlægning..."
                onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                className="flex-1 rounded-xl"
              />
              <Button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim() || saving === 'new'}
                className="rounded-xl"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Tilføj gruppe
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center text-muted-foreground py-16">
            <Navigation className="h-8 w-8 mx-auto mb-3 opacity-30 animate-pulse" />
            <p className="text-sm">Indlæser navigation...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">
            <p className="text-sm">Ingen grupper fundet. Opret en ovenfor.</p>
          </div>
        ) : (
          groups.map((group, groupIndex) => (
            <Card key={group.id} className="shadow-xl border-0 rounded-3xl overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-lg"
                      onClick={() => handleMoveGroupUp(groupIndex)}
                      disabled={groupIndex === 0}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-lg"
                      onClick={() => handleMoveGroupDown(groupIndex)}
                      disabled={groupIndex === groups.length - 1}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <Input
                    value={renameEdits[group.id] ?? group.name}
                    onChange={(e) =>
                      setRenameEdits((prev) => ({ ...prev, [group.id]: e.target.value }))
                    }
                    className="flex-1 font-semibold h-9 rounded-xl"
                    onKeyDown={(e) => e.key === 'Enter' && handleRenameGroup(group.id)}
                  />

                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl shrink-0"
                    onClick={() => handleRenameGroup(group.id)}
                    disabled={
                      renameEdits[group.id]?.trim() === group.name ||
                      saving === group.id
                    }
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Gem
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl shrink-0 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                    onClick={() => handleDeleteGroup(group.id)}
                    disabled={group.items.length > 0 || saving === group.id + '-delete'}
                    title={
                      group.items.length > 0
                        ? 'Flyt alle elementer fra gruppen først'
                        : 'Slet gruppe'
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                {group.items.length === 0 ? (
                  <div className="text-center text-muted-foreground py-6 border border-dashed border-border/60 rounded-2xl">
                    <p className="text-sm">Ingen elementer i denne gruppe</p>
                    <p className="text-xs mt-1 opacity-60">Flyt elementer hertil fra en anden gruppe</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {group.items.map((item, itemIndex) => {
                      const Icon = NAV_ICON_MAP[item.icon_name];
                      const hrefDisplay = (item as any).href_template ?? item.href;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                            (item as any).is_visible_to_users === false
                              ? 'bg-muted/30 border-border/30 opacity-60'
                              : 'bg-secondary/40 border-border/40'
                          }`}
                        >
                          {Icon && (
                            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="flex-1 text-sm font-medium">{item.name}</span>
                          {(item as any).is_visible_to_users === false && (
                            <Badge variant="outline" className="text-xs text-muted-foreground border-border/50 hidden sm:inline-flex">
                              Skjult
                            </Badge>
                          )}
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs hidden sm:inline-flex"
                          >
                            {hrefDisplay}
                          </Badge>

                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 rounded-lg shrink-0 ${
                              (item as any).is_visible_to_users === false
                                ? 'text-red-500 hover:text-red-600 hover:bg-red-50'
                                : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                            onClick={() => handleToggleVisibility(item)}
                            disabled={saving === item.id + '-vis'}
                            title={
                              (item as any).is_visible_to_users === false
                                ? 'Vis for brugere'
                                : 'Skjul for brugere'
                            }
                          >
                            {(item as any).is_visible_to_users === false ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </Button>

                          <div className="flex gap-0.5 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg"
                              onClick={() => handleMoveItemUp(group.id, itemIndex)}
                              disabled={itemIndex === 0}
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg"
                              onClick={() =>
                                handleMoveItemDown(group.id, itemIndex, group.items.length)
                              }
                              disabled={itemIndex === group.items.length - 1}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <Select
                            value={group.id}
                            onValueChange={(targetId) =>
                              handleMoveItemToGroup(item, targetId)
                            }
                            disabled={saving === item.id}
                          >
                            <SelectTrigger className="w-36 h-8 text-xs rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {groups.map((g) => (
                                <SelectItem key={g.id} value={g.id}>
                                  {g.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
