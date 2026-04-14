'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Pencil,
  Trash2,
  Check,
  X,
  Plus,
  GripVertical,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getCategoryGroups,
  renameCategoryGroup,
  deleteCategoryGroupWithReassign,
  getCategoryGroupWithCounts,
  createCategoryGroup,
} from '@/lib/db-helpers';
import type { CategoryGroup } from '@/lib/database.types';

interface CategoryGroupManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

interface GroupWithCounts extends CategoryGroup {
  recipientCount?: number;
  transactionCount?: number;
}

type DeleteState =
  | { step: 'idle' }
  | { step: 'confirm'; group: GroupWithCounts }
  | { step: 'reassign'; group: GroupWithCounts; targetGroupId: string; newGroupName: string; mode: 'existing' | 'new' };

export function CategoryGroupManagerDialog({
  open,
  onOpenChange,
  onChanged,
}: CategoryGroupManagerDialogProps) {
  const [groups, setGroups] = useState<GroupWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIsIncome, setNewGroupIsIncome] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);

  const [deleteState, setDeleteState] = useState<DeleteState>({ step: 'idle' });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      loadGroups();
    }
  }, [open]);

  async function loadGroups() {
    setLoading(true);
    try {
      const data = await getCategoryGroups();
      setGroups(data || []);
    } catch {
      toast.error('Kunne ikke hente kategorier');
    } finally {
      setLoading(false);
    }
  }

  function startEdit(group: GroupWithCounts) {
    setEditingId(group.id);
    setEditName(group.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
  }

  async function saveEdit(groupId: string) {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error('Navn må ikke være tomt');
      return;
    }
    setSavingId(groupId);
    try {
      await renameCategoryGroup(groupId, trimmed);
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: trimmed } : g));
      setEditingId(null);
      toast.success('Navn opdateret');
      onChanged();
    } catch {
      toast.error('Kunne ikke gemme navn');
    } finally {
      setSavingId(null);
    }
  }

  async function initiateDelete(group: GroupWithCounts) {
    try {
      const counts = await getCategoryGroupWithCounts(group.id);
      const enriched = { ...group, ...counts };
      if (counts.recipientCount === 0 && counts.transactionCount === 0) {
        setDeleteState({ step: 'confirm', group: enriched });
      } else {
        setDeleteState({
          step: 'reassign',
          group: enriched,
          targetGroupId: '',
          newGroupName: '',
          mode: 'existing',
        });
      }
    } catch {
      toast.error('Kunne ikke hente data');
    }
  }

  async function confirmDelete(targetGroupId: string | null) {
    if (deleteState.step !== 'confirm' && deleteState.step !== 'reassign') return;
    const group = deleteState.group;

    setDeleting(true);
    try {
      let finalTargetId = targetGroupId;

      if (deleteState.step === 'reassign' && deleteState.mode === 'new') {
        const name = deleteState.newGroupName.trim();
        if (!name) {
          toast.error('Angiv et navn til den nye kategori');
          setDeleting(false);
          return;
        }
        finalTargetId = await createCategoryGroup(name, group.is_income);
      }

      await deleteCategoryGroupWithReassign(group.id, finalTargetId);
      await loadGroups();
      setDeleteState({ step: 'idle' });
      toast.success(`"${group.name}" slettet`);
      onChanged();
    } catch {
      toast.error('Sletning mislykkedes');
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreateNew() {
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      toast.error('Angiv et navn');
      return;
    }
    setCreatingNew(true);
    try {
      await createCategoryGroup(trimmed, newGroupIsIncome);
      setNewGroupName('');
      setNewGroupIsIncome(false);
      await loadGroups();
      toast.success(`"${trimmed}" oprettet`);
      onChanged();
    } catch {
      toast.error('Kunne ikke oprette kategori');
    } finally {
      setCreatingNew(false);
    }
  }

  const otherGroups = deleteState.step === 'reassign' || deleteState.step === 'confirm'
    ? groups.filter(g => g.id !== deleteState.group.id)
    : [];

  const incomeGroups = groups.filter(g => g.is_income);
  const expenseGroups = groups.filter(g => !g.is_income);

  function renderGroupList(list: GroupWithCounts[], label: string, color: string) {
    if (list.length === 0) return null;
    return (
      <div className="space-y-1">
        <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${color}`}>{label}</p>
        {list.map(group => (
          <div
            key={group.id}
            className="flex items-center gap-3 rounded-xl px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors group"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />

            <div className="flex-1 min-w-0">
              {editingId === group.id ? (
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveEdit(group.id);
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  className="h-8 text-sm"
                  autoFocus
                />
              ) : (
                <span className="text-sm font-medium truncate">{group.name}</span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {editingId === group.id ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    onClick={() => saveEdit(group.id)}
                    disabled={savingId === group.id}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={cancelEdit}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => startEdit(group)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950"
                    onClick={() => initiateDelete(group)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Administrer hovedkategorier</DialogTitle>
            <DialogDescription>
              Omdøb, opret eller slet dine hovedkategorier. Hold over en kategori for at se handlinger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="rounded-2xl border border-border p-4 space-y-2 bg-card">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Opret ny kategori
              </p>
              <div className="flex gap-2">
                <Input
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Navn på kategori"
                  className="flex-1"
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateNew(); }}
                />
                <Button onClick={handleCreateNew} disabled={creatingNew} size="sm" className="shrink-0">
                  Opret
                </Button>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Switch
                  id="is-income"
                  checked={newGroupIsIncome}
                  onCheckedChange={setNewGroupIsIncome}
                />
                <Label htmlFor="is-income" className="text-sm cursor-pointer">
                  Dette er en <span className="font-semibold text-emerald-600">indtægtskategori</span>
                </Label>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Indlæser...</p>
            ) : groups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Ingen kategorier endnu</p>
              </div>
            ) : (
              <div className="space-y-5">
                {renderGroupList(incomeGroups, 'Indtægt', 'text-emerald-600')}
                {renderGroupList(expenseGroups, 'Udgifter', 'text-rose-500')}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteState.step === 'confirm'}
        onOpenChange={open => { if (!open) setDeleteState({ step: 'idle' }); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-500" />
              Slet &ldquo;{deleteState.step === 'confirm' ? deleteState.group.name : ''}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Denne kategori har ingen modtagere eller posteringer. Den slettes permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuller</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => confirmDelete(null)}
              disabled={deleting}
            >
              {deleting ? 'Sletter...' : 'Slet'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteState.step === 'reassign'}
        onOpenChange={open => { if (!open) setDeleteState({ step: 'idle' }); }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Flyt posteringer før sletning
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Kategorien <strong className="text-foreground">&ldquo;{deleteState.step === 'reassign' ? deleteState.group.name : ''}&rdquo;</strong> indeholder:
                </p>
                {deleteState.step === 'reassign' && (
                  <div className="flex gap-4">
                    {(deleteState.group.recipientCount ?? 0) > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <TrendingDown className="h-3 w-3" />
                        {deleteState.group.recipientCount} modtagere
                      </Badge>
                    )}
                    {(deleteState.group.transactionCount ?? 0) > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {deleteState.group.transactionCount} posteringer
                      </Badge>
                    )}
                  </div>
                )}
                <p>Vælg hvad der skal ske med dem:</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteState.step === 'reassign' && (
            <div className="space-y-4 py-2">
              <div className="flex rounded-xl overflow-hidden border border-border">
                <button
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${deleteState.mode === 'existing' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 hover:bg-secondary text-muted-foreground'}`}
                  onClick={() => setDeleteState(s => s.step === 'reassign' ? { ...s, mode: 'existing' } : s)}
                >
                  Flyt til eksisterende
                </button>
                <button
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${deleteState.mode === 'new' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 hover:bg-secondary text-muted-foreground'}`}
                  onClick={() => setDeleteState(s => s.step === 'reassign' ? { ...s, mode: 'new' } : s)}
                >
                  Opret ny kategori
                </button>
              </div>

              {deleteState.mode === 'existing' ? (
                <div className="space-y-2">
                  <Label className="text-sm">Flyt til kategori</Label>
                  <Select
                    value={deleteState.targetGroupId}
                    onValueChange={val => setDeleteState(s => s.step === 'reassign' ? { ...s, targetGroupId: val } : s)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg destination..." />
                    </SelectTrigger>
                    <SelectContent>
                      {otherGroups.map(g => (
                        <SelectItem key={g.id} value={g.id}>
                          <span className="flex items-center gap-2">
                            {g.is_income
                              ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                              : <TrendingDown className="h-3.5 w-3.5 text-rose-400" />}
                            {g.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-sm">Navn på ny kategori</Label>
                  <Input
                    value={deleteState.newGroupName}
                    onChange={e => setDeleteState(s => s.step === 'reassign' ? { ...s, newGroupName: e.target.value } : s)}
                    placeholder="F.eks. Diverse udgifter"
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuller</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={
                deleting ||
                (deleteState.step === 'reassign' && deleteState.mode === 'existing' && !deleteState.targetGroupId) ||
                (deleteState.step === 'reassign' && deleteState.mode === 'new' && !deleteState.newGroupName.trim())
              }
              onClick={() => {
                if (deleteState.step !== 'reassign') return;
                confirmDelete(deleteState.mode === 'existing' ? deleteState.targetGroupId : null);
              }}
            >
              {deleting ? 'Behandler...' : 'Slet og flyt'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
